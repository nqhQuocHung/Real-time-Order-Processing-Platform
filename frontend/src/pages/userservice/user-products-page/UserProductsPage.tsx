import { useEffect, useMemo, useState } from 'react'
import { apis, endpoints, extractApiData, extractApiErrorMessage } from '../../../config/apis'
import './UserProductsPage.css'

type ProductCatalogItem = {
  stockId?: string
  productId: string
  sku?: string | null
  productName?: string | null
  availableQuantity?: number | null
  reservedQuantity?: number | null
  totalQuantity?: number | null
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function UserProductsPage() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadCatalog() {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.catalog)
      const data = extractApiData<ProductCatalogItem[]>(response)
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load product catalog.'))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const visibleProducts = useMemo(
    () => products.filter((item) => normalizeQuantity(item.totalQuantity) > 0),
    [products],
  )

  return (
    <section className="user-products-page role-page-stack">
      <article className="role-card">
        <h2>Product Catalog</h2>
        <p className="role-muted">
          Danh sach toan bo san pham ma partner dang dang ban tren he thong.
        </p>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void loadCatalog()}>
            {loading ? 'Loading...' : 'Refresh Catalog'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((item) => (
                <tr key={item.stockId || item.productId}>
                  <td>{item.productId}</td>
                  <td>{item.productName?.trim() || '-'}</td>
                  <td>{item.sku?.trim() || '-'}</td>
                  <td>{normalizeQuantity(item.availableQuantity)}</td>
                  <td>{normalizeQuantity(item.reservedQuantity)}</td>
                  <td>{normalizeQuantity(item.totalQuantity)}</td>
                </tr>
              ))}
              {!visibleProducts.length && (
                <tr>
                  <td colSpan={6} className="role-empty-cell">
                    Khong co san pham dang ban.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default UserProductsPage
