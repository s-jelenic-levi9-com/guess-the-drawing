# Guess The Drawing - AWS Deployment Checkpoints

**Started:** February 3, 2026  
**Region:** eu-west-1  
**Environment:** guess-drawing

---

## Prerequisites
- [ ] AWS CLI configured and working
- [ ] SSH key pair created (`guess-drawing-key`)
- [ ] Key permissions set to 400

---

## Infrastructure Deployment Steps

### Step 1: Deploy VPC Stack
- [ ] Create VPC stack
- [ ] Wait for completion (~2 minutes)
- [ ] Verify VPC resources created
- [ ] Save VPC outputs

**Expected Resources:**
- VPC with CIDR 10.0.0.0/16
- 2 Public Subnets (10.0.1.0/24, 10.0.2.0/24)
- 2 Private Subnets (10.0.10.0/24, 10.0.11.0/24)
- Internet Gateway
- NAT Gateway
- 2 Route Tables
- 3 Security Groups (EC2, RDS, ElastiCache)

---

### Step 2: Deploy RDS Stack + Create DB Secret
- [x] Generate DB password
- [x] Create RDS stack
- [x] Wait for completion (~10 minutes)
- [x] Get RDS endpoint
- [x] Create Secrets Manager secret for DB
- [x] Verify RDS available

**Status:** ✅ COMPLETED
- RDS Endpoint: `guess-drawing-db.cwb9wqcie azl.eu-west-1.rds.amazonaws.com`
- DB Secret: `guess-drawing/db` (created in Secrets Manager)
- PostgreSQL 15.10, db.t3.micro
- Backups enabled (7-day retention)

**Expected Resources:**
- RDS PostgreSQL db.t3.micro instance ✅
- DB Subnet Group ✅
- DB Security Group ✅
- Secrets Manager secret: `guess-drawing/db` ✅

---

### Step 3: Deploy ElastiCache + Create Redis Secret
- [x] Create ElastiCache stack
- [x] Wait for completion (~5 minutes)
- [x] Get Redis endpoint
- [x] Create Secrets Manager secret for Redis
- [x] Verify ElastiCache available

**Status:** ✅ COMPLETED
- Redis Endpoint: `gue-re-1kch07qh0itxd.5b7gh5.0001.euw1.cache.amazonaws.com`
- Redis Secret: `guess-drawing/redis` (created in Secrets Manager)
- cache.t3.micro node
- Snapshots enabled (5-day retention)

**Expected Resources:**
- ElastiCache Redis cache.t3.micro node ✅
- Cache Subnet Group ✅
- Cache Security Group ✅
- Secrets Manager secret: `guess-drawing/redis` ✅

---

### Step 4: Create JWT Secret
- [x] Generate JWT secrets
- [x] Create Secrets Manager secret for JWT
- [x] Verify all 3 secrets created

**Status:** ✅ COMPLETED
- JWT Secret: `guess-drawing/jwt` (created in Secrets Manager)
- Both JWT_SECRET and JWT_REFRESH_SECRET generated and stored

**Expected Resources:**
- Secrets Manager secret: `guess-drawing/jwt` ✅

---

### Summary: Infrastructure Foundation Ready ✅
- [x] VPC Stack: COMPLETE
- [x] RDS Stack: COMPLETE
- [x] ElastiCache Stack: COMPLETE
- [x] All 3 Secrets Created: COMPLETE

**Next Steps:**
1. Deploy Frontend Stack (S3 + CloudFront)
2. Deploy EC2 Backend Stack
3. Test end-to-end connectivity

---

### Step 5: Deploy Frontend Stack (S3 + CloudFront)
- [x] Create frontend stack
- [x] Wait for stack creation (~5 minutes)
- [x] Get S3 bucket name
- [x] Get CloudFront Distribution ID
- [x] Monitor CloudFront deployment (~10-15 minutes)
- [x] Verify CloudFront status = "Deployed"

**Status:** ✅ COMPLETED
- S3 Bucket: `guess-drawing-frontend-967910360152`
- CloudFront Domain: `dwrwcqtkuzenh.cloudfront.net`
- CloudFront Distribution ID: `E1EUGXVPU61T8M`
- CloudFront Status: `Deployed`

**Expected Resources:**
- S3 bucket for static hosting ✅
- CloudFront distribution ✅
- Bucket policies ✅
- CloudFront OAI ✅

---

### Step 6: Deploy EC2 Backend Stack
- [ ] Create EC2 backend stack
- [ ] Wait for stack creation (~3-5 minutes)
- [ ] Get Elastic IP
- [ ] Monitor UserData script execution (~5-10 minutes)
- [ ] Verify backend started with PM2

**Expected Resources:**
- EC2 t2.micro instance
- Elastic IP
- IAM Role for EC2
- Instance Profile

---

### Step 7: Build and Upload Angular Frontend
- [ ] Update environment.prod.ts with Elastic IP
- [ ] Install frontend dependencies
- [ ] Build production bundle
- [ ] Upload to S3 bucket
- [ ] Verify files uploaded
- [ ] Invalidate CloudFront cache

---

### Step 8: Update Backend CORS
- [ ] SSH to EC2 instance
- [ ] Update CORS_ORIGIN in .env with CloudFront domain
- [ ] Restart PM2
- [ ] Verify CORS headers

---

## Saved Endpoints & Credentials

```bash
# Infrastructure
VPC_ID=guess-drawing-vpc
RDS_ENDPOINT=guess-drawing-db.cwb9wqcie azl.eu-west-1.rds.amazonaws.com
REDIS_ENDPOINT=gue-re-1kch07qh0itxd.5b7gh5.0001.euw1.cache.amazonaws.com
ELASTIC_IP=pending
S3_BUCKET=guess-drawing-frontend-967910360152
CLOUDFRONT_DOMAIN=dwrwcqtkuzenh.cloudfront.net
CLOUDFRONT_DIST_ID=E1EUGXVPU61T8M

# Secrets (in Secrets Manager)
SECRET_DB=guess-drawing/db
SECRET_REDIS=guess-drawing/redis
SECRET_JWT=guess-drawing/jwt

# SSH
SSH_KEY_PATH=~/.ssh/guess-drawing-key.pem
SSH_KEY_NAME=guess-drawing-key
```

---

## Current Status

**Last Updated:** February 3, 2026 (Step 5 Complete)  
**Current Step:** Step 6 - Deploy EC2 Backend Stack  
**Status:** ⏳ Ready to Deploy

**Completed:** ✅ Steps 1-5 (VPC, RDS, ElastiCache, Secrets, Frontend)  
**Pending:** ⏳ Steps 6-8 (EC2, Frontend Build & Upload, CORS Update)

