import React, { useState } from 'react'

export default function WaitlistModal({open, onClose}){
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')

  if(!open) return null

  async function submit(e){
    e && e.preventDefault && e.preventDefault()
    setStatus('loading')
    setError('')
    try{
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if(!res.ok){
        setStatus('error')
        setError(data && data.error ? data.error : 'Submission failed')
        return
      }
      setStatus('success')
      setTimeout(()=>{
        setEmail('')
        onClose()
        setStatus('idle')
      }, 900)
    }catch(err){
      console.error(err)
      setStatus('error')
      setError(err && err.message ? err.message : 'Network error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-left">
          <img src={encodeURI('/images/Logo.png')} alt="Predictra" />
          <h3>Join the Predictra beta</h3>
          <p>Enter your email and we'll notify you when we open the beta.</p>
          <form onSubmit={submit}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" />
            <div className="modal-actions">
              <button className="primary" type="submit" disabled={status==='loading'}>{status==='loading' ? 'Sending...' : (status==='success' ? 'Sent' : 'Join Waitlist')}</button>
              <button className="ghost" type="button" onClick={onClose}>Close</button>
            </div>
          </form>
          {status==='error' && <p style={{color:'crimson',marginTop:10}}>{error}</p>}
        </div>
        <div className="modal-right">
          <img src={encodeURI('/images/factory photo.png')} alt="factory" />
        </div>
      </div>
    </div>
  )
}
