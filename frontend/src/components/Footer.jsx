import React from 'react'

export default function Footer(){
  return (
    <footer className="site-footer" id="contact">
      <div className="container footer-inner">
        <div>
          <img src={encodeURI('/images/icon.png')} alt="icon" style={{height:36,marginBottom:8}} />
          <h4>Predictra</h4>
          <p>AI-powered predictive maintenance for small teams. Built with care by Emerson, Arjan, Daniel, and Justin.</p>
        </div>

        <div>
          <h5>Join waitlist</h5>
          <p>Be the first to try Predictra — we’ll email you when beta opens.</p>
          <button className="primary">Join Waitlist</button>
        </div>
      </div>
      <div className="copyright">© {new Date().getFullYear()} Predictra</div>
    </footer>
  )
}
