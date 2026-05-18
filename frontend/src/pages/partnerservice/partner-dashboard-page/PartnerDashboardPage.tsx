import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './PartnerDashboardPage.css'

type NotificationStreamEventDetail = {
  eventName?: string
}

type PartnerProductStock = {
  productId: string
  shopId?: string | null
  shopName?: string | null
  name?: string | null
  productName?: string | null
  status?: string | null
  categoryName?: string | null
  price?: number | null
  availableQuantity?: number | null
  reservedQuantity?: number | null
  paidQuantity?: number | null
  soldQuantity?: number | null
}

const APP_NOTIFICATION_EVENT = 'app-notification-event'
const DASHBOARD_REFRESH_DEBOUNCE_MS = 700

function shouldRefreshPartnerDashboard(eventName: string): boolean {
  if (!eventName || eventName === 'connected') {
    return false
  }

  return (
    eventName.startsWith('order.lifecycle.') ||
    eventName.startsWith('payment.transaction.')
  )
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value || 0)))
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function normalizePaidQuantity(item: PartnerProductStock): number {
  return normalizeQuantity(item.paidQuantity ?? item.soldQuantity)
}

function normalizePrice(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Math.max(0, Number(value)) : 0
}

function normalizeStatus(value?: string | null): string {
  return value?.trim().toUpperCase() || 'UNKNOWN'
}

function resolveProductLabel(item: PartnerProductStock): string {
  return item.name?.trim() || item.productName?.trim() || item.productId
}

function PartnerDashboardPage() {
  const session = getAuthSession()
  const [products, setProducts] = useState<PartnerProductStock[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadPartnerData = useCallback(async (showLoading = true) => {
    if (!session?.userId) {
      setError('Cannot find partner ID from session.')
      setLoading(false)
      return
    }

    if (showLoading) {
      setLoading(true)
    }
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.myProducts)
      const data = extractApiData<PartnerProductStock[]>(response)
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load Partner Dashboard.'))
      setProducts([])
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [session?.userId])

  useEffect(() => {
    void loadPartnerData(true)
  }, [loadPartnerData])

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    function handleRealtimeEvent(event: Event) {
      const customEvent = event as CustomEvent<NotificationStreamEventDetail>
      const eventName = customEvent.detail?.eventName?.trim() || ''
      if (!shouldRefreshPartnerDashboard(eventName)) {
        return
      }

      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }
      debounceTimer = window.setTimeout(() => {
        void loadPartnerData(false)
      }, DASHBOARD_REFRESH_DEBOUNCE_MS)
    }

    window.addEventListener(APP_NOTIFICATION_EVENT, handleRealtimeEvent as EventListener)
    return () => {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleRealtimeEvent as EventListener)
    }
  }, [loadPartnerData])

  const totalProducts = useMemo(() => products.length, [products])

  const activeProducts = useMemo(
    () => products.filter((item) => normalizeStatus(item.status) === 'ACTIVE').length,
    [products],
  )

  const totalAvailableStock = useMemo(
    () => products.reduce((sum, item) => sum + normalizeQuantity(item.availableQuantity), 0),
    [products],
  )

  const totalReservedStock = useMemo(
    () => products.reduce((sum, item) => sum + normalizeQuantity(item.reservedQuantity), 0),
    [products],
  )

  const totalPaidUnits = useMemo(
    () => products.reduce((sum, item) => sum + normalizePaidQuantity(item), 0),
    [products],
  )

  const estimatedRevenue = useMemo(
    () =>
      products.reduce(
        (sum, item) => sum + normalizePaidQuantity(item) * normalizePrice(item.price),
        0,
      ),
    [products],
  )

  const stockChartItems = useMemo(
    () => [
      { label: 'Available', value: totalAvailableStock, tone: 'is-stock' },
      { label: 'Reserved', value: totalReservedStock, tone: 'is-reserved' },
      { label: 'Paid Units', value: totalPaidUnits, tone: 'is-paid' },
    ],
    [totalAvailableStock, totalReservedStock, totalPaidUnits],
  )

  const maxStockChartValue = useMemo(
    () => Math.max(1, ...stockChartItems.map((item) => item.value)),
    [stockChartItems],
  )

  const statusDistribution = useMemo(() => {
    const counter = new Map<string, number>()
    for (const item of products) {
      const key = normalizeStatus(item.status)
      counter.set(key, (counter.get(key) || 0) + 1)
    }

    return Array.from(counter.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 6)
  }, [products])

  const maxStatusValue = useMemo(
    () => Math.max(1, ...statusDistribution.map((item) => item.value)),
    [statusDistribution],
  )

  const topSellingProducts = useMemo(() => {
    return [...products]
      .sort((first, second) => normalizePaidQuantity(second) - normalizePaidQuantity(first))
      .slice(0, 6)
      .map((item) => ({
        label: resolveProductLabel(item),
        value: normalizePaidQuantity(item),
        status: normalizeStatus(item.status),
      }))
  }, [products])

  const maxTopSellingValue = useMemo(
    () => Math.max(1, ...topSellingProducts.map((item) => item.value)),
    [topSellingProducts],
  )

  const scopedShopName = useMemo(() => {
    const byShopName = products.find((item) => item.shopName?.trim())?.shopName?.trim()
    if (byShopName) {
      return byShopName
    }
    return products.find((item) => item.shopId?.trim())?.shopId?.trim() || session?.userId || '-'
  }, [products, session?.userId])

  const stockPressurePercent = useMemo(() => {
    const tracked = totalAvailableStock + totalReservedStock
    if (tracked <= 0) {
      return 0
    }
    return Math.round((totalReservedStock / tracked) * 100)
  }, [totalAvailableStock, totalReservedStock])

  const soldThroughputPercent = useMemo(() => {
    const tracked = totalAvailableStock + totalReservedStock + totalPaidUnits
    if (tracked <= 0) {
      return 0
    }
    return Math.round((totalPaidUnits / tracked) * 100)
  }, [totalAvailableStock, totalReservedStock, totalPaidUnits])

  const stockHealthTone =
    stockPressurePercent >= 65
      ? 'is-risk'
      : stockPressurePercent >= 40
        ? 'is-watch'
        : 'is-good'

  if (loading) {
    return (
      <section className="partner-dashboard-page role-page-stack">
        <article className="role-card partner-dashboard-loading">
          <p className="role-muted">Loading Partner Dashboard...</p>
        </article>
      </section>
    )
  }

  return (
    <section className="partner-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card partner-dashboard-hero">
        <div className="partner-dashboard-hero-main">
          <p className="partner-dashboard-overline">Partner Intelligence</p>
          <h2>Sales and Inventory Command Deck</h2>
          <p className="role-muted">
            Realtime snapshot for your shop inventory movement, sold units, and stock pressure.
          </p>
          <p className="partner-dashboard-scope">
            Current shop scope: <strong>{scopedShopName}</strong>
          </p>
        </div>

        <div className="partner-dashboard-hero-kpis">
          <div>
            <span>Stock Pressure</span>
            <strong>{stockPressurePercent}%</strong>
            <small>Reserved / (Reserved + Available)</small>
          </div>
          <div>
            <span>Sold Throughput</span>
            <strong>{soldThroughputPercent}%</strong>
            <small>Paid / (Available + Reserved + Paid)</small>
          </div>
          <div>
            <span>Live Revenue View</span>
            <strong>{formatMoney(estimatedRevenue, 'VND')}</strong>
            <small>Paid units x current price</small>
          </div>
        </div>

        <div className="role-inline-actions partner-dashboard-actions">
          <button type="button" className="role-btn-ghost" onClick={() => void loadPartnerData()}>
            Refresh Dashboard
          </button>
        </div>
      </article>

      <article className="role-card partner-dashboard-metrics-wrap">
        <div className="partner-dashboard-metric-grid">
          <div className="partner-dashboard-metric-card">
            <span>Total Products</span>
            <strong>{formatCount(totalProducts)}</strong>
          </div>
          <div className="partner-dashboard-metric-card">
            <span>Active Products</span>
            <strong>{formatCount(activeProducts)}</strong>
          </div>
          <div className="partner-dashboard-metric-card">
            <span>Available Units</span>
            <strong>{formatCount(totalAvailableStock)}</strong>
          </div>
          <div className="partner-dashboard-metric-card">
            <span>Reserved Units</span>
            <strong>{formatCount(totalReservedStock)}</strong>
          </div>
          <div className="partner-dashboard-metric-card">
            <span>Paid Units</span>
            <strong>{formatCount(totalPaidUnits)}</strong>
          </div>
        </div>
      </article>

      <div className="partner-dashboard-board">
        <article className="role-card partner-dashboard-surface">
          <h3>Stock Balance</h3>
          <div className={`partner-dashboard-health ${stockHealthTone}`}>
            <div className="partner-dashboard-health-track">
              <div
                className="partner-dashboard-health-fill"
                style={{ width: `${Math.min(100, Math.max(0, stockPressurePercent))}%` }}
              />
            </div>
            <small>
              Reserved pressure is <strong>{stockPressurePercent}%</strong>.
            </small>
          </div>

          <div className="partner-dashboard-chart">
            {stockChartItems.map((item) => {
              const widthPercent = Math.round((item.value / maxStockChartValue) * 100)
              return (
                <div className="partner-dashboard-chart-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="partner-dashboard-chart-track">
                    <div
                      className={`partner-dashboard-chart-bar ${item.tone}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <strong>{formatCount(item.value)}</strong>
                </div>
              )
            })}
          </div>
        </article>

        <article className="role-card partner-dashboard-surface">
          <h3>Status Distribution</h3>
          {!statusDistribution.length && <p className="role-muted">No status data available.</p>}
          {!!statusDistribution.length && (
            <div className="partner-dashboard-chart">
              {statusDistribution.map((item) => {
                const widthPercent = Math.round((item.value / maxStatusValue) * 100)
                return (
                  <div className="partner-dashboard-chart-row" key={item.label}>
                    <span>{item.label}</span>
                    <div className="partner-dashboard-chart-track">
                      <div
                        className="partner-dashboard-chart-bar is-status"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <strong>{formatCount(item.value)}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </div>

      <article className="role-card partner-dashboard-top-sales">
        <h3>Top Selling Products</h3>
        {!topSellingProducts.length && <p className="role-muted">No sales data yet.</p>}
        {!!topSellingProducts.length && (
          <div className="partner-dashboard-rank-list">
            {topSellingProducts.map((item, index) => {
              const widthPercent = Math.round((item.value / maxTopSellingValue) * 100)
              return (
                <div className="partner-dashboard-rank-row" key={`${item.label}-${index}`}>
                  <div className="partner-dashboard-rank-id">#{index + 1}</div>
                  <div className="partner-dashboard-rank-main">
                    <div className="partner-dashboard-rank-head">
                      <strong>{item.label}</strong>
                      <span className={`partner-dashboard-rank-status is-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="partner-dashboard-rank-track">
                      <div
                        className="partner-dashboard-rank-fill"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="partner-dashboard-rank-value">{formatCount(item.value)}</div>
                </div>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )
}

export default PartnerDashboardPage
