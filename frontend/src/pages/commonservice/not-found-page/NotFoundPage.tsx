import { useNavigate } from 'react-router-dom'
import { getAuthSession } from '../../../config/apis'
import { getDefaultPathByRole } from '../../../config/roleConfig'
import { useI18n } from '../../../i18n/I18nProvider'
import './NotFoundPage.css'

function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const session = getAuthSession()

  const fallbackPath = session?.role
    ? getDefaultPathByRole(session.role)
    : '/login'

  return (
    <section className="not-found-page role-page-stack">
      <article className="role-card">
        <h2>{t('pages.commonNotFound.title', 'Page not found')}</h2>
        <p className="role-muted">
          {t('pages.commonNotFound.subtitle', 'The page you are looking for does not exist.')}
        </p>
        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => navigate(fallbackPath, { replace: true })}
          >
            {t('pages.commonNotFound.goHome', 'Go to home')}
          </button>
        </div>
      </article>
    </section>
  )
}

export default NotFoundPage
