import { useCallback, useEffect, useMemo, useState } from 'react'
import { apis, extractApiErrorMessage } from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
import './AdminMonitoringPage.css'

type ServiceKey =
  | 'gateway'
  | 'auth'
  | 'order'
  | 'inventory'
  | 'payment'
  | 'notification'

type ProbeStatus = 'UP' | 'DOWN' | 'UNKNOWN'

type HealthResponse = {
  status?: string
  components?: Record<string, HealthResponse>
  details?: Record<string, unknown>
}

type ServiceProbe = {
  key: ServiceKey
  name: string
  port: string
  endpoint: string
  role: string
  runtime: string
  dependencies: string[]
}

type ServiceHealth = ServiceProbe & {
  status: ProbeStatus
  durationMs: number | null
  checkedAt: string
  error?: string
  components: Array<{ name: string; status: ProbeStatus }>
}

type SignalState = 'healthy' | 'watch' | 'pending'

const REFRESH_OPTIONS = [15, 30, 60, 0]

const SERVICE_PROBES: ServiceProbe[] = [
  {
    key: 'gateway',
    name: 'API Gateway',
    port: '8080',
    endpoint: '/actuator/health',
    role: 'Public edge + route proxy',
    runtime: 'Spring WebFlux',
    dependencies: ['JWT', 'gRPC client', 'downstream routes'],
  },
  {
    key: 'auth',
    name: 'Auth Service',
    port: '8081',
    endpoint: '/actuator/auth/health',
    role: 'Identity, JWT, RBAC',
    runtime: 'Spring MVC',
    dependencies: ['PostgreSQL', 'Kafka producer'],
  },
  {
    key: 'order',
    name: 'Order Service',
    port: '8082',
    endpoint: '/actuator/orders/health',
    role: 'Order orchestration',
    runtime: 'Spring MVC',
    dependencies: ['PostgreSQL', 'Kafka', 'Inventory RPC', 'Payment RPC'],
  },
  {
    key: 'inventory',
    name: 'Inventory Service',
    port: '8083',
    endpoint: '/actuator/inventory/health',
    role: 'Catalog, stock, reviews',
    runtime: 'Spring MVC',
    dependencies: ['PostgreSQL', 'Redis cache', 'Kafka producer'],
  },
  {
    key: 'payment',
    name: 'Payment Service',
    port: '8084',
    endpoint: '/actuator/payments/health',
    role: 'Payment intents + refunds',
    runtime: 'Spring MVC',
    dependencies: ['PostgreSQL', 'Redis lock', 'Kafka producer'],
  },
  {
    key: 'notification',
    name: 'Notification Service',
    port: '8085 / 9095',
    endpoint: '/actuator/notifications/health',
    role: 'Kafka fanout + gRPC stream',
    runtime: 'Spring MVC + gRPC Netty',
    dependencies: ['PostgreSQL', 'Kafka consumers', 'Order RPC', 'Inventory RPC'],
  },
]

const TOPIC_GROUPS = [
  {
    family: 'order.lifecycle.*',
    producer: 'order-service',
    consumers: 'notification-service',
    purpose: 'Order created, paid, completed, failed fanout',
  },
  {
    family: 'order.refund.*',
    producer: 'order-service',
    consumers: 'notification-service',
    purpose: 'Refund request, decision, completed, failed updates',
  },
  {
    family: 'payment.transaction.*',
    producer: 'payment-service',
    consumers: 'order-service, notification-service',
    purpose: 'Payment success/failure reconciliation',
  },
  {
    family: 'payment.refund.*',
    producer: 'payment-service',
    consumers: 'notification-service',
    purpose: 'Provider refund result fanout',
  },
  {
    family: 'partner.request.*',
    producer: 'auth-service',
    consumers: 'notification-service',
    purpose: 'Partner upgrade request realtime updates',
  },
  {
    family: 'product.review.*',
    producer: 'inventory-service',
    consumers: 'notification-service',
    purpose: 'Review and comment deep-link notifications',
  },
]

const INTERNAL_PATHS = [
  {
    source: 'Order',
    target: 'Inventory',
    operation: 'reserve / release / confirm-deduct',
    contract: '/internal/v1/inventories/*',
  },
  {
    source: 'Order',
    target: 'Payment',
    operation: 'intent / confirm / fail',
    contract: '/internal/v1/payments/*',
  },
  {
    source: 'Notification',
    target: 'Order',
    operation: 'order products lookup',
    contract: '/internal/v1/orders/{orderCode}/products',
  },
  {
    source: 'Notification',
    target: 'Inventory',
    operation: 'product owners lookup',
    contract: '/internal/v1/inventories/product-owners',
  },
]

function normalizeHealthStatus(status?: string): ProbeStatus {
  const normalized = (status || '').trim().toUpperCase()
  if (normalized === 'UP') {
    return 'UP'
  }
  if (normalized === 'DOWN' || normalized === 'OUT_OF_SERVICE') {
    return 'DOWN'
  }
  return 'UNKNOWN'
}

function collectComponents(
  response?: HealthResponse,
  prefix = '',
): Array<{ name: string; status: ProbeStatus }> {
  if (!response?.components) {
    return []
  }

  return Object.entries(response.components).flatMap(([name, component]) => {
    const componentName = prefix ? `${prefix}.${name}` : name
    return [
      { name: componentName, status: normalizeHealthStatus(component.status) },
      ...collectComponents(component, componentName),
    ]
  })
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

function formatDuration(value: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }
  return `${Math.round(value)}ms`
}

function resolveSignalState(statuses: ProbeStatus[], hasDirectMetric: boolean): SignalState {
  if (statuses.some((status) => status === 'DOWN')) {
    return 'watch'
  }
  if (hasDirectMetric && statuses.some((status) => status === 'UP')) {
    return 'healthy'
  }
  return 'pending'
}

function countComponents(services: ServiceHealth[], keyword: string, status: ProbeStatus) {
  const normalizedKeyword = keyword.toLowerCase()
  return services.reduce(
    (sum, service) =>
      sum +
      service.components.filter(
        (component) =>
          component.name.toLowerCase().includes(normalizedKeyword) &&
          component.status === status,
      ).length,
    0,
  )
}

function getServiceStatus(services: ServiceHealth[], key: ServiceKey): ProbeStatus {
  return services.find((service) => service.key === key)?.status || 'UNKNOWN'
}

function StatusPill({ status }: { status: ProbeStatus | SignalState }) {
  return <span className={`admin-monitoring-status admin-monitoring-status-${status.toLowerCase()}`}>{status}</span>
}

function AdminMonitoringPage() {
  const { language, t } = useI18n()
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'

  const [services, setServices] = useState<ServiceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')
  const [refreshSeconds, setRefreshSeconds] = useState(30)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const results = await Promise.all(
        SERVICE_PROBES.map(async (probe) => {
          const startedAt = performance.now()
          try {
            const response = await apis().get<HealthResponse>(probe.endpoint, {
              timeout: 6000,
            })
            const durationMs = performance.now() - startedAt
            const payload = response.data || {}

            return {
              ...probe,
              status: normalizeHealthStatus(payload.status),
              durationMs,
              checkedAt: new Date().toISOString(),
              components: collectComponents(payload),
            } satisfies ServiceHealth
          } catch (err) {
            return {
              ...probe,
              status: 'DOWN',
              durationMs: performance.now() - startedAt,
              checkedAt: new Date().toISOString(),
              error: extractApiErrorMessage(err, 'Health probe failed'),
              components: [],
            } satisfies ServiceHealth
          }
        }),
      )

      setServices(results)
      setLastUpdatedAt(new Date().toISOString())
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Unable to load monitoring data.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  useEffect(() => {
    if (!refreshSeconds) {
      return
    }

    const interval = window.setInterval(() => {
      void loadHealth()
    }, refreshSeconds * 1000)

    return () => window.clearInterval(interval)
  }, [loadHealth, refreshSeconds])

  const summary = useMemo<{
    up: number
    down: number
    unknown: number
    avgLatency: number
    overall: SignalState
  }>(() => {
    const up = services.filter((service) => service.status === 'UP').length
    const down = services.filter((service) => service.status === 'DOWN').length
    const unknown = services.filter((service) => service.status === 'UNKNOWN').length
    const avgLatency =
      services.length > 0
        ? services.reduce((sum, service) => sum + (service.durationMs || 0), 0) / services.length
        : 0

    return {
      up,
      down,
      unknown,
      avgLatency,
      overall: down > 0 ? 'watch' : up === SERVICE_PROBES.length ? 'healthy' : 'pending',
    }
  }, [services])

  const signalCards = useMemo<Array<{
    title: string
    value: string
    state: SignalState
    detail: string
  }>>(() => {
    const redisUp = countComponents(services, 'redis', 'UP')
    const redisDown = countComponents(services, 'redis', 'DOWN')
    const kafkaUp = countComponents(services, 'kafka', 'UP')
    const kafkaDown = countComponents(services, 'kafka', 'DOWN')
    const dbUp = countComponents(services, 'db', 'UP') + countComponents(services, 'postgres', 'UP')
    const dbDown = countComponents(services, 'db', 'DOWN') + countComponents(services, 'postgres', 'DOWN')
    const gatewayStatus = getServiceStatus(services, 'gateway')
    const notificationStatus = getServiceStatus(services, 'notification')
    const orderStatus = getServiceStatus(services, 'order')
    const inventoryStatus = getServiceStatus(services, 'inventory')
    const paymentStatus = getServiceStatus(services, 'payment')

    return [
      {
        title: 'Runtime / JVM',
        value: `${summary.up}/${SERVICE_PROBES.length} services up`,
        state: summary.overall,
        detail: 'CPU, heap, GC, thread and container memory need Prometheus + cAdvisor for live charts.',
      },
      {
        title: 'Redis cache + locks',
        value: redisUp || redisDown ? `${redisUp} UP / ${redisDown} DOWN components` : 'Exporter pending',
        state: resolveSignalState(
          redisDown ? ['DOWN'] : redisUp ? ['UP'] : ['UNKNOWN'],
          Boolean(redisUp || redisDown),
        ),
        detail: 'Inventory cache and payment idempotency locks should expose hit/miss, memory, evictions and TTL churn.',
      },
      {
        title: 'Kafka event bus',
        value: kafkaUp || kafkaDown ? `${kafkaUp} UP / ${kafkaDown} DOWN components` : 'Kafka UI available on :8088',
        state: resolveSignalState(
          kafkaDown ? ['DOWN'] : kafkaUp ? ['UP'] : ['UNKNOWN'],
          Boolean(kafkaUp || kafkaDown),
        ),
        detail: 'Topic throughput, publish failures and consumer lag should come from Kafka exporter/JMX.',
      },
      {
        title: 'PostgreSQL ownership',
        value: dbUp || dbDown ? `${dbUp} UP / ${dbDown} DOWN components` : 'Actuator detail hidden',
        state: resolveSignalState(dbDown ? ['DOWN'] : dbUp ? ['UP'] : ['UNKNOWN'], Boolean(dbUp || dbDown)),
        detail: 'Each service owns a schema; DB pool, query latency and connection saturation belong on this panel.',
      },
      {
        title: 'Internal JSON RPC',
        value: [orderStatus, inventoryStatus, paymentStatus].every((status) => status === 'UP')
          ? 'Core path reachable'
          : 'Check dependencies',
        state: [orderStatus, inventoryStatus, paymentStatus].some((status) => status === 'DOWN') ? 'watch' : 'pending',
        detail: 'Order -> Inventory/Payment and Notification -> Order/Inventory need server-side probes for response payload and timeout rates.',
      },
      {
        title: 'gRPC / SSE realtime',
        value: gatewayStatus === 'UP' && notificationStatus === 'UP' ? 'Bridge services up' : 'Bridge degraded',
        state: gatewayStatus === 'UP' && notificationStatus === 'UP' ? 'pending' : 'watch',
        detail: 'Active SSE connections, gRPC streams and HTTP/2 stream-per-connection counts require gateway/Netty custom metrics.',
      },
    ]
  }, [services, summary.overall, summary.up])

  return (
    <section className="admin-monitoring-page role-page-stack">
      <article className="role-card admin-monitoring-hero">
        <div>
          <p className="admin-monitoring-eyebrow">
            {t('adminMonitoring.eyebrow', 'Admin Operations')}
          </p>
          <h2>{t('adminMonitoring.title', 'System Monitoring')}</h2>
          <p className="role-muted">
            {t(
              'adminMonitoring.subtitle',
              'Runtime visibility for service health, Redis, Kafka, internal APIs, and realtime delivery.',
            )}
          </p>
        </div>

        <div className="admin-monitoring-actions">
          <label>
            {t('adminMonitoring.refresh', 'Auto refresh')}
            <select
              value={refreshSeconds}
              onChange={(event) => setRefreshSeconds(Number(event.target.value))}
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? `${option}s` : t('adminMonitoring.off', 'Off')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => void loadHealth()}
            disabled={loading}
          >
            {loading
              ? t('adminMonitoring.refreshing', 'Refreshing...')
              : t('adminMonitoring.refreshNow', 'Refresh now')}
          </button>
        </div>
      </article>

      <article className="role-card">
        <div className="admin-monitoring-summary-grid">
          <div className="role-metric-card admin-monitoring-overall-card">
            <span>{t('adminMonitoring.metrics.overall', 'Overall status')}</span>
            <strong>{summary.overall === 'healthy' ? 'Healthy' : summary.overall === 'watch' ? 'Watch' : 'Pending'}</strong>
            <StatusPill status={summary.overall} />
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.servicesUp', 'Services up')}</span>
            <strong>{summary.up}/{SERVICE_PROBES.length}</strong>
            <small>{summary.down} down, {summary.unknown} unknown</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.avgProbe', 'Average probe')}</span>
            <strong>{formatDuration(summary.avgLatency)}</strong>
            <small>{t('adminMonitoring.metrics.fromGateway', 'Measured from browser to gateway')}</small>
          </div>
          <div className="role-metric-card">
            <span>{t('adminMonitoring.metrics.lastUpdated', 'Last updated')}</span>
            <strong>{formatDateTime(lastUpdatedAt, locale)}</strong>
            <small>{refreshSeconds ? `${refreshSeconds}s refresh` : 'manual refresh'}</small>
          </div>
        </div>
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <div className="admin-monitoring-section-header">
          <div>
            <h3>{t('adminMonitoring.services.title', 'Service health')}</h3>
            <p className="role-muted">
              {t('adminMonitoring.services.subtitle', 'Actuator health routed through API Gateway.')}
            </p>
          </div>
        </div>

        <div className="admin-monitoring-service-grid">
          {services.map((service) => (
            <section key={service.key} className="admin-monitoring-service-card">
              <header>
                <div>
                  <h4>{service.name}</h4>
                  <span>{service.role}</span>
                </div>
                <StatusPill status={service.status} />
              </header>
              <dl>
                <div>
                  <dt>Port</dt>
                  <dd>{service.port}</dd>
                </div>
                <div>
                  <dt>Probe</dt>
                  <dd>{formatDuration(service.durationMs)}</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd>{service.runtime}</dd>
                </div>
              </dl>
              <p className="admin-monitoring-contract">{service.endpoint}</p>
              <div className="admin-monitoring-chip-row">
                {service.dependencies.map((dependency) => (
                  <span key={dependency}>{dependency}</span>
                ))}
              </div>
              {service.components.length > 0 && (
                <div className="admin-monitoring-component-row">
                  {service.components.slice(0, 5).map((component) => (
                    <span key={component.name} className={`admin-monitoring-component-${component.status.toLowerCase()}`}>
                      {component.name}: {component.status}
                    </span>
                  ))}
                </div>
              )}
              {service.error && <p className="role-error">{service.error}</p>}
            </section>
          ))}
        </div>
      </article>

      <article className="role-card">
        <div className="admin-monitoring-section-header">
          <div>
            <h3>{t('adminMonitoring.signals.title', 'Monitoring signals')}</h3>
            <p className="role-muted">
              {t('adminMonitoring.signals.subtitle', 'Operational panels ready for Prometheus/exporter metrics.')}
            </p>
          </div>
        </div>

        <div className="admin-monitoring-signal-grid">
          {signalCards.map((signal) => (
            <section key={signal.title} className="admin-monitoring-signal-card">
              <header>
                <h4>{signal.title}</h4>
                <StatusPill status={signal.state} />
              </header>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </section>
          ))}
        </div>
      </article>

      <div className="admin-monitoring-two-column">
        <article className="role-card">
          <div className="admin-monitoring-section-header">
            <div>
              <h3>{t('adminMonitoring.kafka.title', 'Kafka topic map')}</h3>
              <p className="role-muted">
                {t('adminMonitoring.kafka.subtitle', 'Producer, consumer and event family coverage.')}
              </p>
            </div>
          </div>

          <div className="admin-monitoring-table-wrap">
            <table className="admin-monitoring-table">
              <thead>
                <tr>
                  <th>Topic family</th>
                  <th>Producer</th>
                  <th>Consumers</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {TOPIC_GROUPS.map((topic) => (
                  <tr key={topic.family}>
                    <td><code>{topic.family}</code></td>
                    <td>{topic.producer}</td>
                    <td>{topic.consumers}</td>
                    <td>{topic.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="role-card">
          <div className="admin-monitoring-section-header">
            <div>
              <h3>{t('adminMonitoring.internal.title', 'Internal API paths')}</h3>
              <p className="role-muted">
                {t('adminMonitoring.internal.subtitle', 'Synchronous service-to-service contracts.')}
              </p>
            </div>
          </div>

          <div className="admin-monitoring-internal-list">
            {INTERNAL_PATHS.map((path) => (
              <section key={`${path.source}-${path.target}-${path.operation}`}>
                <header>
                  <strong>{path.source} {'->'} {path.target}</strong>
                  <span>X-Internal-Token</span>
                </header>
                <p>{path.operation}</p>
                <code>{path.contract}</code>
              </section>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

export default AdminMonitoringPage
