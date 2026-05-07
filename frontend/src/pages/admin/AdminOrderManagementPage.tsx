import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../config/apis'

const orderStatuses = [
  'CREATED',
  'RESERVED',
  'PAID',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]

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
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency || 'VND',
  }).format(value || 0)
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

function AdminOrderManagementPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedOrderCode, setSelectedOrderCode] = useState('')
  const [targetStatus, setTargetStatus] = useState(orderStatuses[0])
  const [actor, setActor] = useState('admin-console')
  const [note, setNote] = useState('')

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.orders.list, {
        params: {
          page: 0,
          size: 20,
        },
      })
      const data = extractApiData<OrderListResponse>(response)
      setOrders(data.content || [])
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không tải được danh sách đơn hàng.'))
    } finally {
      setLoading(false)
    }
  }

  async function updateOrderStatus() {
    if (!selectedOrderCode.trim()) {
      toast.error('Vui lòng chọn order để cập nhật trạng thái.')
      return
    }

    try {
      setLoading(true)
      await apis().patch(endpoints.orders.updateStatus(selectedOrderCode), {
        status: targetStatus,
        actor: actor.trim() || undefined,
        note: note.trim() || undefined,
      })
      toast.success('Cập nhật trạng thái đơn hàng thành công.')
      await loadOrders()
    } catch (err) {
      toast.error(extractApiErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [])

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Quản lý đơn hàng</h2>
        <p className="role-muted">
          Admin có thể rà soát danh sách đơn và cập nhật trạng thái thủ công.
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-inline-form">
          <label>
            Order Code
            <input
              value={selectedOrderCode}
              onChange={(event) => setSelectedOrderCode(event.target.value)}
              placeholder="ORD-..."
            />
          </label>
          <label>
            Status
            <select
              value={targetStatus}
              onChange={(event) => setTargetStatus(event.target.value)}
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Actor
            <input value={actor} onChange={(event) => setActor(event.target.value)} />
          </label>
          <label>
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void updateOrderStatus()}>
            {loading ? 'Đang xử lý...' : 'Cập nhật trạng thái'}
          </button>
          <button type="button" className="role-btn-ghost" onClick={() => void loadOrders()}>
            Tải lại danh sách
          </button>
        </div>
      </article>

      <article className="role-card">
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
                <tr
                  key={order.orderCode}
                  className={selectedOrderCode === order.orderCode ? 'role-row-active' : ''}
                  onClick={() => {
                    setSelectedOrderCode(order.orderCode)
                    setTargetStatus(order.status)
                  }}
                >
                  <td>{order.orderCode}</td>
                  <td>{order.status}</td>
                  <td>{formatMoney(order.totalAmount, order.currency)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={4} className="role-empty-cell">
                    Không có dữ liệu đơn hàng.
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

export default AdminOrderManagementPage
