import { useNavigate } from 'react-router-dom'
import { getAuthSession } from '../../config/apis'
import { getDefaultPathByRole } from '../../config/roleConfig'

function ForbiddenPage() {
  const navigate = useNavigate()
  const session = getAuthSession()

  const fallbackPath = session?.role
    ? getDefaultPathByRole(session.role)
    : '/login'

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>403 - Forbidden</h2>
        <p className="role-muted">
          Bạn không có quyền truy cập chức năng này.
        </p>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => navigate(fallbackPath, { replace: true })}
          >
            Quay về dashboard
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => navigate('/login', { replace: true })}
          >
            Về trang login
          </button>
        </div>
      </article>
    </section>
  )
}

export default ForbiddenPage
