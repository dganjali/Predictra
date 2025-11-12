import React from 'react'

export default function BigCta() {
  return (
    <section className="big-cta reveal-on-scroll" aria-hidden="false">
      <div className="container">
        <div className="cta-hero">
          <h2>Ready to stop guessing and start planning?</h2>
          <p className="lead-text">Join a growing list of production teams using Predictra to transform maintenance from reactive to predictive.</p>
          <form id="subscribe-form-3" className="subscribe-form" onSubmit={(e) => e.preventDefault()} style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <input id="email-3" type="email" placeholder="Work email" required />
            <button id="subscribe-btn-3" className="btn btn-primary btn-large" type="submit">Get early access</button>
          </form>
          <p id="subscribe-msg-3" className="subscribe-msg" aria-live="polite"></p>
        </div>
      </div>
    </section>
  )
}
