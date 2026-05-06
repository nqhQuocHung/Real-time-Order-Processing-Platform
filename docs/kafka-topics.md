# Real-time Order Processing Platform - Kafka Topics

## 1. Muc tieu

Tai lieu nay dinh nghia convention ve topic, event contract va consumer strategy de:

- Giam coupling giua cac service.
- Tang kha nang retry/phuc hoi.
- Truy vet duoc event end-to-end.

## 2. Naming Convention

Format de xuat:

`<domain>.<entity>.<event>.v1`

Vi du:

- `order.lifecycle.created.v1`
- `inventory.reservation.succeeded.v1`
- `payment.transaction.failed.v1`

## 3. Initial Topics (Week 1 Baseline)

| Topic | Producer | Consumer | Muc dich |
| --- | --- | --- | --- |
| `order.lifecycle.created.v1` | `order-service` | `inventory-service` | Bat dau xu ly don |
| `inventory.reservation.succeeded.v1` | `inventory-service` | `order-service` | Xac nhan da giu hang |
| `inventory.reservation.failed.v1` | `inventory-service` | `order-service` | Bao het hang/loi reserve |
| `payment.transaction.succeeded.v1` | `payment-service` | `order-service`, `notification-service` | Thanh toan thanh cong |
| `payment.transaction.failed.v1` | `payment-service` | `order-service`, `notification-service` | Thanh toan that bai |
| `order.lifecycle.completed.v1` | `order-service` | `notification-service` | Don hoan tat |
| `order.lifecycle.failed.v1` | `order-service` | `notification-service` | Don that bai |

## 4. Partition/Replication (local)

- `partitions`: `3` cho cac topic business chinh.
- `replication.factor`: `1` (local dev).
- `min.insync.replicas`: `1` (local).

Trong production, tang replication va min ISR theo SLA.

## 5. Message Key Strategy

- Event lien quan 1 don hang dung key la `orderId`.
- Muc dich: dam bao ordering theo tung don trong cung partition.
- Event khong can ordering chat che co the dung key ngau nhien.

## 6. Event Envelope (JSON)

```json
{
  "eventId": "0e2c37f2-c18d-4f16-8bd8-2cf18edcab93",
  "eventType": "OrderCreated",
  "eventVersion": "v1",
  "occurredAt": "2026-05-06T04:30:00Z",
  "source": "order-service",
  "correlationId": "req-2e5de8d7b6d74893",
  "payload": {
    "orderId": "ORD-20260506-0001",
    "userId": "U-1001",
    "totalAmount": 249000,
    "currency": "VND"
  }
}
```

## 7. Error Handling

- Retry topic (optional): `*.retry.v1`.
- Dead-letter topic: `*.dlq.v1`.
- Consumer phai idempotent theo `eventId` hoac business key.
- Loi tam thoi: retry co backoff.
- Loi business khong retry: route thang ve DLQ hoac publish event failed.

## 8. Consumer Group Rules

- Moi service chuc nang la 1 consumer group rieng.
- Vi du:
  - `inventory-reservation-consumer`
  - `order-lifecycle-consumer`
  - `notification-consumer`
- Khong dung chung group giua service khac domain neu business khac nhau.
