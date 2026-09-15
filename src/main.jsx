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
// loads (no white flash on launch). Keep it up for a fixed duration, then
// fade it out now that React has mounted.
const bootSplash = document.getElementById('boot-splash')
if (bootSplash) {
  setTimeout(() => {
    bootSplash.classList.add('boot-splash-hide')
    setTimeout(() => bootSplash.remove(), 400)
  }, 6000)
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
