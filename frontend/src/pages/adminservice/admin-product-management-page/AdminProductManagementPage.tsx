import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import ProductCard, { type ProductCardData } from '../../../components/products/ProductCard'
import './AdminProductManagementPage.css'

type UpsertAdminProductRequest = {
  shopId?: string
  shopName?: string
  name: string
  description?: string
  categoryId?: string
  brand?: string
  status?: string
  imageUrl?: string
  sku?: string
  price: number
  availableQuantity: number
}

type ProductCategory = {
  categoryUid?: string
  categoryUuid?: string
  categoryId: string
  categoryName: string
  description?: string | null
}

type ProductImageUploadResponse = {
  imageUrl: string
}

type AdminPartnerSummary = {
  userId: string
  username: string
  isActive?: boolean
}

type AdminPartnerListResponse = {
  content: AdminPartnerSummary[]
}

const PRODUCT_PAGE_SIZE = 8
const DEFAULT_PRODUCT_IMAGE_URL =
  'https://img.freepik.com/vector-cao-cap/khong-co-bieu-tuong-vector-anh-co-san-bieu-tuong-hinh-anh-mac-dinh-hinh-anh-sap-co-cho-trang-web-hoac-ung-dung-di-dong_87543-18055.jpg'

function normalizeText(value?: string | null): string {
  return value?.trim().toLowerCase() || ''
}

function normalizeStatus(value?: string | null): string {
  return value?.trim().toUpperCase() || ''
}

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Math.max(0, Number(value)) : 0
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

function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (!Number.isFinite(value as number)) {
    return '-'
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: (currency || 'VND').trim() || 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function resolveProductDisplayName(product: ProductCardData): string {
  return product.name?.trim() || product.productName?.trim() || product.productId
}

function AdminProductManagementPage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [partners, setPartners] = useState<AdminPartnerSummary[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [shopFilter, setShopFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState('')
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [availableQuantity, setAvailableQuantity] = useState('0')
  const [existingImageUrl, setExistingImageUrl] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')

  async function loadProducts() {
    setLoadingProducts(true)
    setError('')
    try {
      const apiClient = apis()
      try {
        const response = await apiClient.get(endpoints.inventories.adminProducts, {
          params: {
            includeInactive: true,
          },
        })
        const data = extractApiData<ProductCardData[]>(response)
        setProducts(Array.isArray(data) ? data : [])
      } catch (adminEndpointErr) {
        const statusCode = (adminEndpointErr as { response?: { status?: number } })?.response?.status
        if (statusCode !== 404) {
          throw adminEndpointErr
        }

        const fallbackResponse = await apiClient.get(endpoints.inventories.catalog)
        const fallbackData = extractApiData<ProductCardData[]>(fallbackResponse)
        setProducts(Array.isArray(fallbackData) ? fallbackData : [])
      }
    } catch (err) {
      setProducts([])
      setError(extractApiErrorMessage(err, 'Cannot load products.'))
    } finally {
      setLoadingProducts(false)
    }
  }

  async function loadCategories() {
    setLoadingCategories(true)
    setError('')
    try {
      const response = await apis().get(endpoints.inventories.categories)
      const data = extractApiData<ProductCategory[]>(response)
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      setCategories([])
      setError(extractApiErrorMessage(err, 'Cannot load categories.'))
    } finally {
      setLoadingCategories(false)
    }
  }

  async function loadPartners() {
    setLoadingPartners(true)
    setError('')
    try {
      const response = await apis().get(endpoints.auth.users, {
        params: {
          roleCode: 'SHOPEE_PARTNER',
          isActive: true,
          page: 0,
          size: 500,
        },
      })
      const data = extractApiData<AdminPartnerListResponse>(response)
      setPartners(Array.isArray(data.content) ? data.content : [])
    } catch (err) {
      setPartners([])
      setError(extractApiErrorMessage(err, 'Cannot load partner list.'))
    } finally {
      setLoadingPartners(false)
    }
  }

  async function refreshAll() {
    setSuccess('')
    await Promise.all([loadProducts(), loadCategories(), loadPartners()])
  }

  useEffect(() => {
    void refreshAll()
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

  const partnerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const partner of partners) {
      const partnerId = partner.userId?.trim()
      if (!partnerId) {
        continue
      }
      map.set(partnerId, partner.username?.trim() || partnerId)
    }
    return map
  }, [partners])

  const partnerOptions = useMemo(() => {
    const optionMap = new Map<string, string>()

    for (const partner of partners) {
      const partnerId = partner.userId?.trim()
      if (!partnerId) {
        continue
      }
      optionMap.set(partnerId, partner.username?.trim() || partnerId)
    }

    for (const product of products) {
      const productShopId = product.shopId?.trim()
      if (!productShopId || optionMap.has(productShopId)) {
        continue
      }
      optionMap.set(productShopId, product.shopName?.trim() || productShopId)
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label))
  }, [partners, products])

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    const normalizedStatusFilter = normalizeStatus(statusFilter)

    return products.filter((item) => {
      const itemShopId = item.shopId?.trim() || ''
      const itemCategoryId = item.categoryId?.trim() || ''
      const itemStatus = normalizeStatus(item.status)
      const keywordMatched =
        !normalizedKeyword ||
        [
          item.name,
          item.productName,
          item.description,
          item.shopName,
          item.shopId,
          item.brand,
          item.sku,
          item.productId,
          item.itemId,
        ]
          .map((value) => normalizeText(value))
          .some((value) => value.includes(normalizedKeyword))

      const categoryMatched = !categoryFilter || itemCategoryId === categoryFilter
      const shopMatched = !shopFilter || itemShopId === shopFilter
      const statusMatched = !normalizedStatusFilter || itemStatus === normalizedStatusFilter

      return keywordMatched && categoryMatched && shopMatched && statusMatched
    })
  }, [categoryFilter, keyword, products, shopFilter, statusFilter])

  const totalPages = useMemo(() => {
    if (!filteredProducts.length) {
      return 0
    }
    return Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE)
  }, [filteredProducts.length])

  useEffect(() => {
    setPage(0)
  }, [keyword, categoryFilter, shopFilter, statusFilter])

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

  const totalAvailableQuantity = useMemo(
    () => filteredProducts.reduce((sum, item) => sum + normalizeQuantity(item.availableQuantity), 0),
    [filteredProducts],
  )

  const totalInventoryValue = useMemo(
    () => filteredProducts.reduce((sum, item) => sum + normalizeQuantity(item.availableQuantity) * Number(item.price || 0), 0),
    [filteredProducts],
  )

  function resetEditorForm() {
    setEditingProductId('')
    setShopId('')
    setShopName('')
    setName('')
    setDescription('')
    setCategoryId('')
    setBrand('')
    setStatus('ACTIVE')
    setSku('')
    setPrice('')
    setAvailableQuantity('0')
    setExistingImageUrl('')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setIsEditorOpen(false)
  }

  function openCreateEditor() {
    setError('')
    setSuccess('')
    resetEditorForm()
    setIsEditorOpen(true)
  }

  function openEditEditor(product: ProductCardData) {
    setError('')
    setSuccess('')
    setEditingProductId(product.productId)
    setShopId(product.shopId?.trim() || '')
    setShopName(product.shopName?.trim() || '')
    setName(resolveProductDisplayName(product))
    setDescription(product.description?.trim() || '')
    setCategoryId(product.categoryId?.trim() || '')
    setBrand(product.brand?.trim() || '')
    setStatus(product.status?.trim() || 'ACTIVE')
    setSku(product.sku?.trim() || '')
    setPrice(product.price == null ? '' : String(product.price))
    setAvailableQuantity(String(normalizeQuantity(product.availableQuantity)))
    setExistingImageUrl(product.imageUrl?.trim() || '')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setIsEditorOpen(true)
  }

  function closeEditor() {
    resetEditorForm()
  }

  function handleShopChange(value: string) {
    setShopId(value)
    const resolvedShopName = partnerNameById.get(value) || shopName
    setShopName(resolvedShopName)
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.')
      event.target.value = ''
      return
    }

    setError('')
    setSelectedImageFile(file)
    event.target.value = ''
  }

  async function uploadProductImage(image: File): Promise<string> {
    setUploadingImage(true)
    try {
      const response = await apis().postForm(endpoints.inventories.uploadProductImage, {
        image,
      })
      const data = extractApiData<ProductImageUploadResponse>(response)
      return data?.imageUrl?.trim() || DEFAULT_PRODUCT_IMAGE_URL
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Cannot upload product image.'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSaveProduct() {
    setError('')
    setSuccess('')

    if (!shopId.trim()) {
      setError('Shop is required for admin product actions.')
      return
    }

    if (!name.trim()) {
      setError('Product name is required.')
      return
    }

    if (!categoryId.trim()) {
      setError('Category is required.')
      return
    }

    const parsedPrice = Number(price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Price must be greater than 0.')
      return
    }

    const parsedAvailableQuantity = Number(availableQuantity)
    if (!Number.isFinite(parsedAvailableQuantity) || parsedAvailableQuantity < 0) {
      setError('Available quantity must be 0 or greater.')
      return
    }

    let resolvedImageUrl = existingImageUrl || DEFAULT_PRODUCT_IMAGE_URL
    if (selectedImageFile) {
      try {
        resolvedImageUrl = await uploadProductImage(selectedImageFile)
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : 'Cannot upload product image.')
        return
      }
    }

    const resolvedShopName = shopName.trim() || partnerNameById.get(shopId.trim()) || shopId.trim()

    const payload: UpsertAdminProductRequest = {
      shopId: shopId.trim(),
      shopName: resolvedShopName,
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      brand: brand.trim() || undefined,
      status: status.trim() || undefined,
      imageUrl: resolvedImageUrl,
      sku: sku.trim() || undefined,
      price: parsedPrice,
      availableQuantity: parsedAvailableQuantity,
    }

    setSaving(true)
    try {
      if (editingProductId) {
        await apis().put(endpoints.inventories.updateProduct(editingProductId), payload)
      } else {
        await apis().post(endpoints.inventories.createProduct, payload)
      }
      setSuccess(editingProductId ? 'Product updated successfully.' : 'Product created successfully.')
      closeEditor()
      await loadProducts()
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          editingProductId ? 'Cannot update product.' : 'Cannot create product.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProduct(product: ProductCardData) {
    const resolvedShopId = product.shopId?.trim() || ''
    if (!resolvedShopId) {
      setError('Cannot delete product without shopId.')
      return
    }

    const confirmed = window.confirm(`Delete product "${resolveProductDisplayName(product)}"?`)
    if (!confirmed) {
      return
    }

    setDeletingProductId(product.productId)
    setError('')
    setSuccess('')
    try {
      await apis().delete(endpoints.inventories.deleteProduct(product.productId), {
        params: {
          shopId: resolvedShopId,
        },
      })
      setSuccess('Product deleted successfully.')
      if (editingProductId === product.productId) {
        closeEditor()
      }
      await loadProducts()
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot delete product.'))
    } finally {
      setDeletingProductId('')
    }
  }

  const editorTitle = editingProductId ? 'Edit Product' : 'Create Product'
  const editorImagePreview = selectedImagePreviewUrl || existingImageUrl || DEFAULT_PRODUCT_IMAGE_URL

  return (
    <section className="admin-product-page role-page-stack">
      <article className="role-card">
        <h2>Product Management</h2>
        <p className="role-muted">
          Admin can manage products across all partner shops in one place.
        </p>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={openCreateEditor}>
            Create Product
          </button>
          <button type="button" className="role-btn-ghost" onClick={() => void refreshAll()}>
            {loadingProducts || loadingCategories || loadingPartners ? 'Loading...' : 'Reload Data'}
          </button>
        </div>

        <div className="role-metric-grid admin-product-page-metrics">
          <div className="role-metric-card">
            <span>Total Products (Current Filter)</span>
            <strong>{filteredProducts.length}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total Categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="role-metric-card">
            <span>Total Partners</span>
            <strong>{partnerOptions.length}</strong>
          </div>
          <div className="role-metric-card">
            <span>Available Units</span>
            <strong>{totalAvailableQuantity}</strong>
          </div>
          <div className="role-metric-card">
            <span>Inventory Value</span>
            <strong>{formatMoney(totalInventoryValue, 'VND')}</strong>
          </div>
        </div>

        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}
      </article>

      <article className="role-card">
        <div className="role-inline-form admin-product-page-filter">
          <label>
            Search product
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Name, SKU, ID, shop..."
            />
          </label>

          <label>
            Partner shop
            <select value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}>
              <option value="">All shops</option>
              {partnerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </label>
        </div>

        <div className="role-inline-actions">
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => {
              setKeyword('')
              setCategoryFilter('')
              setShopFilter('')
              setStatusFilter('')
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="admin-product-page-grid">
          {pagedProducts.map((item) => (
            <ProductCard
              key={item.stockId || item.itemId || item.productId}
              product={item}
              onEdit={openEditEditor}
              onDelete={handleDeleteProduct}
              deleting={deletingProductId === item.productId}
            />
          ))}

          {!filteredProducts.length && (
            <p className="role-empty-cell admin-product-page-empty">
              No products found for current filters.
            </p>
          )}
        </div>

        {totalPages > 0 && (
          <div className="admin-product-page-pagination">
            <p className="admin-product-page-pagination-summary">
              Showing {Math.min(page * PRODUCT_PAGE_SIZE + 1, filteredProducts.length)}-
              {Math.min((page + 1) * PRODUCT_PAGE_SIZE, filteredProducts.length)} of{' '}
              {filteredProducts.length}
            </p>
            <div className="admin-product-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost admin-product-page-btn-page"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page <= 0}
              >
                Prev
              </button>
              {paginationPages.map((pageNumber) => (
                <button
                  key={`admin-product-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost admin-product-page-btn-page ${pageNumber === page ? 'is-active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost admin-product-page-btn-page"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>

      {isEditorOpen && (
        <div className="admin-product-page-modal-backdrop" onClick={closeEditor}>
          <div className="admin-product-page-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{editorTitle}</h3>
              <button type="button" className="role-btn-ghost" onClick={closeEditor}>
                Close
              </button>
            </header>

            <div className="admin-product-page-modal-layout">
              <div className="admin-product-page-modal-image">
                <img src={editorImagePreview} alt={name || 'Product preview'} />
                <label className="admin-product-page-upload-label">
                  Product image
                  <input type="file" accept="image/*" onChange={handleImageFileChange} />
                </label>
              </div>

              <div className="admin-product-page-modal-fields">
                <label>
                  Shop
                  <select value={shopId} onChange={(event) => handleShopChange(event.target.value)}>
                    <option value="">Select shop</option>
                    {partnerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Shop name
                  <input
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Display name for shop"
                  />
                </label>

                <label>
                  Product name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Product name"
                  />
                </label>

                <label>
                  Category
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
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
                  <input
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="SKU"
                  />
                </label>

                <label>
                  Price (VND)
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="Ex: 150000"
                  />
                </label>

                <label>
                  Available quantity
                  <input
                    type="number"
                    min={0}
                    value={availableQuantity}
                    onChange={(event) => setAvailableQuantity(event.target.value)}
                    placeholder="0"
                  />
                </label>

                <label>
                  Status
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </label>

                <label className="admin-product-page-modal-full-width">
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Description"
                  />
                </label>
              </div>
            </div>

            <div className="role-inline-actions admin-product-page-modal-actions">
              <button type="button" className="role-btn-primary" onClick={() => void handleSaveProduct()}>
                {saving || uploadingImage
                  ? editingProductId
                    ? 'Updating...'
                    : 'Creating...'
                  : editingProductId
                    ? 'Update Product'
                    : 'Create Product'}
              </button>
              <button type="button" className="role-btn-ghost" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminProductManagementPage
