import React from 'react'
import NavBar from './components/NavBar'
import Hero from './components/Hero'
import Features from './components/Features'
import Showcase from './components/Showcase'
import Testimonials from './components/Testimonials'
import Faq from './components/Faq'
import BigCta from './components/BigCta'

export default function Page() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <svg className="svg-divider" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,30 C360,90 1080,-30 1440,30 L1440,60 L0,60 Z" fill="#f8fafc"></path>
        </svg>

        <Features />
        <Showcase />
        <Testimonials />
        <Faq />
        <BigCta />
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <h3>Predictra</h3>
              </div>
              <p>Advanced machine learning for industrial predictive maintenance and RUL estimation.</p>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: hello@predictra.com</p>
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
