import RoleFeaturePage from '../shared/RoleFeaturePage'

function AdminProductManagementPage() {
  return (
    <RoleFeaturePage
      title="Quản lý sản phẩm"
      description="Trang quản lý sản phẩm hệ thống. Có thể tích hợp Product Service khi backend hoàn thiện endpoint."
      highlights={[
        'Tạo/cập nhật thông tin sản phẩm',
        'Liên kết SKU với inventory',
        'Quản lý trạng thái hiển thị sản phẩm',
      ]}
    />
  )
}

export default AdminProductManagementPage
