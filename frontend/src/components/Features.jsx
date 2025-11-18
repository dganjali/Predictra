import React from 'react'

function FeatureCard({ title, children, icon }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p style={{ color: 'var(--text-muted)' }}>{children}</p>
    </div>
  )
}

export default function Features() {
  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="section-header">
          <h2>Why Predictra?</h2>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }}>
            Most predictive maintenance systems are expensive and complex. We built a solution specifically for small teams.
          </p>
        </div>

        <div className="features-grid">
          <FeatureCard title="Data Enrichment" icon="📊">
            Converts messy PDFs, spreadsheets, or incomplete records into structured, usable datasets automatically.
          </FeatureCard>
          <FeatureCard title="Adaptive Detection" icon="🔍">
            Learns from each machine’s specific patterns to detect early warning signs of failure before they happen.
          </FeatureCard>
          <FeatureCard title="Conservative RUL" icon="⏱️">
            Gives trustworthy, underpredicted timelines on how long a machine has before failure, categorized by urgency.
          </FeatureCard>
          <FeatureCard title="Continuous Intel" icon="🧠">
            Actionable recommendations, not just numbers. Automated part ordering and clear dashboards.
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
