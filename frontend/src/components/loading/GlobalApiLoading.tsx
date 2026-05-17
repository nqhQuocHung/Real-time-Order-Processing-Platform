import { useEffect, useRef, useState } from 'react'
import {
  API_LOADING_EVENT,
  type ApiLoadingEventDetail,
} from '../../config/apis'
import './GlobalApiLoading.css'

function GlobalApiLoading() {
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const showTimerRef = useRef<number | null>(null)

  useEffect(() => {
    function handleApiLoadingEvent(event: Event) {
      const customEvent = event as CustomEvent<ApiLoadingEventDetail>
      const nextCount = customEvent.detail?.pendingCount ?? 0
      setPendingCount(Math.max(0, nextCount))
    }

    window.addEventListener(API_LOADING_EVENT, handleApiLoadingEvent as EventListener)

    return () => {
      window.removeEventListener(API_LOADING_EVENT, handleApiLoadingEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    if (pendingCount > 0) {
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current)
      }
      showTimerRef.current = window.setTimeout(() => {
        setVisible(true)
      }, 120)
      return
    }

    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }

    setVisible(false)
  }, [pendingCount])

  useEffect(
    () => () => {
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current)
      }
    },
    [],
  )

  if (!visible) {
    return null
  }

  return (
    <div className="global-api-loading" aria-live="polite" aria-label="Loading">
      <div className="global-api-loading-bar" />
      <div className="global-api-loading-badge">
        <span className="global-api-loading-spinner" />
        <span>Loading...</span>
      </div>
    </div>
  )
}

export default GlobalApiLoading
