# Real-time Order Processing Platform - Kafka Topics

## 1. Muc tieu

Tai lieu nay mo ta cac Kafka topics dang duoc su dung trong he thong, producer/consumer va contract event co ban.

## 2. Naming convention

Format:

`<domain>.<entity>.<event>.v1`

Vi du:

- `order.lifecycle.created.v1`
- `payment.transaction.succeeded.v1`
- `partner.request.decided.v1`

## 3. Topics dang su dung thuc te

| Topic | Producer | Consumer | Muc dich |
| --- | --- | --- | --- |
| `order.lifecycle.created.v1` | `order-service` | (monitoring/future consumers) | Don moi duoc tao |
| `order.lifecycle.paid.v1` | `order-service` | `notification-service` | Don da thanh toan |
| `order.lifecycle.completed.v1` | `order-service` | `notification-service` | Don hoan tat |
| `order.lifecycle.failed.v1` | `order-service` | `notification-service` | Don that bai |
| `order.refund.requested.v1` | `order-service` | `notification-service` | Khach hang gui yeu cau hoan tien |
| `order.refund.approved.v1` | `order-service` | `notification-service` | Seller chap nhan yeu cau hoan tien |
| `order.refund.rejected.v1` | `order-service` | `notification-service` | Seller tu choi yeu cau hoan tien |
| `order.refund.completed.v1` | `order-service` | `notification-service` | Luong refund hoan tat o order domain |
| `order.refund.failed.v1` | `order-service` | `notification-service` | Luong refund that bai o order domain |
| `payment.transaction.succeeded.v1` | `payment-service` | `order-service`, `notification-service` | Thanh toan thanh cong |
| `payment.transaction.failed.v1` | `payment-service` | `order-service`, `notification-service` | Thanh toan that bai |
| `payment.refund.succeeded.v1` | `payment-service` | `notification-service` | VNPay refund thanh cong |
| `payment.refund.failed.v1` | `payment-service` | `notification-service` | VNPay refund that bai |
| `partner.request.created.v1` | `auth-service` | `notification-service` | Co yeu cau nang cap partner moi |
| `partner.request.decided.v1` | `auth-service` | `notification-service` | Ket qua phe duyet tu admin |
| `product.review.created.v1` | `inventory-service` | `notification-service` | Review moi duoc tao |
| `product.review.updated.v1` | `inventory-service` | `notification-service` | Review duoc cap nhat |
| `product.review.comment.created.v1` | `inventory-service` | `notification-service` | Comment moi tren review |

## 4. Message key strategy

- Order/payment topics dung key theo `orderCode` de giu thu tu theo tung don.
- Refund topics cung dung key theo `orderCode` de bo sung timeline su kien theo tung don.
- Partner request:
  - created event key theo `requestId`
  - decided event key theo `userId`
- Product review topics dung key theo `productId` de cap nhat realtime theo tung san pham.

## 5. Event envelope (order/payment domains)

Order va payment su dung envelope JSON co cau truc:

```json
{
  "eventId": "uuid",
  "eventType": "OrderPaid | PaymentTransactionSucceeded | ...",
  "eventVersion": "v1",
  "occurredAt": "2026-05-15T10:30:00",
  "source": "order-service | payment-service",
  "correlationId": "orderCode",
  "payload": {}
}
```

Partner request event hien publish dang DTO event truc tiep (co `eventId`, `eventType`, `occurredAt`, `requestId`, `userId`, ...).

## 6. Consumer groups

- `order-service`: `${ORDER_CONSUMER_GROUP:order-consumer}`
- `notification-service`: `${NOTIFICATION_CONSUMER_GROUP:notification-consumer}`

Moi service co group rieng de doc doc lap cung mot topic.

## 7. Reliability notes

- Payment action co idempotency lock truoc khi publish event.
- Order/payment consumer co xu ly skip voi mot so state conflict/not-found.
- Chat message realtime (`chat.message.created`) hien duoc push truc tiep qua SSE trong `notification-service`, khong dung Kafka topic rieng.
- Khuyen nghi cho sprint tiep:
  - bo sung retry strategy co backoff
  - bo sung DLQ processor cho cac event loi khong phuc hoi.
