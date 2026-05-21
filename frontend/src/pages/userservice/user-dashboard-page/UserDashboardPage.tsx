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
import { useI18n } from '../../../i18n/I18nProvider'
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
  const { t } = useI18n()
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
        setError(t('pages.userDashboard.errors.missingUserId'))
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
        setError(extractApiErrorMessage(err, t('pages.userDashboard.errors.loadFailed')))
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [session?.userId, t])

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
        setPartnerRequestError(t('pages.userDashboard.errors.refreshSessionFailed'))
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

      setPartnerRequestSuccess(t('pages.userDashboard.partner.success.approvedAndEnabled'))
    } catch (sessionError) {
      setPartnerRequestError(
        extractApiErrorMessage(sessionError, t('pages.userDashboard.errors.updateSessionFailed')),
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
        setPartnerRequestError(streamEvent.reviewNote || t('pages.userDashboard.partner.errors.rejected'))
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
  }, [session?.userId, t])

  async function handleSubmitPartnerRequest() {
    if (!isUserRole) {
      return
    }

    const normalizedShopName = partnerShopName.trim()
    if (!normalizedShopName) {
      setPartnerRequestError(t('pages.userDashboard.partner.errors.shopNameRequired'))
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
      setPartnerRequestSuccess(t('pages.userDashboard.partner.success.requestSent'))
    } catch (err) {
      setPartnerRequestError(extractApiErrorMessage(err, t('pages.userDashboard.partner.errors.submitFailed')))
    } finally {
      setPartnerRequestSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="user-dashboard-page role-page-stack">
        <article className="role-card user-dashboard-loading">
          <p className="role-muted">{t('pages.userDashboard.loading')}</p>
        </article>
      </section>
    )
  }

  return (
    <section className="user-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card user-dashboard-hero">
        <div className="user-dashboard-hero-main">
          <p className="user-dashboard-overline">{t('pages.userDashboard.overline')}</p>
          <h2>{t('pages.userDashboard.welcomeBack', undefined, { name: displayName })}</h2>
          <p className="role-muted">
            {t('pages.userDashboard.heroSubtitle')}
          </p>
        </div>

        <div className="user-dashboard-identity-panel">
          <span>{t('pages.userDashboard.currentRole')}</span>
          <strong>{session?.role || 'UNKNOWN'}</strong>
          <small>{t('pages.userDashboard.lastOrder', undefined, { date: formatDate(latestOrderAt) })}</small>
        </div>

        <div className="role-metric-grid user-dashboard-metric-grid">
          <div className="role-metric-card">
            <span>{t('pages.userDashboard.metrics.totalOrders')}</span>
            <strong>{formatCount(totalOrders)}</strong>
          </div>
          <div className="role-metric-card">
            <span>{t('pages.userDashboard.metrics.recentOrderValue')}</span>
            <strong>{formatMoney(recentTotal, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>{t('pages.userDashboard.metrics.averageRecent5')}</span>
            <strong>{formatMoney(recentAverageValue, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>{t('pages.userDashboard.metrics.accountEmail')}</span>
            <strong>{profile?.email || '-'}</strong>
          </div>
        </div>
      </article>

      <article className="role-card user-dashboard-status-card">
        <h3>{t('pages.userDashboard.orderStatusSnapshot')}</h3>
        {!statusBreakdown.length && <p className="role-muted">{t('pages.userDashboard.emptyOrders')}</p>}
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
          <h3>{t('pages.userDashboard.partner.title')}</h3>
          <p className="role-muted">
            {t('pages.userDashboard.partner.subtitle')}
          </p>

          {partnerRequest && (
            <div className={`user-dashboard-partner-status is-${toStatusClassToken(partnerRequest.status)}`}>
              <div className="user-dashboard-partner-status-head">
                <span>{t('pages.userDashboard.partner.currentStatus')}</span>
                <strong>{partnerRequest.status}</strong>
              </div>
              <small>{t('pages.userDashboard.partner.shopName', undefined, { value: partnerRequest.shopName || '-' })}</small>
              <small>
                {t('pages.userDashboard.partner.requestedReviewedAt', undefined, {
                  requestedAt: formatDate(partnerRequest.createdAt),
                  reviewedAt: formatDate(partnerRequest.reviewedAt),
                })}
              </small>
              {partnerRequest.reviewNote && (
                <small>{t('pages.userDashboard.partner.reviewNote', undefined, { note: partnerRequest.reviewNote })}</small>
              )}
            </div>
          )}

          {partnerRequestError && <p className="role-error">{partnerRequestError}</p>}
          {partnerRequestSuccess && <p className="role-muted">{partnerRequestSuccess}</p>}

          {canSubmitNewPartnerRequest && (
            <>
              <label className="user-dashboard-partner-note">
                {t('pages.userDashboard.partner.form.shopName')}
                <input
                  value={partnerShopName}
                  onChange={(event) => setPartnerShopName(event.target.value)}
                  placeholder={t('pages.userDashboard.partner.form.placeholders.shopName')}
                  disabled={partnerRequestSubmitting}
                />
              </label>
              <label className="user-dashboard-partner-note">
                {t('pages.userDashboard.partner.form.requestNoteOptional')}
                <textarea
                  value={partnerRequestNote}
                  onChange={(event) => setPartnerRequestNote(event.target.value)}
                  placeholder={t('pages.userDashboard.partner.form.placeholders.requestNote')}
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
                  {partnerRequestSubmitting
                    ? t('pages.userDashboard.partner.form.sending')
                    : t('pages.userDashboard.partner.form.submit')}
                </button>
              </div>
            </>
          )}

          {partnerRequest?.status === 'PENDING' && (
            <p className="role-muted">{t('pages.userDashboard.partner.pendingMessage')}</p>
          )}

          {partnerRequest?.status === 'APPROVED' && (
            <p className="role-muted">
              {t('pages.userDashboard.partner.approvedMessage')}
            </p>
          )}
        </article>
      )}

      <article className="role-card user-dashboard-orders-card">
        <h3>{t('pages.userDashboard.recentOrders')}</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('pages.userDashboard.table.orderCode')}</th>
                <th>{t('pages.userDashboard.table.status')}</th>
                <th>{t('pages.userDashboard.table.totalAmount')}</th>
                <th>{t('pages.userDashboard.table.createdAt')}</th>
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
                    {t('pages.userDashboard.emptyOrders')}
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
