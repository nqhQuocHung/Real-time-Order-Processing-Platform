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
  key: string
  label: string
  path: string
  permission?: string
}

function RoleLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

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
    .filter((item) => item.path && item.key && item.label)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((item) => ({
      key: item.key,
      label: item.label,
      path: item.path,
      permission: item.permission || '',
    }))

  const currentMenu: NavigationMenuItem[] = (
    dynamicMenu.length ? dynamicMenu : menuConfig[currentRole]
  ).filter((item) => !item.permission || hasPermission(currentRole, item.permission as PermissionKey))

  const editProfilePath = useMemo(() => {
    const profileMenu = currentMenu.find((item) => {
      const key = item.key.toLowerCase()
      const path = item.path.toLowerCase()
      return key.includes('profile') || path.includes('/profile')
    })

    if (profileMenu?.path) {
      return profileMenu.path
    }

    if (currentRole === AppRole.SHOPEE_PARTNER) {
      return '/partner/profile'
    }

    return '/user/profile'
  }, [currentMenu, currentRole])

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
          {currentMenu.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) => `role-menu-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

      </aside>

      <main className="role-main">
        <header className="role-header">
          <div>
            <h2>{currentMenu.find((item) => item.path === location.pathname)?.label || 'Dashboard'}</h2>
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
