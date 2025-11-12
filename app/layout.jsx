import './globals.css'
import ClientBoot from './components/ClientBoot'

export const metadata = {
  title: 'Predictra',
  description: 'Predictive maintenance and RUL estimation'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
  <link rel="icon" href="/images/icon.png" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
  <link rel="stylesheet" href="/css/styles.css" />
      </head>
      <body>
        {children}
        {/* Client-only boot that wires UI interactions (typewriter, scroll reveal, forms, showcase) */}
        <ClientBoot />
      </body>
    </html>
  )
}
