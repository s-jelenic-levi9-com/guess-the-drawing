#!/bin/bash

# AWS Services Stop Script for Guess the Drawing
# This script stops RDS, ElastiCache, and EC2 to save costs when not in use

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
EC2_TAG_KEY="aws:cloudformation:stack-name"
EC2_TAG_VALUE="guess-drawing-ec2"

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

# Function to stop RDS instance
stop_rds() {
    print_step "Stopping RDS instance: $RDS_INSTANCE_ID"
    
    # Check if RDS instance exists
    if ! aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" &> /dev/null; then
        print_warn "RDS instance '$RDS_INSTANCE_ID' not found. Skipping..."
        return 0
    fi
    
    # Get current status
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text)
    
    if [ "$STATUS" == "stopped" ]; then
        print_warn "RDS instance is already stopped."
        return 0
    elif [ "$STATUS" == "stopping" ]; then
        print_warn "RDS instance is already stopping."
        return 0
    elif [ "$STATUS" != "available" ]; then
        print_warn "RDS instance is in '$STATUS' state. Cannot stop now."
        return 0
    fi
    
    # Stop the instance
    print_info "Stopping RDS instance (current status: $STATUS)..."
    aws rds stop-db-instance \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --region "$REGION" \
        --no-db-instance-automated-backups-replication &> /dev/null
    
    print_info "✅ RDS stop initiated. Storage costs (~$4.20/month) will continue."
    print_warn "⚠️  Note: AWS will auto-restart this instance after 7 days."
}

# Function to delete ElastiCache cluster
stop_elasticache() {
    print_step "Deleting ElastiCache cluster: $ELASTICACHE_CLUSTER_ID"
    
    # Check if cluster exists
    if ! aws elasticache describe-cache-clusters \
        --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
        --region "$REGION" &> /dev/null; then
        print_warn "ElastiCache cluster '$ELASTICACHE_CLUSTER_ID' not found. Skipping..."
        return 0
    fi
    
    # Get current status
    STATUS=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
        --region "$REGION" \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text)
    
    if [ "$STATUS" == "deleting" ]; then
        print_warn "ElastiCache cluster is already deleting."
        return 0
    elif [ "$STATUS" != "available" ]; then
        print_warn "ElastiCache cluster is in '$STATUS' state. Cannot delete now."
        return 0
    fi
    
    # Ask for confirmation
    echo ""
    print_warn "⚠️  ElastiCache cannot be stopped, only deleted."
    print_warn "⚠️  All cached data will be lost!"
    read -p "$(echo -e ${YELLOW}Do you want to delete ElastiCache? [y/N]: ${NC})" -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping ElastiCache deletion."
        return 0
    fi
    
    # Delete the cluster (no final snapshot for Redis)
    print_info "Deleting ElastiCache cluster (current status: $STATUS)..."
    aws elasticache delete-cache-cluster \
        --cache-cluster-id "$ELASTICACHE_CLUSTER_ID" \
        --region "$REGION" &> /dev/null
    
    print_info "✅ ElastiCache deletion initiated. All cached data will be lost."
}

# Function to stop EC2 instance
stop_ec2() {
    print_step "Stopping EC2 instance..."
    
    # Find EC2 instance by CloudFormation tag
    INSTANCE_ID=$(aws ec2 describe-instances \
        --region "$REGION" \
        --filters "Name=tag:$EC2_TAG_KEY,Values=$EC2_TAG_VALUE" "Name=instance-state-name,Values=running,stopped,stopping" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)
    
    if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
        print_warn "EC2 instance not found. Skipping..."
        return 0
    fi
    
    # Get current state
    STATE=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
    
    if [ "$STATE" == "stopped" ]; then
        print_warn "EC2 instance $INSTANCE_ID is already stopped."
        return 0
    elif [ "$STATE" == "stopping" ]; then
        print_warn "EC2 instance $INSTANCE_ID is already stopping."
        return 0
    elif [ "$STATE" != "running" ]; then
        print_warn "EC2 instance $INSTANCE_ID is in '$STATE' state. Cannot stop now."
        return 0
    fi
    
    # Stop the instance
    print_info "Stopping EC2 instance $INSTANCE_ID (current state: $STATE)..."
    aws ec2 stop-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION" &> /dev/null
    
    print_info "✅ EC2 stop initiated. EBS storage costs (~$0.80/month) will continue."
    print_warn "⚠️  Elastic IP remains attached (no charges while attached)."
}

# Function to display cost savings
display_savings() {
    echo ""
    echo "=========================================="
    echo "💰 Cost Savings Summary"
    echo "=========================================="
    echo ""
    echo "Monthly savings when services are stopped:"
    echo "  - RDS compute:        ~\$12.41/month saved"
    echo "  - ElastiCache:        ~\$12.50/month saved"
    echo "  - EC2 compute:        ~\$8.47/month saved"
    echo "  ----------------------------------------"
    echo "  Total savings:        ~\$33.38/month"
    echo ""
    echo "Remaining costs (cannot be stopped):"
    echo "  - RDS storage:        ~\$4.20/month"
    echo "  - EBS volume:         ~\$0.80/month"
    echo "  - Secrets Manager:    ~\$1.20/month"
    echo "  - S3/CloudFront:      ~\$0.53/month"
    echo "  ----------------------------------------"
    echo "  Total remaining:      ~\$6.73/month"
    echo ""
    echo "=========================================="
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "🛑 AWS Services Stop Script"
    echo "=========================================="
    echo ""
    
    check_aws_cli
    
    echo ""
    print_info "This script will stop the following services:"
    print_info "  1. RDS PostgreSQL instance"
    print_info "  2. ElastiCache Redis cluster (DELETE - data loss)"
    print_info "  3. EC2 Backend instance"
    echo ""
    
    read -p "$(echo -e ${YELLOW}Do you want to continue? [y/N]: ${NC})" -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled."
        exit 0
    fi
    
    echo ""
    
    # Stop services
    stop_rds
    echo ""
    
    stop_elasticache
    echo ""
    
    stop_ec2
    echo ""
    
    display_savings
    
    echo ""
    print_info "✅ Stop operation completed!"
    print_info "To restart services, run: ./start-services.sh"
    echo ""
}

# Run main function
main
