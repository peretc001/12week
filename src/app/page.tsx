import { Suspense } from 'react'
import { TrackerApp } from '@/components/TrackerApp'

export default function Home() {
  return <Suspense fallback={null}><TrackerApp /></Suspense>
}
