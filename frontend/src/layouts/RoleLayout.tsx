import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { fetchMyProfile } from '../auth/authSession'
import {
  apis,
  clearAuthSession,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../config/apis'
import { AppRole, getRoleLabel } from '../constants/roles'
import { menuConfig } from '../config/menuConfig'
import { hasPermission, type PermissionKey } from '../config/permissionConfig'
import { getDefaultPathByRole } from '../config/roleConfig'
import defaultAvatar from '../assets/default-avatar.svg'
import './RoleLayout.css'

type ChangePasswordOtpResponse = {
  userId: string
  email?: string
  expiresAt?: string
  message?: string
}

type ChangePasswordResponse = {
  userId: string
  message?: string
}

type NavigationMenuItem = {
  id?: string
  key: string
  label: string
  path?: string
  permission?: string
  displayOrder?: number
  parentMenuId?: string | null
  parentMenuKey?: string | null
  isContainer?: boolean
}

function isDeprecatedAdminMenuItem(item: NavigationMenuItem): boolean {
  const path = (item.path || '').toLowerCase()
  return path === '/admin/users' || path === '/admin/partners'
}

type MenuTreeNode = NavigationMenuItem & {
  children: MenuTreeNode[]
}

function compareMenuOrder(first: Pick<NavigationMenuItem, 'displayOrder' | 'key'>, second: Pick<NavigationMenuItem, 'displayOrder' | 'key'>) {
  const firstOrder = typeof first.displayOrder === 'number' ? first.displayOrder : 100
  const secondOrder = typeof second.displayOrder === 'number' ? second.displayOrder : 100
  if (firstOrder !== secondOrder) {
    return firstOrder - secondOrder
  }
  return first.key.localeCompare(second.key)
}

function buildMenuTree(menuItems: NavigationMenuItem[]): MenuTreeNode[] {
  const sortedItems = [...menuItems].sort(compareMenuOrder)
  const nodeMap = new Map<string, MenuTreeNode>()
  sortedItems.forEach((item) => {
    nodeMap.set(item.key, { ...item, children: [] })
  })

  const rootNodes: MenuTreeNode[] = []
  nodeMap.forEach((node) => {
    const parentKey = (node.parentMenuKey || '').trim()
    const parentNode = parentKey ? nodeMap.get(parentKey) : null

    if (parentNode) {
      parentNode.children.push(node)
      return
    }
    rootNodes.push(node)
  })

  function sortNodes(nodes: MenuTreeNode[]) {
    nodes.sort(compareMenuOrder)
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(rootNodes)
  return rootNodes
}

function nodeHasPath(node: NavigationMenuItem) {
  return Boolean(node.path && node.path.trim())
}

function findActiveMenuKeyChain(nodes: MenuTreeNode[], pathname: string): string[] {
  for (const node of nodes) {
    const childChain = findActiveMenuKeyChain(node.children, pathname)
    if (childChain.length > 0) {
      return [node.key, ...childChain]
    }

    if (node.path === pathname) {
      return [node.key]
    }
  }

  return []
}

function nodeContainsPath(node: MenuTreeNode, pathname: string): boolean {
  if (node.path === pathname) {
    return true
  }
  return node.children.some((child) => nodeContainsPath(child, pathname))
}

function isContainerNode(node: NavigationMenuItem) {
  return Boolean(node.isContainer) || !nodeHasPath(node)
}

function isUserScopedPath(path?: string) {
  return Boolean(path && path.startsWith('/user/'))
}

function normalizePath(path?: string) {
  return (path || '').trim()
}

function withStaticGrouping(menuItems: NavigationMenuItem[], currentRole: AppRole): NavigationMenuItem[] {
  const hasExplicitParent = menuItems.some((item) => (item.parentMenuKey || '').trim())
  if (hasExplicitParent) {
    return menuItems
  }

  const groupPrefix = currentRole === AppRole.ADMIN
    ? '/admin/'
    : currentRole === AppRole.SHOPEE_PARTNER
      ? '/partner/'
      : ''

  if (!groupPrefix) {
    return menuItems
  }

  const groupKey = currentRole === AppRole.ADMIN ? 'admin-group' : 'partner-group'
  const groupLabel = currentRole === AppRole.ADMIN ? 'Admin' : 'Partner Management'

  const hasGroupChildren = menuItems.some((item) => normalizePath(item.path).startsWith(groupPrefix))
  if (!hasGroupChildren) {
    return menuItems
  }

  const groupNode: NavigationMenuItem = {
    key: groupKey,
    label: groupLabel,
    path: '',
    isContainer: true,
    displayOrder: 999,
  }

  const groupedMenus = menuItems.map((item) => {
    if (!normalizePath(item.path).startsWith(groupPrefix)) {
      return item
    }
    return {
      ...item,
      parentMenuKey: groupKey,
    }
  })

  return [groupNode, ...groupedMenus]
}

function isCurrentPathActive(path?: string, pathname?: string) {
  if (!path || !pathname) {
    return false
  }
  return path === pathname
}

function isMenuVisibleForRole(item: NavigationMenuItem, currentRole: AppRole) {
  const key = item.key.toLowerCase()
  if (key.includes('profile')) {
    return false
  }

  const path = normalizePath(item.path)
  if (path.includes('/profile')) {
    return false
  }

  if (currentRole === AppRole.ADMIN && isDeprecatedAdminMenuItem(item)) {
    return false
  }

  return true
}

function RoleLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({})

  const [avatarUrl, setAvatarUrl] = useState('')
  const [useFallbackAvatar, setUseFallbackAvatar] = useState(false)

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState('')
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('')

  const currentRole = session?.role || AppRole.USER
  const dashboardPath = getDefaultPathByRole(currentRole)

  const dynamicMenu: NavigationMenuItem[] = (session?.backendMenus || [])
    .filter((item) => item.key && item.label)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      path: item.path,
      permission: item.permission || '',
      displayOrder: item.displayOrder,
      parentMenuId: item.parentMenuId || null,
      parentMenuKey: item.parentMenuKey || null,
      isContainer: item.isContainer,
    }))

  const roleMenuSource: NavigationMenuItem[] = useMemo(() => {
    const staticMenu = (menuConfig[currentRole] as NavigationMenuItem[]).map((item) => ({
      ...item,
      displayOrder: item.displayOrder || 100,
    }))
    const baseMenu = dynamicMenu.length ? dynamicMenu : staticMenu

    if (currentRole !== AppRole.ADMIN) {
      return withStaticGrouping(baseMenu, currentRole)
    }

    if (dynamicMenu.length) {
      return withStaticGrouping(baseMenu, currentRole)
    }

    const mergedByKey = new Map<string, NavigationMenuItem>()
    ;[...baseMenu, ...(menuConfig[AppRole.USER] as NavigationMenuItem[])].forEach((item) => {
      if (!mergedByKey.has(item.key)) {
        mergedByKey.set(item.key, {
          ...item,
          displayOrder: item.displayOrder || 100,
        })
      }
    })

    return withStaticGrouping(Array.from(mergedByKey.values()), currentRole)
  }, [currentRole, dynamicMenu])

  const currentMenu: NavigationMenuItem[] = useMemo(() => {
    return roleMenuSource
      .filter((item) => {
        if (isContainerNode(item)) {
          return true
        }

        const allowedByPermission =
          !item.permission ||
          hasPermission(currentRole, item.permission as PermissionKey) ||
          (currentRole === AppRole.ADMIN && isUserScopedPath(item.path))

        return allowedByPermission
      })
      .filter((item) => isMenuVisibleForRole(item, currentRole))
  }, [roleMenuSource, currentRole])

  const menuTree = useMemo(() => buildMenuTree(currentMenu), [currentMenu])

  const activeMenuKeyChain = useMemo(
    () => findActiveMenuKeyChain(menuTree, location.pathname),
    [menuTree, location.pathname],
  )
  const activeMenuChainKey = activeMenuKeyChain.join('::')

  const editProfilePath = useMemo(() => {
    if (currentRole === AppRole.SHOPEE_PARTNER) {
      return '/partner/profile'
    }

    return '/user/profile'
  }, [currentRole])

  const currentPageLabel = useMemo(() => {
    const matchedMenu = currentMenu.find((item) => item.path === location.pathname)
    if (matchedMenu) {
      return matchedMenu.label
    }

    if (location.pathname.startsWith('/partner/profile')) {
      return 'Partner Profile'
    }

    if (location.pathname.startsWith('/user/profile')) {
      return 'Profile'
    }

    return 'Dashboard'
  }, [currentMenu, location.pathname])

  const shouldShowMobileMenuToggle = location.pathname === dashboardPath

  useEffect(() => {
    let active = true

    async function loadAvatar() {
      try {
        const profile = await fetchMyProfile()
        if (!active) {
          return
        }

        setAvatarUrl(profile.avatar?.trim() || '')
        setUseFallbackAvatar(false)
      } catch {
        if (active) {
          setAvatarUrl('')
        }
      }
    }

    void loadAvatar()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ avatar?: string }>
      const nextAvatar = customEvent.detail?.avatar?.trim() || ''
      setAvatarUrl(nextAvatar)
      setUseFallbackAvatar(false)
    }

    window.addEventListener('auth-profile-updated', handleProfileUpdated as EventListener)

    return () => {
      window.removeEventListener('auth-profile-updated', handleProfileUpdated as EventListener)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)')

    const sync = (matches: boolean) => {
      setIsMobileViewport(matches)
      if (!matches) {
        setIsMobileMenuOpen(false)
      }
    }

    sync(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => {
      sync(event.matches)
    }

    mediaQuery.addEventListener('change', onChange)

    return () => {
      mediaQuery.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsUserMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!activeMenuChainKey) {
      return
    }

    setOpenMenuGroups((prev) => {
      const next = { ...prev }
      let changed = false
      activeMenuChainKey.split('::').forEach((menuKey) => {
        if (!next[menuKey]) {
          next[menuKey] = true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [activeMenuChainKey])

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    function handleMouseDown(event: MouseEvent) {
      if (!userMenuRef.current) {
        return
      }

      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isUserMenuOpen])

  function resetChangePasswordForm() {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setOtp('')
    setOtpEmail('')
    setOtpStep(false)
    setChangePasswordError('')
    setChangePasswordSuccess('')
  }

  function closeChangePasswordModal() {
    if (changePasswordLoading) {
      return
    }

    setIsChangePasswordOpen(false)
    resetChangePasswordForm()
  }

  async function handleSendChangePasswordOtp() {
    setChangePasswordError('')
    setChangePasswordSuccess('')

    if (!session?.userId) {
      setChangePasswordError('User session not found. Please login again.')
      return
    }

    if (!oldPassword.trim()) {
      setChangePasswordError('Please enter your current password.')
      return
    }

    if (!newPassword.trim()) {
      setChangePasswordError('Please enter a new password.')
      return
    }

    if (newPassword.trim().length < 8) {
      setChangePasswordError('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError('Password confirmation does not match.')
      return
    }

    try {
      setChangePasswordLoading(true)

      const response = await apis().post(endpoints.auth.otpChangePassword, {
        userId: session.userId,
        oldPassword: oldPassword.trim(),
      })

      const data = extractApiData<ChangePasswordOtpResponse>(response)
      setOtpStep(true)
      setOtp('')
      setOtpEmail(data.email || session.email || '')
      setChangePasswordSuccess(
        data.message || 'OTP sent to your email. Please enter OTP to continue.',
      )
    } catch (err) {
      setChangePasswordError(
        extractApiErrorMessage(err, 'Cannot send OTP for password change.'),
      )
    } finally {
      setChangePasswordLoading(false)
    }
  }

  async function handleConfirmChangePassword() {
    setChangePasswordError('')
    setChangePasswordSuccess('')

    if (!session?.userId) {
      setChangePasswordError('User session not found. Please login again.')
      return
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setChangePasswordError('OTP must be exactly 6 digits.')
      return
    }

    try {
      setChangePasswordLoading(true)
      const response = await apis().post(endpoints.auth.changePassword, {
        userId: session.userId,
        otp: otp.trim(),
        newPassword: newPassword.trim(),
      })

      const data = extractApiData<ChangePasswordResponse>(response)
      setChangePasswordSuccess(data.message || 'Password updated successfully.')
      window.setTimeout(() => {
        setIsChangePasswordOpen(false)
        resetChangePasswordForm()
      }, 1200)
    } catch (err) {
      setChangePasswordError(
        extractApiErrorMessage(err, 'Password change failed. Please check OTP and try again.'),
      )
    } finally {
      setChangePasswordLoading(false)
    }
  }

  function handleEditProfile() {
    setIsUserMenuOpen(false)
    navigate(editProfilePath)
  }

  function openChangePasswordModal() {
    setIsUserMenuOpen(false)
    setIsChangePasswordOpen(true)
    resetChangePasswordForm()
  }

  function handleLogout() {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  function handleGoDashboard() {
    setIsUserMenuOpen(false)
    setIsMobileMenuOpen(false)
    navigate(dashboardPath)
  }

  const displayedAvatar = !useFallbackAvatar && avatarUrl ? avatarUrl : defaultAvatar

  function toggleMenuGroup(menuKey: string) {
    setOpenMenuGroups((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }))
  }

  function renderMenuNode(node: MenuTreeNode) {
    const hasChildren = node.children.length > 0
    const nodePath = normalizePath(node.path)
    const pathActive = isCurrentPathActive(nodePath, location.pathname)
    const nodeOrChildActive = hasChildren ? nodeContainsPath(node, location.pathname) : pathActive
    const isOpen = hasChildren ? (openMenuGroups[node.key] ?? nodeOrChildActive) : false

    if (!hasChildren && isContainerNode(node) && !nodeHasPath(node)) {
      return null
    }

    if (hasChildren || isContainerNode(node)) {
      return (
        <div key={node.key} className="role-menu-group">
          <button
            type="button"
            className={`role-menu-item role-menu-group-trigger ${nodeOrChildActive ? 'active' : ''}`}
            onClick={() => toggleMenuGroup(node.key)}
            aria-expanded={hasChildren ? isOpen : false}
          >
            <span>{node.label}</span>
            {hasChildren && (
              <span className={`role-menu-group-caret ${isOpen ? 'open' : ''}`}>
                v
              </span>
            )}
          </button>

          {hasChildren && isOpen && (
            <div className="role-submenu">
              {node.children.map((child) => renderMenuNode(child))}
            </div>
          )}
        </div>
      )
    }

    if (!nodeHasPath(node)) {
      return null
    }

    return (
      <NavLink
        key={node.key}
        to={nodePath}
        className={({ isActive }) => `role-menu-item ${isActive ? 'active' : ''}`}
      >
        {node.label}
      </NavLink>
    )
  }

  function renderUserMenu(compact = false) {
    const usernameLabel = session?.username || 'User'

    return (
      <div
        className={`role-user-menu ${compact ? 'role-user-menu-compact' : ''}`}
        ref={userMenuRef}
      >
        <button
          type="button"
          className={`role-user-trigger ${compact ? 'compact' : ''}`}
          onClick={() => setIsUserMenuOpen((state) => !state)}
          aria-expanded={isUserMenuOpen}
        >
          <img
            src={displayedAvatar}
            alt="User avatar"
            className="role-avatar"
            onError={() => setUseFallbackAvatar(true)}
          />
          {!compact && (
            <div className="role-user-meta">
              <strong>{session?.username || 'Unknown user'}</strong>
              <span>{session?.email || '-'}</span>
            </div>
          )}
          {compact ? (
            <span className="role-user-trigger-label">{usernameLabel}</span>
          ) : (
            <span className={`role-user-caret ${isUserMenuOpen ? 'open' : ''}`}>v</span>
          )}
        </button>

        {isUserMenuOpen && (
          <div className="role-user-dropdown" role="menu">
            <button
              type="button"
              className="role-user-dropdown-item"
              onClick={handleEditProfile}
            >
              Edit profile
            </button>
            <button
              type="button"
              className="role-user-dropdown-item"
              onClick={openChangePasswordModal}
            >
              Change password
            </button>
            <button
              type="button"
              className="role-user-dropdown-item danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="role-layout-shell">
      <aside className="role-sidebar">
        <div className="role-sidebar-top">
          <button
            type="button"
            className="role-brand role-brand-button"
            onClick={handleGoDashboard}
          >
            <span className="role-brand-badge">RT</span>
            <div>
              <h1>Order Platform</h1>
              <p>{getRoleLabel(currentRole)}</p>
            </div>
          </button>

          {isMobileViewport && renderUserMenu(true)}
        </div>

        {shouldShowMobileMenuToggle && (
          <button
            type="button"
            className="role-mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen((state) => !state)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="role-sidebar-menu"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <span aria-hidden="true" className="role-mobile-menu-icon">
              <span />
              <span />
              <span />
            </span>
          </button>
        )}

        <nav
          id="role-sidebar-menu"
          className={`role-menu ${isMobileMenuOpen ? 'is-open' : ''}`}
        >
          {menuTree.map((node) => renderMenuNode(node))}
        </nav>

      </aside>

      <main className="role-main">
        <header className="role-header">
          <div>
            <h2>{currentPageLabel}</h2>
            <p className="role-muted">Role: {getRoleLabel(currentRole)}</p>
          </div>
          {!isMobileViewport && <div className="role-header-actions">{renderUserMenu()}</div>}
        </header>

        <section className="role-content">
          <Outlet />
        </section>
      </main>

      {isChangePasswordOpen && (
        <div className="role-modal-backdrop" onClick={closeChangePasswordModal}>
          <div className="role-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Change password</h3>

            {changePasswordError && <p className="role-error">{changePasswordError}</p>}
            {changePasswordSuccess && <p className="role-muted">{changePasswordSuccess}</p>}

            {!otpStep && (
              <div className="role-modal-field-grid">
                <label className="role-modal-label" htmlFor="oldPasswordInput">
                  Current password
                  <input
                    id="oldPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="current-password"
                  />
                </label>

                <label className="role-modal-label" htmlFor="newPasswordInput">
                  New password
                  <input
                    id="newPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="new-password"
                  />
                </label>

                <label className="role-modal-label" htmlFor="confirmPasswordInput">
                  Confirm new password
                  <input
                    id="confirmPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}

            {otpStep && (
              <div className="role-modal-field-grid">
                <p className="role-muted">OTP has been sent to {otpEmail || 'your email'}.</p>

                <label className="role-modal-label" htmlFor="otpInput">
                  OTP (6 digits)
                  <input
                    id="otpInput"
                    className="role-modal-input"
                    type="text"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    disabled={changePasswordLoading}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </label>
              </div>
            )}

            <div className="role-modal-actions">
              {!otpStep && (
                <button
                  type="button"
                  className="role-btn-primary"
                  onClick={handleSendChangePasswordOtp}
                  disabled={changePasswordLoading}
                >
                  {changePasswordLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              )}

              {otpStep && (
                <>
                  <button
                    type="button"
                    className="role-btn-ghost"
                    onClick={handleSendChangePasswordOtp}
                    disabled={changePasswordLoading}
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    className="role-btn-primary"
                    onClick={handleConfirmChangePassword}
                    disabled={changePasswordLoading}
                  >
                    {changePasswordLoading ? 'Updating...' : 'Confirm'}
                  </button>
                </>
              )}

              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeChangePasswordModal}
                disabled={changePasswordLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleLayout
