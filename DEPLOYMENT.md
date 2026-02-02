# AWS Deployment Guide for Guess the Drawing
**Complete Step-by-Step Guide with Service Explanations**

---

## Table of Contents
1. [AWS Services Overview](#aws-services-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Prerequisites](#prerequisites)
4. [Deployment Phases](#deployment-phases)
5. [Cost Analysis](#cost-analysis)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## AWS Services Overview

### 1. Amazon S3 (Simple Storage Service)
**What it is:** Object storage service for storing and retrieving any amount of data.

**Why we need it:** Hosts the Angular frontend's static files (HTML, CSS, JavaScript). S3 is perfect for static websites because:
- Highly durable and available (99.999999999% durability)
- Cost-effective for static content
- Integrates seamlessly with CloudFront
- No server management required

**For this app:** Stores the compiled Angular application (`index.html`, `.js` bundles, assets).

**Free Tier:** 5GB storage, 20,000 GET requests, 2,000 PUT requests per month

---

### 2. Amazon CloudFront
**What it is:** Content Delivery Network (CDN) that distributes content globally with low latency.

**Why we need it:** 
- Provides HTTPS/SSL for free (AWS Certificate Manager)
- Caches frontend files at edge locations worldwide for faster load times
- Acts as a reverse proxy to S3
- Handles Angular's client-side routing (SPA support)

**For this app:** Serves the frontend to users globally with HTTPS, improving load times for players in different regions.

**Free Tier:** 1TB data transfer out, 10,000,000 HTTP/HTTPS requests per month

---

### 3. Amazon EC2 (Elastic Compute Cloud)
**What it is:** Virtual servers (instances) in the cloud where you can run applications.

**Why we need it:** Runs the Node.js/Express/Socket.IO backend server because:
- Socket.IO requires a persistent WebSocket connection (not suitable for serverless)
- Needs to maintain real-time bidirectional communication for the game
- Free tier provides 750 hours/month (24/7 operation)

**For this app:** Hosts the backend API and WebSocket server that manages game rooms, drawing synchronization, and chat.

**Free Tier:** 750 hours/month of t2.micro or t3.micro instances (12 months)

---

### 4. Amazon RDS (Relational Database Service)
**What it is:** Managed database service that handles PostgreSQL, MySQL, and other relational databases.

**Why we need it:** 
- Fully managed PostgreSQL database (automated backups, patches, monitoring)
- Better than self-hosting PostgreSQL on EC2 because AWS handles:
  - Automatic backups (7-day retention)
  - Software patching
  - Multi-AZ failover (if needed later)
  - Point-in-time recovery

**For this app:** Stores persistent data:
- User accounts and authentication
- Game history and statistics
- Player scores and rankings
- Word bank for the drawing game
- Friend relationships

**Free Tier:** 750 hours/month of db.t3.micro instances, 20GB storage (12 months)

---

### 5. Amazon ElastiCache (Redis)
**What it is:** Managed in-memory data store (Redis or Memcached).

**Why we need it:** 
- Socket.IO requires Redis adapter for horizontal scaling
- Pub/Sub messaging for real-time events across multiple EC2 instances
- Session storage for JWT refresh tokens
- Caching frequently accessed data (word lists, active games)

**For this app:** 
- Synchronizes WebSocket events across server instances
- Stores active game room state
- Caches real-time player connections
- Enables future horizontal scaling of backend

**Free Tier:** 750 hours/month of cache.t2.micro or cache.t3.micro nodes (12 months)

---

### 6. AWS IAM (Identity and Access Management)
**What it is:** Service for managing access to AWS resources securely.

**Why we need it:** 
- Never use root account for deployments (security best practice)
- Create users with specific permissions for CI/CD pipelines
- Fine-grained access control

**For this app:** Creates a deployment user with permissions to access S3, EC2, CloudFront for automated deployments.

**Cost:** Free

---

### 7. Amazon VPC (Virtual Private Cloud)
**What it is:** Isolated virtual network where you launch AWS resources.

**Why we need it:** 
- Provides network isolation and security
- Allows private communication between EC2, RDS, and ElastiCache
- Controls inbound/outbound traffic with Security Groups

**For this app:** Creates a private network where the backend (EC2) can securely communicate with the database (RDS) and cache (Redis) without exposing them to the internet.

**Cost:** Free (default VPC provided)

---

### 8. AWS Security Groups
**What it is:** Virtual firewalls that control inbound and outbound traffic to AWS resources.

**Why we need it:** 
- Controls which ports are accessible
- Limits database access to only the backend server
- Allows public access only to necessary ports (HTTP/HTTPS)

**For this app:** 
- EC2: Allows port 22 (SSH), 3000 (backend API)
- RDS: Allows port 5432 only from EC2 security group
- ElastiCache: Allows port 6379 only from EC2 security group

**Cost:** Free

---

### 9. Elastic IP
**What it is:** Static public IPv4 address for your EC2 instance.

**Why we need it:** 
- Prevents IP address from changing when EC2 restarts
- Free as long as it's attached to a running instance
- Simplifies DNS and frontend configuration

**For this app:** Provides a stable IP address for the backend API that the frontend can reliably connect to.

**Cost:** Free while attached to running instance, $0.005/hour if unattached

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                               │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
                 │ HTTPS                      │ WebSocket/HTTP
                 ▼                            ▼
        ┌─────────────────┐          ┌──────────────────┐
        │   CloudFront    │          │   Elastic IP     │
        │      (CDN)      │          │                  │
        └────────┬────────┘          └────────┬─────────┘
                 │                            │
                 │ S3 Static Files            │
                 ▼                            ▼
        ┌─────────────────┐          ┌──────────────────┐
        │   S3 Bucket     │          │   EC2 t2.micro   │
        │  (Frontend)     │          │  (Node.js/PM2)   │
        │  Angular Build  │          │   Backend API    │
        └─────────────────┘          └────────┬─────────┘
                                              │
                    ┌─────────────────────────┼─────────────────┐
                    │                         │                 │
                    ▼                         ▼                 ▼
         ┌──────────────────┐    ┌──────────────────┐  ┌──────────────┐
         │  ElastiCache     │    │   RDS PostgreSQL │  │  VPC/Subnets │
         │  (Redis)         │    │   (Database)     │  │  Security    │
         │  - Sessions      │    │   - Users        │  │  Groups      │
         │  - Pub/Sub       │    │   - Games        │  │              │
         │  - Cache         │    │   - Stats        │  │              │
         └──────────────────┘    └──────────────────┘  └──────────────┘
                                                               
                    ┌─────────────────────────────────────┐
                    │     GitHub Actions CI/CD            │
                    │  - Build Frontend → S3              │
                    │  - Deploy Backend → EC2             │
                    └─────────────────────────────────────┘
```

---

## Prerequisites

### Required Tools
- [ ] AWS Account (free tier eligible)
- [ ] AWS CLI installed (`brew install awscli`)
- [ ] Node.js 20+ installed
- [ ] Git installed
- [ ] GitHub account with repository
- [ ] Payment method (for AWS verification, won't be charged in free tier)

### Required Knowledge
- Basic Linux command line
- SSH connections
- Environment variables
- Git version control

---

## Deployment Phases

### Phase 1: AWS Account Setup

**Estimated Time:** 15 minutes

#### 1.1 Create AWS Account
1. Visit [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Enter email, password, AWS account name
4. Add payment method (required but won't be charged)
5. Verify identity via phone
6. Choose "Free" support plan

#### 1.2 Enable MFA on Root Account
1. IAM Console → Dashboard → Add MFA
2. Use Google Authenticator or similar
3. Save recovery codes in secure location

#### 1.3 Create IAM User for Deployment
1. Go to IAM Console → Users → Create User
2. User name: `guess-drawing-deploy`
3. Enable "Provide user access to the AWS Management Console" (optional)
4. Attach policies directly:
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AmazonEC2FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonElastiCacheFullAccess`
5. Create user
6. Security credentials tab → Create access key
7. Use case: Command Line Interface (CLI)
8. Download credentials CSV file

**Save these values:**
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

#### 1.4 Configure AWS CLI
```bash
# Install AWS CLI (macOS)
brew install awscli

# Configure with IAM credentials
aws configure
# AWS Access Key ID: [paste your access key]
# AWS Secret Access Key: [paste your secret key]
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

---

### Phase 2: Database Setup (RDS PostgreSQL)

**Estimated Time:** 15 minutes (plus 10 minutes wait for provisioning)

#### 2.1 Create RDS Security Group
```bash
# Create security group for RDS
SG_RDS=$(aws ec2 create-security-group \
  --group-name guess-drawing-rds-sg \
  --description "Security group for RDS PostgreSQL" \
  --query 'GroupId' --output text)

echo "RDS Security Group ID: $SG_RDS"

# Allow PostgreSQL from within VPC
aws ec2 authorize-security-group-ingress \
  --group-id $SG_RDS \
  --protocol tcp \
  --port 5432 \
  --cidr 172.31.0.0/16
```

#### 2.2 Create DB Subnet Group
```bash
# List available subnets in default VPC
aws ec2 describe-subnets \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' \
  --output table

# Create subnet group (replace subnet IDs with your subnets from different AZs)
aws rds create-db-subnet-group \
  --db-subnet-group-name guess-drawing-subnet-group \
  --db-subnet-group-description "Subnet group for guess drawing DB" \
  --subnet-ids subnet-xxxxx subnet-yyyyy
```

#### 2.3 Launch RDS PostgreSQL Instance
```bash
# Generate secure password
DB_PASSWORD=$(openssl rand -base64 16)
echo "Database Password: $DB_PASSWORD" # SAVE THIS!

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier guess-drawing-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --no-publicly-accessible \
  --vpc-security-group-ids $SG_RDS \
  --db-subnet-group-name guess-drawing-subnet-group \
  --db-name guess_drawing \
  --backup-retention-period 7 \
  --no-multi-az

# Wait for DB to be available (~10 minutes)
echo "Waiting for RDS to become available (this takes ~10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier guess-drawing-db

# Get endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier guess-drawing-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

**Save these values:**
```
RDS_ENDPOINT=guess-drawing-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PASSWORD=your-generated-password
```

---

### Phase 3: Cache Setup (ElastiCache Redis)

**Estimated Time:** 10 minutes (plus 5 minutes wait for provisioning)

#### 3.1 Create ElastiCache Security Group
```bash
# Create security group for Redis
SG_REDIS=$(aws ec2 create-security-group \
  --group-name guess-drawing-redis-sg \
  --description "Security group for ElastiCache Redis" \
  --query 'GroupId' --output text)

echo "Redis Security Group ID: $SG_REDIS"

# Allow Redis from within VPC
aws ec2 authorize-security-group-ingress \
  --group-id $SG_REDIS \
  --protocol tcp \
  --port 6379 \
  --cidr 172.31.0.0/16
```

#### 3.2 Create Cache Subnet Group
```bash
# Use same subnets as RDS
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name guess-drawing-cache-subnet \
  --cache-subnet-group-description "Subnet group for guess drawing cache" \
  --subnet-ids subnet-xxxxx subnet-yyyyy
```

#### 3.3 Launch ElastiCache Redis
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id guess-drawing-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --security-group-ids $SG_REDIS \
  --cache-subnet-group-name guess-drawing-cache-subnet

# Wait for cache to be available (~5 minutes)
echo "Waiting for ElastiCache to become available (this takes ~5 minutes)..."
aws elasticache wait cache-cluster-available --cache-cluster-id guess-drawing-redis

# Get endpoint
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id guess-drawing-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text)

echo "Redis Endpoint: $REDIS_ENDPOINT"
```

**Save this value:**
```
REDIS_ENDPOINT=guess-drawing-redis.xxxxx.cache.amazonaws.com
```

---

### Phase 4: Backend Deployment (EC2)

**Estimated Time:** 30 minutes

#### 4.1 Create EC2 Security Group
```bash
# Create security group for EC2
SG_EC2=$(aws ec2 create-security-group \
  --group-name guess-drawing-ec2-sg \
  --description "Security group for EC2 backend" \
  --query 'GroupId' --output text)

echo "EC2 Security Group ID: $SG_EC2"

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_EC2 \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Allow backend port (3000)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_EC2 \
  --protocol tcp --port 3000 --cidr 0.0.0.0/0
```

#### 4.2 Update Database/Cache Security Groups
```bash
# Allow RDS access from EC2
aws ec2 authorize-security-group-ingress \
  --group-id $SG_RDS \
  --protocol tcp --port 5432 \
  --source-group $SG_EC2

# Allow Redis access from EC2
aws ec2 authorize-security-group-ingress \
  --group-id $SG_REDIS \
  --protocol tcp --port 6379 \
  --source-group $SG_EC2
```

#### 4.3 Create SSH Key Pair
```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name guess-drawing-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/guess-drawing-key.pem

# Set proper permissions
chmod 400 ~/.ssh/guess-drawing-key.pem
```

#### 4.4 Launch EC2 Instance
```bash
# Get latest Amazon Linux 2023 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023.*-x86_64" "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t2.micro \
  --key-name guess-drawing-key \
  --security-group-ids $SG_EC2 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=guess-drawing-backend}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
```

#### 4.5 Allocate and Attach Elastic IP
```bash
# Allocate Elastic IP
ALLOCATION_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --query 'AllocationId' \
  --output text)

# Associate with instance
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $ALLOCATION_ID

# Get public IP
ELASTIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids $ALLOCATION_ID \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Elastic IP: $ELASTIC_IP"
```

**Save this value:**
```
ELASTIC_IP=xx.xx.xx.xx
```

#### 4.6 Connect and Configure EC2
```bash
# Wait for SSH to be ready
sleep 60

# Connect via SSH
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
```

**Inside the EC2 instance, run:**

```bash
# Update system
sudo yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install PostgreSQL client
sudo yum install -y postgresql15

# Install PM2 globally
sudo npm install -g pm2

# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone repository (replace with your repo URL)
git clone https://github.com/YOUR_USERNAME/my-bmad.git
cd my-bmad/guess-drawing-backend
```

#### 4.7 Create Environment File
```bash
# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3000

# Database
DATABASE_HOST=$RDS_ENDPOINT
DATABASE_PORT=5432
DATABASE_NAME=guess_drawing
DATABASE_USER=postgres
DATABASE_PASSWORD=$DB_PASSWORD
DATABASE_SSL=true

# Redis
REDIS_HOST=$REDIS_ENDPOINT
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (update after CloudFront setup)
CORS_ORIGIN=http://localhost:4200

# Game settings
MAX_PLAYERS_PER_ROOM=8
ROUND_DURATION=90
ROUNDS_PER_GAME=3
EOF

echo "Environment file created!"
```

#### 4.8 Run Database Migrations
```bash
# Set PostgreSQL password
export PGPASSWORD="$DB_PASSWORD"

# Run schema
psql -h $RDS_ENDPOINT -U postgres -d guess_drawing -f src/database/schema.sql

# Run seeds
psql -h $RDS_ENDPOINT -U postgres -d guess_drawing -f src/database/seeds.sql

# Verify tables
psql -h $RDS_ENDPOINT -U postgres -d guess_drawing -c "\dt"
```

#### 4.9 Build and Start Backend
```bash
# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js --name guess-drawing-backend

# View logs
pm2 logs guess-drawing-backend --lines 50

# Make PM2 start on system boot
pm2 startup
# Run the sudo command it outputs

# Save current process list
pm2 save
```

#### 4.10 Test Backend
```bash
# Test from EC2
curl http://localhost:3000/health

# Exit SSH
exit

# Test from your local machine
curl http://$ELASTIC_IP:3000/health
```

---

### Phase 5: Frontend Deployment (S3 + CloudFront)

**Estimated Time:** 20 minutes (plus 10-15 minutes for CloudFront deployment)

#### 5.1 Update Frontend Environment
**On your local machine:**

Edit `guess-drawing-frontend/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://YOUR_ELASTIC_IP:3000/api/v1',
  wsUrl: 'ws://YOUR_ELASTIC_IP:3000'
};
```

Replace `YOUR_ELASTIC_IP` with the actual Elastic IP from Phase 4.

#### 5.2 Build Frontend
```bash
cd guess-drawing-frontend
npm install
npm run build -- --configuration=production

# Verify build
ls -la dist/guess-drawing-frontend/browser/
```

#### 5.3 Create S3 Bucket
```bash
# Generate unique bucket name
BUCKET_NAME="guess-drawing-frontend-$(date +%s)"
echo "Bucket name: $BUCKET_NAME"

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region us-east-1

# Disable block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

#### 5.4 Configure Bucket Policy
```bash
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
```

#### 5.5 Upload Frontend Files
```bash
aws s3 sync dist/guess-drawing-frontend/browser/ s3://$BUCKET_NAME --delete

# Verify
aws s3 ls s3://$BUCKET_NAME/
```

#### 5.6 Create CloudFront Distribution
```bash
cat > cloudfront-config.json << EOF
{
  "CallerReference": "guess-drawing-$(date +%s)",
  "Comment": "Guess the Drawing Frontend",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true
}
EOF

# Create distribution
DISTRIBUTION_ID=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --query 'Distribution.Id' \
  --output text)

echo "CloudFront Distribution ID: $DISTRIBUTION_ID"

# Get CloudFront domain
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.DomainName' \
  --output text)

echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "Frontend URL: https://$CLOUDFRONT_DOMAIN"
```

**Save these values:**
```
S3_BUCKET_NAME=guess-drawing-frontend-1234567890
CLOUDFRONT_DISTRIBUTION_ID=E1234ABCD5678
CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
```

**Note:** CloudFront deployment takes 10-15 minutes. Check status:
```bash
aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'
```

#### 5.7 Update Backend CORS
```bash
# SSH back into EC2
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP

# Update CORS in .env
cd ~/apps/my-bmad/guess-drawing-backend
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$CLOUDFRONT_DOMAIN|" .env

# Restart backend
pm2 restart guess-drawing-backend

# Verify
pm2 logs guess-drawing-backend --lines 20

exit
```

---

### Phase 6: CI/CD Setup (GitHub Actions)

**Estimated Time:** 15 minutes

#### 6.1 Add GitHub Secrets
1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret" for each:

| Secret Name | Value | Example |
|------------|-------|---------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key | AKIA... |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key | ... |
| `AWS_REGION` | AWS region | us-east-1 |
| `S3_BUCKET_NAME` | Your S3 bucket name | guess-drawing-frontend-1234567890 |
| `CLOUDFRONT_DISTRIBUTION_ID` | Your distribution ID | E1234ABCD5678 |
| `EC2_HOST` | Your Elastic IP | xx.xx.xx.xx |
| `EC2_SSH_KEY` | Contents of `~/.ssh/guess-drawing-key.pem` | -----BEGIN RSA PRIVATE KEY----- ... |
| `EC2_USER` | EC2 username | ec2-user |

#### 6.2 Create GitHub Workflows Directory
```bash
# On your local machine
cd /Users/s.jelenic/Documents/Development/my-bmad
mkdir -p .github/workflows
```

#### 6.3 Create Frontend Workflow
Create `.github/workflows/deploy-frontend.yml`:
```yaml
name: Deploy Frontend to AWS

on:
  push:
    branches: [main]
    paths:
      - 'guess-drawing-frontend/**'
      - '.github/workflows/deploy-frontend.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: guess-drawing-frontend/package-lock.json

      - name: Install dependencies
        working-directory: guess-drawing-frontend
        run: npm ci

      - name: Build production
        working-directory: guess-drawing-frontend
        run: npm run build -- --configuration=production

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Deploy to S3
        run: |
          aws s3 sync guess-drawing-frontend/dist/guess-drawing-frontend/browser/ \
            s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html"
          
          aws s3 cp guess-drawing-frontend/dist/guess-drawing-frontend/browser/index.html \
            s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "public, max-age=0, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      - name: Deployment summary
        run: |
          echo "✅ Frontend deployed successfully!"
          echo "🌐 CloudFront URL: https://$(aws cloudfront get-distribution --id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --query 'Distribution.DomainName' --output text)"
```

#### 6.4 Create Backend Workflow
Create `.github/workflows/deploy-backend.yml`:
```yaml
name: Deploy Backend to AWS

on:
  push:
    branches: [main]
    paths:
      - 'guess-drawing-backend/**'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            echo "📦 Pulling latest code..."
            cd ~/apps/my-bmad/guess-drawing-backend
            git pull origin main
            
            echo "📥 Installing dependencies..."
            npm ci --only=production
            
            echo "🔨 Building TypeScript..."
            npm run build
            
            echo "🔄 Restarting application..."
            pm2 restart guess-drawing-backend
            
            echo "✅ Deployment complete!"
            pm2 info guess-drawing-backend

      - name: Deployment summary
        run: |
          echo "✅ Backend deployed successfully!"
          echo "🚀 API URL: http://${{ secrets.EC2_HOST }}:3000"
```

#### 6.5 Test CI/CD
```bash
# Commit and push workflows
git add .github/workflows/
git commit -m "Add GitHub Actions CI/CD workflows"
git push origin main

# Watch GitHub Actions tab in your repository
```

---

## Cost Analysis

### AWS Free Tier (First 12 Months)

| Service | Free Tier Allocation | Expected Usage | Cost |
|---------|---------------------|----------------|------|
| **EC2 t2.micro** | 750 hours/month | ~720 hours (24/7) | $0 |
| **RDS db.t3.micro** | 750 hours/month | ~720 hours (24/7) | $0 |
| **ElastiCache t3.micro** | 750 hours/month | ~720 hours (24/7) | $0 |
| **RDS Storage** | 20 GB | ~5 GB | $0 |
| **S3 Storage** | 5 GB | ~100 MB | $0 |
| **S3 Requests** | 20,000 GET, 2,000 PUT | Minimal | $0 |
| **CloudFront** | 1 TB data transfer | Depends on traffic | $0 |
| **Elastic IP** | 1 IP (while attached) | 1 IP | $0 |
| **Data Transfer** | 100 GB out/month | Variable | $0 |

**Total Monthly Cost (First 12 Months): $0**

### After Free Tier (12+ Months)

| Service | Monthly Cost |
|---------|--------------|
| EC2 t2.micro | ~$8.50 |
| RDS db.t3.micro | ~$12.00 |
| ElastiCache t3.micro | ~$12.00 |
| S3 + Requests | ~$0.50 |
| CloudFront | ~$1.00 (low traffic) |
| Data Transfer | ~$1.00 |
| **Total** | **~$35/month** |

### Cost Optimization Tips
1. **Stop development instances** when not in use
2. **Use Reserved Instances** after free tier (save 30-70%)
3. **Enable CloudWatch alarms** to monitor costs
4. **Use S3 lifecycle policies** to delete old logs
5. **Consider AWS Lightsail** ($3.50/month) for simpler stack after free tier

---

## Verification Checklist

### Infrastructure Verification

- [ ] **AWS Account Setup**
  - [ ] IAM user created with appropriate permissions
  - [ ] AWS CLI configured and authenticated
  - [ ] MFA enabled on root account
  - [ ] Can run: `aws sts get-caller-identity`

### Database Layer

- [ ] **RDS PostgreSQL**
  - [ ] Instance is running and available
  - [ ] Security group allows EC2 access on port 5432
  - [ ] Database `guess_drawing` exists
  - [ ] Schema applied successfully (all tables created)
  - [ ] Seed data loaded (words table populated)
  - [ ] Connection string saved: `postgres://postgres:PASSWORD@RDS_ENDPOINT:5432/guess_drawing`
  - [ ] Can connect from EC2: `psql -h RDS_ENDPOINT -U postgres -d guess_drawing`

- [ ] **ElastiCache Redis**
  - [ ] Cluster is available
  - [ ] Security group allows EC2 access on port 6379
  - [ ] Endpoint saved and documented
  - [ ] Can connect from EC2: `redis-cli -h REDIS_ENDPOINT ping` → returns `PONG`

### Backend (EC2)

- [ ] **EC2 Instance**
  - [ ] Instance is running (State: running)
  - [ ] Elastic IP attached and doesn't change on reboot
  - [ ] Security group allows SSH (22), port 3000
  - [ ] Can SSH: `ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@ELASTIC_IP`
  - [ ] Node.js 20+ installed: `node --version`
  - [ ] PM2 installed: `pm2 --version`
  - [ ] PostgreSQL client installed: `psql --version`

- [ ] **Backend Application**
  - [ ] Code deployed to `~/apps/my-bmad/guess-drawing-backend`
  - [ ] `.env` file configured with correct RDS and Redis endpoints
  - [ ] Dependencies installed: `node_modules/` exists
  - [ ] TypeScript compiled: `dist/` folder exists
  - [ ] PM2 running: `pm2 status` shows `online`
  - [ ] Logs show no errors: `pm2 logs guess-drawing-backend`
  - [ ] Health endpoint responds: `curl http://localhost:3000/health`
  - [ ] Health accessible externally: `curl http://ELASTIC_IP:3000/health`
  - [ ] PM2 configured for startup: `pm2 startup` completed

- [ ] **Database Connectivity**
  - [ ] Backend can connect to RDS (check PM2 logs)
  - [ ] Backend can connect to Redis (check PM2 logs)
  - [ ] No connection timeout errors

### Frontend (S3 + CloudFront)

- [ ] **S3 Bucket**
  - [ ] Bucket created with unique name
  - [ ] Bucket policy allows public read access
  - [ ] All frontend files uploaded (index.html, *.js, assets)
  - [ ] Can list files: `aws s3 ls s3://BUCKET_NAME/`

- [ ] **CloudFront**
  - [ ] Distribution created and deployed (Status: Deployed)
  - [ ] Custom error responses configured (403/404 → index.html)
  - [ ] HTTPS enabled (default certificate)
  - [ ] Can access: `https://CLOUDFRONT_DOMAIN`
  - [ ] Angular routing works (refresh on routes doesn't 404)
  - [ ] Distribution ID saved

- [ ] **Frontend Configuration**
  - [ ] `environment.prod.ts` has correct Elastic IP
  - [ ] Production build completed without errors
  - [ ] Frontend loads without console errors

### Integration Testing

- [ ] **API Connectivity**
  - [ ] Frontend can reach backend API
  - [ ] No CORS errors in browser console
  - [ ] Network tab shows successful API calls

- [ ] **WebSocket Connection**
  - [ ] WebSocket connects successfully (check Network tab → WS)
  - [ ] Socket.IO handshake completes
  - [ ] Real-time events working

- [ ] **User Authentication**
  - [ ] Can register new user
  - [ ] Can login with credentials
  - [ ] JWT token stored
  - [ ] Protected routes work

- [ ] **Game Functionality**
  - [ ] Can create game room
  - [ ] Can join existing room
  - [ ] Drawing canvas works
  - [ ] Strokes synchronize in real-time
  - [ ] Chat messages send/receive
  - [ ] Timer counts down
  - [ ] Scoring works

### CI/CD Pipeline

- [ ] **GitHub Secrets**
  - [ ] All 8 secrets added to repository
  - [ ] AWS credentials valid
  - [ ] EC2 SSH key properly formatted

- [ ] **Frontend Workflow**
  - [ ] File exists: `.github/workflows/deploy-frontend.yml`
  - [ ] Workflow triggers on push to main
  - [ ] Build completes successfully
  - [ ] Files upload to S3
  - [ ] CloudFront invalidation creates

- [ ] **Backend Workflow**
  - [ ] File exists: `.github/workflows/deploy-backend.yml`
  - [ ] Workflow triggers on push to main
  - [ ] SSH connection succeeds
  - [ ] Build completes
  - [ ] PM2 restarts successfully

### Security Checklist

- [ ] **AWS Security**
  - [ ] Root account has MFA
  - [ ] IAM user has minimal permissions
  - [ ] No AWS credentials in code
  - [ ] Security groups follow least privilege

- [ ] **Application Security**
  - [ ] Database credentials in `.env` (not in code)
  - [ ] JWT secrets randomly generated (32+ chars)
  - [ ] CORS configured for CloudFront domain only
  - [ ] PostgreSQL not publicly accessible
  - [ ] Redis not publicly accessible
  - [ ] HTTPS enabled on frontend

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Cannot SSH into EC2
**Symptoms:** `Permission denied (publickey)` or `Connection timed out`

**Solutions:**
```bash
# Check key permissions
chmod 400 ~/.ssh/guess-drawing-key.pem

# Verify security group
aws ec2 describe-security-groups --group-ids $SG_EC2

# Try verbose mode
ssh -v -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
```

#### 2. Backend Cannot Connect to RDS
**Symptoms:** PM2 logs show `Connection refused` or `timeout`

**Solutions:**
```bash
# Check security group allows EC2 → RDS
aws ec2 describe-security-groups --group-ids $SG_RDS

# Test from EC2
psql -h $RDS_ENDPOINT -U postgres -d guess_drawing

# Verify .env variables
cat ~/apps/my-bmad/guess-drawing-backend/.env | grep DATABASE
```

#### 3. Frontend Shows CORS Errors
**Symptoms:** Browser console: `Access to XMLHttpRequest blocked by CORS`

**Solutions:**
```bash
# Verify CORS_ORIGIN matches CloudFront domain exactly (with https://)
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
cat ~/apps/my-bmad/guess-drawing-backend/.env | grep CORS

# Update CORS_ORIGIN
nano ~/apps/my-bmad/guess-drawing-backend/.env
# CORS_ORIGIN=https://d1234abcd.cloudfront.net

# Restart
pm2 restart guess-drawing-backend
```

#### 4. WebSocket Connection Fails
**Symptoms:** Browser console: `WebSocket connection failed`

**Solutions:**
```bash
# Check EC2 security group allows port 3000
aws ec2 describe-security-groups --group-ids $SG_EC2

# Verify backend listening
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
sudo netstat -tlnp | grep 3000

# Check PM2 logs
pm2 logs guess-drawing-backend --lines 100
```

#### 5. CloudFront Serving Old Content
**Symptoms:** Changes deployed but not visible

**Solutions:**
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

# Wait 5-10 minutes
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
```

#### 6. GitHub Actions Fails
**Symptoms:** Red X on Actions tab

**Solutions:**
- Verify all secrets added correctly
- AWS credentials valid: `aws sts get-caller-identity`
- S3 bucket name correct
- EC2 SSH key includes headers: `-----BEGIN RSA PRIVATE KEY-----`
- Check workflow logs for specific error

#### 7. PM2 Not Starting After Reboot
**Symptoms:** Backend down after EC2 restart

**Solutions:**
```bash
# Set up startup script
pm2 startup
# Run the command it outputs

# Save process list
pm2 save

# Test
sudo reboot
```

---

## Maintenance

### Daily Tasks
- [ ] Monitor application logs: `pm2 logs guess-drawing-backend`
- [ ] Check for errors in CloudWatch

### Weekly Tasks
- [ ] Review AWS Free Tier usage: Billing Dashboard
- [ ] Check PM2 process health: `pm2 status`
- [ ] Review CloudWatch metrics

### Monthly Tasks
- [ ] Review RDS automated backups
- [ ] Update system: `sudo yum update -y`
- [ ] Check for npm updates: `npm outdated`

### Quarterly Tasks
- [ ] Rotate JWT secrets
- [ ] Review security groups
- [ ] Analyze CloudFront cache performance

---

## Quick Reference

### Important Endpoints
```bash
# Backend Health Check
curl http://ELASTIC_IP:3000/health

# Frontend
https://CLOUDFRONT_DOMAIN

# Database Connection
psql -h RDS_ENDPOINT -U postgres -d guess_drawing

# Redis Connection
redis-cli -h REDIS_ENDPOINT ping
```

### Essential Commands
```bash
# SSH to EC2
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@ELASTIC_IP

# PM2 Commands
pm2 status
pm2 logs guess-drawing-backend
pm2 restart guess-drawing-backend
pm2 stop guess-drawing-backend

# Deploy Frontend
cd guess-drawing-frontend
npm run build -- --configuration=production
aws s3 sync dist/guess-drawing-frontend/browser/ s3://BUCKET_NAME --delete
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

### Saved Values Template
```bash
# Keep these values in a secure location
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

RDS_ENDPOINT=guess-drawing-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PASSWORD=...
REDIS_ENDPOINT=guess-drawing-redis.xxxxx.cache.amazonaws.com

ELASTIC_IP=xx.xx.xx.xx
INSTANCE_ID=i-xxxxx

S3_BUCKET_NAME=guess-drawing-frontend-xxxxx
CLOUDFRONT_DISTRIBUTION_ID=E123456
CLOUDFRONT_DOMAIN=d123456.cloudfront.net

SG_EC2=sg-xxxxx
SG_RDS=sg-xxxxx
SG_REDIS=sg-xxxxx
```

---

## Next Steps After Deployment

1. **Custom Domain (Optional)**
   - Register domain with Route 53
   - Add CNAME to CloudFront
   - Request SSL certificate from ACM

2. **Monitoring & Alerts**
   - Set up CloudWatch alarms
   - Configure SNS notifications
   - Add application-level monitoring

3. **Scaling**
   - Add Application Load Balancer
   - Launch multiple EC2 instances
   - Configure auto-scaling

4. **Backups**
   - Verify RDS automated backups
   - Test restore procedure
   - Document disaster recovery

---

**Document Version:** 1.0  
**Last Updated:** February 2, 2026  
**For:** Guess the Drawing Application  
**AWS Free Tier:** Yes (First 12 months)
