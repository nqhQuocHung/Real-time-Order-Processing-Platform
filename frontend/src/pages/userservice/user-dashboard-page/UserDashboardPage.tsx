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
import useNotificationStream from '../../../hooks/useNotificationStream'
import './UserDashboardPage.css'

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
  requestNote?: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt?: string
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

function UserDashboardPage() {
  const session = getAuthSession()
  const promotingSessionRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [partnerRequest, setPartnerRequest] = useState<PartnerUpgradeRequestResponse | null>(null)
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

      const profile = await fetchMyProfile()
      const backendRoles = profile.roles || []
      const role = resolvePrimaryRole(backendRoles)

      setAuthSession({
        userId: profile.userId || session?.userId || '',
        username: profile.username || session?.username || '',
        email: profile.email || session?.email || '',
        role,
        backendRoles,
        backendPermissions: profile.permissions || [],
        backendMenus: profile.menus || [],
      })

      setPartnerRequestSuccess('Your partner request was approved. Partner workspace is now available.')
    } catch (error) {
      setPartnerRequestError(
        extractApiErrorMessage(error, 'Cannot update session after partner approval.'),
      )
    } finally {
      promotingSessionRef.current = false
    }
  }

  useNotificationStream({
    enabled: Boolean(session?.accessToken),
    onPartnerRequestDecided: (event) => {
      if (!session?.userId || event.userId !== session.userId) {
        return
      }

      setPartnerRequest((previous) => ({
        requestId: event.requestId,
        status: (event.status as PartnerRequestStatus) || previous?.status || 'PENDING',
        requestNote: previous?.requestNote,
        reviewNote: event.reviewNote,
        reviewedBy: event.reviewedBy,
        reviewedAt: event.reviewedAt,
        createdAt: previous?.createdAt,
      }))

      if (event.status === 'APPROVED' || event.decision === 'APPROVE') {
        setPartnerRequestError('')
        void promoteSessionToPartnerIfNeeded()
      }

      if (event.status === 'REJECTED' || event.decision === 'REJECT') {
        setPartnerRequestSuccess('')
        setPartnerRequestError(event.reviewNote || 'Your partner upgrade request was rejected.')
      }
    },
  })

  async function handleSubmitPartnerRequest() {
    if (!isUserRole) {
      return
    }

    setPartnerRequestError('')
    setPartnerRequestSuccess('')
    setPartnerRequestSubmitting(true)

    try {
      const response = await apis().post(endpoints.auth.partnerRequests, {
        requestNote: partnerRequestNote.trim() || undefined,
      })
      const createdRequest = extractApiData<PartnerUpgradeRequestResponse>(response)
      setPartnerRequest(createdRequest)
      setPartnerRequestNote('')
      setPartnerRequestSuccess('Partner upgrade request sent successfully. Admin will review soon.')
    } catch (err) {
      setPartnerRequestError(extractApiErrorMessage(err, 'Cannot send partner upgrade request.'))
    } finally {
      setPartnerRequestSubmitting(false)
    }
  }

  if (loading) {
    return <p className="role-muted">Loading User Dashboard...</p>
  }

  return (
    <section className="user-dashboard-page role-page-stack">
      {error && <p className="role-error">{error}</p>}

      <article className="role-card">
        <h2>User Dashboard</h2>
        <p className="role-muted">
          Hello {profile?.firstName || profile?.username || session?.username}. Here is
          an overview of your personal data.
        </p>
        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Total Orders</span>
            <strong>{totalOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>Recent Order Value</span>
            <strong>{formatMoney(recentTotal, orders[0]?.currency || 'VND')}</strong>
          </div>
          <div className="role-metric-card">
            <span>Email</span>
            <strong>{profile?.email || '-'}</strong>
          </div>
        </div>
      </article>

      {isUserRole && (
        <article className="role-card">
          <h3>Become a Partner</h3>
          <p className="role-muted">
            Send a request to upgrade your account to partner role. Admin will approve or reject.
          </p>

          {partnerRequest && (
            <div className="user-dashboard-partner-status">
              <span>Current Request Status</span>
              <strong>{partnerRequest.status}</strong>
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

          {(partnerRequest?.status !== 'PENDING' && partnerRequest?.status !== 'APPROVED') && (
            <>
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

      <article className="role-card">
        <h3>Recent Orders</h3>
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

export default UserDashboardPage
