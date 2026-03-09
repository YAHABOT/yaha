import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YAHA — Health Tracker',
  description: 'AI-powered health data tracking',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className="bg-background text-textPrimary min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
