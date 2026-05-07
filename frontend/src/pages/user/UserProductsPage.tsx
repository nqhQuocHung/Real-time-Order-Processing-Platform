import RoleFeaturePage from '../shared/RoleFeaturePage'

function UserProductsPage() {
  return (
    <RoleFeaturePage
      title="Sản phẩm"
      description="Danh mục sản phẩm dành cho người dùng. Trang này sẵn sàng kết nối Product API khi backend cung cấp endpoint catalog riêng."
      highlights={[
        'Hiển thị danh mục sản phẩm theo nhu cầu mua hàng',
        'Tìm kiếm sản phẩm',
        'Xem chi tiết giá và mô tả',
      ]}
    />
  )
}

export default UserProductsPage
