import type { Metadata, Viewport } from 'next'
import { Montserrat, Open_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-opensans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MHédia BTL',
  description: 'Plateforme de gestion des campagnes BTL — dégustations, ventes et reporting en temps réel',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MHédia BTL',
    startupImage: [
      { url: '/icons/icon-512x512.png' },
    ],
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/icon-96x96.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#105062',
    'msapplication-TileImage': '/icons/icon-144x144.png',
    'msapplication-config': 'none',
  },
}

export const viewport: Viewport = {
  themeColor: '#105062',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${openSans.variable} bg-background`}>
      {/* bg-puzzle applique le fond via globals.css avec pseudo-élément ::before */}
      <body className="font-sans antialiased bg-puzzle">
        {children}
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}