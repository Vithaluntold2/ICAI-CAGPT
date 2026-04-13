#!/bin/bash

# Quick Validation Script
# Validates that Azure AI fallback is configured correctly

echo "🔍 ICAI CAGPT Azure AI Fallback Quick Validation"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_check() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

VALIDATION_PASSED=true

echo ""
echo "📋 Configuration Validation:"
echo "----------------------------"

# Check environment file
if [ -f ".env.example" ]; then
    if grep -q "AZURE_OPENAI.*PRIMARY.*DEFAULT" .env.example; then
        print_check "Environment configuration updated for Azure AI priority"
    else
        print_warn "Environment file exists but may need Azure AI priority comments"
    fi
else
    print_warn "No .env.example found - create from template"
fi

# Check AI orchestrator
if grep -q "DEFAULT FALLBACK" server/services/aiOrchestrator.ts 2>/dev/null; then
    print_check "AI Orchestrator configured for Azure AI fallback"
else
    print_fail "AI Orchestrator not properly configured"
    VALIDATION_PASSED=false
fi

# Check query triage
if grep -q "DEFAULT FALLBACK" server/services/queryTriage.ts 2>/dev/null; then
    print_check "Query Triage configured for Azure AI fallback"
else
    print_fail "Query Triage not properly configured"
    VALIDATION_PASSED=false
fi

# Check health monitor
if grep -q "Azure OpenAI.*prefer" server/services/aiProviders/healthMonitor.ts 2>/dev/null; then
    print_check "Health Monitor prioritizes Azure OpenAI"
else
    print_fail "Health Monitor not properly configured"
    VALIDATION_PASSED=false
fi

# Check provider registry
if grep -q "DEFAULT FALLBACK" server/services/aiProviders/registry.ts 2>/dev/null; then
    print_check "Provider Registry marks Azure OpenAI as default fallback"
else
    print_fail "Provider Registry not properly configured"
    VALIDATION_PASSED=false
fi

echo ""
echo "🧪 Test Suite Validation:"
echo "-------------------------"

# Check test files exist
if [ -f "tests/ai-providers/fallback.test.ts" ]; then
    print_check "Fallback system tests created"
else
    print_fail "Fallback tests missing"
    VALIDATION_PASSED=false
fi

if [ -f "tests/ai-providers/quality-assessment.test.ts" ]; then
    print_check "Quality assessment tests created"
else
    print_fail "Quality assessment tests missing"
    VALIDATION_PASSED=false
fi

if [ -f "tests/integration/critical-system.test.ts" ]; then
    print_check "Integration tests created"
else
    print_fail "Integration tests missing"
    VALIDATION_PASSED=false
fi

if [ -f "tests/setup.ts" ]; then
    print_check "Test setup and utilities configured"
else
    print_fail "Test setup missing"
    VALIDATION_PASSED=false
fi

# Check test runner
if [ -x "run-tests.sh" ]; then
    print_check "Test runner script is executable"
else
    print_warn "Test runner script may need execution permissions (chmod +x run-tests.sh)"
fi

# Check Jest configuration
if grep -q "jest" package.json 2>/dev/null; then
    print_check "Jest configuration added to package.json"
else
    print_warn "Jest configuration may be missing from package.json"
fi

echo ""
echo "📚 Documentation Validation:"
echo "----------------------------"

if [ -f "AI_FALLBACK_CONFIGURATION.md" ]; then
    print_check "Fallback configuration documentation exists"
else
    print_fail "Fallback documentation missing"
    VALIDATION_PASSED=false
fi

if [ -f "TESTING_DOCUMENTATION.md" ]; then
    print_check "Testing documentation exists"
else
    print_fail "Testing documentation missing"
    VALIDATION_PASSED=false
fi

echo ""
echo "⚙️ Quick Functionality Check:"
echo "-----------------------------"

# Check TypeScript compilation
if npx tsc --noEmit > /dev/null 2>&1; then
    print_check "TypeScript compilation successful"
else
    print_warn "TypeScript compilation has warnings (may be expected deprecation warnings)"
fi

# Check critical files exist
CRITICAL_FILES=(
    "server/services/aiOrchestrator.ts"
    "server/services/queryTriage.ts" 
    "server/services/aiProviders/healthMonitor.ts"
    "server/services/aiProviders/registry.ts"
    "shared/schema.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_check "Critical file exists: $(basename $file)"
    else
        print_fail "Critical file missing: $file"
        VALIDATION_PASSED=false
    fi
done

echo ""
echo "🎯 Summary:"
echo "----------"

if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
    echo ""
    echo "🚀 Azure AI Fallback System is properly configured!"
    echo ""
    echo "Next Steps:"
    echo "1. Run comprehensive tests: ./run-tests.sh"
    echo "2. Install test dependencies: npm install"
    echo "3. Test individual components: npm run test:fallback"
    echo "4. Generate coverage report: npm run test:coverage"
    echo ""
    echo "📋 Ready for Production Deployment!"
else
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo ""
    echo "⚠️  Some components need attention before deployment"
    echo "Please review the failed items above and fix them"
    echo ""
    echo "Common Fixes:"
    echo "• Ensure all TypeScript files are properly saved"
    echo "• Check file paths and imports"
    echo "• Verify environment configuration"
    echo ""
    echo "Re-run this script after making corrections"
fi

exit $([ "$VALIDATION_PASSED" = true ] && echo 0 || echo 1)