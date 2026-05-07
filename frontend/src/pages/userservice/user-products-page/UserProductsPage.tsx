import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import './UserProductsPage.css'

function UserProductsPage() {
  return (
    <RoleFeaturePage
      className="user-products-page"
      title="Products"
      description="Product catalog for end users. This page is ready to connect to the Product API when backend provides a dedicated catalog endpoint."
      highlights={[
        'Display product catalog for shopping needs',
        'Search products',
        'View pricing and description details',
      ]}
    />
  )
}

export default UserProductsPage
