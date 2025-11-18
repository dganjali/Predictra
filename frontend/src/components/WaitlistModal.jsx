import React, { useState } from 'react'
import logoImg from '../assets/Logo.png'
import factoryImg from '../assets/factory photo.png'

export default function WaitlistModal({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')

  if (!open) return null

  async function submit(e) {
    e && e.preventDefault && e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(data && data.error ? data.error : 'Submission failed')
        return
      }
      setStatus('success')
      setTimeout(() => {
        setEmail('')
        onClose()
        setStatus('idle')
      }, 2000)
    } catch (err) {
      console.error(err)
      setStatus('error')
      setError(err && err.message ? err.message : 'Network error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-left">
          <div className="logo" style={{ marginBottom: '24px' }}>
            <img src={logoImg} alt="Predictra" />
            <span>Predictra</span>
          </div>
          
          <h2>Join the beta</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            We're opening up spots gradually. Enter your email to get early access.
          </p>

          <form onSubmit={submit}>
            <div className="input-group">
              <input 
                className="input-field"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="name@company.com" 
                required
              />
            </div>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                type="submit" 
                disabled={status === 'loading' || status === 'success'}
                style={{ flex: 1 }}
              >
                {status === 'loading' ? 'Joining...' : (status === 'success' ? 'Joined!' : 'Join Waitlist')}
              </button>
              <button 
                className="btn btn-ghost" 
                type="button" 
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
            {status === 'error' && <p style={{ color: 'crimson', marginTop: 10 }}>{error}</p>}
          </form>
        </div>
        <div className="modal-right">
          <img src={factoryImg} alt="Factory" />
        </div>
      </div>
    </div>
  )
}
