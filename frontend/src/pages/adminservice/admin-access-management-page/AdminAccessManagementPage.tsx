import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './AdminAccessManagementPage.css'

type RoleSummary = {
  code: string
  name?: string
  isActive?: boolean
  menuKeys?: string[]
}

type MenuSummary = {
  key: string
  label: string
  path: string
  displayOrder?: number
  permission?: string
}

type PermissionSummary = {
  code: string
  name?: string
}

function AdminAccessManagementPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [menus, setMenus] = useState<MenuSummary[]>([])
  const [permissions, setPermissions] = useState<PermissionSummary[]>([])

  const [newRoleCode, setNewRoleCode] = useState('')
  const [newRoleName, setNewRoleName] = useState('')

  const [newMenuKey, setNewMenuKey] = useState('')
  const [newMenuLabel, setNewMenuLabel] = useState('')
  const [newMenuPath, setNewMenuPath] = useState('')
  const [newMenuDisplayOrder, setNewMenuDisplayOrder] = useState('100')
  const [newMenuPermissionCode, setNewMenuPermissionCode] = useState('')

  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<string[]>([])

  const selectedRole = useMemo(() => {
    return roles.find((item) => item.code === selectedRoleCode) || null
  }, [roles, selectedRoleCode])

  async function loadAccessData() {
    setLoading(true)
    setError('')

    try {
      const [rolesResponse, menusResponse, permissionsResponse] = await Promise.all([
        apis().get(endpoints.auth.roles),
        apis().get(endpoints.auth.menus),
        apis().get(endpoints.auth.permissions),
      ])

      const nextRoles = extractApiData<RoleSummary[]>(rolesResponse) || []
      const nextMenus = extractApiData<MenuSummary[]>(menusResponse) || []
      const nextPermissions = extractApiData<PermissionSummary[]>(permissionsResponse) || []

      setRoles(nextRoles)
      setMenus(nextMenus)
      setPermissions(nextPermissions)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load access management data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccessData()
  }, [])

  useEffect(() => {
    if (!selectedRoleCode) {
      setSelectedMenuKeys([])
      return
    }

    const role = roles.find((item) => item.code === selectedRoleCode)
    setSelectedMenuKeys(role?.menuKeys || [])
  }, [roles, selectedRoleCode])

  async function handleCreateRole() {
    setError('')
    setSuccess('')

    const code = newRoleCode.trim().toUpperCase()
    const name = newRoleName.trim()

    if (!code) {
      setError('Role code is required.')
      return
    }

    setSubmitting(true)
    try {
      const response = await apis().post(endpoints.auth.roles, {
        code,
        name: name || undefined,
      })
      const createdRole = extractApiData<RoleSummary>(response)

      setNewRoleCode('')
      setNewRoleName('')
      await loadAccessData()

      if (createdRole?.code) {
        setSelectedRoleCode(createdRole.code)
      }
      setSuccess(`Role ${code} created successfully.`)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot create role.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreatePage() {
    setError('')
    setSuccess('')

    const label = newMenuLabel.trim()
    const path = newMenuPath.trim()
    const key = newMenuKey.trim()
    const displayOrderNumber = Number(newMenuDisplayOrder)

    if (!label || !path) {
      setError('Page label and page URL are required.')
      return
    }

    if (!Number.isFinite(displayOrderNumber) || displayOrderNumber < 0) {
      setError('Display order must be a number greater than or equal to 0.')
      return
    }

    setSubmitting(true)
    try {
      await apis().post(endpoints.auth.menus, {
        menuKey: key || undefined,
        label,
        path,
        displayOrder: displayOrderNumber,
        permissionCode: newMenuPermissionCode || undefined,
      })

      setNewMenuKey('')
      setNewMenuLabel('')
      setNewMenuPath('')
      setNewMenuDisplayOrder('100')
      setNewMenuPermissionCode('')
      await loadAccessData()
      setSuccess('Page created successfully.')
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot create page URL.'))
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMenuSelection(menuKey: string) {
    setSelectedMenuKeys((prev) => {
      if (prev.includes(menuKey)) {
        return prev.filter((item) => item !== menuKey)
      }
      return [...prev, menuKey]
    })
  }

  async function handleSaveRolePageMapping() {
    setError('')
    setSuccess('')

    if (!selectedRoleCode) {
      setError('Please select a role to map pages.')
      return
    }

    setSubmitting(true)
    try {
      await apis().put(endpoints.auth.updateRoleMenus(selectedRoleCode), {
        menuKeys: selectedMenuKeys,
      })
      await loadAccessData()
      setSuccess(`Updated visible pages for role ${selectedRoleCode}.`)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot update role-page mapping.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-access-management-page role-page-stack">
      <article className="role-card">
        <h2>Access Management</h2>
        <p className="role-muted">
          Create roles, create page URLs, and map which pages each role can see.
        </p>
      </article>

      <article className="role-card">
        <h3>Create Role</h3>
        <div className="role-inline-form admin-access-management-two-cols">
          <label>
            Role Code
            <input
              value={newRoleCode}
              onChange={(event) => setNewRoleCode(event.target.value)}
              placeholder="e.g. SALES_ADMIN"
              disabled={submitting}
            />
          </label>
          <label>
            Role Name
            <input
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              placeholder="Display name (optional)"
              disabled={submitting}
            />
          </label>
        </div>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleCreateRole()}
            disabled={submitting}
          >
            Create Role
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Create Page (URL)</h3>
        <div className="role-inline-form admin-access-management-create-page-grid">
          <label>
            Menu Key
            <input
              value={newMenuKey}
              onChange={(event) => setNewMenuKey(event.target.value)}
              placeholder="optional (auto generate from URL)"
              disabled={submitting}
            />
          </label>
          <label>
            Label
            <input
              value={newMenuLabel}
              onChange={(event) => setNewMenuLabel(event.target.value)}
              placeholder="e.g. Sales Dashboard"
              disabled={submitting}
            />
          </label>
          <label>
            URL Page
            <input
              value={newMenuPath}
              onChange={(event) => setNewMenuPath(event.target.value)}
              placeholder="e.g. /admin/sales-dashboard"
              disabled={submitting}
            />
          </label>
          <label>
            Display Order
            <input
              value={newMenuDisplayOrder}
              onChange={(event) => setNewMenuDisplayOrder(event.target.value)}
              placeholder="100"
              disabled={submitting}
            />
          </label>
          <label>
            Required Permission
            <select
              value={newMenuPermissionCode}
              onChange={(event) => setNewMenuPermissionCode(event.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {permissions.map((permission) => (
                <option key={permission.code} value={permission.code}>
                  {permission.code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleCreatePage()}
            disabled={submitting}
          >
            Create Page
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Role - Page Mapping</h3>

        <div className="role-inline-form admin-access-management-two-cols">
          <label>
            Select Role
            <select
              value={selectedRoleCode}
              onChange={(event) => setSelectedRoleCode(event.target.value)}
              disabled={submitting}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Selected Pages
            <input
              value={`${selectedMenuKeys.length} page(s) selected`}
              readOnly
              disabled
            />
          </label>
        </div>

        {selectedRole && (
          <p className="role-muted">
            Editing visibility for role: <strong>{selectedRole.code}</strong>
          </p>
        )}

        <div className="admin-access-management-menu-list">
          {!menus.length && <p className="role-muted">No pages available.</p>}
          {menus.map((menu) => (
            <label key={menu.key} className="admin-access-management-menu-item">
              <input
                type="checkbox"
                checked={selectedMenuKeys.includes(menu.key)}
                onChange={() => toggleMenuSelection(menu.key)}
                disabled={submitting || !selectedRoleCode}
              />
              <div>
                <strong>{menu.label}</strong>
                <span>{menu.path}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleSaveRolePageMapping()}
            disabled={submitting || !selectedRoleCode}
          >
            Save Role Mapping
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Current Roles</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role Code</th>
                <th>Name</th>
                <th>Pages</th>
              </tr>
            </thead>
            <tbody>
              {!roles.length && (
                <tr>
                  <td colSpan={3} className="role-empty-cell">
                    No role data available.
                  </td>
                </tr>
              )}
              {roles.map((role) => (
                <tr key={role.code}>
                  <td>{role.code}</td>
                  <td>{role.name || '-'}</td>
                  <td>{role.menuKeys?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="role-card">
        <h3>Current Pages</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Path</th>
                <th>Permission</th>
              </tr>
            </thead>
            <tbody>
              {!menus.length && (
                <tr>
                  <td colSpan={4} className="role-empty-cell">
                    No page data available.
                  </td>
                </tr>
              )}
              {menus.map((menu) => (
                <tr key={menu.key}>
                  <td>{menu.key}</td>
                  <td>{menu.label}</td>
                  <td>{menu.path}</td>
                  <td>{menu.permission || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {loading && <p className="role-muted">Loading access management...</p>}
      {error && <p className="role-error">{error}</p>}
      {success && <p className="role-muted">{success}</p>}
    </section>
  )
}

export default AdminAccessManagementPage
