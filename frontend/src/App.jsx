import React from 'react'
import { motion } from 'framer-motion'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'
import WaitlistModal from './components/WaitlistModal'
import { useState } from 'react'

export default function App() {
  const [open, setOpen] = useState(false)
  return (
    <div className="page-root">
      <header className="topbar">
        <div className="brand">
          <img src="/images/Logo.png" alt="Predictra" />
          <span>Predictra</span>
        </div>
        <nav className="nav">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <button className="linkish" onClick={()=>setOpen(true)}>Join Waitlist</button>
        </nav>
      </header>

      <main>
        <Hero onJoin={()=>setOpen(true)} />
        <Features />
      </main>

      <Footer onJoin={()=>setOpen(true)} />
      <WaitlistModal open={open} onClose={()=>setOpen(false)} />
    </div>
  )
}
