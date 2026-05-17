import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import './AdminProductManagementPage.css'

function AdminProductManagementPage() {
  return (
    <RoleFeaturePage
      className="admin-product-management-page"
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
