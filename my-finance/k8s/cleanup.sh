#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧹 Cleaning up Kubernetes resources...${NC}"
echo ""

# Delete services
echo -e "${YELLOW}Deleting services...${NC}"
kubectl delete -f services/ --ignore-not-found
echo ""

# Delete base infrastructure
echo -e "${YELLOW}Deleting infrastructure...${NC}"
kubectl delete -f base/ --ignore-not-found
echo ""

# Delete ingress
echo -e "${YELLOW}Deleting ingress...${NC}"
kubectl delete -f ingress.yaml --ignore-not-found
echo ""

# Delete configs
echo -e "${YELLOW}Deleting configs...${NC}"
kubectl delete -f config/ --ignore-not-found
echo ""

# Delete dashboard
echo -e "${YELLOW}Deleting dashboard...${NC}"
kubectl delete -f dashboard/ --ignore-not-found
echo ""

# Delete namespace
echo -e "${YELLOW}Deleting namespace...${NC}"
kubectl delete -f namespace.yaml --ignore-not-found
echo ""

# Delete PVCs
echo -e "${YELLOW}Deleting PVCs...${NC}"
kubectl delete pvc --all -n my-finance --ignore-not-found 2>/dev/null
echo ""

echo -e "${GREEN}✅ Cleanup complete!${NC}"
