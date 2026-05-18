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
  showOnMenu?: boolean
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

type EditMenuForm = {
  menuKey: string
  label: string
  path: string
  displayOrder: string
  permissionCode: string
  parentMenuId: string
  showOnMenu: boolean
}

function normalizeMenuPath(path?: string) {
  return (path || '').trim()
}

function normalizeSearchText(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function menuMatchesSearchKeyword(
  menu: Pick<MenuSummary, 'key' | 'label' | 'path'>,
  normalizedKeyword: string,
) {
  if (!normalizedKeyword) {
    return true
  }

  return [menu.label, menu.key, normalizeMenuPath(menu.path)]
    .map((value) => normalizeSearchText(value))
    .some((value) => value.includes(normalizedKeyword))
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

function collectDescendantIds(targetMenuId: string, menuTree: MenuNode[]): Set<string> {
  const descendants = new Set<string>()

  function walk(node: MenuNode, isUnderTarget: boolean) {
    const isCurrentTarget = node.id === targetMenuId
    const inTargetBranch = isUnderTarget || isCurrentTarget

    if (isUnderTarget) {
      descendants.add(node.id)
    }

    node.children.forEach((child) => walk(child, inTargetBranch))
  }

  menuTree.forEach((root) => walk(root, false))
  return descendants
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
  const [newTabShowOnMenu, setNewTabShowOnMenu] = useState(true)

  const [newPageParentMenuId, setNewPageParentMenuId] = useState('')
  const [newPageKey, setNewPageKey] = useState('')
  const [newPageLabel, setNewPageLabel] = useState('')
  const [newPagePath, setNewPagePath] = useState('')
  const [newPageDisplayOrder, setNewPageDisplayOrder] = useState('100')
  const [newPagePermissionCode, setNewPagePermissionCode] = useState('')
  const [newPageShowOnMenu, setNewPageShowOnMenu] = useState(true)

  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<string[]>([])
  const [editingMenu, setEditingMenu] = useState<MenuSummary | null>(null)
  const [editMenuForm, setEditMenuForm] = useState<EditMenuForm | null>(null)
  const [editingMenuSubmitting, setEditingMenuSubmitting] = useState(false)
  const [editingMenuError, setEditingMenuError] = useState('')
  const [deletingMenuId, setDeletingMenuId] = useState('')
  const [pendingDeleteMenu, setPendingDeleteMenu] = useState<MenuSummary | null>(null)
  const [pageSearchKeyword, setPageSearchKeyword] = useState('')
  const [mappingMenuPage, setMappingMenuPage] = useState(0)
  const [roleTablePage, setRoleTablePage] = useState(0)
  const [menuTablePage, setMenuTablePage] = useState(0)

  const mappingMenuPageSize = 8
  const roleTablePageSize = 8
  const menuTablePageSize = 8

  const selectedRole = useMemo(() => {
    return roles.find((item) => item.code === selectedRoleCode) || null
  }, [roles, selectedRoleCode])

  const menuTree = useMemo(() => buildMenuTree(menus), [menus])
  const flattenedMenus = useMemo(() => flattenMenuTree(menuTree), [menuTree])
  const sortedRoles = useMemo(
    () => [...roles].sort((first, second) => first.code.localeCompare(second.code)),
    [roles],
  )
  const sortedMenus = useMemo(() => [...menus].sort(compareMenusByOrder), [menus])
  const normalizedPageSearchKeyword = useMemo(
    () => normalizeSearchText(pageSearchKeyword),
    [pageSearchKeyword],
  )
  const filteredFlattenedMenus = useMemo(
    () =>
      flattenedMenus.filter(({ node }) =>
        menuMatchesSearchKeyword(node, normalizedPageSearchKeyword),
      ),
    [flattenedMenus, normalizedPageSearchKeyword],
  )
  const filteredSortedMenus = useMemo(
    () => sortedMenus.filter((menu) => menuMatchesSearchKeyword(menu, normalizedPageSearchKeyword)),
    [normalizedPageSearchKeyword, sortedMenus],
  )

  const parentTabOptions = useMemo(() => {
    return menus
      .filter((menu) => isContainerMenu(menu))
      .sort(compareMenusByOrder)
  }, [menus])

  const editParentTabOptions = useMemo(() => {
    const editingMenuId = editingMenu?.id || ''
    const descendantIds = editingMenuId ? collectDescendantIds(editingMenuId, menuTree) : new Set<string>()

    return parentTabOptions.filter((menu) => {
      if (!editingMenuId) {
        return true
      }
      if (menu.id === editingMenuId) {
        return false
      }
      return !descendantIds.has(menu.id)
    })
  }, [editingMenu?.id, menuTree, parentTabOptions])

  const pendingDeleteChildCount = useMemo(() => {
    if (!pendingDeleteMenu?.id) {
      return 0
    }
    return menus.filter((item) => item.parentMenuId === pendingDeleteMenu.id).length
  }, [menus, pendingDeleteMenu?.id])

  const mappingMenuTotalPages = useMemo(() => {
    return filteredFlattenedMenus.length > 0
      ? Math.ceil(filteredFlattenedMenus.length / mappingMenuPageSize)
      : 0
  }, [filteredFlattenedMenus.length, mappingMenuPageSize])

  const visibleMappingMenus = useMemo(() => {
    const start = mappingMenuPage * mappingMenuPageSize
    return filteredFlattenedMenus.slice(start, start + mappingMenuPageSize)
  }, [filteredFlattenedMenus, mappingMenuPage, mappingMenuPageSize])

  const mappingMenuPaginationPages = useMemo(
    () => buildPaginationPages(mappingMenuPage, mappingMenuTotalPages),
    [mappingMenuPage, mappingMenuTotalPages],
  )

  const roleTableTotalPages = useMemo(() => {
    return sortedRoles.length > 0 ? Math.ceil(sortedRoles.length / roleTablePageSize) : 0
  }, [roleTablePageSize, sortedRoles.length])

  const visibleRoles = useMemo(() => {
    const start = roleTablePage * roleTablePageSize
    return sortedRoles.slice(start, start + roleTablePageSize)
  }, [roleTablePage, roleTablePageSize, sortedRoles])

  const roleTablePaginationPages = useMemo(
    () => buildPaginationPages(roleTablePage, roleTableTotalPages),
    [roleTablePage, roleTableTotalPages],
  )

  const menuTableTotalPages = useMemo(() => {
    return filteredSortedMenus.length > 0
      ? Math.ceil(filteredSortedMenus.length / menuTablePageSize)
      : 0
  }, [filteredSortedMenus.length, menuTablePageSize])

  const visibleMenus = useMemo(() => {
    const start = menuTablePage * menuTablePageSize
    return filteredSortedMenus.slice(start, start + menuTablePageSize)
  }, [filteredSortedMenus, menuTablePage, menuTablePageSize])

  const menuTablePaginationPages = useMemo(
    () => buildPaginationPages(menuTablePage, menuTableTotalPages),
    [menuTablePage, menuTableTotalPages],
  )

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
    if (newPageParentMenuId && !parentTabOptions.some((menu) => menu.id === newPageParentMenuId)) {
      setNewPageParentMenuId('')
    }
  }, [newPageParentMenuId, parentTabOptions])

  useEffect(() => {
    setMappingMenuPage(0)
    setMenuTablePage(0)
  }, [normalizedPageSearchKeyword])

  useEffect(() => {
    if (mappingMenuTotalPages === 0 && mappingMenuPage !== 0) {
      setMappingMenuPage(0)
      return
    }
    const maxPage = Math.max(0, mappingMenuTotalPages - 1)
    if (mappingMenuPage > maxPage) {
      setMappingMenuPage(maxPage)
    }
  }, [mappingMenuPage, mappingMenuTotalPages])

  useEffect(() => {
    if (roleTableTotalPages === 0 && roleTablePage !== 0) {
      setRoleTablePage(0)
      return
    }
    const maxPage = Math.max(0, roleTableTotalPages - 1)
    if (roleTablePage > maxPage) {
      setRoleTablePage(maxPage)
    }
  }, [roleTablePage, roleTableTotalPages])

  useEffect(() => {
    if (menuTableTotalPages === 0 && menuTablePage !== 0) {
      setMenuTablePage(0)
      return
    }
    const maxPage = Math.max(0, menuTableTotalPages - 1)
    if (menuTablePage > maxPage) {
      setMenuTablePage(maxPage)
    }
  }, [menuTablePage, menuTableTotalPages])

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
        showOnMenu: newTabShowOnMenu,
      })

      setNewTabKey('')
      setNewTabLabel('')
      setNewTabDisplayOrder('100')
      setNewTabShowOnMenu(true)
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

    if (!label) {
      setError('Page/Tab label is required.')
      return
    }

    if (!path && !key) {
      setError('Menu key is required when URL Page is empty (to create a tab).')
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
        path: path || '',
        displayOrder: displayOrderNumber,
        permissionCode: path ? newPagePermissionCode || undefined : undefined,
        parentMenuId: parentMenuId || undefined,
        showOnMenu: newPageShowOnMenu,
      })

      setNewPageKey('')
      setNewPageLabel('')
      setNewPagePath('')
      setNewPageDisplayOrder('100')
      setNewPagePermissionCode('')
      setNewPageShowOnMenu(true)
      await loadAccessData()
      setSuccess(path ? 'Child page created successfully.' : 'Tab created successfully.')
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot create page/tab.'))
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

  function openMenuEditor(menu: MenuSummary) {
    setEditingMenu(menu)
    setEditingMenuError('')
    setEditMenuForm({
      menuKey: menu.key || '',
      label: menu.label || '',
      path: normalizeMenuPath(menu.path),
      displayOrder: String(typeof menu.displayOrder === 'number' ? menu.displayOrder : 100),
      permissionCode: menu.permission || '',
      parentMenuId: menu.parentMenuId || '',
      showOnMenu: menu.showOnMenu !== false,
    })
  }

  function closeMenuEditor() {
    if (editingMenuSubmitting) {
      return
    }
    setEditingMenu(null)
    setEditMenuForm(null)
    setEditingMenuError('')
  }

  async function handleSaveMenuEditor() {
    if (!editingMenu || !editMenuForm) {
      return
    }

    setEditingMenuError('')
    const menuKey = editMenuForm.menuKey.trim()
    const label = editMenuForm.label.trim()
    const path = editMenuForm.path.trim()
    const displayOrder = Number(editMenuForm.displayOrder)
    const parentMenuId = editMenuForm.parentMenuId.trim()

    if (!menuKey) {
      setEditingMenuError('Menu key is required.')
      return
    }

    if (!label) {
      setEditingMenuError('Label is required.')
      return
    }

    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      setEditingMenuError('Display order must be a number greater than or equal to 0.')
      return
    }

    setEditingMenuSubmitting(true)
    try {
      await apis().put(endpoints.auth.updateMenu(editingMenu.id), {
        menuKey,
        label,
        path: path || '',
        displayOrder,
        permissionCode: path ? editMenuForm.permissionCode || undefined : undefined,
        parentMenuId: parentMenuId || undefined,
        showOnMenu: editMenuForm.showOnMenu,
      })

      await loadAccessData()
      setSuccess(`Menu ${menuKey} updated successfully.`)
      setEditingMenu(null)
      setEditMenuForm(null)
      setEditingMenuError('')
    } catch (err) {
      setEditingMenuError(extractApiErrorMessage(err, 'Cannot update menu.'))
    } finally {
      setEditingMenuSubmitting(false)
    }
  }

  function requestDeleteMenu(menu: MenuSummary) {
    if (deletingMenuId || submitting || editingMenuSubmitting) {
      return
    }
    setPendingDeleteMenu(menu)
  }

  function closeDeleteMenuModal() {
    if (deletingMenuId) {
      return
    }
    setPendingDeleteMenu(null)
  }

  async function handleDeleteMenu() {
    setError('')
    setSuccess('')

    const menu = pendingDeleteMenu
    if (!menu?.id) {
      setError('Invalid tab/page item.')
      return
    }

    if (deletingMenuId) {
      return
    }

    setDeletingMenuId(menu.id)

    try {
      await apis().delete(endpoints.auth.deleteMenu(menu.id))
      if (editingMenu?.id === menu.id) {
        setEditingMenu(null)
        setEditMenuForm(null)
        setEditingMenuError('')
      }
      await loadAccessData()
      setSuccess(`${isContainerMenu(menu) ? 'Tab' : 'Page'} ${menu.label} deleted successfully.`)
      setPendingDeleteMenu(null)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot delete tab/page.'))
    } finally {
      setDeletingMenuId('')
    }
  }

  function handleGoToMappingMenuPage(targetPage: number) {
    if (targetPage < 0 || targetPage >= mappingMenuTotalPages || targetPage === mappingMenuPage) {
      return
    }
    setMappingMenuPage(targetPage)
  }

  function handleGoToRoleTablePage(targetPage: number) {
    if (targetPage < 0 || targetPage >= roleTableTotalPages || targetPage === roleTablePage) {
      return
    }
    setRoleTablePage(targetPage)
  }

  function handleGoToMenuTablePage(targetPage: number) {
    if (targetPage < 0 || targetPage >= menuTableTotalPages || targetPage === menuTablePage) {
      return
    }
    setMenuTablePage(targetPage)
  }

  const mappingMenuStart = filteredFlattenedMenus.length === 0 ? 0 : mappingMenuPage * mappingMenuPageSize + 1
  const mappingMenuEnd = filteredFlattenedMenus.length === 0
    ? 0
    : Math.min((mappingMenuPage + 1) * mappingMenuPageSize, filteredFlattenedMenus.length)

  const roleTableStart = sortedRoles.length === 0 ? 0 : roleTablePage * roleTablePageSize + 1
  const roleTableEnd = sortedRoles.length === 0
    ? 0
    : Math.min((roleTablePage + 1) * roleTablePageSize, sortedRoles.length)

  const menuTableStart = filteredSortedMenus.length === 0 ? 0 : menuTablePage * menuTablePageSize + 1
  const menuTableEnd = filteredSortedMenus.length === 0
    ? 0
    : Math.min((menuTablePage + 1) * menuTablePageSize, filteredSortedMenus.length)

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
          <label className="admin-access-management-checkbox-label">
            <input
              type="checkbox"
              checked={newTabShowOnMenu}
              onChange={(event) => setNewTabShowOnMenu(event.target.checked)}
              disabled={submitting}
            />
            Show on menu
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
        <h3>Create Page / Tab</h3>
        <div className="role-inline-form admin-access-management-create-page-grid">
          <label>
            Parent Tab
            <select
              value={newPageParentMenuId}
              onChange={(event) => setNewPageParentMenuId(event.target.value)}
              disabled={submitting}
            >
              <option value="">None (root level)</option>
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
              placeholder="optional if URL provided; required when URL is empty"
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
              placeholder="e.g. /admin/sales-dashboard (leave empty to create tab)"
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
          <label className="admin-access-management-checkbox-label">
            <input
              type="checkbox"
              checked={newPageShowOnMenu}
              onChange={(event) => setNewPageShowOnMenu(event.target.checked)}
              disabled={submitting}
            />
            Show on menu
          </label>
        </div>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleCreateChildPage()}
            disabled={submitting}
          >
            Create Page / Tab
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

        <div className="role-inline-form admin-access-management-search-grid">
          <label className="admin-access-management-search-full">
            Search tab/page by name or URL
            <input
              value={pageSearchKeyword}
              onChange={(event) => setPageSearchKeyword(event.target.value)}
              placeholder="e.g. dashboard or /admin/orders"
              disabled={submitting || loading}
            />
          </label>
        </div>

        <div className="admin-access-management-menu-list">
          {!filteredFlattenedMenus.length && (
            <p className="role-muted">
              {flattenedMenus.length
                ? 'No tab/page matches current search.'
                : 'No tab/page data available.'}
            </p>
          )}
          {visibleMappingMenus.map(({ node, depth }) => (
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

        <div className="admin-access-management-pagination">
          <p className="admin-access-management-pagination-summary">
            Showing {mappingMenuStart}-{mappingMenuEnd} of {filteredFlattenedMenus.length}
          </p>
          <div className="admin-access-management-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToMappingMenuPage(mappingMenuPage - 1)}
              disabled={mappingMenuPage <= 0}
            >
              Previous
            </button>
            {mappingMenuPaginationPages.map((pageNumber) => (
              <button
                key={`mapping-menu-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-access-management-page-btn ${pageNumber === mappingMenuPage ? 'is-active' : ''}`}
                onClick={() => handleGoToMappingMenuPage(pageNumber)}
              >
                {pageNumber + 1}
              </button>
            ))}
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToMappingMenuPage(mappingMenuPage + 1)}
              disabled={mappingMenuPage >= mappingMenuTotalPages - 1}
            >
              Next
            </button>
          </div>
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
              {visibleRoles.map((role) => (
                <tr key={role.code}>
                  <td>{role.code}</td>
                  <td>{role.name || '-'}</td>
                  <td>{role.menuKeys?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-access-management-pagination">
          <p className="admin-access-management-pagination-summary">
            Showing {roleTableStart}-{roleTableEnd} of {sortedRoles.length}
          </p>
          <div className="admin-access-management-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToRoleTablePage(roleTablePage - 1)}
              disabled={roleTablePage <= 0}
            >
              Previous
            </button>
            {roleTablePaginationPages.map((pageNumber) => (
              <button
                key={`role-table-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-access-management-page-btn ${pageNumber === roleTablePage ? 'is-active' : ''}`}
                onClick={() => handleGoToRoleTablePage(pageNumber)}
              >
                {pageNumber + 1}
              </button>
            ))}
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToRoleTablePage(roleTablePage + 1)}
              disabled={roleTablePage >= roleTableTotalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </article>

      <article className="role-card">
        <h3>Current Tabs / Pages</h3>
        <div className="role-inline-form admin-access-management-search-grid">
          <label className="admin-access-management-search-full">
            Search tab/page by name or URL
            <input
              value={pageSearchKeyword}
              onChange={(event) => setPageSearchKeyword(event.target.value)}
              placeholder="e.g. user support or /user/support"
              disabled={submitting || loading}
            />
          </label>
        </div>
        <div className="role-inline-actions admin-access-management-search-actions">
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => setPageSearchKeyword('')}
            disabled={!pageSearchKeyword.trim()}
          >
            Clear Search
          </button>
        </div>
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
                <th>Show On Menu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filteredSortedMenus.length && (
                <tr>
                  <td colSpan={8} className="role-empty-cell">
                    {sortedMenus.length
                      ? 'No tab/page matches current search.'
                      : 'No tab/page data available.'}
                  </td>
                </tr>
              )}
              {visibleMenus.map((menu) => (
                <tr
                  key={menu.key}
                  className="admin-access-management-record"
                  onClick={() => openMenuEditor(menu)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openMenuEditor(menu)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Edit menu ${menu.label}`}
                >
                  <td>{menu.key}</td>
                  <td>{isContainerMenu(menu) ? 'TAB' : 'PAGE'}</td>
                  <td>{menu.label}</td>
                  <td>{normalizeMenuPath(menu.path) || '-'}</td>
                  <td>{menu.parentMenuKey || '-'}</td>
                  <td>{menu.permission || '-'}</td>
                  <td>{menu.showOnMenu === false ? 'No' : 'Yes'}</td>
                  <td className="admin-access-management-row-actions">
                    <button
                      type="button"
                      className="admin-access-management-delete-btn"
                      onClick={(event) => {
                        event.stopPropagation()
                        requestDeleteMenu(menu)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      disabled={submitting || editingMenuSubmitting || Boolean(deletingMenuId)}
                    >
                      {deletingMenuId === menu.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-access-management-pagination">
          <p className="admin-access-management-pagination-summary">
            Showing {menuTableStart}-{menuTableEnd} of {filteredSortedMenus.length}
          </p>
          <div className="admin-access-management-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToMenuTablePage(menuTablePage - 1)}
              disabled={menuTablePage <= 0}
            >
              Previous
            </button>
            {menuTablePaginationPages.map((pageNumber) => (
              <button
                key={`menu-table-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-access-management-page-btn ${pageNumber === menuTablePage ? 'is-active' : ''}`}
                onClick={() => handleGoToMenuTablePage(pageNumber)}
              >
                {pageNumber + 1}
              </button>
            ))}
            <button
              type="button"
              className="role-btn-ghost admin-access-management-page-btn"
              onClick={() => handleGoToMenuTablePage(menuTablePage + 1)}
              disabled={menuTablePage >= menuTableTotalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </article>

      {pendingDeleteMenu && (
        <div className="role-modal-backdrop" onClick={closeDeleteMenuModal}>
          <div
            className="role-modal admin-access-management-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Confirm Delete</h3>
            <p className="role-muted">
              Delete {isContainerMenu(pendingDeleteMenu) ? 'tab' : 'page'}{' '}
              <strong>{pendingDeleteMenu.label}</strong>?
            </p>
            <p className="role-muted">This action cannot be undone.</p>
            {pendingDeleteChildCount > 0 && (
              <p className="role-muted admin-access-management-delete-note">
                This item has {pendingDeleteChildCount} child item(s). Child items will be moved
                to root level after delete.
              </p>
            )}
            <div className="role-modal-actions">
              <button
                type="button"
                className="role-btn-primary admin-access-management-danger-btn"
                onClick={() => void handleDeleteMenu()}
                disabled={Boolean(deletingMenuId)}
              >
                {deletingMenuId === pendingDeleteMenu.id ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeDeleteMenuModal}
                disabled={Boolean(deletingMenuId)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMenu && editMenuForm && (
        <div className="role-modal-backdrop" onClick={closeMenuEditor}>
          <div
            className="role-modal admin-access-management-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Edit Tab / Page</h3>
            {editingMenuError && <p className="role-error">{editingMenuError}</p>}
            <div className="role-inline-form admin-access-management-create-page-grid">
              <label>
                Parent Tab
                <select
                  value={editMenuForm.parentMenuId}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          parentMenuId: event.target.value,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting}
                >
                  <option value="">None (root level)</option>
                  {editParentTabOptions.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.label} ({menu.key})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Menu Key
                <input
                  value={editMenuForm.menuKey}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          menuKey: event.target.value,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting}
                />
              </label>
              <label>
                Label
                <input
                  value={editMenuForm.label}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          label: event.target.value,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting}
                />
              </label>
              <label>
                URL Page
                <input
                  value={editMenuForm.path}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          path: event.target.value,
                        }
                        : prev,
                    )
                  }
                  placeholder="Leave empty to treat as tab"
                  disabled={editingMenuSubmitting}
                />
              </label>
              <label>
                Display Order
                <input
                  value={editMenuForm.displayOrder}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          displayOrder: event.target.value,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting}
                />
              </label>
              <label>
                Required Permission
                <select
                  value={editMenuForm.permissionCode}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          permissionCode: event.target.value,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting || !normalizeMenuPath(editMenuForm.path)}
                >
                  <option value="">None</option>
                  {permissions.map((permission) => (
                    <option key={permission.code} value={permission.code}>
                      {permission.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-access-management-checkbox-label">
                <input
                  type="checkbox"
                  checked={editMenuForm.showOnMenu}
                  onChange={(event) =>
                    setEditMenuForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          showOnMenu: event.target.checked,
                        }
                        : prev,
                    )
                  }
                  disabled={editingMenuSubmitting}
                />
                Show on menu
              </label>
            </div>
            <div className="role-modal-actions">
              <button
                type="button"
                className="role-btn-primary"
                onClick={() => void handleSaveMenuEditor()}
                disabled={editingMenuSubmitting}
              >
                {editingMenuSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeMenuEditor}
                disabled={editingMenuSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="role-muted">Loading access management...</p>}
      {error && <p className="role-error">{error}</p>}
      {success && <p className="role-muted">{success}</p>}
    </section>
  )
}

export default AdminAccessManagementPage
