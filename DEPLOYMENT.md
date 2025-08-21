# 🚀 Deployment Guide

This guide covers multiple deployment options for the Bookmark Sync application.

## 📋 Prerequisites

- Node.js 18+ (for local/manual deployment)
- Docker & Docker Compose (for containerized deployment)
- Git
- Domain name (for production deployment)

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DB_PATH=./data/bookmarks.db

# Security
SESSION_SECRET=your-secure-session-secret-here
CORS_ORIGINS=chrome-extension://,https://yourdomain.com

# Cache (optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined

# Features
ENABLE_AUTH=false
ENABLE_ANALYTICS=false
ENABLE_EXPORT=true
```

## 🐳 Docker Deployment (Recommended)

### Quick Start with Docker Compose

1. **Clone the repository:**
```bash
git clone <your-repo-url>
cd bookmark-sync
```

2. **Create environment configuration:**
```bash
cp webapp/.env.example webapp/.env
# Edit .env with your configuration
```

3. **Start services:**
```bash
docker-compose up -d
```

4. **Verify deployment:**
```bash
curl http://localhost:3000/api/health
```

### Production Docker Deployment

1. **Create production environment file:**
```bash
# Create .env.production
cat > .env.production << EOF
NODE_ENV=production
PORT=3000
SESSION_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 16)
GRAFANA_PASSWORD=$(openssl rand -base64 16)
EOF
```

2. **Deploy with production configuration:**
```bash
docker-compose --env-file .env.production up -d
```

3. **Set up SSL (recommended):**
```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com
```

## 🖥️ Manual/Local Deployment

### Prerequisites Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm sqlite3

# macOS with Homebrew
brew install node sqlite
```

### Application Setup

1. **Install dependencies:**
```bash
cd webapp
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Initialize database:**
```bash
npm run migrate:up
```

4. **Start application:**
```bash
# Development
npm run dev

# Production
npm start
```

### Process Management with PM2

1. **Install PM2:**
```bash
npm install -g pm2
```

2. **Create PM2 configuration:**
```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'bookmark-sync',
    script: 'server.js',
    cwd: './webapp',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
```

3. **Deploy with PM2:**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## ☁️ Cloud Deployment Options

### 1. Heroku Deployment

1. **Create Heroku app:**
```bash
heroku create your-bookmark-sync-app
```

2. **Configure environment:**
```bash
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
heroku config:set DB_PATH=./data/bookmarks.db
```

3. **Add Redis addon:**
```bash
heroku addons:create heroku-redis:hobby-dev
```

4. **Deploy:**
```bash
git subtree push --prefix webapp heroku main
```

### 2. DigitalOcean App Platform

1. **Create app specification:**
```yaml
# .do/app.yaml
name: bookmark-sync
services:
- name: web
  source_dir: /webapp
  github:
    repo: your-username/bookmark-sync
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: SESSION_SECRET
    type: SECRET
```

2. **Deploy using doctl:**
```bash
doctl apps create --spec .do/app.yaml
```

### 3. AWS ECS with Fargate

1. **Build and push image:**
```bash
# Build image
docker build -t bookmark-sync ./webapp

# Tag for ECR
docker tag bookmark-sync:latest 123456789.dkr.ecr.region.amazonaws.com/bookmark-sync:latest

# Push to ECR
docker push 123456789.dkr.ecr.region.amazonaws.com/bookmark-sync:latest
```

2. **Create task definition:**
```json
{
  "family": "bookmark-sync",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "bookmark-sync",
      "image": "123456789.dkr.ecr.region.amazonaws.com/bookmark-sync:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

## 🔍 Health Monitoring

### Health Check Endpoints

- **Basic Health:** `GET /api/health`
- **Detailed Health:** `GET /api/health/detailed`
- **Performance Metrics:** `GET /api/metrics`
- **Cache Status:** `GET /api/cache/status`

### Monitoring Dashboard

Access the built-in monitoring dashboard:
```
http://your-domain.com/monitor.html
```

### External Monitoring

1. **Uptime monitoring with UptimeRobot:**
```bash
# Monitor health endpoint
curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=YOUR_API_KEY&format=json&type=1&url=https://yourdomain.com/api/health&friendly_name=Bookmark Sync"
```

2. **Performance monitoring with New Relic:**
```bash
# Add New Relic agent
npm install newrelic
```

## 🔐 Security Configuration

### SSL/TLS Setup

1. **Using Nginx with Let's Encrypt:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# Deny direct access to application port
sudo ufw deny 3000
```

## 📊 Performance Optimization

### Database Optimization

1. **SQLite WAL mode:**
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=1000000;
PRAGMA temp_store=memory;
```

2. **Database backup script:**
```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /app/data/bookmarks.db ".backup $BACKUP_DIR/bookmarks_$DATE.db"
find $BACKUP_DIR -name "bookmarks_*.db" -mtime +7 -delete
```

### Caching Strategy

1. **Redis configuration:**
```redis
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 🔄 CI/CD Pipeline

### GitHub Actions Deployment

The included `.github/workflows/ci-cd.yml` provides:

- Automated testing
- Security scanning  
- Docker image building
- Deployment to staging/production
- Release management

### Deployment Secrets

Configure these secrets in GitHub:

```bash
DOCKER_REGISTRY_TOKEN
SONAR_TOKEN
PRODUCTION_SSH_KEY
STAGING_SSH_KEY
SLACK_WEBHOOK_URL
```

## 🚨 Troubleshooting

### Common Issues

1. **Database lock errors:**
```bash
# Check for zombie processes
ps aux | grep node
kill -9 <pid>

# Reset database permissions
chmod 644 /app/data/bookmarks.db
```

2. **Memory issues:**
```bash
# Monitor memory usage
free -h
docker stats

# Increase swap (if needed)
sudo fallocate -l 2G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

3. **Port conflicts:**
```bash
# Find process using port
sudo netstat -tulpn | grep :3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <pid>
```

### Log Analysis

```bash
# Application logs
tail -f /app/logs/combined.log

# Docker logs
docker-compose logs -f app

# System logs
journalctl -u bookmark-sync -f
```

## 📝 Maintenance

### Database Maintenance

```bash
# Run migrations
npm run migrate:up

# Backup database
npm run backup-db

# Optimize database
sqlite3 /app/data/bookmarks.db "VACUUM;"
```

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose build --no-cache

# Rolling update
docker-compose up -d --force-recreate
```

### Monitoring Checklist

- [ ] Health endpoints responding
- [ ] Database connectivity
- [ ] Cache hit rate > 80%
- [ ] Memory usage < 80%
- [ ] Response time < 500ms
- [ ] Error rate < 1%
- [ ] SSL certificate valid
- [ ] Backups completing
- [ ] Logs rotating properly

## 📞 Support

For deployment issues:

1. Check the monitoring dashboard
2. Review application logs
3. Verify environment configuration
4. Test health endpoints
5. Contact the development team

---

**Happy Deploying! 🎉**