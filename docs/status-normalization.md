# Status Normalization Matrix

Updated on: 2026-05-21

## 1. Order domain (`order-service`)

### Order status (`OrderStatusEnum`)
- `CREATED`
- `RESERVED`
- `PAID`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### Allowed transitions
- `CREATED` -> `RESERVED`, `PAID`, `FAILED`, `CANCELLED`
- `RESERVED` -> `PAID`, `FAILED`, `CANCELLED`
- `PAID` -> `COMPLETED`, `FAILED`
- `COMPLETED` -> terminal
- `FAILED` -> terminal
- `CANCELLED` -> terminal

### Refund status (`OrderRefundStatusEnum`)
- `REQUESTED`
- `APPROVED`
- `REJECTED`
- `REFUNDED`
- `FAILED`

## 2. Payment domain (`payment-service`)

### Payment transaction status (`PaymentStatusEnum`)
- `PENDING`
- `SUCCESS`
- `FAILED`

`CANCELLED` has been removed from active domain model because no production flow sets it.

### Refund status (`PaymentRefundStatusEnum`)
- `REQUESTED`
- `REFUNDED`
- `FAILED`

## 3. Inventory reservation domain (`inventory-service`)

### Reservation status (`InventoryReservationStatusEnum`)
- `RESERVED`
- `RELEASED`
- `COMMITTED`

## 4. Notification domain (`notification-service`)

### Notification log status (`NotificationStatusEnum`)
- `PENDING`
- `SENT`
- `FAILED`
- `CANCELLED`

## 5. Frontend status source of truth

For order/payment/refund screens, status options are centralized in:

- `frontend/src/constants/orderStatus.ts`

This avoids per-page drift between user and partner order views.
