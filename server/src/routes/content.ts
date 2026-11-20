import { Router } from 'express'
import mongoose from 'mongoose'
import { collectionBySlug, collections } from '../content/registry.js'
import { contentModels } from '../models/content.js'
import { HttpError } from '../middleware/errors.js'
import { externalizeImages } from './media.js'
import { enrichPerformersList } from '../services/performers.js'
import { getCachedContent, setCachedContent } from '../services/contentCache.js'

/**
 * Edge (CDN) caches for 60s, then keeps serving the cached copy instantly while
 * it refreshes in the background. Admin edits show up on the site within ~1 min.
 */
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400'

/**
 * Public, read-only access to website content.
 *   GET /api/content            → list of available collections
 *   GET /api/content/:slug      → published items, sorted for display
 *   GET /api/content/:slug/:id  → single published item by its public id
 */
export const contentRouter = Router()

contentRouter.get('/', (_req, res) => {
  res.json(collections.map(({ slug, label }) => ({ slug, label })))
})

function resolve(slug: string) {
  const def = collectionBySlug.get(slug)
  const model = contentModels.get(slug)
  if (!def || !model) throw new HttpError(404, `Unknown collection "${slug}"`)
  return { def, model }
}

function stripPublicEmails(slug: string, item: Record<string, any>): Record<string, any> {
  // TODO: Ask the owner whether faculty emails in the `team` collection should remain public.
  if (slug !== 'previous-interns' && slug !== 'performers') {
    return item
  }
  const clone: Record<string, any> = { ...item }
  delete clone.email
  if (Array.isArray(clone.coAwardees)) {
    clone.coAwardees = clone.coAwardees.map((awardee: any) => {
      if (!awardee || typeof awardee !== 'object') return awardee
      const rest = { ...awardee }
      delete rest.email
      return rest
    })
  }
  return clone
}

contentRouter.get('/:slug', async (req, res) => {
  const { slug } = req.params
  const { def, model } = resolve(slug)

  const cached = getCachedContent<any[]>(slug)
  if (cached) {
    res.set('Cache-Control', PUBLIC_CACHE)
    res.json(cached)
    return
  }

  if (mongoose.connection.readyState !== 1) {
    res.set('Cache-Control', 'no-store')
    res.status(503).json({ error: 'Database temporarily unavailable' })
    return
  }

  let items: any[] = []
  try {
    items = await model
      .find({ published: true })
      .sort({ order: 1, ...(def.defaultSort ?? {}), createdAt: 1 })
      .maxTimeMS(10000)
      .lean()
  } catch (err) {
    console.error(`❌ Error fetching collection "${slug}":`, err instanceof Error ? err.message : err)
    res.set('Cache-Control', 'no-store')
    res.status(503).json({ error: 'Database query failed' })
    return
  }

  if (slug === 'performers' && items.length > 0) {
    items = await enrichPerformersList(items, { externalizeAvatars: true })
  }

  const payload = items.map(item => stripPublicEmails(slug, externalizeImages(slug, item)))
  setCachedContent(slug, payload)
  res.set('Cache-Control', PUBLIC_CACHE)
  res.json(payload)
})

contentRouter.get('/:slug/:id', async (req, res) => {
  const { model } = resolve(req.params.slug)
  const raw = req.params.id
  // Legacy ids may be numeric (projects, publications) or strings.
  const candidates: (string | number)[] = [raw]
  if (/^\d+$/.test(raw)) candidates.push(Number(raw))
  const item = await model.findOne({ id: { $in: candidates }, published: true }).lean()
  if (!item) throw new HttpError(404, 'Item not found')
  let resolvedItem: Record<string, any> = item as any
  if (req.params.slug === 'performers') {
    const [enriched] = await enrichPerformersList([resolvedItem], { externalizeAvatars: true })
    if (enriched) resolvedItem = enriched
  }
  res.set('Cache-Control', PUBLIC_CACHE)
  res.json(stripPublicEmails(req.params.slug, externalizeImages(req.params.slug, resolvedItem)))
})
