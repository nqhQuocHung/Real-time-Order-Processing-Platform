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
  id: string
  key: string
  label: string
  path?: string
  displayOrder?: number
  permission?: string
  parentMenuId?: string | null
  parentMenuKey?: string | null
  isContainer?: boolean
}

type PermissionSummary = {
  code: string
  name?: string
}

type MenuNode = MenuSummary & {
  children: MenuNode[]
}

type FlatMenuNode = {
  node: MenuNode
  depth: number
}

function normalizeMenuPath(path?: string) {
  return (path || '').trim()
}

function isContainerMenu(menu: MenuSummary) {
  return Boolean(menu.isContainer) || !normalizeMenuPath(menu.path)
}

function compareMenusByOrder(first: Pick<MenuSummary, 'displayOrder' | 'key' | 'label'>, second: Pick<MenuSummary, 'displayOrder' | 'key' | 'label'>) {
  const firstOrder = typeof first.displayOrder === 'number' ? first.displayOrder : 100
  const secondOrder = typeof second.displayOrder === 'number' ? second.displayOrder : 100
  if (firstOrder !== secondOrder) {
    return firstOrder - secondOrder
  }
  const keyCompare = first.key.localeCompare(second.key)
  if (keyCompare !== 0) {
    return keyCompare
  }
  return first.label.localeCompare(second.label)
}

function buildMenuTree(menuList: MenuSummary[]): MenuNode[] {
  const sortedMenus = [...menuList].sort(compareMenusByOrder)
  const nodeMap = new Map<string, MenuNode>()

  sortedMenus.forEach((menu) => {
    nodeMap.set(menu.key, { ...menu, children: [] })
  })

  const roots: MenuNode[] = []

  nodeMap.forEach((node) => {
    const parentKey = (node.parentMenuKey || '').trim()
    const parentNode = parentKey ? nodeMap.get(parentKey) : null

    if (parentNode) {
      parentNode.children.push(node)
      return
    }

    roots.push(node)
  })

  function sortChildren(nodes: MenuNode[]) {
    nodes.sort(compareMenusByOrder)
    nodes.forEach((node) => sortChildren(node.children))
  }

  sortChildren(roots)
  return roots
}

function flattenMenuTree(nodes: MenuNode[], depth = 0): FlatMenuNode[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenMenuTree(node.children, depth + 1),
  ])
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

  const [newTabKey, setNewTabKey] = useState('')
  const [newTabLabel, setNewTabLabel] = useState('')
  const [newTabDisplayOrder, setNewTabDisplayOrder] = useState('100')

  const [newPageParentMenuId, setNewPageParentMenuId] = useState('')
  const [newPageKey, setNewPageKey] = useState('')
  const [newPageLabel, setNewPageLabel] = useState('')
  const [newPagePath, setNewPagePath] = useState('')
  const [newPageDisplayOrder, setNewPageDisplayOrder] = useState('100')
  const [newPagePermissionCode, setNewPagePermissionCode] = useState('')

  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<string[]>([])

  const selectedRole = useMemo(() => {
    return roles.find((item) => item.code === selectedRoleCode) || null
  }, [roles, selectedRoleCode])

  const menuTree = useMemo(() => buildMenuTree(menus), [menus])
  const flattenedMenus = useMemo(() => flattenMenuTree(menuTree), [menuTree])

  const parentTabOptions = useMemo(() => {
    return menus
      .filter((menu) => isContainerMenu(menu))
      .sort(compareMenusByOrder)
  }, [menus])

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

  useEffect(() => {
    if (!parentTabOptions.length) {
      setNewPageParentMenuId('')
      return
    }

    if (!newPageParentMenuId || !parentTabOptions.some((menu) => menu.id === newPageParentMenuId)) {
      setNewPageParentMenuId(parentTabOptions[0].id)
    }
  }, [newPageParentMenuId, parentTabOptions])

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

  async function handleCreateMainTab() {
    setError('')
    setSuccess('')

    const key = newTabKey.trim()
    const label = newTabLabel.trim()
    const displayOrderNumber = Number(newTabDisplayOrder)

    if (!key) {
      setError('Main tab key is required.')
      return
    }

    if (!label) {
      setError('Main tab label is required.')
      return
    }

    if (!Number.isFinite(displayOrderNumber) || displayOrderNumber < 0) {
      setError('Display order must be a number greater than or equal to 0.')
      return
    }

    setSubmitting(true)
    try {
      await apis().post(endpoints.auth.menus, {
        menuKey: key,
        label,
        path: '',
        displayOrder: displayOrderNumber,
      })

      setNewTabKey('')
      setNewTabLabel('')
      setNewTabDisplayOrder('100')
      await loadAccessData()
      setSuccess(`Main tab ${label} created successfully.`)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot create main tab.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateChildPage() {
    setError('')
    setSuccess('')

    const parentMenuId = newPageParentMenuId.trim()
    const key = newPageKey.trim()
    const label = newPageLabel.trim()
    const path = newPagePath.trim()
    const displayOrderNumber = Number(newPageDisplayOrder)

    if (!parentMenuId) {
      setError('Please select a parent tab for this page.')
      return
    }

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
        permissionCode: newPagePermissionCode || undefined,
        parentMenuId,
      })

      setNewPageKey('')
      setNewPageLabel('')
      setNewPagePath('')
      setNewPageDisplayOrder('100')
      setNewPagePermissionCode('')
      await loadAccessData()
      setSuccess('Child page created successfully.')
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot create child page.'))
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
      setSuccess(`Updated tab/page visibility for role ${selectedRoleCode}.`)
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
          Create roles, create main tabs, create child pages, and map visible menus by role.
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
        <h3>Create Main Tab</h3>
        <div className="role-inline-form admin-access-management-main-tab-grid">
          <label>
            Tab Key
            <input
              value={newTabKey}
              onChange={(event) => setNewTabKey(event.target.value)}
              placeholder="e.g. admin-sales"
              disabled={submitting}
            />
          </label>
          <label>
            Tab Label
            <input
              value={newTabLabel}
              onChange={(event) => setNewTabLabel(event.target.value)}
              placeholder="e.g. Sales Management"
              disabled={submitting}
            />
          </label>
          <label>
            Display Order
            <input
              value={newTabDisplayOrder}
              onChange={(event) => setNewTabDisplayOrder(event.target.value)}
              placeholder="100"
              disabled={submitting}
            />
          </label>
        </div>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleCreateMainTab()}
            disabled={submitting}
          >
            Create Main Tab
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Create Child Page</h3>
        <div className="role-inline-form admin-access-management-create-page-grid">
          <label>
            Parent Tab
            <select
              value={newPageParentMenuId}
              onChange={(event) => setNewPageParentMenuId(event.target.value)}
              disabled={submitting}
            >
              <option value="">Select parent tab</option>
              {parentTabOptions.map((menu) => (
                <option key={menu.key} value={menu.id}>
                  {menu.label} ({menu.key})
                </option>
              ))}
            </select>
          </label>
          <label>
            Page Key
            <input
              value={newPageKey}
              onChange={(event) => setNewPageKey(event.target.value)}
              placeholder="optional (auto generate from URL)"
              disabled={submitting}
            />
          </label>
          <label>
            Page Label
            <input
              value={newPageLabel}
              onChange={(event) => setNewPageLabel(event.target.value)}
              placeholder="e.g. Sales Dashboard"
              disabled={submitting}
            />
          </label>
          <label>
            URL Page
            <input
              value={newPagePath}
              onChange={(event) => setNewPagePath(event.target.value)}
              placeholder="e.g. /admin/sales-dashboard"
              disabled={submitting}
            />
          </label>
          <label>
            Display Order
            <input
              value={newPageDisplayOrder}
              onChange={(event) => setNewPageDisplayOrder(event.target.value)}
              placeholder="100"
              disabled={submitting}
            />
          </label>
          <label>
            Required Permission
            <select
              value={newPagePermissionCode}
              onChange={(event) => setNewPagePermissionCode(event.target.value)}
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
            onClick={() => void handleCreateChildPage()}
            disabled={submitting}
          >
            Create Child Page
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Role - Tab/Page Mapping</h3>

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
            Selected Menus
            <input
              value={`${selectedMenuKeys.length} tab/page item(s) selected`}
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
          {!flattenedMenus.length && <p className="role-muted">No tab/page data available.</p>}
          {flattenedMenus.map(({ node, depth }) => (
            <label
              key={node.key}
              className="admin-access-management-menu-item"
              style={{ paddingLeft: `${10 + depth * 18}px` }}
            >
              <input
                type="checkbox"
                checked={selectedMenuKeys.includes(node.key)}
                onChange={() => toggleMenuSelection(node.key)}
                disabled={submitting || !selectedRoleCode}
              />
              <div>
                <strong>
                  {node.label}{' '}
                  <span className="admin-access-management-menu-type">
                    {isContainerMenu(node) ? 'TAB' : 'PAGE'}
                  </span>
                </strong>
                <span>{normalizeMenuPath(node.path) || '(container tab - no URL)'}</span>
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
                <th>Mapped Menus</th>
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
        <h3>Current Tabs / Pages</h3>
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Label</th>
                <th>Path</th>
                <th>Parent Tab</th>
                <th>Permission</th>
              </tr>
            </thead>
            <tbody>
              {!menus.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    No tab/page data available.
                  </td>
                </tr>
              )}
              {[...menus].sort(compareMenusByOrder).map((menu) => (
                <tr key={menu.key}>
                  <td>{menu.key}</td>
                  <td>{isContainerMenu(menu) ? 'TAB' : 'PAGE'}</td>
                  <td>{menu.label}</td>
                  <td>{normalizeMenuPath(menu.path) || '-'}</td>
                  <td>{menu.parentMenuKey || '-'}</td>
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
