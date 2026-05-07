import { useEffect, useMemo, useState } from 'react'
import { fetchMyProfile } from '../../auth/authSession'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../config/apis'

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  createdAt?: string
}

type OrderListResponse = {
  content: OrderSummary[]
  totalElements: number
}

type UserProfile = {
  firstName?: string
  lastName?: string
  username: string
  email: string
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency || 'VND',
  }).format(value || 0)
}

function UserDashboardPage() {
  const session = getAuthSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      if (!session?.userId) {
        setError('Không tìm thấy thông tin user hiện tại.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const [profileData, ordersResponse] = await Promise.all([
          fetchMyProfile(),
          apis().get(endpoints.orders.list, {
            params: {
              customerId: session.userId,
              page: 0,
              size: 5,
            },
          }),
        ])

        const orderData = extractApiData<OrderListResponse>(ordersResponse)
        setProfile(profileData)
        setOrders(orderData.content || [])
        setTotalOrders(orderData.totalElements || 0)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được dữ liệu dashboard user.'))
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [session?.userId])

  const recentTotal = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  if (loading) {
    return <p className="role-muted">Đang tải User Dashboard...</p>
  }

  return (
    <section className="role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card">
        <h2>User Dashboard</h2>
        <p className="role-muted">
          Xin chào {profile?.firstName || profile?.username || session?.username}. Đây là
          tổng quan dữ liệu cá nhân của bạn.
        </p>
        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Tổng đơn hàng</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng giá trị đơn gần đây</span>
            <strong>{formatMoney(recentTotal, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Email</span>
            <strong>{profile?.email || '-'}</strong>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Đơn hàng gần đây</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Trạng thái</th>
                <th>Tổng tiền</th>
                <th>Thời gian tạo</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderCode}>
                  <td>{order.orderCode}</td>
                  <td>{order.status}</td>
                  <td>{formatMoney(order.totalAmount, order.currency)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={4} className="role-empty-cell">
                    Chưa có đơn hàng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default UserDashboardPage
