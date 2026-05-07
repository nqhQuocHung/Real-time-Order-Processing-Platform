import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import './AdminSystemSettingsPage.css'

function AdminSystemSettingsPage() {
  return (
    <RoleFeaturePage
      className="admin-system-settings-page"
      title="Cấu hình hệ thống"
      description="Trang cấu hình dành cho Admin. Có thể tích hợp cấu hình service khi backend mở API quản trị."
      highlights={[
        'Cấu hình tham số vận hành',
        'Quản lý cổng tích hợp đối tác',
        'Theo dõi trạng thái môi trường',
      ]}
    />
  )
}

export default AdminSystemSettingsPage
