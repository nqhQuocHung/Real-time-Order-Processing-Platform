import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
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
  const [page, setPage] = useState(0)
  const [size] = useState(20)
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<UserFilter>({
    keyword: '',
    roleCode: '',
    status: '',
    isActive: '',
  })

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
      setTotalUsersResult(data.totalElements || 0)
      setPage(data.page || 0)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load account list.'))
      setUsers([])
      setTotalUsersResult(0)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadSummary(), loadRoles()])
    void loadUsers(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                <tr key={user.userId}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{(user.roles || []).join(', ') || '-'}</td>
                  <td>{user.status || '-'}</td>
                  <td>{String(user.isActive)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="admin-administration-actions">
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
                      <div className="admin-administration-role-grant">
                        <select
                          value={roleInputs[user.userId] || user.roles?.[0] || ''}
                          onChange={(event) =>
                            handleSetRoleInput(user.userId, event.target.value)
                          }
                          disabled={isExecutingAction || loadingRoles}
                        >
                          <option value="">Select role to assign</option>
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
                          Assign Role
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default AdminAdministrationPage
