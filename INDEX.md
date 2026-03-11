# Project Documentation Index

Welcome to **MediChain Records** — a comprehensive blockchain-based file registry system.

## Quick Links

- **[README.md](README.md)** — Project overview, quickstart, and setup instructions
- **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)** — Detailed project completion summary with features
- **[TESTING.md](TESTING.md)** — Comprehensive testing guide and scenarios

---

## Documentation by Topic

### Getting Started

1. **[README.md](README.md)** — Setup and basic usage
   - Quick start with Docker
   - Local development without Docker
   - Admin user creation
   - Sample data workflow

### API Reference

- **[docs/api.md](docs/api.md)** — Complete API documentation
  - All endpoints with examples
  - Authentication
  - Request/response formats
  - Rate limiting information
  - Error codes

### Architecture & Design

- **[docs/architecture.md](docs/architecture.md)** — System architecture
  - Component overview
  - Data flow
  - Design patterns

- **[docs/blockchain_design.md](docs/blockchain_design.md)** — Smart contract design
  - FileRegistry contract
  - On-chain operations
  - Gas considerations

### Security

- **[docs/security.md](docs/security.md)** — Security considerations
  - Off-chain vs on-chain data
  - Private key management
  - Wallet address validation
  - Rate limiting
  - Input validation
  - SQL injection prevention

### Deployment

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Production deployment guide
  - Environment setup
  - Docker Compose production configuration
  - Nginx reverse proxy
  - SSL/TLS with Let's Encrypt
  - Database backups
  - Monitoring and logging
  - Troubleshooting

### Testing

- **[TESTING.md](TESTING.md)** — Comprehensive testing guide
  - Unit testing setup
  - Integration testing
  - Manual test scenarios
  - Security testing
  - Performance testing
  - Release checklist

---

## Core Features

### User Management
- ✅ User registration with password complexity validation
- ✅ JWT-based authentication
- ✅ Admin role management
- ✅ Admin panel for user management

### File Management
- ✅ Secure file upload (size and type validation)
- ✅ File listing with search and filtering
- ✅ Download URL generation
- ✅ File verification by upload or hash
- ✅ Action history tracking

### Blockchain Integration
- ✅ Smart contract deployment (Solidity/Hardhat)
- ✅ File registration on-chain
- ✅ Transaction hash recording
- ✅ On-chain action history
- ✅ Blockchain object queries

### Security
- ✅ Rate limiting (5 req/min register, 10 req/min login)
- ✅ Input validation and sanitization
- ✅ CORS hardening
- ✅ Secure password storage (bcrypt)
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ Error handling without info leakage

### Dashboard & Analytics
- ✅ Metrics dashboard
- ✅ File statistics
- ✅ Verification statistics
- ✅ On-chain registration count

---

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL + SQLAlchemy + Alembic
- **Authentication**: JWT (python-jose)
- **Password Security**: bcrypt
- **Blockchain**: web3.py
- **Rate Limiting**: slowapi
- **Validation**: Pydantic

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Router**: React Router v6
- **HTTP Client**: Axios
- **Styling**: CSS Grid/Flexbox

### Blockchain
- **Network**: Ethereum-compatible (Hardhat)
- **Contract Language**: Solidity
- **Development**: Hardhat + ethers.js

### Deployment
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (reverse proxy)
- **SSL/TLS**: Let's Encrypt / Certbot
- **CI/CD**: GitHub Actions

---

## File Structure Overview

```
blockchain-diplom/
├── README.md                    # Main README
├── COMPLETION_SUMMARY.md        # Project summary
├── TESTING.md                   # Testing guide
├── docker-compose.yml           # Development setup
├── docker-compose.prod.yml      # Production setup
├── .env.example                 # Environment template
│
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app
│   │   ├── api/routes/         # Endpoints
│   │   ├── services/           # Business logic
│   │   ├── models/             # DB models
│   │   ├── schemas/            # Validation
│   │   ├── utils/              # Utilities
│   │   └── core/               # Config & security
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable components
│   │   ├── context/            # Context providers
│   │   ├── api/                # API client
│   │   └── App.tsx
│   └── package.json
│
├── blockchain/
│   ├── contracts/              # Solidity files
│   ├── scripts/                # Deploy script
│   └── hardhat.config.js
│
├── docs/
│   ├── api.md                  # API documentation
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── architecture.md
│   ├── blockchain_design.md
│   └── security.md
│
└── .github/workflows/
    └── ci-cd.yml               # GitHub Actions
```

---

## Common Tasks

### Local Development

```bash
# Start services
docker compose up --build

# Create admin user
docker compose exec backend python -m app.scripts.create_admin

# View logs
docker compose logs -f backend

# Run migrations
docker compose exec backend alembic upgrade head
```

### Production Deployment

```bash
# Prepare environment
cp .env.example .env.prod
# Edit .env.prod with production values

# Deploy
docker compose -f docker-compose.prod.yml up -d

# Initialize
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.create_admin
```

### Testing

```bash
# Run tests
docker compose exec backend pytest

# Manual testing
# See TESTING.md for comprehensive scenarios

# Check health
curl http://localhost:8000/api/health
```

### API Access

- **Development**: http://localhost:8000/api
- **Docs**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

---

## Key Endpoints

### Authentication
- `POST /auth/register` — Create account
- `POST /auth/login` — Get JWT token
- `GET /auth/me` — Current user info

### Files
- `POST /files/upload` — Upload file
- `GET /files` — List files
- `GET /files/{id}` — File details
- `GET /files/{id}/history` — Action history
- `GET /files/metrics` — Dashboard metrics

### Verification
- `POST /verify/file` — Verify by file
- `GET /verify/hash/{hash}` — Verify by hash

### Blockchain
- `POST /blockchain/register/{id}` — Register on-chain
- `GET /blockchain/object/{id}` — Object details
- `GET /blockchain/object/{id}/history` — History

### Admin
- `GET /admin/users` — List users
- `PATCH /admin/users/{id}` — Update user
- `DELETE /admin/users/{id}` — Delete user

Full documentation in [docs/api.md](docs/api.md)

---

## Support & Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check PostgreSQL service: `docker compose ps`
   - View logs: `docker compose logs db`
   - Verify environment variables in `.env`

2. **Blockchain contract not found**
   - Ensure blockchain service is running
   - Check contract was deployed: `docker compose logs blockchain`
   - See [docs/blockchain_design.md](docs/blockchain_design.md)

3. **Frontend can't reach API**
   - Check backend is running: `docker compose ps`
   - Verify CORS in configuration
   - Check browser console for errors

4. **Tests fail**
   - Ensure services are running: `docker compose up --build`
   - Check database is initialized: `docker compose exec backend alembic upgrade head`
   - See [TESTING.md](TESTING.md) for troubleshooting

### Documentation References

- **Architecture**: [docs/architecture.md](docs/architecture.md)
- **Security**: [docs/security.md](docs/security.md)
- **Blockchain**: [docs/blockchain_design.md](docs/blockchain_design.md)
- **Deployment**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Testing**: [TESTING.md](TESTING.md)
- **API**: [docs/api.md](docs/api.md)

---

## Project Status

✅ **Complete & Production-Ready**

### Completed Phases

- **Phase 1**: Core UI foundation and basic functionality
- **Phase 2**: Enhanced features (admin panel, blockchain history, action timeline)
- **Phase 3**: Security hardening (rate limiting, input validation, sanitization)
- **Phase 4**: Production readiness (deployment guide, CI/CD, documentation)

### Quality Metrics

- ✅ Error handling: Comprehensive with safe messages
- ✅ Input validation: Server-side and client-side
- ✅ Security: Rate limiting, CORS, sanitization
- ✅ Documentation: Complete with examples
- ✅ Deployment: Production-ready configs
- ✅ Testing: Unit, integration, and manual test guides

---

## Contributing

To extend or modify the system:

1. See [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) for architecture overview
2. Follow existing patterns in code
3. Update tests in [TESTING.md](TESTING.md)
4. Document changes in appropriate `docs/*.md` files

---

## License & Attribution

This is a diploma project demonstrating a blockchain-based file registry system.

---

## Quick Navigation

| Need | Document |
|------|----------|
| How to start? | [README.md](README.md) |
| API endpoints? | [docs/api.md](docs/api.md) |
| Deploy to production? | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| How does it work? | [docs/architecture.md](docs/architecture.md) |
| How to test? | [TESTING.md](TESTING.md) |
| Complete overview? | [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) |
| Security details? | [docs/security.md](docs/security.md) |
| Blockchain info? | [docs/blockchain_design.md](docs/blockchain_design.md) |

---

**Last Updated**: January 2024  
**Project Version**: 1.0.0  
**Status**: Complete ✅
