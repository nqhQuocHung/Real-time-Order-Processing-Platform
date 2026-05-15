# Real-time Order Processing Platform - Key Flows

## 1. Muc tieu

Tai lieu nay tap trung vao cac luong nghiep vu quan trong va noi bat nhat cua he thong, theo implementation hien tai.

## 2. Flow 1 - Tao don hang va khoi tao thanh toan

Phat sinh tu:

- `POST /api/v1/orders` (qua gateway)

Trinh tu:

1. `order-service` validate request va `Idempotency-Key`.
2. Tao order state `CREATED`, ghi status history.
3. Publish event `order.lifecycle.created.v1`.
4. Goi internal RPC sang `inventory-service` de `reserve`.
5. Neu reserve thanh cong -> chuyen order sang `RESERVED`.
6. Goi internal RPC sang `payment-service` de tao payment intent.
7. Luu `paymentUrl` + `paymentDeadlineAt` cho order.
8. Tra response cho client.

Neu reserve/payment intent loi:

- Thu release inventory (neu can), chuyen order sang `FAILED`, publish `order.lifecycle.failed.v1`.

## 3. Flow 2 - Xac nhan thanh toan thanh cong

Phat sinh tu:

- `POST /api/v1/payments/confirm` (public) hoac `/internal/v1/payments/confirm`

Trinh tu:

1. `payment-service` lock idempotency (Redis) theo `orderCode` + action.
2. Update payment transaction (`SUCCESS` voi VNPAY trong demo).
3. Publish `payment.transaction.succeeded.v1`.
4. `order-service` consume event, goi `confirmPayment(orderCode)`.
5. `order-service` confirm deduct inventory.
6. `order-service` chuyen order sang `PAID`, publish `order.lifecycle.paid.v1`.
7. `notification-service` consume payment/order events de:
   - ghi notification log
   - push SSE realtime cho customer + partner owner lien quan.

Luu y:

- `COMPLETED` duoc xac nhan boi shipping flow (`/orders/{orderCode}/shipping-confirm`), khong auto ngay sau payment.

## 4. Flow 3 - Thanh toan that bai hoac timeout

### 4.1 Payment fail event

1. `payment-service` publish `payment.transaction.failed.v1`.
2. `order-service` consume event, neu order dang `RESERVED` thi release inventory.
3. Order chuyen `FAILED`, publish `order.lifecycle.failed.v1`.
4. `notification-service` log va push realtime.

### 4.2 Payment timeout scheduler

1. Job trong `order-service` quet order `RESERVED` qua `paymentDeadlineAt`.
2. Tu dong release inventory.
3. Chuyen `FAILED` voi action `PAYMENT_TIMEOUT`.
4. Publish `order.lifecycle.failed.v1`.

## 5. Flow 4 - Partner upgrade request realtime

Phat sinh tu:

- `POST /api/v1/auth/partner-requests`
- `PATCH /api/v1/auth/partner-requests/{requestId}/decision`

Trinh tu:

1. `auth-service` tao/phe duyet request va publish:
   - `partner.request.created.v1`
   - `partner.request.decided.v1`
2. `notification-service` consume:
   - event `created` -> push cho admin (`sendToAdmins`)
   - event `decided` -> push cho user yeu cau (`sendToUser`)
3. Frontend nhan su kien qua SSE stream.

## 6. Flow 5 - Fanout realtime cho doi tac theo don hang

Khi `notification-service` nhan order/payment event:

1. Parse `orderCode` tu event payload.
2. Goi `order-service` internal endpoint lay danh sach `productIds` trong don.
3. Goi `inventory-service` internal endpoint lookup owner cua cac san pham.
4. Hop nhat recipient:
   - customer/user trong payload
   - partner owner theo `shopId`
5. Push SSE event toi tung recipient.

## 7. Sequence tong hop (order -> payment -> notification)

```mermaid
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant O as Order Service
    participant I as Inventory Service
    participant P as Payment Service
    participant K as Kafka
    participant N as Notification Service

    C->>G: POST /api/v1/orders
    G->>O: Forward request
    O->>I: /internal/v1/inventories/reserve
    I-->>O: Reserved
    O->>P: /internal/v1/payments/intents
    P-->>O: paymentUrl + PENDING
    O-->>C: orderCode + paymentDeadlineAt

    C->>G: POST /api/v1/payments/confirm
    G->>P: Confirm payment
    P->>K: payment.transaction.succeeded.v1
    K->>O: consume payment success
    O->>I: /internal/v1/inventories/confirm-deduct
    O->>K: order.lifecycle.paid.v1
    K->>N: consume payment/order events
    N-->>C: SSE realtime update
```
