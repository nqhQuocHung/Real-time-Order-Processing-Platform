import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import defaultAvatar from '../../../assets/default-avatar.svg'
import useNotificationStream from '../../../hooks/useNotificationStream'
import './AdminAdministrationPage.css'

type AdminUserSummary = {
  userId: string
  username: string
  email: string
  phone?: string
  status?: string
  isActive?: boolean
  emailVerified?: boolean
  roles?: string[]
  createdAt?: string
}

type AdminUserProfile = {
  userId: string
  username: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  avatar?: string
  status?: string
  isActive?: boolean
  emailVerified?: boolean
  failedLoginCount?: number
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
  roles?: string[]
}

type AdminUserListResponse = {
  content: AdminUserSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

type AdminUserStatisticsResponse = {
  totalUsers: number
  totalPartners: number
  totalActiveUsers: number
  totalInactiveUsers: number
  totalPendingUsers: number
}

type InventorySummaryResponse = {
  totalProducts: number
  totalAvailableQuantity: number
  totalReservedQuantity: number
}

type RoleSummary = {
  code: string
  name?: string
  isActive?: boolean
  menuKeys?: string[]
}

type UserFilter = {
  keyword: string
  roleCode: string
  status: string
  isActive: string
}

type UpdateUserPayload = {
  roleCodes?: string[]
}

type PartnerRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type PartnerUpgradeRequestSummary = {
  requestId: string
  userId: string
  username: string
  email: string
  status: PartnerRequestStatus
  requestNote?: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt?: string
}

type PartnerUpgradeRequestListResponse = {
  content: PartnerUpgradeRequestSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

function normalizeRoleCodes(roles?: string[]): string[] {
  return (roles || [])
    .map((role) => role.trim())
    .filter(Boolean)
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function formatBoolean(value?: boolean) {
  if (typeof value !== 'boolean') {
    return '-'
  }
  return value ? 'Yes' : 'No'
}

function formatFullName(firstName?: string, lastName?: string) {
  const name = [firstName, lastName]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ')

  return name || '-'
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

function toProfileFallback(user: AdminUserSummary): AdminUserProfile {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    phone: user.phone,
    status: user.status,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    roles: normalizeRoleCodes(user.roles),
    createdAt: user.createdAt,
  }
}

function AdminAdministrationPage() {
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [isExecutingAction, setIsExecutingAction] = useState(false)
  const [stats, setStats] = useState<AdminUserStatisticsResponse | null>(null)
  const [inventoryStats, setInventoryStats] = useState<InventorySummaryResponse | null>(null)
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [totalUsersResult, setTotalUsersResult] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [size] = useState(20)
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({})
  const [roleRemoveInputs, setRoleRemoveInputs] = useState<Record<string, string>>({})
  const [selectedUserRecord, setSelectedUserRecord] = useState<AdminUserSummary | null>(null)
  const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [partnerRequests, setPartnerRequests] = useState<PartnerUpgradeRequestSummary[]>([])
  const [loadingPartnerRequests, setLoadingPartnerRequests] = useState(true)
  const [partnerRequestError, setPartnerRequestError] = useState('')
  const [processingPartnerRequestId, setProcessingPartnerRequestId] = useState('')
  const [partnerRequestPage, setPartnerRequestPage] = useState(0)
  const [partnerRequestTotalPages, setPartnerRequestTotalPages] = useState(0)
  const [partnerRequestTotalElements, setPartnerRequestTotalElements] = useState(0)
  const [filter, setFilter] = useState<UserFilter>({
    keyword: '',
    roleCode: '',
    status: '',
    isActive: '',
  })
  const partnerRequestSize = 10

  async function loadSummary() {
    setLoadingSummary(true)
    try {
      const [userSummaryResponse, inventorySummaryResponse] = await Promise.all([
        apis().get(endpoints.auth.usersSummary),
        apis().get(endpoints.inventories.summary),
      ])

      setStats(extractApiData<AdminUserStatisticsResponse>(userSummaryResponse))
      setInventoryStats(extractApiData<InventorySummaryResponse>(inventorySummaryResponse))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load administration summary.'))
    } finally {
      setLoadingSummary(false)
    }
  }

  async function loadRoles() {
    setLoadingRoles(true)
    setRoleError('')

    try {
      const response = await apis().get(endpoints.auth.roles)
      const data = extractApiData<RoleSummary[]>(response) || []
      setRoles(data)
    } catch (err) {
      setRoles([])
      setRoleError(extractApiErrorMessage(err, 'Cannot load roles.'))
    } finally {
      setLoadingRoles(false)
    }
  }

  async function loadUsers(targetPage = page, nextFilter: UserFilter = filter) {
    setLoadingUsers(true)
    setError('')

    try {
      const trimmedKeyword = nextFilter.keyword.trim()
      const response = await apis().get(endpoints.auth.users, {
        params: {
          page: targetPage,
          size,
          keyword: trimmedKeyword.length > 0 ? trimmedKeyword : undefined,
          roleCode: nextFilter.roleCode || undefined,
          status: nextFilter.status || undefined,
          isActive:
            nextFilter.isActive === ''
              ? undefined
              : nextFilter.isActive === 'true',
        },
      })

      const data = extractApiData<AdminUserListResponse>(response)
      setUsers(data.content || [])
      const safeTotalElements = typeof data.totalElements === 'number' ? data.totalElements : 0
      const fallbackTotalPages = safeTotalElements > 0 ? Math.ceil(safeTotalElements / size) : 0
      const safeTotalPages = typeof data.totalPages === 'number' ? data.totalPages : fallbackTotalPages
      const safePage = typeof data.page === 'number' ? data.page : 0

      setTotalUsersResult(safeTotalElements)
      setTotalPages(Math.max(0, safeTotalPages))
      setPage(Math.max(0, safePage))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load account list.'))
      setUsers([])
      setTotalUsersResult(0)
      setTotalPages(0)
      setPage(0)
    } finally {
      setLoadingUsers(false)
    }
  }

async function loadPartnerRequests(
  showLoading = false,
  targetPage = partnerRequestPage,
) {
  if (showLoading) {
    setLoadingPartnerRequests(true)
  }

  setPartnerRequestError('')

  try {
    const response = await apis().get(endpoints.auth.partnerRequests, {
      params: {
        status: 'PENDING',
        page: targetPage,
        size: partnerRequestSize,
      },
    })

    const data = extractApiData<PartnerUpgradeRequestListResponse>(response)
    const items = data.content || []

    const safeTotalElements =
      typeof data.totalElements === 'number'
        ? data.totalElements
        : items.length

    const fallbackTotalPages =
      safeTotalElements > 0
        ? Math.ceil(safeTotalElements / partnerRequestSize)
        : 0

    const safeTotalPages =
      typeof data.totalPages === 'number'
        ? data.totalPages
        : fallbackTotalPages

    const safePage =
      typeof data.page === 'number'
        ? data.page
        : targetPage

    setPartnerRequests(items)
    setPartnerRequestTotalElements(safeTotalElements)
    setPartnerRequestTotalPages(Math.max(0, safeTotalPages))
    setPartnerRequestPage(Math.max(0, safePage))
  } catch (err) {
    setPartnerRequestError(
      extractApiErrorMessage(err, 'Cannot load partner requests.'),
    )
    setPartnerRequests([])
    setPartnerRequestTotalElements(0)
    setPartnerRequestTotalPages(0)
    setPartnerRequestPage(0)
  } finally {
    if (showLoading) {
      setLoadingPartnerRequests(false)
    }
  }
}
  useEffect(() => {
    void Promise.all([loadSummary(), loadRoles(), loadPartnerRequests(true, 0)])
    void loadUsers(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useNotificationStream({
    onPartnerRequestCreated: (event) => {
      toast.info(`New partner request from ${event.username || event.email || 'user'}.`)
      void loadPartnerRequests(false, partnerRequestPage)
    },
    onError: (streamError) => {
      console.error('Admin notification stream error:', streamError)
    },
  })

  const chartItems = useMemo(
    () => [
      { label: 'Users', value: stats?.totalUsers || 0 },
      { label: 'Partners', value: stats?.totalPartners || 0 },
      { label: 'Inactive', value: stats?.totalInactiveUsers || 0 },
      { label: 'Pending', value: stats?.totalPendingUsers || 0 },
      { label: 'Products', value: inventoryStats?.totalProducts || 0 },
    ],
    [stats, inventoryStats],
  )

  const maxChartValue = useMemo(() => {
    return Math.max(1, ...chartItems.map((item) => item.value))
  }, [chartItems])

  const effectiveTotalPages = useMemo(() => {
    if (totalPages > 0) {
      return totalPages
    }
    if (totalUsersResult > 0) {
      return Math.ceil(totalUsersResult / size)
    }
    return 0
  }, [size, totalPages, totalUsersResult])

  const accountPaginationPages = useMemo(
    () => buildPaginationPages(page, effectiveTotalPages),
    [effectiveTotalPages, page],
  )

  const hasPreviousPage = page > 0
  const hasNextPage = effectiveTotalPages > 0 && page < effectiveTotalPages - 1
  const currentPageStart = totalUsersResult === 0 ? 0 : page * size + 1
  const currentPageEnd = totalUsersResult === 0
    ? 0
    : Math.min((page + 1) * size, totalUsersResult)

  const effectivePartnerRequestTotalPages = useMemo(() => {
    if (partnerRequestTotalPages > 0) {
      return partnerRequestTotalPages
    }
    if (partnerRequestTotalElements > 0) {
      return Math.ceil(partnerRequestTotalElements / partnerRequestSize)
    }
    return 0
  }, [partnerRequestSize, partnerRequestTotalElements, partnerRequestTotalPages])

  const partnerRequestPaginationPages = useMemo(
    () => buildPaginationPages(partnerRequestPage, effectivePartnerRequestTotalPages),
    [effectivePartnerRequestTotalPages, partnerRequestPage],
  )

  const hasPreviousPartnerRequestPage = partnerRequestPage > 0
  const hasNextPartnerRequestPage =
    effectivePartnerRequestTotalPages > 0 &&
    partnerRequestPage < effectivePartnerRequestTotalPages - 1
  const partnerRequestPageStart = partnerRequestTotalElements === 0
    ? 0
    : partnerRequestPage * partnerRequestSize + 1
  const partnerRequestPageEnd = partnerRequestTotalElements === 0
    ? 0
    : Math.min((partnerRequestPage + 1) * partnerRequestSize, partnerRequestTotalElements)

  async function runUserAction(action: () => Promise<void>) {
    setActionError('')
    setIsExecutingAction(true)
    try {
      await action()
      await Promise.all([loadSummary(), loadUsers(page, filter)])
    } catch (err) {
      setActionError(extractApiErrorMessage(err, 'Cannot complete administration action.'))
    } finally {
      setIsExecutingAction(false)
    }
  }

  function handleSetRoleInput(userId: string, value: string) {
    setRoleInputs((prev) => ({
      ...prev,
      [userId]: value,
    }))
  }

  function handleSetRoleRemoveInput(userId: string, value: string) {
    setRoleRemoveInputs((prev) => ({
      ...prev,
      [userId]: value,
    }))
  }

  async function handleActivate(userId: string) {
    await runUserAction(async () => {
      await apis().patch(endpoints.auth.activateUser(userId))
    })
  }

  async function handleDeactivate(userId: string) {
    await runUserAction(async () => {
      await apis().patch(endpoints.auth.deactivateUser(userId))
    })
  }

  async function handleLock(userId: string) {
    await runUserAction(async () => {
      await apis().patch(endpoints.auth.lockUser(userId))
    })
  }

  async function handlePartnerRequestDecision(
    request: PartnerUpgradeRequestSummary,
    action: 'APPROVE' | 'REJECT',
  ) {
    if (processingPartnerRequestId) {
      return
    }

    setActionError('')
    setProcessingPartnerRequestId(request.requestId)
    try {
      await apis().patch(endpoints.auth.decidePartnerRequest(request.requestId), {
        action,
        reviewNote: action === 'APPROVE'
          ? 'Approved by administrator.'
          : 'Rejected by administrator.',
      })

      toast.success(
        action === 'APPROVE'
          ? `Approved partner request for ${request.username}.`
          : `Rejected partner request for ${request.username}.`,
      )

      await Promise.all([
        loadSummary(),
        loadUsers(page, filter),
        loadPartnerRequests(false, partnerRequestPage),
      ])
    } catch (err) {
      setActionError(extractApiErrorMessage(err, 'Cannot process partner request decision.'))
    } finally {
      setProcessingPartnerRequestId('')
    }
  }

  async function handleAssignRole(user: AdminUserSummary) {
    const roleCode = roleInputs[user.userId] || user.roles?.[0] || ''
    if (!roleCode) {
      setActionError('Please select a role before assigning.')
      return
    }

    await runUserAction(async () => {
      await apis().post(endpoints.auth.grantPermission, { userId: user.userId, roleCode })
      setRoleInputs((prev) => ({ ...prev, [user.userId]: '' }))
    })
  }

  async function handleRemoveRole(user: AdminUserSummary) {
    const currentRoles = normalizeRoleCodes(user.roles)
    const selectedRole = roleRemoveInputs[user.userId] || currentRoles[0] || ''
    if (!selectedRole) {
      setActionError('Please select a role before removing.')
      return
    }

    const normalizedSelectedRole = selectedRole.trim().toUpperCase()
    const remainingRoles = currentRoles.filter(
      (roleCode) => roleCode.toUpperCase() !== normalizedSelectedRole,
    )

    if (remainingRoles.length === currentRoles.length) {
      setActionError(`Role ${normalizedSelectedRole} was not found on this account.`)
      return
    }

    if (remainingRoles.length === 0) {
      setActionError('Cannot remove all roles. Keep at least one role on the account.')
      return
    }

    await runUserAction(async () => {
      const payload: UpdateUserPayload = { roleCodes: remainingRoles }
      await apis().patch(endpoints.auth.updateUser(user.userId), payload)
      setRoleRemoveInputs((prev) => ({ ...prev, [user.userId]: '' }))
    })
  }

  async function handleSearchUsers() {
    setPage(0)
    await loadUsers(0, filter)
  }

  async function handleFilterPartners() {
    const nextFilter: UserFilter = {
      ...filter,
      roleCode: 'SHOPEE_PARTNER',
    }
    setFilter(nextFilter)
    setPage(0)
    await loadUsers(0, nextFilter)
  }

  async function handleClearFilter() {
    const nextFilter: UserFilter = {
      keyword: '',
      roleCode: '',
      status: '',
      isActive: '',
    }
    setFilter(nextFilter)
    setPage(0)
    await loadUsers(0, nextFilter)
  }

  async function handleOpenUserProfile(user: AdminUserSummary) {
    setSelectedUserRecord(user)
    setSelectedUserProfile(toProfileFallback(user))
    setProfileError('')
    setLoadingProfile(true)

    try {
      const response = await apis().get(endpoints.auth.getUserById(user.userId))
      const data = extractApiData<AdminUserProfile>(response)
      setSelectedUserProfile(data || toProfileFallback(user))
    } catch (err) {
      setProfileError(extractApiErrorMessage(err, 'Cannot load user profile.'))
    } finally {
      setLoadingProfile(false)
    }
  }

  function handleCloseUserProfile() {
    setSelectedUserRecord(null)
    setSelectedUserProfile(null)
    setProfileError('')
    setLoadingProfile(false)
  }

  async function handleGoToPage(targetPage: number) {
    if (loadingUsers || isExecutingAction) {
      return
    }
    if (targetPage < 0 || targetPage >= effectiveTotalPages || targetPage === page) {
      return
    }
    await loadUsers(targetPage, filter)
  }

  async function handleGoToPartnerRequestPage(targetPage: number) {
    if (loadingPartnerRequests || Boolean(processingPartnerRequestId)) {
      return
    }
    if (
      targetPage < 0 ||
      targetPage >= effectivePartnerRequestTotalPages ||
      targetPage === partnerRequestPage
    ) {
      return
    }
    await loadPartnerRequests(true, targetPage)
  }

  const profileView = selectedUserProfile ||
    (selectedUserRecord ? toProfileFallback(selectedUserRecord) : null)

  return (
    <section className="admin-administration-page role-page-stack">
      <article className="role-card">
        <h2>Administration Center</h2>
        <p className="role-muted">
          Admin workspace for user/partner governance, role assignment, account approval, and account locking.
        </p>
      </article>

      <article className="role-card">
        <h3>Administration Metrics</h3>

        {loadingSummary && <p className="role-muted">Loading metrics...</p>}
        {!loadingSummary && (
          <>
            <div className="role-metric-grid">
              <div className="role-metric-card">
                <span>Total Users</span>
                <strong>{stats?.totalUsers || 0}</strong>
              </div>
              <div className="role-metric-card">
                <span>Total Partners</span>
                <strong>{stats?.totalPartners || 0}</strong>
              </div>
              <div className="role-metric-card">
                <span>Inactive Users</span>
                <strong>{stats?.totalInactiveUsers || 0}</strong>
              </div>
              <div className="role-metric-card">
                <span>Pending Accounts</span>
                <strong>{stats?.totalPendingUsers || 0}</strong>
              </div>
              <div className="role-metric-card">
                <span>Total Products</span>
                <strong>{inventoryStats?.totalProducts || 0}</strong>
              </div>
              <div className="role-metric-card">
                <span>Total Available Stock</span>
                <strong>{inventoryStats?.totalAvailableQuantity || 0}</strong>
              </div>
            </div>

            <div className="admin-administration-chart">
              {chartItems.map((item) => {
                const widthPercent = Math.round((item.value / maxChartValue) * 100)
                return (
                  <div className="admin-administration-chart-row" key={item.label}>
                    <span>{item.label}</span>
                    <div className="admin-administration-chart-track">
                      <div
                        className="admin-administration-chart-bar"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </article>

      <article className="role-card">
        <h3>Account Filters</h3>
        <div className="role-inline-form">
          <label>
            Keyword (username/email)
            <input
              value={filter.keyword}
              onChange={(event) =>
                setFilter((prev) => ({
                  ...prev,
                  keyword: event.target.value,
                }))
              }
              placeholder="Search by username/email (optional)"
            />
          </label>

          <label>
            Role
            <select
              value={filter.roleCode}
              onChange={(event) =>
                setFilter((prev) => ({
                  ...prev,
                  roleCode: event.target.value,
                }))
              }
            >
              <option value="">All</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.code}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              value={filter.status}
              onChange={(event) =>
                setFilter((prev) => ({
                  ...prev,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOCKED">LOCKED</option>
              <option value="DISABLED">DISABLED</option>
              <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            </select>
          </label>

          <label>
            Activation
            <select
              value={filter.isActive}
              onChange={(event) =>
                setFilter((prev) => ({
                  ...prev,
                  isActive: event.target.value,
                }))
              }
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleSearchUsers()}
            disabled={loadingUsers || isExecutingAction}
          >
            Search
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => void handleFilterPartners()}
            disabled={loadingUsers || isExecutingAction}
          >
            Partners Only
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => void handleClearFilter()}
            disabled={loadingUsers || isExecutingAction}
          >
            Clear Filters
          </button>
        </div>

        {loadingRoles && <p className="role-muted">Loading roles...</p>}
        {error && <p className="role-error">{error}</p>}
        {roleError && <p className="role-error">{roleError}</p>}
        {actionError && <p className="role-error">{actionError}</p>}
      </article>

      <article className="role-card">
        <h3>Partner Upgrade Requests (Realtime)</h3>
        <p className="role-muted">
          New requests are pushed in realtime from server events.
        </p>

        {loadingPartnerRequests && (
          <p className="role-muted">Loading partner requests...</p>
        )}
        {partnerRequestError && <p className="role-error">{partnerRequestError}</p>}

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requested At</th>
                <th>Username</th>
                <th>Email</th>
                <th>Note</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {!partnerRequests.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    No pending partner requests.
                  </td>
                </tr>
              )}
              {partnerRequests.map((request) => (
                <tr key={request.requestId}>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>{request.username}</td>
                  <td>{request.email}</td>
                  <td>{request.requestNote || '-'}</td>
                  <td>{request.status}</td>
                  <td>
                    <div className="admin-administration-partner-actions">
                      <button
                        type="button"
                        className="role-btn-primary admin-administration-partner-approve"
                        onClick={() => void handlePartnerRequestDecision(request, 'APPROVE')}
                        disabled={Boolean(processingPartnerRequestId)}
                      >
                        {processingPartnerRequestId === request.requestId ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="role-btn-ghost admin-administration-partner-reject"
                        onClick={() => void handlePartnerRequestDecision(request, 'REJECT')}
                        disabled={Boolean(processingPartnerRequestId)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-administration-pagination">
          <p className="admin-administration-pagination-summary">
            Showing {partnerRequestPageStart}-{partnerRequestPageEnd} of {partnerRequestTotalElements}
          </p>

          <div className="admin-administration-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-administration-page-btn"
              onClick={() => void handleGoToPartnerRequestPage(partnerRequestPage - 1)}
              disabled={
                !hasPreviousPartnerRequestPage ||
                loadingPartnerRequests ||
                Boolean(processingPartnerRequestId)
              }
            >
              Previous
            </button>

            {partnerRequestPaginationPages.map((pageNumber) => (
              <button
                key={`partner-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-administration-page-btn ${pageNumber === partnerRequestPage ? 'is-active' : ''}`}
                onClick={() => void handleGoToPartnerRequestPage(pageNumber)}
                disabled={loadingPartnerRequests || Boolean(processingPartnerRequestId)}
              >
                {pageNumber + 1}
              </button>
            ))}

            <button
              type="button"
              className="role-btn-ghost admin-administration-page-btn"
              onClick={() => void handleGoToPartnerRequestPage(partnerRequestPage + 1)}
              disabled={
                !hasNextPartnerRequestPage ||
                loadingPartnerRequests ||
                Boolean(processingPartnerRequestId)
              }
            >
              Next
            </button>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Account List ({totalUsersResult})</h3>
        {(loadingUsers || isExecutingAction) && (
          <p className="role-muted">Loading administration data...</p>
        )}

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Active</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!users.length && (
                <tr>
                  <td colSpan={7} className="role-empty-cell">
                    No data available.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr
                  key={user.userId}
                  className="admin-administration-record"
                  onClick={() => void handleOpenUserProfile(user)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void handleOpenUserProfile(user)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open profile of ${user.username}`}
                >
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{(user.roles || []).join(', ') || '-'}</td>
                  <td>{user.status || '-'}</td>
                  <td>{String(user.isActive)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div
                      className="admin-administration-actions"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className="admin-administration-account-actions">
                        {user.isActive ? (
                          <button
                            type="button"
                            className="role-btn-ghost admin-action-btn admin-action-btn-inactive"
                            onClick={() => void handleDeactivate(user.userId)}
                            disabled={isExecutingAction}
                          >
                            Set Inactive
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="role-btn-primary admin-action-btn admin-action-btn-active"
                            onClick={() => void handleActivate(user.userId)}
                            disabled={isExecutingAction}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          className="role-btn-ghost admin-action-btn admin-action-btn-lock"
                          onClick={() => void handleLock(user.userId)}
                          disabled={isExecutingAction}
                        >
                          Lock Account
                        </button>
                      </div>

                      <div className="admin-administration-role-actions">
                        <div className="admin-administration-role-grant">
                          <span className="admin-administration-role-label">Assign role</span>
                          <select
                            value={roleInputs[user.userId] || user.roles?.[0] || ''}
                            onChange={(event) =>
                              handleSetRoleInput(user.userId, event.target.value)
                            }
                            disabled={isExecutingAction || loadingRoles}
                          >
                            <option value="">Select role</option>
                            {roles.map((role) => (
                              <option key={`${user.userId}-${role.code}`} value={role.code}>
                                {role.code}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void handleAssignRole(user)}
                            disabled={
                              isExecutingAction ||
                              loadingRoles ||
                              !(roleInputs[user.userId] || user.roles?.[0] || '')
                            }
                          >
                            Assign
                          </button>
                        </div>

                        <div className="admin-administration-role-grant">
                          <span className="admin-administration-role-label">Remove role</span>
                          <select
                            value={roleRemoveInputs[user.userId] || user.roles?.[0] || ''}
                            onChange={(event) =>
                              handleSetRoleRemoveInput(user.userId, event.target.value)
                            }
                            disabled={isExecutingAction || !normalizeRoleCodes(user.roles).length}
                          >
                            <option value="">Select role</option>
                            {normalizeRoleCodes(user.roles).map((roleCode) => (
                              <option key={`${user.userId}-remove-${roleCode}`} value={roleCode}>
                                {roleCode}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="role-btn-ghost"
                            onClick={() => void handleRemoveRole(user)}
                            disabled={
                              isExecutingAction ||
                              !normalizeRoleCodes(user.roles).length ||
                              normalizeRoleCodes(user.roles).length <= 1
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-administration-pagination">
          <p className="admin-administration-pagination-summary">
            Showing {currentPageStart}-{currentPageEnd} of {totalUsersResult}
          </p>

          <div className="admin-administration-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-administration-page-btn"
              onClick={() => void handleGoToPage(page - 1)}
              disabled={!hasPreviousPage || loadingUsers || isExecutingAction}
            >
              Previous
            </button>

            {accountPaginationPages.map((pageNumber) => (
              <button
                key={`page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-administration-page-btn ${pageNumber === page ? 'is-active' : ''}`}
                onClick={() => void handleGoToPage(pageNumber)}
                disabled={loadingUsers || isExecutingAction}
              >
                {pageNumber + 1}
              </button>
            ))}

            <button
              type="button"
              className="role-btn-ghost admin-administration-page-btn"
              onClick={() => void handleGoToPage(page + 1)}
              disabled={!hasNextPage || loadingUsers || isExecutingAction}
            >
              Next
            </button>
          </div>
        </div>
      </article>

      {selectedUserRecord && (
        <div className="role-modal-backdrop" onClick={handleCloseUserProfile}>
          <div
            className="role-modal admin-administration-profile-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-administration-profile-header">
              <img
                src={profileView?.avatar || defaultAvatar}
                alt="User avatar"
                className="admin-administration-profile-avatar"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar
                }}
              />
              <div>
                <h3>User Profile</h3>
                <p className="role-muted">{profileView?.username || selectedUserRecord.username}</p>
              </div>
            </div>

            {loadingProfile && <p className="role-muted">Loading user profile...</p>}
            {profileError && <p className="role-error">{profileError}</p>}

            {profileView && (
              <div className="admin-administration-profile-layout">
                <section className="admin-administration-profile-panel">
                  <h4>Identity</h4>
                  <div className="admin-administration-profile-kv-list">
                    <div className="admin-administration-profile-kv-row">
                      <span>User ID</span>
                      <strong>{profileView.userId || '-'}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Full Name</span>
                      <strong>{formatFullName(profileView.firstName, profileView.lastName)}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Email</span>
                      <strong>{profileView.email || '-'}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Phone</span>
                      <strong>{profileView.phone || '-'}</strong>
                    </div>
                  </div>
                </section>

                <section className="admin-administration-profile-panel">
                  <h4>Account Status</h4>
                  <div className="admin-administration-profile-kv-list">
                    <div className="admin-administration-profile-kv-row">
                      <span>Status</span>
                      <strong>{profileView.status || '-'}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Active</span>
                      <strong>{formatBoolean(profileView.isActive)}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Email Verified</span>
                      <strong>{formatBoolean(profileView.emailVerified)}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Failed Login Count</span>
                      <strong>{profileView.failedLoginCount ?? '-'}</strong>
                    </div>
                  </div>
                </section>

                <section className="admin-administration-profile-panel admin-administration-profile-panel-full">
                  <h4>Access</h4>
                  <div className="admin-administration-profile-kv-list">
                    <div className="admin-administration-profile-kv-row">
                      <span>Roles</span>
                      <strong>{normalizeRoleCodes(profileView.roles).join(', ') || '-'}</strong>
                    </div>
                  </div>
                </section>

                <section className="admin-administration-profile-panel admin-administration-profile-panel-full">
                  <h4>Timestamps</h4>
                  <div className="admin-administration-profile-kv-list admin-administration-profile-kv-list-three-cols">
                    <div className="admin-administration-profile-kv-row">
                      <span>Created At</span>
                      <strong>{formatDate(profileView.createdAt)}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Last Login</span>
                      <strong>{formatDate(profileView.lastLoginAt)}</strong>
                    </div>
                    <div className="admin-administration-profile-kv-row">
                      <span>Updated At</span>
                      <strong>{formatDate(profileView.updatedAt)}</strong>
                    </div>
                  </div>
                </section>
              </div>
            )}

            <div className="role-modal-actions">
              <button type="button" className="role-btn-primary" onClick={handleCloseUserProfile}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminAdministrationPage
