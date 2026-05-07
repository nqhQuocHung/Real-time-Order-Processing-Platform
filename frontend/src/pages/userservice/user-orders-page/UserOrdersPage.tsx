import { useEffect, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './UserOrdersPage.css'

const orderStatuses = ['', 'CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED']

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

function UserOrdersPage() {
  const session = getAuthSession()

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadOrders() {
    if (!session?.userId) {
      setError('Cannot find user ID to load orders.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.orders.list, {
        params: {
          customerId: session.userId,
          status: statusFilter || undefined,
          page: 0,
          size: 20,
        },
      })
      const data = extractApiData<OrderListResponse>(response)
      setOrders(data.content || [])
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load order list.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [])

  return (
    <section className="user-orders-page role-page-stack">
      <article className="role-card">
        <h2>My Orders</h2>
        <p className="role-muted">
          View orders for the current account and filter by status.
        </p>

        <div className="role-inline-form">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {orderStatuses.map((status) => (
                <option key={status || 'ALL'} value={status}>
                  {status || 'All'}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="role-btn-primary" onClick={() => void loadOrders()}>
            {loading ? 'Loading...' : 'Filter Orders'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
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
                    No orders found.
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

export default UserOrdersPage
