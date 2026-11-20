import { Router } from 'express'
import mongoose from 'mongoose'
import { contentModels } from '../models/content.js'
import { MediaBlobModel } from '../models/MediaBlob.js'
import { HttpError } from '../middleware/errors.js'

/**
 * Images uploaded through the admin panel are stored in MongoDB as base64
 * data URIs. Sending them inline makes the public JSON huge and un-cacheable,
 * so the public content API swaps each data URI for a URL pointing here:
 *
 *   GET /api/media/:slug/:oid/:path?v=<updatedAt>
 *
 * `path` is the dot-joined location of the image inside the document
 * (e.g. "coverImage", "images.2", "photos.0.url"). The `v` param changes
 * whenever the document is edited, so responses can be cached forever.
 */
export const mediaRouter = Router()

const DATA_URI = /^data:([\w/+.-]+);base64,(.*)$/s
const ALLOWED_MEDIA_MIME = /^(?:image\/(?:png|jpe?g|webp|gif|avif)|application\/pdf)$/i

export function isAllowedMediaMime(mime: string | undefined | null): boolean {
  if (!mime || typeof mime !== 'string') return false
  const trimmed = mime.trim().toLowerCase()
  if (trimmed === 'image/svg+xml') return false
  return ALLOWED_MEDIA_MIME.test(trimmed)
}

function mediaUrl(slug: string, oid: string, path: string, version: number) {
  return `/api/media/${slug}/${oid}/${encodeURIComponent(path)}?v=${version}`
}

/** Returns a copy of `item` with every inline data-URI image replaced by a /api/media URL. */
export function externalizeImages<T extends Record<string, any>>(slug: string, item: T): T {
  if (!item || !item._id) return item
  const oid = String(item._id)
  const version = new Date(item.updatedAt ?? item.createdAt ?? 0).getTime() || 0

  const walk = (value: any, path: string): any => {
    if (typeof value === 'string') {
      return value.startsWith('data:image') || value.startsWith('data:application/pdf')
        ? mediaUrl(slug, oid, path, version)
        : value
    }
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}.${i}`))
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(value)) out[k] = walk(v, path ? `${path}.${k}` : k)
      return out
    }
    return value
  }

  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(item)) out[k] = k === '_id' ? v : walk(v, k)
  return out as T
}

mediaRouter.get('/blob/:id', async (req, res) => {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, 'Not found')
  }

  const blob: any = await MediaBlobModel.findById(id).maxTimeMS(10000).lean()
  if (!blob || !blob.data || !isAllowedMediaMime(blob.mimeType)) {
    throw new HttpError(404, 'Not found')
  }

  const mime = String(blob.mimeType).trim().toLowerCase()
  const buffer = Buffer.isBuffer(blob.data)
    ? blob.data
    : Buffer.from(blob.data.buffer ?? blob.data)

  res.set({
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff',
    ...(mime === 'application/pdf' ? { 'Content-Disposition': 'attachment' } : {}),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  res.send(buffer)
})

mediaRouter.get('/:slug/:oid/:path', async (req, res) => {
  const { slug, oid } = req.params
  const path = decodeURIComponent(req.params.path)
  const model = contentModels.get(slug)
  if (!model || !mongoose.isValidObjectId(oid) || !/^[\w.]+$/.test(path)) {
    throw new HttpError(404, 'Not found')
  }

  const parts = path.split('.')
  const topField = parts[0]
  const arrayIndex = parts.length > 1 && /^\d+$/.test(parts[1]) ? Number(parts[1]) : null
  const projection: Record<string, number | object> =
    arrayIndex !== null ? { [topField]: { $slice: [arrayIndex, 1] } } : { [topField]: 1 }

  const doc: any = await model
    .findOne({ _id: oid, published: true })
    .select(projection)
    .maxTimeMS(10000)
    .lean()
  if (!doc) throw new HttpError(404, 'Not found')

  let value: any = doc
  if (arrayIndex !== null && Array.isArray(doc[topField])) {
    value = doc[topField][0]
    for (const key of parts.slice(2)) value = value?.[key]
  } else {
    for (const key of parts) value = value?.[key]
  }
  const match = typeof value === 'string' ? DATA_URI.exec(value) : null
  if (!match) throw new HttpError(404, 'Not found')

  const [, rawMime, b64] = match
  if (!isAllowedMediaMime(rawMime)) {
    throw new HttpError(404, 'Not found')
  }
  const mime = rawMime.trim().toLowerCase()

  res.set({
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff',
    // URL is versioned by the document's updatedAt, so it never goes stale.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  res.send(Buffer.from(b64, 'base64'))
})
