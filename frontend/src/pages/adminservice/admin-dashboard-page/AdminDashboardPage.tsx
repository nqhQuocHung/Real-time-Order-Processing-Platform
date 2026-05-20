import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './AdminDashboardPage.css'

type NotificationStreamEventDetail = {
  eventName?: string
}

type SystemUserSummaryResponse = {
  totalUsers: number
  totalPartners: number
}

type InventorySummaryResponse = {
  totalProducts: number
}

type InventoryCatalogItem = {
  productId: string
  shopId?: string | null
  shopName?: string | null
}

type AdminUserSummary = {
  userId: string
  username: string
}

type AdminUserListResponse = {
  content: AdminUserSummary[]
}

type DashboardOrderSummary = {
  orderCode: string
  status: string
  totalAmount: number
  currency: string
  createdAt?: string
}

type DashboardOrderListResponse = {
  content: DashboardOrderSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type DashboardOrderDetail = {
  orderCode: string
  items?: Array<{
    productId: string
  }>
}

type PartnerOption = {
  key: string
  label: string
}

type TimeRangeOption = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL'

type LineChartPoint = {
  label: string
  value: number
}

const APP_NOTIFICATION_EVENT = 'app-notification-event'
const DASHBOARD_REFRESH_DEBOUNCE_MS = 700
const ORDER_PAGE_SIZE = 200
const MAX_ANALYTICS_ORDER_PAGES = 6
const DETAIL_FETCH_CONCURRENCY = 12
const ALL_PARTNERS_KEY = '__ALL_PARTNERS__'
const UNMAPPED_PARTNER_KEY = '__UNMAPPED_PARTNER__'

const REVENUE_STATUSES = new Set(['PAID', 'COMPLETED'])
const PENDING_STATUSES = new Set(['CREATED', 'RESERVED', 'PAID'])

const STATUS_LABEL_MAP: Record<string, string> = {
  CREATED: 'Created',
  RESERVED: 'Reserved',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

const CHART_COLORS = ['#27c2ff', '#22e4c6', '#ffd166', '#ff9f6e', '#ff6f91', '#a78bfa']

const TIME_RANGE_OPTIONS: Array<{ value: TimeRangeOption; label: string }> = [
  { value: 'DAY', label: 'Day' },
  { value: 'MONTH', label: 'Month' },
  { value: 'QUARTER', label: 'Quarter' },
  { value: 'YEAR', label: 'Year' },
  { value: 'ALL', label: 'All' },
]

function shouldRefreshAdminDashboard(eventName: string): boolean {
  if (!eventName || eventName === 'connected') {
    return false
  }

  return (
    eventName.startsWith('order.lifecycle.') ||
    eventName.startsWith('payment.transaction.') ||
    eventName.startsWith('partner.request.')
  )
}

function normalizeStatus(status: string | undefined): string {
  return (status || 'UNKNOWN').trim().toUpperCase()
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString('en-US')
}

function toLocalDateTimeString(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hour = String(value.getHours()).padStart(2, '0')
  const minute = String(value.getMinutes()).padStart(2, '0')
  const second = String(value.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function resolveRangeBounds(range: TimeRangeOption): { createdFrom?: string; createdTo?: string } {
  if (range === 'ALL') {
    return {}
  }

  const now = new Date()
  const start = new Date(now)

  if (range === 'DAY') {
    start.setHours(0, 0, 0, 0)
  } else if (range === 'MONTH') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else if (range === 'QUARTER') {
    const currentMonth = now.getMonth()
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3
    start.setMonth(quarterStartMonth, 1)
    start.setHours(0, 0, 0, 0)
  } else if (range === 'YEAR') {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
  }

  return {
    createdFrom: toLocalDateTimeString(start),
    createdTo: toLocalDateTimeString(now),
  }
}

function normalizePartnerKey(shopId?: string | null, shopName?: string | null): string {
  const normalizedShopId = shopId?.trim()
  if (normalizedShopId) {
    return `id:${normalizedShopId.toLowerCase()}`
  }
  const normalizedShopName = shopName?.trim()
  if (normalizedShopName) {
    return `name:${normalizedShopName.toLowerCase()}`
  }
  return ''
}

function resolvePartnerLabel(shopId?: string | null, shopName?: string | null): string {
  const normalizedShopName = shopName?.trim()
  if (normalizedShopName) {
    return normalizedShopName
  }
  const normalizedShopId = shopId?.trim()
  if (normalizedShopId) {
    return normalizedShopId
  }
  return 'Unknown shop'
}

function buildPartnerOptions(
  catalog: InventoryCatalogItem[],
  partnerUsers: AdminUserSummary[],
): {
  partnerOptions: PartnerOption[]
  partnerLabelMap: Record<string, string>
  productPartnerById: Record<string, string>
} {
  const optionMap = new Map<string, PartnerOption>()
  const partnerLabelMap: Record<string, string> = {
    [UNMAPPED_PARTNER_KEY]: 'Unmapped shop',
  }
  const productPartnerById: Record<string, string> = {}

  for (const item of catalog) {
    const partnerKey = normalizePartnerKey(item.shopId, item.shopName)
    if (!partnerKey) {
      continue
    }

    const label = resolvePartnerLabel(item.shopId, item.shopName)
    productPartnerById[item.productId] = partnerKey
    partnerLabelMap[partnerKey] = label
    if (!optionMap.has(partnerKey)) {
      optionMap.set(partnerKey, { key: partnerKey, label })
    }
  }

  for (const partner of partnerUsers) {
    const partnerKey = normalizePartnerKey(partner.userId, partner.username)
    if (!partnerKey) {
      continue
    }
    const label = partner.username?.trim() || partner.userId
    if (!partnerLabelMap[partnerKey]) {
      partnerLabelMap[partnerKey] = label
    }
    if (!optionMap.has(partnerKey)) {
      optionMap.set(partnerKey, { key: partnerKey, label })
    }
  }

  const partnerOptions = Array.from(optionMap.values()).sort((first, second) =>
    first.label.localeCompare(second.label, 'en'),
  )

  return {
    partnerOptions,
    partnerLabelMap,
    productPartnerById,
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  let cursor = 0

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor
        cursor += 1
        await worker(items[currentIndex])
      }
    }),
  )
}

function StatusPieChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>
}) {
  const totalValue = items.reduce((sum, item) => sum + item.value, 0)
  const radius = 72
  const circumference = 2 * Math.PI * radius
  let progressOffset = 0

  if (totalValue === 0) {
    return <p className="role-muted">No order status data available for this scope.</p>
  }

  return (
    <div className="admin-dashboard-pie-layout">
      <svg viewBox="0 0 200 200" className="admin-dashboard-pie-chart" aria-label="Order status pie chart">
        <g transform="rotate(-90 100 100)">
          {items.map((item) => {
            const ratio = item.value / totalValue
            const segmentLength = ratio * circumference
            const circle = (
              <circle
                key={item.label}
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="22"
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-progressOffset}
                strokeLinecap="butt"
              />
            )
            progressOffset += segmentLength
            return circle
          })}
        </g>
        <text x="100" y="96" textAnchor="middle" className="admin-dashboard-pie-center-title">
          Total orders
        </text>
        <text x="100" y="122" textAnchor="middle" className="admin-dashboard-pie-center-value">
          {formatNumber(totalValue)}
        </text>
      </svg>

      <div className="admin-dashboard-pie-legend">
        {items.map((item) => {
          const percent = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0
          return (
            <div key={item.label} className="admin-dashboard-pie-legend-row">
              <span className="admin-dashboard-pie-dot" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)} ({percent}%)</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RevenueLineChart({ points }: { points: LineChartPoint[] }) {
  const width = 640
  const height = 260
  const paddingX = 38
  const paddingTop = 16
  const paddingBottom = 32
  const chartHeight = height - paddingTop - paddingBottom
  const chartWidth = width - paddingX * 2

  const maxValue = Math.max(1, ...points.map((point) => point.value))
  const usablePoints = points.length > 0 ? points : [{ label: '-', value: 0 }]

  const graphPoints = usablePoints.map((point, index) => {
    const ratioX = usablePoints.length === 1 ? 0 : index / (usablePoints.length - 1)
    const x = paddingX + ratioX * chartWidth
    const ratioY = point.value / maxValue
    const y = paddingTop + chartHeight - ratioY * chartHeight
    return { ...point, x, y }
  })

  const polylinePath = graphPoints.map((point) => `${point.x},${point.y}`).join(' ')

  if (!points.length) {
    return <p className="role-muted">No revenue data available in the selected scope.</p>
  }

  return (
    <div className="admin-dashboard-line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-dashboard-line-chart" aria-label="Revenue trend line chart">
        <polyline
          points={`${paddingX},${height - paddingBottom} ${polylinePath} ${width - paddingX},${height - paddingBottom}`}
          fill="rgba(39, 194, 255, 0.12)"
          stroke="none"
        />
        <polyline
          points={polylinePath}
          fill="none"
          stroke="#22e4c6"
          strokeWidth="3"
        />

        {graphPoints.map((point) => (
          <circle
            key={`point-${point.label}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#27c2ff"
            stroke="#0f2e4a"
            strokeWidth="2"
          />
        ))}

        {graphPoints.map((point, index) => {
          const shouldDisplay = graphPoints.length <= 12 || index % Math.ceil(graphPoints.length / 10) === 0
          if (!shouldDisplay) {
            return null
          }

          return (
            <text
              key={`label-${point.label}`}
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              className="admin-dashboard-line-axis-label"
            >
              {point.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function CancelFanChart({ cancelRate, cancelledOrders }: { cancelRate: number; cancelledOrders: number }) {
  const limitedRate = Math.max(0, Math.min(100, cancelRate))
  const cancelAngle = 180 * (limitedRate / 100)

  return (
    <div className="admin-dashboard-fan-root">
      <div className="admin-dashboard-fan-mask">
        <div
          className="admin-dashboard-fan-gauge"
          style={{
            background: `conic-gradient(from 180deg, #ff6f91 0deg ${cancelAngle}deg, rgba(80, 129, 175, 0.32) ${cancelAngle}deg 180deg)`,
          }}
        >
          <div className="admin-dashboard-fan-hole" />
        </div>
      </div>
      <div className="admin-dashboard-fan-meta">
        <strong>{limitedRate.toFixed(1)}%</strong>
        <span>Order cancellation rate</span>
        <small>{formatNumber(cancelledOrders)} cancelled orders</small>
      </div>
    </div>
  )
}

function HorizontalBarChart({
  items,
}: {
  items: Array<{ label: string; value: number }>
}) {
  if (!items.length) {
    return <p className="role-muted">No bar chart data available in the selected scope.</p>
  }

  const maxValue = Math.max(1, ...items.map((item) => item.value))

  return (
    <div className="admin-dashboard-bar-chart">
      {items.map((item) => {
        const widthPercent = Math.round((item.value / maxValue) * 100)
        return (
          <div key={item.label} className="admin-dashboard-bar-row">
            <span>{item.label}</span>
            <div className="admin-dashboard-bar-track">
              <div className="admin-dashboard-bar-fill" style={{ width: `${widthPercent}%` }} />
            </div>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        )
      })}
    </div>
  )
}

function buildRevenueLinePoints(
  orders: DashboardOrderSummary[],
  range: TimeRangeOption,
): LineChartPoint[] {
  const now = new Date()

  function aggregateByTemplate(
    template: Array<{ key: string; label: string }>,
    mapper: (orderDate: Date) => string,
  ): LineChartPoint[] {
    const bucket = new Map<string, number>()
    for (const item of template) {
      bucket.set(item.key, 0)
    }

    for (const order of orders) {
      if (!REVENUE_STATUSES.has(normalizeStatus(order.status))) {
        continue
      }
      const parsed = order.createdAt ? new Date(order.createdAt) : null
      if (!parsed || Number.isNaN(parsed.getTime())) {
        continue
      }
      const bucketKey = mapper(parsed)
      if (!bucket.has(bucketKey)) {
        continue
      }
      bucket.set(bucketKey, (bucket.get(bucketKey) || 0) + (order.totalAmount || 0))
    }

    return template.map((item) => ({
      label: item.label,
      value: bucket.get(item.key) || 0,
    }))
  }

  if (range === 'DAY') {
    const template = Array.from({ length: 24 }, (_, hour) => ({
      key: `${hour}`,
      label: `${String(hour).padStart(2, '0')}h`,
    }))
    return aggregateByTemplate(template, (date) => `${date.getHours()}`)
  }

  if (range === 'MONTH') {
    const year = now.getFullYear()
    const month = now.getMonth()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const template = Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1
      return {
        key: `${day}`,
        label: `${day}`,
      }
    })
    return aggregateByTemplate(template, (date) => `${date.getDate()}`)
  }

  if (range === 'QUARTER') {
    const currentMonth = now.getMonth()
    const quarterStart = Math.floor(currentMonth / 3) * 3
    const template = Array.from({ length: 3 }, (_, index) => {
      const monthIndex = quarterStart + index
      return {
        key: `${monthIndex}`,
        label: `M${monthIndex + 1}`,
      }
    })
    return aggregateByTemplate(template, (date) => `${date.getMonth()}`)
  }

  if (range === 'YEAR') {
    const template = Array.from({ length: 12 }, (_, index) => ({
      key: `${index}`,
      label: `M${index + 1}`,
    }))
    return aggregateByTemplate(template, (date) => `${date.getMonth()}`)
  }

  const template = Array.from({ length: 12 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`
    const monthLabel = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    return { key: monthKey, label: monthLabel }
  })

  return aggregateByTemplate(template, (date) => `${date.getFullYear()}-${date.getMonth()}`)
}

function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [baseLoaded, setBaseLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selectedPartnerKey, setSelectedPartnerKey] = useState(ALL_PARTNERS_KEY)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('DAY')
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([])
  const [partnerLabelMap, setPartnerLabelMap] = useState<Record<string, string>>({
    [UNMAPPED_PARTNER_KEY]: 'Unmapped shop',
  })
  const [orders, setOrders] = useState<DashboardOrderSummary[]>([])
  const [orderTotalInRange, setOrderTotalInRange] = useState(0)
  const [ordersTruncated, setOrdersTruncated] = useState(false)
  const [orderPartnerKeysMap, setOrderPartnerKeysMap] = useState<Record<string, string[]>>({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')

  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalPartners: 0,
    totalProducts: 0,
    totalOrders: 0,
  })

  const detailCacheRef = useRef<Record<string, DashboardOrderDetail>>({})
  const orderPartnerMapRef = useRef<Record<string, string[]>>({})
  const lastLoadedRangeRef = useRef<TimeRangeOption | ''>('')
  const selectedTimeRangeRef = useRef<TimeRangeOption>('DAY')
  const productPartnerByIdRef = useRef<Record<string, string>>({})

  useEffect(() => {
    selectedTimeRangeRef.current = selectedTimeRange
  }, [selectedTimeRange])

  const enrichOrderPartnerKeys = useCallback(
    async (
      targetOrders: DashboardOrderSummary[],
      productShopMap: Record<string, string>,
    ) => {
      if (!targetOrders.length || !Object.keys(productShopMap).length) {
        const emptyMap: Record<string, string[]> = {}
        for (const order of targetOrders) {
          emptyMap[order.orderCode] = []
        }
        orderPartnerMapRef.current = emptyMap
        setOrderPartnerKeysMap(emptyMap)
        return
      }

      const nextMap: Record<string, string[]> = {}
      const orderCodes = new Set(targetOrders.map((order) => order.orderCode))

      for (const [orderCode, partnerKeys] of Object.entries(orderPartnerMapRef.current)) {
        if (orderCodes.has(orderCode)) {
          nextMap[orderCode] = partnerKeys
        }
      }

      const ordersToResolve = targetOrders.filter((order) => !nextMap[order.orderCode])

      await runWithConcurrency(ordersToResolve, DETAIL_FETCH_CONCURRENCY, async (order) => {
        try {
          let detail = detailCacheRef.current[order.orderCode]
          if (!detail) {
            const response = await apis().get(endpoints.orders.detail(order.orderCode))
            detail = extractApiData<DashboardOrderDetail>(response)
            detailCacheRef.current[order.orderCode] = detail
          }

          const partnerKeys = Array.from(
            new Set(
              (detail.items || [])
                .map((item) => productShopMap[item.productId])
                .filter(Boolean),
            ),
          )
          nextMap[order.orderCode] = partnerKeys
        } catch {
          nextMap[order.orderCode] = []
        }
      })

      orderPartnerMapRef.current = nextMap
      setOrderPartnerKeysMap(nextMap)
    },
    [],
  )

  const loadAnalytics = useCallback(
    async (
      range: TimeRangeOption,
      productShopMapOverride?: Record<string, string>,
      showLoading = true,
    ) => {
      const productShopMap = productShopMapOverride || productPartnerByIdRef.current
      if (showLoading) {
        setAnalyticsLoading(true)
      }
      setError('')

      try {
        const rangeBounds = resolveRangeBounds(range)
        const firstResponse = await apis().get(endpoints.orders.list, {
          params: {
            ...rangeBounds,
            page: 0,
            size: ORDER_PAGE_SIZE,
          },
        })
        const firstPageData = extractApiData<DashboardOrderListResponse>(firstResponse)

        const firstPageOrders = Array.isArray(firstPageData.content) ? firstPageData.content : []
        const safeTotalPages = Number.isFinite(firstPageData.totalPages as number)
          ? Math.max(0, Number(firstPageData.totalPages))
          : (firstPageOrders.length > 0 ? 1 : 0)
        const safeTotalElements = Number.isFinite(firstPageData.totalElements as number)
          ? Math.max(0, Number(firstPageData.totalElements))
          : firstPageOrders.length
        const pagesToFetch = Math.min(safeTotalPages, MAX_ANALYTICS_ORDER_PAGES)

        let mergedOrders = [...firstPageOrders]
        if (pagesToFetch > 1) {
          const pageRequests = Array.from({ length: pagesToFetch - 1 }, (_, index) => index + 1)
          const restResponses = await Promise.all(
            pageRequests.map((page) =>
              apis().get(endpoints.orders.list, {
                params: {
                  ...rangeBounds,
                  page,
                  size: ORDER_PAGE_SIZE,
                },
              }),
            ),
          )
          const restOrders = restResponses.flatMap((response) => {
            const pageData = extractApiData<DashboardOrderListResponse>(response)
            return Array.isArray(pageData.content) ? pageData.content : []
          })
          mergedOrders = mergedOrders.concat(restOrders)
        }

        await enrichOrderPartnerKeys(mergedOrders, productShopMap)

        setOrders(mergedOrders)
        setOrderTotalInRange(safeTotalElements)
        setOrdersTruncated(safeTotalPages > MAX_ANALYTICS_ORDER_PAGES)
        setLastUpdatedAt(new Date().toISOString())
        lastLoadedRangeRef.current = range
      } catch (err) {
        setOrders([])
        setOrderTotalInRange(0)
        setOrdersTruncated(false)
        setError(extractApiErrorMessage(err, 'Unable to load dashboard chart data.'))
      } finally {
        if (showLoading) {
          setAnalyticsLoading(false)
        }
      }
    },
    [enrichOrderPartnerKeys],
  )

  const initializeDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [userSummaryResponse, inventorySummaryResponse, totalOrdersResponse, partnersResponse, catalogResponse] =
        await Promise.all([
          apis().get(endpoints.auth.usersSummary),
          apis().get(endpoints.inventories.summary),
          apis().get(endpoints.orders.list, { params: { page: 0, size: 1 } }),
          apis().get(endpoints.auth.users, {
            params: {
              roleCode: 'SHOPEE_PARTNER',
              page: 0,
              size: 200,
            },
          }),
          apis().get(endpoints.inventories.catalog),
        ])

      const userSummary = extractApiData<SystemUserSummaryResponse>(userSummaryResponse)
      const inventorySummary = extractApiData<InventorySummaryResponse>(inventorySummaryResponse)
      const totalOrdersData = extractApiData<DashboardOrderListResponse>(totalOrdersResponse)
      const partnerData = extractApiData<AdminUserListResponse>(partnersResponse)
      const catalogData = extractApiData<InventoryCatalogItem[]>(catalogResponse)

      const catalogItems = Array.isArray(catalogData) ? catalogData : []
      const partnerUsers = Array.isArray(partnerData.content) ? partnerData.content : []
      const { partnerOptions: resolvedPartnerOptions, partnerLabelMap: resolvedPartnerLabelMap, productPartnerById: resolvedProductPartnerMap } =
        buildPartnerOptions(catalogItems, partnerUsers)

      setPartnerOptions(resolvedPartnerOptions)
      setPartnerLabelMap(resolvedPartnerLabelMap)
      productPartnerByIdRef.current = resolvedProductPartnerMap
      setSystemStats({
        totalUsers: userSummary?.totalUsers || 0,
        totalPartners: userSummary?.totalPartners || resolvedPartnerOptions.length,
        totalProducts: inventorySummary?.totalProducts || 0,
        totalOrders: totalOrdersData?.totalElements || 0,
      })

      await loadAnalytics(selectedTimeRangeRef.current, resolvedProductPartnerMap, true)
      setBaseLoaded(true)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Unable to load system overview data.'))
      setBaseLoaded(false)
    } finally {
      setLoading(false)
    }
  }, [loadAnalytics])

  useEffect(() => {
    void initializeDashboard()
  }, [initializeDashboard])

  useEffect(() => {
    if (!baseLoaded) {
      return
    }

    if (lastLoadedRangeRef.current === selectedTimeRange) {
      return
    }

    void loadAnalytics(selectedTimeRange)
  }, [baseLoaded, loadAnalytics, selectedTimeRange])

  useEffect(() => {
    if (!baseLoaded) {
      return
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    function handleRealtimeEvent(event: Event) {
      const customEvent = event as CustomEvent<NotificationStreamEventDetail>
      const eventName = customEvent.detail?.eventName?.trim() || ''
      if (!shouldRefreshAdminDashboard(eventName)) {
        return
      }

      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }

      debounceTimer = window.setTimeout(() => {
        void loadAnalytics(selectedTimeRange, undefined, false)
      }, DASHBOARD_REFRESH_DEBOUNCE_MS)
    }

    window.addEventListener(APP_NOTIFICATION_EVENT, handleRealtimeEvent as EventListener)
    return () => {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleRealtimeEvent as EventListener)
    }
  }, [baseLoaded, loadAnalytics, selectedTimeRange])

  const filteredOrders = useMemo(() => {
    if (selectedPartnerKey === ALL_PARTNERS_KEY) {
      return orders
    }

    return orders.filter((order) =>
      (orderPartnerKeysMap[order.orderCode] || []).includes(selectedPartnerKey),
    )
  }, [orderPartnerKeysMap, orders, selectedPartnerKey])

  const pendingOrders = useMemo(
    () => filteredOrders.filter((order) => PENDING_STATUSES.has(normalizeStatus(order.status))).length,
    [filteredOrders],
  )

  const cancelledOrders = useMemo(
    () => filteredOrders.filter((order) => normalizeStatus(order.status) === 'CANCELLED').length,
    [filteredOrders],
  )

  const totalRevenue = useMemo(
    () =>
      filteredOrders.reduce((sum, order) => (
        REVENUE_STATUSES.has(normalizeStatus(order.status))
          ? sum + (order.totalAmount || 0)
          : sum
      ), 0),
    [filteredOrders],
  )

  const displayCurrency = filteredOrders.find((order) => order.currency)?.currency || 'VND'

  const statusDistribution = useMemo(() => {
    const statusCountMap: Record<string, number> = {}
    for (const order of filteredOrders) {
      const status = normalizeStatus(order.status)
      statusCountMap[status] = (statusCountMap[status] || 0) + 1
    }
    return Object.entries(statusCountMap)
      .map(([status, value]) => ({
        status,
        label: STATUS_LABEL_MAP[status] || status,
        value,
      }))
      .sort((first, second) => second.value - first.value)
  }, [filteredOrders])

  const pieChartItems = useMemo(
    () =>
      statusDistribution.map((item, index) => ({
        label: item.label,
        value: item.value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [statusDistribution],
  )

  const revenueLinePoints = useMemo(
    () => buildRevenueLinePoints(filteredOrders, selectedTimeRange),
    [filteredOrders, selectedTimeRange],
  )

  const cancelRate = filteredOrders.length > 0 ? (cancelledOrders / filteredOrders.length) * 100 : 0

  const barChartData = useMemo(() => {
    if (selectedPartnerKey !== ALL_PARTNERS_KEY) {
      return statusDistribution
        .slice(0, 8)
        .map((item) => ({ label: item.label, value: item.value }))
    }

    const partnerRevenueMap: Record<string, number> = {}
    for (const order of filteredOrders) {
      if (!REVENUE_STATUSES.has(normalizeStatus(order.status))) {
        continue
      }
      const partnerKeys = orderPartnerKeysMap[order.orderCode] || []
      const resolvedKeys = partnerKeys.length > 0 ? partnerKeys : [UNMAPPED_PARTNER_KEY]
      const portion = (order.totalAmount || 0) / resolvedKeys.length

      for (const partnerKey of resolvedKeys) {
        partnerRevenueMap[partnerKey] = (partnerRevenueMap[partnerKey] || 0) + portion
      }
    }

    return Object.entries(partnerRevenueMap)
      .map(([partnerKey, value]) => ({
        label: partnerLabelMap[partnerKey] || partnerKey,
        value: Math.round(value),
      }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 8)
  }, [filteredOrders, orderPartnerKeysMap, partnerLabelMap, selectedPartnerKey, statusDistribution])

  const unmappedOrderCount = useMemo(
    () => orders.filter((order) => (orderPartnerKeysMap[order.orderCode] || []).length === 0).length,
    [orderPartnerKeysMap, orders],
  )

  const selectedPartnerLabel = selectedPartnerKey === ALL_PARTNERS_KEY
    ? 'All partners'
    : (partnerLabelMap[selectedPartnerKey] || selectedPartnerKey)

  const selectedTimeRangeLabel = TIME_RANGE_OPTIONS.find((option) => option.value === selectedTimeRange)?.label || selectedTimeRange

  if (loading) {
    return <p className="role-muted">Loading Admin Dashboard...</p>
  }

  return (
    <section className="admin-dashboard-page role-page-stack">
      <article className="role-card">
        <h2>System Overview</h2>
        <p className="role-muted">
          Multi-chart dashboard (fan, pie, bar, line) by partner scope and time range.
        </p>

        <div className="role-inline-form admin-dashboard-filter-form">
          <label>
            Shop / partner
            <select
              value={selectedPartnerKey}
              onChange={(event) => setSelectedPartnerKey(event.target.value)}
              disabled={analyticsLoading}
            >
              <option value={ALL_PARTNERS_KEY}>All</option>
              {partnerOptions.map((partner) => (
                <option key={partner.key} value={partner.key}>
                  {partner.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Time range
            <select
              value={selectedTimeRange}
              onChange={(event) => setSelectedTimeRange(event.target.value as TimeRangeOption)}
              disabled={analyticsLoading}
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => void initializeDashboard()}
            disabled={analyticsLoading}
          >
            {analyticsLoading ? 'Refreshing...' : 'Refresh dashboard'}
          </button>
        </div>

        <p className="admin-dashboard-filter-context">
          Scope: <strong>{selectedPartnerLabel}</strong> | Range: <strong>{selectedTimeRangeLabel}</strong> | Updated:
          {' '}
          <strong>{formatDateTime(lastUpdatedAt)}</strong>
        </p>

        {ordersTruncated && (
          <p className="role-muted">
            Chart data currently shows up to {formatNumber(MAX_ANALYTICS_ORDER_PAGES * ORDER_PAGE_SIZE)} newest orders in range for performance.
          </p>
        )}
        {Boolean(unmappedOrderCount) && (
          <p className="role-muted">
            {formatNumber(unmappedOrderCount)} orders are not mapped to a shop from catalog data.
          </p>
        )}
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <div className="admin-dashboard-metric-grid">
          <div className="role-metric-card">
            <span>Total users</span>
            <strong>{formatNumber(systemStats.totalUsers)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total partners</span>
            <strong>{formatNumber(systemStats.totalPartners)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total products</span>
            <strong>{formatNumber(systemStats.totalProducts)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total orders</span>
            <strong>{formatNumber(systemStats.totalOrders)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Revenue</span>
            <strong>{formatMoney(totalRevenue, displayCurrency)}</strong>
            <small>{selectedTimeRangeLabel} - {selectedPartnerLabel}</small>
          </div>
          <div className="role-metric-card">
            <span>Pending orders</span>
            <strong>{formatNumber(pendingOrders)}</strong>
            <small>{selectedTimeRangeLabel} - {selectedPartnerLabel}</small>
          </div>
          <div className="role-metric-card">
            <span>Cancelled orders</span>
            <strong>{formatNumber(cancelledOrders)}</strong>
            <small>{selectedTimeRangeLabel} - {selectedPartnerLabel}</small>
          </div>
        </div>

        <p className="role-muted admin-dashboard-metric-footnote">
          Orders in current range: <strong>{formatNumber(orderTotalInRange)}</strong> |
          After partner filter: <strong>{formatNumber(filteredOrders.length)}</strong>
        </p>
      </article>

      <article className="role-card">
        <h3>Analytics charts</h3>
        {analyticsLoading && <p className="role-muted">Loading chart data...</p>}

        <div className="admin-dashboard-chart-grid">
          <section className="admin-dashboard-chart-card">
            <h4>Pie chart: Order status distribution</h4>
            <StatusPieChart items={pieChartItems} />
          </section>

          <section className="admin-dashboard-chart-card">
            <h4>Fan chart: Order cancellation rate</h4>
            <CancelFanChart cancelRate={cancelRate} cancelledOrders={cancelledOrders} />
          </section>

          <section className="admin-dashboard-chart-card">
            <h4>
              {selectedPartnerKey === ALL_PARTNERS_KEY
                ? 'Bar chart: Top shops by revenue'
                : 'Bar chart: Status distribution for selected shop'}
            </h4>
            <HorizontalBarChart items={barChartData} />
          </section>

          <section className="admin-dashboard-chart-card admin-dashboard-chart-card-wide">
            <h4>Line chart: Revenue trend</h4>
            <RevenueLineChart points={revenueLinePoints} />
          </section>
        </div>
      </article>
    </section>
  )
}

export default AdminDashboardPage
