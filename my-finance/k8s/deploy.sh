#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   My Finance - Kubernetes Deployment      ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check cluster connection
echo -e "${YELLOW}📡 Checking Kubernetes cluster connection...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster.${NC}"
    echo -e "${YELLOW}Please ensure your cluster is running:${NC}"
    echo "  - Docker Desktop: Enable Kubernetes in settings"
    echo "  - Minikube: minikube start"
    echo "  - Kind: kind create cluster"
    exit 1
fi
echo -e "${GREEN}✅ Connected to cluster${NC}"
echo ""

# Function to wait for pods to be ready
wait_for_pods() {
    local namespace=$1
    local label=$2
    local timeout=${3:-120}

    echo -e "${YELLOW}⏳ Waiting for pods with label '$label' in namespace '$namespace'...${NC}"
    kubectl wait --for=condition=ready pod -l $label -n $namespace --timeout=${timeout}s 2>/dev/null
    return $?
}

# Step 1: Create namespace
echo -e "${YELLOW}📦 Step 1: Creating namespace...${NC}"
kubectl apply -f namespace.yaml
echo -e "${GREEN}✅ Namespace created${NC}"
echo ""

# Step 2: Apply configs and secrets
echo -e "${YELLOW}🔐 Step 2: Applying ConfigMaps and Secrets...${NC}"
kubectl apply -f config/
echo -e "${GREEN}✅ ConfigMaps and Secrets applied${NC}"
echo ""

# Step 3: Deploy base infrastructure
echo -e "${YELLOW}🏗️  Step 3: Deploying infrastructure (PostgreSQL, Redis, RabbitMQ)...${NC}"
kubectl apply -f base/
echo ""

# Wait for infrastructure
echo -e "${YELLOW}⏳ Waiting for infrastructure to be ready...${NC}"
sleep 10
wait_for_pods "my-finance" "app=postgres" 180
wait_for_pods "my-finance" "app=redis" 60
wait_for_pods "my-finance" "app=rabbitmq" 120
echo -e "${GREEN}✅ Infrastructure ready${NC}"
echo ""

# Step 4: Deploy services
echo -e "${YELLOW}🚀 Step 4: Deploying microservices...${NC}"
kubectl apply -f services/
echo -e "${GREEN}✅ Services deployed${NC}"
echo ""

# Step 5: Deploy Ingress
echo -e "${YELLOW}🌐 Step 5: Deploying Ingress...${NC}"
kubectl apply -f ingress.yaml
echo -e "${GREEN}✅ Ingress deployed${NC}"
echo ""

# Step 6: Deploy Dashboard
echo -e "${YELLOW}📊 Step 6: Deploying Kubernetes Dashboard...${NC}"
kubectl apply -f dashboard/
echo -e "${GREEN}✅ Dashboard deployed${NC}"
echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Get Dashboard Token
echo -e "${YELLOW}📋 Dashboard Access Token:${NC}"
echo ""
TOKEN=$(kubectl -n kubernetes-dashboard get secret admin-user-token -o jsonpath="{.data.token}" 2>/dev/null | base64 --decode)
if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}$TOKEN${NC}"
else
    echo -e "${YELLOW}Token not ready yet. Run this command to get it:${NC}"
    echo "kubectl -n kubernetes-dashboard get secret admin-user-token -o jsonpath=\"{.data.token}\" | base64 --decode"
fi
echo ""

# Access instructions
echo -e "${BLUE}📌 Access URLs:${NC}"
echo ""
echo "  Kubernetes Dashboard:"
echo "    URL: https://localhost:30443"
echo "    Or run: kubectl proxy"
echo "    Then: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
echo ""
echo "  API Gateway (NodePort):"
echo "    URL: http://localhost:30000"
echo ""
echo "  Port Forward (alternative):"
echo "    kubectl port-forward -n my-finance svc/api-gateway 3000:3000"
echo "    kubectl port-forward -n my-finance svc/auth-service 3002:3002"
echo ""

# Check pod status
echo -e "${BLUE}📊 Pod Status:${NC}"
kubectl get pods -n my-finance
echo ""

echo -e "${BLUE}📊 Dashboard Pods:${NC}"
kubectl get pods -n kubernetes-dashboard
echo ""
