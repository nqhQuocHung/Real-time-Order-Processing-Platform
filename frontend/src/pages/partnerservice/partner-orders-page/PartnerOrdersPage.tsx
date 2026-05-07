import { useEffect, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import './PartnerOrdersPage.css'

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  createdAt?: string
}

type OrderListResponse = {
  content: OrderSummary[]
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'VND',
  }).format(value || 0)
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US')
}

function PartnerOrdersPage() {
  const session = getAuthSession()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadOrders() {
    if (!session?.userId) {
      setError('Cannot find partner ID from session.')
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
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load partner orders.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [])

  return (
    <section className="partner-orders-page role-page-stack">
      <article className="role-card">
        <h2>Shopee Orders</h2>
        <p className="role-muted">
          Order list within the current partner scope.
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void loadOrders()}>
            {loading ? 'Loading...' : 'Reload Orders'}
          </button>
        </div>
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

export default PartnerOrdersPage
