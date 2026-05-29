import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Do NOT call sdk.actions.ready() here — the SDK's postMessage channel
// is not established until after the document fully loads and the iframe
// handshake completes. Call it inside a React useEffect instead.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
