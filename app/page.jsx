import React from 'react'
import NavBar from './components/NavBar'
import Hero from './components/Hero'
import Features from './components/Features'
import CTA from './components/CTA'

export default function Page() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <Features />
        <CTA />
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Predictra</h3>
              <p>Predictive maintenance powered by machine learning</p>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>hello@predictra.com</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Predictra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
