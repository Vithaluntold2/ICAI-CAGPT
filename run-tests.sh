#!/bin/bash

# ICAI CAGPT Test Execution Script
# Comprehensive testing with quality assessment and critical validation

set -e

echo "🧪 ICAI CAGPT Comprehensive Test Suite"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js and npm are available
print_status "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi

# Install test dependencies if needed
print_status "Installing test dependencies..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/jest" ]; then
    npm install --save-dev @types/jest jest ts-jest typescript
    print_success "Test dependencies installed"
else
    print_success "Test dependencies already available"
fi

# Create Jest configuration if it doesn't exist
if [ ! -f "jest.config.js" ]; then
    print_status "Creating Jest configuration..."
    cat > jest.config.js << EOF
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'server/services/**/*.ts',
    '!server/services/**/*.d.ts',
    '!server/services/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/client/src/\$1',
    '^@shared/(.*)$': '<rootDir>/shared/\$1'
  }
};
EOF
    print_success "Jest configuration created"
fi

# Function to run test suite with error handling
run_test_suite() {
    local test_name="$1"
    local test_path="$2"
    local description="$3"
    
    echo ""
    echo "🔍 Running $test_name"
    echo "   Description: $description"
    echo "   Path: $test_path"
    echo "   ----------------------------------------"
    
    if npx jest "$test_path" --verbose --bail; then
        print_success "$test_name completed successfully"
        return 0
    else
        print_error "$test_name failed"
        return 1
    fi
}

# Initialize test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test Suite 1: AI Provider Fallback System
print_status "Starting AI Provider Fallback System Tests..."
if run_test_suite "Fallback System Tests" "tests/ai-providers/fallback.test.ts" "Provider routing, health monitoring, and failover validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test Suite 2: AI Quality and Capability Assessment
print_status "Starting AI Quality Assessment Tests..."
if run_test_suite "Quality Assessment Tests" "tests/ai-providers/quality-assessment.test.ts" "Response quality, domain expertise, and accuracy validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test Suite 3: Critical System Integration
print_status "Starting Critical System Integration Tests..."
if run_test_suite "Integration Tests" "tests/integration/critical-system.test.ts" "End-to-end scenarios, security, and performance validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

echo ""
echo "📊 Test Execution Summary"
echo "========================"
echo "Total Test Suites: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    print_success "All test suites passed! ✅"
    
    echo ""
    print_status "Running comprehensive coverage analysis..."
    npx jest --coverage --testPathPattern='tests/' --silent > /dev/null 2>&1 || true
    
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_success "Coverage report generated: coverage/lcov-report/index.html"
    fi
    
    echo ""
    print_status "Running performance benchmarks..."
    npx jest --testNamePattern='Performance|Load|Benchmark' --verbose || true
    
    echo ""
    echo "🎉 ICAI CAGPT Test Suite Complete"
    echo "================================="
    print_success "Azure AI fallback system: VALIDATED ✅"
    print_success "Quality assessment: PASSED ✅" 
    print_success "Critical integration: VERIFIED ✅"
    print_success "System ready for production deployment 🚀"
    
    exit 0
else
    print_error "Some test suites failed! ❌"
    echo ""
    print_warning "Please review the failed tests before deploying to production"
    print_warning "Check logs above for detailed error information"
    
    exit 1
fi