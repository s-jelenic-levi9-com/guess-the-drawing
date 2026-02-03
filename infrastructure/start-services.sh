#!/bin/bash

# AWS Services Start Script for Guess the Drawing
# This script starts RDS, recreates ElastiCache, and starts EC2

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="eu-west-1"
RDS_INSTANCE_ID="guess-drawing-db"
ELASTICACHE_CLUSTER_ID="guess-drawing-redis"
ELASTICACHE_STACK_NAME="guess-drawing-elasticache"
EC2_TAG_KEY="aws:cloudformation:stack-name"
EC2_TAG_VALUE="guess-drawing-ec2"
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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
    print_info "Using AWS Account: $ACCOUNT_ID in region: $REGION"
}

# Function to start RDS instance
start_rds() {
    print_step "Starting RDS instance: $RDS_INSTANCE_ID"
    
    # Check if RDS instance exists
    if ! aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" &> /dev/null; then
        print_error "RDS instance '$RDS_INSTANCE_ID' not found!"
        return 1
    fi
    
    # Get current status
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text)
    
    if [ "$STATUS" == "available" ]; then
        print_warn "RDS instance is already running."
        ENDPOINT=$(aws rds describe-db-instances \
            --db-instance-identifier "$RDS_INSTANCE_ID" \
            --region "$REGION" \
            --query 'DBInstances[0].Endpoint.Address' \
            --output text)
        print_info "RDS Endpoint: $ENDPOINT"
        return 0
    elif [ "$STATUS" == "starting" ]; then
        print_warn "RDS instance is already starting. Waiting for it to become available..."
    elif [ "$STATUS" != "stopped" ]; then
        print_warn "RDS instance is in '$STATUS' state. Waiting..."
    else
        # Start the instance
        print_info "Starting RDS instance (current status: $STATUS)..."
        aws rds start-db-instance \
            --db-instance-identifier "$RDS_INSTANCE_ID" \
            --region "$REGION" &> /dev/null
    fi
    
    # Wait for instance to be available
    print_info "Waiting for RDS instance to become available (this may take 5-10 minutes)..."
    aws rds wait db-instance-available \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION"
    
    ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    print_info "✅ RDS instance is now available!"
    print_info "RDS Endpoint: $ENDPOINT"
}

# Function to recreate ElastiCache cluster
start_elasticache() {
    print_step "Checking ElastiCache cluster: $ELASTICACHE_CLUSTER_ID"
    
    # Check if cluster exists
    if aws elasticache describe-cache-clusters \
        --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
        --region "$REGION" &> /dev/null; then
        
        STATUS=$(aws elasticache describe-cache-clusters \
            --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
            --region "$REGION" \
            --query 'CacheClusters[0].CacheClusterStatus' \
            --output text)
        
        if [ "$STATUS" == "available" ]; then
            print_warn "ElastiCache cluster is already running."
            ENDPOINT=$(aws elasticache describe-cache-clusters \
                --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
                --region "$REGION" \
                --show-cache-node-info \
                --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
                --output text)
            print_info "Redis Endpoint: $ENDPOINT"
            return 0
        else
            print_warn "ElastiCache cluster exists but is in '$STATUS' state."
            return 0
        fi
    fi
    
    # Cluster doesn't exist, need to recreate via CloudFormation
    print_warn "ElastiCache cluster not found. Need to recreate via CloudFormation stack."
    echo ""
    print_info "To recreate ElastiCache, you have two options:"
    print_info "  1. Redeploy the stack: aws cloudformation create-stack --stack-name $ELASTICACHE_STACK_NAME --template-body file://$SCRIPTS_DIR/03-elasticache.yaml --region $REGION"
    print_info "  2. Or manually run: ./deploy.sh (if you deleted the stack)"
    echo ""
    
    read -p "$(echo -e ${YELLOW}Do you want to recreate ElastiCache stack now? [y/N]: ${NC})" -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping ElastiCache recreation."
        return 0
    fi
    
    # Check if CloudFormation stack exists
    if aws cloudformation describe-stacks \
        --stack-name "$ELASTICACHE_STACK_NAME" \
        --region "$REGION" &> /dev/null; then
        print_error "CloudFormation stack '$ELASTICACHE_STACK_NAME' exists but cluster is gone. Please check AWS console."
        return 1
    fi
    
    # Get VPC stack exports for subnet group
    print_info "Recreating ElastiCache stack..."
    aws cloudformation create-stack \
        --stack-name "$ELASTICACHE_STACK_NAME" \
        --template-body "file://$SCRIPTS_DIR/03-elasticache.yaml" \
        --region "$REGION" \
        --parameters \
            ParameterKey=EnvironmentName,ParameterValue=guess-drawing \
        --capabilities CAPABILITY_NAMED_IAM
    
    print_info "Waiting for ElastiCache stack creation (this may take 10-15 minutes)..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$ELASTICACHE_STACK_NAME" \
        --region "$REGION"
    
    ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$ELASTICACHE_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    print_info "✅ ElastiCache cluster recreated!"
    print_info "Redis Endpoint: $ENDPOINT"
}

# Function to start EC2 instance
start_ec2() {
    print_step "Starting EC2 instance..."
    
    # Find EC2 instance by CloudFormation tag
    INSTANCE_ID=$(aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=tag:$EC2_TAG_KEY,Values=$EC2_TAG_VALUE" "Name=instance-state-name,Values=running,stopped,stopping" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)
    
    if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
        print_error "EC2 instance not found!"
        return 1
    fi
    
    # Get current state
    STATE=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
    
    if [ "$STATE" == "running" ]; then
        print_warn "EC2 instance $INSTANCE_ID is already running."
        PUBLIC_IP=$(aws ec2 describe-instances \
            --instance-ids "$INSTANCE_ID" \
            --region "$REGION" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        print_info "EC2 Public IP: $PUBLIC_IP"
        return 0
    elif [ "$STATE" == "pending" ]; then
        print_warn "EC2 instance $INSTANCE_ID is already starting. Waiting..."
    elif [ "$STATE" != "stopped" ]; then
        print_warn "EC2 instance $INSTANCE_ID is in '$STATE' state. Waiting..."
    else
        # Start the instance
        print_info "Starting EC2 instance $INSTANCE_ID (current state: $STATE)..."
        aws ec2 start-instances \
            --instance-ids "$INSTANCE_ID" \
            --region "$REGION" &> /dev/null
    fi
    
    # Wait for instance to be running
    print_info "Waiting for EC2 instance to start (this may take 2-3 minutes)..."
    aws ec2 wait instance-running \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION"
    
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    print_info "✅ EC2 instance is now running!"
    print_info "EC2 Public IP: $PUBLIC_IP"
    print_warn "⚠️  Note: Backend app may take 1-2 minutes to fully start (PM2 initialization)"
}

# Function to display startup summary
display_summary() {
    echo ""
    echo "=========================================="
    echo "✅ Startup Summary"
    echo "=========================================="
    echo ""
    print_info "All services have been started!"
    echo ""
    print_warn "Important notes:"
    print_warn "  - Backend may take 1-2 minutes to fully initialize"
    print_warn "  - ElastiCache (if recreated) has no cached data"
    print_warn "  - Check application logs to confirm services are healthy"
    echo ""
    print_info "Service endpoints:"
    
    # Get RDS endpoint
    if aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" --region "$REGION" &> /dev/null; then
        RDS_ENDPOINT=$(aws rds describe-db-instances \
            --db-instance-identifier "$RDS_INSTANCE_ID" \
            --region "$REGION" \
            --query 'DBInstances[0].Endpoint.Address' \
            --output text 2>/dev/null)
        print_info "  RDS:    $RDS_ENDPOINT:5432"
    fi
    
    # Get ElastiCache endpoint
    if aws elasticache describe-cache-clusters --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" --region "$REGION" &> /dev/null; then
        REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
            --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
            --region "$REGION" \
            --show-cache-node-info \
            --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
            --output text 2>/dev/null)
        print_info "  Redis:  $REDIS_ENDPOINT:6379"
    fi
    
    # Get EC2 public IP
    INSTANCE_ID=$(aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=tag:$EC2_TAG_KEY,Values=$EC2_TAG_VALUE" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)
    
    if [ "$INSTANCE_ID" != "None" ] && [ -n "$INSTANCE_ID" ]; then
        EC2_IP=$(aws ec2 describe-instances \
            --instance-ids "$INSTANCE_ID" \
            --region "$REGION" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text 2>/dev/null)
        print_info "  EC2:    http://$EC2_IP:3000"
    fi
    
    echo ""
    echo "=========================================="
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "🚀 AWS Services Start Script"
    echo "=========================================="
    echo ""
    
    check_aws_cli
    
    echo ""
    print_info "This script will start the following services:"
    print_info "  1. RDS PostgreSQL instance"
    print_info "  2. ElastiCache Redis cluster (recreate if deleted)"
    print_info "  3. EC2 Backend instance"
    echo ""
    
    read -p "$(echo -e ${YELLOW}Do you want to continue? [y/N]: ${NC})" -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled."
        exit 0
    fi
    
    echo ""
    
    # Start services
    start_rds
    echo ""
    
    start_elasticache
    echo ""
    
    start_ec2
    echo ""
    
    display_summary
    
    echo ""
    print_info "✅ Start operation completed!"
    print_info "To stop services again, run: ./stop-services.sh"
    echo ""
}

# Run main function
main
