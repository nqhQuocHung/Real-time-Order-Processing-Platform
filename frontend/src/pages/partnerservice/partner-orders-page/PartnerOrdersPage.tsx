import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import {
  ORDER_REFUND_STATUS_FILTER_OPTIONS,
  ORDER_STATUS_FILTER_OPTIONS,
  type OrderRefundStatus,
} from '../../../constants/orderStatus'
import './PartnerOrdersPage.css'

const ORDER_PAGE_SIZE_OPTIONS = [10, 20, 30]
const DEFAULT_ORDER_PAGE_SIZE = 10
const SOURCE_ORDER_FETCH_SIZE = 200
const REFUND_PAGE_SIZE_OPTIONS = [10, 20, 50]
const DEFAULT_REFUND_PAGE_SIZE = 10
const APP_NOTIFICATION_EVENT = 'app-notification-event'

type AppNotificationEventDetail = {
  eventName?: string
  payload?: unknown
}

type PartnerProductStock = {
  productId: string
  shopId?: string | null
  shopName?: string | null
}

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  paymentUrl?: string
  paymentDeadlineAt?: string
  createdAt?: string
  updatedAt?: string
}

type OrderListResponse = {
  content: OrderSummary[]
}

type OrderDetailResponse = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  paymentUrl?: string
  paymentDeadlineAt?: string
  createdAt?: string
  updatedAt?: string
  items: Array<{
    productId: string
  }>
}

type OrderRefundResponse = {
  refundId: string
  orderCode: string
  customerId: string
  refundAmount: number
  currency: string
  refundAccountName: string
  refundAccountNumberMasked?: string
  refundBankCode: string
  refundReason: string
  status: OrderRefundStatus
  sellerDecisionNote?: string
  sellerDecisionBy?: string
  providerRefundId?: string
  providerRefundUrl?: string
  providerNote?: string
  processedAt?: string
  createdAt?: string
  updatedAt?: string
}

type OrderRefundListResponse = {
  content: OrderRefundResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'VND',
  }).format(value || 0)
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('en-US')
}

function buildPaginationPages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 0) {
    return []
  }

  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, index) => index)
  }

  const candidatePages = [currentPage - 1, currentPage, currentPage + 1, totalPages - 1]
  return Array.from(new Set(candidatePages.filter((page) => page >= 0 && page < totalPages))).sort(
    (left, right) => left - right,
  )
}

function PartnerOrdersPage() {
  const session = getAuthSession()
  const [partnerProducts, setPartnerProducts] = useState<PartnerProductStock[]>([])
  const [sourceScopedOrders, setSourceScopedOrders] = useState<OrderSummary[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [orderPage, setOrderPage] = useState(0)
  const [orderPageSize, setOrderPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [loadingRefundList, setLoadingRefundList] = useState(false)
  const [processingOrderCode, setProcessingOrderCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refundByOrder, setRefundByOrder] = useState<Record<string, OrderRefundResponse | null>>({})
  const [refundRequests, setRefundRequests] = useState<OrderRefundResponse[]>([])
  const [refundRequestsTotal, setRefundRequestsTotal] = useState(0)
  const [refundTotalPages, setRefundTotalPages] = useState(0)
  const [refundPage, setRefundPage] = useState(0)
  const [refundPageSize, setRefundPageSize] = useState(DEFAULT_REFUND_PAGE_SIZE)
  const [refundStatusFilter, setRefundStatusFilter] = useState('')
  const [refundDialogOrderCode, setRefundDialogOrderCode] = useState('')
  const [refundDialogOrderDetail, setRefundDialogOrderDetail] = useState<OrderDetailResponse | null>(null)
  const [refundDecisionNote, setRefundDecisionNote] = useState('')
  const [loadingRefundInfo, setLoadingRefundInfo] = useState(false)

  const partnerProductsRef = useRef<PartnerProductStock[]>([])
  const detailCacheRef = useRef<Record<string, OrderDetailResponse>>({})
  const belongsCacheRef = useRef<Record<string, boolean>>({})

  const scopeLabel = useMemo(() => {
    const shopName = partnerProducts.find((item) => item.shopName?.trim())?.shopName?.trim()
    if (shopName) {
      return shopName
    }
    const shopId = partnerProducts.find((item) => item.shopId?.trim())?.shopId?.trim()
    if (shopId) {
      return shopId
    }
    return session?.userId || '-'
  }, [partnerProducts, session?.userId])

  const filteredOrders = useMemo(() => {
    const keyword = keywordFilter.trim().toUpperCase()
    if (!keyword) {
      return sourceScopedOrders
    }
    return sourceScopedOrders.filter((order) => order.orderCode.toUpperCase().includes(keyword))
  }, [keywordFilter, sourceScopedOrders])

  const totalOrdersResult = filteredOrders.length
  const totalOrderPages = useMemo(() => {
    if (!totalOrdersResult) {
      return 0
    }
    return Math.ceil(totalOrdersResult / orderPageSize)
  }, [orderPageSize, totalOrdersResult])

  useEffect(() => {
    if (totalOrderPages > 0 && orderPage >= totalOrderPages) {
      setOrderPage(totalOrderPages - 1)
      return
    }
    if (totalOrderPages === 0 && orderPage !== 0) {
      setOrderPage(0)
    }
  }, [orderPage, totalOrderPages])

  const pagedOrders = useMemo(() => {
    if (!filteredOrders.length) {
      return []
    }
    const start = orderPage * orderPageSize
    return filteredOrders.slice(start, start + orderPageSize)
  }, [filteredOrders, orderPage, orderPageSize])

  const orderPaginationPages = useMemo(
    () => buildPaginationPages(orderPage, totalOrderPages),
    [orderPage, totalOrderPages],
  )

  const currentOrderPageStart = totalOrdersResult === 0 ? 0 : orderPage * orderPageSize + 1
  const currentOrderPageEnd =
    totalOrdersResult === 0 ? 0 : Math.min((orderPage + 1) * orderPageSize, totalOrdersResult)
  const currentRefundPageStart = refundRequestsTotal === 0 ? 0 : refundPage * refundPageSize + 1
  const currentRefundPageEnd =
    refundRequestsTotal === 0
      ? 0
      : Math.min((refundPage + 1) * refundPageSize, refundRequestsTotal)
  const refundPaginationPages = useMemo(
    () => buildPaginationPages(refundPage, refundTotalPages),
    [refundPage, refundTotalPages],
  )
  const selectedRefund =
    refundDialogOrderCode && refundByOrder[refundDialogOrderCode]
      ? refundByOrder[refundDialogOrderCode]
      : null

  const loadPartnerProducts = useCallback(async () => {
    const response = await apis().get(endpoints.inventories.myProducts)
    const data = extractApiData<PartnerProductStock[]>(response)
    const resolved = Array.isArray(data) ? data : []
    partnerProductsRef.current = resolved
    setPartnerProducts(resolved)
    return resolved
  }, [])

  const getOrderDetail = useCallback(async (orderCode: string) => {
    const cached = detailCacheRef.current[orderCode]
    if (cached) {
      return cached
    }

    const response = await apis().get(endpoints.orders.detail(orderCode))
    const detail = extractApiData<OrderDetailResponse>(response)
    detailCacheRef.current[orderCode] = detail
    return detail
  }, [])

  const resolveBelongsToPartnerScope = useCallback(
    async (orderCode: string, productIds: Set<string>) => {
      const cached = belongsCacheRef.current[orderCode]
      if (typeof cached === 'boolean') {
        return cached
      }

      const detail = await getOrderDetail(orderCode)
      const belongs = Array.isArray(detail.items)
        ? detail.items.some((item) => productIds.has(item.productId))
        : false

      belongsCacheRef.current[orderCode] = belongs
      return belongs
    },
    [getOrderDetail],
  )

  const loadRefundDetail = useCallback(async (orderCode: string) => {
    const normalizedOrderCode = orderCode.trim()
    if (!normalizedOrderCode) {
      return null
    }

    const response = await apis().get(endpoints.orders.refundDetail(normalizedOrderCode))
    const data = extractApiData<OrderRefundResponse>(response)
    setRefundByOrder((previous) => ({
      ...previous,
      [normalizedOrderCode]: data || null,
    }))
    return data || null
  }, [])

  const loadRefundRequests = useCallback(async (page: number, size: number) => {
    setLoadingRefundList(true)
    try {
      const response = await apis().get(endpoints.orders.refundList, {
        params: {
          page,
          size,
          status: refundStatusFilter || undefined,
        },
      })
      const data = extractApiData<OrderRefundListResponse>(response)
      const content = Array.isArray(data.content) ? data.content : []
      const resolvedTotal = typeof data.totalElements === 'number' ? data.totalElements : content.length
      const resolvedTotalPages =
        typeof data.totalPages === 'number'
          ? data.totalPages
          : Math.ceil(resolvedTotal / Math.max(size, 1))

      setRefundRequests(content)
      setRefundRequestsTotal(resolvedTotal)
      setRefundTotalPages(resolvedTotalPages)

      if (resolvedTotalPages > 0 && page >= resolvedTotalPages) {
        setRefundPage(resolvedTotalPages - 1)
      } else if (resolvedTotalPages === 0 && page !== 0) {
        setRefundPage(0)
      }

      setRefundByOrder((previous) => {
        const next = { ...previous }
        content.forEach((refund) => {
          next[refund.orderCode] = refund
        })
        return next
      })
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load refund requests.'))
      setRefundRequests([])
      setRefundRequestsTotal(0)
      setRefundTotalPages(0)
    } finally {
      setLoadingRefundList(false)
    }
  }, [refundStatusFilter])

  const loadOrders = useCallback(
    async (productsOverride?: PartnerProductStock[]) => {
      if (!session?.userId) {
        setError('Cannot find partner ID from session.')
        return
      }

      const scopedProducts = productsOverride || partnerProductsRef.current
      const scopedProductIds = new Set(scopedProducts.map((item) => item.productId))

      setLoading(true)
      setError('')
      try {
        if (!scopedProductIds.size) {
          setSourceScopedOrders([])
          return
        }

        const response = await apis().get(endpoints.orders.list, {
          params: {
            status: statusFilter || undefined,
            page: 0,
            size: SOURCE_ORDER_FETCH_SIZE,
          },
        })
        const data = extractApiData<OrderListResponse>(response)
        const allOrders = Array.isArray(data.content) ? data.content : []

        const belongsFlags = await Promise.all(
          allOrders.map((order) => resolveBelongsToPartnerScope(order.orderCode, scopedProductIds)),
        )

        const scopedOrders = allOrders.filter((_, index) => belongsFlags[index])
        setSourceScopedOrders(scopedOrders)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Cannot load partner orders.'))
        setSourceScopedOrders([])
      } finally {
        setLoading(false)
      }
    },
    [resolveBelongsToPartnerScope, session?.userId, statusFilter],
  )

  useEffect(() => {
    async function initializePage() {
      if (!session?.userId) {
        setError('Cannot find partner ID from session.')
        return
      }

      try {
        const scopedProducts = await loadPartnerProducts()
        await loadOrders(scopedProducts)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Cannot initialize partner orders page.'))
      }
    }

    void initializePage()
  }, [loadOrders, loadPartnerProducts, loadRefundRequests, session?.userId])

  useEffect(() => {
    void loadRefundRequests(refundPage, refundPageSize)
  }, [loadRefundRequests, refundPage, refundPageSize])

  useEffect(() => {
    setOrderPage(0)
  }, [orderPageSize, keywordFilter, statusFilter])

  useEffect(() => {
    setRefundPage(0)
  }, [refundPageSize])

  useEffect(() => {
    setRefundPage(0)
  }, [refundStatusFilter])

  useEffect(() => {
    function handleNotificationEvent(event: Event) {
      const customEvent = event as CustomEvent<AppNotificationEventDetail>
      const eventName = (customEvent.detail?.eventName || '').trim()
      if (
        eventName !== 'order.refund.requested' &&
        eventName !== 'order.refund.approved' &&
        eventName !== 'order.refund.rejected' &&
        eventName !== 'order.refund.completed' &&
        eventName !== 'order.refund.failed' &&
        eventName !== 'payment.refund.succeeded' &&
        eventName !== 'payment.refund.failed'
      ) {
        return
      }

      void Promise.all([loadRefundRequests(refundPage, refundPageSize), loadOrders()])
    }

    window.addEventListener(APP_NOTIFICATION_EVENT, handleNotificationEvent as EventListener)
    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotificationEvent as EventListener)
    }
  }, [loadOrders, loadRefundRequests, refundPage, refundPageSize])

  async function handleRefreshOrders() {
    setSuccess('')
    const scopedProducts = await loadPartnerProducts()
    await Promise.all([loadOrders(scopedProducts), loadRefundRequests(refundPage, refundPageSize)])
  }

  function handleRefundStatusChange(status: string) {
    setRefundStatusFilter(status)
    setRefundPage(0)
  }

  async function handleApplyFilters() {
    setSuccess('')
    setKeywordFilter(keywordInput.trim())
    setOrderPage(0)
  }

  async function handleCancelOrder(orderCode: string) {
    setError('')
    setSuccess('')
    setProcessingOrderCode(orderCode)
    try {
      await apis().post(endpoints.orders.cancel(orderCode), {
        actor: 'SHOP_PARTNER',
        note: 'Cancelled by partner from Shopee Orders page',
      })
      setSuccess(`Order ${orderCode} cancelled successfully.`)
      await loadOrders()
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot cancel order ${orderCode}.`))
    } finally {
      setProcessingOrderCode('')
    }
  }

  async function openRefundDialog(orderCode: string) {
    setRefundDialogOrderCode(orderCode)
    setRefundDecisionNote('')
    setLoadingRefundInfo(true)
    setError('')

    try {
      const [_, detail] = await Promise.all([loadRefundDetail(orderCode), getOrderDetail(orderCode)])
      setRefundDialogOrderDetail(detail)
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot load refund request for ${orderCode}.`))
    } finally {
      setLoadingRefundInfo(false)
    }
  }

  function closeRefundDialog() {
    setRefundDialogOrderCode('')
    setRefundDialogOrderDetail(null)
    setRefundDecisionNote('')
    setLoadingRefundInfo(false)
  }

  async function handleRefundDecision(orderCode: string, decision: 'APPROVE' | 'REJECT') {
    setError('')
    setSuccess('')
    setProcessingOrderCode(orderCode)
    try {
      const response = await apis().post(endpoints.orders.refundDecision(orderCode), {
        decision,
        note: refundDecisionNote.trim() || undefined,
        actor: session?.userId || 'SHOP_PARTNER',
      })
      const refundResult = extractApiData<OrderRefundResponse>(response)
      setRefundByOrder((previous) => ({
        ...previous,
        [orderCode]: refundResult || null,
      }))
      setRefundRequests((previous) =>
        previous.map((refund) => (refund.orderCode === orderCode ? refundResult : refund)),
      )

      const decisionLabel = decision === 'APPROVE' ? 'approved' : 'rejected'
      if (decision === 'APPROVE' && refundResult?.providerRefundUrl) {
        window.open(refundResult.providerRefundUrl, '_blank', 'noopener,noreferrer')
      }

      setSuccess(
        decision === 'APPROVE' && refundResult?.providerRefundUrl
          ? `Refund request for order ${orderCode} was ${decisionLabel}. VNPay refund URL has been opened.`
          : `Refund request for order ${orderCode} was ${decisionLabel}.`,
      )
      closeRefundDialog()
      await Promise.all([loadOrders(), loadRefundRequests(refundPage, refundPageSize)])
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot process refund decision for order ${orderCode}.`))
    } finally {
      setProcessingOrderCode('')
    }
  }

  return (
    <section className="partner-orders-page role-page-stack">
      <article className="role-card">
        <h2>Shopee Orders</h2>
        <p className="role-muted">
          Orders are scoped to products in your shop. This prevents cross-shop overlap.
        </p>
        <p className="partner-orders-page-scope">
          Current shop scope: <strong>{scopeLabel}</strong>
        </p>

        <div className="role-inline-form partner-orders-page-filter">
          <label>
            Search order code
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="Ex: ORD-20260515-123456"
            />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {ORDER_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status || 'ALL'} value={status}>
                  {status || 'All'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Items / page
            <select
              value={orderPageSize}
              onChange={(event) => setOrderPageSize(Number(event.target.value))}
            >
              {ORDER_PAGE_SIZE_OPTIONS.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="role-btn-primary" onClick={() => void handleApplyFilters()}>
            Apply Filters
          </button>
          <button
            type="button"
            className="role-btn-primary partner-orders-reload-btn"
            onClick={() => void handleRefreshOrders()}
          >
            {loading ? 'Loading...' : 'Reload Orders'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}

        <div className="partner-orders-page-summary">
          <span>Total scoped orders: {totalOrdersResult}</span>
          <span>
            Page: {totalOrderPages === 0 ? 0 : orderPage + 1}/{totalOrderPages || 0}
          </span>
        </div>

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => {
                const canCancel = order.status === 'CREATED' || order.status === 'RESERVED'
                const isProcessing = processingOrderCode === order.orderCode

                return (
                  <tr key={order.orderCode}>
                    <td>{order.orderCode}</td>
                    <td>
                      <span className={`partner-orders-order-status-badge status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{formatMoney(order.totalAmount, order.currency)}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="partner-orders-page-actions">
                        {canCancel && (
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void handleCancelOrder(order.orderCode)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Processing...' : 'Cancel'}
                          </button>
                        )}
                        {!canCancel && <span className="role-muted">No actions</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!pagedOrders.length && (
                <tr>
                  <td colSpan={5} className="role-empty-cell">
                    No orders found in your current shop scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalOrderPages > 0 && (
          <div className="partner-orders-page-pagination">
            <p className="partner-orders-page-pagination-summary">
              Showing {currentOrderPageStart}-{currentOrderPageEnd} of {totalOrdersResult}
            </p>
            <div className="partner-orders-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost partner-orders-page-btn-page"
                onClick={() => setOrderPage((prev) => Math.max(0, prev - 1))}
                disabled={orderPage <= 0}
              >
                Prev
              </button>
              {orderPaginationPages.map((pageNumber) => (
                <button
                  key={`partner-order-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost partner-orders-page-btn-page ${pageNumber === orderPage ? 'is-active' : ''}`}
                  onClick={() => setOrderPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost partner-orders-page-btn-page"
                onClick={() => setOrderPage((prev) => Math.min(totalOrderPages - 1, prev + 1))}
                disabled={orderPage >= totalOrderPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>

      <article className="role-card">
        <div className="partner-orders-page-summary">
          <span>Refund requests: {refundRequestsTotal}</span>
          <span>
            Page: {refundTotalPages === 0 ? 0 : refundPage + 1}/{refundTotalPages || 0}
          </span>
        </div>

        <div className="role-inline-form partner-orders-refund-filter-row">
          <label>
            Status
            <select
              value={refundStatusFilter}
              onChange={(event) => handleRefundStatusChange(event.target.value)}
            >
              {ORDER_REFUND_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status || 'ALL'} value={status}>
                  {status || 'All'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Refunds / page
            <select
              value={refundPageSize}
              onChange={(event) => setRefundPageSize(Number(event.target.value))}
            >
              {REFUND_PAGE_SIZE_OPTIONS.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="role-btn-primary partner-orders-refund-reload-btn"
            onClick={() => void loadRefundRequests(refundPage, refundPageSize)}
            disabled={loadingRefundList}
          >
            {loadingRefundList ? 'Loading...' : 'Reload Refund Requests'}
          </button>
        </div>

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Requested At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {refundRequests.map((refund) => (
                <tr key={refund.refundId}>
                  <td>{refund.orderCode}</td>
                  <td>
                    <span className={`partner-orders-refund-badge status-${refund.status.toLowerCase()}`}>
                      {refund.status}
                    </span>
                  </td>
                  <td>{formatMoney(refund.refundAmount, refund.currency)}</td>
                  <td className="partner-orders-refund-reason">{refund.refundReason}</td>
                  <td>{formatDate(refund.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="role-btn-primary"
                      onClick={() => void openRefundDialog(refund.orderCode)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!refundRequests.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    No refund requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {refundTotalPages > 0 && (
          <div className="partner-orders-page-pagination">
            <p className="partner-orders-page-pagination-summary">
              Showing {currentRefundPageStart}-{currentRefundPageEnd} of {refundRequestsTotal}
            </p>
            <div className="partner-orders-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost partner-orders-page-btn-page"
                onClick={() => setRefundPage((prev) => Math.max(0, prev - 1))}
                disabled={refundPage <= 0}
              >
                Prev
              </button>
              {refundPaginationPages.map((pageNumber) => (
                <button
                  key={`partner-refund-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost partner-orders-page-btn-page ${pageNumber === refundPage ? 'is-active' : ''}`}
                  onClick={() => setRefundPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost partner-orders-page-btn-page"
                onClick={() => setRefundPage((prev) => Math.min(refundTotalPages - 1, prev + 1))}
                disabled={refundPage >= refundTotalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>

      {refundDialogOrderCode && (
        <div className="partner-orders-refund-overlay" onClick={closeRefundDialog}>
          <div className="partner-orders-refund-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="partner-orders-refund-header">
              <h3>Review Refund Request</h3>
              <button type="button" className="role-btn-ghost" onClick={closeRefundDialog}>
                Close
              </button>
            </header>

            <p className="partner-orders-refund-message">
              Customer requested refund for order <strong>{refundDialogOrderCode}</strong>. Review
              account information and choose to reject or create VNPay refund URL.
            </p>

            {loadingRefundInfo && <p className="role-muted">Loading refund request...</p>}

            {!loadingRefundInfo && selectedRefund && (
              <dl className="partner-orders-refund-meta">
                <div>
                  <dt>Status</dt>
                  <dd>{selectedRefund.status}</dd>
                </div>
                <div>
                  <dt>Order Status</dt>
                  <dd>{refundDialogOrderDetail?.status || '-'}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(selectedRefund.refundAmount, selectedRefund.currency)}</dd>
                </div>
                <div>
                  <dt>Order Total</dt>
                  <dd>
                    {refundDialogOrderDetail
                      ? formatMoney(refundDialogOrderDetail.totalAmount, refundDialogOrderDetail.currency)
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt>Requested At</dt>
                  <dd>{formatDate(selectedRefund.createdAt)}</dd>
                </div>
                <div>
                  <dt>Account Name</dt>
                  <dd>{selectedRefund.refundAccountName}</dd>
                </div>
                <div>
                  <dt>Account Number</dt>
                  <dd>{selectedRefund.refundAccountNumberMasked || '-'}</dd>
                </div>
                <div>
                  <dt>Bank Code</dt>
                  <dd>{selectedRefund.refundBankCode}</dd>
                </div>
                <div className="partner-orders-refund-note-block">
                  <dt>Reason</dt>
                  <dd>{selectedRefund.refundReason}</dd>
                </div>
                {selectedRefund.providerRefundUrl && (
                  <div className="partner-orders-refund-note-block">
                    <dt>VNPay Refund URL</dt>
                    <dd className="partner-orders-refund-url">{selectedRefund.providerRefundUrl}</dd>
                  </div>
                )}
              </dl>
            )}

            {!loadingRefundInfo && !selectedRefund && (
              <p className="role-muted">
                Refund request was not found for this order.
              </p>
            )}

            {selectedRefund?.status === 'REQUESTED' && (
              <label className="partner-orders-refund-note-input">
                Decision Note (optional)
                <textarea
                  value={refundDecisionNote}
                  onChange={(event) => setRefundDecisionNote(event.target.value)}
                  rows={3}
                  placeholder="Add context for the customer"
                />
              </label>
            )}

            <div className="partner-orders-refund-actions">
              {selectedRefund?.status === 'REQUESTED' && (
                <>
                  <button
                    type="button"
                    className="role-btn-primary"
                    onClick={() => void handleRefundDecision(refundDialogOrderCode, 'APPROVE')}
                    disabled={processingOrderCode === refundDialogOrderCode}
                  >
                    {processingOrderCode === refundDialogOrderCode
                      ? 'Processing...'
                      : 'Approve & Create VNPay URL'}
                  </button>
                  <button
                    type="button"
                    className="role-btn-ghost"
                    onClick={() => void handleRefundDecision(refundDialogOrderCode, 'REJECT')}
                    disabled={processingOrderCode === refundDialogOrderCode}
                  >
                    {processingOrderCode === refundDialogOrderCode ? 'Processing...' : 'Reject Request'}
                  </button>
                </>
              )}
              {selectedRefund?.providerRefundUrl && (
                <button
                  type="button"
                  className="role-btn-ghost"
                  onClick={() => window.open(selectedRefund.providerRefundUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open VNPay Refund URL
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PartnerOrdersPage
