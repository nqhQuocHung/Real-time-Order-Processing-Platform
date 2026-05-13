import { useEffect, useMemo, useState } from 'react'
import { apis, endpoints, extractApiData, extractApiErrorMessage } from '../../../config/apis'
import ProductCard, { type ProductCardData } from '../../../components/products/ProductCard'
import './UserProductsPage.css'

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function UserProductsPage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadCatalog() {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.catalog)
      const data = extractApiData<ProductCardData[]>(response)
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
        <div className="user-products-page-grid">
          {visibleProducts.map((item) => (
            <ProductCard key={item.stockId || item.itemId || item.productId} product={item} />
          ))}
          {!visibleProducts.length && (
            <p className="role-empty-cell user-products-page-empty">
              Khong co san pham dang ban.
            </p>
          )}
        </div>
      </article>
    </section>
  )
}

export default UserProductsPage
