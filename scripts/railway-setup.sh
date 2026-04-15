#!/bin/bash

# ============================================================
# Railway Setup Script for ICAI-CAGPT
# ============================================================
# This script:
# 1. Checks Railway CLI installation
# 2. Authenticates with Railway
# 3. Links to the Railway project
# 4. Pulls all environment variables
# 5. Sets up database and Redis connections
# 6. Creates .env file with Railway variables
# ============================================================

set -e  # Exit on error

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}🚂 Railway Setup for ICAI-CAGPT${NC}\n"

# ── Step 1: Check Railway CLI Installation ─────────────────

echo -e "${YELLOW}[1/6]${NC} Checking Railway CLI installation..."

if ! command -v railway &> /dev/null; then
    echo -e "${RED}✗${NC} Railway CLI not found"
    echo ""
    echo "Install Railway CLI:"
    echo ""
    echo "  ${BOLD}macOS/Linux:${NC}"
    echo "  curl -fsSL https://railway.app/install.sh | sh"
    echo ""
    echo "  ${BOLD}npm (alternative):${NC}"
    echo "  npm install -g @railway/cli"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Railway CLI installed: $(railway --version)"

# ── Step 2: Authenticate with Railway ──────────────────────

echo -e "\n${YELLOW}[2/6]${NC} Authenticating with Railway..."

if railway whoami &> /dev/null; then
    RAILWAY_USER=$(railway whoami 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} Already authenticated as: ${RAILWAY_USER}"
else
    echo "Opening Railway authentication in browser..."
    railway login
    echo -e "${GREEN}✓${NC} Authentication successful"
fi

# ── Step 3: Link to Railway Project ────────────────────────

echo -e "\n${YELLOW}[3/6]${NC} Linking to Railway project..."

# Check if already linked
if [ -f ".railway" ] || railway status &> /dev/null; then
    echo -e "${GREEN}✓${NC} Already linked to Railway project"
    railway status
else
    echo "Available projects:"
    railway list
    echo ""
    echo "Link to your project using:"
    echo "  ${BOLD}railway link${NC}"
    echo ""
    railway link
fi

# ── Step 4: Pull Environment Variables ─────────────────────

echo -e "\n${YELLOW}[4/6]${NC} Pulling environment variables from Railway..."

# Select environment (production, staging, development)
echo ""
echo "Available environments:"
railway environment

echo ""
read -p "Enter environment name (default: production): " ENV_NAME
ENV_NAME=${ENV_NAME:-production}

echo ""
echo "Pulling variables from '${ENV_NAME}' environment..."

# Pull variables and save to .env
railway variables --json --environment "$ENV_NAME" > .railway-vars.json 2>/dev/null || {
    echo -e "${RED}✗${NC} Failed to pull variables. Make sure you have access to the project."
    exit 1
}

echo -e "${GREEN}✓${NC} Variables retrieved successfully"

# ── Step 5: Parse and Display Variables ────────────────────

echo -e "\n${YELLOW}[5/6]${NC} Parsing Railway variables..."

# Convert JSON to .env format
node -e "
const fs = require('fs');
const vars = JSON.parse(fs.readFileSync('.railway-vars.json', 'utf8'));

let envContent = '# ============================================================\n';
envContent += '# ICAI CA GPT — Railway Environment Variables\n';
envContent += '# Generated: ' + new Date().toISOString() + '\n';
envContent += '# Environment: $ENV_NAME\n';
envContent += '# ============================================================\n\n';

// Sort variables by category
const categories = {
  'Database': ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POOL_SIZE', 'DB_SSL'],
  'Redis': ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'],
  'AI Providers': ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'PERPLEXITY_API_KEY'],
  'AWS': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET', 'AWS_KMS_KEY_ID'],
  'Security': ['SESSION_SECRET', 'ENCRYPTION_KEY', 'ADMIN_SETUP_KEY', 'KEY_VAULT_PROVIDER'],
  'Payments': ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY'],
  'OAuth': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  'Features': ['ENABLE_DEEP_RESEARCH', 'ENABLE_EXPERT_ROUNDTABLE', 'ENABLE_KNOWLEDGE_GRAPH'],
  'Monitoring': ['SENTRY_DSN', 'LOG_LEVEL', 'ENABLE_REQUEST_LOGGING'],
  'Other': []
};

const categorized = {};
const varKeys = Object.keys(vars);

// Categorize variables
varKeys.forEach(key => {
  let found = false;
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.includes(key)) {
      if (!categorized[category]) categorized[category] = [];
      categorized[category].push(key);
      found = true;
      break;
    }
  }
  if (!found) {
    if (!categorized['Other']) categorized['Other'] = [];
    categorized['Other'].push(key);
  }
});

// Write categorized variables
for (const [category, keys] of Object.entries(categorized)) {
  if (keys && keys.length > 0) {
    envContent += '# ── ' + category + ' ─'.repeat(Math.max(1, 60 - category.length)) + '\n\n';
    keys.forEach(key => {
      envContent += key + '=' + (vars[key] || '') + '\n';
    });
    envContent += '\n';
  }
}

fs.writeFileSync('.env', envContent);
console.log('✓ Created .env file with ' + varKeys.length + ' variables');

// Display important variables
console.log('\n' + '─'.repeat(60));
console.log('IMPORTANT VARIABLES:');
console.log('─'.repeat(60));

if (vars.DATABASE_URL) {
  const dbUrl = vars.DATABASE_URL;
  const dbMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (dbMatch) {
    console.log('\n📊 PostgreSQL Database:');
    console.log('   Host: ' + dbMatch[3]);
    console.log('   Port: ' + dbMatch[4]);
    console.log('   Database: ' + dbMatch[5]);
    console.log('   User: ' + dbMatch[1]);
  } else {
    console.log('\n📊 DATABASE_URL: ' + dbUrl.substring(0, 50) + '...');
  }
}

if (vars.REDIS_URL) {
  console.log('\n🔴 Redis:');
  console.log('   URL: ' + vars.REDIS_URL.substring(0, 50) + '...');
}

const aiProviders = [];
if (vars.OPENAI_API_KEY) aiProviders.push('OpenAI');
if (vars.ANTHROPIC_API_KEY) aiProviders.push('Anthropic');
if (vars.GOOGLE_AI_API_KEY) aiProviders.push('Google AI');
if (vars.AZURE_OPENAI_API_KEY) aiProviders.push('Azure OpenAI');

if (aiProviders.length > 0) {
  console.log('\n🤖 AI Providers: ' + aiProviders.join(', '));
}

console.log('\n' + '─'.repeat(60));
"

echo -e "${GREEN}✓${NC} Environment file created: .env"

# ── Step 6: Test Connections ───────────────────────────────

echo -e "\n${YELLOW}[6/6]${NC} Testing connections..."

echo ""
echo "Testing database connection..."
if npm run db:test 2>&1 | grep -q "✓"; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${YELLOW}⚠${NC} Database connection test skipped (run 'npm run db:test' manually)"
fi

# Clean up temporary file
rm -f .railway-vars.json

# ── Final Instructions ──────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}✓ Railway setup complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Review the .env file and verify all variables"
echo "  2. Run database migrations:"
echo "     ${BOLD}npm run db:push${NC}"
echo ""
echo "  3. Test the application:"
echo "     ${BOLD}npm run dev${NC}"
echo ""
echo "  4. Deploy to Railway:"
echo "     ${BOLD}railway up${NC}"
echo ""
echo "Useful Railway commands:"
echo ""
echo "  ${BOLD}railway logs${NC}              # View application logs"
echo "  ${BOLD}railway status${NC}            # Check deployment status"
echo "  ${BOLD}railway run npm start${NC}     # Run commands in Railway context"
echo "  ${BOLD}railway open${NC}              # Open Railway dashboard"
echo "  ${BOLD}railway variables${NC}         # List all variables"
echo ""
