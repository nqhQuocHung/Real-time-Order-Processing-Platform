import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import {
  clearUserCartStorage,
  readUserCartFromStorage,
  type UserCartMap,
  writeUserCartToStorage,
} from '../../../features/cart/userCartStorage'
import './UserOrdersPage.css'
import { QRCodeCanvas } from 'qrcode.react'

const orderStatuses = ['', 'CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED']
const paymentReturnRoutePath = '/payment-return'
const paymentReturnFlashStorageKey = 'user-orders-payment-return-flash-v1'
const DEFAULT_ORDER_PAGE_SIZE = 8
const ORDER_PAGE_SIZE_OPTIONS = [8, 12, 20, 30]

type PaymentFlashType = 'success' | 'error'

type PaymentDialogState = {
  orderCode: string
  paymentUrl: string
}



type ProductCatalogItem = {
  productId: string
  name?: string
  productName?: string
  availableQuantity?: number
  price?: number
  currency?: string
}

type OrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  paymentUrl?: string
  paymentDeadlineAt?: string
  createdAt?: string
}

type OrderListResponse = {
  content: OrderSummary[]
  totalElements: number
}

type CreateOrderResponse = {
  orderCode: string
  status: string
  paymentUrl?: string
  paymentDeadlineAt?: string
}

type PaymentTransactionResponse = {
  orderCode: string
  status: string
  paymentUrl?: string
  method?: string
  amount?: number
  currency?: string
  updatedAt?: string
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

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Math.max(0, Math.floor(Number(value))) : 0
}

function normalizePrice(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) {
    return 0
  }
  const normalized = Number(value)
  return normalized > 0 ? Number(normalized.toFixed(2)) : 0
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

function buildIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `order-${crypto.randomUUID()}`
  }
  return `order-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}

function formatRemainingSeconds(deadlineAt: string | undefined, nowTick: number): string {
  if (!deadlineAt) {
    return '-'
  }

  const deadline = new Date(deadlineAt).getTime()
  if (!Number.isFinite(deadline)) {
    return '-'
  }

  const diffMs = deadline - nowTick
  if (diffMs <= 0) {
    return 'Expired'
  }

  const totalSeconds = Math.ceil(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function buildCatalogMap(catalog: ProductCatalogItem[]): Record<string, ProductCatalogItem> {
  const result: Record<string, ProductCatalogItem> = {}
  for (const item of catalog) {
    result[item.productId] = item
  }
  return result
}

function parseVnpOrderCode(orderInfo: string | null, txnRef: string | null): string | undefined {
  const matchedFromOrderInfo = orderInfo?.toUpperCase().match(/ORD-?(\d{14})-?(\d{6})/)
  if (matchedFromOrderInfo) {
    return `ORD-${matchedFromOrderInfo[1]}-${matchedFromOrderInfo[2]}`
  }

  const matchedFromTxnRef = txnRef?.toUpperCase().match(/ORD-?(\d{14})-?(\d{6})/)
  if (matchedFromTxnRef) {
    return `ORD-${matchedFromTxnRef[1]}-${matchedFromTxnRef[2]}`
  }

  return undefined
}

function readPaymentFlash(): { type: PaymentFlashType; message: string } | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(paymentReturnFlashStorageKey)
  if (!raw) {
    return null
  }

  window.localStorage.removeItem(paymentReturnFlashStorageKey)

  try {
    const parsed = JSON.parse(raw) as { type?: PaymentFlashType; message?: string }
    if (!parsed?.message || (parsed.type !== 'success' && parsed.type !== 'error')) {
      return null
    }
    return { type: parsed.type, message: parsed.message }
  } catch {
    return null
  }
}

function writePaymentFlash(type: PaymentFlashType, message: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(paymentReturnFlashStorageKey, JSON.stringify({ type, message }))
}

function reconcileCartWithCatalog(cart: UserCartMap, catalogMap: Record<string, ProductCatalogItem>): UserCartMap {
  if (!Object.keys(cart).length) {
    return cart
  }

  let changed = false
  const nextCart: UserCartMap = {}
  for (const [productId, cartItem] of Object.entries(cart)) {
    const stock = catalogMap[productId]
    if (!stock) {
      nextCart[productId] = {
        ...cartItem,
        maxAvailable: 0,
      }
      if (cartItem.maxAvailable !== 0) {
        changed = true
      }
      continue
    }

    const availableQuantity = normalizeQuantity(stock.availableQuantity)
    const nextQuantity =
      availableQuantity > 0 ? Math.min(cartItem.quantity, availableQuantity) : cartItem.quantity
    const nextUnitPrice = normalizePrice(stock.price)
    const nextCurrency = stock.currency?.trim() || cartItem.currency || 'VND'
    const nextName = stock.name?.trim() || stock.productName?.trim() || cartItem.productName

    nextCart[productId] = {
      ...cartItem,
      productName: nextName,
      quantity: Math.max(1, nextQuantity),
      maxAvailable: availableQuantity,
      unitPrice: nextUnitPrice > 0 ? nextUnitPrice : cartItem.unitPrice,
      currency: nextCurrency,
    }

    if (
      nextCart[productId].quantity !== cartItem.quantity ||
      nextCart[productId].maxAvailable !== cartItem.maxAvailable ||
      nextCart[productId].unitPrice !== cartItem.unitPrice ||
      nextCart[productId].currency !== cartItem.currency ||
      nextCart[productId].productName !== cartItem.productName
    ) {
      changed = true
    }
  }

  if (!changed && Object.keys(nextCart).length === Object.keys(cart).length) {
    return cart
  }
  return nextCart
}

function UserOrdersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [activePaymentDialog, setActivePaymentDialog] = useState<PaymentDialogState | null>(null)

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [orderPage, setOrderPage] = useState(0)
  const [orderPageSize, setOrderPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE)
  const [totalOrdersResult, setTotalOrdersResult] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [catalogMap, setCatalogMap] = useState<Record<string, ProductCatalogItem>>({})
  const [cart, setCart] = useState<UserCartMap>(() => readUserCartFromStorage())
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState('')
  const [latestCreatedOrder, setLatestCreatedOrder] = useState<CreateOrderResponse | null>(null)
  const [paymentByOrder, setPaymentByOrder] = useState<Record<string, PaymentTransactionResponse>>({})
  const [refreshingPaymentOrder, setRefreshingPaymentOrder] = useState('')
  const [nowTick, setNowTick] = useState(Date.now())

  const loadOrders = useCallback(async (targetPage = orderPage, targetPageSize = orderPageSize) => {
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
          page: targetPage,
          size: targetPageSize,
        },
      })
      const data = extractApiData<OrderListResponse>(response)
      const resolvedOrders = Array.isArray(data.content) ? data.content : []
      const resolvedTotal = Number.isFinite(data.totalElements as number)
        ? Math.max(0, Math.floor(Number(data.totalElements)))
        : resolvedOrders.length
      setOrders(resolvedOrders)
      setTotalOrdersResult(Math.max(resolvedTotal, resolvedOrders.length))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load order list.'))
      setOrders([])
      setTotalOrdersResult(0)
    } finally {
      setLoading(false)
    }
  }, [orderPage, orderPageSize, session?.userId, statusFilter])

  const loadCatalog = useCallback(async () => {
    const response = await apis().get(endpoints.inventories.catalog)
    const data = extractApiData<ProductCatalogItem[]>(response)
    const normalizedCatalog = Array.isArray(data) ? data : []
    const nextCatalogMap = buildCatalogMap(normalizedCatalog)
    setCatalogMap(nextCatalogMap)
    setCart((previous) => reconcileCartWithCatalog(previous, nextCatalogMap))
  }, [])

  useEffect(() => {
    writeUserCartToStorage(cart)
  }, [cart])

  useEffect(() => {
    void loadOrders(orderPage, orderPageSize)
  }, [loadOrders, orderPage, orderPageSize])

  useEffect(() => {
    setOrderPage(0)
  }, [statusFilter, orderPageSize])

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

  const orderPaginationPages = useMemo(
    () => buildPaginationPages(orderPage, totalOrderPages),
    [orderPage, totalOrderPages],
  )

  const currentOrderPageStart = totalOrdersResult === 0 ? 0 : orderPage * orderPageSize + 1
  const currentOrderPageEnd = totalOrdersResult === 0
    ? 0
    : Math.min((orderPage + 1) * orderPageSize, totalOrdersResult)

  useEffect(() => {
    async function initCatalog() {
      try {
        await loadCatalog()
      } catch {
        // Ignore catalog load error here, checkout validation handles hard errors.
      }
    }
    void initCatalog()
  }, [loadCatalog])

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      void loadOrders(orderPage, orderPageSize)
      void loadCatalog()
    }, 15000)
    return () => window.clearInterval(refreshTimer)
  }, [loadCatalog, loadOrders, orderPage, orderPageSize])

  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)
    return () => window.clearInterval(tickTimer)
  }, [])

  useEffect(() => {
    const flash = readPaymentFlash()
    if (!flash) {
      return
    }

    if (flash.type === 'success') {
      setCheckoutError('')
      setCheckoutSuccess(flash.message)
    } else {
      setCheckoutSuccess('')
      setCheckoutError(flash.message)
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const responseCode = searchParams.get('vnp_ResponseCode')
    const transactionStatus = searchParams.get('vnp_TransactionStatus')

    if (!responseCode && !transactionStatus) {
      if (location.pathname === paymentReturnRoutePath) {
        navigate('/user/orders', { replace: true })
      }
      return
    }

    const orderCode = parseVnpOrderCode(
      searchParams.get('vnp_OrderInfo'),
      searchParams.get('vnp_TxnRef'),
    )
    const providerTransactionId =
      searchParams.get('vnp_TransactionNo')?.trim() || searchParams.get('vnp_TxnRef')?.trim() || undefined
    const orderCodeLabel = orderCode ? ` for ${orderCode}` : ''
    const isSuccess = responseCode === '00' && transactionStatus === '00'
    const defaultMessage = isSuccess
      ? `Payment successful${orderCodeLabel}. You can continue from your cart now.`
      : `Payment failed${orderCodeLabel}. Please check order status and try again.`
    const targetPath = '/user/orders'

    async function reconcilePaymentReturn() {
      let flashType: PaymentFlashType = isSuccess ? 'success' : 'error'
      let flashMessage = defaultMessage

      if (orderCode) {
        const payload = {
          orderCode,
          providerTransactionId,
          actor: 'USER_PAYMENT_RETURN',
          idempotencyKey: buildIdempotencyKey(),
          note: isSuccess
            ? 'Payment confirmed from VNPay return.'
            : 'Payment failed or cancelled from VNPay return.',
        }

        try {
          if (isSuccess) {
            const apiResponse = await apis().post(endpoints.payments.confirm, payload)
            const payment = extractApiData<PaymentTransactionResponse>(apiResponse)
            setPaymentByOrder((previous) => ({
              ...previous,
              [orderCode]: payment,
            }))
          } else {
            const apiResponse = await apis().post(endpoints.payments.fail, payload)
            const payment = extractApiData<PaymentTransactionResponse>(apiResponse)
            setPaymentByOrder((previous) => ({
              ...previous,
              [orderCode]: payment,
            }))
          }
        } catch (err) {
          flashType = 'error'
          flashMessage = extractApiErrorMessage(
            err,
            `Cannot reconcile payment status${orderCodeLabel}. Please refresh and check again.`,
          )
        }
      } else {
        flashType = 'error'
        flashMessage =
          'Cannot identify order from payment return. Please refresh orders and verify status manually.'
      }

      writePaymentFlash(flashType, flashMessage)
      if (flashType === 'success') {
        setCheckoutError('')
        setCheckoutSuccess(flashMessage)
      } else {
        setCheckoutSuccess('')
        setCheckoutError(flashMessage)
      }
      setShowPaymentDialog(false)
      setShowQrCode(false)
      setActivePaymentDialog(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      try {
        await Promise.all([loadOrders(orderPage, orderPageSize), loadCatalog()])
      } catch {
        // Keep redirect flow even if refresh fails.
      }

      if (location.pathname !== targetPath || location.search) {
        navigate(targetPath, { replace: true })
      }
    }

    void reconcilePaymentReturn()
  }, [loadCatalog, loadOrders, location.pathname, location.search, navigate, orderPage, orderPageSize])

  useEffect(() => {
    if (!showPaymentDialog) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowPaymentDialog(false)
        setShowQrCode(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showPaymentDialog])

  const cartItems = useMemo(() => {
    return Object.values(cart).sort((firstItem, secondItem) =>
      firstItem.productName.localeCompare(secondItem.productName),
    )
  }, [cart])

  const cartTotalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + normalizeQuantity(item.quantity), 0),
    [cartItems],
  )

  const cartTotalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cartItems],
  )

  function handleCartQuantityChange(productId: string, delta: number) {
    setCart((previous) => {
      const item = previous[productId]
      if (!item) {
        return previous
      }

      const stock = catalogMap[productId]
      const maxAvailable = stock ? normalizeQuantity(stock.availableQuantity) : item.maxAvailable
      const nextQuantity = Math.max(1, Math.min(item.quantity + delta, Math.max(1, maxAvailable)))
      if (nextQuantity === item.quantity && maxAvailable === item.maxAvailable) {
        return previous
      }

      return {
        ...previous,
        [productId]: {
          ...item,
          quantity: nextQuantity,
          maxAvailable,
        },
      }
    })
  }

  function handleRemoveCartItem(productId: string) {
    setCart((previous) => {
      if (!previous[productId]) {
        return previous
      }
      const { [productId]: _removed, ...rest } = previous
      return rest
    })
  }

  async function handleCreateOrder() {
    if (!session?.userId) {
      setCheckoutError('Cannot find user ID to create order.')
      return
    }
    if (!cartItems.length) {
      setCheckoutError('Your cart is empty.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    setCheckoutSuccess('')
    setLatestCreatedOrder(null)

    try {
      const catalogResponse = await apis().get(endpoints.inventories.catalog)
      const latestCatalog = extractApiData<ProductCatalogItem[]>(catalogResponse)
      const latestCatalogMap = buildCatalogMap(Array.isArray(latestCatalog) ? latestCatalog : [])
      setCatalogMap(latestCatalogMap)
      setCart((previous) => reconcileCartWithCatalog(previous, latestCatalogMap))

      const orderItems: Array<{
        productId: string
        productName: string
        quantity: number
        unitPrice: number
      }> = []
      const validationErrors: string[] = []

      for (const cartItem of cartItems) {
        const stock = latestCatalogMap[cartItem.productId]
        if (!stock) {
          validationErrors.push(`${cartItem.productName}: product not found in latest catalog.`)
          continue
        }

        const availableQuantity = normalizeQuantity(stock.availableQuantity)
        if (availableQuantity < cartItem.quantity) {
          validationErrors.push(
            `${cartItem.productName}: only ${availableQuantity} item(s) available, but ${cartItem.quantity} requested.`,
          )
          continue
        }

        const unitPrice = normalizePrice(stock.price)
        if (unitPrice <= 0) {
          validationErrors.push(`${cartItem.productName}: invalid product price.`)
          continue
        }

        const productName = stock.name?.trim() || stock.productName?.trim() || cartItem.productName
        orderItems.push({
          productId: cartItem.productId,
          productName,
          quantity: cartItem.quantity,
          unitPrice,
        })
      }

      if (validationErrors.length > 0 || orderItems.length === 0) {
        setCheckoutError(validationErrors.join(' '))
        return
      }

      const currency = cartItems[0]?.currency || 'VND'
      const response = await apis().post(
        endpoints.orders.create,
        {
          customerId: session.userId,
          currency,
          items: orderItems,
        },
        {
          headers: {
            'Idempotency-Key': buildIdempotencyKey(),
          },
        },
      )
      const createdOrder = extractApiData<CreateOrderResponse>(response)
      setLatestCreatedOrder(createdOrder)
      setCheckoutSuccess(
        `Order ${createdOrder.orderCode} created with status ${createdOrder.status}. Complete payment before timeout.`,
      )
      setCart((previous) => {
        const next = { ...previous }
        for (const createdItem of orderItems) {
          delete next[createdItem.productId]
        }
        return next
      })

      await Promise.all([loadOrders(orderPage, orderPageSize), loadCatalog()])
    } catch (err) {
      setCheckoutError(extractApiErrorMessage(err, 'Cannot create order from current cart.'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleRefreshPayment(orderCode: string) {
    setRefreshingPaymentOrder(orderCode)
    try {
      const response = await apis().get(endpoints.payments.getByOrderCode(orderCode))
      const payment = extractApiData<PaymentTransactionResponse>(response)
      setPaymentByOrder((previous) => ({
        ...previous,
        [orderCode]: payment,
      }))
      await loadOrders(orderPage, orderPageSize)
      await loadCatalog()
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot refresh payment for order ${orderCode}.`))
    } finally {
      setRefreshingPaymentOrder('')
    }
  }

  async function handleCancelOrder(orderCode: string) {
    try {
      await apis().post(endpoints.orders.cancel(orderCode), {
        actor: 'USER',
        note: 'Cancelled by customer from self-service page',
      })
      await Promise.all([loadOrders(orderPage, orderPageSize), loadCatalog()])
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot cancel order ${orderCode}.`))
    }
  }

  function openPaymentDialog(orderCode: string, paymentUrl: string) {
    if (!paymentUrl) {
      setError(`Payment URL is missing for order ${orderCode}.`)
      return
    }

    setActivePaymentDialog({
      orderCode,
      paymentUrl,
    })
    setShowPaymentDialog(true)
    setShowQrCode(false)
  }

  function closePaymentDialog() {
    setShowPaymentDialog(false)
    setShowQrCode(false)
    setActivePaymentDialog(null)
  }

  return (
    <section className="user-orders-page role-page-stack">
      <article className="role-card">
        <h2>Checkout Cart</h2>
        <p className="role-muted">
          Cart is synced from the Products tab and saved locally. Stock is revalidated before
          creating an order.
        </p>

        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleCreateOrder()}
            disabled={checkoutLoading || cartItems.length === 0}
          >
            {checkoutLoading ? 'Creating Order...' : 'Create Order From Cart'}
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => {
              setCart({})
              clearUserCartStorage()
            }}
            disabled={!cartItems.length}
          >
            Clear Cart
          </button>
        </div>

        <p className="role-muted">
          Cart items: {cartItems.length} product(s), total quantity {cartTotalQuantity}, subtotal{' '}
          {formatMoney(cartTotalAmount, cartItems[0]?.currency || 'VND')}.
        </p>

        {checkoutError && <p className="role-error">{checkoutError}</p>}
        {checkoutSuccess && <p className="role-muted">{checkoutSuccess}</p>}

        {latestCreatedOrder?.paymentUrl && (
          <div className="user-orders-payment-hint">
            <span>
              Order <strong>{latestCreatedOrder.orderCode}</strong> is waiting for payment.
            </span>

            <button
              type="button"
              className="role-btn-primary"
              onClick={() => {
                openPaymentDialog(latestCreatedOrder.orderCode, latestCreatedOrder.paymentUrl || '')
              }}
            >
              Open Payment Dialog
            </button>
          </div>
        )}

        {showPaymentDialog && activePaymentDialog && (
          <div className="payment-dialog-overlay" onClick={closePaymentDialog}>
            <div className="payment-dialog" onClick={(event) => event.stopPropagation()}>
              <header className="payment-dialog-header">
                <h3>Complete Payment</h3>
                <button
                  type="button"
                  className="role-btn-ghost payment-dialog-close"
                  onClick={closePaymentDialog}
                >
                  Close
                </button>
              </header>

              <p className="payment-dialog-message">
                Order <strong>{activePaymentDialog.orderCode}</strong> is reserved. Complete payment
                before it expires.
              </p>

              {showQrCode && (
                <div className="payment-qrcode">
                  <QRCodeCanvas value={activePaymentDialog.paymentUrl} size={220} includeMargin />
                  <p>Scan QR to continue payment.</p>
                </div>
              )}

              <div className="payment-dialog-actions">
                <button
                  type="button"
                  className="role-btn-primary"
                  onClick={() => {
                    window.location.assign(activePaymentDialog.paymentUrl)
                  }}
                >
                  Pay Now
                </button>
                <button
                  type="button"
                  className="role-btn-ghost"
                  onClick={() => {
                    window.open(activePaymentDialog.paymentUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Open New Tab
                </button>
                <button
                  type="button"
                  className="role-btn-ghost"
                  onClick={() => setShowQrCode((previous) => !previous)}
                >
                  {showQrCode ? 'Hide QR Code' : 'Show QR Code'}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Available</th>
                <th>Price</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.productId}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{item.maxAvailable}</td>
                  <td>{formatMoney(item.unitPrice, item.currency || 'VND')}</td>
                  <td>{formatMoney(item.quantity * item.unitPrice, item.currency || 'VND')}</td>
                  <td>
                    <div className="user-orders-cart-actions">
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => handleCartQuantityChange(item.productId, -1)}
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => handleCartQuantityChange(item.productId, 1)}
                        disabled={item.quantity >= Math.max(1, item.maxAvailable)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => handleRemoveCartItem(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!cartItems.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    Cart is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="role-card user-orders-page-orders-card">
        <div className="user-orders-page-orders-header">
          <div>
            <h2>My Orders</h2>
            <p className="role-muted">
              Orders in RESERVED state are holding stock. If payment times out, stock is auto-released.
            </p>
          </div>
          <div className="user-orders-page-orders-metrics">
            <span>Total: {totalOrdersResult}</span>
            <span>Page: {totalOrderPages === 0 ? 0 : orderPage + 1}/{totalOrderPages || 0}</span>
          </div>
        </div>

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
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => {
              setOrderPage(0)
              void loadOrders(0, orderPageSize)
            }}
          >
            {loading ? 'Loading...' : 'Filter Orders'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Pay Before</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paymentInfo = paymentByOrder[order.orderCode]
                const paymentUrl = paymentInfo?.paymentUrl || order.paymentUrl
                const canCancel = order.status === 'CREATED' || order.status === 'RESERVED'
                const isReserved = order.status === 'RESERVED'
                const isPendingPayment = !paymentInfo?.status || paymentInfo.status === 'PENDING'
                const remaining = isReserved && isPendingPayment
                  ? formatRemainingSeconds(order.paymentDeadlineAt, nowTick)
                  : '-'
                return (
                  <tr key={order.orderCode}>
                    <td>{order.orderCode}</td>
                    <td>
                      {order.status}
                      {paymentInfo?.status ? ` / Payment: ${paymentInfo.status}` : ''}
                    </td>
                    <td>{formatMoney(order.totalAmount, order.currency)}</td>
                    <td>{remaining}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="user-orders-row-actions">
                        {paymentUrl && isReserved && (
                          <button
                            type="button"
                            className="role-btn-primary user-orders-pay-button"
                            onClick={() => openPaymentDialog(order.orderCode, paymentUrl)}
                          >
                            Pay Now
                          </button>
                        )}
                        {isReserved && (
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void handleRefreshPayment(order.orderCode)}
                            disabled={refreshingPaymentOrder === order.orderCode}
                          >
                            {refreshingPaymentOrder === order.orderCode
                              ? 'Refreshing...'
                              : 'Refresh Payment'}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void handleCancelOrder(order.orderCode)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!orders.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalOrderPages > 0 && (
          <div className="user-orders-page-pagination">
            <p className="user-orders-page-pagination-summary">
              Showing {currentOrderPageStart}-{currentOrderPageEnd} of {totalOrdersResult}
            </p>
            <div className="user-orders-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost user-orders-page-btn-page"
                onClick={() => setOrderPage((prev) => Math.max(0, prev - 1))}
                disabled={orderPage <= 0}
              >
                Prev
              </button>
              {orderPaginationPages.map((pageNumber) => (
                <button
                  key={`order-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost user-orders-page-btn-page ${pageNumber === orderPage ? 'is-active' : ''}`}
                  onClick={() => setOrderPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost user-orders-page-btn-page"
                onClick={() => setOrderPage((prev) => Math.min(totalOrderPages - 1, prev + 1))}
                disabled={orderPage >= totalOrderPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}

export default UserOrdersPage

