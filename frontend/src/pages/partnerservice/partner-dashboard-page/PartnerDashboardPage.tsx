import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './PartnerDashboardPage.css'

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
}

type OrderListResponse = {
  content: OrderSummary[]
  totalElements: number
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value || 0)
}

function PartnerDashboardPage() {
  const session = getAuthSession()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPartnerData() {
      if (!session?.userId) {
        setError('Cannot find partner ID from session.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apis().get(endpoints.orders.list, {
          params: {
            customerId: session.userId,
            page: 0,
            size: 20,
          },
        })
        const data = extractApiData<OrderListResponse>(response)
        setOrders(data.content || [])
        setTotalOrders(data.totalElements || 0)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Cannot load Partner Dashboard.'))
      } finally {
        setLoading(false)
      }
    }

    void loadPartnerData()
  }, [session?.userId])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  const newOrders = useMemo(
    () => orders.filter((item) => item.status === 'CREATED').length,
    [orders],
  )

  if (loading) {
    return <p className="role-muted">Loading Partner Dashboard...</p>
  }

  return (
    <section className="partner-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card">
        <h2>Partner Dashboard</h2>
        <p className="role-muted">
          Data is displayed within the current partner scope (based on logged-in userId).
        </p>
        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Total Shopee Orders</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>New Orders</span>
            <strong>{newOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Doanh thu</span>
            <strong>{formatMoney(totalRevenue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Inventory</span>
            <strong>N/A</strong>
            <small>Use the Inventory page to look up by productId.</small>
          </div>
        </div>
      </article>
    </section>
  )
}

export default PartnerDashboardPage
