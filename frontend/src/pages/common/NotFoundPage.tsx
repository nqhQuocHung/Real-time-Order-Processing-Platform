import { useNavigate } from 'react-router-dom'
import { getAuthSession } from '../../config/apis'
import { getDefaultPathByRole } from '../../config/roleConfig'

function NotFoundPage() {
  const navigate = useNavigate()
  const session = getAuthSession()

  const fallbackPath = session?.role
    ? getDefaultPathByRole(session.role)
    : '/login'

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>404 - Page Not Found</h2>
        <p className="role-muted">Trang bạn truy cập không tồn tại.</p>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => navigate(fallbackPath, { replace: true })}
          >
            Quay về dashboard
          </button>
        </div>
      </article>
    </section>
  )
}

export default NotFoundPage
