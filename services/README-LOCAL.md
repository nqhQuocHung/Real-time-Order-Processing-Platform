# Chay local

## 1. Pham vi

Stack nay gom PostgreSQL, Redis, Kafka KRaft, auth, order, inventory, payment, notification va API gateway. Chi API gateway duoc bind ra host tai `127.0.0.1:8080`; cac service noi bo khong publish port. Day la cach thuc hanh local, khong phai manifest production/cloud.

## 2. Yeu cau

- Docker Desktop dang chay, ho tro Docker Compose v2.
- Khoang 8 GB RAM trong de build va chay dong thoi.
- Cong `8080` tren localhost chua bi dung.

Kiem tra:

```powershell
docker version
docker compose version
```

## 3. Tao secret local

Tai thu muc `services`:

```powershell
Copy-Item .env.example .env
```

Mo `.env` va thay tat ca gia tri co chu `change-`. Hai gia tri quan trong nhat la:

- `JWT_SECRET`: toi thieu 64 byte, dung chung tat ca service.
- `INTERNAL_RPC_TOKEN`: dai, ngau nhien, khac `JWT_SECRET`, dung chung cho cac RPC noi bo.

Khong commit `.env`. Gia tri trong `.env.example` chi la mau.

## 4. Khoi dong

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs -f
```

Lan dau Maven se tai dependency, PostgreSQL se tao database va tung service se chay Flyway. Neu doi password database sau khi volume da ton tai, secret moi khong tu dong cap nhat tai khoan cu. Reset toan bo data local bang:

```powershell
docker compose down -v
docker compose up --build -d
```

Lenh tren xoa du lieu local, khong dung tren moi truong co data can giu.

## 5. Kiem tra nhanh

```powershell
Invoke-RestMethod http://127.0.0.1:8080/actuator/health
Invoke-RestMethod http://127.0.0.1:8080/actuator/auth/health
Invoke-RestMethod http://127.0.0.1:8080/actuator/orders/health
Invoke-RestMethod http://127.0.0.1:8080/actuator/inventory/health
Invoke-RestMethod http://127.0.0.1:8080/actuator/payments/health
Invoke-RestMethod http://127.0.0.1:8080/actuator/notifications/health
```

Kiem tra auth:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/api/v1/orders -SkipHttpErrorCheck
```

Request khong co Bearer token phai tra ve `401`. Dang ky/dang nhap qua cac endpoint public duoc expose tai gateway:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Dung OpenAPI/Swagger de xem schema request. Sau khi login, gan access token vao `Authorization: Bearer <token>`.

## 6. Bai tap security

1. Goi endpoint private khong co token va xac nhan `401`.
2. Goi endpoint dung token nhung role/permission thieu va xac nhan `403`.
3. Doi `JWT_SECRET` chi o auth-service, khoi dong lai stack, xac nhan cac token moi bi cac resource server tu choi. Day minh hoa yeu cau chia se/cap nhat secret dong bo.
4. Goi `OPTIONS` voi `Origin: http://localhost:5173` va mot origin khac de kiem tra CORS.
5. Xem `docker compose ps` va xac nhan chi gateway co host port; PostgreSQL, Redis, Kafka va cac service noi bo khong publish port.
6. Thu thay `INTERNAL_RPC_TOKEN` o mot service trong khi cac service khac giu token cu, sau do chay mot flow order/payment de quan sat RPC bi tu choi.

Khong dung Actuator, Swagger, SMTP, Cloudinary hay VNPAY that trong local/shared lab neu chua khoa truy cap va du config secret tuong ung.

## 7. Dung va sua su co

```powershell
docker compose down
docker compose logs --tail=200 auth-service
docker compose restart auth-service
```

Loi thuong gap:

- `JWT_SECRET` hoac `INTERNAL_RPC_TOKEN` thieu: bo sung trong `.env`, chay lai `docker compose up -d`.
- `password authentication failed`: volume PostgreSQL giu password cu; xac nhan `.env`, hoac reset volume neu la data local bo di duoc.
- Service `unhealthy`/ket noi Kafka: xem log cua `kafka` va service lien quan; doi infrastructure san sang truoc khi de app xu ly request.

## 8. Chua dat muc san sang cloud

He thong hien co JWT/RBAC, token RPC, Flyway va health endpoint, nhung chua co day du:

- Kubernetes/Helm/Terraform hoac cac manifest deploy cloud.
- TLS, ingress, WAF/rate limit va policy chan truy cap truc tiep vao service noi bo.
- Secret manager/rotation; cloud identity; chu ky khoa JWT va cach revoke token phu hop.
- mTLS hoac workload identity cho service-to-service; token shared chi phu hop training.
- Database/Kafka/Redis HA, backup/restore, persistence, capacity va disaster recovery duoc xac nhan.
- OpenTelemetry, centralized logging, alerting, SLO, trace correlation.
- Image signing/scanning, pin image bang digest, non-root image, resource limits va CI/CD co security gate.

Tinh den hien trang nay, ket luan la: **chua san sang production cloud; du de bat dau chay va luyen security local sau khi stack nay duoc xac nhan**.
