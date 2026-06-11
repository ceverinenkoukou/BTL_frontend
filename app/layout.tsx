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
  },
  icons: {
    icon: '/LOGO-MHEDIA-01.svg',
    apple: '/LOGO-MHEDIA-01.svg',
  }
}

export const viewport: Viewport = {
  themeColor: '#006776',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${openSans.variable} bg-background`}>
      <body className="font-sans antialiased bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/mediapuzzle.jpg')" }}>
        {children}
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
