import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { recoverJobs } from './lib/jobs'
import { logError } from './lib/db'

// Jobs left running when a tab closed are marked interrupted and refunded.
recoverJobs()

window.addEventListener('error', (e) => { if (e.message) logError(`window: ${e.message}`) })
window.addEventListener('unhandledrejection', (e) => { const m = (e.reason as Error)?.message; if (m && !m.includes('play()')) logError(`promise: ${m}`) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
