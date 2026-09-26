import type { Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { BalanceProvider } from '@/context/BalanceContext'
import { NotificationProvider } from '@/context/NotificationContext'
import CasinoShell from '@/components/CasinoShell'

export const metadata = {
  title: 'Hanss Dlic',
  description: 'Play provably fair Dice, Mines, Crash, and Blackjack on Hanss Dlic',
  icons: {
    icon: '/hanssdlic.svg',
    shortcut: '/hanssdlic.svg',
    apple: '/hanssdlic.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#080d13',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-gamdom-bg text-gamdom-text">
      <body className="min-h-screen flex flex-col bg-gamdom-bg">
        <AuthProvider>
          <NotificationProvider>
            <BalanceProvider>
              <CasinoShell>
                {children}
              </CasinoShell>
            </BalanceProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}


