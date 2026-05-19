# Real-time Order Processing Platform - System Functions

## 1. Tong quan chuc nang theo domain

He thong duoc chia theo 6 nhom chuc nang chinh:

1. Identity + RBAC (`auth-service`)
2. Quan ly san pham/ton kho (`inventory-service`)
3. Xu ly don hang (`order-service`)
4. Thanh toan (`payment-service`)
5. Notification + realtime stream (`notification-service`)
6. Unified entrypoint (`api-gateway`)

## 2. Auth va RBAC (`auth-service`)

Chuc nang:

- Dang ky, dang nhap, refresh token.
- Doi mat khau / quen mat khau qua OTP.
- Tra profile hien tai (`/me`) gom roles, permissions, menus.
- Quan tri user (list, summary, update, activate/deactivate/lock, upload avatar).
- Quan tri role/menu/permission.
- Quan ly yeu cau nang cap partner va phe duyet.

Endpoint tieu bieu:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/users`
- `POST /api/v1/auth/roles`
- `POST /api/v1/auth/menus`
- `POST /api/v1/auth/partner-requests`
- `PATCH /api/v1/auth/partner-requests/{requestId}/decision`

## 3. Catalog va inventory (`inventory-service`)

Chuc nang:

- Quan ly catalog san pham (`catalog`, `my-products`).
- CRUD san pham doi tac (JSON hoac multipart co image upload).
- CRUD danh muc san pham (admin).
- Danh gia san pham (rating 1-5 sao), cap nhat review cua chinh user.
- Comment theo tung review, tra ve kem username (khong chi userId).
- Publish su kien review/comment de notification-service push realtime.
- Kiem tra ton kho, reserve, release, confirm deduct, adjust ton.
- Tra summary ton kho.
- Internal lookup owner theo danh sach product de fanout realtime.

Endpoint tieu bieu:

- `GET /api/v1/inventories/catalog`
- `GET /api/v1/inventories/my-products`
- `POST /api/v1/inventories/products`
- `PUT /api/v1/inventories/products/{productId}`
- `POST /api/v1/inventories/check`
- `POST /api/v1/inventories/reserve`
- `POST /api/v1/inventories/release`
- `POST /api/v1/inventories/confirm-deduct`
- `POST /internal/v1/inventories/product-owners`
- `GET /api/v1/inventories/products/{productId}/reviews`
- `GET /api/v1/inventories/products/{productId}/review-stats`
- `POST /api/v1/inventories/products/{productId}/reviews`
- `PUT /api/v1/inventories/reviews/{reviewId}`
- `POST /api/v1/inventories/reviews/{reviewId}/comments`

## 4. Order management (`order-service`)

Chuc nang:

- Tao don hang co `Idempotency-Key`.
- Quan ly state machine don: `CREATED -> RESERVED -> PAID -> COMPLETED` hoac `FAILED/CANCELLED`.
- Query chi tiet, danh sach, timeline.
- Action don hang: cancel, manual status update, payment confirm/fail, shipping confirm.
- Workflow tu dong khi tao don:
  - reserve inventory
  - tao payment intent
  - dat payment deadline
- Scheduler auto fail/release neu qua han thanh toan.
- Consume payment events de dong bo trang thai don.

Endpoint tieu bieu:

- `POST /api/v1/orders`
- `GET /api/v1/orders/{orderCode}`
- `GET /api/v1/orders`
- `POST /api/v1/orders/{orderCode}/cancel`
- `POST /api/v1/orders/{orderCode}/payment-confirm`
- `POST /api/v1/orders/{orderCode}/payment-fail`
- `POST /api/v1/orders/{orderCode}/shipping-confirm`
- `GET /api/v1/orders/{orderCode}/timeline`
- `GET /internal/v1/orders/{orderCode}/products`

## 5. Payment (`payment-service`)

Chuc nang:

- Tao payment intent theo method (co ho tro VNPAY URL trong demo).
- Query giao dich theo `orderCode`.
- Confirm/fail thanh toan voi idempotency lock bang Redis.
- Publish payment success/fail event len Kafka.
- Kiem tra quyen mutate payment (owner hoac elevated permissions).

Endpoint tieu bieu:

- `POST /api/v1/payments/intents`
- `GET /api/v1/payments/{orderCode}`
- `POST /api/v1/payments/confirm`
- `POST /api/v1/payments/fail`
- `POST /internal/v1/payments/intents`
- `POST /internal/v1/payments/confirm`
- `POST /internal/v1/payments/fail`

## 6. Notification va realtime (`notification-service`)

Chuc nang:

- CRUD notification log.
- Consume payment/order events va ghi log tu event.
- Consume partner request events.
- Consume product review events (`created`, `updated`, `comment.created`) va fanout theo recipient target.
- Cung cap message hub cho chat 1-1 giua user va partner (conversation + message + mark read).
- Day realtime qua SSE:
  - gui cho customer theo `customerId/userId`
  - gui cho partner owner qua resolver (order -> productIds -> shopIds)
  - gui cho admin khi co partner request event
  - gui realtime chat event (`chat.message.created`) cho ca sender va recipient

Endpoint tieu bieu:

- `POST /api/v1/notifications`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notificationCode}/status`
- `GET /api/v1/notifications/stream` (SSE)
- `POST /api/v1/messages/conversations/open`
- `GET /api/v1/messages/conversations`
- `GET /api/v1/messages/conversations/{conversationId}/messages`
- `POST /api/v1/messages/conversations/{conversationId}/messages`
- `PATCH /api/v1/messages/conversations/{conversationId}/read`

## 7. API gateway (`api-gateway`)

Chuc nang:

- Route theo domain path:
  - `/api/v1/auth/**`
  - `/api/v1/orders/**`
  - `/api/v1/inventories/**`
  - `/api/v1/payments/**`
  - `/api/v1/notifications/**`
  - `/api/v1/messages/**`
- Expose health route tong hop cho downstream actuator health.

## 8. Chuc nang cross-cutting

- Correlation/trace theo response envelope.
- HTTP/2 readiness tren tat ca backend services.
- Event-driven propagation qua Kafka cho order/payment/partner domains.
- Event-driven propagation qua Kafka cho review/comment domains.
- Internal token gate cho service-to-service endpoints.

## 9. Frontend capabilities moi (cap nhat 2026-05)

- Product detail:
  - Chi hien 1 nut mo khu vuc danh gia (`Show Ratings & Comments`), khong render san danh sach comment khi chua mo.
  - Review composer va comment composer tach popup rieng.
  - Rating picker 5 sao theo kieu click-to-highlight.
- Product card:
  - Hien thi rating summary ngay tren card.
  - Nut `Message Shop` trigger mo hoi thoai chat truc tiep (uu tien mo lai conversation cu, neu chua co thi tao moi).
  - Frontend cho phep tat ca tai khoan dang nhap trigger event mo chat; backend hien tai chi ho tro mo conversation moi cho USER/PARTNER.
- Message center:
  - Dropdown danh sach conversation + thread widget rieng.
  - Responsive mobile cho danh sach bell/message va chat box.
  - Avatar doi phuong duoc resolve tu profile cong khai.
- Admin reports:
  - Co chuc nang `Xuat bao cao PDF` (mo print window de Save as PDF).
- Admin access management:
  - Ho tro tim tab/page theo `label`, `key` hoac `path` (name/URL keyword search).
- Order page:
  - Chuan hoa luong thanh toan: tao payment xong mo popup thanh toan ngay, neu dong popup thi dung `Continue payment` trong record den khi het han.
