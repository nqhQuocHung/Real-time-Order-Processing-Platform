import { useEffect, useMemo, useState } from 'react'
import { fetchMyProfile } from '../../../auth/authSession'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './UserDashboardPage.css'

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

  return new Date(value).toLocaleString('en-US')
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
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
        setError('Cannot find current user information.')
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
        setError(extractApiErrorMessage(err, 'Cannot load user dashboard data.'))
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
    return <p className="role-muted">Loading User Dashboard...</p>
  }

  return (
    <section className="user-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card">
        <h2>User Dashboard</h2>
        <p className="role-muted">
          Hello {profile?.firstName || profile?.username || session?.username}. Here is
          an overview of your personal data.
        </p>
        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Total Orders</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Recent Order Value</span>
            <strong>{formatMoney(recentTotal, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Email</span>
            <strong>{profile?.email || '-'}</strong>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Recent Orders</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Created At</th>
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
                    No orders yet.
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
