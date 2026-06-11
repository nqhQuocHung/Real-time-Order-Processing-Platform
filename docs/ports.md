# Real-time Order Processing Platform - Ports

## 1. Nguyen tac dat port

- Port service duoc co dinh trong local dev de de debug.
- Khong trung voi port infra.
- Neu scale local bang nhieu instance, map qua port host khac.

## 2. Application Ports (Host)

| Service | Port | Ghi chu |
| --- | --- | --- |
| `api-gateway` | `8080` | Entry point cho client |
| `auth-service` | `8081` | Auth APIs |
| `order-service` | `8082` | Order APIs |
| `inventory-service` | `8083` | Inventory REST/internal JSON RPC |
| `payment-service` | `8084` | Payment REST/internal JSON RPC |
| `notification-service` | `8085` | Notification worker/REST API |

## 3. Infra Ports (Host)

| Component | Port | Ghi chu |
| --- | --- | --- |
| PostgreSQL | `5432` | Main relational store |
| Redis | `6379` | Cache/idempotency/rate-limit |
| Kafka Broker (external) | `9092` | Client trong may local connect vao |
| Kafka Broker (internal) | `29092` | Service trong Docker network dung |
| Kafka UI (optional) | `8088` | Quan sat topic/consumer |

## 4. gRPC Ports (internal)

| Service | gRPC Port | Trang thai |
| --- | --- | --- |
| `notification-service` | `9095` | Dang dung cho `NotificationStreamService/Subscribe` (server-streaming HTTP/2) |
| `inventory-service` | `9093` | De xuat, chua trien khai |
| `payment-service` | `9094` | De xuat, chua trien khai |

Trong Docker Compose, `9095` chi expose trong `platform-net`, khong publish ra host.

## 5. Port Collision Checklist

- Kiem tra port truoc khi startup: `netstat -ano | findstr :<port>`.
- Neu trung port: doi host mapping trong compose hoac doi `server.port`.
- Cap nhat lai file nay ngay khi co thay doi.
