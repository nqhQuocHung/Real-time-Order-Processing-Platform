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
import {
  ORDER_STATUS_FILTER_OPTIONS,
  type OrderRefundStatus,
  type PaymentStatus,
} from '../../../constants/orderStatus'
import './UserOrdersPage.css'
import { QRCodeCanvas } from 'qrcode.react'

const paymentReturnRoutePath = '/payment-return'
const paymentReturnFlashStorageKey = 'user-orders-payment-return-flash-v1'
const paymentReturnHandledStorageKey = 'user-orders-payment-return-handled-v1'
const PAYMENT_RETURN_HANDLED_TTL_MS = 30 * 60 * 1000
const DEFAULT_ORDER_PAGE_SIZE = 8
const ORDER_PAGE_SIZE_OPTIONS = [8, 12, 20, 30]
const APP_NOTIFICATION_EVENT = 'app-notification-event'

type PaymentFlashType = 'success' | 'error'
type AppNotificationEventDetail = {
  eventName?: string
  payload?: {
    orderCode?: string
  }
}

type PaymentDialogState = {
  orderCode: string
  paymentUrl: string
  paymentDeadlineAt?: string
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
  status: PaymentStatus
  paymentUrl?: string
  method?: string
  amount?: number
  currency?: string
  updatedAt?: string
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
  providerNote?: string
  processedAt?: string
  createdAt?: string
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

function isPaymentDeadlineExpired(deadlineAt: string | undefined, nowTick: number): boolean {
  if (!deadlineAt) {
    return false
  }

  const deadline = new Date(deadlineAt).getTime()
  if (!Number.isFinite(deadline)) {
    return false
  }

  return deadline <= nowTick
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

function isRefundPaymentReturn(orderInfo: string | null, paymentContext: string | null): boolean {
  const normalizedContext = (paymentContext || '').trim().toLowerCase()
  if (normalizedContext === 'refund') {
    return true
  }

  const normalizedOrderInfo = (orderInfo || '').trim().toLowerCase()
  return normalizedOrderInfo.includes('hoan tien') || normalizedOrderInfo.includes('refund')
}

function resolvePaymentReturnTargetPath(
  returnTargetPath: string | null,
  isRefundReturn: boolean,
): string {
  const normalizedTargetPath = (returnTargetPath || '').trim()
  if (normalizedTargetPath.startsWith('/')) {
    return normalizedTargetPath
  }
  return isRefundReturn ? '/partner/orders' : '/user/orders'
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

function readHandledPaymentReturns(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.sessionStorage.getItem(paymentReturnHandledStorageKey)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeHandledPaymentReturns(value: Record<string, number>) {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(paymentReturnHandledStorageKey, JSON.stringify(value))
}

function hasHandledPaymentReturn(signature: string): boolean {
  if (!signature) {
    return false
  }

  const now = Date.now()
  const handledMap = readHandledPaymentReturns()
  let changed = false

  for (const [key, handledAt] of Object.entries(handledMap)) {
    if (!Number.isFinite(handledAt) || now - handledAt > PAYMENT_RETURN_HANDLED_TTL_MS) {
      delete handledMap[key]
      changed = true
    }
  }

  if (changed) {
    writeHandledPaymentReturns(handledMap)
  }

  return Number.isFinite(handledMap[signature])
}

function markPaymentReturnHandled(signature: string) {
  if (!signature) {
    return
  }

  const now = Date.now()
  const handledMap = readHandledPaymentReturns()
  handledMap[signature] = now
  writeHandledPaymentReturns(handledMap)
}

function buildPaymentReturnIdempotencyKey(signature: string): string {
  const safeSignature = signature.replace(/[^A-Za-z0-9_.:-]/g, '-')
  return `payment-return-${safeSignature}`
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
  const [refundByOrder, setRefundByOrder] = useState<Record<string, OrderRefundResponse | null>>({})
  const [refreshingPaymentOrder, setRefreshingPaymentOrder] = useState('')
  const [loadingRefundOrderCode, setLoadingRefundOrderCode] = useState('')
  const [requestingRefundOrderCode, setRequestingRefundOrderCode] = useState('')
  const [refundDialogOrderCode, setRefundDialogOrderCode] = useState('')
  const [refundAccountName, setRefundAccountName] = useState('')
  const [refundAccountNumber, setRefundAccountNumber] = useState('')
  const [refundBankCode, setRefundBankCode] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundFormError, setRefundFormError] = useState('')
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
    function handleNotificationEvent(event: Event) {
      const customEvent = event as CustomEvent<AppNotificationEventDetail>
      const eventName = (customEvent.detail?.eventName || '').trim()
      if (
        eventName !== 'payment.transaction.succeeded' &&
        eventName !== 'payment.transaction.failed' &&
        eventName !== 'order.refund.approved' &&
        eventName !== 'order.refund.rejected' &&
        eventName !== 'order.refund.completed' &&
        eventName !== 'order.refund.failed' &&
        eventName !== 'payment.refund.succeeded' &&
        eventName !== 'payment.refund.failed'
      ) {
        return
      }

      const orderCode = customEvent.detail?.payload?.orderCode?.trim() || ''
      if (orderCode) {
        void loadRefundState(orderCode, true)
      }
      void loadOrders(orderPage, orderPageSize)
      void loadCatalog()
    }

    window.addEventListener(APP_NOTIFICATION_EVENT, handleNotificationEvent as EventListener)
    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotificationEvent as EventListener)
    }
  }, [loadCatalog, loadOrders, orderPage, orderPageSize])

  useEffect(() => {
    const refundableOrders = orders
      .filter((order) => order.status === 'PAID' || order.status === 'COMPLETED')
      .map((order) => order.orderCode)

    if (!refundableOrders.length) {
      return
    }

    refundableOrders.forEach((orderCode) => {
      void loadRefundState(orderCode)
    })
  }, [orders])

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
    const isRefundReturn = isRefundPaymentReturn(
      searchParams.get('vnp_OrderInfo'),
      searchParams.get('paymentContext'),
    )
    const targetPath = resolvePaymentReturnTargetPath(
      searchParams.get('returnTargetPath'),
      isRefundReturn,
    )
    const txnRef = searchParams.get('vnp_TxnRef')?.trim() || ''
    const providerTransactionId =
      searchParams.get('vnp_TransactionNo')?.trim() || txnRef || undefined
    const orderCodeLabel = orderCode ? ` for ${orderCode}` : ''
    const isSuccess = responseCode === '00' && transactionStatus === '00'
    const paymentReturnSignature = [
      orderCode || 'unknown-order',
      providerTransactionId || txnRef || 'unknown-txn',
      responseCode || 'unknown-response',
      transactionStatus || 'unknown-status',
    ].join('|')
    const defaultMessage = isSuccess
      ? isRefundReturn
        ? `Refund payment successful${orderCodeLabel}.`
        : `Payment successful${orderCodeLabel}. You can continue from your cart now.`
      : isRefundReturn
        ? `Refund payment failed${orderCodeLabel}. Please verify refund status.`
        : `Payment failed${orderCodeLabel}. Please check order status and try again.`

    if (hasHandledPaymentReturn(paymentReturnSignature)) {
      if (location.pathname !== targetPath || location.search) {
        navigate(targetPath, { replace: true })
      }
      return
    }

    markPaymentReturnHandled(paymentReturnSignature)

    async function reconcilePaymentReturn() {
      let flashType: PaymentFlashType = isSuccess ? 'success' : 'error'
      let flashMessage = defaultMessage

      if (orderCode && !isRefundReturn) {
        const payload = {
          orderCode,
          providerTransactionId,
          actor: 'USER_PAYMENT_RETURN',
          idempotencyKey: buildPaymentReturnIdempotencyKey(paymentReturnSignature),
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
      } else if (!orderCode) {
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
        `Order ${createdOrder.orderCode} created with status ${createdOrder.status}. Payment popup is ready.`,
      )
      if (createdOrder.paymentUrl) {
        openPaymentDialog(
          createdOrder.orderCode,
          createdOrder.paymentUrl,
          createdOrder.paymentDeadlineAt,
          true,
        )
      }
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

  async function loadRefundState(orderCode: string, force = false) {
    if (!force && Object.prototype.hasOwnProperty.call(refundByOrder, orderCode)) {
      return
    }

    setLoadingRefundOrderCode(orderCode)
    try {
      const response = await apis().get(endpoints.orders.refundDetail(orderCode))
      const data = extractApiData<OrderRefundResponse>(response)
      setRefundByOrder((previous) => ({
        ...previous,
        [orderCode]: data || null,
      }))
    } catch (err) {
      const typedError = err as { response?: { status?: number } }
      if (typedError.response?.status === 404) {
        setRefundByOrder((previous) => ({
          ...previous,
          [orderCode]: null,
        }))
        return
      }
      setError(extractApiErrorMessage(err, `Cannot load refund status for order ${orderCode}.`))
    } finally {
      setLoadingRefundOrderCode('')
    }
  }

  function openRefundDialog(orderCode: string) {
    setRefundDialogOrderCode(orderCode)
    setRefundFormError('')
    setRefundAccountName('')
    setRefundAccountNumber('')
    setRefundBankCode('')
    setRefundReason('')
  }

  function closeRefundDialog() {
    setRefundDialogOrderCode('')
    setRefundFormError('')
  }

  async function handleSubmitRefundRequest() {
    const orderCode = refundDialogOrderCode.trim()
    if (!orderCode) {
      return
    }

    const accountName = refundAccountName.trim()
    const accountNumber = refundAccountNumber.trim()
    const bankCode = refundBankCode.trim().toUpperCase()
    const reason = refundReason.trim()

    if (!accountName || !accountNumber || !bankCode || !reason) {
      setRefundFormError('Please fill in account name, account number, bank code, and refund reason.')
      return
    }

    setRefundFormError('')
    setError('')
    setCheckoutSuccess('')
    setCheckoutError('')
    setRequestingRefundOrderCode(orderCode)

    try {
      const response = await apis().post(endpoints.orders.refundRequest(orderCode), {
        refundAccountName: accountName,
        refundAccountNumber: accountNumber,
        refundBankCode: bankCode,
        refundReason: reason,
        actor: session?.userId || 'CUSTOMER',
      })
      const data = extractApiData<OrderRefundResponse>(response)
      setRefundByOrder((previous) => ({
        ...previous,
        [orderCode]: data || null,
      }))
      setCheckoutSuccess(`Refund request for order ${orderCode} has been submitted.`)
      closeRefundDialog()
      await loadOrders(orderPage, orderPageSize)
    } catch (err) {
      setRefundFormError(
        extractApiErrorMessage(err, `Cannot submit refund request for order ${orderCode}.`),
      )
    } finally {
      setRequestingRefundOrderCode('')
    }
  }

  function openPaymentDialog(
    orderCode: string,
    paymentUrl: string,
    paymentDeadlineAt?: string,
    showQrByDefault = true,
  ) {
    if (!paymentUrl) {
      setError(`Payment URL is missing for order ${orderCode}.`)
      return
    }

    if (isPaymentDeadlineExpired(paymentDeadlineAt, Date.now())) {
      setError(`Payment session for order ${orderCode} is expired.`)
      return
    }

    setActivePaymentDialog({
      orderCode,
      paymentUrl,
      paymentDeadlineAt,
    })
    setShowPaymentDialog(true)
    setShowQrCode(showQrByDefault)
  }

  function closePaymentDialog() {
    setShowPaymentDialog(false)
    setShowQrCode(false)
    setActivePaymentDialog(null)
  }

  const activeDialogRemaining = activePaymentDialog
    ? formatRemainingSeconds(activePaymentDialog.paymentDeadlineAt, nowTick)
    : '-'
  const activeDialogExpired = activePaymentDialog
    ? isPaymentDeadlineExpired(activePaymentDialog.paymentDeadlineAt, nowTick)
    : false
  const selectedRefund = refundDialogOrderCode ? refundByOrder[refundDialogOrderCode] : null

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
            {checkoutLoading ? 'Creating Order...' : 'Create Order & Open Payment'}
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

        {latestCreatedOrder && (
          <div className="user-orders-payment-hint">
            <span>
              Latest order: <strong>{latestCreatedOrder.orderCode}</strong> ({latestCreatedOrder.status})
            </span>
            <small>
              {latestCreatedOrder.paymentDeadlineAt
                ? `Pay before ${formatDate(latestCreatedOrder.paymentDeadlineAt)}`
                : 'Payment deadline is managed by order service.'}
            </small>
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
              <p className={`payment-dialog-deadline ${activeDialogExpired ? 'is-expired' : ''}`}>
                Remaining: {activeDialogRemaining}
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
                  disabled={activeDialogExpired}
                >
                  {activeDialogExpired ? 'Payment Expired' : 'Pay Now'}
                </button>
                <button
                  type="button"
                  className="role-btn-ghost"
                  onClick={() => {
                    window.open(activePaymentDialog.paymentUrl, '_blank', 'noopener,noreferrer')
                  }}
                  disabled={activeDialogExpired}
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

        <div className="role-inline-form user-orders-filter-bar">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
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
                <th>Refund</th>
                <th>Total Amount</th>
                <th>Pay Before</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paymentInfo = paymentByOrder[order.orderCode]
                const hasRefundLookup = Object.prototype.hasOwnProperty.call(
                  refundByOrder,
                  order.orderCode,
                )
                const refundInfo = refundByOrder[order.orderCode]
                const refundStatus = refundInfo?.status || ''
                const isRefundLookupLoading = loadingRefundOrderCode === order.orderCode
                const paymentUrl = paymentInfo?.paymentUrl || order.paymentUrl
                const canCancel = order.status === 'CREATED' || order.status === 'RESERVED'
                const isReserved = order.status === 'RESERVED'
                const canRequestRefundBase =
                  order.status === 'PAID' || order.status === 'COMPLETED'
                const canRequestRefund =
                  canRequestRefundBase && hasRefundLookup && !refundInfo && !isRefundLookupLoading
                const isPendingPayment = !paymentInfo?.status || paymentInfo.status === 'PENDING'
                const isPaymentExpired = isReserved
                  && isPendingPayment
                  && isPaymentDeadlineExpired(order.paymentDeadlineAt, nowTick)
                const canContinuePayment = Boolean(paymentUrl)
                  && isReserved
                  && isPendingPayment
                  && !isPaymentExpired
                const remaining = isReserved && isPendingPayment
                  ? formatRemainingSeconds(order.paymentDeadlineAt, nowTick)
                  : '-'
                return (
                  <tr key={order.orderCode}>
                    <td>{order.orderCode}</td>
                    <td>
                      <span className={`user-orders-order-status-badge status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                      {paymentInfo?.status && (
                        <span className="user-orders-payment-status-label">Payment: {paymentInfo.status}</span>
                      )}
                    </td>
                    <td>
                      {refundInfo && (
                        <span
                          className={`user-orders-refund-badge status-${refundStatus.toLowerCase()}`}
                        >
                          {refundStatus}
                        </span>
                      )}
                      {!refundInfo && canRequestRefundBase && hasRefundLookup && (
                        <span className="user-orders-refund-none">Not requested</span>
                      )}
                      {!refundInfo && canRequestRefundBase && !hasRefundLookup && (
                        <span className="role-muted">Checking...</span>
                      )}
                      {!refundInfo && !canRequestRefundBase && <span className="role-muted">-</span>}
                    </td>
                    <td>{formatMoney(order.totalAmount, order.currency)}</td>
                    <td>
                      <span className={`user-orders-pay-before ${remaining === 'Expired' ? 'is-expired' : ''}`}>
                        {remaining}
                      </span>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="user-orders-row-actions">
                        {canContinuePayment && (
                          <button
                            type="button"
                            className="role-btn-primary user-orders-pay-button"
                            onClick={() =>
                              openPaymentDialog(
                                order.orderCode,
                                paymentUrl || '',
                                order.paymentDeadlineAt,
                                true,
                              )
                            }
                          >
                            Continue Payment
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
                        {canRequestRefund && (
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => openRefundDialog(order.orderCode)}
                          >
                            Request Refund
                          </button>
                        )}
                        {canRequestRefundBase && !hasRefundLookup && (
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void loadRefundState(order.orderCode, true)}
                            disabled={isRefundLookupLoading}
                          >
                            {isRefundLookupLoading ? 'Checking...' : 'Check Refund'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!orders.length && (
                <tr>
                  <td colSpan={7} className="role-empty-cell">
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

      {refundDialogOrderCode && (
        <div className="user-orders-refund-overlay" onClick={closeRefundDialog}>
          <div
            className="user-orders-refund-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="user-orders-refund-header">
              <h3>Request Refund</h3>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeRefundDialog}
              >
                Close
              </button>
            </header>

            <p className="user-orders-refund-message">
              Submit refund account details for order <strong>{refundDialogOrderCode}</strong>.
              Seller will review your request. For VNPay sandbox, these receiver details are
              demonstration data only.
            </p>

            {selectedRefund && (
              <div className="user-orders-refund-existing">
                <p>
                  Existing refund status:{' '}
                  <strong>{selectedRefund.status}</strong>
                </p>
                <p>
                  Reason: {selectedRefund.refundReason || '-'}
                </p>
              </div>
            )}

            {!selectedRefund && (
              <>
                <div className="role-inline-form user-orders-refund-form">
                  <label>
                    Account Name
                    <input
                      value={refundAccountName}
                      onChange={(event) => setRefundAccountName(event.target.value)}
                      placeholder="Receiver full name"
                    />
                  </label>
                  <label>
                    Account Number
                    <input
                      value={refundAccountNumber}
                      onChange={(event) => setRefundAccountNumber(event.target.value)}
                      placeholder="Bank account number"
                    />
                  </label>
                  <label>
                    Bank Code
                    <input
                      value={refundBankCode}
                      onChange={(event) => setRefundBankCode(event.target.value)}
                      placeholder="Example: VNBANK"
                    />
                  </label>
                  <label>
                    Refund Reason
                    <textarea
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      placeholder="Tell the seller why you need this refund"
                      rows={4}
                    />
                  </label>
                </div>

                {refundFormError && <p className="role-error">{refundFormError}</p>}

                <div className="user-orders-refund-actions">
                  <button
                    type="button"
                    className="role-btn-primary"
                    onClick={() => void handleSubmitRefundRequest()}
                    disabled={requestingRefundOrderCode === refundDialogOrderCode}
                  >
                    {requestingRefundOrderCode === refundDialogOrderCode
                      ? 'Submitting...'
                      : 'Submit Refund Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default UserOrdersPage
