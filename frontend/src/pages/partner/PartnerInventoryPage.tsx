import { useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../config/apis'

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
      setError('Vui lòng nhập productId.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apis().get(endpoints.inventories.stock(productId.trim()))
      const data = extractApiData<InventoryStock>(response)
      setStock(data)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không tra cứu được tồn kho.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Tồn kho</h2>
        <p className="role-muted">
          Partner tra cứu tồn kho theo productId thuộc phạm vi của mình.
        </p>
        <div className="role-inline-form">
          <label>
            Product ID
            <input
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="UUID sản phẩm"
            />
          </label>
          <button type="button" className="role-btn-primary" onClick={() => void lookupStock()}>
            {loading ? 'Đang tra cứu...' : 'Tra cứu tồn kho'}
          </button>
        </div>
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <h3>Kết quả</h3>
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
              <span>Tên sản phẩm</span>
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
          <p className="role-muted">Chưa có dữ liệu tồn kho.</p>
        )}
      </article>
    </section>
  )
}

export default PartnerInventoryPage
