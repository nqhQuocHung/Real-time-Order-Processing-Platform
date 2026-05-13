import type { ReactNode } from 'react'
import './ProductCard.css'

export type ProductCardData = {
  stockId?: string
  stockUuid?: string
  productId: string
  itemId?: string
  shopId?: string
  name?: string | null
  productName?: string | null
  description?: string | null
  categoryId?: string | null
  brand?: string | null
  status?: string | null
  imageUrl?: string | null
  sku?: string | null
  availableQuantity?: number | null
  reservedQuantity?: number | null
  totalQuantity?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  isActive?: boolean | null
}

type ProductCardProps = {
  product: ProductCardData
  onEdit?: (product: ProductCardData) => void
  onDelete?: (product: ProductCardData) => void
  deleting?: boolean
  actionSlot?: ReactNode
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('vi-VN')
}

function ProductCard({ product, onEdit, onDelete, deleting, actionSlot }: ProductCardProps) {
  const displayName = product.name?.trim() || product.productName?.trim() || 'Unnamed Product'
  const displayStatus = product.status?.trim() || (product.isActive ? 'ACTIVE' : 'INACTIVE')
  const imageUrl = product.imageUrl?.trim() || ''

  return (
    <article className="product-card">
      <div className="product-card-image-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="product-card-image" loading="lazy" />
        ) : (
          <div className="product-card-image-placeholder">No image</div>
        )}
      </div>

      <div className="product-card-body">
        <header className="product-card-header">
          <h3>{displayName}</h3>
          <span className={`product-card-status ${displayStatus.toLowerCase()}`}>
            {displayStatus}
          </span>
        </header>

        <p className="product-card-description">
          {product.description?.trim() || 'No description.'}
        </p>

        <div className="product-card-meta">
          <span>Item ID: {product.itemId || product.productId}</span>
          <span>Shop ID: {product.shopId || '-'}</span>
          <span>Category: {product.categoryId?.trim() || '-'}</span>
          <span>Brand: {product.brand?.trim() || '-'}</span>
          <span>SKU: {product.sku?.trim() || '-'}</span>
          <span>Stock UUID: {product.stockUuid || '-'}</span>
        </div>

        <div className="product-card-quantities">
          <div>
            <small>Available</small>
            <strong>{normalizeQuantity(product.availableQuantity)}</strong>
          </div>
          <div>
            <small>Reserved</small>
            <strong>{normalizeQuantity(product.reservedQuantity)}</strong>
          </div>
          <div>
            <small>Total</small>
            <strong>{normalizeQuantity(product.totalQuantity)}</strong>
          </div>
        </div>

        <footer className="product-card-footer">
          <span>Created: {formatDate(product.createdAt)}</span>
          <span>Updated: {formatDate(product.updatedAt)}</span>
        </footer>

        {(onEdit || onDelete || actionSlot) && (
          <div className="product-card-actions">
            {actionSlot}
            {onEdit && (
              <button type="button" className="product-card-btn product-card-btn-edit" onClick={() => onEdit(product)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="product-card-btn product-card-btn-delete"
                onClick={() => onDelete(product)}
                disabled={Boolean(deleting)}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export default ProductCard
