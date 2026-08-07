#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Server Refactoring Migration        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Backup
echo -e "${YELLOW}Step 1: Creating backup...${NC}"
mkdir -p backup
cp *.js backup/ 2>/dev/null || true
cp *.json backup/ 2>/dev/null || true
echo -e "${GREEN}✓ Backup created in ./backup/${NC}"
echo ""

# Step 2: Create data directory
echo -e "${YELLOW}Step 2: Creating data directory...${NC}"
mkdir -p data
echo -e "${GREEN}✓ data/ directory ready${NC}"
echo ""

# Step 3: Move JSON files
echo -e "${YELLOW}Step 3: Moving JSON files to data/...${NC}"

# Move if exists
if [ -f "cash-flow-data-miluim.json" ]; then
    cp cash-flow-data-miluim.json data/cash-flow-data.json
    echo -e "${GREEN}✓ cash-flow-data.json${NC}"
fi

if [ -f "cash-flow-defaults.json" ]; then
    cp cash-flow-defaults.json data/
    echo -e "${GREEN}✓ cash-flow-defaults.json${NC}"
fi

if [ -f "installments.json" ]; then
    cp installments.json data/
    echo -e "${GREEN}✓ installments.json${NC}"
fi

if [ -f "investments.json" ]; then
    cp investments.json data/
    echo -e "${GREEN}✓ investments.json${NC}"
fi

if [ -f "conversations.json" ]; then
    cp conversations.json data/
    echo -e "${GREEN}✓ conversations.json${NC}"
fi

if [ -f "data/ai-reports.json" ]; then
    echo -e "${GREEN}✓ ai-reports.json (already in data/)${NC}"
fi

echo ""

# Step 4: Backup old index.js
echo -e "${YELLOW}Step 4: Updating index.js...${NC}"
if [ -f "index.js" ]; then
    mv index.js index.old.js
    echo -e "${GREEN}✓ Old index.js saved as index.old.js${NC}"
fi

if [ -f "index.new.js" ]; then
    cp index.new.js index.js
    echo -e "${GREEN}✓ New index.js activated${NC}"
fi
echo ""

# Step 5: Verify structure
echo -e "${YELLOW}Step 5: Verifying directory structure...${NC}"

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓ $1/${NC}"
    else
        echo -e "${RED}✗ $1/ (missing)${NC}"
    fi
}

check_dir "routes"
check_dir "services"
check_dir "repositories"
check_dir "utils"
check_dir "middleware"
check_dir "data"
echo ""

# Step 6: List data files
echo -e "${YELLOW}Step 6: Data files in data/:${NC}"
ls -lh data/*.json 2>/dev/null || echo -e "${RED}No JSON files found${NC}"
echo ""

# Step 7: Summary
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Migration Complete!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. ${YELLOW}npm start${NC} - Start the server"
echo -e "2. ${YELLOW}curl http://localhost:3000/health${NC} - Test health"
echo -e "3. ${YELLOW}curl http://localhost:3000/api/cash-flow${NC} - Test API"
echo ""
echo -e "If something goes wrong:"
echo -e "- Restore: ${RED}mv index.old.js index.js${NC}"
echo -e "- Check logs in ${YELLOW}./backup/${NC}"
echo ""
