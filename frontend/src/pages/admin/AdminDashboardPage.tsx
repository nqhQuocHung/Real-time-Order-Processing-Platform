import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../config/apis'

type OrderSummary = {
  totalAmount: number
  currency: string
  status: string
}

type OrderListResponse = {
  content: OrderSummary[]
  totalElements: number
}

type NotificationSummary = {
  status: string
}

type NotificationListResponse = {
  content: NotificationSummary[]
  totalElements: number
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency || 'VND',
  }).format(value || 0)
}

function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalNotifications, setTotalNotifications] = useState(0)

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const [ordersResponse, notificationsResponse] = await Promise.all([
          apis().get(endpoints.orders.list, { params: { page: 0, size: 50 } }),
          apis().get(endpoints.notifications.list, {
            params: { page: 0, size: 50 },
          }),
        ])

        const orderData = extractApiData<OrderListResponse>(ordersResponse)
        const notificationData =
          extractApiData<NotificationListResponse>(notificationsResponse)

        setOrders(orderData.content || [])
        setTotalOrders(orderData.totalElements || 0)
        setTotalNotifications(notificationData.totalElements || 0)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được Admin Dashboard.'))
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  const paidOrders = useMemo(
    () => orders.filter((item) => item.status === 'PAID').length,
    [orders],
  )

  if (loading) {
    return <p className="role-muted">Đang tải Admin Dashboard...</p>
  }

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Admin Dashboard</h2>
        <p className="role-muted">
          Thống kê nhanh toàn hệ thống (dựa trên API hiện có).
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Tổng user</span>
            <strong>N/A</strong>
            <small>Chưa có endpoint danh sách user.</small>
          </div>
          <div className="role-metric-card">
            <span>Tổng partner</span>
            <strong>N/A</strong>
            <small>Chưa có endpoint danh sách partner.</small>
          </div>
          <div className="role-metric-card">
            <span>Tổng đơn hàng</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng doanh thu (sample)</span>
            <strong>{formatMoney(totalRevenue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Đơn hàng đã thanh toán</span>
            <strong>{paidOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng notification</span>
            <strong>{totalNotifications}</strong>
          </div>
        </div>
      </article>
    </section>
  )
}

export default AdminDashboardPage
