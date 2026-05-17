# Realtime Integration Report (2026-05-07)

## 1) Muc tieu dot nay

Tai thoi diem 2026-05-07, da apply thuc te cac thanh phan:

- Realtime/event-driven: Kafka publish + consume theo order/payment lifecycle.
- RPC noi bo: order-service goi inventory-service + payment-service theo kieu request/response.
- Redis: idempotency guard cho payment actions, cache ton kho inventory.
- HTTP/2 readiness: bat `server.http2.enabled=true` cho gateway + cac service backend.

Muc tieu la co duoc 1 workflow MVP chay end-to-end voi local infra.

## 2) Nhung thay doi da trien khai

## 2.1 Order service (orchestration + event publish)

File chinh:

- `services/order-service/src/main/java/com/nqh/orderservice/services/impl/OrderServiceImpl.java`
- `services/order-service/src/main/resources/application.properties`

Da them workflow tu dong trong `createOrder`:

1. Tao order (`CREATED`) + ghi history.
2. Publish Kafka event `order.lifecycle.created.v1`.
3. RPC reserve ton kho sang inventory internal API.
4. Chuyen state `RESERVED`.
5. RPC tao payment intent + confirm payment sang payment internal API.
6. Neu payment SUCCESS -> chuyen `PAID`.
7. RPC confirm deduct ton kho.
8. Chuyen `COMPLETED`.

Nhanh fallback:

- Neu reserve/payment/commit that bai -> rollback inventory (neu co the), chuyen `FAILED`, publish `order.lifecycle.failed.v1`.
- Khi don `COMPLETED` -> publish `order.lifecycle.completed.v1`.

Luu y state machine:

- Da mo rong transition `PAID -> FAILED` de cho phep compensation khi buoc commit inventory bi loi sau khi payment da thanh cong.

## 2.2 Payment service (Kafka + Redis idempotency + internal RPC endpoint)

File chinh:

- `services/payment-service/src/main/java/com/nqh/paymentservice/services/impl/PaymentServiceImpl.java`
- `services/payment-service/src/main/java/com/nqh/paymentservice/controllers/InternalPaymentController.java`
- `services/payment-service/src/main/java/com/nqh/paymentservice/configurations/SecurityConfig.java`
- `services/payment-service/src/main/resources/application.properties`
- `services/payment-service/pom.xml`

Da bo sung:

- Redis lock idempotency cho `confirmPayment` va `failPayment`:
  - Key pattern: `payment:idempotency:<action>:<orderCode>:<idempotencyKey|default>`
  - TTL mac dinh: `300s`
- Kafka producer cho:
  - `payment.transaction.succeeded.v1`
  - `payment.transaction.failed.v1`
- Internal RPC endpoints:
  - `POST /internal/v1/payments/intents`
  - `POST /internal/v1/payments/confirm`
  - `POST /internal/v1/payments/fail`
- Bao ve internal endpoints bang header token:
  - `X-Internal-Token`
  - Validate voi `app.internal.token`

## 2.3 Inventory service (Redis cache + internal RPC endpoint)

File chinh:

- `services/inventory-service/src/main/java/com/nqh/inventoryservice/services/impl/InventoryServiceImpl.java`
- `services/inventory-service/src/main/java/com/nqh/inventoryservice/controllers/InternalInventoryController.java`
- `services/inventory-service/src/main/java/com/nqh/inventoryservice/InventoryServiceApplication.java`
- `services/inventory-service/src/main/java/com/nqh/inventoryservice/configurations/SecurityConfig.java`
- `services/inventory-service/src/main/resources/application.properties`

Da bo sung:

- Redis cache:
  - `@Cacheable` cho `getStock`
  - `@CacheEvict` cho cac operation mutate (`reserve/release/confirm-deduct/adjust`)
- Bat `@EnableCaching`.
- Internal RPC endpoints:
  - `POST /internal/v1/inventories/reserve`
  - `POST /internal/v1/inventories/release`
  - `POST /internal/v1/inventories/confirm-deduct`
- Bao ve bang `X-Internal-Token` (giong payment-service).

## 2.4 Gateway/Auth/Notification (HTTP/2 readiness)

Da bat:

- `server.http2.enabled=true` cho:
  - `api-gateway`
  - `auth-service`
  - `notification-service`
  - `order-service`
  - `inventory-service`
  - `payment-service`

Luu y:

- Local non-TLS co the fallback HTTP/1.1 tuy runtime client/server da duoc dat san readiness cho HTTP/2.

## 3) Event contracts dang duoc su dung thuc te

## 3.1 Order events (producer: order-service)

- `order.lifecycle.created.v1`
- `order.lifecycle.completed.v1`
- `order.lifecycle.failed.v1`

Payload chinh:

- `orderId`, `orderUuid`, `orderCode`, `customerId`, `status`, `totalAmount`, `currency`, `createdAt`, `updatedAt`

## 3.2 Payment events (producer: payment-service)

- `payment.transaction.succeeded.v1`
- `payment.transaction.failed.v1`

Payload chinh:

- `paymentId`, `paymentUuid`, `orderCode`, `status`, `method`, `amount`, `currency`, `providerTransactionId`, `actor`, `note`

## 3.3 Notification consume

notification-service da consume 4 topic:

- `payment.transaction.succeeded.v1`
- `payment.transaction.failed.v1`
- `order.lifecycle.completed.v1`
- `order.lifecycle.failed.v1`

## 4) Cau hinh moi can luu y

## 4.1 Bien moi cho internal RPC

- `INTERNAL_RPC_TOKEN` (phai giong nhau giua order/inventory/payment)
- `INVENTORY_SERVICE_INTERNAL_URL` (default `http://localhost:8083`)
- `PAYMENT_SERVICE_INTERNAL_URL` (default `http://localhost:8084`)

## 4.2 Bien moi cho Kafka

- `KAFKA_BOOTSTRAP_SERVERS` (default `localhost:9092`)
- Topic defaults:
  - `TOPIC_ORDER_CREATED`
  - `TOPIC_ORDER_COMPLETED`
  - `TOPIC_ORDER_FAILED`
  - `TOPIC_PAYMENT_SUCCEEDED`
  - `TOPIC_PAYMENT_FAILED`

## 4.3 Bien moi cho Redis

- `REDIS_HOST` (default `localhost`)
- `REDIS_PORT` (default `6379`)
- `REDIS_PASSWORD` (default rong)
- `PAYMENT_IDEMPOTENCY_TTL_SECONDS` (default `300`)
- `INVENTORY_CACHE_TTL` (default `PT5M`)

## 5) Cach test E2E nhanh

## 5.1 Chay infra

Tu thu muc `infra`:

```bash
docker compose up -d
```

Kiem tra:

- PostgreSQL, Redis, Kafka, Kafka UI phai `Up`
- kafka topics da duoc tao boi `kafka-init`

## 5.2 Chay services

Lan luot chay:

- auth (8081)
- order (8082)
- inventory (8083)
- payment (8084)
- notification (8085)
- gateway (8080)

## 5.3 Tao order qua gateway

Goi:

- `POST /api/v1/orders` qua gateway (`8080`)
- Header:
  - `Authorization: Bearer <jwt>`
  - `Idempotency-Key: <unique>`

Ky vong:

- Order duoc tao va tu dong di qua workflow reserve/payment/commit.
- Trang thai tra ve co the la `COMPLETED` (happy path) hoac `FAILED` (neu loi business/dependency).

## 5.4 Verify realtime

- Mo Kafka UI: `http://localhost:8088`
- Quan sat messages trong cac topic order/payment.
- Goi notification list endpoint va xac nhan notification logs duoc tao tu event consume.

## 6) Ket qua verify trong dot nay

Da verify compile thanh cong (`-DskipTests`) cho:

- `order-service`
- `payment-service`
- `inventory-service`

## 7) Gioi han hien tai (can tiep tuc)

- Chua co outbox pattern -> van co kha nang lech du lieu neu crash giua DB commit va publish/send RPC.
- Chua co retry + DLQ handler trong application layer (topic da co convention).
- Chua co contract test + integration test automation cho workflow moi.
- HTTP/2 local chu yeu readiness; neu muon enforce thuc te can setup TLS/ingress phu hop.
- RPC hien tai la internal HTTP API (request/response). Neu muon chuyen full gRPC can them proto + stub + rollout migration plan.

## 8) De xuat sprint tiep theo

1. Them integration tests theo luong:
   - create order -> reserved -> paid -> completed
   - reserve fail -> failed
   - payment fail -> release -> failed
2. Them retry policy + DLQ processor cho payment/order events.
3. Ap dung outbox pattern cho order/payment publish event.
4. Bo sung dashboard observability:
   - correlation-id trace
   - kafka lag/consumer health
   - redis cache hit/miss metrics.
