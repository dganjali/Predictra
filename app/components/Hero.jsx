import React from 'react'

export default function Hero() {
  return (
    <section className="about-hero hero-with-photo">
      <div className="hero-container container">
        <div className="hero-content">
          <h1 className="hero-title">Machine-Specific RUL Estimation</h1>
          <p className="hero-subtitle">Advanced predictive maintenance using anomaly detection and Bayesian inference to estimate remaining useful lifetime for industrial machinery.</p>
          <div className="hero-buttons">
            <div id="subscribe" className="subscribe-anchor" aria-hidden="true"></div>
            <form id="subscribe-form" className="subscribe-form" onSubmit={(e) => e.preventDefault()} aria-label="Subscribe to product updates mailing list">
              <input id="email" type="email" placeholder="Enter your email" required />
              <button id="subscribe-btn" className="btn btn-primary btn-large" type="submit">Join our mailing list</button>
            </form>
            <p id="subscribe-msg" className="subscribe-msg" aria-live="polite"></p>
          </div>
        </div>

        <div className="hero-image">
          <div className="dashboard-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div className="preview-content">
              <div className="typewriter-area">
                <div id="typewriter-container">
                  <span className="typewriter-text"></span><span className="cursor"></span>
                </div>
              </div>
              <div className="preview-stats">
                <div className="stat-item">
                  <div className="stat-value">90%</div>
                  <div className="stat-label">Accuracy</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">24/7</div>
                  <div className="stat-label">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
