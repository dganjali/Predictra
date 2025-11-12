import React from 'react'

export default function CTA() {
  return (
    <section className="cta">
      <div className="container">
        <div className="cta-content">
          <h2>Ready to transform your maintenance operations?</h2>
          <p className="cta-subtitle">
            Join leading industrial companies using Predictra to reduce downtime and maintenance costs.
          </p>
          <form id="subscribe-form-2" className="subscribe-form cta-form">
            <input id="email-2" type="email" placeholder="Enter your work email" required />
            <button id="subscribe-btn-2" className="btn btn-primary btn-large" type="submit">
              Get early access
            </button>
          </form>
          <p id="subscribe-msg-2" className="subscribe-msg" aria-live="polite"></p>
        </div>
      </div>
    </section>
  )
}

