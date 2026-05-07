import RoleFeaturePage from '../../sharedservice/role-feature-page/RoleFeaturePage'
import './PartnerProductsPage.css'

function PartnerProductsPage() {
  return (
    <RoleFeaturePage
      className="partner-products-page"
      title="My Products"
      description="List of products under current partner scope. Ready to integrate Product API by partner scope."
      highlights={[
        'Track product status in your shop',
        'Manage SKU and synchronize inventory',
        'Update product display information',
      ]}
    />
  )
}

export default PartnerProductsPage
