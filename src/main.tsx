import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Handle Vite CSS/sub-chunk preload errors gracefully when a new version is deployed.
// Calling event.preventDefault() suppresses Vite's immediate rethrow so React's lazyRetry
// can show a clean loading state while the browser fetches the latest deployment.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  console.warn('Vite preload error detected, reloading to fetch latest deployment...', event)
  const lastReload = sessionStorage.getItem('airlab_chunk_reload')
  const now = Date.now()
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    ;(window as any).__airlabReloading = true
    sessionStorage.setItem('airlab_chunk_reload', now.toString())
    window.location.reload()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

