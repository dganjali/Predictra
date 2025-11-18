import React from 'react'
import { motion } from 'framer-motion'
import factoryImg from '../assets/factory photo.png'

export default function Hero({ onJoin }) {
  return (
    <section className="hero-section" id="about">
      <div className="container hero-content">
        <div className="hero-text">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Predictra
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            AI-powered predictive maintenance for small and mid-sized manufacturers.
          </motion.p>
          
          <motion.div 
            className="hero-stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="stat-item">
              <strong>70%</strong>
              <span>SMEs lack predictive maintenance</span>
            </div>
            <div className="stat-item">
              <strong>60s+</strong>
              <span>Avg wait times in impacted locations</span>
            </div>
          </motion.div>

          <motion.div 
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <button className="btn btn-primary" onClick={onJoin}>Join Waitlist</button>
          </motion.div>
        </div>

        <motion.div 
          className="hero-image-wrapper"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <img src={factoryImg} alt="Factory" className="hero-image" />
        </motion.div>
      </div>
    </section>
  )
}
