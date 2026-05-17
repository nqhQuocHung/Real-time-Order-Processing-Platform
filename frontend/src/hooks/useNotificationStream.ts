import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useRef } from 'react'
import { BASE_URL, endpoints, getAuthSession, refreshSessionToken } from '../config/apis'

type PartnerRequestCreatedEvent = {
  eventId: string
  eventType: string
  requestId: string
  userId: string
  username?: string
  email?: string
  status: string
  requestNote?: string
  occurredAt?: string
}

type PartnerRequestDecidedEvent = {
  eventId: string
  eventType: string
  requestId: string
  userId: string
  username?: string
  email?: string
  decision: string
  status: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  occurredAt?: string
}

type UseNotificationStreamOptions = {
  enabled?: boolean
  onEvent?: (eventName: string, payload: unknown) => void
  onConnected?: (payload: unknown) => void
  onPartnerRequestCreated?: (event: PartnerRequestCreatedEvent) => void
  onPartnerRequestDecided?: (event: PartnerRequestDecidedEvent) => void
  onError?: (error: unknown) => void
}

const STREAM_RETRY_DELAY_MS = 2000

class NotificationStreamRetryableError extends Error {}

class NotificationStreamFatalError extends Error {}

function parseJson(data: string): unknown {
  if (!data) {
    return {}
  }
  try {
    return JSON.parse(data)
  } catch {
    return { raw: data }
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function useNotificationStream({
  enabled = true,
  onEvent,
  onConnected,
  onPartnerRequestCreated,
  onPartnerRequestDecided,
  onError,
}: UseNotificationStreamOptions) {
  const callbacksRef = useRef({
    onEvent,
    onConnected,
    onPartnerRequestCreated,
    onPartnerRequestDecided,
    onError,
  })

  useEffect(() => {
    callbacksRef.current = {
      onEvent,
      onConnected,
      onPartnerRequestCreated,
      onPartnerRequestDecided,
      onError,
    }
  }, [onEvent, onConnected, onPartnerRequestCreated, onPartnerRequestDecided, onError])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const initialAccessToken = getAuthSession()?.accessToken
    if (!initialAccessToken) {
      return undefined
    }

    const controller = new AbortController()
    const streamUrl = `${BASE_URL}${endpoints.notifications.stream}`
    const requestHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${initialAccessToken}`,
    }

    function syncLatestTokenToHeaders() {
      const latestAccessToken = getAuthSession()?.accessToken
      if (latestAccessToken) {
        requestHeaders.Authorization = `Bearer ${latestAccessToken}`
      }
    }

    void fetchEventSource(streamUrl, {
      method: 'GET',
      headers: requestHeaders,
      openWhenHidden: true,
      signal: controller.signal,
      async onopen(response) {
        if (response.ok) {
          return
        }

        if (response.status === 401) {
          const refreshed = await refreshSessionToken()
          if (refreshed) {
            syncLatestTokenToHeaders()
            throw new NotificationStreamRetryableError('Notification token refreshed. Reconnecting stream.')
          }

          throw new NotificationStreamFatalError('Notification stream unauthorized. Please login again.')
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new NotificationStreamFatalError(`Notification stream open failed: ${response.status}`)
        }

        throw new NotificationStreamRetryableError(`Notification stream open failed: ${response.status}`)
      },
      onmessage(event) {
        const payload = parseJson(event.data)
        const eventName = event.event || 'message'

        callbacksRef.current.onEvent?.(eventName, payload)

        if (eventName === 'connected') {
          callbacksRef.current.onConnected?.(payload)
          return
        }
        if (eventName === 'partner.request.created') {
          callbacksRef.current.onPartnerRequestCreated?.(payload as PartnerRequestCreatedEvent)
          return
        }
        if (eventName === 'partner.request.decided') {
          callbacksRef.current.onPartnerRequestDecided?.(payload as PartnerRequestDecidedEvent)
        }
      },
      onerror(error) {
        if (isAbortError(error)) {
          throw error
        }

        if (error instanceof NotificationStreamFatalError) {
          callbacksRef.current.onError?.(error)
          throw error
        }

        callbacksRef.current.onError?.(error)
        return STREAM_RETRY_DELAY_MS
      },
    }).catch((error) => {
      if (!isAbortError(error)) {
        callbacksRef.current.onError?.(error)
      }
    })

    return () => {
      controller.abort()
    }
  }, [enabled])
}

export default useNotificationStream
export type { PartnerRequestCreatedEvent, PartnerRequestDecidedEvent }
