import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import ProductCard, {
  type ProductCardData,
  type ProductCardRatingSummary,
} from '../../../components/products/ProductCard'
import {
  readUserCartFromStorage,
  type UserCartItem,
  type UserCartMap,
  writeUserCartToStorage,
} from '../../../features/cart/userCartStorage'
import {
  APP_OPEN_MESSAGE_CONVERSATION_EVENT,
  type OpenMessageConversationDetail,
} from '../../../constants/messageEvents'
import { useI18n } from '../../../i18n/I18nProvider'
import './UserProductsPage.css'

const DEFAULT_PRODUCT_PAGE_SIZE = 8
const PRODUCT_PAGE_SIZE_OPTIONS = [8, 12, 16, 24]
const DEFAULT_REVIEW_PAGE_SIZE = 6
const APP_NOTIFICATION_EVENT = 'app-notification-event'

type ProductReviewComment = {
  commentId: string
  commentUuid?: string
  reviewId: string
  productId: string
  userId: string
  userName?: string
  content: string
  editedAt?: string
  createdAt?: string
  updatedAt?: string
}

type ProductReview = {
  reviewId: string
  reviewUuid?: string
  productId: string
  userId: string
  userName?: string
  rating: number
  title?: string
  content: string
  orderCode?: string
  verifiedPurchase?: boolean
  editedAt?: string
  createdAt?: string
  updatedAt?: string
  comments?: ProductReviewComment[]
}

type ProductReviewListResponse = {
  content: ProductReview[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

type ProductReviewStats = {
  productId: string
  averageRating: number
  totalReviews: number
  star1: number
  star2: number
  star3: number
  star4: number
  star5: number
}

type AppNotificationEventDetail = {
  eventName: string
  payload: unknown
}

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

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('en-US')
}

function normalizeReviewText(value?: string | null) {
  return value?.trim() || ''
}

function resolveReviewDisplayName(
  userId: string | undefined,
  userName: string | undefined,
  currentUserId: string,
  selfLabel = 'You',
) {
  const normalizedUserId = userId?.trim() || ''
  if (normalizedUserId && normalizedUserId === currentUserId) {
    return selfLabel
  }

  const normalizedUserName = userName?.trim() || ''
  if (normalizedUserName) {
    return normalizedUserName
  }

  return normalizedUserId || 'Unknown user'
}

function normalizeRatingValue(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) {
    return 0
  }
  return Math.max(0, Math.min(5, Number(value)))
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
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const currentUserId = session?.userId || ''
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
  const [reviewList, setReviewList] = useState<ProductReview[]>([])
  const [reviewStats, setReviewStats] = useState<ProductReviewStats | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewPage, setReviewPage] = useState(0)
  const [reviewTotalPages, setReviewTotalPages] = useState(0)
  const [reviewTotalElements, setReviewTotalElements] = useState(0)
  const [reviewSort, setReviewSort] = useState('latest')
  const [reviewFormRating, setReviewFormRating] = useState(5)
  const [reviewFormTitle, setReviewFormTitle] = useState('')
  const [reviewFormContent, setReviewFormContent] = useState('')
  const [commentDraftByReviewId, setCommentDraftByReviewId] = useState<Record<string, string>>({})
  const [commentSubmittingByReviewId, setCommentSubmittingByReviewId] = useState<Record<string, boolean>>({})
  const [reviewStatsByProductId, setReviewStatsByProductId] = useState<Record<string, ProductReviewStats>>({})
  const [reviewStatsLoadedByProductId, setReviewStatsLoadedByProductId] = useState<Record<string, boolean>>({})
  const [isReviewComposerOpen, setIsReviewComposerOpen] = useState(false)
  const [activeCommentReviewId, setActiveCommentReviewId] = useState('')
  const [isReviewPanelVisible, setIsReviewPanelVisible] = useState(false)
  const [pendingFocusReviewId, setPendingFocusReviewId] = useState('')

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

  const loadProductReviewBundle = useCallback(async (
    productId: string,
    targetPage = reviewPage,
    targetSort = reviewSort,
  ) => {
    if (!productId) {
      return
    }

    setReviewLoading(true)
    setReviewError('')
    try {
      const [reviewsResponse, statsResponse] = await Promise.all([
        apis().get(endpoints.inventories.productReviews(productId), {
          params: {
            page: targetPage,
            size: DEFAULT_REVIEW_PAGE_SIZE,
            sort: targetSort,
          },
        }),
        apis().get(endpoints.inventories.productReviewStats(productId)),
      ])

      const reviewListData = extractApiData<ProductReviewListResponse>(reviewsResponse)
      const reviewStatsData = extractApiData<ProductReviewStats>(statsResponse)

      setReviewList(Array.isArray(reviewListData.content) ? reviewListData.content : [])
      setReviewPage(Number.isFinite(reviewListData.page as number) ? Number(reviewListData.page) : 0)
      setReviewTotalPages(
        Number.isFinite(reviewListData.totalPages as number)
          ? Math.max(0, Number(reviewListData.totalPages))
          : 0,
      )
      setReviewTotalElements(
        Number.isFinite(reviewListData.totalElements as number)
          ? Math.max(0, Number(reviewListData.totalElements))
          : 0,
      )
      setReviewStats(reviewStatsData)
      setReviewStatsByProductId((previous) => ({
        ...previous,
        [productId]: reviewStatsData,
      }))
      setReviewStatsLoadedByProductId((previous) => ({
        ...previous,
        [productId]: true,
      }))
    } catch (err) {
      setReviewError(extractApiErrorMessage(err, 'Cannot load product reviews.'))
      setReviewList([])
      setReviewTotalPages(0)
      setReviewTotalElements(0)
      setReviewStats(null)
    } finally {
      setReviewLoading(false)
    }
  }, [reviewPage, reviewSort])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    writeUserCartToStorage(cart)
  }, [cart])

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

  useEffect(() => {
    const productIds = Array.from(
      new Set(
        pagedProducts
          .map((item) => item.productId?.trim())
          .filter((productId): productId is string => Boolean(productId)),
      ),
    )
    const uncachedProductIds = productIds.filter(
      (productId) => !reviewStatsLoadedByProductId[productId],
    )
    if (!uncachedProductIds.length) {
      return
    }

    let active = true

    void (async () => {
      const results = await Promise.all(
        uncachedProductIds.map(async (productId) => {
          try {
            const response = await apis().get(endpoints.inventories.productReviewStats(productId))
            return {
              productId,
              stats: extractApiData<ProductReviewStats>(response),
            }
          } catch {
            return {
              productId,
              stats: null,
            }
          }
        }),
      )

      if (!active) {
        return
      }

      setReviewStatsLoadedByProductId((previous) => {
        const next = { ...previous }
        for (const { productId } of results) {
          next[productId] = true
        }
        return next
      })

      setReviewStatsByProductId((previous) => {
        const next = { ...previous }
        for (const { productId, stats } of results) {
          if (stats) {
            next[productId] = stats
          }
        }
        return next
      })
    })()

    return () => {
      active = false
    }
  }, [pagedProducts, reviewStatsLoadedByProductId])

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
  const myReview = useMemo(() => {
    if (!currentUserId) {
      return null
    }
    return reviewList.find((review) => review.userId === currentUserId) || null
  }, [currentUserId, reviewList])
  const activeCommentReview = useMemo(() => {
    if (!activeCommentReviewId) {
      return null
    }
    return reviewList.find((review) => review.reviewId === activeCommentReviewId) || null
  }, [activeCommentReviewId, reviewList])
  const activeCommentDraft = activeCommentReviewId ? commentDraftByReviewId[activeCommentReviewId] || '' : ''
  const activeCommentSubmitting = activeCommentReviewId
    ? Boolean(commentSubmittingByReviewId[activeCommentReviewId])
    : false
  const activeCommentReviewRating = activeCommentReview
    ? Math.max(1, Math.round(normalizeRatingValue(activeCommentReview.rating)))
    : 1

  useEffect(() => {
    if (!selectedProduct?.productId) {
      return
    }

    setReviewPage(0)
    setReviewSort('latest')
    setReviewFormRating(5)
    setReviewFormTitle('')
    setReviewFormContent('')
    setCommentDraftByReviewId({})
    setCommentSubmittingByReviewId({})
    setIsReviewComposerOpen(false)
    setActiveCommentReviewId('')
    if (isReviewPanelVisible) {
      void loadProductReviewBundle(selectedProduct.productId, 0, 'latest')
    }
  }, [isReviewPanelVisible, loadProductReviewBundle, selectedProduct?.productId])

  useEffect(() => {
    if (!myReview) {
      setReviewFormRating(5)
      setReviewFormTitle('')
      setReviewFormContent('')
      return
    }

    setReviewFormRating(Math.max(1, Math.min(5, Number(myReview.rating) || 5)))
    setReviewFormTitle(myReview.title?.trim() || '')
    setReviewFormContent(myReview.content?.trim() || '')
  }, [myReview])

  useEffect(() => {
    function onRealtimeReviewEvent(event: Event) {
      if (!selectedProduct?.productId || !isReviewPanelVisible) {
        return
      }

      const customEvent = event as CustomEvent<AppNotificationEventDetail>
      const eventName = customEvent.detail?.eventName || ''
      if (!eventName.startsWith('product.review.')) {
        return
      }

      const payload = customEvent.detail?.payload as
        | { productId?: string | null }
        | undefined
      const payloadProductId = payload?.productId?.trim() || ''
      if (!payloadProductId || payloadProductId !== selectedProduct.productId) {
        return
      }

      void loadProductReviewBundle(selectedProduct.productId, reviewPage, reviewSort)
    }

    window.addEventListener(APP_NOTIFICATION_EVENT, onRealtimeReviewEvent as EventListener)
    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, onRealtimeReviewEvent as EventListener)
    }
  }, [isReviewPanelVisible, loadProductReviewBundle, reviewPage, reviewSort, selectedProduct?.productId])

  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const focusProductId = query.get('focusProductId')?.trim() || ''
    if (!focusProductId || !products.length) {
      return
    }

    const matchedProduct = products.find((item) => item.productId === focusProductId)
    if (!matchedProduct) {
      return
    }

    const focusReviewId = query.get('focusReviewId')?.trim() || ''
    setSelectedProduct(matchedProduct)
    setIsReviewPanelVisible(true)
    setPendingFocusReviewId(focusReviewId)
    navigate(location.pathname, { replace: true })
  }, [location.pathname, location.search, navigate, products])

  useEffect(() => {
    if (!pendingFocusReviewId || !selectedProduct?.productId || !reviewList.length) {
      return
    }

    const reviewExists = reviewList.some((review) => review.reviewId === pendingFocusReviewId)
    if (!reviewExists) {
      return
    }

    setActiveCommentReviewId(pendingFocusReviewId)
    setPendingFocusReviewId('')
  }, [pendingFocusReviewId, reviewList, selectedProduct?.productId])

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

  function handleOpenPartnerChat(product: ProductCardData) {
    const partnerUserId = product.shopId?.trim() || ''
    if (!partnerUserId) {
      return
    }

    const detail: OpenMessageConversationDetail = {
      partnerUserId,
      partnerDisplayName: product.shopName?.trim() || partnerUserId,
    }

    window.dispatchEvent(
      new CustomEvent<OpenMessageConversationDetail>(
        APP_OPEN_MESSAGE_CONVERSATION_EVENT,
        { detail },
      ),
    )
  }

  async function handleSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProduct?.productId) {
      return
    }
    if (!currentUserId) {
      setReviewError('Please login again to review this product.')
      return
    }
    if (!normalizeReviewText(reviewFormContent)) {
      setReviewError('Please enter your review content.')
      return
    }

    setReviewSubmitting(true)
    setReviewError('')
    try {
      const payload = {
        rating: reviewFormRating,
        title: normalizeReviewText(reviewFormTitle) || null,
        content: normalizeReviewText(reviewFormContent),
      }

      if (myReview?.reviewId) {
        await apis().put(
          endpoints.inventories.updateProductReview(myReview.reviewId),
          payload,
        )
      } else {
        await apis().post(
          endpoints.inventories.createProductReview(selectedProduct.productId),
          payload,
        )
      }

      setIsReviewComposerOpen(false)
      void loadProductReviewBundle(selectedProduct.productId, 0, reviewSort)
    } catch (err) {
      setReviewError(extractApiErrorMessage(err, 'Cannot save product review.'))
    } finally {
      setReviewSubmitting(false)
    }
  }

  async function handleSubmitComment(reviewId: string): Promise<boolean> {
    if (!selectedProduct?.productId || !reviewId) {
      return false
    }
    if (!currentUserId) {
      setReviewError('Please login again to comment.')
      return false
    }

    const content = normalizeReviewText(commentDraftByReviewId[reviewId])
    if (!content) {
      return false
    }

    setCommentSubmittingByReviewId((previous) => ({
      ...previous,
      [reviewId]: true,
    }))
    setReviewError('')

    try {
      await apis().post(
        endpoints.inventories.createProductReviewComment(reviewId),
        { content },
      )
      setCommentDraftByReviewId((previous) => ({
        ...previous,
        [reviewId]: '',
      }))
      void loadProductReviewBundle(selectedProduct.productId, reviewPage, reviewSort)
      return true
    } catch (err) {
      setReviewError(extractApiErrorMessage(err, 'Cannot create review comment.'))
      return false
    } finally {
      setCommentSubmittingByReviewId((previous) => ({
        ...previous,
        [reviewId]: false,
      }))
    }
  }

  function handleChangeReviewSort(nextSort: string) {
    if (!selectedProduct?.productId) {
      setReviewSort(nextSort)
      return
    }
    setReviewSort(nextSort)
    setReviewPage(0)
    void loadProductReviewBundle(selectedProduct.productId, 0, nextSort)
  }

  function handleGoToReviewPage(nextPage: number) {
    if (!selectedProduct?.productId || nextPage < 0 || nextPage >= reviewTotalPages) {
      return
    }
    setReviewPage(nextPage)
    void loadProductReviewBundle(selectedProduct.productId, nextPage, reviewSort)
  }

  function handleOpenReviewPanel(targetReviewId = '') {
    if (!selectedProduct?.productId) {
      return
    }

    setReviewError('')
    setReviewPage(0)
    setReviewSort('latest')
    setIsReviewPanelVisible(true)
    setPendingFocusReviewId(targetReviewId)
    void loadProductReviewBundle(selectedProduct.productId, 0, 'latest')
  }

  function closeProductDetail() {
    setSelectedProduct(null)
    setReviewError('')
    setReviewList([])
    setReviewStats(null)
    setReviewPage(0)
    setReviewTotalPages(0)
    setReviewTotalElements(0)
    setCommentDraftByReviewId({})
    setCommentSubmittingByReviewId({})
    setIsReviewComposerOpen(false)
    setActiveCommentReviewId('')
    setIsReviewPanelVisible(false)
    setPendingFocusReviewId('')
  }

  const detailProductName =
    selectedProduct?.name?.trim() || selectedProduct?.productName?.trim() || 'Unnamed Product'
  const detailShopName = selectedProduct?.shopName?.trim() || selectedProduct?.shopId || '-'
  const detailReviewStats = selectedProduct?.productId
    ? reviewStats || reviewStatsByProductId[selectedProduct.productId] || null
    : null
  const getProductRatingSummary = useCallback(
    (productId: string): ProductCardRatingSummary | null => {
      const stats = reviewStatsByProductId[productId]
      if (!stats) {
        return null
      }
      return {
        averageRating: normalizeRatingValue(stats.averageRating),
        totalReviews: Math.max(0, Number(stats.totalReviews) || 0),
      }
    },
    [reviewStatsByProductId],
  )
  const reviewPaginationPages = useMemo(
    () => buildPaginationPages(reviewPage, reviewTotalPages, 5),
    [reviewPage, reviewTotalPages],
  )

  return (
    <section className="user-products-page role-page-stack">
      <article className="role-card user-products-page-catalog-card">
        <div className="user-products-page-catalog-header">
          <div>
            <h2>{t('pages.userProducts.title')}</h2>
            <p className="role-muted">
              {t('pages.userProducts.subtitle')}
            </p>
          </div>
          <div className="user-products-page-catalog-metrics" aria-label={t('pages.userProducts.catalogSummaryAria')}>
            <span>{t('pages.userProducts.metrics.products', undefined, { count: filteredProducts.length })}</span>
            <span>{t('pages.userProducts.metrics.categories', undefined, { count: categoryOptions.length })}</span>
          </div>
        </div>

        {error && <p className="role-error">{error}</p>}

        <div className="role-inline-actions user-products-page-catalog-actions">
          <button type="button" className="role-btn-primary" onClick={() => void loadCatalog()}>
            {loading ? t('pages.userProducts.loading') : t('pages.userProducts.refreshCatalog')}
          </button>
          <label className="user-products-page-page-size">
            <span>{t('pages.userProducts.itemsPerPage')}</span>
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
          {t('pages.userProducts.cartSummary', undefined, {
            productCount: cartProductCount,
            totalQuantity: cartQuantity,
          })}
        </p>

        <div className="role-inline-form user-products-page-filter">
          <label>
            {t('pages.userProducts.filters.searchProduct')}
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('pages.userProducts.filters.placeholders.searchProduct')}
            />
          </label>
          <label>
            {t('pages.userProducts.filters.searchShop')}
            <input
              value={shopKeyword}
              onChange={(event) => setShopKeyword(event.target.value)}
              placeholder={t('pages.userProducts.filters.placeholders.searchShop')}
            />
          </label>
          <label>
            {t('pages.userProducts.filters.category')}
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">{t('pages.userProducts.filters.allCategories')}</option>
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
                ratingSummary={getProductRatingSummary(item.productId)}
                onViewDetail={setSelectedProduct}
                actionSlot={
                  inCart ? (
                    <div className="user-products-page-action-row">
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
                      <button
                        type="button"
                        className="product-card-btn user-products-page-message-shop-btn"
                        onClick={() => handleOpenPartnerChat(item)}
                        disabled={!item.shopId?.trim()}
                      >
                        <span className="user-products-page-btn-label">
                          <span className="user-products-page-btn-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16h-6.3l-3.7 3a1 1 0 0 1-1.6-.78V16.2A2.5 2.5 0 0 1 4 13.8v-8.3Z" />
                            </svg>
                          </span>
                          <span>{t('pages.userProducts.messageShop')}</span>
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="user-products-page-action-row">
                      <button
                        type="button"
                        className="product-card-btn user-products-page-cart-toggle is-add"
                        onClick={() => handleAddToCart(item)}
                      >
                        <span className="user-products-page-cart-label">
                          <span className="user-products-page-btn-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path d="M7 6h14l-1.3 6.3a2 2 0 0 1-2 1.7H10a2 2 0 0 1-2-1.6L6.6 4H3V2h5l1 4Zm3 16a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                            </svg>
                          </span>
                          <span className="user-products-page-cart-price">{displayPrice}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="product-card-btn user-products-page-message-shop-btn"
                        onClick={() => handleOpenPartnerChat(item)}
                        disabled={!item.shopId?.trim()}
                      >
                        <span className="user-products-page-btn-label">
                          <span className="user-products-page-btn-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16h-6.3l-3.7 3a1 1 0 0 1-1.6-.78V16.2A2.5 2.5 0 0 1 4 13.8v-8.3Z" />
                            </svg>
                          </span>
                          <span>{t('pages.userProducts.messageShop')}</span>
                        </span>
                      </button>
                    </div>
                  )
                }
              />
            )
          })}

          {!filteredProducts.length && (
            <p className="role-empty-cell user-products-page-empty">
              {t('pages.userProducts.empty')}
            </p>
          )}
        </div>

        {totalPages > 0 && (
          <div className="user-products-page-pagination">
            <p className="user-products-page-pagination-summary">
              {t('pages.userProducts.pagination.summary', undefined, {
                start: Math.min(page * pageSize + 1, filteredProducts.length),
                end: Math.min((page + 1) * pageSize, filteredProducts.length),
                total: filteredProducts.length,
              })}
            </p>
            <div className="user-products-page-pagination-controls">
              <button
                type="button"
                className="role-btn-ghost user-products-page-btn-page"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page <= 0}
              >
                {t('pages.userProducts.pagination.prev')}
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
                {t('pages.userProducts.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </article>

      <button
        type="button"
        className="user-products-page-floating-cart"
        onClick={() => navigate('/user/orders')}
        aria-label={t('pages.userProducts.floatingCartAria', undefined, { count: cartQuantity })}
      >
        <span className="user-products-page-floating-cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M7 4h-2.4a1 1 0 1 0 0 2h1.66l1.58 8.34a2 2 0 0 0 1.96 1.66h7.6a2 2 0 0 0 1.94-1.51l1.22-4.86a1 1 0 0 0-.97-1.25H8.54L8.16 6H7zm3.1 13a1.9 1.9 0 1 0 .01 3.8 1.9 1.9 0 0 0-.01-3.8zm7.2 0a1.9 1.9 0 1 0 .01 3.8 1.9 1.9 0 0 0-.01-3.8z" />
          </svg>
        </span>
        <span className="user-products-page-floating-cart-label">{t('pages.userProducts.orderCart')}</span>
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
                {t('pages.userProducts.common.close')}
              </button>
            </header>
            <div className="user-products-page-modal-content">
              <div className="user-products-page-modal-image-wrap">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={detailProductName} />
                ) : (
                  <span>{t('pages.userProducts.detail.noImage')}</span>
                )}
              </div>
              <dl className="user-products-page-modal-fields">
                <div>
                  <dt>{t('pages.userProducts.detail.price')}</dt>
                  <dd>{formatProductPrice(selectedProduct.price, selectedProduct.currency || 'VND')}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.shopName')}</dt>
                  <dd>{detailShopName}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.category')}</dt>
                  <dd>{selectedProduct.categoryName?.trim() || selectedProduct.categoryId?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.brand')}</dt>
                  <dd>{selectedProduct.brand?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.sku')}</dt>
                  <dd>{selectedProduct.sku?.trim() || '-'}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.productId')}</dt>
                  <dd>{selectedProduct.productId}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.available')}</dt>
                  <dd>{normalizeQuantity(selectedProduct.availableQuantity)}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.paid')}</dt>
                  <dd>{normalizeQuantity(selectedProduct.soldQuantity)}</dd>
                </div>
                <div>
                  <dt>{t('pages.userProducts.detail.total')}</dt>
                  <dd>{normalizeQuantity(selectedProduct.totalQuantity)}</dd>
                </div>
              </dl>
            </div>
            <p className="user-products-page-modal-description">
              {selectedProduct.description?.trim() || t('pages.userProducts.detail.noDescription')}
            </p>

            <div className="user-products-page-review-entry">
              <button
                type="button"
                className="role-btn-primary user-products-page-review-entry-btn"
                onClick={() => {
                  if (isReviewPanelVisible) {
                    setIsReviewPanelVisible(false)
                    setActiveCommentReviewId('')
                    return
                  }
                  handleOpenReviewPanel()
                }}
              >
                {isReviewPanelVisible
                  ? t('pages.userProducts.reviews.hideRatings')
                  : t('pages.userProducts.reviews.showRatings')}
              </button>
              {detailReviewStats && (
                <div className="user-products-page-reviews-metrics">
                  <span>{normalizeRatingValue(detailReviewStats.averageRating).toFixed(1)} / 5</span>
                  <span>{t('pages.userProducts.reviews.reviewCount', undefined, { count: detailReviewStats.totalReviews || 0 })}</span>
                </div>
              )}
            </div>

            {isReviewPanelVisible && (
              <section className="user-products-page-reviews">
                <div className="user-products-page-reviews-header">
                  <h4>{t('pages.userProducts.reviews.title')}</h4>
                </div>

                {reviewError && <p className="role-error">{reviewError}</p>}

                <div className="user-products-page-review-stars">
                  {[5, 4, 3, 2, 1].map((starValue) => (
                    <div key={`star-${starValue}`}>
                      <span>{starValue}&#9733;</span>
                      <strong>
                        {starValue === 5 ? detailReviewStats?.star5 || 0
                          : starValue === 4 ? detailReviewStats?.star4 || 0
                            : starValue === 3 ? detailReviewStats?.star3 || 0
                              : starValue === 2 ? detailReviewStats?.star2 || 0
                                : detailReviewStats?.star1 || 0}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="user-products-page-review-actions">
                  <button
                    type="button"
                    className="role-btn-primary user-products-page-review-open-btn"
                    onClick={() => {
                      setReviewError('')
                      setIsReviewComposerOpen(true)
                    }}
                  >
                    {myReview
                      ? t('pages.userProducts.reviews.updateYourReview')
                      : t('pages.userProducts.reviews.writeReview')}
                  </button>
                  {myReview && (
                    <span className="role-muted">
                      {t('pages.userProducts.reviews.alreadyReviewed')}
                    </span>
                  )}
                </div>

                <div className="user-products-page-review-toolbar">
                  <label>
                    {t('pages.userProducts.reviews.sort')}
                    <select
                      value={reviewSort}
                      onChange={(event) => handleChangeReviewSort(event.target.value)}
                      disabled={reviewLoading}
                    >
                      <option value="latest">{t('pages.userProducts.reviews.sortOptions.latest')}</option>
                      <option value="oldest">{t('pages.userProducts.reviews.sortOptions.oldest')}</option>
                      <option value="rating_desc">{t('pages.userProducts.reviews.sortOptions.ratingDesc')}</option>
                      <option value="rating_asc">{t('pages.userProducts.reviews.sortOptions.ratingAsc')}</option>
                    </select>
                  </label>
                  <span>{t('pages.userProducts.reviews.reviewCount', undefined, { count: reviewTotalElements })}</span>
                </div>

                {reviewLoading ? (
                  <p className="role-muted">{t('pages.userProducts.reviews.loading')}</p>
                ) : (
                  <div className="user-products-page-review-list">
                    {!reviewList.length && (
                      <p className="role-muted">{t('pages.userProducts.reviews.empty')}</p>
                    )}

                    {reviewList.map((review) => {
                      const comments = Array.isArray(review.comments) ? review.comments : []
                      const ratingValue = Math.max(1, Math.round(normalizeRatingValue(review.rating)))

                      return (
                        <article key={review.reviewId} className="user-products-page-review-item">
                          <header>
                            <div
                              className="user-products-page-review-rating"
                              aria-label={`${ratingValue} out of 5`}
                            >
                              {[1, 2, 3, 4, 5].map((starValue) => (
                                <span
                                  key={`review-rating-${review.reviewId}-${starValue}`}
                                  className={ratingValue >= starValue ? 'is-active' : ''}
                                  aria-hidden="true"
                                >
                                  &#9733;
                                </span>
                              ))}
                            </div>
                            <div className="user-products-page-review-meta">
                              <strong>{resolveReviewDisplayName(review.userId, review.userName, currentUserId)}</strong>
                              <small>
                                {formatDateTime(review.createdAt)}
                                {review.editedAt ? ' (edited)' : ''}
                              </small>
                            </div>
                            {review.verifiedPurchase && (
                              <span className="user-products-page-review-verified">{t('pages.userProducts.reviews.verifiedPurchase')}</span>
                            )}
                          </header>

                          {review.title?.trim() && <h6>{review.title}</h6>}
                          <p>{review.content}</p>

                          <div className="user-products-page-review-item-actions">
                            <button
                              type="button"
                              className="role-btn-ghost user-products-page-review-comment-trigger"
                              onClick={() => {
                                setReviewError('')
                                setActiveCommentReviewId(review.reviewId)
                              }}
                            >
                              {t('pages.userProducts.reviews.viewComments')}
                            </button>
                            <span>{t('pages.userProducts.reviews.commentCount', undefined, { count: comments.length })}</span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}

                {reviewTotalPages > 0 && (
                  <div className="user-products-page-review-pagination">
                    <button
                      type="button"
                      className="role-btn-ghost user-products-page-btn-page"
                      onClick={() => handleGoToReviewPage(Math.max(0, reviewPage - 1))}
                      disabled={reviewPage <= 0 || reviewLoading}
                    >
                      {t('pages.userProducts.pagination.prev')}
                    </button>
                    {reviewPaginationPages.map((pageNumber) => (
                      <button
                        key={`review-page-${pageNumber}`}
                        type="button"
                        className={`role-btn-ghost user-products-page-btn-page ${pageNumber === reviewPage ? 'is-active' : ''}`}
                        onClick={() => handleGoToReviewPage(pageNumber)}
                        disabled={reviewLoading}
                      >
                        {pageNumber + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="role-btn-ghost user-products-page-btn-page"
                      onClick={() => handleGoToReviewPage(Math.min(reviewTotalPages - 1, reviewPage + 1))}
                      disabled={reviewPage >= reviewTotalPages - 1 || reviewLoading}
                    >
                      {t('pages.userProducts.pagination.next')}
                    </button>
                  </div>
                )}
              </section>
            )}

            {isReviewComposerOpen && (
              <div
                className="user-products-page-submodal-backdrop"
                onClick={() => setIsReviewComposerOpen(false)}
              >
                <div
                  className="user-products-page-submodal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <h5>{myReview
                      ? t('pages.userProducts.reviews.updateYourReview')
                      : t('pages.userProducts.reviews.writeReview')}</h5>
                    <button
                      type="button"
                      className="role-btn-ghost"
                      onClick={() => setIsReviewComposerOpen(false)}
                    >
                      {t('pages.userProducts.common.close')}
                    </button>
                  </header>

                  <form className="user-products-page-review-form" onSubmit={handleSubmitReview}>
                    <label>
                      {t('pages.userProducts.reviews.rating')}
                      <div className="user-products-page-rating-picker" role="radiogroup" aria-label={t('pages.userProducts.reviews.selectRatingAria')}>
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <button
                            key={`review-form-rating-${starValue}`}
                            type="button"
                            className={`user-products-page-rating-star ${reviewFormRating >= starValue ? 'is-active' : ''}`}
                            onClick={() => setReviewFormRating(starValue)}
                            disabled={reviewSubmitting}
                            aria-label={`${starValue} star`}
                          >
                            &#9733;
                          </button>
                        ))}
                      </div>
                      <span className="user-products-page-rating-picker-caption">
                        {t('pages.userProducts.reviews.ratingCaption', undefined, { value: reviewFormRating })}
                      </span>
                    </label>

                    <label>
                      {t('pages.userProducts.reviews.titleOptional')}
                      <input
                        value={reviewFormTitle}
                        onChange={(event) => setReviewFormTitle(event.target.value)}
                        maxLength={160}
                        placeholder={t('pages.userProducts.reviews.placeholders.title')}
                        disabled={reviewSubmitting}
                      />
                    </label>

                    <label>
                      {t('pages.userProducts.reviews.review')}
                      <textarea
                        value={reviewFormContent}
                        onChange={(event) => setReviewFormContent(event.target.value)}
                        maxLength={2000}
                        placeholder={t('pages.userProducts.reviews.placeholders.review')}
                        disabled={reviewSubmitting}
                      />
                    </label>

                    <div className="user-products-page-popup-actions">
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => setIsReviewComposerOpen(false)}
                        disabled={reviewSubmitting}
                      >
                        {t('pages.userProducts.common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="role-btn-primary"
                        disabled={reviewSubmitting}
                      >
                        {reviewSubmitting
                          ? t('pages.userProducts.reviews.saving')
                          : myReview
                            ? t('pages.userProducts.reviews.updateReview')
                            : t('pages.userProducts.reviews.postReview')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeCommentReview && (
              <div
                className="user-products-page-submodal-backdrop"
                onClick={() => setActiveCommentReviewId('')}
              >
                <div
                  className="user-products-page-submodal user-products-page-comment-popup"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <h5>{t('pages.userProducts.comments.title')}</h5>
                    <button
                      type="button"
                      className="role-btn-ghost"
                      onClick={() => setActiveCommentReviewId('')}
                    >
                      {t('pages.userProducts.common.close')}
                    </button>
                  </header>

                  <div className="user-products-page-comment-target">
                    <div
                      className="user-products-page-review-rating"
                      aria-label={`${activeCommentReviewRating} out of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((starValue) => (
                        <span
                          key={`comment-target-rating-${activeCommentReview.reviewId}-${starValue}`}
                          className={activeCommentReviewRating >= starValue ? 'is-active' : ''}
                          aria-hidden="true"
                        >
                          &#9733;
                        </span>
                      ))}
                    </div>
                    <strong>
                      {resolveReviewDisplayName(
                        activeCommentReview.userId,
                        activeCommentReview.userName,
                        currentUserId,
                        'Your review',
                      )}
                    </strong>
                    <p>{activeCommentReview.content}</p>
                  </div>

                  <div className="user-products-page-comment-list user-products-page-comment-list-popup">
                    {(activeCommentReview.comments || []).length > 0 ? (
                      (activeCommentReview.comments || []).map((comment) => (
                        <div key={comment.commentId} className="user-products-page-comment-item">
                          <strong>{resolveReviewDisplayName(comment.userId, comment.userName, currentUserId)}</strong>
                          <span>{comment.content}</span>
                          <small>
                            {formatDateTime(comment.createdAt)}
                            {comment.editedAt ? ' (edited)' : ''}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="role-muted">{t('pages.userProducts.comments.empty')}</p>
                    )}
                  </div>

                  <form
                    className="user-products-page-comment-popup-form"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      const saved = await handleSubmitComment(activeCommentReview.reviewId)
                      if (saved) {
                        setActiveCommentReviewId('')
                      }
                    }}
                  >
                    <label>
                      {t('pages.userProducts.comments.addComment')}
                    <textarea
                      value={activeCommentDraft}
                      onChange={(event) => setCommentDraftByReviewId((previous) => ({
                        ...previous,
                        [activeCommentReview.reviewId]: event.target.value,
                      }))}
                      placeholder={t('pages.userProducts.comments.placeholders.comment')}
                      maxLength={1500}
                      disabled={activeCommentSubmitting}
                    />
                    </label>

                    <div className="user-products-page-popup-actions">
                      <button
                        type="button"
                        className="role-btn-ghost"
                        onClick={() => setActiveCommentReviewId('')}
                        disabled={activeCommentSubmitting}
                      >
                        {t('pages.userProducts.common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="role-btn-primary"
                        disabled={activeCommentSubmitting || !normalizeReviewText(activeCommentDraft)}
                      >
                        {activeCommentSubmitting
                          ? t('pages.userProducts.comments.sending')
                          : t('pages.userProducts.comments.send')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default UserProductsPage
