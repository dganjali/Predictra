import React, { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import WaitlistModal from './components/WaitlistModal'

export default function App() {
  const [open, setOpen] = useState(false)

  return (
    <div className="app">
      <Navbar onJoin={() => setOpen(true)} />
      <main>
        <Hero onJoin={() => setOpen(true)} />
        <Features />
      </main>
      <Footer />
      <WaitlistModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
