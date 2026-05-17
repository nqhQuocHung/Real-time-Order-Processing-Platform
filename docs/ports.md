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
| `inventory-service` | `8083` | Inventory APIs/gRPC |
| `payment-service` | `8084` | Payment APIs/gRPC |
| `notification-service` | `8085` | Notification worker/API |

## 3. Infra Ports (Host)

| Component | Port | Ghi chu |
| --- | --- | --- |
| PostgreSQL | `5432` | Main relational store |
| Redis | `6379` | Cache/idempotency/rate-limit |
| Kafka Broker (external) | `9092` | Client trong may local connect vao |
| Kafka Broker (internal) | `29092` | Service trong Docker network dung |
| Kafka UI (optional) | `8088` | Quan sat topic/consumer |

## 4. Suggested gRPC Ports (internal)

Neu trien khai gRPC tach rieng khoi REST trong local:

| Service | gRPC Port |
| --- | --- |
| `inventory-service` | `9093` |
| `payment-service` | `9094` |

Neu chua tach, co the dung chung process va map config phu hop.

## 5. Port Collision Checklist

- Kiem tra port truoc khi startup: `netstat -ano | findstr :<port>`.
- Neu trung port: doi host mapping trong compose hoac doi `server.port`.
- Cap nhat lai file nay ngay khi co thay doi.
