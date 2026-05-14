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

type PartnerRequestOverview = {
  shopName?: string | null
}

const DEFAULT_PRODUCT_IMAGE_URL =
  'https://img.freepik.com/vector-cao-cap/khong-co-bieu-tuong-vector-anh-co-san-bieu-tuong-hinh-anh-mac-dinh-hinh-anh-sap-co-cho-trang-web-hoac-ung-dung-di-dong_87543-18055.jpg'

const CATEGORY_PAGE_SIZE = 5
const PRODUCT_PAGE_SIZE = 8
const IMAGE_CROP_ASPECT_RATIO = 4 / 3
const CROPPED_IMAGE_MIME_TYPE = 'image/jpeg'
const CROPPED_IMAGE_QUALITY = 0.92

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
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

function stripFileExtension(fileName: string): string {
  const trimmed = fileName.trim()
  const lastDotIndex = trimmed.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return trimmed || 'image'
  }
  return trimmed.slice(0, lastDotIndex)
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Cannot load selected image.'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Cannot create cropped image data.'))
        return
      }
      resolve(blob)
    }, CROPPED_IMAGE_MIME_TYPE, CROPPED_IMAGE_QUALITY)
  })
}

async function centerCropImageFile(file: File, aspectRatio = IMAGE_CROP_ASPECT_RATIO): Promise<File> {
  const image = await loadImageFromFile(file)
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const sourceAspectRatio = sourceWidth / sourceHeight

  let cropX = 0
  let cropY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (sourceAspectRatio > aspectRatio) {
    cropWidth = Math.round(sourceHeight * aspectRatio)
    cropX = Math.round((sourceWidth - cropWidth) / 2)
  } else {
    cropHeight = Math.round(sourceWidth / aspectRatio)
    cropY = Math.round((sourceHeight - cropHeight) / 2)
  }

  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = cropHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Cannot initialize image crop canvas.')
  }

  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  )

  const croppedBlob = await canvasToBlob(canvas)
  const croppedFileName = `${stripFileExtension(file.name)}-cropped.jpg`
  return new File([croppedBlob], croppedFileName, { type: CROPPED_IMAGE_MIME_TYPE })
}

function PartnerProductsPage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [processingCreateImage, setProcessingCreateImage] = useState(false)
  const [processingEditImage, setProcessingEditImage] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [editingProduct, setEditingProduct] = useState<ProductCardData | null>(null)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [updateSuccess, setUpdateSuccess] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [availableQuantity, setAvailableQuantity] = useState('0')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [editSku, setEditSku] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editAvailableQuantity, setEditAvailableQuantity] = useState('0')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editSelectedImageFile, setEditSelectedImageFile] = useState<File | null>(null)
  const [editSelectedImagePreviewUrl, setEditSelectedImagePreviewUrl] = useState('')

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

  useEffect(() => {
    if (!editSelectedImageFile) {
      setEditSelectedImagePreviewUrl('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(editSelectedImageFile)
    setEditSelectedImagePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [editSelectedImageFile])

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
    setPrice('')
    setAvailableQuantity('0')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setProcessingCreateImage(false)
  }

  function buildProductUpsertFormData(
    payload: UpsertPartnerProductRequest,
    imageFile: File | null,
  ): FormData {
    const formData = new FormData()

    formData.append('name', payload.name)
    formData.append('price', String(payload.price))
    formData.append('availableQuantity', String(payload.availableQuantity))

    if (payload.description) {
      formData.append('description', payload.description)
    }
    if (payload.categoryId) {
      formData.append('categoryId', payload.categoryId)
    }
    if (payload.shopName) {
      formData.append('shopName', payload.shopName)
    }
    if (payload.brand) {
      formData.append('brand', payload.brand)
    }
    if (payload.status) {
      formData.append('status', payload.status)
    }
    if (payload.imageUrl) {
      formData.append('imageUrl', payload.imageUrl)
    }
    if (payload.sku) {
      formData.append('sku', payload.sku)
    }

    if (imageFile) {
      formData.append('image', imageFile)
    }
    return formData
  }

  async function handleCreateImageSelection(file: File | null) {
    setCreateError('')

    if (!file) {
      setSelectedImageFile(null)
      return
    }

    setProcessingCreateImage(true)
    try {
      const croppedImageFile = await centerCropImageFile(file)
      setSelectedImageFile(croppedImageFile)
    } catch (err) {
      setSelectedImageFile(file)
      setCreateError(
        err instanceof Error
          ? `${err.message} Original image will be used.`
          : 'Cannot crop image. Original image will be used.',
      )
    } finally {
      setProcessingCreateImage(false)
    }
  }

  async function handleEditImageSelection(file: File | null) {
    setUpdateError('')

    if (!file) {
      setEditSelectedImageFile(null)
      return
    }

    setProcessingEditImage(true)
    try {
      const croppedImageFile = await centerCropImageFile(file)
      setEditSelectedImageFile(croppedImageFile)
    } catch (err) {
      setEditSelectedImageFile(file)
      setUpdateError(
        err instanceof Error
          ? `${err.message} Original image will be used.`
          : 'Cannot crop image. Original image will be used.',
      )
    } finally {
      setProcessingEditImage(false)
    }
  }

  function handleEditProduct(product: ProductCardData) {
    setEditingProduct(product)
    setUpdateError('')
    setUpdateSuccess('')
    setEditName(product.name?.trim() || product.productName?.trim() || '')
    setEditDescription(product.description?.trim() || '')
    setEditCategoryId(product.categoryId?.trim() || '')
    setEditBrand(product.brand?.trim() || '')
    setEditStatus(product.status?.trim() || 'ACTIVE')
    setEditSku(product.sku?.trim() || '')
    setEditPrice(product.price == null ? '' : String(product.price))
    setEditAvailableQuantity(String(normalizeQuantity(product.availableQuantity)))
    setEditImageUrl(product.imageUrl?.trim() || DEFAULT_PRODUCT_IMAGE_URL)
    setEditSelectedImageFile(null)
    setEditSelectedImagePreviewUrl('')
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
      if (editingProduct?.productId === product.productId) {
        setEditingProduct(null)
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

    if (!categoryId.trim()) {
      setCreateError('Please select an existing category.')
      return
    }

    const parsedAvailableQuantity = Number(availableQuantity)
    if (!Number.isFinite(parsedAvailableQuantity) || parsedAvailableQuantity < 0) {
      setCreateError('Initial available quantity must be 0 or greater.')
      return
    }

    const parsedPrice = Number(price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setCreateError('Price must be greater than 0.')
      return
    }

    const payload: UpsertPartnerProductRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      shopName: partnerShopName.trim() || undefined,
      brand: brand.trim() || undefined,
      status: status.trim() || undefined,
      imageUrl: undefined,
      sku: sku.trim() || undefined,
      price: parsedPrice,
      availableQuantity: parsedAvailableQuantity,
    }

    setSubmitting(true)
    try {
      const requestBody = buildProductUpsertFormData(payload, selectedImageFile)
      await apis().post(endpoints.inventories.createProduct, requestBody)
      setCreateSuccess('Product created successfully.')
      resetProductForm()
      await loadProducts()
    } catch (err) {
      setCreateError(
        extractApiErrorMessage(err, 'Cannot create partner product.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  function closeEditDialog() {
    setEditingProduct(null)
    setUpdateError('')
    setUpdateSuccess('')
    setEditSelectedImageFile(null)
    setEditSelectedImagePreviewUrl('')
    setProcessingEditImage(false)
  }

  async function handleUpdateProductInDialog() {
    if (!editingProduct) {
      return
    }

    setUpdateError('')
    setUpdateSuccess('')

    if (!editName.trim()) {
      setUpdateError('Please enter product name.')
      return
    }

    if (!editCategoryId.trim()) {
      setUpdateError('Please select an existing category.')
      return
    }

    const parsedAvailableQuantity = Number(editAvailableQuantity)
    if (!Number.isFinite(parsedAvailableQuantity) || parsedAvailableQuantity < 0) {
      setUpdateError('Available quantity must be 0 or greater.')
      return
    }

    const parsedPrice = Number(editPrice)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setUpdateError('Price must be greater than 0.')
      return
    }

    const keepCurrentImageUrl = editSelectedImageFile ? undefined : editImageUrl || DEFAULT_PRODUCT_IMAGE_URL

    const payload: UpsertPartnerProductRequest = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      categoryId: editCategoryId.trim() || undefined,
      shopName: partnerShopName.trim() || undefined,
      brand: editBrand.trim() || undefined,
      status: editStatus.trim() || undefined,
      imageUrl: keepCurrentImageUrl,
      sku: editSku.trim() || undefined,
      price: parsedPrice,
      availableQuantity: parsedAvailableQuantity,
    }

    setUpdating(true)
    try {
      const requestBody = buildProductUpsertFormData(payload, editSelectedImageFile)
      await apis().put(endpoints.inventories.updateProduct(editingProduct.productId), requestBody)
      setUpdateSuccess('Product updated successfully.')
      await loadProducts()
      closeEditDialog()
      setCreateSuccess('Product updated successfully.')
    } catch (err) {
      setUpdateError(extractApiErrorMessage(err, 'Cannot update partner product.'))
    } finally {
      setUpdating(false)
    }
  }

  const detailProductName =
    editingProduct?.name?.trim() || editingProduct?.productName?.trim() || 'Unnamed Product'
  const detailShopName = editingProduct?.shopName?.trim() || editingProduct?.shopId || partnerShopName || '-'
  const editPreviewImageUrl = editSelectedImagePreviewUrl || editImageUrl
  const editCategoryDisplayName =
    categories.find((category) => category.categoryId === editCategoryId)?.categoryName ||
    editCategoryId ||
    '-'
  const editSoldQuantity = normalizeQuantity(editingProduct?.soldQuantity)
  const editTotalQuantity = normalizeQuantity(editingProduct?.totalQuantity)
  const editStockPreview = `${editAvailableQuantity || 0} available / ${editSoldQuantity} paid / ${editTotalQuantity} total`
  const editImageSourceLabel = editSelectedImageFile
    ? `New file: ${editSelectedImageFile.name}`
    : 'Current image is kept'

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

        <h3>Create Product</h3>
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
            Price (VND)
            <input
              type="number"
              min={0}
              step="1000"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Ex: 1500000"
            />
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
                void handleCreateImageSelection(file)
              }}
            />
            <small className="partner-products-page-help">
              Selected image is auto center-cropped to 4:3 for a cleaner product card.
            </small>
            {selectedImagePreviewUrl && (
              <div className="partner-products-page-image-preview">
                <img
                  src={selectedImagePreviewUrl}
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
          <button
            type="button"
            className="role-btn-primary"
            onClick={() => void handleSaveProduct()}
            disabled={submitting || processingCreateImage}
          >
            {processingCreateImage ? 'Cropping image...' : submitting ? 'Creating...' : 'Create Product'}
          </button>
          <button type="button" className="role-btn-ghost" onClick={resetProductForm}>
            Reset Form
          </button>
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

      {editingProduct && (
        <div className="partner-products-page-modal-backdrop" onClick={closeEditDialog}>
          <div className="partner-products-page-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{detailProductName}</h3>
              <button type="button" className="role-btn-ghost" onClick={closeEditDialog}>
                Close
              </button>
            </header>

            <div className="partner-products-page-modal-content">
              <div className="partner-products-page-modal-visual-column">
                <div className="partner-products-page-modal-image-wrap">
                  {editPreviewImageUrl ? (
                    <img src={editPreviewImageUrl} alt={detailProductName} />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <dl className="partner-products-page-modal-visual-meta">
                  <div>
                    <dt>Live Price</dt>
                    <dd>{formatProductPrice(Number(editPrice), editingProduct.currency || 'VND')}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{editCategoryDisplayName}</dd>
                  </div>
                  <div>
                    <dt>Stock Snapshot</dt>
                    <dd>{editStockPreview}</dd>
                  </div>
                  <div>
                    <dt>Image Source</dt>
                    <dd>{editImageSourceLabel}</dd>
                  </div>
                </dl>
              </div>

              <dl className="partner-products-page-modal-fields">
                <div>
                  <dt>Product Name</dt>
                  <dd>
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Product name"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>
                    <select
                      value={editCategoryId}
                      onChange={(event) => setEditCategoryId(event.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.categoryUid || category.categoryId} value={category.categoryId}>
                          {category.categoryName}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt>Shop Name</dt>
                  <dd>
                    <input value={detailShopName} readOnly />
                  </dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>
                    <input
                      value={editBrand}
                      onChange={(event) => setEditBrand(event.target.value)}
                      placeholder="Brand"
                    />
                  </dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd>
                    <input
                      value={editSku}
                      onChange={(event) => setEditSku(event.target.value)}
                      placeholder="SKU"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Price (VND)</dt>
                  <dd>
                    <input
                      type="number"
                      min={0}
                      step="1000"
                      value={editPrice}
                      onChange={(event) => setEditPrice(event.target.value)}
                      placeholder="Ex: 1500000"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>
                    <input
                      type="number"
                      min={0}
                      value={editAvailableQuantity}
                      onChange={(event) => setEditAvailableQuantity(event.target.value)}
                      placeholder="0"
                    />
                  </dd>
                </div>
                <div className="partner-products-page-modal-field-full">
                  <dt>Product Image</dt>
                  <dd>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null
                        void handleEditImageSelection(file)
                      }}
                    />
                  </dd>
                </div>
                <div className="partner-products-page-modal-field-full">
                  <dt>Description</dt>
                  <dd>
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Product description"
                      rows={4}
                    />
                  </dd>
                </div>
              </dl>
            </div>

            {updateError && <p className="role-error">{updateError}</p>}
            {updateSuccess && <p className="role-muted">{updateSuccess}</p>}

            <div className="role-inline-actions partner-products-page-modal-actions">
              <button
                type="button"
                className="role-btn-primary"
                onClick={() => void handleUpdateProductInDialog()}
                disabled={updating || processingEditImage}
              >
                {processingEditImage ? 'Cropping image...' : updating ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="role-btn-ghost" onClick={closeEditDialog}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PartnerProductsPage
