import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../config/apis'

type OrderSummary = {
  status: string
  totalAmount: number
}

type OrderListResponse = {
  content: OrderSummary[]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value || 0)
}

function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await apis().get(endpoints.orders.list, {
          params: { page: 0, size: 100 },
        })
        const data = extractApiData<OrderListResponse>(response)
        setOrders(data.content || [])
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được dữ liệu báo cáo.'))
      }
    }

    void loadOrders()
  }, [])

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const order of orders) {
      stats[order.status] = (stats[order.status] || 0) + 1
    }
    return stats
  }, [orders])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Báo cáo</h2>
        <p className="role-muted">
          Báo cáo nhanh theo dữ liệu đơn hàng hiện tại. Có thể mở rộng biểu đồ khi bổ sung
          endpoint thống kê chuyên dụng.
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Tổng doanh thu</span>
            <strong>{formatMoney(totalRevenue)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng bản ghi đơn đang tính</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Phân bổ trạng thái đơn hàng</h3>
        <ul className="role-list">
          {Object.entries(statusStats).map(([status, count]) => (
            <li key={status}>
              {status}: {count}
            </li>
          ))}
          {!Object.keys(statusStats).length && <li>Chưa có dữ liệu.</li>}
        </ul>
      </article>
    </section>
  )
}

export default AdminReportsPage
