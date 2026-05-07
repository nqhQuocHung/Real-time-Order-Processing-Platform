import RoleFeaturePage from '../shared/RoleFeaturePage'

function PartnerProductsPage() {
  return (
    <RoleFeaturePage
      title="Sản phẩm của tôi"
      description="Danh sách sản phẩm thuộc partner hiện tại. Sẵn sàng tích hợp Product API theo partner scope."
      highlights={[
        'Theo dõi trạng thái sản phẩm trong gian hàng',
        'Quản lý SKU và đồng bộ tồn kho',
        'Cập nhật thông tin hiển thị sản phẩm',
      ]}
    />
  )
}

export default PartnerProductsPage
