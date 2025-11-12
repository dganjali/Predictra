import React from 'react'

function SideFeatures() {
  return (
    <aside className="side-features reveal-on-scroll" aria-label="Key features sidebar">
      <ul>
        <li className="sf-item active" data-feature="predictive"><span className="sf-icon"><i className="fas fa-robot"></i></span>
          <div className="sf-body"><strong>Predictive Models</strong><span>Per-machine Bayesian RUL</span></div>
        </li>
        <li className="sf-item" data-feature="anomaly"><span className="sf-icon"><i className="fas fa-wave-square"></i></span>
          <div className="sf-body"><strong>Anomaly Signals</strong><span>Unsupervised, explainable detections</span></div>
        </li>
        <li className="sf-item" data-feature="ops"><span className="sf-icon"><i className="fas fa-suitcase"></i></span>
          <div className="sf-body"><strong>Ops-ready</strong><span>Integrates with SCADA & MES</span></div>
        </li>
        <li className="sf-item" data-feature="alerts"><span className="sf-icon"><i className="fas fa-bell"></i></span>
          <div className="sf-body"><strong>Actionable Alerts</strong><span>Context + confidence</span></div>
        </li>
      </ul>
    </aside>
  )
}

export default function Showcase() {
  return (
    <section className="showcase reveal-on-scroll" aria-hidden="false">
      <div className="container showcase-grid">
        <SideFeatures />
        <div className="showcase-visual reveal-on-scroll">
            <div className="glass-card">
            <img src="/images/factory photo.png" alt="Predictra dashboard mockup" style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }} />
          </div>
        </div>
        <div className="showcase-body reveal-on-scroll">
          <h2 className="section-title">A dashboard teams actually use</h2>
          <p className="lead-text">Live telemetry, anomaly timelines, and RUL forecasts — all in one place. Drill into machine histories or get fleet-level health at a glance.</p>

          <ul className="showcase-stats">
            <li><strong>99.8%</strong><span>uptime for monitoring</span></li>
            <li><strong>30%</strong><span>reduction in emergency repairs</span></li>
            <li><strong>24/7</strong><span>automated coverage</span></li>
          </ul>

          <div className="showcase-cta">
            <button className="btn btn-primary btn-large" id="request-demo">Request a demo</button>
            <button className="btn btn-secondary" id="learn-more">See technical docs</button>
          </div>
        </div>
      </div>
    </section>
  )
}
