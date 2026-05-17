import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
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
const PRODUCT_IMAGE_CROP_ASPECT_RATIO = 4 / 3
const PRODUCT_IMAGE_CROP_MIN_ZOOM = 1
const PRODUCT_IMAGE_CROP_MAX_ZOOM = 3
const CROPPED_IMAGE_TYPE = 'image/jpeg'
const CROPPED_IMAGE_QUALITY = 0.92

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

function stripFileExtension(fileName: string): string {
  const normalized = fileName.trim()
  const lastDot = normalized.lastIndexOf('.')
  if (lastDot <= 0) {
    return normalized || 'image'
  }
  return normalized.slice(0, lastDot)
}

function createImage(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () =>
      reject(new Error('Cannot load selected image for cropping.')),
    )
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = imageSrc
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Cannot build cropped image.'))
        return
      }
      resolve(blob)
    }, CROPPED_IMAGE_TYPE, CROPPED_IMAGE_QUALITY)
  })
}

async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  originalFileName: string,
): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Cannot initialize canvas context for image crop.')
  }

  const targetWidth = Math.max(1, Math.floor(pixelCrop.width))
  const targetHeight = Math.max(1, Math.floor(pixelCrop.height))
  canvas.width = targetWidth
  canvas.height = targetHeight

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  )

  const blob = await toBlob(canvas)
  return new File([blob], `${stripFileExtension(originalFileName)}-cropped.jpg`, {
    type: CROPPED_IMAGE_TYPE,
  })
}

function PartnerProductsPage() {
  const modalImageInputRef = useRef<HTMLInputElement | null>(null)
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [applyingImageCrop, setApplyingImageCrop] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [editingProductId, setEditingProductId] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [editingProductImageUrl, setEditingProductImageUrl] = useState('')
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropArea, setCropArea] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
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
  const [price, setPrice] = useState('')
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

  function resetCropEditor() {
    setIsCropDialogOpen(false)
    setApplyingImageCrop(false)
    setCropImageSrc('')
    setCropArea({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedAreaPixels(null)
  }

  function openCropEditor(imageSrc: string) {
    setCreateError('')
    setCropImageSrc(imageSrc)
    setCropArea({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedAreaPixels(null)
    setIsCropDialogOpen(true)
  }

  function closeCropEditor() {
    if (applyingImageCrop) {
      return
    }
    resetCropEditor()
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setCreateError('Only image files are allowed.')
      event.target.value = ''
      return
    }

    setCreateError('')
    setSelectedImageFile(file)
    event.target.value = ''
  }

  function handleOpenCropFromPreview() {
    if (!selectedImagePreviewUrl || !selectedImageFile) {
      return
    }
    openCropEditor(selectedImagePreviewUrl)
  }

  function handleChooseNewImageFromModal() {
    modalImageInputRef.current?.click()
  }

  async function handleApplyImageCrop() {
    if (!selectedImageFile || !cropImageSrc || !croppedAreaPixels) {
      setCreateError('Cannot determine crop area for this image.')
      return
    }

    setApplyingImageCrop(true)
    setCreateError('')

    try {
      const croppedFile = await getCroppedImageFile(
        cropImageSrc,
        croppedAreaPixels,
        selectedImageFile.name,
      )
      setSelectedImageFile(croppedFile)
      resetCropEditor()
    } catch {
      setCreateError('Cannot crop product image. Please try again.')
    } finally {
      setApplyingImageCrop(false)
    }
  }

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
    setEditingProductId('')
    setEditingProductImageUrl('')
    setIsEditDialogOpen(false)
    resetCropEditor()
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

  function buildUpsertProductFormData(
    payload: UpsertPartnerProductRequest,
    image?: File | null,
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
    if (image) {
      formData.append('image', image)
    }

    return formData
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
    setPrice(product.price == null ? '' : String(product.price))
    setAvailableQuantity(String(normalizeQuantity(product.availableQuantity)))
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    resetCropEditor()
    setIsEditDialogOpen(true)
  }

  function closeEditDialog() {
    setCreateError('')
    setCreateSuccess('')
    resetProductForm()
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

    const isEditing = Boolean(editingProductId)
    let resolvedImageUrl: string | undefined

    if (isEditing) {
      resolvedImageUrl = editingProductImageUrl || DEFAULT_PRODUCT_IMAGE_URL
    } else if (selectedImageFile) {
      try {
        resolvedImageUrl = await uploadProductImage(selectedImageFile)
      } catch (uploadError) {
        setCreateError(
          uploadError instanceof Error ? uploadError.message : 'Cannot upload product image.',
        )
        return
      }
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
      price: parsedPrice,
      availableQuantity: parsedAvailableQuantity,
    }

    setSubmitting(true)
    try {
      if (editingProductId) {
        if (selectedImageFile) {
          const multipartPayload = buildUpsertProductFormData(payload, selectedImageFile)
          await apis().put(endpoints.inventories.updateProduct(editingProductId), multipartPayload)
        } else {
          await apis().put(endpoints.inventories.updateProduct(editingProductId), payload)
        }
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

  const editImagePreviewUrl = selectedImagePreviewUrl || editingProductImageUrl
  const canCropSelectedImage = Boolean(selectedImageFile && selectedImagePreviewUrl)
  const editDialogTitle = name.trim() || 'Edit Product'

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

      {editingProductId && isEditDialogOpen && (
        <div className="partner-products-page-modal-backdrop" onClick={closeEditDialog}>
          <div className="partner-products-page-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{editDialogTitle}</h3>
              <button type="button" className="role-btn-ghost" onClick={closeEditDialog}>
                Close
              </button>
            </header>

            <div className="partner-products-page-modal-content">
              <div className="partner-products-page-modal-image-panel">
                <div className="partner-products-page-modal-image-wrap">
                  {editImagePreviewUrl ? (
                    <>
                      <img src={editImagePreviewUrl} alt={name || 'Product preview'} />
                      <div className="partner-products-page-modal-image-overlay">
                        <button
                          type="button"
                          className="role-btn-ghost partner-products-page-modal-image-overlay-btn"
                          onClick={handleOpenCropFromPreview}
                          disabled={!canCropSelectedImage}
                        >
                          Crop
                        </button>
                        <button
                          type="button"
                          className="role-btn-ghost partner-products-page-modal-image-overlay-btn"
                          onClick={handleChooseNewImageFromModal}
                        >
                          Choose New
                        </button>
                      </div>
                    </>
                  ) : (
                    <span>No image</span>
                  )}
                </div>

                <input
                  ref={modalImageInputRef}
                  type="file"
                  accept="image/*"
                  className="partner-products-page-modal-image-input"
                  onChange={handleImageFileChange}
                />

                <div className="partner-products-page-modal-image-description">
                  <label>
                    Description
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Product description"
                      rows={5}
                    />
                  </label>
                </div>
              </div>

              <dl className="partner-products-page-modal-fields">
                <div>
                  <dt>Product Name</dt>
                  <dd>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Product name"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>
                    <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
                    <input value={partnerShopName || '-'} readOnly />
                  </dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>
                    <input
                      value={brand}
                      onChange={(event) => setBrand(event.target.value)}
                      placeholder="Brand"
                    />
                  </dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd>
                    <input
                      value={sku}
                      onChange={(event) => setSku(event.target.value)}
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
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="Ex: 1500000"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Product Status</dt>
                  <dd>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
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
                      value={availableQuantity}
                      onChange={(event) => setAvailableQuantity(event.target.value)}
                      placeholder="0"
                    />
                  </dd>
                </div>
              </dl>
            </div>

            <div className="role-inline-actions partner-products-page-modal-actions">
              <button type="button" className="role-btn-primary" onClick={() => void handleSaveProduct()}>
                {submitting || uploadingImage ? 'Updating...' : 'Update Product'}
              </button>
              <button type="button" className="role-btn-ghost" onClick={closeEditDialog}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isCropDialogOpen && (
        <div className="partner-products-page-crop-backdrop" onClick={closeCropEditor}>
          <div className="partner-products-page-crop-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>Crop Product Image</h3>
            </header>
            <div className="partner-products-page-crop-container">
              <Cropper
                image={cropImageSrc}
                crop={cropArea}
                zoom={cropZoom}
                aspect={PRODUCT_IMAGE_CROP_ASPECT_RATIO}
                showGrid
                cropShape="rect"
                onCropChange={setCropArea}
                onZoomChange={setCropZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="partner-products-page-crop-zoom">
              <label htmlFor="partnerProductCropZoom">Zoom</label>
              <input
                id="partnerProductCropZoom"
                type="range"
                min={PRODUCT_IMAGE_CROP_MIN_ZOOM}
                max={PRODUCT_IMAGE_CROP_MAX_ZOOM}
                step={0.1}
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
              />
            </div>
            <div className="role-inline-actions partner-products-page-crop-actions">
              <button
                type="button"
                className="role-btn-primary"
                onClick={() => void handleApplyImageCrop()}
                disabled={applyingImageCrop}
              >
                {applyingImageCrop ? 'Applying...' : 'Apply Crop'}
              </button>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeCropEditor}
                disabled={applyingImageCrop}
              >
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
