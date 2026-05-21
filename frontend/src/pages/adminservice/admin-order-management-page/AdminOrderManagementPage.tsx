import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import { ORDER_STATUSES } from '../../../constants/orderStatus'
import './AdminOrderManagementPage.css'

const orderStatuses = ORDER_STATUSES

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  createdAt?: string
}

type OrderListResponse = {
  content: OrderSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function buildPaginationPages(currentPage: number, totalPages: number, maxButtons = 5): number[] {
  if (totalPages <= 0) {
    return []
  }

  const half = Math.floor(maxButtons / 2)
  let start = Math.max(0, currentPage - half)
  let end = Math.min(totalPages - 1, start + maxButtons - 1)

  if (end - start + 1 < maxButtons) {
    start = Math.max(0, end - maxButtons + 1)
  }

  const pages: number[] = []
  for (let i = start; i <= end; i += 1) {
    pages.push(i)
  }

  return pages
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
  const [totalOrdersResult, setTotalOrdersResult] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [selectedOrderCode, setSelectedOrderCode] = useState('')
  const [targetStatus, setTargetStatus] = useState(orderStatuses[0])
  const [actor, setActor] = useState('admin-console')
  const [note, setNote] = useState('')
  const pageSize = 12

  async function loadOrders(targetPage = page) {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.orders.list, {
        params: {
          page: targetPage,
          size: pageSize,
        },
      })
      const data = extractApiData<OrderListResponse>(response)
      setOrders(data.content || [])
      const safeTotalElements = typeof data.totalElements === 'number' ? data.totalElements : 0
      const fallbackTotalPages = safeTotalElements > 0 ? Math.ceil(safeTotalElements / pageSize) : 0
      const safeTotalPages = typeof data.totalPages === 'number' ? data.totalPages : fallbackTotalPages
      const safePage = typeof data.page === 'number' ? data.page : targetPage
      setTotalOrdersResult(safeTotalElements)
      setTotalPages(Math.max(0, safeTotalPages))
      setPage(Math.max(0, safePage))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không tải được danh sách đơn hàng.'))
      setOrders([])
      setTotalOrdersResult(0)
      setTotalPages(0)
      setPage(0)
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
      await loadOrders(page)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveTotalPages = useMemo(() => {
    if (totalPages > 0) {
      return totalPages
    }
    if (totalOrdersResult > 0) {
      return Math.ceil(totalOrdersResult / pageSize)
    }
    return 0
  }, [pageSize, totalOrdersResult, totalPages])

  const paginationPages = useMemo(
    () => buildPaginationPages(page, effectiveTotalPages),
    [effectiveTotalPages, page],
  )

  const hasPreviousPage = page > 0
  const hasNextPage = effectiveTotalPages > 0 && page < effectiveTotalPages - 1
  const currentPageStart = totalOrdersResult === 0 ? 0 : page * pageSize + 1
  const currentPageEnd = totalOrdersResult === 0
    ? 0
    : Math.min((page + 1) * pageSize, totalOrdersResult)

  async function handleGoToPage(targetPage: number) {
    if (loading) {
      return
    }
    if (targetPage < 0 || targetPage >= effectiveTotalPages || targetPage === page) {
      return
    }
    await loadOrders(targetPage)
  }

  return (
    <section className="admin-order-management-page role-page-stack">
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
          <button type="button" className="role-btn-ghost" onClick={() => void loadOrders(page)}>
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

        <div className="admin-order-management-pagination">
          <p className="admin-order-management-pagination-summary">
            Showing {currentPageStart}-{currentPageEnd} of {totalOrdersResult}
          </p>

          <div className="admin-order-management-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-order-management-page-btn"
              onClick={() => void handleGoToPage(page - 1)}
              disabled={!hasPreviousPage || loading}
            >
              Previous
            </button>

            {paginationPages.map((pageNumber) => (
              <button
                key={`order-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-order-management-page-btn ${pageNumber === page ? 'is-active' : ''}`}
                onClick={() => void handleGoToPage(pageNumber)}
                disabled={loading}
              >
                {pageNumber + 1}
              </button>
            ))}

            <button
              type="button"
              className="role-btn-ghost admin-order-management-page-btn"
              onClick={() => void handleGoToPage(page + 1)}
              disabled={!hasNextPage || loading}
            >
              Next
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

export default AdminOrderManagementPage
