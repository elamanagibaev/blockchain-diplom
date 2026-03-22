## API Documentation

Base URL: `http://localhost:8000/api`

## Authentication

### Register

**POST** `/auth/register`

Creates a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "full_name": "John Doe",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)

**Response (201 Created):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "wallet_address": "0x...",
  "is_active": true
}
```

**Rate Limit:** 5 requests per minute

---

### Login

**POST** `/auth/login`

Authenticates user and returns JWT token.

**Request (application/x-www-form-urlencoded):**
```
username=user@example.com&password=StrongPass123!
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 14400
}
```

**Rate Limit:** 10 requests per minute

---

### Get Current User

**GET** `/auth/me`

Requires: `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "wallet_address": "0x...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Files

### Upload File

**POST** `/files/upload`

Requires: `Authorization: Bearer <token>`

**Request (multipart/form-data):**
- `upload_file` (file): The file to upload (max 10MB)
- `description` (string, optional): File description

**Response (201 Created):**
```json
{
  "id": "uuid",
  "file_name": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 102400,
  "description": "My document",
  "sha256_hash": "abc123...",
  "status": "REGISTERED",
  "created_at": "2024-01-15T10:30:00Z",
  "blockchain_object_id": null,
  "blockchain_tx_hash": null
}
```

---

### List Files

**GET** `/files`

Requires: `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string, optional): Search by filename or hash
- `status` (string, optional): Filter by status (REGISTERED, VERIFIED, REGISTERED_ON_CHAIN)

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "file_name": "document.pdf",
    "sha256_hash": "abc123...",
    "status": "REGISTERED",
    "created_at": "2024-01-15T10:30:00Z",
    ...
  }
]
```

---

### Get File Details

**GET** `/files/{id}`

Requires: `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "file_name": "document.pdf",
  "sha256_hash": "abc123...",
  "status": "REGISTERED",
  "created_at": "2024-01-15T10:30:00Z",
  "blockchain_object_id": null,
  "blockchain_tx_hash": null,
  "owner_id": "uuid",
  "storage_key": "local://document.pdf"
}
```

---

### Download File

**GET** `/files/{id}/download`

Requires: `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "url": "http://storage-url/document.pdf"
}
```

---

### Get Metrics

**GET** `/files/metrics`

Requires: `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "total": 25,
  "on_chain": 18,
  "verified": 23,
  "invalid": 2
}
```

---

## Verification

### Verify Uploaded File

**POST** `/verify/file`

No authentication required (public endpoint).

**Request (multipart/form-data):**
- `upload_file` (file): The file to verify

**Response (200 OK):**
```json
{
  "is_verified": true,
  "digital_object_id": "uuid",
  "registered_at": "2024-01-15T10:30:00Z",
  "owner_id": "uuid",
  "file_name": "document.pdf",
  "description": "My document",
  "transaction_hash": "0xabc123...",
  "integrity_status": "OK"
}
```

---

### Verify by Hash

**GET** `/verify/hash/{sha256}`

No authentication required.

**Parameters:**
- `sha256` (string): SHA-256 hash of file (64 hex characters)

**Response (200 OK):**
```json
{
  "is_verified": true,
  "digital_object_id": "uuid",
  "registered_at": "2024-01-15T10:30:00Z",
  "owner_id": "uuid",
  "file_name": "document.pdf",
  "transaction_hash": "0xabc123...",
  "integrity_status": "OK"
}
```

---

## Blockchain

### Register File On-Chain

**POST** `/blockchain/register/{file_id}`

Requires: `Authorization: Bearer <token>`

Registers file hash on blockchain.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "file_name": "document.pdf",
  "blockchain_object_id": "uuid",
  "blockchain_tx_hash": "0xabc123...",
  "status": "REGISTERED_ON_CHAIN",
  ...
}
```

---

### Get Blockchain Object

**GET** `/blockchain/object/{object_id}`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "hash": "abc123...",
  "owner": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "metadata_uri": "offchain://digital_objects/uuid",
  "status": "REGISTERED",
  "timestamp": 1705319400,
  "actions_count": 2
}
```

---

### Get Blockchain Object History

**GET** `/blockchain/object/{object_id}/history`

**Response (200 OK):**
```json
[
  {
    "action_type": "REGISTER",
    "actor": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
    "details": "Initial registration",
    "timestamp": 1705319400
  },
  {
    "action_type": "VERIFY",
    "actor": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
    "details": "Verification request",
    "timestamp": 1705319500
  }
]
```

---

### Get Transaction Details

**GET** `/blockchain/tx/{tx_hash}`

**Response (200 OK):**
```json
{
  "hash": "0xabc123...",
  "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "to": "0xContractAddress...",
  "status": "SUCCESS",
  "block_number": 42,
  "timestamp": 1705319400,
  "gas_used": 125000
}
```

---

## Admin

### List Users

**GET** `/admin/users`

Requires: `Authorization: Bearer <token>` (admin role)

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### Update User Role

**PATCH** `/admin/users/{user_id}`

Requires: `Authorization: Bearer <token>` (admin role)

**Request:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "admin",
  ...
}
```

---

### Delete User

**DELETE** `/admin/users/{user_id}`

Requires: `Authorization: Bearer <token>` (admin role)

**Response (204 No Content)**

---

## Health

### System Health

**GET** `/health`

No authentication required.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "blockchain": "connected",
  "storage": "available"
}
```

---

## Error Responses

All errors return appropriate HTTP status codes with messages:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email, etc.)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limiting

Endpoints are rate-limited to prevent abuse:

- **Register**: 5 requests per minute
- **Login**: 10 requests per minute
- **Other endpoints**: 100 requests per minute

Rate limit status is returned in response headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

