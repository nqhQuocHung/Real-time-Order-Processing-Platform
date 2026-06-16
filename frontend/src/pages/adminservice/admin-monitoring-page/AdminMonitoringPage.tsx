import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apis,
  BASE_URL,
  endpoints,
  getAuthSession,
  refreshSessionToken,
} from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
import './AdminMonitoringPage.css'

type ServiceHealth = {
  key: string
  name: string
  uri: string
  status: string
  probeMs: number
  heapUsedMb?: number | null
  heapMaxMb?: number | null
  processCpuUsage?: number | null
  systemCpuUsage?: number | null
  liveThreads?: number | null
  httpRequestCount?: number | null
  httpRequestMaxMs?: number | null
  error?: string | null
}

type RuntimeMetrics = {
  heapUsedMb: number
  heapMaxMb: number
  heapUsagePercent: number
  avgProcessCpuUsage: number
  liveThreads: number
  totalHttpRequests: number
  maxHttpRequestMs: number
}

type RedisMetrics = {
  status: string
  usedMemoryBytes?: number | null
  maxMemoryBytes?: number | null
  keyspaceHits?: number | null
  keyspaceMisses?: number | null
  hitRatePercent?: number | null
  evictedKeys?: number | null
  expiredKeys?: number | null
  connectedClients?: number | null
  totalCommandsProcessed?: number | null
  instantaneousOpsPerSecond?: number | null
  error?: string | null
}

type KafkaMetrics = {
  status: string
  topicCount: number
  consumerGroupCount: number
  totalLag: number
  consumerGroups: Array<{ groupId: string; lag: number }>
  topics: string[]
  topicMetrics?: Array<{ topic: string; partitions: number; messages: number }>
  error?: string | null
}

type RealtimeMetrics = {
  activeNotificationSseConnections: number
  activeMonitoringSseConnections: number
  gatewayHttp2Enabled: boolean
  grpcTarget: string
  note: string
}

type InternalApiStatus = {
  source: string
  target: string
  operation: string
  contract: string
  status: string
  evidence: string
}

type MonitoringSnapshot = {
  capturedAt: string
  overallStatus: string
  services: ServiceHealth[]
  runtime: RuntimeMetrics
  redis: RedisMetrics
  kafka: KafkaMetrics
  realtime: RealtimeMetrics
  internalApis: InternalApiStatus[]
}

type InfrastructureSample = {
  capturedAt: string
  redisHitRate: number
  redisUsedMemoryBytes: number
  redisLookups: number
  redisCommands: number
  redisCommandDelta: number
  kafkaLag: number
  kafkaMessages: number
  kafkaMessageDelta: number
  kafkaTopicCount: number
  kafkaConsumerGroupCount: number
  realtimeConnections: number
  notificationSseConnections: number
  monitoringSseConnections: number
}

const STREAM_RETRY_DELAY_MS = 3000
const INFRASTRUCTURE_HISTORY_LIMIT = 24

class MonitoringStreamRetryableError extends Error {}
class MonitoringStreamFatalError extends Error {}

function parseSnapshot(data: string): MonitoringSnapshot | null {
  if (!data) {
    return null
  }
  try {
    return JSON.parse(data) as MonitoringSnapshot
  } catch {
    return null
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function formatDateTime(value?: string, locale = 'en-US') {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString(locale)
}

function formatNumber(value?: number | null, locale = 'en-US', maximumFractionDigits = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

function formatCompactNumber(value?: number | null, locale = 'en-US') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

function formatMb(value?: number | null, locale = 'en-US') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  return `${formatNumber(value, locale, 1)} MB`
}

function formatBytes(value?: number | null, locale = 'en-US') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${formatNumber(value / 1024 / 1024 / 1024, locale, 2)} GB`
  }
  if (value >= 1024 * 1024) {
    return `${formatNumber(value / 1024 / 1024, locale, 1)} MB`
  }
  if (value >= 1024) {
    return `${formatNumber(value / 1024, locale, 1)} KB`
  }
  return `${formatNumber(value, locale)} B`
}

function formatPercent(value?: number | null, locale = 'en-US', ratio = false) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  const percent = ratio ? value * 100 : value
  return `${formatNumber(percent, locale, 1)}%`
}

function formatMs(value?: number | null, locale = 'en-US') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }
  return `${formatNumber(value, locale, 0)}ms`
}

function normalizeStatus(value?: string) {
  return (value || 'UNKNOWN').trim().toUpperCase()
}

function finiteNumber(value?: number | null, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, value))
}

function calculatePercent(value?: number | null, total?: number | null) {
  if (
    typeof value !== 'number' ||
    typeof total !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null
  }
  return (value * 100) / total
}

function calculateCounterDelta(current?: number | null, previous?: number | null) {
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    return 0
  }
  if (typeof previous !== 'number' || !Number.isFinite(previous)) {
    return 0
  }
  if (current < previous) {
    return current
  }
  return current - previous
}

function calculateKafkaMessageTotal(kafka?: KafkaMetrics) {
  return (kafka?.topicMetrics || []).reduce(
    (total, topic) => total + finiteNumber(topic.messages),
    0,
  )
}

function buildInfrastructureSample(snapshot: MonitoringSnapshot): InfrastructureSample {
  const redisHits = finiteNumber(snapshot.redis?.keyspaceHits)
  const redisMisses = finiteNumber(snapshot.redis?.keyspaceMisses)
  const realtimeNotification = finiteNumber(snapshot.realtime?.activeNotificationSseConnections)
  const realtimeMonitoring = finiteNumber(snapshot.realtime?.activeMonitoringSseConnections)

  return {
    capturedAt: snapshot.capturedAt,
    redisHitRate: finiteNumber(snapshot.redis?.hitRatePercent),
    redisUsedMemoryBytes: finiteNumber(snapshot.redis?.usedMemoryBytes),
    redisLookups: redisHits + redisMisses,
    redisCommands: finiteNumber(snapshot.redis?.totalCommandsProcessed),
    redisCommandDelta: 0,
    kafkaLag: finiteNumber(snapshot.kafka?.totalLag),
    kafkaMessages: calculateKafkaMessageTotal(snapshot.kafka),
    kafkaMessageDelta: 0,
    kafkaTopicCount: finiteNumber(snapshot.kafka?.topicCount),
    kafkaConsumerGroupCount: finiteNumber(snapshot.kafka?.consumerGroupCount),
    realtimeConnections: realtimeNotification + realtimeMonitoring,
    notificationSseConnections: realtimeNotification,
    monitoringSseConnections: realtimeMonitoring,
  }
}

function statusClass(value?: string) {
  const normalized = normalizeStatus(value).toLowerCase()
  if (['healthy', 'up', 'ready', 'live'].includes(normalized)) {
    return 'healthy'
  }
  if (['watch', 'down', 'failed'].includes(normalized)) {
    return 'watch'
  }
  return 'pending'
}

function StatusPill({ status }: { status?: string }) {
  const normalized = normalizeStatus(status)
  return (
    <span className={`admin-monitoring-status admin-monitoring-status-${statusClass(normalized)}`}>
      {normalized}
    </span>
  )
}

function MetricDelta({
  current,
  previous,
  inverseGood = false,
  locale,
  suffix = '',
}: {
  current?: number | null
  previous?: number | null
  inverseGood?: boolean
  locale: string
  suffix?: string
}) {
  if (
    typeof current !== 'number' ||
    typeof previous !== 'number' ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return <span className="admin-monitoring-delta is-neutral">first sample</span>
  }

  const difference = current - previous
  if (Math.abs(difference) < 0.001) {
    return <span className="admin-monitoring-delta is-neutral">steady</span>
  }

  const tone = difference > 0
    ? inverseGood ? 'is-watch' : 'is-up'
    : inverseGood ? 'is-up' : 'is-down'
  const sign = difference > 0 ? '+' : ''

  return (
    <span className={`admin-monitoring-delta ${tone}`}>
      {sign}{formatNumber(difference, locale, 1)}{suffix}
    </span>
  )
}

function SignalMeter({
  label,
  value,
  tone = 'info',
}: {
  label: string
  value?: number | null
  tone?: 'good' | 'info' | 'watch'
}) {
  const width = clampPercent(value)
  return (
    <div className={`admin-monitoring-signal-meter admin-monitoring-signal-meter-${tone}`}>
      <div className="admin-monitoring-signal-meter-label">
        <span>{label}</span>
        <strong>{typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(width, 'en-US', 0)}%` : '-'}</strong>
      </div>
      <div className="admin-monitoring-signal-meter-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function SignalLineChart({
  label,
  samples,
  selectValue,
  formatValue,
  tone = 'info',
}: {
  label: string
  samples: InfrastructureSample[]
  selectValue: (sample: InfrastructureSample) => number
  formatValue?: (value: number) => string
  tone?: 'good' | 'info' | 'watch'
}) {
  const width = 260
  const height = 96
  const paddingX = 10
  const paddingY = 12
  const visibleSamples = samples.slice(-24)
  const values = visibleSamples.map((sample) => Math.max(0, finiteNumber(selectValue(sample))))
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)
  const range = Math.max(1, maxValue - minValue)
  const latestValue = values[values.length - 1] ?? 0

  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? width / 2
      : paddingX + (index / (values.length - 1)) * (width - paddingX * 2)
    const y = height - paddingY - ((value - minValue) / range) * (height - paddingY * 2)
    return { x, y, value }
  })

  const linePath = points.length
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
    : ''

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - paddingY} L ${points[0].x.toFixed(2)} ${height - paddingY} Z`
    : ''

  const displayValue = formatValue || ((value: number) => formatNumber(value, 'en-US', 0))

  return (
    <div className={`admin-monitoring-line-chart admin-monitoring-line-chart-${tone}`} role="img" aria-label={label}>
      <div className="admin-monitoring-line-chart-top">
        <span>{label}</span>
        <strong>{displayValue(latestValue)}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1="0" y1="24" x2={width} y2="24" />
        <line x1="0" y1="52" x2={width} y2="52" />
        <line x1="0" y1="80" x2={width} y2="80" />
        {areaPath && <path className="admin-monitoring-line-chart-area" d={areaPath} />}
        {linePath && <path className="admin-monitoring-line-chart-line" d={linePath} />}
        {points.length > 0 && (
          <circle
            className="admin-monitoring-line-chart-point"
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3.5"
          />
        )}
      </svg>
      <div className="admin-monitoring-line-chart-scale">
        <span>Min {displayValue(minValue)}</span>
        <span>Max {displayValue(maxValue)}</span>
      </div>
    </div>
  )
}

function AdminMonitoringPage() {
  const { language, t } = useI18n()
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null)
  const [infrastructureHistory, setInfrastructureHistory] = useState<InfrastructureSample[]>([])
  const [loading, setLoading] = useState(true)
  const [streamConnected, setStreamConnected] = useState(false)
  const [streamError, setStreamError] = useState('')
  const callbacksRef = useRef({ setSnapshot, setStreamConnected, setStreamError, setLoading })

  useEffect(() => {
    callbacksRef.current = { setSnapshot, setStreamConnected, setStreamError, setLoading }
  }, [])

  const loadSummary = useCallback(async () => {
    setStreamError('')
    try {
      const response = await apis().get<MonitoringSnapshot>(endpoints.monitoring.summary)
      setSnapshot(response.data)
      setLoading(false)
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Unable to load monitoring summary.')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    const initialAccessToken = getAuthSession()?.accessToken
    if (!initialAccessToken) {
      setLoading(false)
      setStreamError('Authentication is required for monitoring stream.')
      return undefined
    }

    const controller = new AbortController()
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

    void fetchEventSource(`${BASE_URL}${endpoints.monitoring.stream}`, {
      method: 'GET',
      headers: requestHeaders,
      openWhenHidden: true,
      signal: controller.signal,
      async onopen(response) {
        if (response.ok) {
          callbacksRef.current.setStreamConnected(true)
          callbacksRef.current.setStreamError('')
          return
        }

        if (response.status === 401) {
          const refreshed = await refreshSessionToken()
          if (refreshed) {
            syncLatestTokenToHeaders()
            throw new MonitoringStreamRetryableError('Monitoring token refreshed. Reconnecting stream.')
          }
          throw new MonitoringStreamFatalError('Monitoring stream unauthorized. Please login again.')
        }

        if (response.status === 403) {
          throw new MonitoringStreamFatalError('VIEW_SYSTEM_MONITORING permission is required.')
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new MonitoringStreamFatalError(`Monitoring stream open failed: ${response.status}`)
        }

        throw new MonitoringStreamRetryableError(`Monitoring stream open failed: ${response.status}`)
      },
      onmessage(event) {
        const nextSnapshot = parseSnapshot(event.data)
        if (!nextSnapshot) {
          return
        }
        callbacksRef.current.setSnapshot(nextSnapshot)
        callbacksRef.current.setLoading(false)
        callbacksRef.current.setStreamConnected(true)
        callbacksRef.current.setStreamError('')
      },
      onclose() {
        callbacksRef.current.setStreamConnected(false)
        throw new MonitoringStreamRetryableError('Monitoring stream closed. Reconnecting.')
      },
      onerror(error) {
        if (isAbortError(error)) {
          throw error
        }
        callbacksRef.current.setStreamConnected(false)

        if (error instanceof MonitoringStreamFatalError) {
          callbacksRef.current.setStreamError(error.message)
          throw error
        }

        callbacksRef.current.setStreamError(
          error instanceof Error ? error.message : 'Monitoring stream disconnected. Reconnecting.',
        )
        return STREAM_RETRY_DELAY_MS
      },
    }).catch((error) => {
      if (!isAbortError(error)) {
        callbacksRef.current.setStreamConnected(false)
        callbacksRef.current.setStreamError(
          error instanceof Error ? error.message : 'Monitoring stream failed.',
        )
        callbacksRef.current.setLoading(false)
      }
    })

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    const nextSample = buildInfrastructureSample(snapshot)
    setInfrastructureHistory((previous) => {
      const latest = previous[previous.length - 1]
      if (latest?.capturedAt === nextSample.capturedAt) {
        return previous
      }
      const sampleWithDelta = {
        ...nextSample,
        redisCommandDelta: calculateCounterDelta(nextSample.redisCommands, latest?.redisCommands),
        kafkaMessageDelta: calculateCounterDelta(nextSample.kafkaMessages, latest?.kafkaMessages),
      }
      return [...previous, sampleWithDelta].slice(-INFRASTRUCTURE_HISTORY_LIMIT)
    })
  }, [snapshot])

  const services = snapshot?.services || []
  const runtime = snapshot?.runtime
  const redis = snapshot?.redis
  const kafka = snapshot?.kafka
  const realtime = snapshot?.realtime
  const internalApis = snapshot?.internalApis || []
  const latestInfrastructureSample = infrastructureHistory[infrastructureHistory.length - 1]
  const previousInfrastructureSample = infrastructureHistory[infrastructureHistory.length - 2]
  const redisHits = finiteNumber(redis?.keyspaceHits)
  const redisMisses = finiteNumber(redis?.keyspaceMisses)
  const redisLookupTotal = redisHits + redisMisses
  const redisHitRate = typeof redis?.hitRatePercent === 'number' ? redis.hitRatePercent : null
  const redisMissRate = redisHitRate === null ? null : Math.max(0, 100 - redisHitRate)
  const redisMemoryPercent = calculatePercent(redis?.usedMemoryBytes, redis?.maxMemoryBytes)
  const redisCommands = finiteNumber(redis?.totalCommandsProcessed)
  const kafkaGroups = kafka?.consumerGroups || []
  const kafkaLagRows = kafkaGroups
    .slice()
    .sort((left, right) => right.lag - left.lag)
    .slice(0, 5)
  const kafkaTopicMetrics = kafka?.topicMetrics?.length
    ? kafka.topicMetrics
    : (kafka?.topics || []).map((topic) => ({ topic, partitions: 0, messages: 0 }))
  const kafkaTotalLag = finiteNumber(kafka?.totalLag)
  const kafkaTotalMessages = calculateKafkaMessageTotal(kafka)
  const kafkaTopicsWithMessages = kafkaTopicMetrics.filter((topic) => finiteNumber(topic.messages) > 0).length
  const kafkaGroupsWithLag = kafkaGroups.filter((group) => group.lag > 0).length
  const kafkaMaxGroupLag = kafkaGroups.reduce((maxLag, group) => Math.max(maxLag, group.lag), 0)
  const kafkaLagPressure = kafkaTotalLag <= 0 ? 0 : Math.min(100, 12 + Math.log10(kafkaTotalLag + 1) * 26)
  const notificationSseConnections = finiteNumber(realtime?.activeNotificationSseConnections)
  const monitoringSseConnections = finiteNumber(realtime?.activeMonitoringSseConnections)
  const realtimeConnections = notificationSseConnections + monitoringSseConnections
  const notificationConnectionShare = realtimeConnections > 0
    ? (notificationSseConnections * 100) / realtimeConnections
    : 0
  const monitoringConnectionShare = realtimeConnections > 0
    ? (monitoringSseConnections * 100) / realtimeConnections
    : 0

  const serviceSummary = useMemo(() => {
    const up = services.filter((service) => normalizeStatus(service.status) === 'UP').length
    const down = services.filter((service) => normalizeStatus(service.status) === 'DOWN').length
    const unknown = Math.max(0, services.length - up - down)
    return { up, down, unknown }
  }, [services])

  if (loading && !snapshot) {
    return <p className="role-muted">{t('adminMonitoring.loading', 'Opening realtime monitoring stream...')}</p>
  }

  return (
    <section className="admin-monitoring-page role-page-stack">
      <article className="role-card admin-monitoring-hero">
        <div>
          <p className="admin-monitoring-eyebrow">{t('adminMonitoring.eyebrow', 'Admin Operations')}</p>
          <h2>{t('adminMonitoring.title', 'System Monitoring')}</h2>
          <p className="role-muted">
            {t(
              'adminMonitoring.subtitle',
              'Realtime SSE monitoring for service health, JVM runtime, Redis, Kafka, internal APIs, and delivery streams.',
            )}
          </p>
        </div>

        <div className="admin-monitoring-actions">
          <StatusPill status={streamConnected ? 'LIVE' : 'RECONNECTING'} />
          <button type="button" className="role-btn-ghost" onClick={() => void loadSummary()}>
            {t('adminMonitoring.refreshNow', 'Refresh now')}
          </button>
        </div>
      </article>

      {streamError && <p className="role-error">{streamError}</p>}

      <article className="role-card">
        <div className="admin-monitoring-summary-grid">
          <div className="role-metric-card admin-monitoring-overall-card">
            <span>{t('adminMonitoring.metrics.overall', 'Overall status')}</span>
            <strong>{snapshot?.overallStatus || '-'}</strong>
            <StatusPill status={snapshot?.overallStatus} />
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.servicesUp', 'Services up')}</span>
            <strong>{serviceSummary.up}/{services.length || 6}</strong>
            <small>{serviceSummary.down} down, {serviceSummary.unknown} unknown</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.heap', 'JVM heap')}</span>
            <strong>{formatPercent(runtime?.heapUsagePercent, locale)}</strong>
            <small>{formatMb(runtime?.heapUsedMb, locale)} / {formatMb(runtime?.heapMaxMb, locale)}</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.cpu', 'Avg process CPU')}</span>
            <strong>{formatPercent(runtime?.avgProcessCpuUsage, locale, true)}</strong>
            <small>{formatNumber(runtime?.liveThreads, locale)} live threads</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.kafkaLag', 'Kafka lag')}</span>
            <strong>{formatNumber(kafka?.totalLag, locale)}</strong>
            <small>{kafka?.consumerGroupCount || 0} consumer groups, {kafka?.topicCount || 0} topics</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.redisHitRate', 'Redis hit rate')}</span>
            <strong>{formatPercent(redis?.hitRatePercent, locale)}</strong>
            <small>{formatBytes(redis?.usedMemoryBytes, locale)} used memory</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.realtime', 'Realtime streams')}</span>
            <strong>
              {(realtime?.activeNotificationSseConnections || 0) + (realtime?.activeMonitoringSseConnections || 0)}
            </strong>
            <small>
              {realtime?.activeNotificationSseConnections || 0} notifications, {realtime?.activeMonitoringSseConnections || 0} monitoring
            </small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.lastUpdated', 'Last updated')}</span>
            <strong>{formatDateTime(snapshot?.capturedAt, locale)}</strong>
            <small>SSE snapshot from Gateway</small>
          </div>
        </div>
      </article>

      <article className="role-card">
        <div className="admin-monitoring-section-header">
          <div>
            <h3>{t('adminMonitoring.services.title', 'Service health and JVM metrics')}</h3>
            <p className="role-muted">
              {t('adminMonitoring.services.subtitle', 'Realtime snapshots from Actuator health and metrics endpoints.')}
            </p>
          </div>
        </div>

        <div className="admin-monitoring-service-grid">
          {services.map((service) => (
            <section key={service.key} className="admin-monitoring-service-card">
              <header>
                <div>
                  <h4>{service.name}</h4>
                  <span>{service.uri}</span>
                </div>
                <StatusPill status={service.status} />
              </header>
              <dl>
                <div>
                  <dt>Probe</dt>
                  <dd>{formatMs(service.probeMs, locale)}</dd>
                </div>
                <div>
                  <dt>Heap</dt>
                  <dd>{formatMb(service.heapUsedMb, locale)}</dd>
                </div>
                <div>
                  <dt>CPU</dt>
                  <dd>{formatPercent(service.processCpuUsage, locale, true)}</dd>
                </div>
                <div>
                  <dt>Threads</dt>
                  <dd>{formatNumber(service.liveThreads, locale)}</dd>
                </div>
                <div>
                  <dt>Requests</dt>
                  <dd>{formatNumber(service.httpRequestCount, locale)}</dd>
                </div>
                <div>
                  <dt>Max</dt>
                  <dd>{formatMs(service.httpRequestMaxMs, locale)}</dd>
                </div>
              </dl>
              {service.error && <p className="role-error">{service.error}</p>}
            </section>
          ))}
        </div>
      </article>

      <article className="role-card">
        <div className="admin-monitoring-section-header">
          <div>
            <h3>{t('adminMonitoring.signals.title', 'Infrastructure signals')}</h3>
            <p className="role-muted">
              {t('adminMonitoring.signals.subtitle', 'Live Redis, Kafka, runtime and stream counters collected by Gateway.')}
            </p>
          </div>
        </div>

        <div className="admin-monitoring-signal-grid">
          <section className="admin-monitoring-signal-card">
            <header>
              <div>
                <h4>Redis cache + locks</h4>
                <span>Cache efficiency, memory pressure and lock-store activity</span>
              </div>
              <StatusPill status={redis?.status} />
            </header>
            <div className="admin-monitoring-signal-main">
              <div>
                <span>Commands / sample</span>
                <strong>{formatCompactNumber(latestInfrastructureSample?.redisCommandDelta, locale)}</strong>
              </div>
              <MetricDelta
                current={latestInfrastructureSample?.redisCommandDelta}
                previous={previousInfrastructureSample?.redisCommandDelta}
                locale={locale}
              />
            </div>
            <SignalMeter label="Hits" value={redisHitRate} tone="good" />
            <SignalMeter label="Misses" value={redisMissRate} tone="watch" />
            <SignalLineChart
              label="Command rate"
              samples={infrastructureHistory}
              selectValue={(sample) => sample.redisCommandDelta}
              formatValue={(value) => formatCompactNumber(value, locale)}
              tone="good"
            />
            <div className="admin-monitoring-signal-stats">
              <span><strong>{formatCompactNumber(redisLookupTotal, locale)}</strong> lookups</span>
              <span><strong>{formatCompactNumber(redisCommands, locale)}</strong> commands</span>
              <span><strong>{formatNumber(redis?.instantaneousOpsPerSecond, locale)}</strong> ops/sec</span>
              <span><strong>{formatBytes(redis?.usedMemoryBytes, locale)}</strong> memory</span>
              <span><strong>{formatNumber(redis?.connectedClients, locale)}</strong> clients</span>
              <span><strong>{formatNumber(redis?.evictedKeys, locale)}</strong> evicted</span>
            </div>
            {redisMemoryPercent !== null && (
              <SignalMeter label="Memory cap" value={redisMemoryPercent} tone={redisMemoryPercent > 75 ? 'watch' : 'info'} />
            )}
            {redis?.error && <p className="role-error">{redis.error}</p>}
          </section>

          <section className="admin-monitoring-signal-card">
            <header>
              <div>
                <h4>Kafka event bus</h4>
                <span>Topic visibility, consumer lag and backlog pressure</span>
              </div>
              <StatusPill status={kafka?.status} />
            </header>
            <div className="admin-monitoring-signal-main">
              <div>
                <span>Messages</span>
                <strong>{formatCompactNumber(kafkaTotalMessages, locale)}</strong>
              </div>
              <MetricDelta
                current={latestInfrastructureSample?.kafkaMessages}
                previous={previousInfrastructureSample?.kafkaMessages}
                locale={locale}
              />
            </div>
            <SignalMeter label="Lag pressure" value={kafkaLagPressure} tone={kafkaTotalLag > 0 ? 'watch' : 'good'} />
            <SignalLineChart
              label="Message rate"
              samples={infrastructureHistory}
              selectValue={(sample) => sample.kafkaMessageDelta}
              formatValue={(value) => formatCompactNumber(value, locale)}
              tone="info"
            />
            <div className="admin-monitoring-signal-stats">
              <span><strong>{formatCompactNumber(kafkaTotalMessages, locale)}</strong> messages</span>
              <span><strong>{formatNumber(kafka?.topicCount, locale)}</strong> topics</span>
              <span><strong>{formatNumber(kafka?.consumerGroupCount, locale)}</strong> groups</span>
              <span><strong>{formatNumber(kafkaTopicsWithMessages, locale)}</strong> active topics</span>
              <span><strong>{formatNumber(kafkaGroupsWithLag, locale)}</strong> groups lagging</span>
              <span><strong>{formatNumber(kafkaMaxGroupLag, locale)}</strong> max group lag</span>
            </div>
            {kafka?.error && <p className="role-error">{kafka.error}</p>}
          </section>

          <section className="admin-monitoring-signal-card">
            <header>
              <div>
                <h4>gRPC / SSE realtime</h4>
                <span>Browser streams bridged from Notification gRPC</span>
              </div>
              <StatusPill status={realtime?.gatewayHttp2Enabled ? 'READY' : 'WATCH'} />
            </header>
            <div className="admin-monitoring-signal-main">
              <div>
                <span>Active streams</span>
                <strong>{formatNumber(realtimeConnections, locale)}</strong>
              </div>
              <MetricDelta
                current={latestInfrastructureSample?.realtimeConnections}
                previous={previousInfrastructureSample?.realtimeConnections}
                locale={locale}
              />
            </div>
            <div className="admin-monitoring-realtime-route">
              <span>Notification Service</span>
              <strong>{realtime?.grpcTarget || '-'}</strong>
              <span>Gateway SSE</span>
            </div>
            <div className="admin-monitoring-realtime-split" aria-label="Realtime stream split">
              <span style={{ width: `${notificationConnectionShare}%` }} />
              <span style={{ width: `${monitoringConnectionShare}%` }} />
            </div>
            <div className="admin-monitoring-signal-stats">
              <span><strong>{formatNumber(notificationSseConnections, locale)}</strong> notification SSE</span>
              <span><strong>{formatNumber(monitoringSseConnections, locale)}</strong> monitoring SSE</span>
              <span><strong>{realtime?.gatewayHttp2Enabled ? 'ON' : 'OFF'}</strong> HTTP/2</span>
            </div>
            <SignalLineChart
              label="Stream trend"
              samples={infrastructureHistory}
              selectValue={(sample) => sample.realtimeConnections}
              formatValue={(value) => formatNumber(value, locale)}
              tone="info"
            />
            <p>{realtime?.note || '-'}</p>
          </section>
        </div>
      </article>

      <div className="admin-monitoring-two-column">
        <article className="role-card">
          <div className="admin-monitoring-section-header">
            <div>
              <h3>{t('adminMonitoring.kafka.title', 'Kafka consumer lag')}</h3>
              <p className="role-muted">
                {t('adminMonitoring.kafka.subtitle', 'Real offsets from Kafka AdminClient.')}
              </p>
            </div>
          </div>

          <div className="admin-monitoring-lag-panel">
            <div className="admin-monitoring-lag-summary">
              <span>
                <strong>{formatNumber(kafkaTotalLag, locale)}</strong>
                total lag
              </span>
              <span>
                <strong>{formatNumber(kafkaGroupsWithLag, locale)}</strong>
                groups lagging
              </span>
              <span>
                <strong>{formatNumber(kafkaMaxGroupLag, locale)}</strong>
                max group lag
              </span>
            </div>

            <div className="admin-monitoring-lag-list">
              {kafkaLagRows.map((group) => {
                const width = kafkaMaxGroupLag > 0 ? (group.lag / kafkaMaxGroupLag) * 100 : 0
                return (
                  <div className="admin-monitoring-lag-row" key={group.groupId}>
                    <div>
                      <code>{group.groupId}</code>
                      <strong>{formatNumber(group.lag, locale)}</strong>
                    </div>
                    <span>
                      <i style={{ width: `${width}%` }} />
                    </span>
                  </div>
                )
              })}
              {!kafkaLagRows.length && (
                <p className="role-muted">No consumer groups reported.</p>
              )}
            </div>
          </div>

          <div className="admin-monitoring-section-header admin-monitoring-subsection-header">
            <div>
              <h3>Kafka topic messages</h3>
              <p className="role-muted">Message count is calculated from latest minus earliest offsets per partition.</p>
            </div>
          </div>

          <div className="admin-monitoring-table-wrap">
            <table className="admin-monitoring-table admin-monitoring-topic-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Messages</th>
                  <th>Partitions</th>
                </tr>
              </thead>
              <tbody>
                {kafkaTopicMetrics.map((topic) => (
                  <tr key={topic.topic}>
                    <td><code>{topic.topic}</code></td>
                    <td>{formatNumber(topic.messages, locale)}</td>
                    <td>{formatNumber(topic.partitions, locale)}</td>
                  </tr>
                ))}
                {!kafkaTopicMetrics.length && (
                  <tr>
                    <td colSpan={3}>No topics reported.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="role-card">
          <div className="admin-monitoring-section-header">
            <div>
              <h3>{t('adminMonitoring.internal.title', 'Internal API paths')}</h3>
              <p className="role-muted">
                {t('adminMonitoring.internal.subtitle', 'Live readiness derived from source and target service health.')}
              </p>
            </div>
          </div>

          <div className="admin-monitoring-internal-list">
            {internalApis.map((path) => (
              <section key={`${path.source}-${path.target}-${path.operation}`}>
                <header>
                  <strong>{path.source} {'->'} {path.target}</strong>
                  <StatusPill status={path.status} />
                </header>
                <p>{path.operation}</p>
                <code>{path.contract}</code>
                <p>{path.evidence}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

export default AdminMonitoringPage
