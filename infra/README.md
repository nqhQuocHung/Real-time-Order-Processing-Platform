# Infra Local Stack Guide

## 1) Prerequisites

- Docker Desktop da chay
- `docker compose` hoat dong

Kiem tra nhanh:

```powershell
docker --version
docker compose version
```

## 2) Khoi dong stack

Chay trong thu muc `infra/`:

```powershell
docker compose up -d
```

Compose se khoi dong:

- `postgres` (5432)
- `redis` (6379)
- `kafka` (9092 external, 29092 internal)
- `kafka-ui` (8088)
- `kafka-init` (job 1 lan de tao topics)

## 3) Kiem tra health

```powershell
docker compose ps
```

Trang thai mong doi:

- `postgres`, `redis`, `kafka`, `kafka-ui` la `Up`
- `kafka-init` la `Exited (0)` sau khi tao topic

## 4) Verify PostgreSQL DB/schema

```powershell
docker exec -it ropp-postgres psql -U postgres -d postgres -c "\l"
docker exec -it ropp-postgres psql -U postgres -d auth_db -c "\dn"
docker exec -it ropp-postgres psql -U postgres -d order_db -c "\dn"
```

Ban se thay cac DB:

- `auth_db`
- `order_db`
- `inventory_db`
- `payment_db`
- `notification_db`

## 5) Verify Kafka topics

```powershell
docker exec -it ropp-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Phai co it nhat 7 topic business theo `docs/kafka-topics.md`:

- `order.lifecycle.created.v1`
- `inventory.reservation.succeeded.v1`
- `inventory.reservation.failed.v1`
- `payment.transaction.succeeded.v1`
- `payment.transaction.failed.v1`
- `order.lifecycle.completed.v1`
- `order.lifecycle.failed.v1`

Ngoai ra se co them `.retry.v1` va `.dlq.v1` cho moi topic.

## 6) Mo Kafka UI

- URL: `http://localhost:8088`
- Cluster name: `local` (auto config)

## 7) Stop/Cleanup

Dung stack:

```powershell
docker compose down
```

Dung va xoa volume (reset du lieu):

```powershell
docker compose down -v
```
