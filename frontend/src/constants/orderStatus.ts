export const ORDER_STATUSES = [
  'CREATED',
  'RESERVED',
  'PAID',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_FILTER_OPTIONS = [
  '',
  ...ORDER_STATUSES,
] as const

export const ORDER_REFUND_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'REFUNDED',
  'FAILED',
] as const

export type OrderRefundStatus = (typeof ORDER_REFUND_STATUSES)[number]

export const ORDER_REFUND_STATUS_FILTER_OPTIONS = [
  '',
  ...ORDER_REFUND_STATUSES,
] as const

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
