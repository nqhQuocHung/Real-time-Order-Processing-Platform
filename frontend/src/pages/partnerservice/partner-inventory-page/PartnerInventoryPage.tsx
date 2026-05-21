import { useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
import './PartnerInventoryPage.css'

type InventoryStock = {
  productId: string
  itemId?: string
  shopId?: string
  name?: string
  description?: string
  categoryId?: string
  brand?: string
  status?: string
  imageUrl?: string
  sku?: string
  productName?: string
  availableQuantity: number
  reservedQuantity: number
  totalQuantity: number
}

function PartnerInventoryPage() {
  const { t } = useI18n()
  const [productId, setProductId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stock, setStock] = useState<InventoryStock | null>(null)

  async function lookupStock() {
    if (!productId.trim()) {
      setError(t('pages.partnerInventory.errors.missingProductId', 'Please enter productId.'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apis().get(endpoints.inventories.stock(productId.trim()))
      const data = extractApiData<InventoryStock>(response)
      setStock(data)
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          t('pages.partnerInventory.errors.lookupFailed', 'Cannot look up inventory.'),
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="partner-inventory-page role-page-stack">
      <article className="role-card">
        <h2>{t('pages.partnerInventory.title', 'Partner inventory')}</h2>
        <p className="role-muted">
          {t(
            'pages.partnerInventory.subtitle',
            'Track stock changes and keep inventory healthy.',
          )}
        </p>
        <div className="role-inline-form">
          <label>
            {t('pages.partnerInventory.productId', 'Product ID')}
            <input
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder={t('pages.partnerInventory.placeholders.productId', 'Product UUID')}
            />
          </label>
          <button type="button" className="role-btn-primary" onClick={() => void lookupStock()}>
            {loading
              ? t('pages.partnerInventory.actions.lookingUp', 'Looking up...')
              : t('pages.partnerInventory.actions.lookup', 'Lookup Inventory')}
          </button>
        </div>
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <h3>{t('pages.partnerInventory.resultTitle', 'Result')}</h3>
        {stock ? (
          <div className="role-kv-grid">
            <div>
              <span>{t('pages.partnerInventory.productId', 'Product ID')}</span>
              <strong>{stock.productId}</strong>
            </div>
            <div>
              <span>SKU</span>
              <strong>{stock.sku || '-'}</strong>
            </div>
            <div>
              <span>{t('pages.partnerInventory.productName', 'Product Name')}</span>
              <strong>{stock.name || stock.productName || '-'}</strong>
            </div>
            <div>
              <span>{t('pages.partnerInventory.available', 'Available')}</span>
              <strong>{stock.availableQuantity}</strong>
            </div>
            <div>
              <span>{t('pages.partnerInventory.reserved', 'Reserved')}</span>
              <strong>{stock.reservedQuantity}</strong>
            </div>
            <div>
              <span>{t('pages.partnerInventory.total', 'Total')}</span>
              <strong>{stock.totalQuantity}</strong>
            </div>
          </div>
        ) : (
          <p className="role-muted">
            {t('pages.partnerInventory.empty', 'No inventory data yet.')}
          </p>
        )}
      </article>
    </section>
  )
}

export default PartnerInventoryPage
