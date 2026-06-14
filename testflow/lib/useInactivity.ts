'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const WARN_MS = 15 * 60 * 1000
const LOGOUT_MS = 20 * 60 * 1000

export function useInactivity(onLogout: () => void) {
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const reset = useCallback(() => {
    setShowWarning(false)
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
    clearInterval(countdownTimer.current)

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(300)
      countdownTimer.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countdownTimer.current); return 0 }
          return s - 1
        })
      }, 1000)
    }, WARN_MS)

    logoutTimer.current = setTimeout(() => {
      onLogout()
    }, LOGOUT_MS)
  }, [onLogout])

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(warnTimer.current)
      clearTimeout(logoutTimer.current)
      clearInterval(countdownTimer.current)
    }
  }, [reset])

  return { showWarning, secondsLeft, reset }
}

// v3
// v3