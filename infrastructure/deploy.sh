#!/bin/bash

# AWS CloudFormation Deployment Script for Guess the Drawing
# This script automates the deployment of the entire infrastructure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT_NAME="guess-drawing"
REGION="eu-west-1"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cloudformation"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    print_info "Checking AWS CLI configuration..."
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
        print_error "AWS CLI is not configured or credentials are invalid."
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --region "$REGION" --query Account --output text)
    print_info "Using AWS Account: $ACCOUNT_ID"
}

# Function to generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to create SSH key pair
create_key_pair() {
    local KEY_NAME="${ENVIRONMENT_NAME}-key"
    
    print_info "Checking for SSH key pair..."
    
    if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &> /dev/null; then
        print_warn "Key pair '$KEY_NAME' already exists. Using existing key."
    else
        print_info "Creating new key pair: $KEY_NAME"
        aws ec2 create-key-pair \
            --key-name "$KEY_NAME" \
            --query 'KeyMaterial' \
            --output text \
            --region "$REGION" > ~/.ssh/${KEY_NAME}.pem
        
        chmod 400 ~/.ssh/${KEY_NAME}.pem
        print_info "Key pair created and saved to ~/.ssh/${KEY_NAME}.pem"
    fi
    
    echo "$KEY_NAME"
}

# Function to deploy a CloudFormation stack
deploy_stack() {
    local STACK_NAME=$1
    local TEMPLATE_FILE=$2
    shift 2
    local PARAMETERS=("$@")
    
    print_info "Deploying stack: $STACK_NAME"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        print_warn "Stack $STACK_NAME already exists. Skipping..."
        return 0
    else
        print_info "Creating new stack: $STACK_NAME"
        ACTION="create-stack"
    fi
    
    # Deploy stack
    aws cloudformation "$ACTION" \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --parameters "${PARAMETERS[@]}" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION" || {
            print_error "Failed to deploy $STACK_NAME"
            return 1
        }
    
    # Wait for stack to complete
    print_info "Waiting for stack $STACK_NAME to complete..."
    aws cloudformation wait "stack-create-complete" \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    print_info "Stack $STACK_NAME deployed successfully!"
}

# Function to get stack output
get_stack_output() {
    local STACK_NAME=$1
    local OUTPUT_KEY=$2
    
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$OUTPUT_KEY'].OutputValue" \
        --output text \
        --region "$REGION"
}

# Function to create Secrets Manager secrets
create_secrets() {
    local DB_PASS=$1
    local JWT_SEC=$2
    local JWT_REF_SEC=$3
    
    print_info "Creating Secrets Manager secrets..."
    
    # Get database endpoint
    local DB_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-rds" "DBEndpoint")
    local REDIS_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-cache" "RedisEndpoint")
    
    # Create DB secret
    if ! aws secretsmanager describe-secret --secret-id "${ENVIRONMENT_NAME}/db" --region "$REGION" &> /dev/null; then
        print_info "Creating secret: ${ENVIRONMENT_NAME}/db"
        aws secretsmanager create-secret \
            --name "${ENVIRONMENT_NAME}/db" \
            --secret-string "{\"host\":\"$DB_ENDPOINT\",\"port\":5432,\"username\":\"postgres\",\"password\":\"$DB_PASS\",\"database\":\"guess_drawing\"}" \
            --region "$REGION" > /dev/null
        print_info "Secret created: ${ENVIRONMENT_NAME}/db"
    else
        print_warn "Secret already exists: ${ENVIRONMENT_NAME}/db"
    fi
    
    # Create Redis secret
    if ! aws secretsmanager describe-secret --secret-id "${ENVIRONMENT_NAME}/redis" --region "$REGION" &> /dev/null; then
        print_info "Creating secret: ${ENVIRONMENT_NAME}/redis"
        aws secretsmanager create-secret \
            --name "${ENVIRONMENT_NAME}/redis" \
            --secret-string "{\"host\":\"$REDIS_ENDPOINT\",\"port\":6379}" \
            --region "$REGION" > /dev/null
        print_info "Secret created: ${ENVIRONMENT_NAME}/redis"
    else
        print_warn "Secret already exists: ${ENVIRONMENT_NAME}/redis"
    fi
    
    # Create JWT secret
    if ! aws secretsmanager describe-secret --secret-id "${ENVIRONMENT_NAME}/jwt" --region "$REGION" &> /dev/null; then
        print_info "Creating secret: ${ENVIRONMENT_NAME}/jwt"
        aws secretsmanager create-secret \
            --name "${ENVIRONMENT_NAME}/jwt" \
            --secret-string "{\"JWT_SECRET\":\"$JWT_SEC\",\"JWT_REFRESH_SECRET\":\"$JWT_REF_SEC\"}" \
            --region "$REGION" > /dev/null
        print_info "Secret created: ${ENVIRONMENT_NAME}/jwt"
    else
        print_warn "Secret already exists: ${ENVIRONMENT_NAME}/jwt"
    fi
}

# Function to build and upload frontend
build_and_upload_frontend() {
    local BACKEND_IP=$1
    local S3_BUCKET=$2
    local CLOUDFRONT_ID=$3
    
    print_info "Building and uploading Angular frontend..."
    
    # Check if frontend directory exists
    if [ ! -d "$ROOT_DIR/guess-drawing-frontend" ]; then
        print_error "Frontend directory not found: $ROOT_DIR/guess-drawing-frontend"
        return 1
    fi
    
    cd "$ROOT_DIR/guess-drawing-frontend"
    
    # Install dependencies
    print_info "Installing frontend dependencies..."
    npm install
    
    # Update environment.prod.ts with backend IP
    print_info "Updating environment configuration with backend IP: $BACKEND_IP"
    sed -i '' "s|'http://localhost:3000'|'http://$BACKEND_IP:3000'|g" src/environments/environment.prod.ts
    
    # Build production bundle
    print_info "Building production bundle..."
    npm run build -- --configuration=production
    
    # Upload to S3
    print_info "Uploading to S3 bucket: $S3_BUCKET"
    aws s3 sync dist/guess-drawing-frontend/browser/ "s3://$S3_BUCKET" \
        --delete \
        --region "$REGION"
    
    # Invalidate CloudFront
    print_info "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths '/*' \
        --region "$REGION" > /dev/null
    
    print_info "Frontend deployed successfully!"
    cd - > /dev/null
}

# Function to update CORS on backend
update_backend_cors() {
    local BACKEND_IP=$1
    local CLOUDFRONT_DOMAIN=$2
    local KEY_PATH="$3"
    
    print_info "Updating backend CORS configuration..."
    
    # SSH into EC2 and update .env with CloudFront domain
    print_info "Connecting to EC2 instance at $BACKEND_IP..."
    ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@"$BACKEND_IP" << 'EOF' || print_warn "Could not connect to EC2 - it may still be initializing"
        echo "[INFO] Updating .env file with CloudFront domain..."
        # Update CORS_ORIGIN in .env
        sudo sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$CLOUDFRONT_DOMAIN|g" /home/ec2-user/guess-the-drawing/.env 2>/dev/null || true
        # Restart backend services
        echo "[INFO] Restarting PM2 services..."
        pm2 restart all 2>/dev/null || true
        echo "[INFO] Backend CORS updated and restarted!"
EOF
    
    print_info "Backend CORS configuration updated!"
}

# Main deployment function
deploy_infrastructure() {
    print_info "Starting infrastructure deployment for $ENVIRONMENT_NAME"
    
    # Check prerequisites
    check_aws_cli
    
    # Generate secure passwords if not provided
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(generate_password)
        print_info "Generated database password (save this securely!)"
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(generate_password)
        print_info "Generated JWT secret"
    fi
    
    if [ -z "$JWT_REFRESH_SECRET" ]; then
        JWT_REFRESH_SECRET=$(generate_password)
        print_info "Generated JWT refresh secret"
    fi
    
    # Create or get key pair
    KEY_NAME=$(create_key_pair)
    
    # Prompt for GitHub repository URL
    GITHUB_REPO=${GITHUB_REPO:-"https://github.com/s-jelenic-levi9-com/guess-the-drawing.git"}
    
    print_info "=== Deployment Configuration ==="
    echo "Environment: $ENVIRONMENT_NAME"
    echo "Region: $REGION"
    echo "Key Name: $KEY_NAME"
    echo "GitHub Repo: $GITHUB_REPO"
    echo ""
    
    read -p "Continue with deployment? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" ]]; then
        print_warn "Deployment cancelled"
        exit 0
    fi
    
    # Deploy stacks in order
    print_info "\n=== Step 1/7: Deploying VPC Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-vpc" \
        "$SCRIPTS_DIR/01-vpc.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    print_info "\n=== Step 2/7: Deploying RDS Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-rds" \
        "$SCRIPTS_DIR/02-rds.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME" \
        "ParameterKey=DBMasterPassword,ParameterValue=$DB_PASSWORD"
    
    print_info "\n=== Step 3/7: Deploying ElastiCache Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-cache" \
        "$SCRIPTS_DIR/03-elasticache.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    print_info "\n=== Step 4/7: Creating Secrets Manager Secrets ==="
    create_secrets "$DB_PASSWORD" "$JWT_SECRET" "$JWT_REFRESH_SECRET"
    
    print_info "\n=== Step 5/7: Deploying Frontend Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-frontend" \
        "$SCRIPTS_DIR/05-frontend.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    # Get CloudFront domain for EC2 CORS configuration
    CLOUDFRONT_DOMAIN=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "CloudFrontDomain")
    
    print_info "\n=== Step 6/7: Deploying EC2 Backend Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-ec2" \
        "$SCRIPTS_DIR/04-ec2.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME" \
        "ParameterKey=KeyName,ParameterValue=$KEY_NAME"
    
    print_info "\n=== Waiting for EC2 initialization (5 minutes) ==="
    print_warn "EC2 UserData script is running, this takes ~5-10 minutes. Waiting..."
    sleep 300
    
    # Get all outputs
    DB_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-rds" "DBEndpoint")
    REDIS_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-cache" "RedisEndpoint")
    BACKEND_IP=$(get_stack_output "${ENVIRONMENT_NAME}-ec2" "ElasticIP")
    S3_BUCKET=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "BucketName")
    CLOUDFRONT_ID=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "CloudFrontDistributionId")
    
    print_info "\n=== Step 7/7: Building and Deploying Frontend ==="
    build_and_upload_frontend "$BACKEND_IP" "$S3_BUCKET" "$CLOUDFRONT_ID"
    
    print_info "\n=== Updating Backend CORS Configuration ==="
    update_backend_cors "$BACKEND_IP" "$CLOUDFRONT_DOMAIN" ~/.ssh/${KEY_NAME}.pem
    
    # Print deployment summary
    print_info "\n========================================="
    print_info "🎉 Deployment Complete!"
    print_info "========================================="
    echo ""
    echo "📊 Infrastructure Details:"
    echo "  - Database Endpoint: $DB_ENDPOINT"
    echo "  - Redis Endpoint: $REDIS_ENDPOINT"
    echo "  - Backend IP: $BACKEND_IP"
    echo "  - Backend URL: http://$BACKEND_IP:3000"
    echo "  - Frontend URL: https://$CLOUDFRONT_DOMAIN"
    echo ""
    echo "🔐 Credentials (SAVE THESE SECURELY!):"
    echo "  - Database Password: $DB_PASSWORD"
    echo "  - JWT Secret: $JWT_SECRET"
    echo "  - JWT Refresh Secret: $JWT_REFRESH_SECRET"
    echo "  - SSH Key: ~/.ssh/${KEY_NAME}.pem"
    echo ""
    echo "📦 Deployment Resources:"
    echo "  - S3 Bucket: $S3_BUCKET"
    echo "  - CloudFront ID: $CLOUDFRONT_ID"
    echo ""
    echo "🔗 SSH to Backend:"
    echo "  ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@$BACKEND_IP"
    echo ""
    echo "✅ Secrets Manager Secrets Created:"
    echo "  - ${ENVIRONMENT_NAME}/db (Database credentials)"
    echo "  - ${ENVIRONMENT_NAME}/redis (Redis connection info)"
    echo "  - ${ENVIRONMENT_NAME}/jwt (JWT signing secrets)"
    echo ""
    print_info "========================================="
}

# Function to destroy infrastructure
destroy_infrastructure() {
    print_warn "⚠️  WARNING: This will DELETE all infrastructure!"
    read -p "Are you sure you want to destroy everything? (type 'yes' to confirm): " CONFIRM
    
    if [[ "$CONFIRM" != "yes" ]]; then
        print_info "Destruction cancelled"
        exit 0
    fi
    
    print_info "Destroying infrastructure..."
    
    # Delete stacks in reverse order
    STACKS=(
        "${ENVIRONMENT_NAME}-ec2"
        "${ENVIRONMENT_NAME}-frontend"
        "${ENVIRONMENT_NAME}-cache"
        "${ENVIRONMENT_NAME}-rds"
        "${ENVIRONMENT_NAME}-vpc"
    )
    
    for STACK in "${STACKS[@]}"; do
        if aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" &> /dev/null; then
            print_info "Deleting stack: $STACK"
            aws cloudformation delete-stack --stack-name "$STACK" --region "$REGION"
            aws cloudformation wait stack-delete-complete --stack-name "$STACK" --region "$REGION"
            print_info "Stack $STACK deleted"
        else
            print_warn "Stack $STACK does not exist"
        fi
    done
    
    print_info "Infrastructure destroyed successfully"
}

# Script entry point
case "${1:-deploy}" in
    deploy)
        deploy_infrastructure
        ;;
    destroy)
        destroy_infrastructure
        ;;
    *)
        echo "Usage: $0 {deploy|destroy}"
        exit 1
        ;;
esac
