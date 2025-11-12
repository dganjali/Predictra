import React from 'react'

export default function Features() {
  return (
    <section className="features reveal-on-scroll" aria-labelledby="features-heading">
      <div className="container">
        <h2 id="features-heading" className="section-title">What Predictra brings to your floor</h2>
        <p className="lead-text" style={{ textAlign: 'center', maxWidth: 820, margin: '0.5rem auto 2rem', color: 'var(--text-secondary)' }}>A single platform to monitor assets, detect anomalies early, and schedule maintenance with confidence. Built for engineers and operations teams who demand reliability and explainability.</p>

        <div className="features-grid">
          <div className="feature-card reveal-on-scroll">
            <div className="feature-icon"><i className="fas fa-microchip"></i></div>
            <h3>Edge & Cloud Ready</h3>
            <p>Deploy lightweight agents at the edge or integrate with your existing telemetry — our models adapt to different data sources and volumes.</p>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-icon"><i className="fas fa-bolt"></i></div>
            <h3>Real-time Anomaly Detection</h3>
            <p>Detect deviations minutes after they occur with unsupervised anomaly detectors tuned per-machine.</p>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-icon"><i className="fas fa-chart-line"></i></div>
            <h3>Probabilistic RUL</h3>
            <p>Bayesian models produce uncertainty-aware Remaining Useful Life estimates so planners can prioritize repairs smartly.</p>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-icon"><i className="fas fa-tools"></i></div>
            <h3>Actionable Alerts</h3>
            <p>Context-rich alerts include root-cause signals, confidence scores, and recommended next steps for technicians.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
