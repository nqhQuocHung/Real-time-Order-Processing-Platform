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
  brand?: string
  status?: string
  imageUrl?: string
  sku?: string
  availableQuantity: number
}

type UpsertProductCategoryRequest = {
  categoryName: string
  description?: string
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

const DEFAULT_PRODUCT_IMAGE_URL =
  'https://img.freepik.com/vector-cao-cap/khong-co-bieu-tuong-vector-anh-co-san-bieu-tuong-hinh-anh-mac-dinh-hinh-anh-sap-co-cho-trang-web-hoac-ung-dung-di-dong_87543-18055.jpg'

function normalizeQuantity(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? Number(value) : 0
}

function PartnerProductsPage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [deletingCategoryId, setDeletingCategoryId] = useState('')
  const [editingProductId, setEditingProductId] = useState('')
  const [editingProductImageUrl, setEditingProductImageUrl] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [createCategoryError, setCreateCategoryError] = useState('')
  const [createCategorySuccess, setCreateCategorySuccess] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sku, setSku] = useState('')
  const [availableQuantity, setAvailableQuantity] = useState('0')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')

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

  useEffect(() => {
    void loadProducts()
    void loadCategories()
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

  function resetCategoryForm() {
    setNewCategoryName('')
    setNewCategoryDescription('')
    setEditingCategoryId('')
  }

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

  async function handleSaveCategory() {
    setCreateCategoryError('')
    setCreateCategorySuccess('')

    const normalizedCategoryName = newCategoryName.trim()
    if (!normalizedCategoryName) {
      setCreateCategoryError('Please enter category name.')
      return
    }

    const payload: UpsertProductCategoryRequest = {
      categoryName: normalizedCategoryName,
      description: newCategoryDescription.trim() || undefined,
    }

    setSavingCategory(true)
    try {
      const response = editingCategoryId
        ? await apis().put(endpoints.inventories.updateCategory(editingCategoryId), payload)
        : await apis().post(endpoints.inventories.createCategory, payload)

      const savedCategory = extractApiData<ProductCategory>(response)
      setCreateCategorySuccess(
        editingCategoryId ? 'Category updated successfully.' : 'Category created successfully.',
      )
      resetCategoryForm()

      if (savedCategory?.categoryId) {
        setCategoryId(savedCategory.categoryId)
      }

      await loadCategories()
    } catch (err) {
      setCreateCategoryError(
        extractApiErrorMessage(
          err,
          editingCategoryId ? 'Cannot update product category.' : 'Cannot create product category.',
        ),
      )
    } finally {
      setSavingCategory(false)
    }
  }

  function handleEditCategory(category: ProductCategory) {
    setCreateCategoryError('')
    setCreateCategorySuccess('')
    setEditingCategoryId(category.categoryId)
    setNewCategoryName(category.categoryName || '')
    setNewCategoryDescription(category.description || '')
  }

  async function handleDeleteCategory(category: ProductCategory) {
    const shouldDelete = window.confirm(
      `Delete category "${category.categoryName}"?\nOnly empty categories can be deleted.`,
    )
    if (!shouldDelete) {
      return
    }

    setCreateCategoryError('')
    setCreateCategorySuccess('')
    setDeletingCategoryId(category.categoryId)
    try {
      await apis().delete(endpoints.inventories.deleteCategory(category.categoryId))
      setCreateCategorySuccess('Category deleted successfully.')
      if (editingCategoryId === category.categoryId) {
        resetCategoryForm()
      }
      if (categoryId === category.categoryId) {
        setCategoryId('')
      }
      await loadCategories()
    } catch (err) {
      setCreateCategoryError(extractApiErrorMessage(err, 'Cannot delete product category.'))
    } finally {
      setDeletingCategoryId('')
    }
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
      resolvedImageUrl = editingProductImageUrl || undefined
    }

    const payload: UpsertPartnerProductRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
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
          <h3>{editingCategoryId ? 'Edit Category' : 'Create Category'}</h3>
          <div className="partner-products-page-form role-inline-form">
            <label>
              Category Name
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Ex: Computer Chips"
              />
            </label>
            <label className="partner-products-page-full-width">
              Category Description
              <textarea
                value={newCategoryDescription}
                onChange={(event) => setNewCategoryDescription(event.target.value)}
                placeholder="Category description"
                rows={2}
              />
            </label>
          </div>
          <div className="role-inline-actions">
            <button type="button" className="role-btn-primary" onClick={() => void handleSaveCategory()}>
              {savingCategory
                ? editingCategoryId
                  ? 'Updating Category...'
                  : 'Creating Category...'
                : editingCategoryId
                  ? 'Update Category'
                  : 'Create Category'}
            </button>
            {editingCategoryId && (
              <button type="button" className="role-btn-ghost" onClick={resetCategoryForm}>
                Cancel Edit
              </button>
            )}
            <button type="button" className="role-btn-ghost" onClick={() => void loadCategories()}>
              {loadingCategories ? 'Loading Categories...' : 'Refresh Categories'}
            </button>
          </div>
          {createCategoryError && <p className="role-error">{createCategoryError}</p>}
          {createCategorySuccess && <p className="role-muted">{createCategorySuccess}</p>}
          {categoryError && <p className="role-error">{categoryError}</p>}

          <div className="partner-products-page-category-list">
            {categories.map((category) => (
              <div key={category.categoryId} className="partner-products-page-category-row">
                <div>
                  <strong>{category.categoryName}</strong>
                  <p>{category.description || '-'}</p>
                  <span>{category.categoryId}</span>
                </div>
                <div className="partner-products-page-category-actions">
                  <button
                    type="button"
                    className="role-btn-ghost"
                    onClick={() => handleEditCategory(category)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="partner-products-page-btn-delete"
                    disabled={deletingCategoryId === category.categoryId}
                    onClick={() => void handleDeleteCategory(category)}
                  >
                    {deletingCategoryId === category.categoryId ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
            {!categories.length && (
              <p className="role-empty-cell partner-products-page-empty">No category found.</p>
            )}
          </div>
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
              If you do not upload an image, system will use default image.
            </small>
            <div className="partner-products-page-image-preview">
              <img
                src={selectedImagePreviewUrl || editingProductImageUrl || DEFAULT_PRODUCT_IMAGE_URL}
                alt="Product preview"
              />
            </div>
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
        <div className="partner-products-page-grid">
          {activeProducts.map((item) => (
            <ProductCard
              key={item.stockId || item.itemId || item.productId}
              product={item}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              deleting={deletingProductId === item.productId}
            />
          ))}
          {!activeProducts.length && (
            <p className="role-empty-cell partner-products-page-empty">
              Chua co san pham nao trong shop cua ban.
            </p>
          )}
        </div>
      </article>
    </section>
  )
}

export default PartnerProductsPage
