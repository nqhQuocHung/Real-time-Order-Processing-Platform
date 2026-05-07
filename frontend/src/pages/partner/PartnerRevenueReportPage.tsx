import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../config/apis'

type OrderSummary = {
  status: string
  totalAmount: number
  currency: string
}

type OrderListResponse = {
  content: OrderSummary[]
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
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
        setError('Không có userId trong session.')
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
        setError(extractApiErrorMessage(err, 'Không tải được báo cáo doanh thu.'))
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
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Báo cáo doanh thu</h2>
        <p className="role-muted">Báo cáo doanh thu theo đơn hàng của partner hiện tại.</p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Tổng doanh thu</span>
            <strong>{formatMoney(totalRevenue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Số đơn hoàn tất</span>
            <strong>{completedOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng số đơn đã tính</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </article>
    </section>
  )
}

export default PartnerRevenueReportPage
