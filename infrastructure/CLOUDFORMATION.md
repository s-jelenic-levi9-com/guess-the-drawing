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
  --region eu-west-1 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/guess-drawing-key.pem
chmod 400 ~/.ssh/guess-drawing-key.pem
```

---

## Security: AWS Secrets Manager Setup

**Before deploying**, you need to create secrets in AWS Secrets Manager for secure credential storage:

```bash
# Secret 1: Database Credentials
aws secretsmanager create-secret \
  --name guess-drawing/db \
  --description "PostgreSQL database credentials" \
  --secret-string '{
    "username":"postgres",
    "password":"'"$(openssl rand -base64 32)"'",
    "host":"guess-drawing-db.xxxxx.eu-west-1.rds.amazonaws.com",
    "port":5432,
    "dbname":"guess_drawing"
  }' \
  --region eu-west-1

# Secret 2: JWT Secrets
aws secretsmanager create-secret \
  --name guess-drawing/jwt \
  --description "JWT token secrets" \
  --secret-string '{
    "JWT_SECRET":"'"$(openssl rand -base64 32)"'",
    "JWT_REFRESH_SECRET":"'"$(openssl rand -base64 32)"'"
  }' \
  --region eu-west-1

# Secret 3: Redis Credentials
aws secretsmanager create-secret \
  --name guess-drawing/redis \
  --description "Redis connection credentials" \
  --secret-string '{
    "host":"guess-drawing-redis.xxxxx.eu-west-1.cache.amazonaws.com",
    "port":6379,
    "password":""
  }' \
  --region eu-west-1
```

**⚠️  Important:** Replace the RDS and Redis endpoints with the actual endpoints from your CloudFormation outputs!

Get these values after deploying the RDS and ElastiCache stacks:

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-rds \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --region eu-west-1 --output text)

# Get Redis endpoint  
REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-cache \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
  --region eu-west-1 --output text)

echo "RDS: $RDS_ENDPOINT"
echo "Redis: $REDIS_ENDPOINT"
```

Then update the secrets with actual endpoints:

```bash
# Update DB secret with actual endpoint
aws secretsmanager update-secret \
  --secret-id guess-drawing/db \
  --secret-string '{
    "username":"postgres",
    "password":"YOUR_DB_PASSWORD",
    "host":"'"$RDS_ENDPOINT"'",
    "port":5432,
    "dbname":"guess_drawing"
  }' \
  --region eu-west-1

# Update Redis secret with actual endpoint
aws secretsmanager update-secret \
  --secret-id guess-drawing/redis \
  --secret-string '{
    "host":"'"$REDIS_ENDPOINT"'",
    "port":6379,
    "password":""
  }' \
  --region eu-west-1
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

### Option 2: Manual Step-by-Step Deployment

**Prerequisites:**
- SSH key pair created: `~/.ssh/guess-drawing-key.pem` with permissions `chmod 400`
- AWS CLI configured for region eu-west-1

#### Step 1: Deploy VPC Stack (Base Infrastructure)

```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-vpc \
  --template-body file://infrastructure/cloudformation/01-vpc.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region eu-west-1

# Wait for completion (takes ~2 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name guess-drawing-vpc \
  --region eu-west-1

# Verify success
aws cloudformation describe-stacks \
  --stack-name guess-drawing-vpc \
  --query 'Stacks[0].StackStatus' \
  --region eu-west-1
```

#### Step 2: Deploy RDS Stack (Database)

```bash
# Generate secure password (save for updating secrets later)
DB_PASSWORD=$(openssl rand -base64 32)
echo "⚠️  Save this DB password (you'll need it for Secrets Manager later): $DB_PASSWORD"

aws cloudformation create-stack \
  --stack-name guess-drawing-rds \
  --template-body file://infrastructure/cloudformation/02-rds.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=DBPassword,ParameterValue="$DB_PASSWORD" \
  --region eu-west-1

# Wait for completion (~10 minutes)
echo "⏳ Waiting for RDS to be provisioned (this takes ~10 minutes)..."
aws cloudformation wait stack-create-complete \
  --stack-name guess-drawing-rds \
  --region eu-west-1

# Get RDS endpoint
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-rds \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --region eu-west-1 --output text)

echo "✅ RDS Endpoint: $RDS_ENDPOINT"
echo "ℹ️  Update Secrets Manager with this endpoint in Step 3"
```

#### Step 3: Update AWS Secrets Manager with RDS & Redis Endpoints

After RDS and ElastiCache are deployed, update the secrets with the actual endpoints:

```bash
# Update DB secret with RDS endpoint
aws secretsmanager update-secret \
  --secret-id guess-drawing/db \
  --secret-string '{
    "username":"postgres",
    "password":"'"$DB_PASSWORD"'",
    "host":"'"$RDS_ENDPOINT"'",
    "port":5432,
    "dbname":"guess_drawing"
  }' \
  --region eu-west-1

# Update Redis secret (after ElastiCache is deployed in next step)
# ℹ️  You'll do this after Step 4
```

#### Step 4: Deploy ElastiCache Stack (Redis Cache)

```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-cache \
  --template-body file://infrastructure/cloudformation/03-elasticache.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region eu-west-1

# Wait for completion (~5 minutes)
echo "⏳ Waiting for ElastiCache Redis cluster (~5 minutes)..."
aws cloudformation wait stack-create-complete \
  --stack-name guess-drawing-cache \
  --region eu-west-1

# Get Redis endpoint
REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-cache \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
  --region eu-west-1 --output text)

echo "✅ Redis Endpoint: $REDIS_ENDPOINT"

# Update Redis secret with actual endpoint
aws secretsmanager update-secret \
  --secret-id guess-drawing/redis \
  --secret-string '{
    "host":"'"$REDIS_ENDPOINT"'",
    "port":6379,
    "password":""
  }' \
  --region eu-west-1
```

#### Step 5: Deploy Frontend Stack (S3 + CloudFront)

```bash
aws cloudformation create-stack \
  --stack-name guess-drawing-frontend \
  --template-body file://infrastructure/cloudformation/05-frontend.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
  --region eu-west-1

# Wait for stack creation (~5 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name guess-drawing-frontend \
  --region eu-west-1

# Get S3 bucket and CloudFront info
aws cloudformation describe-stacks \
  --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --region eu-west-1 --output table
```

**Note:** CloudFront deployment takes 10-15 minutes total. Stack creation finishes quickly, but distribution deployment continues in background.

#### Step 5: Deploy EC2 Backend Stack (Last)

```bash
# Note: JWT secrets are now stored in Secrets Manager, no need to pass them here
# EC2 will fetch secrets from AWS Secrets Manager on startup

aws cloudformation create-stack \
  --stack-name guess-drawing-backend \
  --template-body file://infrastructure/cloudformation/04-ec2.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=KeyName,ParameterValue=guess-drawing-key \
  --region eu-west-1

# Wait for EC2 stack (~3-5 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name guess-drawing-backend \
  --region eu-west-1

# Get EC2 Elastic IP
ELASTIC_IP=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-backend \
  --query 'Stacks[0].Outputs[?OutputKey==`ElasticIP`].OutputValue' \
  --region eu-west-1 --output text)

echo "✅ EC2 Elastic IP: $ELASTIC_IP"
```

#### Step 6: Monitor EC2 Setup (5-10 minutes)

The EC2 instance runs an automated setup script. Monitor its progress:

```bash
# Wait a bit for EC2 to boot
sleep 60

# SSH into the instance
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP

# Inside EC2:
# Monitor PM2
pm2 status
pm2 logs guess-drawing-backend --lines 100

# Verify Node.js and tools installed
node --version
npm --version
pm2 --version

# Check if backend is running
curl http://localhost:3000/health

# Exit SSH
exit
```

#### Step 7: Test Backend from Local Machine

```bash
# Test health endpoint
curl http://$ELASTIC_IP:3000/health

# Should return 200 OK if database connection works
```

#### Step 8: Build and Upload Angular Frontend

```bash
cd guess-drawing-frontend

# Update environment.prod.ts with Elastic IP
cat > src/environments/environment.prod.ts << EOF
export const environment = {
  production: true,
  apiUrl: 'http://$ELASTIC_IP:3000/api/v1',
  wsUrl: 'ws://$ELASTIC_IP:3000'
};
EOF

# Build production
npm install
npm run build -- --configuration=production

# Get S3 bucket name from CloudFormation
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --region eu-west-1 --output text)

echo "Uploading to S3 bucket: $S3_BUCKET"

# Upload to S3
aws s3 sync dist/guess-drawing-frontend/browser/ s3://$S3_BUCKET --delete --region eu-west-1

# Verify upload
aws s3 ls s3://$S3_BUCKET --region eu-west-1
```

#### Step 9: Wait for CloudFront Deployment

CloudFront takes 10-15 minutes to fully deploy. Monitor status:

```bash
# Get CloudFront Distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --region eu-west-1 --output text)

# Check status (wait for "Deployed")
aws cloudfront get-distribution \
  --id $DIST_ID \
  --query 'Distribution.[DomainName,Status]'

# Get the CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
  --id $DIST_ID \
  --query 'Distribution.DomainName' \
  --output text)

echo "✅ CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "Frontend URL: https://$CLOUDFRONT_DOMAIN"
```

#### Step 10: Update Backend CORS

Once CloudFront domain is ready, SSH into EC2 and update CORS:

```bash
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP

# Inside EC2:
cd ~/apps/my-bmad/guess-drawing-backend

# Update CORS to use CloudFront domain
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$CLOUDFRONT_DOMAIN|" .env

# Verify change
grep CORS_ORIGIN .env

# Restart backend
pm2 restart guess-drawing-backend

# Check logs
pm2 logs guess-drawing-backend --lines 20

exit
```

#### Step 11: Verify All Endpoints

```bash
# Get all important endpoints
echo "=== Deployment Complete ==="
echo "Frontend: https://$CLOUDFRONT_DOMAIN"
echo "Backend API: http://$ELASTIC_IP:3000"
echo "Backend WebSocket: ws://$ELASTIC_IP:3000"
echo "RDS Database: $RDS_ENDPOINT"
echo "Redis Cache: $REDIS_ENDPOINT"
```

---

## Security: AWS Secrets Manager Best Practices

### How It Works

The application now uses **AWS Secrets Manager** for secure credential storage:

1. **Secrets are stored encrypted** in AWS (AES-256)
2. **EC2 IAM role grants read-only access** to specific secrets
3. **Backend fetches secrets on startup** - never exposed in .env files
4. **Fallback to environment variables** if Secrets Manager fails (for development)

### Viewing Secrets

```bash
# List all secrets
aws secretsmanager list-secrets --filter Key=name,Values=guess-drawing --region eu-west-1

# Get a specific secret (only the username/password, not the entire JSON)
aws secretsmanager get-secret-value --secret-id guess-drawing/db --region eu-west-1
```

### Rotating Secrets

You can manually rotate secrets:

```bash
# Rotate database password
NEW_DB_PASSWORD=$(openssl rand -base64 32)

aws secretsmanager update-secret \
  --secret-id guess-drawing/db \
  --secret-string '{
    "username":"postgres",
    "password":"'"$NEW_DB_PASSWORD"'",
    "host":"'"$RDS_ENDPOINT"'",
    "port":5432,
    "dbname":"guess_drawing"
  }' \
  --region eu-west-1

# Then update RDS password
aws rds modify-db-instance \
  --db-instance-identifier guess-drawing-db \
  --master-user-password "$NEW_DB_PASSWORD" \
  --apply-immediately \
  --region eu-west-1

# Restart backend (secrets are cached, restart picks up new value)
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
pm2 restart guess-drawing-backend
exit
```

### Secrets Cost

AWS Secrets Manager charges approximately:

- **$0.40 per secret per month** (so $1.20/month for 3 secrets)
- Free within 12-month free tier for new AWS accounts

---

### 1. Test Application in Browser

```bash
# Open in browser
https://$CLOUDFRONT_DOMAIN

# Tests to perform:
# ✅ Frontend loads without errors
# ✅ No console errors (F12 → Console tab)
# ✅ API calls working (F12 → Network → filter to /api/)
# ✅ WebSocket connects (F12 → Network → filter to WS)
# ✅ Can register new user
# ✅ Can login
# ✅ Can create game room
# ✅ Drawing canvas works
# ✅ Chat sends/receives
# ✅ Real-time sync working
```

### 2. Add GitHub Secrets for CI/CD (Optional)

Navigate to your GitHub repository and add these secrets:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `AWS_REGION` | `eu-west-1` |
| `S3_BUCKET_NAME` | From CloudFormation output |
| `CLOUDFRONT_DISTRIBUTION_ID` | From CloudFormation output |
| `EC2_HOST` | $ELASTIC_IP (from step above) |
| `EC2_SSH_KEY` | Contents of `~/.ssh/guess-drawing-key.pem` |
| `EC2_USER` | `ec2-user` |

Get CloudFormation outputs:

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name guess-drawing-frontend \
  --query 'Stacks[0].Outputs' \
  --region eu-west-1

# Copy the S3_BUCKET_NAME and CLOUDFRONT_DISTRIBUTION_ID values
```

---

### Update Single Stack

```bash
# Update RDS (e.g., change instance class)
aws cloudformation update-stack \
  --stack-name guess-drawing-rds \
  --template-body file://infrastructure/cloudformation/02-rds.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
    ParameterKey=DBPassword,UsePreviousValue=true \
  --region eu-west-1

# Wait for update
aws cloudformation wait stack-update-complete --stack-name guess-drawing-rds --region eu-west-1
```

### Update Backend Code

The backend will auto-update through:
1. **GitHub Actions** (if configured) - automatic on push
2. **SSH + PM2** - manual restart

```bash
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP
cd ~/apps/my-bmad/guess-drawing-backend
git pull origin main
npm ci --only=production
npm run build
pm2 restart guess-drawing-backend
```

---

## Destroy Infrastructure

### Option 1: Manual Deletion

Delete stacks in reverse order (dependencies):

```bash
# 1. EC2 (depends on everything)
aws cloudformation delete-stack --stack-name guess-drawing-backend --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-backend --region eu-west-1

# 2. Frontend (independent)
aws cloudformation delete-stack --stack-name guess-drawing-frontend --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-frontend --region eu-west-1

# 3. ElastiCache (depends on VPC)
aws cloudformation delete-stack --stack-name guess-drawing-cache --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-cache --region eu-west-1

# 4. RDS (depends on VPC)
aws cloudformation delete-stack --stack-name guess-drawing-rds --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-rds --region eu-west-1

# 5. VPC (no dependencies)
aws cloudformation delete-stack --stack-name guess-drawing-vpc --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name guess-drawing-vpc --region eu-west-1
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
  --region eu-west-1 \
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
ssh -i ~/.ssh/guess-drawing-key.pem ec2-user@$ELASTIC_IP

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
  --stack-name guess-drawing-STACK_NAME \
  --region eu-west-1

# Manually delete stuck resources via AWS Console
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
