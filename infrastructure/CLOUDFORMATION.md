# CloudFormation Deployment Guide

This document supplements the main [DEPLOYMENT.md](DEPLOYMENT.md) with automated CloudFormation-based deployment.

---

## What's Automated vs Manual

### ✅ Fully Automated by CloudFormation

The following infrastructure is **automatically provisioned** by the CloudFormation templates:

1. **VPC & Networking** (`01-vpc.yaml`)
   - VPC with public and private subnets
   - Internet Gateway
   - Route tables and associations
   - Security groups for EC2, RDS, and ElastiCache

2. **RDS PostgreSQL** (`02-rds.yaml`)
   - db.t3.micro instance
   - Subnet group across multiple AZs
   - Automated backups (7-day retention)
   - CloudWatch logs export
   - Encrypted storage

3. **ElastiCache Redis** (`03-elasticache.yaml`)
   - cache.t3.micro node
   - Subnet group
   - Snapshot retention

4. **EC2 Backend** (`04-ec2.yaml`)
   - t2.micro instance with Amazon Linux 2023
   - Elastic IP (static)
   - IAM role and instance profile
   - UserData script that:
     - Installs Node.js 20, Git, PostgreSQL client, PM2
     - Clones your GitHub repository
     - Creates .env file with all connection details
     - Runs database migrations
     - Starts backend with PM2
     - Configures PM2 to start on boot

5. **S3 & CloudFront** (`05-frontend.yaml`)
   - S3 bucket for static hosting
   - Bucket policy for public read
   - CloudFront distribution with HTTPS
   - Custom error responses for Angular routing

### ⚠️ Requires Manual Steps

The following steps **cannot be fully automated** and still require manual intervention:

1. **GitHub Repository Setup**
   - Update `GitHubRepo` parameter in deployment
   - Repository must be public or SSH key configured

2. **Frontend Build & Upload**
   - Build Angular app locally
   - Update `environment.prod.ts` with backend IP
   - Sync to S3 bucket
   - Invalidate CloudFront cache

3. **GitHub Actions Setup** (Optional but recommended)
   - Add AWS credentials as GitHub secrets
   - Create workflow files (templates provided)
   - Configure CI/CD pipeline

4. **Backend CORS Update**
   - After CloudFront domain is available
   - SSH to EC2 and update CORS_ORIGIN in .env
   - Restart PM2

5. **SSH Key Pair**
   - Key pair must exist before stack deployment
   - Cannot be created by CloudFormation securely

---

## Quick Start with CloudFormation

### Prerequisites

```bash
# 1. Ensure AWS CLI is configured
aws sts get-caller-identity

# 2. Create SSH key pair first
aws ec2 create-key-pair \
  --key-name guess-drawing-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/guess-drawing-key.pem
chmod 400 ~/.ssh/guess-drawing-key.pem

# 3. Update GitHub repo URL in the deployment script
# Edit infrastructure/deploy.sh and replace YOUR_USERNAME with your GitHub username
```

### Option 1: Automated Deployment Script (Recommended)

```bash
# Make script executable
chmod +x infrastructure/deploy.sh

# Run deployment (will prompt for passwords/confirmation)
./infrastructure/deploy.sh deploy

# To destroy everything
./infrastructure/deploy.sh destroy
```

The script will:
- ✅ Generate secure passwords for DB and JWT
- ✅ Deploy all 5 CloudFormation stacks in order
- ✅ Wait for each stack to complete
- ✅ Print all endpoints and credentials
- ✅ Provide next steps

### Option 2: Manual CloudFormation Deployment

#### Step 1: Deploy VPC Stack
```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-vpc \
  --template-body file://infrastructure/cloudformation/01-vpc.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region us-east-1

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name guess-drawing-vpc
```

#### Step 2: Deploy RDS Stack
```bash
# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32)
echo "Database Password: $DB_PASSWORD" # SAVE THIS!

aws cloudformation create-stack \
  --stack-name guess-drawing-rds \
  --template-body file://infrastructure/cloudformation/02-rds.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=DBMasterPassword,ParameterValue="$DB_PASSWORD" \
  --region us-east-1

# Wait for completion (~10 minutes)
aws cloudformation wait stack-create-complete --stack-name guess-drawing-rds
```

#### Step 3: Deploy ElastiCache Stack
```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-elasticache \
  --template-body file://infrastructure/cloudformation/03-elasticache.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region us-east-1

# Wait for completion (~5 minutes)
aws cloudformation wait stack-create-complete --stack-name guess-drawing-elasticache
```

#### Step 4: Deploy Frontend Stack
```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-frontend \
  --template-body file://infrastructure/cloudformation/05-frontend.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region us-east-1

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name guess-drawing-frontend
```

#### Step 5: Deploy EC2 Backend Stack
```bash
# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
echo "JWT Secret: $JWT_SECRET" # SAVE THIS!
echo "JWT Refresh Secret: $JWT_REFRESH_SECRET" # SAVE THIS!

# Get CloudFront domain
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
  --output text)

aws cloudformation create-stack \
  --stack-name guess-drawing-ec2 \
  --template-body file://infrastructure/cloudformation/04-ec2.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=KeyName,ParameterValue=guess-drawing-key \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/YOUR_USERNAME/my-bmad.git \
    ParameterKey=DBMasterPassword,ParameterValue="$DB_PASSWORD" \
    ParameterKey=JWTSecret,ParameterValue="$JWT_SECRET" \
    ParameterKey=JWTRefreshSecret,ParameterValue="$JWT_REFRESH_SECRET" \
    ParameterKey=CloudFrontDomain,ParameterValue="https://$CLOUDFRONT_DOMAIN" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region us-east-1

# Wait for completion (~5 minutes)
aws cloudformation wait stack-create-complete --stack-name guess-drawing-ec2
```

#### Step 6: Get All Outputs
```bash
# Backend IP
aws cloudformation describe-stacks --stack-name guess-drawing-ec2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP`].OutputValue' --output text

# Frontend URL
aws cloudformation describe-stacks --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text

# Database Endpoint
aws cloudformation describe-stacks --stack-name guess-drawing-rds \
  --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' --output text

# Redis Endpoint
aws cloudformation describe-stacks --stack-name guess-drawing-elasticache \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' --output text
```

---

## Post-Deployment Steps

After CloudFormation completes, follow these manual steps:

### 1. Update Frontend Configuration

```bash
# Get backend IP
BACKEND_IP=$(aws cloudformation describe-stacks --stack-name guess-drawing-ec2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP`].OutputValue' --output text)

# Edit frontend environment
# Update guess-drawing-frontend/src/environments/environment.prod.ts:
# apiUrl: 'http://<BACKEND_IP>:3000/api/v1'
# wsUrl: 'ws://<BACKEND_IP>:3000'
```

### 2. Build and Deploy Frontend

```bash
cd guess-drawing-frontend
npm install
npm run build -- --configuration=production

# Get S3 bucket name
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)

# Upload to S3
aws s3 sync dist/guess-drawing-frontend/browser/ s3://$S3_BUCKET --delete

# Invalidate CloudFront
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)

aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

### 3. Verify Backend is Running

```bash
# SSH to EC2
BACKEND_IP=$(aws cloudformation describe-stacks --stack-name guess-drawing-ec2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP`].OutputValue' --output text)

ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$BACKEND_IP

# Check PM2 status
pm2 status
pm2 logs guess-drawing-backend --lines 50

# Test health endpoint
curl http://localhost:3000/health
```

### 4. Set Up GitHub Actions (Optional)

Create workflow files from the templates in [DEPLOYMENT.md](DEPLOYMENT.md) Phase 6.

Add these secrets to your GitHub repository:

```bash
# Get values from CloudFormation outputs
AWS_REGION=us-east-1
S3_BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)
EC2_HOST=$(aws cloudformation describe-stacks --stack-name guess-drawing-ec2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP`].OutputValue' --output text)
EC2_SSH_KEY=$(cat ~/.ssh/guess-drawing-key.pem)
EC2_USER=ec2-user
```

---

## Updating Infrastructure

### Update Single Stack

```bash
# Update RDS (e.g., change instance class)
aws cloudformation update-stack \
  --stack-name guess-drawing-rds \
  --template-body file://infrastructure/cloudformation/02-rds.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=DBMasterPassword,UsePreviousValue=true \
    ParameterKey=DBInstanceClass,ParameterValue=db.t3.small

# Wait for update
aws cloudformation wait stack-update-complete --stack-name guess-drawing-rds
```

### Update Backend Code

The backend will auto-update through:
1. **GitHub Actions** (if configured) - automatic on push
2. **SSH + PM2** - manual restart

```bash
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$BACKEND_IP
cd ~/apps/my-bmad/guess-drawing-backend
git pull origin main
npm ci --only=production
npm run build
pm2 restart guess-drawing-backend
```

---

## Destroy Infrastructure

### Option 1: Using Script

```bash
./infrastructure/deploy.sh destroy
```

### Option 2: Manual Deletion

Delete stacks in reverse order (dependencies):

```bash
# 1. EC2 (depends on everything)
aws cloudformation delete-stack --stack-name guess-drawing-ec2
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-ec2

# 2. Frontend (independent)
aws cloudformation delete-stack --stack-name guess-drawing-frontend
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-frontend

# 3. ElastiCache (depends on VPC)
aws cloudformation delete-stack --stack-name guess-drawing-elasticache
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-elasticache

# 4. RDS (depends on VPC)
aws cloudformation delete-stack --stack-name guess-drawing-rds
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-rds

# 5. VPC (no dependencies)
aws cloudformation delete-stack --stack-name guess-drawing-vpc
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-vpc
```

---

## Comparison: Manual vs CloudFormation

| Aspect | Manual (DEPLOYMENT.md) | CloudFormation (This Guide) |
|--------|------------------------|---------------------------|
| **Setup Time** | ~2 hours | ~30 minutes |
| **Commands** | ~50+ CLI commands | 1 script or 5 stack creates |
| **Error Prone** | High (manual typos) | Low (validated templates) |
| **Reproducible** | Medium | High (infrastructure as code) |
| **Updates** | Manual changes | Version controlled |
| **Rollback** | Manual cleanup | Automatic stack rollback |
| **Documentation** | In markdown | In YAML templates |
| **Learning Curve** | Lower (step-by-step) | Higher (CloudFormation syntax) |
| **Best For** | Learning, one-off | Production, repeatability |

---

## Troubleshooting CloudFormation

### Stack Creation Failed

```bash
# View stack events
aws cloudformation describe-stack-events \
  --stack-name guess-drawing-STACK_NAME \
  --max-items 20

# Common issues:
# - Key pair doesn't exist → Create it first
# - Insufficient permissions → Check IAM policies
# - Resource limits → Check AWS quotas
# - Invalid parameters → Verify parameter values
```

### EC2 UserData Script Failed

```bash
# SSH to instance
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$BACKEND_IP

# Check UserData log
sudo cat /var/log/user-data.log

# Check PM2 status
pm2 status
pm2 logs guess-drawing-backend

# Common issues:
# - GitHub repo private → Make public or add SSH key
# - Database not ready → Wait longer, check security groups
# - npm install fails → Check Node.js version
```

### Stack Delete Stuck

```bash
# Force delete (skip resources that can't be deleted)
aws cloudformation delete-stack \
  --stack-name guess-drawing-STACK_NAME

# Manually delete stuck resources via console
# Then retry stack deletion
```

---

## Next Steps

Once deployment is complete:

1. ✅ Test the application at your CloudFront URL
2. ✅ Set up custom domain (optional) - see [DEPLOYMENT.md](DEPLOYMENT.md)
3. ✅ Configure monitoring and alerts
4. ✅ Set up GitHub Actions for CI/CD
5. ✅ Review security settings
6. ✅ Plan backup strategy

---

**Deployment Time: ~30 minutes**  
**Cost: $0/month (within free tier for 12 months)**
