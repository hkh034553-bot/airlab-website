import mongoose from 'mongoose'
import { MediaBlobModel } from '../models/MediaBlob.js'
import { HttpError } from '../middleware/errors.js'
import { isAllowedMediaMime } from '../routes/media.js'

const ANY_DATA_URI_RE = /^data:([\w/+.-]+);base64,(.*)$/s

export function isMediaDataUri(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = ANY_DATA_URI_RE.exec(value)
  return Boolean(match && isAllowedMediaMime(match[1]))
}

/**
 * Extracts any inline base64 image or PDF data URI inside `input` into
 * dedicated `media_blobs` documents and replaces them with `/api/media/blob/<id>`.
 * Rejects disallowed MIME types (such as `image/svg+xml`) with 400.
 */
export async function extractDataUrisToMediaBlobs<T>(
  input: T,
  sourceSlug?: string,
): Promise<{ value: T; extractedCount: number; savedBytes: number }> {
  let extractedCount = 0
  let savedBytes = 0

  const walk = async (val: unknown): Promise<unknown> => {
    if (typeof val === 'string') {
      const match = ANY_DATA_URI_RE.exec(val)
      if (!match) return val

      const [, rawMime, b64] = match
      const mimeType = rawMime.trim().toLowerCase()
      if (!isAllowedMediaMime(mimeType)) {
        throw new HttpError(
          400,
          `Unsupported media MIME type "${rawMime}". Only PNG, JPEG, WebP, GIF, AVIF, and PDF are allowed.`,
        )
      }

      const buffer = Buffer.from(b64, 'base64')
      const blob = await MediaBlobModel.create({
        mimeType,
        data: buffer,
        size: buffer.length,
        sourceSlug,
      })
      extractedCount += 1
      savedBytes += val.length
      return `/api/media/blob/${String(blob._id)}`
    }

    if (Array.isArray(val)) {
      const out = []
      for (const item of val) {
        out.push(await walk(item))
      }
      return out
    }

    if (
      val &&
      typeof val === 'object' &&
      !(val instanceof Date) &&
      !(val instanceof Buffer) &&
      !(val instanceof mongoose.Types.ObjectId)
    ) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = k === '_id' ? v : await walk(v)
      }
      return out
    }

    return val
  }

  const value = (await walk(input)) as T
  return { value, extractedCount, savedBytes }
}

const BLOB_URL_RE = /^\/api\/media\/blob\/([a-fA-F0-9]{24})(?:\?.*)?$/

/**
 * Recursively collects all `/api/media/blob/<24-hex-id>` IDs referenced anywhere in `input`.
 */
export function extractBlobIdsFromDoc(input: unknown): Set<string> {
  const ids = new Set<string>()

  const walk = (val: unknown) => {
    if (typeof val === 'string') {
      const match = BLOB_URL_RE.exec(val.trim())
      if (match && mongoose.Types.ObjectId.isValid(match[1])) {
        ids.add(match[1])
      }
      return
    }
    if (Array.isArray(val)) {
      for (const item of val) walk(item)
      return
    }
    if (
      val &&
      typeof val === 'object' &&
      !(val instanceof Date) &&
      !(val instanceof Buffer) &&
      !(val instanceof mongoose.Types.ObjectId)
    ) {
      for (const v of Object.values(val as Record<string, unknown>)) {
        walk(v)
      }
    }
  }

  walk(input)
  return ids
}

/**
 * Deletes the given `MediaBlobModel` IDs from `media_blobs`. Never throws on cleanup errors.
 */
export async function deleteMediaBlobsByIds(ids: Iterable<string>): Promise<number> {
  const validIds = Array.from(ids).filter(id => mongoose.Types.ObjectId.isValid(id))
  if (validIds.length === 0) return 0
  try {
    const res = await MediaBlobModel.deleteMany({ _id: { $in: validIds } })
    return res.deletedCount ?? 0
  } catch (err) {
    console.warn('⚠️ Failed to delete orphaned media blobs:', err)
    return 0
  }
}

/**
 * Compares blob references before and after a document update and deletes any blobs
 * that were present in `previousDoc` but are no longer referenced in `nextDoc`.
 */
export async function cleanupOrphanedMediaBlobsOnUpdate(
  previousDoc: unknown,
  nextDoc: unknown,
): Promise<number> {
  const prevIds = extractBlobIdsFromDoc(previousDoc)
  if (prevIds.size === 0) return 0
  const nextIds = extractBlobIdsFromDoc(nextDoc)
  const orphaned: string[] = []
  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      orphaned.push(id)
    }
  }
  return deleteMediaBlobsByIds(orphaned)
}

