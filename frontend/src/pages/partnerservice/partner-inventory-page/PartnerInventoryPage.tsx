import { useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './PartnerInventoryPage.css'

type InventoryStock = {
  productId: string
  sku?: string
  productName?: string
  availableQuantity: number
  reservedQuantity: number
  totalQuantity: number
}

function PartnerInventoryPage() {
  const [productId, setProductId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stock, setStock] = useState<InventoryStock | null>(null)

  async function lookupStock() {
    if (!productId.trim()) {
      setError('Please enter productId.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apis().get(endpoints.inventories.stock(productId.trim()))
      const data = extractApiData<InventoryStock>(response)
      setStock(data)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot look up inventory.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="partner-inventory-page role-page-stack">
      <article className="role-card">
        <h2>Inventory</h2>
        <p className="role-muted">
          Partner can look up inventory by productId within their scope.
        </p>
        <div className="role-inline-form">
          <label>
            Product ID
            <input
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="Product UUID"
            />
          </label>
          <button type="button" className="role-btn-primary" onClick={() => void lookupStock()}>
            {loading ? 'Looking up...' : 'Lookup Inventory'}
          </button>
        </div>
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <h3>Result</h3>
        {stock ? (
          <div className="role-kv-grid">
            <div>
              <span>Product ID</span>
              <strong>{stock.productId}</strong>
            </div>
            <div>
              <span>SKU</span>
              <strong>{stock.sku || '-'}</strong>
            </div>
            <div>
              <span>Product Name</span>
              <strong>{stock.productName || '-'}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong>{stock.availableQuantity}</strong>
            </div>
            <div>
              <span>Reserved</span>
              <strong>{stock.reservedQuantity}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{stock.totalQuantity}</strong>
            </div>
          </div>
        ) : (
          <p className="role-muted">No inventory data yet.</p>
        )}
      </article>
    </section>
  )
}

export default PartnerInventoryPage
