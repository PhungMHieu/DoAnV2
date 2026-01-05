#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Kubernetes Dashboard Access             ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Get token
echo -e "${YELLOW}📋 Getting Dashboard Token...${NC}"
echo ""

TOKEN=$(kubectl -n kubernetes-dashboard get secret admin-user-token -o jsonpath="{.data.token}" 2>/dev/null | base64 --decode)

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Creating admin user token...${NC}"
    kubectl apply -f dashboard/admin-user.yaml
    sleep 5
    TOKEN=$(kubectl -n kubernetes-dashboard get secret admin-user-token -o jsonpath="{.data.token}" | base64 --decode)
fi

echo -e "${GREEN}Token:${NC}"
echo ""
echo "$TOKEN"
echo ""

# Copy to clipboard (macOS)
if command -v pbcopy &> /dev/null; then
    echo "$TOKEN" | pbcopy
    echo -e "${GREEN}✅ Token copied to clipboard!${NC}"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${YELLOW}📌 Access Options:${NC}"
echo ""
echo "Option 1: NodePort (Direct)"
echo "  URL: https://localhost:30443"
echo "  Note: Accept self-signed certificate warning"
echo ""
echo "Option 2: kubectl proxy"
echo "  Run: kubectl proxy"
echo "  URL: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
echo ""
echo "Option 3: Port Forward"
echo "  Run: kubectl port-forward -n kubernetes-dashboard svc/kubernetes-dashboard 8443:443"
echo "  URL: https://localhost:8443"
echo ""
echo -e "${BLUE}============================================${NC}"
echo ""

# Start proxy in background option
read -p "Start kubectl proxy now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting kubectl proxy...${NC}"
    echo -e "${GREEN}Dashboard URL: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/${NC}"
    echo ""
    echo "Press Ctrl+C to stop"
    kubectl proxy
fi
