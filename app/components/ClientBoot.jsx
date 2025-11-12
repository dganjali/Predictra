"use client"
import { useEffect } from 'react'

export default function ClientBoot() {
  useEffect(() => {
    // Helper: safe query
    const $ = (sel) => document.querySelector(sel)
    const $$ = (sel) => Array.from(document.querySelectorAll(sel))

    // Typewriter
    (function initTypewriter() {
      const container = document.getElementById('typewriter-container')
      if (!container) return
      const textElement = container.querySelector('.typewriter-text')
      const lines = [
        'Analyzing sensor data stream...',
        'Real-time anomaly detection in progress...',
        'Calculating Remaining Useful Lifetime (RUL)...',
        'Generating predictive maintenance alerts...',
        'Bayesian inference models updating...',
        'System operating at 99.8% efficiency.',
        'Monitoring pump_AX12... Status: Healthy',
        'Monitoring motor_B45... Status: Warning'
      ]

      let lineIndex = 0
      let charIndex = 0
      let isDeleting = false

      function type() {
        const currentLine = lines[lineIndex]
        if (isDeleting) {
          textElement.textContent = currentLine.substring(0, charIndex - 1)
          charIndex--
        } else {
          textElement.textContent = currentLine.substring(0, charIndex + 1)
          charIndex++
        }

        let typeSpeed = isDeleting ? 50 : 100

        if (!isDeleting && charIndex === currentLine.length) {
          typeSpeed = 2000
          isDeleting = true
        } else if (isDeleting && charIndex === 0) {
          isDeleting = false
          lineIndex = (lineIndex + 1) % lines.length
          typeSpeed = 500
        }

        setTimeout(type, typeSpeed)
      }

      type()
    })()

    // Scroll reveal
    (function initScrollReveal() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      }, { threshold: 0.12 })

      $$('.reveal-on-scroll').forEach(el => observer.observe(el))
    })()

    // Testimonials and showcase interactions
    (function initShowcaseInteractions() {
      const testimonials = $$('.testimonials-wrap .testimonial')
      const dots = $$('.testimonials-controls .dot')
      let current = 0

      if (testimonials.length) {
        const show = (index) => {
          testimonials.forEach((t, i) => t.classList.toggle('active', i === index))
          dots.forEach((d, i) => d.classList.toggle('active', i === index))
          current = index
        }
        show(0)
        dots.forEach(d => d.addEventListener('click', (e) => {
          const to = Number(d.getAttribute('data-to')) || 0
          show(to)
        }))
        const tInt = setInterval(() => show((current + 1) % testimonials.length), 6000)

        // cleanup on unmount
        ;(window).__cleanupTestimonial = () => clearInterval(tInt)
      }

      // Side features
      const sideItems = $$('.side-features .sf-item')
      const showcaseTitle = $('.showcase-body .section-title')
      const showcaseLead = $('.showcase-body .lead-text')
      const sideFeatureContent = {
        predictive: { title: 'Predictive models that learn per-machine', desc: 'Bayesian and ensemble techniques yield calibrated RUL estimates and uncertainty bands for confident planning.' },
        anomaly: { title: 'Explainable anomaly signals', desc: 'Signal attribution and timelines help engineers verify root causes quickly and act with evidence.' },
        ops: { title: 'Designed for operations', desc: 'Integrations with SCADA, MES, and common telemetry systems make adoption frictionless.' },
        alerts: { title: 'Contextual, actionable alerts', desc: 'Each alert includes confidence, affected components, and recommended maintenance windows.' }
      }

      let currentSide = 0
      if (sideItems.length) {
        const setActive = (idx) => {
          sideItems.forEach((it, i) => it.classList.toggle('active', i === idx))
          currentSide = idx
          const key = sideItems[idx].getAttribute('data-feature')
          if (sideFeatureContent[key]) {
            if (showcaseTitle) showcaseTitle.textContent = sideFeatureContent[key].title
            if (showcaseLead) showcaseLead.textContent = sideFeatureContent[key].desc
          }
        }

        sideItems.forEach((it, i) => {
          it.addEventListener('click', (e) => { e.preventDefault(); setActive(i) })
        })

        setActive(0)
        const sInt = setInterval(() => setActive((currentSide + 1) % sideItems.length), 8000)
        ;(window).__cleanupSide = () => clearInterval(sInt)
      }
    })()

    // Wire join CTA
    (function wireJoinCTA() {
      const joinBtn = document.getElementById('join-btn')
      if (!joinBtn) return
      joinBtn.addEventListener('click', (e) => {
        e.preventDefault()
        const anchor = document.getElementById('subscribe')
        const emailInput = document.getElementById('email') || document.getElementById('email-3')
        const form = document.getElementById('subscribe-form') || document.getElementById('subscribe-form-3')
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setTimeout(() => {
          if (emailInput) emailInput.focus()
          if (emailInput && emailInput.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value) && form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
          }
        }, 300)
      })
    })()

    // Navbar scroll effect
    const navbar = $('.navbar')
    const onScroll = () => {
      if (!navbar) return
      if (window.scrollY > 50) navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      else navbar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    }
    window.addEventListener('scroll', onScroll)

    // Subscribe form handlers
    const handleSubscribe = (formId, inputId, msgId) => {
      const form = document.getElementById(formId)
      const input = document.getElementById(inputId)
      const msg = document.getElementById(msgId)
      if (!form || !input || !msg) return

      const submit = async (e) => {
        e.preventDefault()
        const email = (input.value || '').trim()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          msg.textContent = 'Please enter a valid email.'
          msg.className = 'subscribe-msg error'
          return
        }
        msg.textContent = 'Sending...'
        try {
          const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
          const data = await res.json()
          if (res.ok && data.success) {
            msg.textContent = data.message || 'Thanks — we received your email!'
            msg.className = 'subscribe-msg success'
            input.value = ''
          } else {
            msg.textContent = data.message || 'Something went wrong.'
            msg.className = 'subscribe-msg error'
          }
        } catch (err) {
          msg.textContent = 'Network error'
          msg.className = 'subscribe-msg error'
        }
        setTimeout(() => { msg.textContent = ''; msg.className = 'subscribe-msg' }, 5000)
      }

      form.addEventListener('submit', submit)
      // expose cleanup
      const key = `__cleanup_${formId}`
      window[key] = () => form.removeEventListener('submit', submit)
    }

    handleSubscribe('subscribe-form', 'email', 'subscribe-msg')
    handleSubscribe('subscribe-form-3', 'email-3', 'subscribe-msg-3')

    // cleanup on unmount
    return () => {
      window.removeEventListener('scroll', onScroll)
      const cleanupCandidates = ['__cleanupTestimonial', '__cleanupSide', '__cleanup_subscribe-form', '__cleanup_subscribe-form-3']
      cleanupCandidates.forEach(key => {
        try {
          if (typeof window[key] === 'function') window[key]()
        } catch (err) {
          // ignore cleanup errors
        }
      })
    }
  }, [])

  return null
}
