import { lazy, Suspense, type ComponentType } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import Layout from './components/Layout'
import Home from './pages/Home'

const ReloadingView = () => (
  <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 text-center">
    <div className="w-10 h-10 border-3 border-[var(--accent-orange)] border-t-transparent rounded-full animate-spin mb-4" />
    <p className="text-sm font-medium text-[var(--text-muted)]">Updating to latest version...</p>
  </div>
)

/**
 * Robust lazy-load helper that handles new deployments and transient network blips gracefully.
 * If dynamic import of a chunk fails (e.g. after a redeploy changed the chunk hash),
 * it retries once and then performs a one-time page reload to fetch the latest index.html and assets.
 */
function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory()
      sessionStorage.removeItem('airlab_chunk_reload')
      return mod
    } catch (firstError: any) {
      if ((window as any).__airlabReloading) {
        return { default: ReloadingView as unknown as T }
      }

      // Retry once after a short delay in case of a brief network hiccup
      try {
        await new Promise((resolve) => setTimeout(resolve, 250))
        const mod = await factory()
        sessionStorage.removeItem('airlab_chunk_reload')
        return mod
      } catch (error: any) {
        if ((window as any).__airlabReloading) {
          return { default: ReloadingView as unknown as T }
        }

        const message = String(error?.message || firstError?.message || '')
        const isDynamicImportError =
          message.includes('dynamically imported module') ||
          message.includes('Failed to fetch') ||
          message.includes('Importing a module script failed') ||
          message.includes('error loading dynamically imported module') ||
          message.includes('MIME type') ||
          error?.name === 'ChunkLoadError'

        if (isDynamicImportError) {
          const lastReload = sessionStorage.getItem('airlab_chunk_reload')
          const now = Date.now()
          if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
            ;(window as any).__airlabReloading = true
            sessionStorage.setItem('airlab_chunk_reload', now.toString())
            window.location.reload()
            return { default: ReloadingView as unknown as T }
          }
        }
        throw error
      }
    }
  })
}

const About = lazyRetry(() => import('./pages/About'))
const Team = lazyRetry(() => import('./pages/Team'))
const Projects = lazyRetry(() => import('./pages/Projects'))
const Publications = lazyRetry(() => import('./pages/Publications'))
const Blogs = lazyRetry(() => import('./pages/Blogs'))
const Grants = lazyRetry(() => import('./pages/Grants'))
const Contact = lazyRetry(() => import('./pages/Contact'))
const Gallery = lazyRetry(() => import('./pages/Gallery'))
const Performers = lazyRetry(() => import('./pages/Performers'))
const Interns = lazyRetry(() => import('./pages/Interns'))
const AdminDashboard = lazyRetry(() => import('./pages/Admin'))

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-orange)] border-t-transparent rounded-full animate-spin opacity-70" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="team" element={<Team />} />
              <Route path="projects" element={<Projects />} />
              <Route path="grants" element={<Grants />} />
              <Route path="publications" element={<Publications />} />
              <Route path="blogs" element={<Blogs />} />
              <Route path="contact" element={<Contact />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="performers" element={<Performers />} />
              <Route path="interns" element={<Interns />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ThemeProvider>
  )
}
