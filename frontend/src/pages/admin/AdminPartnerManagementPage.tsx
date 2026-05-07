import RoleFeaturePage from '../shared/RoleFeaturePage'

function AdminPartnerManagementPage() {
  return (
    <RoleFeaturePage
      title="Quản lý Shopee Partner"
      description="Màn hình quản lý partner (onboarding, trạng thái, giới hạn vận hành)."
      highlights={[
        'Theo dõi trạng thái kích hoạt partner',
        'Cập nhật thông tin liên hệ và cấu hình gian hàng',
        'Gán quyền vận hành cho partner account',
      ]}
    />
  )
}

export default AdminPartnerManagementPage
