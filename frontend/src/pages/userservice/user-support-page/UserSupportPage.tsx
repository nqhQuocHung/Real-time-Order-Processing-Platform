import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import './UserSupportPage.css'

function UserSupportPage() {
  return (
    <RoleFeaturePage
      className="user-support-page"
      title="Support"
      description="Support channels for end users."
      highlights={[
        'Hotline: 1900-xxxx',
        'Support email: support@platform.local',
        'Order issue troubleshooting guide',
      ]}
    />
  )
}

export default UserSupportPage
