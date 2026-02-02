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
REGION="us-east-1"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cloudformation"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    print_info "Checking AWS CLI configuration..."
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Run 'aws configure' first."
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
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
        print_warn "Stack $STACK_NAME already exists. Updating..."
        ACTION="update-stack"
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
            if [[ "$ACTION" == "update-stack" ]]; then
                print_warn "No updates to be performed on $STACK_NAME"
                return 0
            else
                print_error "Failed to deploy $STACK_NAME"
                return 1
            fi
        }
    
    # Wait for stack to complete
    print_info "Waiting for stack $STACK_NAME to complete..."
    aws cloudformation wait "stack-$([[ "$ACTION" == "create-stack" ]] && echo create || echo update)-complete" \
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
    read -p "Enter your GitHub repository URL (default: https://github.com/YOUR_USERNAME/my-bmad.git): " GITHUB_REPO
    GITHUB_REPO=${GITHUB_REPO:-"https://github.com/YOUR_USERNAME/my-bmad.git"}
    
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
    print_info "\n=== Step 1/5: Deploying VPC Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-vpc" \
        "$SCRIPTS_DIR/01-vpc.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    print_info "\n=== Step 2/5: Deploying RDS Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-rds" \
        "$SCRIPTS_DIR/02-rds.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME" \
        "ParameterKey=DBMasterPassword,ParameterValue=$DB_PASSWORD"
    
    print_info "\n=== Step 3/5: Deploying ElastiCache Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-elasticache" \
        "$SCRIPTS_DIR/03-elasticache.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    print_info "\n=== Step 4/5: Deploying Frontend Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-frontend" \
        "$SCRIPTS_DIR/05-frontend.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME"
    
    # Get CloudFront domain for EC2 CORS configuration
    CLOUDFRONT_DOMAIN=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "CloudFrontDomain")
    
    print_info "\n=== Step 5/5: Deploying EC2 Backend Stack ==="
    deploy_stack \
        "${ENVIRONMENT_NAME}-ec2" \
        "$SCRIPTS_DIR/04-ec2.yaml" \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME" \
        "ParameterKey=KeyName,ParameterValue=$KEY_NAME" \
        "ParameterKey=GitHubRepo,ParameterValue=$GITHUB_REPO" \
        "ParameterKey=DBMasterPassword,ParameterValue=$DB_PASSWORD" \
        "ParameterKey=JWTSecret,ParameterValue=$JWT_SECRET" \
        "ParameterKey=JWTRefreshSecret,ParameterValue=$JWT_REFRESH_SECRET" \
        "ParameterKey=CloudFrontDomain,ParameterValue=https://$CLOUDFRONT_DOMAIN"
    
    # Get all outputs
    DB_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-rds" "DBEndpoint")
    REDIS_ENDPOINT=$(get_stack_output "${ENVIRONMENT_NAME}-elasticache" "RedisEndpoint")
    BACKEND_IP=$(get_stack_output "${ENVIRONMENT_NAME}-ec2" "ElasticIP")
    S3_BUCKET=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "BucketName")
    CLOUDFRONT_ID=$(get_stack_output "${ENVIRONMENT_NAME}-frontend" "CloudFrontDistributionId")
    
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
    echo "📝 Next Steps:"
    echo "  1. Update frontend environment.prod.ts with Backend IP"
    echo "  2. Build and deploy frontend:"
    echo "     cd guess-drawing-frontend"
    echo "     npm run build -- --configuration=production"
    echo "     aws s3 sync dist/guess-drawing-frontend/browser/ s3://$S3_BUCKET --delete"
    echo "     aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths '/*'"
    echo "  3. Set up GitHub Actions secrets for CI/CD"
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
        "${ENVIRONMENT_NAME}-elasticache"
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
