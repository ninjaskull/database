# Ubuntu Deployment Guide

Complete step-by-step commands to deploy this application on Ubuntu Server.

---

## Prerequisites

Ubuntu 20.04 LTS or 22.04 LTS with SSH access and sudo privileges.

---

## Step 1: System Update and Essential Packages

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential build tools
sudo apt install -y curl wget git build-essential
```

---

## Step 2: Install Node.js 20.x

```bash
# Add NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

---

## Step 3: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER appuser WITH PASSWORD 'your_secure_password';
CREATE DATABASE appdb OWNER appuser;
GRANT ALL PRIVILEGES ON DATABASE appdb TO appuser;
\q
EOF

# Verify connection
PGPASSWORD='your_secure_password' psql -h localhost -U appuser -d appdb -c "SELECT version();"
```

---

## Step 4: Clone Your Application

```bash
# Create application directory
sudo mkdir -p /var/www/app
sudo chown $USER:$USER /var/www/app

# Clone your repository (replace with your repo URL)
cd /var/www/app
git clone https://github.com/yourusername/your-repo.git .

# Or upload files using scp from your local machine:
# scp -r ./* user@your-server:/var/www/app/
```

---

## Step 5: Create Environment File

```bash
# Create .env file from template
cd /var/www/app
cp .env.template .env

# Edit the .env file with your production values
nano .env
```

**Add these values to `.env`:**
```env
DATABASE_URL=postgresql://appuser:your_secure_password@localhost:5432/appdb
PGHOST=localhost
PGPORT=5432
PGUSER=appuser
PGPASSWORD=your_secure_password
PGDATABASE=appdb
PORT=5000
NODE_ENV=production
```

```bash
# Secure the .env file
chmod 600 .env
```

---

## Step 6: Install Dependencies and Build

```bash
cd /var/www/app

# Install all dependencies
npm install

# Build the application (frontend + backend)
npm run build

# Push database schema
npm run db:push
```

---

## Step 7: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application with PM2
cd /var/www/app
pm2 start dist/index.js --name "app" --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd
# Run the command that PM2 outputs

# View application logs
pm2 logs app
```

---

## Step 8: Install and Configure Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/app
```

**Add this Nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 9: Configure Firewall

```bash
# Install and configure UFW firewall
sudo apt install -y ufw

# Allow SSH (important: do this first!)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 10: Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

---

## Step 11: Verify Deployment

```bash
# Check if app is running
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# Test the application
curl http://localhost:5000
curl http://your-domain.com
```

---

## Useful Commands Reference

### Application Management
```bash
# View logs
pm2 logs app

# Restart application
pm2 restart app

# Stop application
pm2 stop app

# View application status
pm2 status
```

### Database Management
```bash
# Connect to database
PGPASSWORD='your_secure_password' psql -h localhost -U appuser -d appdb

# Push schema changes
cd /var/www/app && npm run db:push
```

### Update Deployment
```bash
# Pull latest code
cd /var/www/app
git pull origin main

# Install new dependencies
npm install

# Rebuild application
npm run build

# Push any database changes
npm run db:push

# Restart application
pm2 restart app
```

### View Logs
```bash
# Application logs
pm2 logs app

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

---

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs for errors
pm2 logs app --lines 100

# Check if port 5000 is in use
sudo lsof -i :5000

# Try running manually to see errors
cd /var/www/app
NODE_ENV=production node dist/index.js
```

### Database connection issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check if you can connect
PGPASSWORD='your_secure_password' psql -h localhost -U appuser -d appdb -c "SELECT 1;"

# Check PostgreSQL logs
sudo tail -50 /var/log/postgresql/postgresql-*-main.log
```

### Nginx not working
```bash
# Test configuration
sudo nginx -t

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -50 /var/log/nginx/error.log
```

---

## Quick Deploy Script

Save this as `deploy.sh` for future updates:

```bash
#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Pushing database schema..."
npm run db:push

echo "Restarting application..."
pm2 restart app

echo "Deployment complete!"
pm2 status
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run future deployments with:
```bash
./deploy.sh
```
