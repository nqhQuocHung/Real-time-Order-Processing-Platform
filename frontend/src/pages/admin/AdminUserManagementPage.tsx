import RoleFeaturePage from '../shared/RoleFeaturePage'

function AdminUserManagementPage() {
  return (
    <RoleFeaturePage
      title="Quản lý người dùng"
      description="Màn hình quản trị user dành cho Admin. Hiện tại backend chưa expose endpoint user list/update cho dashboard này."
      highlights={[
        'Tìm kiếm user theo username/email',
        'Kích hoạt hoặc vô hiệu hoá tài khoản',
        'Phân quyền theo vai trò',
      ]}
    />
  )
}

export default AdminUserManagementPage
