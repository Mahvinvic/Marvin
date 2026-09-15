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

// Android-only install button — index.html shows it once a real
// beforeinstallprompt event has fired and stashed itself on window.
const bootInstall = document.getElementById('boot-install')
if (bootInstall) {
  bootInstall.addEventListener('click', async () => {
    const promptEvent = window.__marvinInstallPrompt
    if (!promptEvent) return
    bootInstall.disabled = true
    promptEvent.prompt()
    await promptEvent.userChoice
    window.__marvinInstallPrompt = null
    bootInstall.style.display = 'none'
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
