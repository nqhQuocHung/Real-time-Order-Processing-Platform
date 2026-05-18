import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchMyProfile } from '../../../auth/authSession'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
  refreshSessionToken,
  setAuthSession,
} from '../../../config/apis'
import { AppRole, resolvePrimaryRole } from '../../../constants/roles'
import './UserDashboardPage.css'

const APP_NOTIFICATION_EVENT = 'app-notification-event'

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

type PartnerRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type PartnerUpgradeRequestResponse = {
  requestId: string
  status: PartnerRequestStatus
  shopName?: string
  requestNote?: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt?: string
}

type PartnerRequestDecidedEvent = {
  requestId: string
  userId: string
  decision?: string
  status?: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
}

type NotificationStreamEventDetail = {
  eventName?: string
  payload?: unknown
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
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value || 0)))
}

function normalizeStatus(value?: string | null): string {
  return value?.trim().toUpperCase() || 'UNKNOWN'
}

function toStatusClassToken(value?: string | null): string {
  return normalizeStatus(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function resolveDisplayName(profile: UserProfile | null, sessionUsername?: string): string {
  const first = profile?.firstName?.trim() || ''
  const last = profile?.lastName?.trim() || ''
  const full = [first, last].filter(Boolean).join(' ').trim()
  if (full) {
    return full
  }
  return profile?.username || sessionUsername || 'User'
}

function UserDashboardPage() {
  const session = getAuthSession()
  const promotingSessionRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [partnerRequest, setPartnerRequest] = useState<PartnerUpgradeRequestResponse | null>(null)
  const [partnerShopName, setPartnerShopName] = useState('')
  const [partnerRequestNote, setPartnerRequestNote] = useState('')
  const [partnerRequestSubmitting, setPartnerRequestSubmitting] = useState(false)
  const [partnerRequestError, setPartnerRequestError] = useState('')
  const [partnerRequestSuccess, setPartnerRequestSuccess] = useState('')

  const isUserRole = session?.role === AppRole.USER

  useEffect(() => {
    async function loadDashboard() {
      if (!session?.userId) {
        setError('Cannot find current user information.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      setPartnerRequestError('')

      try {
        const [profileData, ordersResponse, partnerRequestResponse] = await Promise.all([
          fetchMyProfile(),
          apis().get(endpoints.orders.list, {
            params: {
              customerId: session.userId,
              page: 0,
              size: 5,
            },
          }),
          apis().get(endpoints.auth.myPartnerRequest),
        ])

        const orderData = extractApiData<OrderListResponse>(ordersResponse)
        const partnerRequestData = extractApiData<PartnerUpgradeRequestResponse | null>(
          partnerRequestResponse,
        )

        setProfile(profileData)
        setOrders(orderData.content || [])
        setTotalOrders(orderData.totalElements || 0)
        setPartnerRequest(partnerRequestData || null)
        setPartnerShopName(partnerRequestData?.shopName || '')
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

  const recentAverageValue = useMemo(() => {
    if (!orders.length) {
      return 0
    }
    return recentTotal / orders.length
  }, [orders.length, recentTotal])

  const latestOrderAt = useMemo(() => orders[0]?.createdAt, [orders])

  const statusBreakdown = useMemo(() => {
    const counter = new Map<string, number>()
    for (const order of orders) {
      const key = normalizeStatus(order.status)
      counter.set(key, (counter.get(key) || 0) + 1)
    }

    return Array.from(counter.entries())
      .map(([status, value]) => ({ status, value }))
      .sort((first, second) => second.value - first.value)
  }, [orders])

  const maxStatusCount = useMemo(
    () => Math.max(1, ...statusBreakdown.map((item) => item.value)),
    [statusBreakdown],
  )

  const displayName = useMemo(
    () => resolveDisplayName(profile, session?.username),
    [profile, session?.username],
  )

  const canSubmitNewPartnerRequest =
    partnerRequest?.status !== 'PENDING' && partnerRequest?.status !== 'APPROVED'

  async function promoteSessionToPartnerIfNeeded() {
    if (promotingSessionRef.current) {
      return
    }

    promotingSessionRef.current = true
    try {
      const refreshed = await refreshSessionToken()
      if (!refreshed) {
        setPartnerRequestError('Cannot refresh session token after partner approval.')
        return
      }

      const profileResponse = await fetchMyProfile()
      const backendRoles = profileResponse.roles || []
      const role = resolvePrimaryRole(backendRoles)

      setAuthSession({
        userId: profileResponse.userId || session?.userId || '',
        username: profileResponse.username || session?.username || '',
        email: profileResponse.email || session?.email || '',
        role,
        backendRoles,
        backendPermissions: profileResponse.permissions || [],
        backendMenus: profileResponse.menus || [],
      })

      setPartnerRequestSuccess('Your partner request was approved. Partner workspace is now available.')
    } catch (sessionError) {
      setPartnerRequestError(
        extractApiErrorMessage(sessionError, 'Cannot update session after partner approval.'),
      )
    } finally {
      promotingSessionRef.current = false
    }
  }

  useEffect(() => {
    function handleNotificationEvent(event: Event) {
      const customEvent = event as CustomEvent<NotificationStreamEventDetail>
      if (customEvent.detail?.eventName !== 'partner.request.decided') {
        return
      }

      const payload = customEvent.detail?.payload
      if (!payload || typeof payload !== 'object') {
        return
      }

      const streamEvent = payload as PartnerRequestDecidedEvent
      if (!session?.userId || streamEvent.userId !== session.userId) {
        return
      }

      setPartnerRequest((previous) => ({
        requestId: streamEvent.requestId,
        status: (streamEvent.status as PartnerRequestStatus) || previous?.status || 'PENDING',
        shopName: previous?.shopName,
        requestNote: previous?.requestNote,
        reviewNote: streamEvent.reviewNote,
        reviewedBy: streamEvent.reviewedBy,
        reviewedAt: streamEvent.reviewedAt,
        createdAt: previous?.createdAt,
      }))

      if (streamEvent.status === 'APPROVED' || streamEvent.decision === 'APPROVE') {
        setPartnerRequestError('')
        void promoteSessionToPartnerIfNeeded()
      }

      if (streamEvent.status === 'REJECTED' || streamEvent.decision === 'REJECT') {
        setPartnerRequestSuccess('')
        setPartnerRequestError(streamEvent.reviewNote || 'Your partner upgrade request was rejected.')
      }
    }

    window.addEventListener(
      APP_NOTIFICATION_EVENT,
      handleNotificationEvent as EventListener,
    )

    return () => {
      window.removeEventListener(
        APP_NOTIFICATION_EVENT,
        handleNotificationEvent as EventListener,
      )
    }
  }, [session?.userId])

  async function handleSubmitPartnerRequest() {
    if (!isUserRole) {
      return
    }

    const normalizedShopName = partnerShopName.trim()
    if (!normalizedShopName) {
      setPartnerRequestError('Shop name is required.')
      return
    }

    setPartnerRequestError('')
    setPartnerRequestSuccess('')
    setPartnerRequestSubmitting(true)

    try {
      const response = await apis().post(endpoints.auth.partnerRequests, {
        shopName: normalizedShopName,
        requestNote: partnerRequestNote.trim() || undefined,
      })
      const createdRequest = extractApiData<PartnerUpgradeRequestResponse>(response)
      setPartnerRequest(createdRequest)
      setPartnerShopName(createdRequest.shopName || normalizedShopName)
      setPartnerRequestNote('')
      setPartnerRequestSuccess('Partner upgrade request sent successfully. Admin will review soon.')
    } catch (err) {
      setPartnerRequestError(extractApiErrorMessage(err, 'Cannot send partner upgrade request.'))
    } finally {
      setPartnerRequestSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="user-dashboard-page role-page-stack">
        <article className="role-card user-dashboard-loading">
          <p className="role-muted">Loading User Dashboard...</p>
        </article>
      </section>
    )
  }

  return (
    <section className="user-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card user-dashboard-hero">
        <div className="user-dashboard-hero-main">
          <p className="user-dashboard-overline">User Command Center</p>
          <h2>Welcome back, {displayName}</h2>
          <p className="role-muted">
            Track your order flow, spending, and partner upgrade progress from one dashboard.
          </p>
        </div>

        <div className="user-dashboard-identity-panel">
          <span>Current Role</span>
          <strong>{session?.role || 'UNKNOWN'}</strong>
          <small>Last order: {formatDate(latestOrderAt)}</small>
        </div>

        <div className="role-metric-grid user-dashboard-metric-grid">
          <div className="role-metric-card">
            <span>Total Orders</span>
            <strong>{formatCount(totalOrders)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Recent Order Value</span>
            <strong>{formatMoney(recentTotal, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Average (Recent 5)</span>
            <strong>{formatMoney(recentAverageValue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Account Email</span>
            <strong>{profile?.email || '-'}</strong>
          </div>
        </div>
      </article>

      <article className="role-card user-dashboard-status-card">
        <h3>Order Status Snapshot</h3>
        {!statusBreakdown.length && <p className="role-muted">No orders yet.</p>}
        {!!statusBreakdown.length && (
          <div className="user-dashboard-status-bars">
            {statusBreakdown.map((item) => {
              const widthPercent = Math.round((item.value / maxStatusCount) * 100)
              return (
                <div className="user-dashboard-status-row" key={item.status}>
                  <span>{item.status}</span>
                  <div className="user-dashboard-status-track">
                    <div
                      className={`user-dashboard-status-fill is-${toStatusClassToken(item.status)}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <strong>{formatCount(item.value)}</strong>
                </div>
              )
            })}
          </div>
        )}
      </article>

      {isUserRole && (
        <article className="role-card user-dashboard-partner-card">
          <h3>Become a Partner</h3>
          <p className="role-muted">
            Send a request to upgrade your account to partner role. Admin will review and respond.
          </p>

          {partnerRequest && (
            <div className={`user-dashboard-partner-status is-${toStatusClassToken(partnerRequest.status)}`}>
              <div className="user-dashboard-partner-status-head">
                <span>Current Request Status</span>
                <strong>{partnerRequest.status}</strong>
              </div>
              <small>Shop name: {partnerRequest.shopName || '-'}</small>
              <small>
                Requested at: {formatDate(partnerRequest.createdAt)} | Reviewed at:{' '}
                {formatDate(partnerRequest.reviewedAt)}
              </small>
              {partnerRequest.reviewNote && (
                <small>Review note: {partnerRequest.reviewNote}</small>
              )}
            </div>
          )}

          {partnerRequestError && <p className="role-error">{partnerRequestError}</p>}
          {partnerRequestSuccess && <p className="role-muted">{partnerRequestSuccess}</p>}

          {canSubmitNewPartnerRequest && (
            <>
              <label className="user-dashboard-partner-note">
                Shop name
                <input
                  value={partnerShopName}
                  onChange={(event) => setPartnerShopName(event.target.value)}
                  placeholder="Your public shop name"
                  disabled={partnerRequestSubmitting}
                />
              </label>
              <label className="user-dashboard-partner-note">
                Request note (optional)
                <textarea
                  value={partnerRequestNote}
                  onChange={(event) => setPartnerRequestNote(event.target.value)}
                  placeholder="Describe your business and why you need partner access"
                  disabled={partnerRequestSubmitting}
                />
              </label>
              <div className="role-inline-actions">
                <button
                  type="button"
                  className="role-btn-primary"
                  onClick={() => void handleSubmitPartnerRequest()}
                  disabled={partnerRequestSubmitting}
                >
                  {partnerRequestSubmitting ? 'Sending Request...' : 'Request Partner Upgrade'}
                </button>
              </div>
            </>
          )}

          {partnerRequest?.status === 'PENDING' && (
            <p className="role-muted">Your request is pending admin review.</p>
          )}

          {partnerRequest?.status === 'APPROVED' && (
            <p className="role-muted">
              Your request is approved. Partner workspace is enabled for this session.
            </p>
          )}
        </article>
      )}

      <article className="role-card user-dashboard-orders-card">
        <h3>Recent Orders</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Order Code</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order.orderCode}>
                  <td>{index + 1}</td>
                  <td>{order.orderCode}</td>
                  <td>
                    <span className={`user-dashboard-order-status is-${toStatusClassToken(order.status)}`}>
                      {normalizeStatus(order.status)}
                    </span>
                  </td>
                  <td>{formatMoney(order.totalAmount, order.currency)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={5} className="role-empty-cell">
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
