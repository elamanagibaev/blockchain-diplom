# Deployment Guide

This guide covers deploying the Blockchain File Registry to production.

## Prerequisites

- Docker & Docker Compose installed
- A domain name (for production)
- SSL/TLS certificates (recommended)
- Environment configuration file (`.env.prod`)

## Local Development

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd blockchain-diplom

# Create environment file
cp .env.example .env

# Build and start services
docker compose up --build
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/docs
- MinIO Console: http://localhost:9001

### Create Admin User

```bash
docker compose exec backend python -m app.scripts.create_admin
```

Default credentials: `admin@example.com` / `admin`

## Production Deployment

### 1. Prepare Environment

Create `.env.prod` with secure values:

```env
# Security
SECRET_KEY=<generate-strong-random-key>
POSTGRES_PASSWORD=<secure-password>

# Blockchain (if using external RPC)
WEB3_PROVIDER_URL=https://your-rpc-provider.com
CONTRACT_ADDRESS=0x...
CONTRACT_OWNER_PRIVATE_KEY=0x...
CONTRACT_OWNER_ADDRESS=0x...

# Storage
FILE_STORAGE_BACKEND=minio
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
MINIO_BUCKET_NAME=documents

# Frontend
VITE_API_BASE_URL=https://your-domain.com/api

# CORS (restrict to your domain)
BACKEND_CORS_ORIGINS=["https://your-domain.com"]
```

### 2. Deploy with Docker Compose

```bash
# Use production compose file
docker compose -f docker-compose.prod.yml up -d

# Initialize database
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Create admin user
docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.create_admin
```

### 3. Set Up Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (static + SPA)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SPA fallback
        error_page 404 =200 /index.html;
    }
}
```

### 4. SSL/TLS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d your-domain.com

# Auto-renewal (already configured)
sudo systemctl enable certbot.timer
```

### 5. Database Backups

Automated daily backups:

```bash
# Create backup directory
mkdir -p /backups

# Add to crontab (daily at 2 AM)
0 2 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T db pg_dump -U app file_registry | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Retain backups for 30 days
find /backups -name "db-*.sql.gz" -mtime +30 -delete
```

### 6. Monitoring & Logging

#### Docker Logs

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db
```

#### Prometheus + Grafana (Optional)

Add to `docker-compose.prod.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

### 7. Security Checklist

- [ ] Change `SECRET_KEY` in production
- [ ] Use strong database passwords
- [ ] Restrict `BACKEND_CORS_ORIGINS` to your domain
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Set resource limits in compose file (CPU, memory)
- [ ] Keep Docker images updated: `docker compose pull`
- [ ] Monitor logs and metrics regularly
- [ ] Regular database backups
- [ ] Rotate access keys periodically

### 8. Scaling

For high-traffic deployments:

- Use multiple backend replicas behind a load balancer
- Move database to managed service (e.g., AWS RDS)
- Use S3/MinIO for file storage
- Enable caching (Redis) for frequently accessed data
- Use separate blockchain RPC provider

## Troubleshooting

### Database Connection Issues

```bash
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml exec db psql -U app -d file_registry
```

### Memory Issues

Check resource limits:
```bash
docker stats
```

Adjust in `docker-compose.prod.yml` under `deploy.resources`.

### SSL Certificate Renewal

```bash
sudo certbot renew --dry-run
sudo systemctl restart nginx
```

## Support

For issues or questions, see [README.md](../README.md) and [architecture.md](./architecture.md).
