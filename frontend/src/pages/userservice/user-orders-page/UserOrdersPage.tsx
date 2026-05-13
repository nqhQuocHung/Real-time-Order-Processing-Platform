import { useCallback, useEffect, useMemo, useState } from 'react'
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

const orderStatuses = ['', 'CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED']

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

function reconcileCartWithCatalog(cart: UserCartMap, catalogMap: Record<string, ProductCatalogItem>): UserCartMap {
  if (!Object.keys(cart).length) {
    return cart
  }

  let changed = false
  const nextCart: UserCartMap = {}
  for (const [productId, cartItem] of Object.entries(cart)) {
    const stock = catalogMap[productId]
    if (!stock) {
      changed = true
      continue
    }

    const availableQuantity = normalizeQuantity(stock.availableQuantity)
    if (availableQuantity <= 0) {
      changed = true
      continue
    }

    const nextQuantity = Math.min(cartItem.quantity, availableQuantity)
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
  const session = getAuthSession()

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [catalogMap, setCatalogMap] = useState<Record<string, ProductCatalogItem>>({})
  const [cart, setCart] = useState<UserCartMap>({})
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState('')
  const [latestCreatedOrder, setLatestCreatedOrder] = useState<CreateOrderResponse | null>(null)
  const [paymentByOrder, setPaymentByOrder] = useState<Record<string, PaymentTransactionResponse>>({})
  const [refreshingPaymentOrder, setRefreshingPaymentOrder] = useState('')
  const [nowTick, setNowTick] = useState(Date.now())

  const loadOrders = useCallback(async () => {
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
  }, [session?.userId, statusFilter])

  const loadCatalog = useCallback(async () => {
    const response = await apis().get(endpoints.inventories.catalog)
    const data = extractApiData<ProductCatalogItem[]>(response)
    const normalizedCatalog = Array.isArray(data) ? data : []
    const nextCatalogMap = buildCatalogMap(normalizedCatalog)
    setCatalogMap(nextCatalogMap)
    setCart((previous) => reconcileCartWithCatalog(previous, nextCatalogMap))
  }, [])

  useEffect(() => {
    setCart(readUserCartFromStorage())
  }, [])

  useEffect(() => {
    writeUserCartToStorage(cart)
  }, [cart])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

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
      void loadOrders()
      void loadCatalog()
    }, 15000)
    return () => window.clearInterval(refreshTimer)
  }, [loadCatalog, loadOrders])

  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)
    return () => window.clearInterval(tickTimer)
  }, [])

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

      await Promise.all([loadOrders(), loadCatalog()])
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
      await loadOrders()
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
      await Promise.all([loadOrders(), loadCatalog()])
    } catch (err) {
      setError(extractApiErrorMessage(err, `Cannot cancel order ${orderCode}.`))
    }
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
              Latest order <strong>{latestCreatedOrder.orderCode}</strong> is waiting for payment.
            </span>
            <a href={latestCreatedOrder.paymentUrl} target="_blank" rel="noreferrer">
              Open Payment Page
            </a>
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

      <article className="role-card">
        <h2>My Orders</h2>
        <p className="role-muted">
          Orders in RESERVED state are holding stock. If payment times out, stock is auto-released.
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
                const remaining = formatRemainingSeconds(order.paymentDeadlineAt, nowTick)
                const canCancel = order.status === 'CREATED' || order.status === 'RESERVED'
                const isReserved = order.status === 'RESERVED'
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
                          <a href={paymentUrl} target="_blank" rel="noreferrer">
                            Pay Now
                          </a>
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
      </article>
    </section>
  )
}

export default UserOrdersPage
