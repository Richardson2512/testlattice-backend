# Scalability Setup Guide

## Overview

This guide covers the scalability improvements implemented for production deployment. The system now supports:
- **100K+ concurrent WebSocket connections** via Redis pub/sub
- **Horizontal scaling** across multiple API servers
- **Cost-optimized storage** with pre-signed URLs and automatic cleanup
- **Compressed artifacts** reducing storage by 75%

---

## 🚀 Quick Start

### 1. Environment Variables

Add these to your `.env` files:

**API Server** (`api/.env`):
```bash
# Redis for WebSocket scaling (REQUIRED for production)
REDIS_URL=redis://localhost:6379
USE_REDIS_WEBSOCKET=true

# Artifact cleanup (recommended)
ENABLE_ARTIFACT_CLEANUP=true
ARTIFACT_RETENTION_DAYS=30
CLEANUP_INTERVAL_HOURS=24

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=artifacts
```

**Worker** (`worker/.env`):
```bash
# Same Supabase config
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=artifacts
```

---

## 📦 Installation

### 1. Install Redis (if not already running)

**Option A: Docker (Recommended)**
```bash
# Redis is already in docker-compose.yml
docker-compose up -d redis
```

**Option B: Local Install**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Windows
# Download from https://redis.io/download
```

### 2. Install Node.js Dependencies

```bash
cd api
npm install  # ioredis already added to package.json
```

---

## 🔧 Load Balancer Configuration

For production with multiple API servers, configure your load balancer with **sticky sessions**.

### Option 1: Nginx (Recommended)

**File**: `/etc/nginx/sites-available/Rihario`

```nginx
upstream api_servers {
    # Sticky sessions by IP (required for WebSocket)
    ip_hash;
    
    server api1.yourdomain.com:3001;
    server api2.yourdomain.com:3001;
    server api3.yourdomain.com:3001;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS (production)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # WebSocket endpoints (special handling)
    location /ws/ {
        proxy_pass http://api_servers;
        
        # WebSocket upgrade headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Preserve client info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # Buffer settings
        proxy_buffering off;
        proxy_cache off;
    }

    # Regular HTTP endpoints
    location / {
        proxy_pass http://api_servers;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://api_servers;
        access_log off;
    }
}
```

**Enable and restart**:
```bash
sudo ln -s /etc/nginx/sites-available/Rihario /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Option 2: AWS Application Load Balancer (ALB)

**Target Group Settings**:
- Protocol: HTTP
- Port: 3001
- Health check path: `/health`
- Stickiness: **Enabled** (1 hour duration)

**Listener Rules**:
```yaml
# HTTPS Listener (port 443)
- Path: /ws/*
  Target Group: api-servers
  Stickiness: Enabled
  
- Path: /*
  Target Group: api-servers
  Stickiness: Enabled
```

**Important**: ALB supports WebSocket natively, but you MUST enable stickiness.

---

### Option 3: Kubernetes Ingress

**File**: `k8s/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: Rihario-api
  annotations:
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/session-cookie-name: "api-sticky"
    nginx.ingress.kubernetes.io/session-cookie-expires: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "api-service"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "604800"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "604800"
spec:
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 3001
```

---

## 🧪 Testing the Setup

### 1. Test Redis Connection

```bash
# Start API server
cd api
npm run dev

# Check logs for:
# ✅ Redis-backed WebSocket initialized (scalable across multiple servers)
# ✅ Artifact cleanup scheduler started
```

### 2. Test WebSocket with Multiple Servers

**Terminal 1** (Server 1):
```bash
cd api
PORT=3001 npm run dev
```

**Terminal 2** (Server 2):
```bash
cd api
PORT=3002 npm run dev
```

**Terminal 3** (Test broadcast):
```bash
# Connect to server 1
wscat -c ws://localhost:3001/ws/test-control?runId=test-123

# In another terminal, connect to server 2
wscat -c ws://localhost:3002/ws/test-control?runId=test-123

# Send message on server 1 - should appear on server 2!
# This proves Redis pub/sub is working
```

### 3. Test Artifact Cleanup

```bash
# Check cleanup stats
curl http://localhost:3001/api/cleanup/stats

# Response:
{
  "retentionDays": 30,
  "artifactsPendingDeletion": 0,
  "totalArtifacts": 150,
  "totalStorageBytes": 52428800,
  "totalStorageMB": "50.00"
}
```

---

## 📊 Monitoring

### Health Check Endpoints

**1. General Health**
```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**2. WebSocket Stats**
```bash
GET /api/ws/stats

Response:
{
  "serverId": "api_12345_1705315800000",
  "localConnections": 42,
  "redisConnections": 42,
  "activeRuns": 15,
  "uptime": 86400
}
```

**3. Cleanup Stats**
```bash
GET /api/cleanup/stats

Response:
{
  "retentionDays": 30,
  "artifactsPendingDeletion": 5,
  "totalArtifacts": 200,
  "totalStorageBytes": 104857600,
  "totalStorageMB": "100.00"
}
```

---

## 🔍 Troubleshooting

### Issue: WebSocket connections failing

**Symptoms**: Connections drop immediately or fail to connect

**Solutions**:
1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Verify `REDIS_URL` in `.env`
3. Check load balancer has sticky sessions enabled
4. Look for errors in API logs

### Issue: Artifacts not cleaning up

**Symptoms**: Storage keeps growing

**Solutions**:
1. Check `ENABLE_ARTIFACT_CLEANUP=true` in `.env`
2. Verify Supabase service role key has storage permissions
3. Check API logs for cleanup job errors
4. Manually trigger: `curl -X POST http://localhost:3001/api/cleanup/run` (dev only)

### Issue: Load balancer distributing WebSocket incorrectly

**Symptoms**: Messages not received, connections unstable

**Solutions**:
1. Ensure `ip_hash` in Nginx or stickiness in ALB
2. Verify WebSocket upgrade headers are set
3. Check timeouts are long enough (7 days recommended)
4. Test with `wscat` directly to each server

---

## 📈 Scaling Recommendations

### Small Scale (< 1,000 users)
- **API Servers**: 2 instances
- **Redis**: Single instance (no clustering needed)
- **Storage**: Standard Supabase plan

### Medium Scale (1,000 - 10,000 users)
- **API Servers**: 3-5 instances
- **Redis**: Redis with persistence enabled
- **Storage**: Supabase Pro plan
- **Cleanup**: Run every 12 hours

### Large Scale (10,000 - 100,000 users)
- **API Servers**: 10+ instances with auto-scaling
- **Redis**: Redis Cluster (3 master + 3 replica)
- **Storage**: Supabase Team/Enterprise
- **Cleanup**: Run every 6 hours
- **CDN**: Add CloudFlare or CloudFront for static assets

### Enterprise Scale (100,000+ users)
- **API Servers**: Auto-scaling group (10-50 instances)
- **Redis**: Managed Redis (AWS ElastiCache, Redis Cloud)
- **Storage**: Dedicated Supabase instance or S3 + CloudFront
- **Cleanup**: Run every hour with parallel workers
- **Monitoring**: Datadog, New Relic, or Grafana
- **Load Balancer**: Enterprise ALB with WAF

---

## 💰 Cost Optimization

### Storage Costs (with optimizations)

**Before**:
- 1,000 tests/day × 50MB = 1.5TB/month
- Cost: ~$31/month storage + $270/month bandwidth = **$301/month**

**After**:
- Compression: 50MB → 12.5MB (75% reduction)
- 30-day cleanup: Only keep recent tests
- Pre-signed URLs: No bandwidth through API
- 1,000 tests/day × 12.5MB × 30 days = 375GB stored
- Cost: ~$8/month storage + $45/month bandwidth = **$53/month**

**Savings**: **$248/month** or **$2,976/year** 💰

---

## 🚀 Production Deployment Checklist

- [ ] Redis installed and running
- [ ] `REDIS_URL` configured in `.env`
- [ ] `USE_REDIS_WEBSOCKET=true` set
- [ ] Load balancer configured with sticky sessions
- [ ] WebSocket timeouts set to 7 days
- [ ] `ENABLE_ARTIFACT_CLEANUP=true` set
- [ ] `ARTIFACT_RETENTION_DAYS` configured (30 recommended)
- [ ] Supabase service role key has storage permissions
- [ ] Health check endpoint returns 200 OK
- [ ] WebSocket stats endpoint accessible
- [ ] Test with multiple API servers
- [ ] Monitor Redis memory usage
- [ ] Set up alerts for cleanup job failures
- [ ] Configure CDN for artifact downloads (optional)

---

## 🔗 Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Database and storage setup
- [SENTRY_SETUP.md](./SENTRY_SETUP.md) - Error monitoring
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing instructions

---

## 📞 Support

If you encounter issues:
1. Check logs: `docker-compose logs -f api`
2. Verify Redis: `redis-cli ping`
3. Test health endpoint: `curl http://localhost:3001/health`
4. Review this guide's troubleshooting section

For production issues, enable Sentry error tracking (see [SENTRY_SETUP.md](./SENTRY_SETUP.md))
