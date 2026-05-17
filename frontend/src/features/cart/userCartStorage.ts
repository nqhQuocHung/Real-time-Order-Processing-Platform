export type UserCartItem = {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  currency: string
  maxAvailable: number
  categoryId?: string
  categoryName?: string
  shopName?: string
  imageUrl?: string
}

export type UserCartMap = Record<string, UserCartItem>

const USER_CART_STORAGE_KEY = 'user-product-cart-v2'

function normalizeText(value?: string | null): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function normalizeInteger(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value as number)) {
    return fallback
  }
  return Math.max(0, Math.floor(Number(value)))
}

function normalizePrice(value: unknown): number {
  if (!Number.isFinite(value as number)) {
    return 0
  }
  const normalized = Number(value)
  if (normalized <= 0) {
    return 0
  }
  return Number(normalized.toFixed(2))
}

export function parseCartStorage(raw: string): UserCartMap {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const result: UserCartMap = {}
    for (const [productId, rawItem] of Object.entries(parsed as Record<string, unknown>)) {
      if (!rawItem || typeof rawItem !== 'object') {
        continue
      }

      const cartItem = rawItem as Partial<UserCartItem>
      const quantity = Math.max(1, normalizeInteger(cartItem.quantity, 1))
      const maxAvailable = Math.max(0, normalizeInteger(cartItem.maxAvailable, 0))
      const unitPrice = normalizePrice(cartItem.unitPrice)
      result[productId] = {
        productId,
        productName: normalizeText(cartItem.productName) || productId,
        quantity,
        unitPrice,
        currency: normalizeText(cartItem.currency) || 'VND',
        maxAvailable,
        categoryId: normalizeText(cartItem.categoryId),
        categoryName: normalizeText(cartItem.categoryName),
        shopName: normalizeText(cartItem.shopName),
        imageUrl: normalizeText(cartItem.imageUrl),
      }
    }
    return result
  } catch {
    return {}
  }
}

export function readUserCartFromStorage(): UserCartMap {
  if (typeof window === 'undefined') {
    return {}
  }
  return parseCartStorage(window.localStorage.getItem(USER_CART_STORAGE_KEY) || '')
}

export function writeUserCartToStorage(cart: UserCartMap) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(USER_CART_STORAGE_KEY, JSON.stringify(cart))
}

export function clearUserCartStorage() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(USER_CART_STORAGE_KEY)
}
