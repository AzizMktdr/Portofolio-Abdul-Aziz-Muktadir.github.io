import { createRoot } from 'react-dom/client'
import Lanyard, { ErrorBoundary } from './Lanyard'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch (e) {
    return false
  }
}

// Dipasang ke <div id="lanyard"> di index.html. Kalau WebGL tidak ada, tidak terjadi apa-apa.
const host = document.getElementById('lanyard')
if (host && hasWebGL()) {
  createRoot(host).render(
    <ErrorBoundary>
      <Lanyard />
    </ErrorBoundary>,
  )
}
