import React from 'react'
import iconImg from '../assets/icon.png'

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container footer-content">
        <div className="footer-brand">
          <div className="logo">
            <img src={iconImg} alt="Predictra" />
            <span>Predictra</span>
          </div>
          <p>
            AI-powered predictive maintenance for small teams. Built with care by Emerson, Arjan, Daniel, and Justin.
          </p>
        </div>

        <div className="footer-links">
          <p style={{ fontWeight: 600, marginBottom: '16px' }}>Product</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a href="#about">About</a>
            <a href="#features">Features</a>
            <a href="#">Waitlist</a>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="copyright" style={{ borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          © {new Date().getFullYear()} Predictra. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
