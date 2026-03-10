## API (коротко)

Базовый URL: `http://localhost:8000/api`

### Auth

- `POST /auth/register`

```json
{"email":"user@example.com","password":"StrongPass123!","full_name":"User","wallet_address":"0x..."}
```

- `POST /auth/login` (x-www-form-urlencoded)
  - `username` = email
  - `password` = password

- `GET /auth/me` (Bearer token)

### Files

- `POST /files/upload` (multipart)
  - `upload_file`: file
  - `description`: optional

- `GET /files`
- `GET /files/{id}`
- `GET /files/{id}/history`

### Verification

- `POST /verify/file` (multipart: `upload_file`)
- `GET /verify/hash/{hash}`

### Blockchain

- `POST /blockchain/register/{id}`
- `GET /blockchain/object/{object_id}`
- `GET /blockchain/object/{object_id}/history`
- `GET /blockchain/tx/{tx_hash}`

### Health

- `GET /health`

