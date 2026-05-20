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

export type ProductCardRatingSummary = {
  averageRating: number
  totalReviews: number
}

type ProductCardProps = {
  product: ProductCardData
  onEdit?: (product: ProductCardData) => void
  onDelete?: (product: ProductCardData) => void
  onViewDetail?: (product: ProductCardData) => void
  deleting?: boolean
  actionSlot?: ReactNode
  ratingSummary?: ProductCardRatingSummary | null
  onOpenChat?: (shopId: string | undefined, shopName: string | undefined) => void
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function normalizeRating(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) {
    return 0
  }
  return Math.max(0, Math.min(5, Number(value)))
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onViewDetail,
  deleting,
  actionSlot,
  ratingSummary,
  onOpenChat,
}: ProductCardProps) {
  const displayName = product.name?.trim() || product.productName?.trim() || 'Unnamed Product'
  const displayStatus = product.status?.trim() || (product.isActive ? 'ACTIVE' : 'INACTIVE')
  const imageUrl = product.imageUrl?.trim() || ''
  const displayShopName = product.shopName?.trim() || product.shopId || '-'
  const displayCategoryName = product.categoryName?.trim() || product.categoryId?.trim() || '-'
  const statusClass = displayStatus.toLowerCase()
  const isViewable = typeof onViewDetail === 'function'
  const ratingValue = normalizeRating(ratingSummary?.averageRating)
  const totalReviews = Math.max(0, Number(ratingSummary?.totalReviews) || 0)


  function handleOpenDetail() {
    onViewDetail?.(product)
  }

  function handleOpenChatClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (onOpenChat) {
      onOpenChat(product.shopId, product.shopName)
    }
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
        {onOpenChat && (
          <button
            type="button"
            className="product-card-image-message"
            onClick={handleOpenChatClick}
            aria-label={`Message shop ${displayShopName}`}
            title="Message shop"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-3.8 3.2A.7.7 0 0 1 4 18.7V16A2.5 2.5 0 0 1 1.5 13.5v-7A2.5 2.5 0 0 1 4 4zm2.5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2.8c.2 0 .4.1.5.2l2.2 1.9V15a.8.8 0 0 1 .8-.8h4.7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-11z" />
            </svg>
          </button>
        )}
        <span className="product-card-image-sku">{product.sku?.trim() || 'No SKU'}</span>
      </div>

      <div className="product-card-body">
        <header className="product-card-header">
          <div className="product-card-header-row">
            <span className={`product-card-status ${statusClass}`}>{displayStatus}</span>
            <span className="product-card-rating-pill">
              <span className="product-card-rating-pill-stars" aria-label={`${ratingValue.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <span
                    key={`product-card-star-${product.productId}-${starValue}`}
                    className={ratingValue >= starValue ? 'is-active' : ''}
                    aria-hidden="true"
                  >
                    &#9733;
                  </span>
                ))}
              </span>
              <span className="product-card-rating-pill-text">
                {totalReviews > 0 ? `${ratingValue.toFixed(1)} (${totalReviews})` : 'No review'}
              </span>
            </span>
          </div>
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
