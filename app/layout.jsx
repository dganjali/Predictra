import './globals.css'
import ClientBoot from './components/ClientBoot'
import StyleLoader from './components/StyleLoader'

export const metadata = {
  title: 'Predictra',
  description: 'Predictive maintenance and RUL estimation',
  icons: {
    icon: '/images/icon.png',
  },
  other: {
    'preconnect': 'https://cdnjs.cloudflare.com',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="stylesheet" href="/css/styles.css" />
      </head>
      <body>
        <StyleLoader />
        {children}
        {/* Client-only boot that wires UI interactions (typewriter, scroll reveal, forms, showcase) */}
        <ClientBoot />
      </body>
    </html>
  )
}
