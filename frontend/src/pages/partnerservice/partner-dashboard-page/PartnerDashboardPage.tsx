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
  }).format(value || 0)
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
    () => products.filter((item) => (item.status || '').trim().toUpperCase() === 'ACTIVE').length,
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
      { label: 'Available', value: totalAvailableStock },
      { label: 'Reserved', value: totalReservedStock },
      { label: 'Paid Units', value: totalPaidUnits },
    ],
    [totalAvailableStock, totalReservedStock, totalPaidUnits],
  )

  const maxStockChartValue = useMemo(
    () => Math.max(1, ...stockChartItems.map((item) => item.value)),
    [stockChartItems],
  )

  const topSellingProducts = useMemo(() => {
    return [...products]
      .sort((first, second) => normalizePaidQuantity(second) - normalizePaidQuantity(first))
      .slice(0, 6)
      .map((item) => ({
        label: item.name?.trim() || item.productName?.trim() || item.productId,
        value: normalizePaidQuantity(item),
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

  if (loading) {
    return <p className="role-muted">Loading Partner Dashboard...</p>
  }

  return (
    <section className="partner-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card">
        <h2>Partner Dashboard</h2>
        <p className="role-muted">
          Data is scoped by shop from <code>/api/v1/inventories/my-products</code> to avoid
          cross-shop overlap.
        </p>
        <p className="partner-dashboard-scope">
          Current shop scope: <strong>{scopedShopName}</strong>
        </p>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-ghost" onClick={() => void loadPartnerData()}>
            Refresh Dashboard
          </button>
        </div>

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Total Products</span>
            <strong>{totalProducts}</strong>
          </div>
          <div className="role-metric-card">
            <span>Active Products</span>
            <strong>{activeProducts}</strong>
          </div>
          <div className="role-metric-card">
            <span>Paid Units</span>
            <strong>{totalPaidUnits}</strong>
          </div>
          <div className="role-metric-card">
            <span>Estimated Revenue</span>
            <strong>{formatMoney(estimatedRevenue, 'VND')}</strong>
            <small>Computed as paid units x price.</small>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Stock Overview</h3>
        <div className="partner-dashboard-chart">
          {stockChartItems.map((item) => {
            const widthPercent = Math.round((item.value / maxStockChartValue) * 100)
            return (
              <div className="partner-dashboard-chart-row" key={item.label}>
                <span>{item.label}</span>
                <div className="partner-dashboard-chart-track">
                  <div
                    className="partner-dashboard-chart-bar"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
                <strong>{item.value}</strong>
              </div>
            )
          })}
        </div>
      </article>

      <article className="role-card">
        <h3>Top Selling Products</h3>
        {!topSellingProducts.length && <p className="role-muted">No sales data yet.</p>}
        {!!topSellingProducts.length && (
          <div className="partner-dashboard-chart">
            {topSellingProducts.map((item) => {
              const widthPercent = Math.round((item.value / maxTopSellingValue) * 100)
              return (
                <div className="partner-dashboard-chart-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="partner-dashboard-chart-track">
                    <div
                      className="partner-dashboard-chart-bar is-alt"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <strong>{item.value}</strong>
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
