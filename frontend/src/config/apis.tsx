import axios from 'axios'
import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import type { AppRole } from '../constants/roles'

const API_LOADING_EVENT = 'app-api-loading'

type ApiLoadingEventDetail = {
  pendingCount: number
}

type ApiRequestConfig = InternalAxiosRequestConfig & {
  _loadingTracked?: boolean
  _skipGlobalLoading?: boolean
}

let pendingApiRequestCount = 0

function emitApiLoadingChange() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<ApiLoadingEventDetail>(API_LOADING_EVENT, {
      detail: {
        pendingCount: pendingApiRequestCount,
      },
    }),
  )
}

function beginApiLoading(config: InternalAxiosRequestConfig) {
  const requestConfig = config as ApiRequestConfig
  if (requestConfig._skipGlobalLoading) {
    return
  }

  requestConfig._loadingTracked = true
  pendingApiRequestCount += 1
  emitApiLoadingChange()
}

function endApiLoading(config?: InternalAxiosRequestConfig) {
  if (!config) {
    return
  }

  const requestConfig = config as ApiRequestConfig
  if (!requestConfig._loadingTracked) {
    return
  }

  requestConfig._loadingTracked = false
  pendingApiRequestCount = Math.max(0, pendingApiRequestCount - 1)
  emitApiLoadingChange()
}

function resolveDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080'
  }

  return `${window.location.protocol}//${window.location.hostname}:8080`
}

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  resolveDefaultApiBaseUrl()

type ValidationError = {
  field: string
  message: string
}

type ApiResponseEnvelope<T> = {
  timestamp?: string
  status: number
  code?: string
  message?: string
  traceId?: string
  data: T
  errors?: ValidationError[]
}

type BackendMenuItem = {
  id?: string
  key: string
  label: string
  path?: string
  displayOrder?: number
  permission?: string
  parentMenuId?: string | null
  parentMenuKey?: string | null
  isContainer?: boolean
  showOnMenu?: boolean
}

type AuthSession = {
  accessToken: string
  refreshToken: string
  tokenType: string
  userId: string
  username: string
  email: string
  role?: AppRole
  backendRoles?: string[]
  backendPermissions?: string[]
  backendMenus?: BackendMenuItem[]
}

type RefreshTokenPayload = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  refreshExpiresIn?: number
}

const storageKeys = {
  isLoggedIn: 'isLoggedIn',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  tokenType: 'tokenType',
  username: 'username',
  userId: 'userId',
  user: 'user',
  role: 'role',
  backendRoles: 'backendRoles',
  backendPermissions: 'backendPermissions',
  backendMenus: 'backendMenus',
}

const endpoints = {
  auth: {
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/register',
    refreshToken: '/api/v1/auth/refresh-token',
    forgotPassword: '/api/v1/auth/forgot-password',
    changePassword: '/api/v1/auth/change-password',
    otpForgotPassword: '/api/v1/auth/otp-forgot-password',
    otpChangePassword: '/api/v1/auth/otp-change-password',
    me: '/api/v1/auth/me',
    getUserById: (id: number | string) => `/api/v1/auth/user/${id}`,
    getPublicUserById: (id: number | string) => `/api/v1/auth/public/users/${id}`,
    users: '/api/v1/auth/users',
    usersSummary: '/api/v1/auth/users/summary',
    updateUser: (id: number | string) => `/api/v1/auth/user/${id}`,
    uploadUserAvatar: (id: number | string) => `/api/v1/auth/user/${id}/avatar`,
    checkRole: (roleCode: string) => `/api/v1/auth/check-role/${roleCode}`,
    grantPermission: '/api/v1/auth/grant-permission',
    roles: '/api/v1/auth/roles',
    updateRoleMenus: (roleCode: string) => `/api/v1/auth/roles/${roleCode}/menus`,
    menus: '/api/v1/auth/menus',
    updateMenu: (menuId: string) => `/api/v1/auth/menus/${menuId}`,
    deleteMenu: (menuId: string) => `/api/v1/auth/menus/${menuId}`,
    partnerRequests: '/api/v1/auth/partner-requests',
    myPartnerRequest: '/api/v1/auth/partner-requests/me',
    decidePartnerRequest: (requestId: string) =>
      `/api/v1/auth/partner-requests/${requestId}/decision`,
    permissions: '/api/v1/auth/permissions',
    activateUser: (id: number | string) => `/api/v1/auth/activate/${id}`,
    deactivateUser: (id: number | string) => `/api/v1/auth/deactivate/${id}`,
    lockUser: (id: number | string) => `/api/v1/auth/lock/${id}`,
  },
  orders: {
    create: '/api/v1/orders',
    list: '/api/v1/orders',
    refundList: '/api/v1/orders/refunds',
    detail: (orderCode: string) => `/api/v1/orders/${orderCode}`,
    timeline: (orderCode: string) => `/api/v1/orders/${orderCode}/timeline`,
    cancel: (orderCode: string) => `/api/v1/orders/${orderCode}/cancel`,
    refundDetail: (orderCode: string) => `/api/v1/orders/${orderCode}/refunds`,
    refundRequest: (orderCode: string) => `/api/v1/orders/${orderCode}/refunds`,
    refundDecision: (orderCode: string) =>
      `/api/v1/orders/${orderCode}/refunds/decision`,
    updateStatus: (orderCode: string) => `/api/v1/orders/${orderCode}/status`,
    paymentConfirm: (orderCode: string) =>
      `/api/v1/orders/${orderCode}/payment-confirm`,
    paymentFail: (orderCode: string) => `/api/v1/orders/${orderCode}/payment-fail`,
    shippingConfirm: (orderCode: string) =>
      `/api/v1/orders/${orderCode}/shipping-confirm`,
  },
  inventories: {
    catalog: '/api/v1/inventories/catalog',
    adminProducts: '/api/v1/inventories/admin/products',
    myProducts: '/api/v1/inventories/my-products',
    createProduct: '/api/v1/inventories/products',
    updateProduct: (productId: string) => `/api/v1/inventories/products/${productId}`,
    deleteProduct: (productId: string) => `/api/v1/inventories/products/${productId}`,
    categories: '/api/v1/inventories/categories',
    createCategory: '/api/v1/inventories/categories',
    updateCategory: (categoryId: string) => `/api/v1/inventories/categories/${categoryId}`,
    deleteCategory: (categoryId: string) => `/api/v1/inventories/categories/${categoryId}`,
    stock: (productId: string) => `/api/v1/inventories/${productId}`,
    summary: '/api/v1/inventories/summary',
    check: '/api/v1/inventories/check',
    reserve: '/api/v1/inventories/reserve',
    release: '/api/v1/inventories/release',
    confirmDeduct: '/api/v1/inventories/confirm-deduct',
    adjust: '/api/v1/inventories/adjust',
    uploadProductImage: '/api/v1/inventories/products/upload-image',
    productReviews: (productId: string) => `/api/v1/inventories/products/${productId}/reviews`,
    productReviewStats: (productId: string) => `/api/v1/inventories/products/${productId}/review-stats`,
    createProductReview: (productId: string) => `/api/v1/inventories/products/${productId}/reviews`,
    updateProductReview: (reviewId: string) => `/api/v1/inventories/reviews/${reviewId}`,
    createProductReviewComment: (reviewId: string) => `/api/v1/inventories/reviews/${reviewId}/comments`,
  },
  payments: {
    createIntent: '/api/v1/payments/intents',
    getByOrderCode: (orderCode: string) => `/api/v1/payments/${orderCode}`,
    confirm: '/api/v1/payments/confirm',
    fail: '/api/v1/payments/fail',
    refund: '/api/v1/payments/refunds',
  },
  notifications: {
    create: '/api/v1/notifications',
    list: '/api/v1/notifications',
    detail: (notificationCode: string) =>
      `/api/v1/notifications/${notificationCode}`,
    updateStatus: (notificationCode: string) =>
      `/api/v1/notifications/${notificationCode}/status`,

    // SSE endpoint path (BASE_URL is appended by the stream hook)
    stream: '/api/v1/notifications/stream',
  },
  messages: {
    openConversation: '/api/v1/messages/conversations/open',
    conversations: '/api/v1/messages/conversations',
    conversationMessages: (conversationId: string) =>
      `/api/v1/messages/conversations/${conversationId}/messages`,
    markConversationRead: (conversationId: string) =>
      `/api/v1/messages/conversations/${conversationId}/read`,
  },
}

function getLocalStorageValue(key: string): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(key) || ''
}

function parseUserEmail(): string {
  const rawUser = getLocalStorageValue(storageKeys.user)

  if (!rawUser) {
    return ''
  }

  try {
    const parsed = JSON.parse(rawUser) as { email?: string }
    return parsed.email || ''
  } catch {
    return ''
  }
}

function parseBackendRoles(): string[] {
  const rawRoles = getLocalStorageValue(storageKeys.backendRoles)
  if (!rawRoles) {
    return []
  }

  try {
    const parsed = JSON.parse(rawRoles) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseBackendPermissions(): string[] {
  const rawPermissions = getLocalStorageValue(storageKeys.backendPermissions)
  if (!rawPermissions) {
    return []
  }

  try {
    const parsed = JSON.parse(rawPermissions) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseBackendMenus(): BackendMenuItem[] {
  const rawMenus = getLocalStorageValue(storageKeys.backendMenus)
  if (!rawMenus) {
    return []
  }

  try {
    const parsed = JSON.parse(rawMenus) as BackendMenuItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setLocalStorageValue(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(key, value)
}

function removeLocalStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(key)
}

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `cid-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}

function getAuthSession(): AuthSession | null {
  const accessToken = getLocalStorageValue(storageKeys.accessToken)
  const refreshToken = getLocalStorageValue(storageKeys.refreshToken)

  if (!accessToken || !refreshToken) {
    return null
  }

  return {
    accessToken,
    refreshToken,
    tokenType: getLocalStorageValue(storageKeys.tokenType) || 'Bearer',
    userId: getLocalStorageValue(storageKeys.userId),
    username: getLocalStorageValue(storageKeys.username),
    email: parseUserEmail(),
    role: (getLocalStorageValue(storageKeys.role) as AppRole) || undefined,
    backendRoles: parseBackendRoles(),
    backendPermissions: parseBackendPermissions(),
    backendMenus: parseBackendMenus(),
  }
}

function setAuthSession(session: Partial<AuthSession>) {
  const current = getAuthSession()

  const next: AuthSession = {
    accessToken: session.accessToken || current?.accessToken || '',
    refreshToken: session.refreshToken || current?.refreshToken || '',
    tokenType: session.tokenType || current?.tokenType || 'Bearer',
    userId: session.userId || current?.userId || '',
    username: session.username || current?.username || '',
    email: session.email || current?.email || '',
    role: session.role || current?.role,
    backendRoles: session.backendRoles || current?.backendRoles || [],
    backendPermissions:
      session.backendPermissions || current?.backendPermissions || [],
    backendMenus: session.backendMenus || current?.backendMenus || [],
  }

  if (!next.accessToken || !next.refreshToken) {
    clearAuthSession()
    return
  }

  setLocalStorageValue(storageKeys.isLoggedIn, 'true')
  setLocalStorageValue(storageKeys.accessToken, next.accessToken)
  setLocalStorageValue(storageKeys.refreshToken, next.refreshToken)
  setLocalStorageValue(storageKeys.tokenType, next.tokenType)
  setLocalStorageValue(storageKeys.userId, next.userId)
  setLocalStorageValue(storageKeys.username, next.username)
  setLocalStorageValue(storageKeys.backendRoles, JSON.stringify(next.backendRoles))
  setLocalStorageValue(
    storageKeys.backendPermissions,
    JSON.stringify(next.backendPermissions),
  )
  setLocalStorageValue(storageKeys.backendMenus, JSON.stringify(next.backendMenus))

  if (next.role) {
    setLocalStorageValue(storageKeys.role, next.role)
  }

  if (next.userId || next.username || next.email) {
    setLocalStorageValue(
      storageKeys.user,
      JSON.stringify({
        id: next.userId,
        username: next.username,
        email: next.email,
      }),
    )
  }
}

function clearAuthSession() {
  removeLocalStorageValue(storageKeys.isLoggedIn)
  removeLocalStorageValue(storageKeys.accessToken)
  removeLocalStorageValue(storageKeys.refreshToken)
  removeLocalStorageValue(storageKeys.tokenType)
  removeLocalStorageValue(storageKeys.username)
  removeLocalStorageValue(storageKeys.userId)
  removeLocalStorageValue(storageKeys.user)
  removeLocalStorageValue(storageKeys.role)
  removeLocalStorageValue(storageKeys.backendRoles)
  removeLocalStorageValue(storageKeys.backendPermissions)
  removeLocalStorageValue(storageKeys.backendMenus)
}

function isAuthenticated() {
  return Boolean(getLocalStorageValue(storageKeys.accessToken))
}

function shouldSkipRefresh(url?: string) {
  if (!url) {
    return false
  }

  return (
    url.includes(endpoints.auth.login) ||
    url.includes(endpoints.auth.refreshToken) ||
    url.includes(endpoints.auth.register) ||
    url.includes(endpoints.auth.forgotPassword) ||
    url.includes(endpoints.auth.otpForgotPassword) ||
    url.includes(endpoints.auth.changePassword) ||
    url.includes(endpoints.auth.otpChangePassword)
  )
}

async function requestRefreshToken(
  refreshToken: string,
): Promise<RefreshTokenPayload | null> {
  try {
    const response = await axios.post<
      ApiResponseEnvelope<RefreshTokenPayload>
    >(`${BASE_URL}${endpoints.auth.refreshToken}`, {
      refreshToken,
    })

    return response.data.data
  } catch {
    return null
  }
}

async function refreshSessionToken(): Promise<boolean> {
  const refreshToken = getAuthSession()?.refreshToken
  if (!refreshToken) {
    return false
  }

  const payload = await requestRefreshToken(refreshToken)
  if (!payload?.accessToken || !payload.refreshToken) {
    clearAuthSession()
    return false
  }

  setAuthSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    tokenType: payload.tokenType,
  })

  return true
}

let refreshPromise: Promise<string | null> | null = null

function createApiInstance(accessToken?: string) {
  const instance = axios.create({
    baseURL: BASE_URL,
  })

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    beginApiLoading(config)

    const token = accessToken || getAuthSession()?.accessToken

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (!config.headers['X-Correlation-Id']) {
      config.headers['X-Correlation-Id'] = createCorrelationId()
    }

    return config
  })

  instance.interceptors.response.use(
    (response) => {
      endApiLoading(response.config)
      return response
    },
    async (error: AxiosError<ApiResponseEnvelope<unknown>>) => {
      const originalRequest = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined

      endApiLoading(originalRequest)

      const status = error.response?.status
      const canRefresh =
        status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !shouldSkipRefresh(originalRequest.url)

      if (canRefresh) {
        originalRequest._retry = true

        const refreshToken = getAuthSession()?.refreshToken

        if (!refreshToken) {
          clearAuthSession()
          return Promise.reject(error)
        }

        if (!refreshPromise) {
          refreshPromise = requestRefreshToken(refreshToken).then((payload) => {
            if (!payload?.accessToken || !payload.refreshToken) {
              clearAuthSession()
              return null
            }

            setAuthSession({
              accessToken: payload.accessToken,
              refreshToken: payload.refreshToken,
              tokenType: payload.tokenType,
            })

            return payload.accessToken
          })
        }

        const newAccessToken = await refreshPromise
        refreshPromise = null

        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return instance(originalRequest)
        }
      }

      return Promise.reject(error)
    },
  )

  return instance
}

const sharedApi = createApiInstance()

const apis = (accessToken?: string) => {
  if (!accessToken) {
    return sharedApi
  }

  return createApiInstance(accessToken)
}

function extractApiData<T>(response: AxiosResponse<ApiResponseEnvelope<T>>): T {
  return response.data.data
}

function extractApiMessage<T>(
  response: AxiosResponse<ApiResponseEnvelope<T>>,
): string {
  return response.data.message || ''
}

function extractApiErrorMessage(
  error: unknown,
  fallback = 'Request failed. Please try again.',
): string {
  const typedError = error as AxiosError<ApiResponseEnvelope<unknown>>

  const firstValidationError = typedError.response?.data?.errors?.[0]
  if (firstValidationError?.message) {
    return firstValidationError.message
  }

  if (typedError.response?.data?.message) {
    return typedError.response.data.message
  }

  if (typedError.message) {
    return typedError.message
  }

  return fallback
}

export {
  API_LOADING_EVENT,
  apis,
  BASE_URL,
  clearAuthSession,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  extractApiMessage,
  getAuthSession,
  isAuthenticated,
  refreshSessionToken,
  setAuthSession,
}

export type {
  ApiLoadingEventDetail,
  ApiResponseEnvelope,
  AuthSession,
  BackendMenuItem,
  ValidationError,
}
