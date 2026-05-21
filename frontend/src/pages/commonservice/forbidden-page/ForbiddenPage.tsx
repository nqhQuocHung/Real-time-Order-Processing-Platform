import { useNavigate } from 'react-router-dom'
import { getAuthSession } from '../../../config/apis'
import { getDefaultPathByRole } from '../../../config/roleConfig'
import { useI18n } from '../../../i18n/I18nProvider'
import './ForbiddenPage.css'

function ForbiddenPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const session = getAuthSession()

  const fallbackPath = session?.role
    ? getDefaultPathByRole(session.role)
    : '/login'

  return (
    <section className="forbidden-page role-page-stack">
      <article className="role-card">
        <h2>{t('pages.commonForbidden.title', 'Access denied')}</h2>
        <p className="role-muted">
          {t('pages.commonForbidden.subtitle', 'You do not have permission to view this page.')}
        </p>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => navigate(fallbackPath, { replace: true })}
          >
            {t('pages.commonForbidden.goDashboard', 'Go to dashboard')}
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => navigate('/login', { replace: true })}
          >
            {t('pages.commonForbidden.goHome', 'Go to home')}
          </button>
        </div>
      </article>
    </section>
  )
}

export default ForbiddenPage
