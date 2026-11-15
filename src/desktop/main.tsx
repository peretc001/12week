import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TrackerApp } from '@/components/TrackerApp'
import '@/app/globals.css'
import 'antd/dist/reset.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackerApp />
  </StrictMode>,
)
