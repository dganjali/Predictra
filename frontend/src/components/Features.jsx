import React from 'react'

function Card({title, children}){
  return (
    <div className="card">
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  )
}

export default function Features(){
  return (
    <section className="features" id="features">
      <div className="container">
        <h2>Why this matters</h2>
        <p className="lead">Most predictive maintenance systems are expensive and require years of historical failure data. Predictra is designed for small teams — upload logs, get early warnings, and prevent costly downtime.</p>

        <div className="grid">
          <Card title="Data Enrichment Engine">Converts messy PDFs, spreadsheets, or incomplete records into structured, usable datasets.</Card>
          <Card title="Adaptive Anomaly Detection">Learns from each machine’s patterns to detect early warning signs.</Card>
          <Card title="Conservative RUL Predictions">Gives underpredicted, trustworthy timelines and urgency categories.</Card>
          <Card title="Continuous Intelligence">Actionable recommendations and automated part ordering integrated in a single dashboard.</Card>
        </div>

        <h3>Built for</h3>
        <p>Small and mid-sized manufacturers — textiles, plastics, food processing, and more. Upload → Get alerts → Take action → Stay running.</p>

        <h3>Trained & Powered by</h3>
        <ul className="bullets">
          <li>Trained on a diverse set of machine datasets to cover wide scenarios of machine life.</li>
          <li>Backend: modular AI stack (adaptive models, Bayesian uncertainty, automated enrichment).</li>
          <li>Integration-ready: API plans and federated learning options for enterprise partners.</li>
        </ul>

        <h3>Market & Business Model</h3>
        <p>TAM: $13B+ predictive maintenance market. Subscription-based SaaS with plans per machine and enterprise APIs.</p>

      </div>
    </section>
  )
}
