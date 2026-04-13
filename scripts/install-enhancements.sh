#!/bin/bash

# ICAI CAGPT Enhancement Installation Script
# Run this to install all recommended libraries

set -e

echo "🚀 ICAI CAGPT Enhancement Installation"
echo "======================================"
echo ""

# Phase 1: AI Logic & Reasoning
echo "📦 Phase 1: AI Logic & Reasoning Enhancement..."
npm install langchain @langchain/openai @langchain/anthropic @langchain/community
npm install langsmith
npm install zod-to-json-schema ajv ajv-formats
npm install @pinecone-database/pinecone
npm install cohere-ai
npm install @langchain/pinecone
npm install mammoth cheerio
npm install mathjs financial big.js
npm install dayjs papaparse
echo "✅ Phase 1 Complete"
echo ""

# Phase 2: Infrastructure & Performance
echo "⚡ Phase 2: Infrastructure & Performance..."
npm install @upstash/redis keyv @keyv/redis
npm install lru-cache quick-lru
npm install @upstash/ratelimit
npm install p-queue p-retry async-retry
npm install pino pino-pretty
npm install @sentry/node @sentry/profiling-node
# OpenTelemetry installation commented out for now (heavy dependencies)
# npm install @opentelemetry/api @opentelemetry/sdk-node
# npm install @opentelemetry/instrumentation-express
# npm install @opentelemetry/instrumentation-pg
echo "✅ Phase 2 Complete"
echo ""

# Phase 3: UI/UX Excellence
echo "🎨 Phase 3: UI/UX Excellence..."
npm install remark-gfm rehype-highlight
npm install mermaid
npm install visx d3
npm install @nivo/core @nivo/line @nivo/bar @nivo/pie
npm install react-hook-form-persist
npm install immer use-debounce
npm install sonner
npm install @react-spring/web
npm install react-use-gesture
npm install react-intersection-observer
npm install react-loading-skeleton
npm install react-i18next i18next
npm install @react-aria/focus @react-aria/overlays
npm install react-focus-lock
echo "✅ Phase 3 Complete"
echo ""

# Phase 4: Developer Experience
echo "🛠️ Phase 4: Developer Experience..."
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event
npm install --save-dev msw
npm install --save-dev @playwright/test
npm install --save-dev @vitest/coverage-v8
npm install --save-dev eslint-plugin-react-hooks
npm install --save-dev eslint-plugin-jsx-a11y
npm install --save-dev prettier-plugin-tailwindcss
npm install --save-dev typedoc
npm install --save-dev vite-plugin-compression
npm install --save-dev vite-plugin-pwa
npm install --save-dev rollup-plugin-visualizer
echo "✅ Phase 4 Complete"
echo ""

echo "🎉 All enhancements installed successfully!"
echo ""
echo "Next steps:"
echo "1. Review docs/ENHANCEMENT_ROADMAP.md"
echo "2. Run: npm run setup:services to configure external services"
echo "3. Start implementing quick wins!"
echo ""
