import React from 'react'

export default function Faq() {
  return (
    <section className="faq reveal-on-scroll" aria-labelledby="faq-heading">
      <div className="container">
        <h2 id="faq-heading" className="section-title">Frequently asked questions</h2>
        <div className="faq-grid">
          <details className="faq-item">
            <summary>How do you integrate with existing SCADA or MES?</summary>
            <div className="faq-body"><p>We provide lightweight agents and a REST API to ingest telemetry. Many customers forward existing streams to Predictra with minimal changes.</p></div>
          </details>
          <details className="faq-item">
            <summary>Can I deploy models on-premise?</summary>
            <div className="faq-body"><p>Yes. Models can run on-premise, at the edge, or in the cloud depending on privacy and latency requirements.</p></div>
          </details>
          <details className="faq-item">
            <summary>What accuracy and explainability can I expect?</summary>
            <div className="faq-body"><p>Accuracy varies by asset and data quality. We provide model diagnostics and signal attribution so engineers can verify the causes of alerts.</p></div>
          </details>
        </div>
      </div>
    </section>
  )
}
