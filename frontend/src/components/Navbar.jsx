import React from 'react'
import logoImg from '../assets/Logo.png'

export default function Navbar({ onJoin }) {
  return (
    <nav className="navbar">
      <div className="container nav-content">
        <div className="logo">
          <img src={logoImg} alt="Predictra" />
          <span>Predictra</span>
        </div>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <button className="btn btn-primary" onClick={onJoin}>Join Waitlist</button>
        </div>
      </div>
    </nav>
  )
}
