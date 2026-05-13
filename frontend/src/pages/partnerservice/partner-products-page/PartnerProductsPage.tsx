import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import ProductCard, { type ProductCardData } from '../../../components/products/ProductCard'
import './PartnerProductsPage.css'

type UpsertPartnerProductRequest = {
  name: string
  description?: string
  categoryId?: string
  shopName?: string
  brand?: string
  status?: string
  imageUrl?: string
  sku?: string
  availableQuantity: number
}

type ProductCategory = {
  categoryUid?: string
  categoryUuid?: string
  shopId?: string
  categoryId: string
  categoryName: string
  description?: string | null
}

type ProductImageUploadResponse = {
  imageUrl: string
  defaultImageUsed?: boolean
}

type PartnerRequestOverview = {
  shopName?: string | null
}

const DEFAULT_PRODUCT_IMAGE_URL =
  'https://img.freepik.com/vector-cao-cap/khong-co-bieu-tuong-vector-anh-co-san-bieu-tuong-hinh-anh-mac-dinh-hinh-anh-sap-co-cho-trang-web-hoac-ung-dung-di-dong_87543-18055.jpg'

const CATEGORY_PAGE_SIZE = 5
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

function PartnerProductsPage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [editingProductId, setEditingProductId] = useState('')
  const [editingProductImageUrl, setEditingProductImageUrl] = useState('')
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sku, setSku] = useState('')
  const [availableQuantity, setAvailableQuantity] = useState('0')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')

  const [categoryKeyword, setCategoryKeyword] = useState('')
  const [categoryPage, setCategoryPage] = useState(0)
  const [productKeyword, setProductKeyword] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('')
  const [productPage, setProductPage] = useState(0)
  const [partnerShopName, setPartnerShopName] = useState('')

  async function loadProducts() {
    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.myProducts)
      const data = extractApiData<ProductCardData[]>(response)
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load partner products.'))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    setLoadingCategories(true)
    setCategoryError('')
    try {
      const response = await apis().get(endpoints.inventories.categories)
      const data = extractApiData<ProductCategory[]>(response)
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      setCategoryError(extractApiErrorMessage(err, 'Cannot load product categories.'))
      setCategories([])
    } finally {
      setLoadingCategories(false)
    }
  }

  async function loadPartnerShopName() {
    try {
      const response = await apis().get(endpoints.auth.myPartnerRequest)
      const data = extractApiData<PartnerRequestOverview | null>(response)
      const resolvedShopName = data?.shopName?.trim() || ''
      setPartnerShopName(resolvedShopName)
    } catch {
      setPartnerShopName('')
    }
  }

  useEffect(() => {
    void loadProducts()
    void loadCategories()
    void loadPartnerShopName()
  }, [])

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreviewUrl('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(selectedImageFile)
    setSelectedImagePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedImageFile])

  const activeProducts = useMemo(
    () => products.filter((item) => normalizeQuantity(item.totalQuantity) >= 0),
    [products],
  )

  const filteredCategories = useMemo(() => {
    const keyword = normalizeText(categoryKeyword)
    if (!keyword) {
      return categories
    }

    return categories.filter((category) => {
      return [category.categoryName, category.description, category.categoryId]
        .map((value) => normalizeText(value))
        .some((value) => value.includes(keyword))
    })
  }, [categories, categoryKeyword])

  const totalCategoryPages = useMemo(() => {
    if (!filteredCategories.length) {
      return 0
    }
    return Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE)
  }, [filteredCategories.length])

  useEffect(() => {
    setCategoryPage(0)
  }, [categoryKeyword])

  useEffect(() => {
    if (totalCategoryPages > 0 && categoryPage >= totalCategoryPages) {
      setCategoryPage(totalCategoryPages - 1)
      return
    }
    if (totalCategoryPages === 0 && categoryPage !== 0) {
      setCategoryPage(0)
    }
  }, [categoryPage, totalCategoryPages])

  const categoryPaginationPages = useMemo(
    () => buildPaginationPages(categoryPage, totalCategoryPages),
    [categoryPage, totalCategoryPages],
  )

  const pagedCategories = useMemo(() => {
    if (!filteredCategories.length) {
      return []
    }
    const start = categoryPage * CATEGORY_PAGE_SIZE
    return filteredCategories.slice(start, start + CATEGORY_PAGE_SIZE)
  }, [categoryPage, filteredCategories])

  const filteredProducts = useMemo(() => {
    const keyword = normalizeText(productKeyword)
    return activeProducts.filter((item) => {
      const itemCategoryId = item.categoryId?.trim() || ''
      const keywordMatched =
        !keyword ||
        [
          item.name,
          item.productName,
          item.description,
          item.shopName,
          item.brand,
          item.sku,
          item.productId,
          item.itemId,
        ]
          .map((value) => normalizeText(value))
          .some((value) => value.includes(keyword))

      const categoryMatched = !productCategoryFilter || itemCategoryId === productCategoryFilter
      return keywordMatched && categoryMatched
    })
  }, [activeProducts, productCategoryFilter, productKeyword])

  const totalProductPages = useMemo(() => {
    if (!filteredProducts.length) {
      return 0
    }
    return Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE)
  }, [filteredProducts.length])

  useEffect(() => {
    setProductPage(0)
  }, [productKeyword, productCategoryFilter])

  useEffect(() => {
    if (totalProductPages > 0 && productPage >= totalProductPages) {
      setProductPage(totalProductPages - 1)
      return
    }
    if (totalProductPages === 0 && productPage !== 0) {
      setProductPage(0)
    }
  }, [productPage, totalProductPages])

  const productPaginationPages = useMemo(
    () => buildPaginationPages(productPage, totalProductPages),
    [productPage, totalProductPages],
  )

  const pagedProducts = useMemo(() => {
    if (!filteredProducts.length) {
      return []
    }
    const start = productPage * PRODUCT_PAGE_SIZE
    return filteredProducts.slice(start, start + PRODUCT_PAGE_SIZE)
  }, [filteredProducts, productPage])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      if (category.categoryId) {
        map.set(category.categoryId, category.categoryName || category.categoryId)
      }
    }
    return map
  }, [categories])

  const filterableCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of activeProducts) {
      const value = item.categoryId?.trim()
      if (value) {
        ids.add(value)
      }
    }
    return Array.from(ids.values()).sort((a, b) => {
      const first = categoryNameById.get(a) || a
      const second = categoryNameById.get(b) || b
      return first.localeCompare(second)
    })
  }, [activeProducts, categoryNameById])

  function resetProductForm() {
    setName('')
    setDescription('')
    setCategoryId('')
    setBrand('')
    setStatus('ACTIVE')
    setSku('')
    setAvailableQuantity('0')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setEditingProductId('')
    setEditingProductImageUrl('')
  }

  async function uploadProductImage(image: File): Promise<string> {
    const formData = new FormData()
    formData.append('image', image)

    setUploadingImage(true)
    try {
      const response = await apis().post(endpoints.inventories.uploadProductImage, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const data = extractApiData<ProductImageUploadResponse>(response)
      return data?.imageUrl?.trim() || DEFAULT_PRODUCT_IMAGE_URL
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Cannot upload product image.'))
    } finally {
      setUploadingImage(false)
    }
  }

  function handleEditProduct(product: ProductCardData) {
    setCreateError('')
    setCreateSuccess('')
    setEditingProductId(product.productId)
    setEditingProductImageUrl(product.imageUrl?.trim() || '')
    setName(product.name?.trim() || product.productName?.trim() || '')
    setDescription(product.description?.trim() || '')
    setCategoryId(product.categoryId?.trim() || '')
    setBrand(product.brand?.trim() || '')
    setStatus(product.status?.trim() || 'ACTIVE')
    setSku(product.sku?.trim() || '')
    setAvailableQuantity(String(normalizeQuantity(product.availableQuantity)))
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeleteProduct(product: ProductCardData) {
    const displayName = product.name?.trim() || product.productName?.trim() || product.productId
    const shouldDelete = window.confirm(`Delete product "${displayName}"?`)
    if (!shouldDelete) {
      return
    }

    setCreateError('')
    setCreateSuccess('')
    setDeletingProductId(product.productId)
    try {
      await apis().delete(endpoints.inventories.deleteProduct(product.productId))
      setCreateSuccess('Product deleted successfully.')
      if (editingProductId === product.productId) {
        resetProductForm()
      }
      await loadProducts()
    } catch (err) {
      setCreateError(extractApiErrorMessage(err, 'Cannot delete partner product.'))
    } finally {
      setDeletingProductId('')
    }
  }

  async function handleSaveProduct() {
    setCreateError('')
    setCreateSuccess('')

    if (!name.trim()) {
      setCreateError('Please enter product name.')
      return
    }

    const parsedAvailableQuantity = Number(availableQuantity)
    if (!Number.isFinite(parsedAvailableQuantity) || parsedAvailableQuantity < 0) {
      setCreateError('Initial available quantity must be 0 or greater.')
      return
    }

    let resolvedImageUrl: string | undefined
    if (selectedImageFile) {
      try {
        resolvedImageUrl = await uploadProductImage(selectedImageFile)
      } catch (uploadError) {
        setCreateError(
          uploadError instanceof Error ? uploadError.message : 'Cannot upload product image.',
        )
        return
      }
    } else if (editingProductId) {
      resolvedImageUrl = editingProductImageUrl || DEFAULT_PRODUCT_IMAGE_URL
    } else {
      resolvedImageUrl = DEFAULT_PRODUCT_IMAGE_URL
    }

    const payload: UpsertPartnerProductRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      shopName: partnerShopName.trim() || undefined,
      brand: brand.trim() || undefined,
      status: status.trim() || undefined,
      imageUrl: resolvedImageUrl,
      sku: sku.trim() || undefined,
      availableQuantity: parsedAvailableQuantity,
    }

    setSubmitting(true)
    try {
      if (editingProductId) {
        await apis().put(endpoints.inventories.updateProduct(editingProductId), payload)
      } else {
        await apis().post(endpoints.inventories.createProduct, payload)
      }

      setCreateSuccess(
        editingProductId ? 'Product updated successfully.' : 'Product created successfully.',
      )
      resetProductForm()
      await loadProducts()
    } catch (err) {
      setCreateError(
        extractApiErrorMessage(
          err,
          editingProductId ? 'Cannot update partner product.' : 'Cannot create partner product.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="partner-products-page role-page-stack">
      <article className="role-card">
        <h2>My Products</h2>
        <p className="role-muted">
          Partner can create and manage products in their own shop scope.
        </p>

        <div className="partner-products-page-category-box">
          <h3>Category Catalog</h3>
          <p className="role-muted">
            Product categories are managed by system admins. Partner accounts can view categories
            and assign them to products.
          </p>
          <div className="role-inline-actions">
            <button type="button" className="role-btn-ghost" onClick={() => void loadCategories()}>
              {loadingCategories ? 'Loading Categories...' : 'Refresh Categories'}
            </button>
          </div>
          {categoryError && <p className="role-error">{categoryError}</p>}

          <div className="partner-products-page-filter role-inline-form">
            <label className="partner-products-page-full-width">
              Search category
              <input
                value={categoryKeyword}
                onChange={(event) => setCategoryKeyword(event.target.value)}
                placeholder="Search by name, description, or ID"
              />
            </label>
          </div>

          <div className="partner-products-page-category-list">
            {pagedCategories.map((category) => (
              <div key={category.categoryId} className="partner-products-page-category-row">
                <div>
                  <strong>{category.categoryName}</strong>
                  <p>{category.description || '-'}</p>
                  <span>{category.categoryId}</span>
                </div>
              </div>
            ))}
            {!filteredCategories.length && (
              <p className="role-empty-cell partner-products-page-empty">
                No category matched the current filter.
              </p>
            )}
          </div>

          {totalCategoryPages > 0 && (
            <div className="partner-products-page-pagination">
              <p className="partner-products-page-pagination-summary">
                Showing {Math.min(categoryPage * CATEGORY_PAGE_SIZE + 1, filteredCategories.length)}-
                {Math.min((categoryPage + 1) * CATEGORY_PAGE_SIZE, filteredCategories.length)} of{' '}
                {filteredCategories.length} categories
              </p>
              <div className="partner-products-page-pagination-controls">
                <button
                  type="button"
                  className="role-btn-ghost partner-products-page-btn-page"
                  onClick={() => setCategoryPage((prev) => Math.max(0, prev - 1))}
                  disabled={categoryPage <= 0}
                >
                  Prev
                </button>
                {categoryPaginationPages.map((pageNumber) => (
                  <button
                    key={`category-page-${pageNumber}`}
                    type="button"
                    className={`role-btn-ghost partner-products-page-btn-page ${pageNumber === categoryPage ? 'is-active' : ''}`}
                    onClick={() => setCategoryPage(pageNumber)}
                  >
                    {pageNumber + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="role-btn-ghost partner-products-page-btn-page"
                  onClick={() =>
                    setCategoryPage((prev) => Math.min(totalCategoryPages - 1, prev + 1))
                  }
                  disabled={categoryPage >= totalCategoryPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <h3>{editingProductId ? 'Edit Product' : 'Create Product'}</h3>
        <div className="partner-products-page-form role-inline-form">
          <label>
            Product Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product name"
            />
          </label>
          <label>
            Category
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.categoryUid || category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shop Name
            <input
              value={partnerShopName || 'No shop name from partner request yet'}
              readOnly
            />
          </label>
          <label>
            Brand
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Brand"
            />
          </label>
          <label>
            SKU
            <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU" />
          </label>
          <label>
            Product Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </label>
          <label>
            Initial Available Quantity
            <input
              type="number"
              min={0}
              value={availableQuantity}
              onChange={(event) => setAvailableQuantity(event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="partner-products-page-full-width">
            Product Image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null
                setSelectedImageFile(file)
              }}
            />
            <small className="partner-products-page-help">
              If you do not upload an image, system will attach a default image silently.
            </small>
            {(selectedImagePreviewUrl || editingProductImageUrl) && (
              <div className="partner-products-page-image-preview">
                <img
                  src={selectedImagePreviewUrl || editingProductImageUrl}
                  alt="Product preview"
                />
              </div>
            )}
          </label>
          <label className="partner-products-page-full-width">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Product description"
              rows={3}
            />
          </label>
        </div>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void handleSaveProduct()}>
            {submitting || uploadingImage
              ? editingProductId
                ? 'Updating...'
                : 'Creating...'
              : editingProductId
                ? 'Update Product'
                : 'Create Product'}
          </button>
          {editingProductId && (
            <button type="button" className="role-btn-ghost" onClick={resetProductForm}>
              Cancel Edit
            </button>
          )}
          <button type="button" className="role-btn-ghost" onClick={() => void loadProducts()}>
            {loading ? 'Loading...' : 'Refresh My Products'}
          </button>
        </div>

        {createError && <p className="role-error">{createError}</p>}
        {createSuccess && <p className="role-muted">{createSuccess}</p>}
        {error && <p className="role-error">{error}</p>}
      </article>

      <article className="role-card">
        <div className="partner-products-page-filter role-inline-form">
          <label>
            Search product
            <input
              value={productKeyword}
              onChange={(event) => setProductKeyword(event.target.value)}
              placeholder="Search by name, SKU, brand, ID..."
            />
          </label>
          <label>
            Filter by category
            <select
              value={productCategoryFilter}
              onChange={(event) => setProductCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {filterableCategoryIds.map((categoryValue) => (
                <option key={categoryValue} value={categoryValue}>
                  {categoryNameById.get(categoryValue) || categoryValue}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="partner-products-page-grid">
          {pagedProducts.map((item) => (
            <ProductCard
              key={item.stockId || item.itemId || item.productId}
              product={item}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              deleting={deletingProductId === item.productId}
            />
          ))}
          {!filteredProducts.length && (
            <p className="role-empty-cell partner-products-page-empty">
              No products matched the current filter.
            </p>
          )}
        </div>

        {totalProductPages > 0 && (
          <div className="partner-products-page-pagination">
            <p className="partner-products-page-pagination-summary">
              Showing {Math.min(productPage * PRODUCT_PAGE_SIZE + 1, filteredProducts.length)}-
              {Math.min((productPage + 1) * PRODUCT_PAGE_SIZE, filteredProducts.length)} of{' '}
              {filteredProducts.length} products
            </p>
            <div className="partner-products-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost partner-products-page-btn-page"
                onClick={() => setProductPage((prev) => Math.max(0, prev - 1))}
                disabled={productPage <= 0}
              >
                Prev
              </button>
              {productPaginationPages.map((pageNumber) => (
                <button
                  key={`product-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost partner-products-page-btn-page ${pageNumber === productPage ? 'is-active' : ''}`}
                  onClick={() => setProductPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost partner-products-page-btn-page"
                onClick={() => setProductPage((prev) => Math.min(totalProductPages - 1, prev + 1))}
                disabled={productPage >= totalProductPages - 1}
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

export default PartnerProductsPage
