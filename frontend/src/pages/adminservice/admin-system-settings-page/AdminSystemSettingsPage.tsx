import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import { useI18n } from '../../../i18n/I18nProvider'
import './AdminSystemSettingsPage.css'

function AdminSystemSettingsPage() {
  const { t } = useI18n()

  return (
    <RoleFeaturePage
      className="admin-system-settings-page"
      title={t('pages.adminSystemSettings.title', 'System settings')}
      description={t(
        'pages.adminSystemSettings.subtitle',
        'Configure system-level parameters and defaults.',
      )}
      highlights={[
        t('pages.adminSystemSettings.general', 'General'),
        t('pages.adminSystemSettings.integrations', 'Integrations'),
        t('pages.adminSystemSettings.security', 'Security'),
      ]}
    />
  )
}

export default AdminSystemSettingsPage
