import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './AdminCategoryManagementPage.css'

type ProductCategory = {
  categoryUid?: string
  categoryUuid?: string
  categoryId: string
  categoryName: string
  description?: string | null
  updatedAt?: string | null
}

const CATEGORY_PAGE_SIZE = 8

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

function formatDate(value?: string | null): string {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('en-US')
}

function AdminCategoryManagementPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [description, setDescription] = useState('')

  const filteredCategories = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) {
      return categories
    }

    return categories.filter((category) => {
      return [category.categoryName, category.description, category.categoryId]
        .map((value) => normalizeText(value))
        .some((value) => value.includes(normalizedKeyword))
    })
  }, [categories, keyword])

  const totalPages = useMemo(() => {
    if (!filteredCategories.length) {
      return 0
    }
    return Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE)
  }, [filteredCategories.length])

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

  const pagedCategories = useMemo(() => {
    if (!filteredCategories.length) {
      return []
    }
    const start = page * CATEGORY_PAGE_SIZE
    return filteredCategories.slice(start, start + CATEGORY_PAGE_SIZE)
  }, [filteredCategories, page])

  function resetCategoryForm() {
    setEditingCategoryId('')
    setCategoryName('')
    setDescription('')
  }

  async function loadCategories() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await apis().get(endpoints.inventories.categories)
      const data = extractApiData<ProductCategory[]>(response)
      setCategories(Array.isArray(data) ? data : [])
      setPage(0)
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot load categories.'))
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) {
      setError('Category name is required.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        categoryName: categoryName.trim(),
        description: description.trim() || undefined,
      }

      if (editingCategoryId) {
        await apis().put(endpoints.inventories.updateCategory(editingCategoryId), payload)
      } else {
        await apis().post(endpoints.inventories.createCategory, payload)
      }

      setSuccess(editingCategoryId ? 'Category updated successfully.' : 'Category created successfully.')
      resetCategoryForm()
      await loadCategories()
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          editingCategoryId ? 'Cannot update category.' : 'Cannot create category.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCategory(category: ProductCategory) {
    const confirmed = window.confirm(`Delete category "${category.categoryName}"?`)
    if (!confirmed) {
      return
    }

    setDeletingCategoryId(category.categoryId)
    setError('')
    setSuccess('')
    try {
      await apis().delete(endpoints.inventories.deleteCategory(category.categoryId))
      setSuccess('Category deleted successfully.')
      if (editingCategoryId === category.categoryId) {
        resetCategoryForm()
      }
      await loadCategories()
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot delete category.'))
    } finally {
      setDeletingCategoryId('')
    }
  }

  function handleEditCategory(category: ProductCategory) {
    setEditingCategoryId(category.categoryId)
    setCategoryName(category.categoryName || '')
    setDescription(category.description?.trim() || '')
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="admin-category-page role-page-stack">
      <article className="role-card">
        <h2>Category Management</h2>
        <p className="role-muted">
          Product categories are global across the system. Partners can only assign products to these existing categories.
        </p>

        <div className="role-inline-form admin-category-page-form">
          <label>
            Category Name
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Category name"
            />
          </label>
          <label className="admin-category-page-full-width">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Description (optional)"
            />
          </label>
        </div>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void handleSaveCategory()}>
            {submitting ? (editingCategoryId ? 'Updating...' : 'Creating...') : editingCategoryId ? 'Update Category' : 'Create Category'}
          </button>
          {editingCategoryId && (
            <button type="button" className="role-btn-ghost" onClick={resetCategoryForm}>
              Cancel Edit
            </button>
          )}
          <button type="button" className="role-btn-ghost" onClick={() => void loadCategories()}>
            {loading ? 'Loading...' : 'Reload Categories'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}
      </article>

      <article className="role-card">
        <div className="admin-category-page-header">
          <h3>Category Catalog</h3>
          <p className="role-muted">
            Total categories: {filteredCategories.length}
          </p>
        </div>

        <div className="role-inline-form admin-category-page-filter">
          <label className="admin-category-page-full-width">
            Search category
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(0)
              }}
              placeholder="Search by name, description, or category ID"
            />
          </label>
        </div>

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Description</th>
                <th>Category ID</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedCategories.map((category) => (
                <tr key={category.categoryId}>
                  <td>{category.categoryName}</td>
                  <td>{category.description?.trim() || '-'}</td>
                  <td>{category.categoryId}</td>
                  <td>{formatDate(category.updatedAt)}</td>
                  <td>
                    <div className="admin-category-page-row-actions">
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => handleEditCategory(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={deletingCategoryId === category.categoryId}
                      >
                        {deletingCategoryId === category.categoryId ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCategories.length && (
                <tr>
                  <td colSpan={5} className="role-empty-cell">
                    No category found for current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="admin-category-page-pagination">
            <p className="admin-category-page-pagination-summary">
              Showing {Math.min(page * CATEGORY_PAGE_SIZE + 1, filteredCategories.length)}-
              {Math.min((page + 1) * CATEGORY_PAGE_SIZE, filteredCategories.length)} of{' '}
              {filteredCategories.length}
            </p>
            <div className="admin-category-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost admin-category-page-btn-page"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page <= 0}
              >
                Prev
              </button>
              {paginationPages.map((pageNumber) => (
                <button
                  key={`admin-category-page-${pageNumber}`}
                  type="button"
                  className={`role-btn-ghost admin-category-page-btn-page ${pageNumber === page ? 'is-active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber + 1}
                </button>
              ))}
              <button
                type="button"
                className="role-btn-ghost admin-category-page-btn-page"
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

export default AdminCategoryManagementPage
