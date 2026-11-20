import { Router } from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ApplicationModel, APPLICATION_STATUSES } from '../models/Application.js'
import { PositionModel } from '../models/Position.js'
import { MediaBlobModel } from '../models/MediaBlob.js'
import { HttpError } from '../middleware/errors.js'
import { requireAdmin } from '../middleware/auth.js'
import { sendApplicationNotification } from '../services/email.js'
import { getVacancySettings } from '../services/siteSettings.js'
import { connectDB } from '../db.js'
import { extractBlobIdsFromDoc, deleteMediaBlobsByIds } from '../services/mediaStorage.js'

export const applicationsRouter = Router()

const MAX_CV_BYTES = 4 * 1024 * 1024 // 4 MB (safely under Vercel's 4.5 MB serverless payload limit)

// Memory storage keeps file buffers accessible for serverless / cloud deployment
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
    } else {
      cb(new HttpError(400, 'Only PDF resumes/CVs are accepted'))
    }
  },
})

function hasPdfMagicBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false
  // Standard PDF header starts with "%PDF-" (occasionally preceded by UTF-8 BOM)
  const headerSlice = buf.subarray(0, 16).toString('latin1')
  return headerSlice.includes('%PDF-')
}

// Per-IP submission rate limiter: max 5 applications per IP per hour
interface SubmissionRateRecord {
  count: number
  windowStart: number
}
const submissionAttempts = new Map<string, SubmissionRateRecord>()
const MAX_SUBMISSIONS_PER_WINDOW = 5
const SUBMISSION_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkSubmissionRateLimit(ip: string): boolean {
  const now = Date.now()
  const rec = submissionAttempts.get(ip)
  if (!rec || now - rec.windowStart > SUBMISSION_WINDOW_MS) {
    submissionAttempts.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (rec.count >= MAX_SUBMISSIONS_PER_WINDOW) {
    return false
  }
  rec.count += 1
  return true
}

const optionalTrimmed = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .optional()
    .or(z.literal(''))
    .transform(v => (v ? v : undefined))

const ApplicationInputSchema = z.object({
  positionId: optionalTrimmed(64),
  positionTitle: optionalTrimmed(160),
  designation: optionalTrimmed(160),
  name: z.string().trim().min(2, 'Full name is required').max(120, 'Name is too long'),
  email: z.string().trim().email('Please provide a valid email address').max(254),
  phone: z.string().trim().min(4, 'Phone number is required').max(40, 'Phone number is too long'),
  university: z.string().trim().min(2, 'University is required').max(200),
  degreeYear: z.string().trim().min(2, 'Academic program / degree year is required').max(240),
  rollNo: optionalTrimmed(60),
  department: optionalTrimmed(140),
  program: optionalTrimmed(140),
  track: optionalTrimmed(160),
  statement: optionalTrimmed(3000),
  coverNote: optionalTrimmed(3000),
  github: optionalTrimmed(500),
  linkedin: optionalTrimmed(500),
  resumeUrl: optionalTrimmed(500),
  // Hidden honeypot field: real users leave this empty
  website: z.string().optional().default(''),
})

// Public endpoint for submitting applications
applicationsRouter.post('/', upload.single('cv'), async (req, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
    if (!checkSubmissionRateLimit(clientIp)) {
      throw new HttpError(
        429,
        'Too many application submissions from this IP address. Please try again in an hour.',
      )
    }

    const parsed = ApplicationInputSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new HttpError(400, firstIssue?.message || 'Invalid application fields')
    }

    const input = parsed.data

    // Honeypot check: silently return fake 201 so bots think they succeeded
    if (input.website && input.website.trim().length > 0) {
      res.status(201).json({
        success: true,
        message: 'Application successfully received by the AIR Lab committee!',
        id: 'honeypot-' + Date.now(),
      })
      return
    }

    if (req.file) {
      if (req.file.size > MAX_CV_BYTES) {
        throw new HttpError(400, 'Resume PDF must be 4 MB or smaller')
      }
      if (!hasPdfMagicBytes(req.file.buffer)) {
        throw new HttpError(400, 'Uploaded file is not a valid PDF document')
      }
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB()
      } catch (connErr) {
        console.warn('⚠️ MongoDB reconnect attempt failed during application submission:', connErr)
      }
    }

    const vacancy = await getVacancySettings()
    if (vacancy.status === 'Closed') {
      throw new HttpError(403, vacancy.closedMessage)
    }

    const positionTitleFromBody = input.positionTitle || input.designation

    // Verify position or select default
    let assignedPosition: unknown =
      input.positionId && mongoose.Types.ObjectId.isValid(input.positionId)
        ? input.positionId
        : undefined
    try {
      if (!assignedPosition && mongoose.connection.readyState === 1) {
        const defaultPos = await PositionModel.findOne({ isOpen: true }).maxTimeMS(2000)
        if (defaultPos) assignedPosition = defaultPos._id
      }
    } catch {
      // Ignore position lookup error
    }

    // Store uploaded PDF in dedicated MediaBlobModel collection instead of inline base64
    let cvData = {
      key: input.resumeUrl || 'attached',
      originalName: req.file ? req.file.originalname : 'resume.pdf',
      size: req.file ? req.file.size : 0,
    }

    if (req.file && mongoose.connection.readyState === 1) {
      try {
        const blob = await MediaBlobModel.create({
          mimeType: 'application/pdf',
          data: req.file.buffer,
          size: req.file.size,
          sourceSlug: 'applications',
        })
        cvData.key = `/api/media/blob/${String(blob._id)}`
      } catch (blobErr) {
        console.warn('⚠️ Failed to store CV in MediaBlobModel, falling back to resumeUrl/attached:', blobErr)
      }
    }

    let applicationId = 'temp-' + Date.now()
    let savedToDb = false
    try {
      if (mongoose.connection.readyState === 1) {
        const application = await ApplicationModel.create({
          position: assignedPosition,
          positionTitle: positionTitleFromBody || 'Research Intern',
          designation: positionTitleFromBody || 'Research Intern',
          name: input.name,
          email: input.email,
          phone: input.phone,
          university: input.university,
          degreeYear: input.degreeYear,
          rollNo: input.rollNo,
          department: input.department,
          program: input.program,
          track: input.track,
          statement: input.statement,
          coverNote: input.coverNote,
          github: input.github,
          linkedin: input.linkedin,
          cv: cvData,
          status: 'New',
        })
        applicationId = String(application._id)
        savedToDb = true
      }
    } catch (dbErr) {
      console.warn('⚠️ Could not save to DB (Atlas IP whitelist / connection timeout), proceeding with email delivery:', dbErr)
    }

    console.log(`📩 Application received from ${input.name} (${input.email})`)

    let positionTitle: string | undefined = positionTitleFromBody
    try {
      if (!positionTitle && assignedPosition && mongoose.connection.readyState === 1) {
        const posDoc = await PositionModel.findById(assignedPosition).lean()
        if (posDoc) positionTitle = posDoc.title
      }
    } catch {
      // ignore
    }

    // Dispatch notification email to admin and confirmation to applicant
    let emailDelivered = false
    try {
      const emailResult = await sendApplicationNotification({
        applicantName: input.name,
        applicantEmail: input.email,
        applicantPhone: input.phone,
        university: input.university,
        degreeYear: input.degreeYear,
        positionTitle: positionTitle || 'Research Intern',
        coverNote: input.coverNote,
        github: input.github,
        linkedin: input.linkedin,
        cvFile: req.file
          ? {
              originalName: req.file.originalname,
              buffer: req.file.buffer,
              contentType: req.file.mimetype,
            }
          : undefined,
      })
      emailDelivered = Boolean(emailResult?.sent)
      if (savedToDb && emailDelivered && mongoose.Types.ObjectId.isValid(applicationId)) {
        await ApplicationModel.findByIdAndUpdate(applicationId, { $set: { emailSent: true } }).catch(() => {})
      }
    } catch (emailErr) {
      console.error('⚠️ Failed to dispatch application notification email:', emailErr)
    }

    if (!savedToDb && !emailDelivered) {
      throw new HttpError(
        503,
        'Our application service is temporarily unavailable. Please try again in a few moments or email your CV to contact@airlab.neduet.edu.pk.',
      )
    }

    res.status(201).json({
      success: true,
      message: 'Application successfully received by the AIR Lab committee!',
      id: applicationId,
    })
  } catch (err) {
    next(err)
  }
})

// Protected Admin endpoints
applicationsRouter.get('/admin', requireAdmin, async (_req, res, next) => {
  try {
    const applications = await ApplicationModel.find()
      .populate('position', 'title track')
      .sort({ createdAt: -1 })
      .maxTimeMS(10000)
      .lean()

    // Ensure inline base64 blobs are never transferred in the admin list payload
    const sanitized = applications.map((app: any) => {
      if (typeof app?.cv?.key === 'string' && app.cv.key.startsWith('data:')) {
        return {
          ...app,
          cv: {
            ...app.cv,
            key: `/api/applications/admin/${String(app._id)}/cv`,
          },
        }
      }
      return app
    })

    res.json(sanitized)
  } catch (err) {
    next(err)
  }
})

// Fallback streaming endpoint for any legacy application with an inline base64 CV
applicationsRouter.get('/admin/:id/cv', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const app: any = await ApplicationModel.findById(id).select('cv').lean()
    if (!app?.cv?.key) {
      throw new HttpError(404, 'CV not found')
    }
    if (app.cv.key.startsWith('/api/media/blob/')) {
      res.redirect(app.cv.key)
      return
    }
    const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(app.cv.key)
    if (!match) {
      res.redirect(app.cv.key)
      return
    }
    const [, mime, b64] = match
    res.set({
      'Content-Type': mime || 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(app.cv.originalName || 'resume.pdf')}"`,
    })
    res.send(Buffer.from(b64, 'base64'))
  } catch (err) {
    next(err)
  }
})

applicationsRouter.patch('/admin/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const { status, adminNotes } = req.body
    if (status && !APPLICATION_STATUSES.includes(status)) {
      throw new HttpError(400, 'Invalid application status')
    }
    const update: Record<string, unknown> = {}
    if (typeof status === 'string') update.status = status
    if (typeof adminNotes === 'string') update.adminNotes = adminNotes.trim()

    const app = await ApplicationModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
    if (!app) throw new HttpError(404, 'Application not found')
    res.json(app)
  } catch (err) {
    next(err)
  }
})

applicationsRouter.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const deleted = await ApplicationModel.findByIdAndDelete(id).lean()
    if (!deleted) throw new HttpError(404, 'Application not found')
    const blobIds = extractBlobIdsFromDoc(deleted)
    if (blobIds.size > 0) {
      await deleteMediaBlobsByIds(blobIds)
    }
    res.json({ success: true, message: 'Application deleted' })
  } catch (err) {
    next(err)
  }
})
