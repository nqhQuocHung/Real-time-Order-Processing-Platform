import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useRef } from 'react'
import { BASE_URL, endpoints, getAuthSession } from '../config/apis'

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

    const session = getAuthSession()
    if (!session?.accessToken) {
      return undefined
    }

    const controller = new AbortController()
    const streamUrl = `${BASE_URL}${endpoints.notifications.stream}`

    void fetchEventSource(streamUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${session.accessToken}`,
      },
      openWhenHidden: true,
      signal: controller.signal,
      async onopen(response) {
        if (!response.ok) {
          throw new Error(`Notification stream open failed: ${response.status}`)
        }
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
        if (!isAbortError(error)) {
          callbacksRef.current.onError?.(error)
        }
        return 2000
      },
    })

    return () => {
      controller.abort()
    }
  }, [enabled])
}

export default useNotificationStream
export type { PartnerRequestCreatedEvent, PartnerRequestDecidedEvent }
