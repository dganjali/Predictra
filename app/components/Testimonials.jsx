import React from 'react'

export default function Testimonials() {
  return (
    <section className="testimonials reveal-on-scroll" aria-labelledby="testimonials-heading">
      <div className="container">
        <h2 id="testimonials-heading" className="section-title">Trusted by operations teams</h2>
        <div className="testimonials-wrap">
          <div className="testimonial" data-index="0">
            <p className="quote">"Predictra cut our unplanned downtime in half in the first three months. The RUL forecasts let us schedule repairs without disrupting production."</p>
            <div className="attribution">— Maria K., Plant Manager, AeroParts</div>
          </div>
          <div className="testimonial" data-index="1">
            <p className="quote">"The system surfaced a slow-developing fault in a compressor that our team would have missed for weeks. Saved us a costly rebuild."</p>
            <div className="attribution">— Oliver T., Reliability Engineer, CleanWater Co.</div>
          </div>
          <div className="testimonial" data-index="2">
            <p className="quote">"Clear alerts and suggested maintenance windows made prioritization trivial — everyone on the floor trusts the recommendations."</p>
            <div className="attribution">— Priya S., Head of Maintenance, MegaFoods</div>
          </div>
        </div>
        <div className="testimonials-controls" aria-hidden="true">
          <button className="dot active" data-to="0" aria-label="Show testimonial 1"></button>
          <button className="dot" data-to="1" aria-label="Show testimonial 2"></button>
          <button className="dot" data-to="2" aria-label="Show testimonial 3"></button>
        </div>
      </div>
    </section>
  )
}
