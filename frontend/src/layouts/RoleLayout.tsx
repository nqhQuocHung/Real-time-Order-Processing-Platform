import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getAuthSession } from '../config/apis'
import { AppRole, getRoleLabel } from '../constants/roles'
import { menuConfig } from '../config/menuConfig'
import { hasPermission } from '../config/permissionConfig'
import './RoleLayout.css'

function RoleLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()

  const currentRole = session?.role || AppRole.USER
  const currentMenu = menuConfig[currentRole].filter((item) =>
    hasPermission(currentRole, item.permission),
  )

  function handleLogout() {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="role-layout-shell">
      <aside className="role-sidebar">
        <div className="role-brand">
          <span className="role-brand-badge">RT</span>
          <div>
            <h1>Order Platform</h1>
            <p>{getRoleLabel(currentRole)}</p>
          </div>
        </div>

        <nav className="role-menu">
          {currentMenu.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                `role-menu-item ${isActive ? 'active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="role-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="role-main">
        <header className="role-header">
          <div>
            <h2>{currentMenu.find((item) => item.path === location.pathname)?.label || 'Dashboard'}</h2>
            <p className="role-muted">Role: {getRoleLabel(currentRole)}</p>
          </div>
          <div className="role-user">
            <strong>{session?.username || 'Unknown user'}</strong>
            <span>{session?.email || '-'}</span>
          </div>
        </header>

        <section className="role-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

export default RoleLayout
