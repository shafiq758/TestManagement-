import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TestFlow',
  description: 'Modern test case management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
