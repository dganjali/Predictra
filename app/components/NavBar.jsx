import React from 'react'

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="nav-container container">
        <div className="nav-logo">
          <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/images/Logo.png" alt="Predictra Logo" style={{ height: 44, width: 'auto' }} />
          </a>
        </div>
        <div className="nav-cta">
          <button id="join-btn" className="nav-link btn-primary">Join</button>
        </div>
      </div>
    </nav>
  )
}
