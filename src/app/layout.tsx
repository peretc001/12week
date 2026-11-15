import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '12 недель — трекер целей',
  description: 'Персональный трекер целей и недельного прогресса на 12-недельный цикл.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f6f5f4" />
      </head>
      <body>{children}</body>
    </html>
  )
}
