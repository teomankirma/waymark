import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? 'http://127.0.0.1:3210',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>,
)
