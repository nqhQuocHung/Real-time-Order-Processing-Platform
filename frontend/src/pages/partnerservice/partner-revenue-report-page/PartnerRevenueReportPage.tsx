import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './PartnerRevenueReportPage.css'

type OrderSummary = {
  status: string
  totalAmount: number
  currency: string
}

type OrderListResponse = {
  content: OrderSummary[]
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value || 0)
}

function PartnerRevenueReportPage() {
  const session = getAuthSession()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrders() {
      if (!session?.userId) {
        setError('No userId found in session.')
        return
      }

      try {
        const response = await apis().get(endpoints.orders.list, {
          params: {
            customerId: session.userId,
            page: 0,
            size: 100,
          },
        })
        const data = extractApiData<OrderListResponse>(response)
        setOrders(data.content || [])
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Cannot load revenue report.'))
      }
    }

    void loadOrders()
  }, [session?.userId])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  const completedOrders = useMemo(
    () => orders.filter((item) => item.status === 'COMPLETED').length,
    [orders],
  )

  return (
    <section className="partner-revenue-report-page role-page-stack">
      <article className="role-card">
        <h2>Revenue Report</h2>
        <p className="role-muted">Revenue report based on orders of the current partner.</p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Total Revenue</span>
            <strong>{formatMoney(totalRevenue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Completed Orders</span>
            <strong>{completedOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total Counted Orders</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </article>
    </section>
  )
}

export default PartnerRevenueReportPage
