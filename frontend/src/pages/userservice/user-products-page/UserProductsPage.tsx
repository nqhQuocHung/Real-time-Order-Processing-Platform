import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apis, endpoints, extractApiData, extractApiErrorMessage } from '../../../config/apis'
import ProductCard, { type ProductCardData } from '../../../components/products/ProductCard'
import {
  readUserCartFromStorage,
  type UserCartItem,
  type UserCartMap,
  writeUserCartToStorage,
} from '../../../features/cart/userCartStorage'
import './UserProductsPage.css'

const DEFAULT_PRODUCT_PAGE_SIZE = 8
const PRODUCT_PAGE_SIZE_OPTIONS = [8, 12, 16, 24]

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Math.max(0, Math.floor(Number(value))) : 0
}

function normalizePrice(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) {
    return 0
  }
  const normalized = Number(value)
  return normalized > 0 ? Number(normalized.toFixed(2)) : 0
}

function normalizeText(value?: string | null): string {
  return value?.trim().toLowerCase() || ''
}

function formatProductPrice(value?: number | null, currency?: string | null): string {
  if (Number.isFinite(value as number) && Number(value) > 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'VND').trim() || 'VND',
      maximumFractionDigits: 2,
    }).format(Number(value))
  }

  return 'N/A'
}

function buildPaginationPages(currentPage: number, totalPages: number, maxButtons = 5): number[] {
  if (totalPages <= 0) {
    return []
  }

  const half = Math.floor(maxButtons / 2)
  let start = Math.max(0, currentPage - half)
  let end = Math.min(totalPages - 1, start + maxButtons - 1)

  if (end - start + 1 < maxButtons) {
    start = Math.max(0, end - maxButtons + 1)
  }

  const pages: number[] = []
  for (let i = start; i <= end; i += 1) {
    pages.push(i)
  }

  return pages
}

function buildCartItem(product: ProductCardData, quantity: number): UserCartItem {
  const availableQuantity = normalizeQuantity(product.availableQuantity)
  const normalizedQuantity = Math.min(Math.max(1, quantity), Math.max(1, availableQuantity))

  return {
    productId: product.productId,
    productName: product.name?.trim() || product.productName?.trim() || product.productId,
    quantity: normalizedQuantity,
    unitPrice: normalizePrice(product.price),
    currency: product.currency?.trim() || 'VND',
    maxAvailable: availableQuantity,
    categoryId: product.categoryId?.trim() || undefined,
    categoryName: product.categoryName?.trim() || undefined,
    shopName: product.shopName?.trim() || product.shopId || undefined,
    imageUrl: product.imageUrl?.trim() || undefined,
  }
}

function reconcileCartWithCatalog(cart: UserCartMap, catalog: ProductCardData[]): UserCartMap {
  if (!Object.keys(cart).length) {
    return cart
  }

  const catalogMap = new Map<string, ProductCardData>()
  for (const item of catalog) {
    catalogMap.set(item.productId, item)
  }

  let changed = false
  const nextCart: UserCartMap = {}
  for (const [productId, cartItem] of Object.entries(cart)) {
    const catalogItem = catalogMap.get(productId)
    if (!catalogItem) {
      nextCart[productId] = {
        ...cartItem,
        maxAvailable: 0,
      }
      if (cartItem.maxAvailable !== 0) {
        changed = true
      }
      continue
    }

    const availableQuantity = normalizeQuantity(catalogItem.availableQuantity)
    const nextQuantity =
      availableQuantity > 0 ? Math.min(cartItem.quantity, availableQuantity) : cartItem.quantity
    const nextItem: UserCartItem = {
      ...cartItem,
      productName:
        catalogItem.name?.trim() || catalogItem.productName?.trim() || cartItem.productName || productId,
      quantity: Math.max(1, nextQuantity),
      unitPrice: normalizePrice(catalogItem.price) || cartItem.unitPrice,
      currency: catalogItem.currency?.trim() || cartItem.currency || 'VND',
      maxAvailable: availableQuantity,
      categoryId: catalogItem.categoryId?.trim() || cartItem.categoryId,
      categoryName: catalogItem.categoryName?.trim() || cartItem.categoryName,
      shopName: catalogItem.shopName?.trim() || catalogItem.shopId || cartItem.shopName,
      imageUrl: catalogItem.imageUrl?.trim() || cartItem.imageUrl,
    }
    nextCart[productId] = nextItem

    if (
      nextItem.quantity !== cartItem.quantity ||
      nextItem.maxAvailable !== cartItem.maxAvailable ||
      nextItem.unitPrice !== cartItem.unitPrice ||
      nextItem.productName !== cartItem.productName ||
      nextItem.currency !== cartItem.currency ||
      nextItem.shopName !== cartItem.shopName ||
      nextItem.categoryName !== cartItem.categoryName
    ) {
      changed = true
    }
  }

  if (!changed && Object.keys(nextCart).length === Object.keys(cart).length) {
    return cart
  }
  return nextCart
}

function UserProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [shopKeyword, setShopKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PRODUCT_PAGE_SIZE)
  const [cart, setCart] = useState<UserCartMap>(() => readUserCartFromStorage())
  const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.catalog)
      const data = extractApiData<ProductCardData[]>(response)
      const normalizedProducts = Array.isArray(data) ? data : []
      setProducts(normalizedProducts)
      setCart((previous) => reconcileCartWithCatalog(previous, normalizedProducts))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load product catalog.'))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    writeUserCartToStorage(cart)
  }, [cart])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCatalog()
    }, 15000)
    return () => window.clearInterval(intervalId)
  }, [loadCatalog])

  const activeProducts = useMemo(
    () => products.filter((item) => normalizeQuantity(item.availableQuantity) > 0),
    [products],
  )

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, string>()
    for (const item of activeProducts) {
      const categoryId = item.categoryId?.trim()
      if (!categoryId) {
        continue
      }
      const categoryName = item.categoryName?.trim() || categoryId
      categoryMap.set(categoryId, categoryName)
    }

    return Array.from(categoryMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) => first.name.localeCompare(second.name))
  }, [activeProducts])

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    const normalizedShopKeyword = normalizeText(shopKeyword)
    return activeProducts.filter((item) => {
      const categoryId = item.categoryId?.trim() || ''
      const shopName = item.shopName?.trim() || item.shopId || ''
      const keywordMatched =
        !normalizedKeyword ||
        [
          item.name,
          item.productName,
          item.description,
          item.categoryName,
          item.brand,
          item.sku,
          item.productId,
          item.itemId,
          shopName,
        ]
          .map((value) => normalizeText(value))
          .some((value) => value.includes(normalizedKeyword))

      const categoryMatched = !categoryFilter || categoryFilter === categoryId
      const shopMatched = !normalizedShopKeyword || normalizeText(shopName).includes(normalizedShopKeyword)
      return keywordMatched && categoryMatched && shopMatched
    })
  }, [activeProducts, categoryFilter, keyword, shopKeyword])

  useEffect(() => {
    setPage(0)
  }, [keyword, categoryFilter, pageSize, shopKeyword])

  const totalPages = useMemo(() => {
    if (!filteredProducts.length) {
      return 0
    }
    return Math.ceil(filteredProducts.length / pageSize)
  }, [filteredProducts.length, pageSize])

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1)
      return
    }
    if (totalPages === 0 && page !== 0) {
      setPage(0)
    }
  }, [page, totalPages])

  const paginationPages = useMemo(() => buildPaginationPages(page, totalPages), [page, totalPages])

  const pagedProducts = useMemo(() => {
    if (!filteredProducts.length) {
      return []
    }
    const start = page * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page, pageSize])

  const cartItems = useMemo(() => {
    return Object.values(cart).sort((firstItem, secondItem) =>
      firstItem.productName.localeCompare(secondItem.productName),
    )
  }, [cart])

  const cartProductCount = cartItems.length
  const cartQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + normalizeQuantity(item.quantity), 0),
    [cartItems],
  )

  function handleAddToCart(product: ProductCardData) {
    const availableQuantity = normalizeQuantity(product.availableQuantity)
    if (availableQuantity <= 0) {
      return
    }

    setCart((previous) => ({
      ...previous,
      [product.productId]: buildCartItem(product, 1),
    }))
  }

  function handleChangeCartQuantity(product: ProductCardData, delta: number) {
    const availableQuantity = normalizeQuantity(product.availableQuantity)
    if (availableQuantity <= 0) {
      return
    }

    setCart((previous) => {
      const existing = previous[product.productId]
      if (!existing) {
        return previous
      }

      const nextQuantity = Math.max(1, Math.min(existing.quantity + delta, availableQuantity))
      if (nextQuantity === existing.quantity) {
        return previous
      }

      return {
        ...previous,
        [product.productId]: buildCartItem(product, nextQuantity),
      }
    })
  }

  function handleRemoveFromCart(productId: string) {
    setCart((previous) => {
      if (!previous[productId]) {
        return previous
      }
      const { [productId]: _removed, ...rest } = previous
      return rest
    })
  }

  function closeProductDetail() {
    setSelectedProduct(null)
  }

  const detailProductName =
    selectedProduct?.name?.trim() || selectedProduct?.productName?.trim() || 'Unnamed Product'
  const detailShopName = selectedProduct?.shopName?.trim() || selectedProduct?.shopId || '-'

  return (
    <section className="user-products-page role-page-stack">
      <article className="role-card user-products-page-catalog-card">
        <div className="user-products-page-catalog-header">
          <div>
            <h2>Product Catalog</h2>
            <p className="role-muted">
              Browse all products currently sold by partners. Quantities are refreshed periodically.
            </p>
          </div>
          <div className="user-products-page-catalog-metrics" aria-label="Catalog summary">
            <span>{filteredProducts.length} products</span>
            <span>{categoryOptions.length} categories</span>
          </div>
        </div>

        {error && <p className="role-error">{error}</p>}

        <div className="role-inline-actions user-products-page-catalog-actions">
          <button type="button" className="role-btn-primary" onClick={() => void loadCatalog()}>
            {loading ? 'Loading...' : 'Refresh Catalog'}
          </button>
          <label className="user-products-page-page-size">
            <span>Items / page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PRODUCT_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="role-muted user-products-page-cart-summary">
          Cart selected: {cartProductCount} product(s), total quantity {cartQuantity}. Continue the
          checkout flow from the floating cart button.
        </p>

        <div className="role-inline-form user-products-page-filter">
          <label>
            Search Product
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Name, SKU, brand, ID..."
            />
          </label>
          <label>
            Search Shop
            <input
              value={shopKeyword}
              onChange={(event) => setShopKeyword(event.target.value)}
              placeholder="Shop name"
            />
          </label>
          <label>
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <article className="role-card">
        <div className="user-products-page-grid">
          {pagedProducts.map((item) => {
            const cartItem = cart[item.productId]
            const availableQuantity = normalizeQuantity(item.availableQuantity)
            const inCart = Boolean(cartItem)
            const displayPrice = formatProductPrice(item.price, item.currency || 'VND')
            return (
              <ProductCard
                key={item.stockId || item.itemId || item.productId}
                product={item}
                onViewDetail={setSelectedProduct}
                actionSlot={
                  inCart ? (
                    <div className="user-products-page-cart-controls">
                      <div className="user-products-page-cart-stepper">
                        <button
                          type="button"
                          className="product-card-btn"
                          onClick={() => handleChangeCartQuantity(item, -1)}
                          disabled={cartItem.quantity <= 1}
                        >
                          -
                        </button>
                        <span>{cartItem.quantity}</span>
                        <button
                          type="button"
                          className="product-card-btn"
                          onClick={() => handleChangeCartQuantity(item, 1)}
                          disabled={cartItem.quantity >= availableQuantity}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="product-card-btn user-products-page-cart-toggle is-in-cart"
                        onClick={() => handleRemoveFromCart(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="product-card-btn user-products-page-cart-toggle is-add"
                      onClick={() => handleAddToCart(item)}
                    >
                      <span className="user-products-page-cart-label">
                        <span className="user-products-page-cart-price">{displayPrice}</span>
                        <span className="user-products-page-cart-plus" aria-hidden="true">+</span>
                      </span>
                    </button>
                  )
                }
              />
            )
          })}

          {!filteredProducts.length && (
            <p className="role-empty-cell user-products-page-empty">
              No products matched the current filters.
            </p>
          )}
        </div>

        {totalPages > 0 && (
          <div className="user-products-page-pagination">
            <p className="user-products-page-pagination-summary">
              Showing {Math.min(page * pageSize + 1, filteredProducts.length)}-
              {Math.min((page + 1) * pageSize, filteredProducts.length)} of{' '}
              {filteredProducts.length}
            </p>
            <div className="user-products-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost user-products-page-btn-page"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page <= 0}
              >
                Prev
              </button>
              {paginationPages.map((pageNumber) => (
                <button
                  key={`user-product-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost user-products-page-btn-page ${pageNumber === page ? 'is-active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost user-products-page-btn-page"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>

      <button
        type="button"
        className="user-products-page-floating-cart"
        onClick={() => navigate('/user/orders')}
        aria-label={`Open Orders with ${cartQuantity} item(s) in cart`}
      >
        <span className="user-products-page-floating-cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M7 4h-2.4a1 1 0 1 0 0 2h1.66l1.58 8.34a2 2 0 0 0 1.96 1.66h7.6a2 2 0 0 0 1.94-1.51l1.22-4.86a1 1 0 0 0-.97-1.25H8.54L8.16 6H7zm3.1 13a1.9 1.9 0 1 0 .01 3.8 1.9 1.9 0 0 0-.01-3.8zm7.2 0a1.9 1.9 0 1 0 .01 3.8 1.9 1.9 0 0 0-.01-3.8z" />
          </svg>
        </span>
        <span className="user-products-page-floating-cart-label">Order Cart</span>
        <span className="user-products-page-floating-cart-badge">{cartQuantity}</span>
      </button>

      {selectedProduct && (
        <div className="user-products-page-modal-backdrop" onClick={closeProductDetail}>
          <div
            className="user-products-page-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>{detailProductName}</h3>
              <button type="button" className="role-btn-ghost" onClick={closeProductDetail}>
                Close
              </button>
            </header>
            <div className="user-products-page-modal-content">
              <div className="user-products-page-modal-image-wrap">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={detailProductName} />
                ) : (
                  <span>No image</span>
                )}
              </div>
              <dl className="user-products-page-modal-fields">
                <div>
                  <dt>Price</dt>
                  <dd>{formatProductPrice(selectedProduct.price, selectedProduct.currency || 'VND')}</dd>
                </div>
                <div>
                  <dt>Shop Name</dt>
                  <dd>{detailShopName}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedProduct.categoryName?.trim() || selectedProduct.categoryId?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>{selectedProduct.brand?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd>{selectedProduct.sku?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>Product ID</dt>
                  <dd>{selectedProduct.productId}</dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>{normalizeQuantity(selectedProduct.availableQuantity)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{normalizeQuantity(selectedProduct.soldQuantity)}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{normalizeQuantity(selectedProduct.totalQuantity)}</dd>
                </div>
              </dl>
            </div>
            <p className="user-products-page-modal-description">
              {selectedProduct.description?.trim() || 'No description available.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default UserProductsPage
