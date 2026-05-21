import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
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
  const { t } = useI18n()
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
      setError(extractApiErrorMessage(err, t('pages.adminCategoryManagement.errors.loadFailed')))
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) {
      setError(t('pages.adminCategoryManagement.errors.categoryNameRequired'))
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

      setSuccess(editingCategoryId
        ? t('pages.adminCategoryManagement.success.updated')
        : t('pages.adminCategoryManagement.success.created'))
      resetCategoryForm()
      await loadCategories()
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          editingCategoryId
            ? t('pages.adminCategoryManagement.errors.updateFailed')
            : t('pages.adminCategoryManagement.errors.createFailed'),
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCategory(category: ProductCategory) {
    const confirmed = window.confirm(
      t('pages.adminCategoryManagement.confirmDelete', undefined, { name: category.categoryName }),
    )
    if (!confirmed) {
      return
    }

    setDeletingCategoryId(category.categoryId)
    setError('')
    setSuccess('')
    try {
      await apis().delete(endpoints.inventories.deleteCategory(category.categoryId))
      setSuccess(t('pages.adminCategoryManagement.success.deleted'))
      if (editingCategoryId === category.categoryId) {
        resetCategoryForm()
      }
      await loadCategories()
    } catch (err) {
      setError(extractApiErrorMessage(err, t('pages.adminCategoryManagement.errors.deleteFailed')))
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
        <h2>{t('pages.adminCategoryManagement.title')}</h2>
        <p className="role-muted">
          {t('pages.adminCategoryManagement.subtitle')}
        </p>

        <div className="role-inline-form admin-category-page-form">
          <label>
            {t('pages.adminCategoryManagement.categoryName')}
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={t('pages.adminCategoryManagement.placeholders.categoryName')}
            />
          </label>
          <label className="admin-category-page-full-width">
            {t('pages.adminCategoryManagement.description')}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder={t('pages.adminCategoryManagement.placeholders.descriptionOptional')}
            />
          </label>
        </div>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void handleSaveCategory()}>
            {submitting
              ? (editingCategoryId
                ? t('pages.adminCategoryManagement.updating')
                : t('pages.adminCategoryManagement.creating'))
              : editingCategoryId
                ? t('pages.adminCategoryManagement.updateCategory')
                : t('pages.adminCategoryManagement.createCategory')}
          </button>
          {editingCategoryId && (
            <button type="button" className="role-btn-ghost" onClick={resetCategoryForm}>
              {t('pages.adminCategoryManagement.cancelEdit')}
            </button>
          )}
          <button type="button" className="role-btn-ghost" onClick={() => void loadCategories()}>
            {loading ? t('pages.adminCategoryManagement.loading') : t('pages.adminCategoryManagement.reloadCategories')}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}
      </article>

      <article className="role-card">
        <div className="admin-category-page-header">
          <h3>{t('pages.adminCategoryManagement.categoryCatalog')}</h3>
          <p className="role-muted">
            {t('pages.adminCategoryManagement.totalCategories', undefined, { count: filteredCategories.length })}
          </p>
        </div>

        <div className="role-inline-form admin-category-page-filter">
          <label className="admin-category-page-full-width">
            {t('pages.adminCategoryManagement.searchCategory')}
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(0)
              }}
              placeholder={t('pages.adminCategoryManagement.placeholders.searchCategory')}
            />
          </label>
        </div>

        <div className="role-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('pages.adminCategoryManagement.table.categoryName')}</th>
                <th>{t('pages.adminCategoryManagement.table.description')}</th>
                <th>{t('pages.adminCategoryManagement.table.categoryId')}</th>
                <th>{t('pages.adminCategoryManagement.table.updatedAt')}</th>
                <th>{t('pages.adminCategoryManagement.table.actions')}</th>
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
                        className="role-btn-ghost admin-category-page-btn-edit"
                        onClick={() => handleEditCategory(category)}
                      >
                        {t('pages.adminCategoryManagement.table.edit')}
                      </button>
                      <button
                        type="button"
                        className="role-btn-ghost admin-category-page-btn-delete"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={deletingCategoryId === category.categoryId}
                      >
                        {deletingCategoryId === category.categoryId
                          ? t('pages.adminCategoryManagement.deleting')
                          : t('pages.adminCategoryManagement.table.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCategories.length && (
                <tr>
                  <td colSpan={5} className="role-empty-cell">
                    {t('pages.adminCategoryManagement.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="admin-category-page-pagination">
            <p className="admin-category-page-pagination-summary">
              {t('pages.adminCategoryManagement.pagination.summary', undefined, {
                start: Math.min(page * CATEGORY_PAGE_SIZE + 1, filteredCategories.length),
                end: Math.min((page + 1) * CATEGORY_PAGE_SIZE, filteredCategories.length),
                total: filteredCategories.length,
              })}
            </p>
            <div className="admin-category-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost admin-category-page-btn-page"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page <= 0}
              >
                {t('pages.adminCategoryManagement.pagination.prev')}
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
                {t('pages.adminCategoryManagement.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}

export default AdminCategoryManagementPage
