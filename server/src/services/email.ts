import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env.js'
import { consumeRateLimit } from '../middleware/rateLimit.js'

let transporter: Transporter | null = null

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHttpsLink(url: string | undefined | null): string {
  if (!url) return ''
  const trimmed = String(url).trim()
  const escaped = escapeHtml(trimmed)
  if (trimmed.startsWith('https://')) {
    return `<a href="${escaped}" style="color: #2563eb;">${escaped}</a>`
  }
  return escaped
}

function sanitizeSubject(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
}

function cleanPdfFilename(rawName: string | undefined | null): string {
  const base = String(rawName || 'resume.pdf')
    .replace(/[^\w.-]/g, '_')
    .replace(/\.pdf$/i, '')
    .slice(0, 96)
  return `${base || 'resume'}.pdf`
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  const user = env.SMTP_USER || process.env.SMTP_USER
  const pass = env.SMTP_PASS || process.env.SMTP_PASS

  if (!user || !pass) {
    return null
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || process.env.SMTP_PORT || 465),
    secure: Number(env.SMTP_PORT || process.env.SMTP_PORT || 465) === 465,
    auth: {
      user,
      pass,
    },
  })

  return transporter
}

export interface ApplicationEmailPayload {
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  university: string
  degreeYear: string
  positionTitle?: string
  coverNote?: string
  github?: string
  linkedin?: string
  cvFile?: {
    originalName: string
    buffer: Buffer
    contentType?: string
  }
}

export async function sendApplicationNotification(data: ApplicationEmailPayload) {
  const mailer = getTransporter()
  const recipient = (env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || '').trim()

  if (!mailer) {
    console.warn('⚠️ SMTP_USER / SMTP_PASS not set. Skipping email dispatch, application saved to database.')
    return { sent: false, reason: 'smtp_not_configured' }
  }

  const safeName = escapeHtml(data.applicantName)
  const safeEmail = escapeHtml(data.applicantEmail)
  const safePhone = escapeHtml(data.applicantPhone)
  const safeUniversity = escapeHtml(data.university)
  const safeDegreeYear = escapeHtml(data.degreeYear)
  const safePositionTitle = escapeHtml(data.positionTitle || 'Internship Position')
  const safeCoverNote = escapeHtml(data.coverNote)
  const safeCvName = data.cvFile ? escapeHtml(data.cvFile.originalName) : ''
  const adminUrl = `${env.PUBLIC_SITE_URL}/admin`
  const safeAdminUrl = escapeHtml(adminUrl)

  let adminMessageId: string | undefined

  if (!recipient) {
    console.warn('⚠️ ADMIN_NOTIFICATION_EMAIL is not configured. Skipping admin notification email.')
  } else {
    const subject = sanitizeSubject(
      `[AIR Lab] New Internship Application: ${data.applicantName} (${data.positionTitle || 'General'})`,
    )

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 12px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px;">AIR Lab – New Candidate Application</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Received on ${escapeHtml(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }))} (PKT)</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 140px; font-weight: 600;">Position:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${safePositionTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Full Name:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Phone:</td>
          <td style="padding: 8px 0; color: #0f172a;">${safePhone}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">University:</td>
          <td style="padding: 8px 0; color: #0f172a;">${safeUniversity}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Year / Degree:</td>
          <td style="padding: 8px 0; color: #0f172a;">${safeDegreeYear}</td>
        </tr>
        ${data.github ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">GitHub:</td>
          <td style="padding: 8px 0;">${safeHttpsLink(data.github)}</td>
        </tr>` : ''}
        ${data.linkedin ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">LinkedIn:</td>
          <td style="padding: 8px 0;">${safeHttpsLink(data.linkedin)}</td>
        </tr>` : ''}
      </table>

      ${data.coverNote ? `
      <div style="background: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Cover Note / Statement:</h4>
        <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeCoverNote}</p>
      </div>` : ''}

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; font-size: 13px; color: #64748b;">
        <p style="margin: 0 0 8px 0;">📎 <strong>Resume/CV:</strong> ${data.cvFile ? `Attached (${safeCvName})` : 'None uploaded'}</p>
        <p style="margin: 0;">View, shortlist, or manage this application in the ${adminUrl.startsWith('https://') ? `<a href="${safeAdminUrl}" style="color: #2563eb; font-weight: 600;">AIR Lab Admin Portal</a>` : safeAdminUrl}.</p>
      </div>
    </div>
  `

    const attachments = data.cvFile
      ? [
          {
            filename: cleanPdfFilename(data.cvFile.originalName),
            content: data.cvFile.buffer,
            contentType: 'application/pdf',
          },
        ]
      : []

    const info = await mailer.sendMail({
      from: `"AIR Lab Admissions" <${env.SMTP_USER || process.env.SMTP_USER}>`,
      to: recipient,
      replyTo: data.applicantEmail.replace(/[\r\n]+/g, ''),
      subject,
      html,
      attachments,
    })

    adminMessageId = info.messageId
    console.log(`📧 Notification email sent to ${recipient}: ${info.messageId}`)
  }

  // Send at most one confirmation email per recipient address per 24h
  if (data.applicantEmail && data.applicantEmail.includes('@')) {
    const normalizedRecipient = data.applicantEmail.trim().toLowerCase()
    const { allowed: canSendConfirmation } = await consumeRateLimit(normalizedRecipient, {
      prefix: 'confirm-email:24h',
      max: 1,
      windowSeconds: 24 * 60 * 60,
    })

    if (canSendConfirmation) {
      try {
        const applicantSubject = sanitizeSubject(
          `Application Received: AIR Lab Fellowship & Research Vacancy`,
        )
        const applicantPositionTitle = escapeHtml(data.positionTitle || 'Research Vacancy')
        const applicantHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="margin-bottom: 20px; border-bottom: 2px solid #ff5500; padding-bottom: 12px;">
            <h2 style="color: #0b0c0e; margin: 0; font-size: 20px; letter-spacing: -0.02em;">AIR LAB — NED UNIVERSITY</h2>
            <p style="color: #555760; font-size: 13px; margin: 4px 0 0 0;">Department of Computer Science &amp; IT</p>
          </div>
          <p style="color: #0b0c0e; font-size: 15px; line-height: 1.6;">Dear <strong>${safeName}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Thank you for applying to the <strong>Artificial Intelligence Research Lab (AIR Lab)</strong> at NED University. We have successfully received your application for the <strong>${applicantPositionTitle}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #0b0c0e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Application Summary</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 130px;">Applicant:</td>
                <td style="padding: 4px 0; color: #0b0c0e; font-weight: 600;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">University / Dept:</td>
                <td style="padding: 4px 0; color: #0b0c0e;">${safeUniversity} (${safeDegreeYear})</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Contact Email:</td>
                <td style="padding: 4px 0; color: #0b0c0e;">${safeEmail}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Phone / WhatsApp:</td>
                <td style="padding: 4px 0; color: #0b0c0e;">${safePhone}</td>
              </tr>
            </table>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Our faculty review committee, led by Dr. Murk Marvi, reviews candidate applications on a rolling basis. Shortlisted candidates will be contacted directly for track interviews and technical testbed orientations.
          </p>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; line-height: 1.5;">
            <p style="margin: 0;"><strong>Artificial Intelligence Research Lab (AIR Lab)</strong><br />Department of CSIT, NED University of Engineering &amp; Technology<br />University Road, Karachi 75270, Pakistan</p>
          </div>
        </div>
      `

        await mailer.sendMail({
          from: `"AIR Lab Admissions" <${env.SMTP_USER || process.env.SMTP_USER}>`,
          to: data.applicantEmail.replace(/[\r\n]+/g, ''),
          subject: applicantSubject,
          html: applicantHtml,
        })
        console.log(`📧 Candidate confirmation email sent to applicant: ${data.applicantEmail}`)
      } catch (candErr) {
        console.warn('⚠️ Could not send candidate confirmation email:', candErr)
      }
    }
  }

  return { sent: Boolean(adminMessageId), messageId: adminMessageId }
}

