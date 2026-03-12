# Testing Guide

This document provides comprehensive testing instructions for the BlockProof system.

## Prerequisites

- Docker & Docker Compose installed
- Project cloned and `.env` configured
- Services running: `docker compose up --build`

---

## Unit Testing

### Backend Tests

```bash
# Install test dependencies
docker compose exec backend pip install pytest pytest-asyncio

# Run tests
docker compose exec backend pytest

# With coverage
docker compose exec backend pytest --cov=app tests/
```

### Frontend Tests

```bash
cd frontend
npm install
npm run test
```

---

## Integration Testing

### Smoke Test (Services Running)

```bash
# Check all services are healthy
docker compose ps

# Expected output:
# - db: up
# - minio: up
# - blockchain: up
# - backend: up
# - frontend: up
```

### Health Check

```bash
# Backend health
curl http://localhost:8000/api/health

# Expected response:
# {"status":"healthy","database":"connected",...}
```

---

## Manual Testing Scenarios

### Scenario 1: User Registration & Login

```bash
# 1. Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPass123",
    "full_name": "Test User"
  }'

# Expected: 201 Created with user object

# 2. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser@example.com&password=TestPass123"

# Expected: 200 OK with access_token
# Save token for further requests
TOKEN="eyJhbGc..."

# 3. Get current user
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with user details
```

### Scenario 2: File Upload & Verification

```bash
TOKEN="your-token-here"

# 1. Upload file
curl -X POST http://localhost:8000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "upload_file=@test.pdf" \
  -F "description=Test document"

# Expected: 201 Created with file object
# Save file ID from response
FILE_ID="uuid-here"

# 2. Get file details
curl -X GET "http://localhost:8000/api/files/$FILE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with file details

# 3. List files with search
curl -X GET "http://localhost:8000/api/files?q=test" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with filtered list

# 4. Get file history
curl -X GET "http://localhost:8000/api/files/$FILE_ID/history" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with action history
```

### Scenario 3: File Verification

```bash
# 1. Verify by uploading file
curl -X POST http://localhost:8000/api/verify/file \
  -F "upload_file=@test.pdf"

# Expected: 200 OK with verification result
# Note: No authentication required for verification

# 2. Verify by hash
HASH="abc123def456..."

curl -X GET "http://localhost:8000/api/verify/hash/$HASH"

# Expected: 200 OK with verification result
```

### Scenario 4: Blockchain Registration

```bash
TOKEN="your-token-here"
FILE_ID="uuid-here"

# Register file on blockchain
curl -X POST "http://localhost:8000/api/blockchain/register/$FILE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with blockchain info
# Response includes:
# - blockchain_tx_hash: "0x..."
# - blockchain_object_id: "uuid"

# Get blockchain object details
curl -X GET "http://localhost:8000/api/blockchain/object/$FILE_ID"

# Expected: 200 OK with object details from smart contract

# Get blockchain history
curl -X GET "http://localhost:8000/api/blockchain/object/$FILE_ID/history"

# Expected: 200 OK with action history from contract
```

### Scenario 5: Admin Operations

```bash
ADMIN_TOKEN="admin-token-here"

# List users
curl -X GET http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK with user list

# Update user role
curl -X PATCH http://localhost:8000/api/admin/users/user-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'

# Expected: 200 OK with updated user

# Delete user
curl -X DELETE http://localhost:8000/api/admin/users/user-id \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 204 No Content
```

---

## Frontend Testing

### Manual UI Testing

1. **Authentication Flow**
   - Visit http://localhost:5173
   - Click "Register"
   - Fill form with valid data
   - Submit and verify redirected to login
   - Login with credentials
   - Verify dashboard loads with metrics

2. **File Upload**
   - Navigate to "Upload"
   - Select a test file
   - Add description
   - Click upload
   - Verify file appears in "My documents"

3. **File Details**
   - Click on a file in "My documents"
   - View file details
   - Check blockchain info section
   - Click "Register on-chain"
   - Verify transaction hash displayed

4. **Verification**
   - Navigate to "Verify"
   - Upload file or enter hash
   - Verify result displays correctly
   - Try "Copy report" and "Print" buttons

5. **Admin Panel**
   - Login as admin
   - Navigate to "Admin"
   - View user list
   - Change a user's role
   - Delete a test user

---

## Performance Testing

### Load Testing (Simple)

```bash
# Install Apache Bench
apt-get install apache2-utils

# Test API endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:8000/api/health

# Test with authentication
TOKEN="your-token"
ab -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/files
```

### Load Testing (Advanced with Locust)

```bash
# Install Locust
pip install locust

# Create locustfile.py with test scenarios
# Run: locust -f locustfile.py --host=http://localhost:8000
```

---

## Security Testing

### 1. Rate Limiting

```bash
# Try rapid registration (should limit after 5)
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"user$i@example.com\",\"password\":\"Pass123\"}"
done

# Should return 429 Too Many Requests after 5 requests
```

### 2. Input Validation

```bash
# Test weak password
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"short"}'

# Expected: 422 Unprocessable Entity (validation error)

# Test invalid email
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","password":"Pass123"}'

# Expected: 422 Unprocessable Entity
```

### 3. CORS Testing

```bash
# Test CORS from different origin
curl -X GET http://localhost:8000/api/health \
  -H "Origin: http://attacker.com" \
  -H "Access-Control-Request-Method: GET"

# Check CORS headers in response
# Should be restricted to configured origins
```

### 4. SQL Injection

```bash
# Try SQL injection in search
curl -X GET "http://localhost:8000/api/files?q='; DROP TABLE users; --" \
  -H "Authorization: Bearer $TOKEN"

# Should safely escape and return no results
# (SQLAlchemy ORM prevents this)
```

### 5. Authentication

```bash
# Test without token
curl -X GET http://localhost:8000/api/files

# Expected: 403 Forbidden

# Test with invalid token
curl -X GET http://localhost:8000/api/files \
  -H "Authorization: Bearer invalid-token"

# Expected: 401 Unauthorized
```

---

## Database Testing

### Connection Test

```bash
docker compose exec db psql -U app -d file_registry -c "SELECT * FROM users;"
```

### Backup Test

```bash
# Create backup
docker compose exec db pg_dump -U app file_registry > backup.sql

# Verify backup
wc -l backup.sql  # Should have many lines

# Test restore (to new DB)
psql -U app -d test_db < backup.sql
```

---

## Blockchain Testing

### Contract Interaction

```bash
# Check if contract is deployed
docker compose logs blockchain | grep "Contract deployed"

# Verify contract address file exists
docker compose exec backend cat /shared/contract_address.txt
```

### Transaction Verification

```bash
# Get transaction receipt from blockchain
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getTransactionReceipt",
    "params": ["0xTXN_HASH"],
    "id": 1
  }'
```

---

## Continuous Integration Testing

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main`

Pipeline checks:
- ✅ Backend linting (flake8)
- ✅ Frontend build
- ✅ Docker image build
- ✅ Security scanning (Trivy)

View results in Actions tab of GitHub repository.

---

## Checklist for Release

- [ ] All unit tests passing
- [ ] Manual smoke tests pass
- [ ] Security tests pass (rate limiting, validation)
- [ ] API documentation up to date
- [ ] Database migrations run successfully
- [ ] Blockchain contract deployed
- [ ] Admin user created
- [ ] Sample files uploaded and verified
- [ ] Production docker-compose tested
- [ ] SSL/TLS certificates ready
- [ ] Backups configured
- [ ] Monitoring setup verified

---

## Troubleshooting

### Tests Fail

```bash
# Check service health
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f blockchain

# Restart services
docker compose down
docker compose up --build
```

### Database Issues

```bash
# Reset database (WARNING: deletes data)
docker compose down
docker volume rm blockchain-diplom_db_data
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.create_admin
```

### Rate Limiting in Tests

```bash
# Clear rate limiting cache (if using in-memory)
# Restart backend service
docker compose restart backend
```

---

## Conclusion

This comprehensive testing guide ensures the system works correctly across all components. Run these tests before deployment and periodically during operation.

For issues or questions, see [COMPLETION_SUMMARY.md](../COMPLETION_SUMMARY.md) or [docs/DEPLOYMENT.md](./DEPLOYMENT.md).
