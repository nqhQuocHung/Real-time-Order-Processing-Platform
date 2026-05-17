import type { ReactNode } from 'react'
import './ProductCard.css'

export type ProductCardData = {
  stockId?: string
  stockUuid?: string
  productId: string
  itemId?: string
  shopId?: string
  shopName?: string
  name?: string | null
  productName?: string | null
  description?: string | null
  categoryId?: string | null
  categoryName?: string | null
  brand?: string | null
  status?: string | null
  imageUrl?: string | null
  sku?: string | null
  price?: number | null
  currency?: string | null
  availableQuantity?: number | null
  reservedQuantity?: number | null
  soldQuantity?: number | null
  totalQuantity?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  isActive?: boolean | null
}

type ProductCardProps = {
  product: ProductCardData
  onEdit?: (product: ProductCardData) => void
  onDelete?: (product: ProductCardData) => void
  onViewDetail?: (product: ProductCardData) => void
  deleting?: boolean
  actionSlot?: ReactNode
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onViewDetail,
  deleting,
  actionSlot,
}: ProductCardProps) {
  const displayName = product.name?.trim() || product.productName?.trim() || 'Unnamed Product'
  const displayStatus = product.status?.trim() || (product.isActive ? 'ACTIVE' : 'INACTIVE')
  const imageUrl = product.imageUrl?.trim() || ''
  const displayShopName = product.shopName?.trim() || product.shopId || '-'
  const displayCategoryName = product.categoryName?.trim() || product.categoryId?.trim() || '-'
  const statusClass = displayStatus.toLowerCase()
  const isViewable = typeof onViewDetail === 'function'

  function handleOpenDetail() {
    onViewDetail?.(product)
  }

  return (
    <article
      className={`product-card ${isViewable ? 'is-clickable' : ''}`}
      onClick={isViewable ? handleOpenDetail : undefined}
      onKeyDown={
        isViewable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleOpenDetail()
              }
            }
          : undefined
      }
      tabIndex={isViewable ? 0 : undefined}
      role={isViewable ? 'button' : undefined}
      aria-label={isViewable ? `View details for ${displayName}` : undefined}
    >
      <div className="product-card-image-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="product-card-image" loading="lazy" />
        ) : (
          <div className="product-card-image-placeholder">No image</div>
        )}
        <span className="product-card-image-sku">{product.sku?.trim() || 'No SKU'}</span>
      </div>

      <div className="product-card-body">
        <header className="product-card-header">
          <span className={`product-card-status ${statusClass}`}>{displayStatus}</span>
          <h3>{displayName}</h3>
        </header>

        <p className="product-card-description">
          {product.description?.trim() || 'No description.'}
        </p>

        <dl className="product-card-meta">
          <div>
            <dt>Item Name</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>Shop Name</dt>
            <dd>{displayShopName}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{displayCategoryName}</dd>
          </div>
          <div>
            <dt>Brand</dt>
            <dd>{product.brand?.trim() || '-'}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{product.sku?.trim() || '-'}</dd>
          </div>
        </dl>

        <div className="product-card-quantities">
          <div>
            <small>Available</small>
            <strong>{normalizeQuantity(product.availableQuantity)}</strong>
          </div>
          {/* <div>
            <small>Reserved</small>
            <strong>{normalizeQuantity(product.reservedQuantity)}</strong>
          </div> */}
          <div>
            <small>Paid</small>
            <strong>{normalizeQuantity(product.soldQuantity)}</strong>
          </div>
          <div>
            <small>Total</small>
            <strong>{normalizeQuantity(product.totalQuantity)}</strong>
          </div>
        </div>

        {(onEdit || onDelete || actionSlot) && (
          <div
            className="product-card-actions"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {actionSlot}
            {onEdit && (
              <button
                type="button"
                className="product-card-btn product-card-btn-edit"
                onClick={() => onEdit(product)}
              >
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
