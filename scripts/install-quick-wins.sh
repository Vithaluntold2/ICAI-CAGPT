#!/bin/bash

# Install only the "Quick Win" libraries for immediate impact
# These provide maximum value with minimal integration effort

set -e

echo "⚡ Installing Quick Win Enhancements..."
echo "======================================"
echo ""

# Quick Win 1: Better Loading States
echo "1️⃣ Installing react-loading-skeleton..."
npm install react-loading-skeleton

# Quick Win 2: Modern Toast Notifications
echo "2️⃣ Installing sonner..."
npm install sonner

# Quick Win 3: Structured Logging
echo "3️⃣ Installing pino..."
npm install pino pino-pretty

# Quick Win 4: Error Tracking
echo "4️⃣ Installing Sentry..."
npm install @sentry/node @sentry/profiling-node

# Quick Win 5: Better Animations
echo "5️⃣ Installing react-spring..."
npm install @react-spring/web

# Quick Win 6: Intersection Observer (lazy loading)
echo "6️⃣ Installing react-intersection-observer..."
npm install react-intersection-observer

# Quick Win 7: Debouncing utilities
echo "7️⃣ Installing use-debounce..."
npm install use-debounce

# Quick Win 8: Immutable state
echo "8️⃣ Installing immer..."
npm install immer

echo ""
echo "✅ Quick Wins Installed!"
echo ""
echo "Next: Implement these features one by one"
echo "Estimated time: 1-2 hours each"
echo ""
echo "Start with:"
echo "  1. Replace toast with sonner (1 hour)"
echo "  2. Add loading skeletons (1 hour)"
echo "  3. Set up Pino logging (1 hour)"
echo "  4. Configure Sentry (30 min)"
echo ""
