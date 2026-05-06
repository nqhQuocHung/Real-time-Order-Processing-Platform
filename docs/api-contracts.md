# Real-time Order Processing Platform - API Contracts

## 1. Scope

Tai lieu nay chuan hoa REST contract cho toan bo services (giai doan dau), bao gom:

- URI convention
- Request/response envelope
- Error contract
- Header conventions
- Cac endpoint auth co ban cua Week 1

## 2. URI Convention

- Prefix version: `/api/v1`.
- Resource dat ten so nhieu: `/orders`, `/users`.
- Health endpoint: `/actuator/health` (khong dat duoi `/api/v1`).

Vi du:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

## 3. Headers Convention

| Header | Bat buoc | Mo ta |
| --- | --- | --- |
| `Authorization: Bearer <token>` | Co (protected API) | JWT access token |
| `Content-Type: application/json` | Co (request body) | JSON payload |
| `X-Correlation-Id` | Khuyen nghi | Trace request xuyen service |
| `Idempotency-Key` | Co (POST tao order) | Chong tao trung request |

## 4. Success Response Contract

```json
{
  "timestamp": "2026-05-06T11:00:00+07:00",
  "status": 200,
  "data": {},
  "traceId": "req-2e5de8d7b6d74893"
}
```

Field rules:

- `timestamp`: ISO-8601.
- `status`: HTTP status code.
- `data`: payload nghiep vu.
- `traceId`: map tu `X-Correlation-Id` hoac tu request context.

## 5. Error Response Contract

```json
{
  "timestamp": "2026-05-06T11:00:00+07:00",
  "status": 401,
  "errorCode": "AUTH_INVALID_TOKEN",
  "message": "Token is invalid or expired",
  "traceId": "req-2e5de8d7b6d74893",
  "details": []
}
```

Field rules:

- `errorCode`: machine-readable, format `<DOMAIN>_<DETAIL>`.
- `message`: human-readable.
- `details`: danh sach loi validate neu co.

## 6. Error Code Convention

| Domain | Prefix |
| --- | --- |
| Auth | `AUTH_*` |
| Order | `ORDER_*` |
| Inventory | `INV_*` |
| Payment | `PAY_*` |
| Notification | `NOTI_*` |
| Gateway/Common | `COMMON_*` |

Vi du:

- `AUTH_INVALID_CREDENTIALS`
- `ORDER_OUT_OF_STOCK`
- `PAY_TIMEOUT`
- `COMMON_VALIDATION_ERROR`

## 7. HTTP Status Mapping

| Status | Khi nao dung |
| --- | --- |
| `200` | Query/update thanh cong |
| `201` | Tao moi thanh cong |
| `400` | Validate request that bai |
| `401` | Chua auth/invalid token |
| `403` | Khong du quyen |
| `404` | Khong tim thay resource |
| `409` | Xung dot state/duplicate request |
| `422` | Nghiep vu khong hop le |
| `500` | Loi he thong |
| `503` | Dependency tam thoi unavailable |

## 8. Week 1 Auth Endpoint Contracts

### 8.1 Register

- `POST /api/v1/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass#123",
  "fullName": "Nguyen Van A"
}
```

Success (`201`):

```json
{
  "timestamp": "2026-05-06T11:00:00+07:00",
  "status": 201,
  "data": {
    "userId": "U-1001",
    "email": "user@example.com"
  },
  "traceId": "req-2e5de8d7b6d74893"
}
```

### 8.2 Login

- `POST /api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass#123"
}
```

Success (`200`):

```json
{
  "timestamp": "2026-05-06T11:00:00+07:00",
  "status": 200,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 3600
  },
  "traceId": "req-2e5de8d7b6d74893"
}
```

### 8.3 Get Current User

- `GET /api/v1/auth/me`
- Header: `Authorization: Bearer <jwt>`

Success (`200`):

```json
{
  "timestamp": "2026-05-06T11:00:00+07:00",
  "status": 200,
  "data": {
    "userId": "U-1001",
    "email": "user@example.com",
    "roles": [
      "CUSTOMER"
    ]
  },
  "traceId": "req-2e5de8d7b6d74893"
}
```
