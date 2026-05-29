import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { sdk } from '@farcaster/frame-sdk'

// ⚡ Fire ready() IMMEDIATELY — before React even mounts.
// This is the earliest possible moment to dismiss the Warpcast splash.
// Warpcast shows the imageUrl/splash panel until this resolves.
sdk.actions.ready().catch(() => {
  // Silently ignore — not in a Farcaster context
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
