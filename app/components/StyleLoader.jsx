"use client"

import { useEffect } from 'react'

export default function StyleLoader() {
  useEffect(() => {
    // Check if stylesheet is already loaded
    const existingLink = document.querySelector('link[href="/css/styles.css"]')
    if (existingLink) return

    // Create and append stylesheet link
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/css/styles.css'
    document.head.appendChild(link)

    return () => {
      // Cleanup on unmount (though unlikely in root layout)
      const linkToRemove = document.querySelector('link[href="/css/styles.css"]')
      if (linkToRemove) {
        linkToRemove.remove()
      }
    }
  }, [])

  return null
}

