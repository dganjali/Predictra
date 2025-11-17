import React from 'react'
import { motion } from 'framer-motion'

export default function Hero({onJoin}) {
  return (
    <section className="hero" id="about">
      <div className="hero-left">
        <motion.h1 initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08, duration: 0.5 }}>
          Predictra
        </motion.h1>
        <motion.p className="subtitle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          AI-powered predictive maintenance for small and mid-sized manufacturers.
        </motion.p>

        <motion.div className="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
          <div>
            <strong>70%</strong>
            <span>SMEs lack predictive maintenance</span>
          </div>
          <div>
            <strong>60s+</strong>
            <span>Avg last-year wait times in impacted locations</span>
          </div>
        </motion.div>

        <div className="hero-cta">
          <button className="primary" onClick={onJoin}>Join Waitlist</button>
          <a className="ghost" href="#features">Learn more</a>
        </div>
      </div>

      <motion.div className="hero-right" initial={{ x: 36, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 90 }}>
        <img src={encodeURI('/images/factory photo.png')} alt="Factory" />
      </motion.div>
    </section>
  )
}
