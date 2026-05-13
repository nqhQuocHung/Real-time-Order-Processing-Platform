import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apis, endpoints, extractApiData, extractApiErrorMessage } from '../../../config/apis'
import ProductCard, { type ProductCardData } from '../../../components/products/ProductCard'
import './UserProductsPage.css'

type UserCartItem = {
  productId: string
  productName: string
  categoryId?: string
  quantity: number
}

const USER_CART_STORAGE_KEY = 'user-product-cart-v1'
const PRODUCT_PAGE_SIZE = 8

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function normalizeText(value?: string | null): string {
  return value?.trim().toLowerCase() || ''
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

function parseCartStorage(raw: string): Record<string, UserCartItem> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const result: Record<string, UserCartItem> = {}
    for (const [productId, value] of Object.entries(parsed as Record<string, UserCartItem>)) {
      if (!value || typeof value !== 'object') {
        continue
      }
      const quantity = Math.max(1, Math.floor(Number(value.quantity) || 1))
      const productName = String(value.productName || productId)
      const categoryId = value.categoryId ? String(value.categoryId) : undefined
      result[productId] = {
        productId,
        productName,
        categoryId,
        quantity,
      }
    }
    return result
  } catch {
    return {}
  }
}

function UserProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(0)
  const [cart, setCart] = useState<Record<string, UserCartItem>>({})

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    setCart(parseCartStorage(window.localStorage.getItem(USER_CART_STORAGE_KEY) || ''))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(USER_CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const activeProducts = useMemo(
    () => products.filter((item) => normalizeQuantity(item.totalQuantity) > 0),
    [products],
  )

  const categoryOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const item of activeProducts) {
      const categoryId = item.categoryId?.trim()
      if (categoryId) {
        ids.add(categoryId)
      }
    }
    return Array.from(ids.values()).sort((a, b) => a.localeCompare(b))
  }, [activeProducts])

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    return activeProducts.filter((item) => {
      const categoryId = item.categoryId?.trim() || ''
      const keywordMatched =
        !normalizedKeyword ||
        [
          item.name,
          item.productName,
          item.description,
          item.brand,
          item.sku,
          item.productId,
          item.itemId,
        ]
          .map((value) => normalizeText(value))
          .some((value) => value.includes(normalizedKeyword))

      const categoryMatched = !categoryFilter || categoryFilter === categoryId
      return keywordMatched && categoryMatched
    })
  }, [activeProducts, categoryFilter, keyword])

  useEffect(() => {
    setPage(0)
  }, [keyword, categoryFilter])

  const totalPages = useMemo(() => {
    if (!filteredProducts.length) {
      return 0
    }
    return Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE)
  }, [filteredProducts.length])

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
    const start = page * PRODUCT_PAGE_SIZE
    return filteredProducts.slice(start, start + PRODUCT_PAGE_SIZE)
  }, [filteredProducts, page])

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
    setCart((previous) => {
      if (previous[product.productId]) {
        return previous
      }
      const productName = product.name?.trim() || product.productName?.trim() || product.productId
      const categoryId = product.categoryId?.trim() || undefined
      return {
        ...previous,
        [product.productId]: {
          productId: product.productId,
          productName,
          categoryId,
          quantity: 1,
        },
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

  function handleQuantityChange(productId: string, value: number, max: number) {
    const safeValue = Math.max(1, Math.min(Math.floor(value || 1), Math.max(1, max)))
    setCart((previous) => {
      if (!previous[productId]) {
        return previous
      }
      return {
        ...previous,
        [productId]: {
          ...previous[productId],
          quantity: safeValue,
        },
      }
    })
  }

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
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => navigate('/user/orders')}
            disabled={cartProductCount === 0}
          >
            Go To Orders ({cartProductCount})
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => setCart({})}
            disabled={cartProductCount === 0}
          >
            Clear Cart
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}

        <p className="role-muted user-products-page-cart-summary">
          Cart selected: {cartProductCount} product(s) - total quantity {cartQuantity}. You can
          continue order flow in tab Orders.
        </p>

        <div className="role-inline-form user-products-page-filter">
          <label>
            Search product
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search by name, SKU, brand, ID..."
            />
          </label>
          <label>
            Filter by category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {categoryOptions.map((categoryId) => (
                <option key={categoryId} value={categoryId}>
                  {categoryId}
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
            const maxQuantity = Math.max(1, normalizeQuantity(item.availableQuantity))

            return (
              <ProductCard
                key={item.stockId || item.itemId || item.productId}
                product={item}
                actionSlot={
                  cartItem ? (
                    <div className="user-products-page-cart-actions">
                      <label>
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={maxQuantity}
                          value={cartItem.quantity}
                          onChange={(event) =>
                            handleQuantityChange(item.productId, Number(event.target.value), maxQuantity)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="product-card-btn user-products-page-btn-remove-cart"
                        onClick={() => handleRemoveFromCart(item.productId)}
                      >
                        Bo gio hang
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="product-card-btn user-products-page-btn-add-cart"
                      onClick={() => handleAddToCart(item)}
                    >
                      Them vao gio
                    </button>
                  )
                }
              />
            )
          })}

          {!filteredProducts.length && (
            <p className="role-empty-cell user-products-page-empty">
              Khong tim thay san pham phu hop bo loc.
            </p>
          )}
        </div>

        {totalPages > 0 && (
          <div className="user-products-page-pagination">
            <p className="user-products-page-pagination-summary">
              Showing {Math.min(page * PRODUCT_PAGE_SIZE + 1, filteredProducts.length)}-
              {Math.min((page + 1) * PRODUCT_PAGE_SIZE, filteredProducts.length)} of{' '}
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
    </section>
  )
}

export default UserProductsPage
