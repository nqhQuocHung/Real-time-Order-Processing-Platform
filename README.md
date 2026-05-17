# Real-time Order Processing Platform

Nen tang xu ly don hang thoi gian thuc theo kien truc microservices, ket hop REST gateway, internal RPC, Kafka event bus va SSE realtime.

## Cau hinh bien moi truong (bat buoc truoc khi chay)

1. Tao file env local tu mau:
   - `cp infra/.env.example infra/.env` (Linux/macOS)
   - `Copy-Item infra/.env.example infra/.env` (PowerShell)
2. Dien cac gia tri that cho cac bien nhay cam trong `infra/.env`:
   - `JWT_SECRET`, `INTERNAL_RPC_TOKEN`
   - `POSTGRES_PASSWORD` va cac `*_DB_PASSWORD`
   - `MAIL_USERNAME`, `MAIL_PASSWORD`
   - `CLOUDINARY_*`, `VNPAY_*` (neu su dung)
3. Khong commit `infra/.env` len git.

## Tai lieu he thong

- [Kien truc he thong](docs/architecture.md)
- [Chuc nang he thong](docs/system-functions.md)
- [Luong nghiep vu quan trong](docs/key-flows.md)
- [API contracts](docs/api-contracts.md)
- [Kafka topics](docs/kafka-topics.md)
- [Ports](docs/ports.md)
- [Bao cao tich hop realtime 2026-05-07](docs/realtime-integration-report-2026-05-07.md)
