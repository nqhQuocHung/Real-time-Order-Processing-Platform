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

### 8.4 RBAC Payload (`/auth/me`)

`/api/v1/auth/me` hien tra ve day du du lieu RBAC de frontend render menu va an/hien chuc nang:

- `roles`: danh sach role code.
- `permissions`: danh sach permission code.
- `menus`: danh sach menu da duoc loc theo role mapping.

Vi du:

```json
{
  "timestamp": "2026-05-07T11:00:00+07:00",
  "status": 200,
  "data": {
    "userId": "3f4af5f3-7e92-4c5e-bd35-4d4f26ea45fa",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["ADMIN"],
    "permissions": [
      "VIEW_ADMIN_DASHBOARD",
      "MANAGE_USERS",
      "MANAGE_ALL_ORDERS"
    ],
    "menus": [
      {
        "key": "admin-dashboard",
        "label": "Admin Dashboard",
        "path": "/admin/dashboard",
        "displayOrder": 10,
        "permission": "VIEW_ADMIN_DASHBOARD"
      }
    ]
  },
  "traceId": "req-2e5de8d7b6d74893"
}
```

### 8.5 Update User

- `PATCH /api/v1/auth/user/{userId}`
- Header: `Authorization: Bearer <jwt>`
- Permission required: `MANAGE_USERS`

Request (cac field deu optional):

```json
{
  "email": "new-email@example.com",
  "phone": "0987654321",
  "firstName": "Nguyen",
  "lastName": "Van A",
  "status": "ACTIVE",
  "isActive": true,
  "roleCodes": ["USER", "SHOPEE_PARTNER"]
}
```

Success (`200`):

```json
{
  "timestamp": "2026-05-07T11:00:00+07:00",
  "status": 200,
  "data": {
    "userId": "3f4af5f3-7e92-4c5e-bd35-4d4f26ea45fa",
    "profile": {
      "userId": "3f4af5f3-7e92-4c5e-bd35-4d4f26ea45fa",
      "email": "new-email@example.com",
      "roles": ["USER", "SHOPEE_PARTNER"],
      "permissions": ["VIEW_PARTNER_DASHBOARD"]
    }
  },
  "traceId": "req-2e5de8d7b6d74893"
}
```

## 9. Order Endpoint Contract (MVP)

### 9.1 Create Order

- `POST /api/v1/orders`
- Header:
  - `Authorization: Bearer <jwt>`
  - `Idempotency-Key: <unique-key>`

Request:

```json
{
  "customerId": "3f4af5f3-7e92-4c5e-bd35-4d4f26ea45fa",
  "currency": "VND",
  "items": [
    {
      "productId": "f6f56f57-b4d9-4c8d-a3bc-66a4a95fb52e",
      "productName": "Iced Latte",
      "quantity": 2,
      "unitPrice": 59000
    }
  ]
}
```

### 9.2 Order Query And Actions

- `GET /api/v1/orders/{orderCode}`: Lay chi tiet don hang.
- `GET /api/v1/orders?customerId=&status=&createdFrom=&createdTo=&page=&size=`: Liet ke don hang theo filter + pagination.
- `POST /api/v1/orders/{orderCode}/cancel`: Huy don hang (chi hop le voi status `CREATED`, `RESERVED`).
- `PATCH /api/v1/orders/{orderCode}/status`: Cap nhat trang thai thu cong theo transition rule.
- `POST /api/v1/orders/{orderCode}/payment-confirm`: Callback thanh toan thanh cong, chuyen sang `PAID`.
- `POST /api/v1/orders/{orderCode}/payment-fail`: Callback thanh toan that bai, chuyen sang `FAILED`.
- `POST /api/v1/orders/{orderCode}/shipping-confirm`: Callback giao hang, chuyen sang `COMPLETED`.
- `GET /api/v1/orders/{orderCode}/timeline`: Lay lich su chuyen trang thai don hang.

## 10. Inventory Endpoint Contract (Core)

- `GET /api/v1/inventories/{productId}`: Lay ton kho hien tai theo san pham.
- `POST /api/v1/inventories/check`: Kiem tra kha nang dat hang cho danh sach item.
- `POST /api/v1/inventories/reserve`: Giu hang cho order (`orderCode` + danh sach item). Idempotent theo `orderCode`.
- `POST /api/v1/inventories/release`: Nha giu hang (rollback reserve) cho order.
- `POST /api/v1/inventories/confirm-deduct`: Chot tru ton kho sau khi thanh toan thanh cong.
- `POST /api/v1/inventories/adjust`: Cong/tru ton kho thu cong (restock hoac correction).

## 11. Payment Endpoint Contract (Core Demo)

- `POST /api/v1/payments/intents`: Tao payment intent cho order voi nhieu `method` (`VNPAY`, `MOMO`, `ZALOPAY`, `COD`, `BANK_TRANSFER`).
- `GET /api/v1/payments/{orderCode}`: Lay chi tiet giao dich thanh toan theo order code.
- `POST /api/v1/payments/confirm`: Xac nhan thanh toan thanh cong/khong thanh cong.
  - Trong demo hien tai: chi `VNPAY` co the chuyen `SUCCESS`.
  - Cac method khac khi confirm se duoc danh dau `FAILED`.
- `POST /api/v1/payments/fail`: Danh dau giao dich thanh toan that bai.

Success (`201`):

```json
{
  "timestamp": "2026-05-07T11:00:00+07:00",
  "status": 201,
  "code": "ORDER_CREATE_SUCCESS",
  "message": "Order created successfully",
  "traceId": "req-2e5de8d7b6d74893",
  "data": {
    "orderId": "8e44f43d-4cb1-4ebf-89f8-a3d8f8f5289a",
    "orderCode": "ORD-20260507110000-102938",
    "status": "CREATED",
    "totalAmount": 118000,
    "currency": "VND",
    "idempotencyKey": "d4f885c5-2196-49c0-ba69-bc70008585ad",
    "replayed": false,
    "createdAt": "2026-05-07T11:00:00+07:00",
    "items": [
      {
        "productId": "f6f56f57-b4d9-4c8d-a3bc-66a4a95fb52e",
        "productName": "Iced Latte",
        "quantity": 2,
        "unitPrice": 59000,
        "lineTotal": 118000
      }
    ]
  }
}
```

## 12. Notification Endpoint Contract (Core)

- `POST /api/v1/notifications`: Tao notification log thu cong (manual/internal trigger).
- `GET /api/v1/notifications/{notificationCode}`: Lay chi tiet notification theo code.
- `GET /api/v1/notifications?orderCode=&status=&channel=&createdFrom=&createdTo=&page=&size=`: Liet ke notification theo filter + pagination.
- `PATCH /api/v1/notifications/{notificationCode}/status`: Cap nhat trang thai notification (`PENDING`, `SENT`, `FAILED`, `CANCELLED`).
