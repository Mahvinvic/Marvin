import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Boot splash lives in index.html so it paints before this bundle even
// loads (no white flash on launch). It stays up until the visitor taps
// Start, then fades out into the app underneath.
const bootSplash = document.getElementById('boot-splash')
const bootStart = document.getElementById('boot-start')
if (bootSplash && bootStart) {
  bootStart.addEventListener('click', () => {
    bootSplash.classList.add('boot-splash-hide')
    setTimeout(() => bootSplash.remove(), 400)
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
