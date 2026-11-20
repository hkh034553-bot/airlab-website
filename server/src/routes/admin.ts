import express, { Router } from 'express'
import mongoose from 'mongoose'
import { collectionBySlug, collections } from '../content/registry.js'
import { contentModels } from '../models/content.js'
import { PositionModel } from '../models/Position.js'
import { ApplicationModel } from '../models/Application.js'
import { HttpError } from '../middleware/errors.js'
import { requireAdmin } from '../middleware/auth.js'
import { getVacancySettings, saveVacancySettings } from '../services/siteSettings.js'
import { enrichPerformersList, preparePerformerWritePayload } from '../services/performers.js'
import {
  extractDataUrisToMediaBlobs,
  extractBlobIdsFromDoc,
  deleteMediaBlobsByIds,
  cleanupOrphanedMediaBlobsOnUpdate,
} from '../services/mediaStorage.js'
import { invalidateContentCache } from '../services/contentCache.js'
import { externalizeImages } from './media.js'

export const adminCrudRouter = Router()

// Larger JSON body limit (10mb) only for admin endpoints to support base64 image/PDF uploads.
// Skips if body is already pre-parsed (e.g. in Vercel serverless).
adminCrudRouter.use((req, res, next) => {
  if (req.body !== undefined && typeof req.body === 'object') {
    return next()
  }
  express.json({ limit: '10mb' })(req, res, next)
})

// All endpoints in this router strictly require authenticated admin session
adminCrudRouter.use(requireAdmin)

const FORBIDDEN_KEYS = new Set(['_id', '__v', 'createdAt', 'updatedAt', '$where', '__proto__', 'constructor', 'prototype'])

/**
 * Strips MongoDB operator injections ($set, $gt, etc.), prototype pollution keys,
 * and immutable document metadata fields from incoming request payloads.
 */
function sanitizePayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpError(400, 'Invalid request payload')
  }
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key)) {
      continue
    }
    clean[key] = value
  }
  return clean
}

function assertValidObjectId(id: string | string[] | undefined): string {
  const strId = typeof id === 'string' ? id : ''
  if (!strId || !mongoose.Types.ObjectId.isValid(strId)) {
    throw new HttpError(400, 'Invalid record ID')
  }
  return strId
}

// Get schema registry for the admin UI
adminCrudRouter.get('/schema', (_req, res) => {
  res.json({
    collections: collections.map(c => ({
      slug: c.slug,
      label: c.label,
      titleField: c.titleField,
      fields: c.fields,
    })),
  })
})

// One-click full database backup snapshot (JSON)
adminCrudRouter.get('/backup', async (_req, res, next) => {
  try {
    const collectionsSnapshot: Record<string, unknown[]> = {}
    await Promise.all(
      collections.map(async c => {
        const model = contentModels.get(c.slug)
        if (!model) return
        const docs = await model.find().sort({ order: 1, createdAt: -1 }).maxTimeMS(15000).lean()
        collectionsSnapshot[c.slug] = docs.map(doc =>
          externalizeImages(c.slug, doc as Record<string, any>),
        )
      }),
    )

    const [positions, vacancySettings, rawApplications] = await Promise.all([
      PositionModel.find().sort({ order: 1, createdAt: -1 }).maxTimeMS(10000).lean(),
      getVacancySettings(),
      ApplicationModel.find().sort({ createdAt: -1 }).maxTimeMS(10000).lean(),
    ])

    const applications = rawApplications.map((app: any) => {
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

    const exportedAt = new Date().toISOString()
    const dateStamp = exportedAt.slice(0, 10)
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="airlab-db-backup-${dateStamp}.json"`,
      'Cache-Control': 'no-store',
    })
    res.send(
      JSON.stringify(
        {
          exportedAt,
          version: 1,
          vacancySettings,
          positions,
          collections: collectionsSnapshot,
          applications,
        },
        null,
        2,
      ),
    )
  } catch (err) {
    next(err)
  }
})

// --- SITE & VACANCY SETTINGS ADMIN ROUTES ---
adminCrudRouter.get('/settings/vacancy', async (_req, res, next) => {
  try {
    const settings = await getVacancySettings()
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

adminCrudRouter.put('/settings/vacancy', async (req, res, next) => {
  try {
    const clean = sanitizePayload(req.body)
    const updated = await saveVacancySettings(clean)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// --- POSITIONS ADMIN ROUTES ---
adminCrudRouter.get('/positions/all', async (_req, res, next) => {
  try {
    const positions = await PositionModel.find().sort({ order: 1, createdAt: -1 }).lean()
    res.json(positions)
  } catch (err) {
    next(err)
  }
})

adminCrudRouter.post('/positions', async (req, res, next) => {
  try {
    const clean = sanitizePayload(req.body)
    const position = await PositionModel.create(clean)
    res.status(201).json(position)
  } catch (err) {
    next(err)
  }
})

adminCrudRouter.put('/positions/:id', async (req, res, next) => {
  try {
    const id = assertValidObjectId(req.params.id)
    const clean = sanitizePayload(req.body)
    const position = await PositionModel.findByIdAndUpdate(
      id,
      { $set: clean },
      { new: true, runValidators: true }
    )
    if (!position) throw new HttpError(404, 'Position not found')
    res.json(position)
  } catch (err) {
    next(err)
  }
})

adminCrudRouter.delete('/positions/:id', async (req, res, next) => {
  try {
    const id = assertValidObjectId(req.params.id)
    const position = await PositionModel.findByIdAndDelete(id)
    if (!position) throw new HttpError(404, 'Position not found')
    res.json({ success: true, message: 'Position deleted' })
  } catch (err) {
    next(err)
  }
})

function resolve(slug: string | string[] | undefined) {
  const strSlug = typeof slug === 'string' ? slug : ''
  const def = collectionBySlug.get(strSlug)
  const model = contentModels.get(strSlug)
  if (!def || !model) throw new HttpError(404, `Unknown collection "${strSlug}"`)
  return { def, model }
}

// 1. LIST items (includes unpublished items for admin)
adminCrudRouter.get('/:slug', async (req, res, next) => {
  try {
    const { def, model } = resolve(req.params.slug)
    const items = await model.find().sort({ order: 1, createdAt: -1 }).maxTimeMS(10000).lean()
    if (def.slug === 'performers' && items.length > 0) {
      const enriched = await enrichPerformersList(items as Record<string, any>[], {
        includeUnpublished: true,
        externalizeAvatars: true,
      })
      res.json(enriched.map(item => externalizeImages(def.slug, item)))
      return
    }
    res.json(items.map(item => externalizeImages(def.slug, item as Record<string, any>)))
  } catch (err) {
    next(err)
  }
})

// 2. CREATE item
adminCrudRouter.post('/:slug', async (req, res, next) => {
  try {
    const { def, model } = resolve(req.params.slug)
    let clean = sanitizePayload(req.body)
    if (def.slug === 'performers') {
      clean = await preparePerformerWritePayload(clean)
    }
    const { value: prepared } = await extractDataUrisToMediaBlobs(clean, def.slug)
    const count = await model.countDocuments()
    const item = await model.create({
      ...prepared,
      order: typeof prepared.order === 'number' ? prepared.order : count,
      published: typeof prepared.published === 'boolean' ? prepared.published : true,
    })
    invalidateContentCache(def.slug)
    if (def.slug === 'performers') {
      const [enriched] = await enrichPerformersList([item.toJSON()], {
        includeUnpublished: true,
        externalizeAvatars: true,
      })
      res.status(201).json(enriched || item)
      return
    }
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// 3. UPDATE item
adminCrudRouter.put('/:slug/:id', async (req, res, next) => {
  try {
    const id = assertValidObjectId(req.params.id)
    const { def, model } = resolve(req.params.slug)
    const existingDoc = await model.findById(id).lean()
    if (!existingDoc) throw new HttpError(404, 'Item not found')

    let clean = sanitizePayload(req.body)
    if (def.slug === 'performers') {
      clean = await preparePerformerWritePayload(clean)
    }
    const { value: prepared } = await extractDataUrisToMediaBlobs(clean, def.slug)
    const item = await model.findByIdAndUpdate(
      id,
      { $set: prepared },
      { new: true, runValidators: true }
    )
    if (!item) throw new HttpError(404, 'Item not found')
    await cleanupOrphanedMediaBlobsOnUpdate(existingDoc, item.toJSON())
    invalidateContentCache(def.slug)
    if (def.slug === 'performers') {
      const [enriched] = await enrichPerformersList([item.toJSON()], {
        includeUnpublished: true,
        externalizeAvatars: true,
      })
      res.json(enriched || item)
      return
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// 4. DELETE item
adminCrudRouter.delete('/:slug/:id', async (req, res, next) => {
  try {
    const id = assertValidObjectId(req.params.id)
    const { def, model } = resolve(req.params.slug)
    const item = await model.findByIdAndDelete(id).lean()
    if (!item) throw new HttpError(404, 'Item not found')
    const blobIds = extractBlobIdsFromDoc(item)
    if (blobIds.size > 0) {
      await deleteMediaBlobsByIds(blobIds)
    }
    invalidateContentCache(def.slug)
    res.json({ success: true, message: 'Item deleted' })
  } catch (err) {
    next(err)
  }
})
