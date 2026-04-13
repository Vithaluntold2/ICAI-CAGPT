# Hybrid Finance Learner

AI-powered financial education with adaptive motivation system.

## Features

✅ **Educational Excellence**
- High-quality finance content (emergency funds, compound interest, credit utilization)
- Real-world examples with concrete numbers
- Actionable steps users can implement immediately

✅ **Technical Excellence** 
- Genuine AI orchestration with multi-agent consultation
- Performance-optimized dopamine effects
- Adaptive system that learns user preferences
- WebSocket real-time updates

✅ **Adaptive Motivation**
- Full dopamine effects for new users (weeks 1-2)
- Moderate effects for regular users (weeks 3-8) 
- Minimal effects for experienced users (week 9+)
- Auto-adjusts based on user behavior patterns

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Run database migrations
npm run migrate

# Start development servers
npm run dev
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  Express Server  │◄──►│   PostgreSQL    │
│                 │    │                  │    │                 │
│ • Hybrid UI     │    │ • AI Orchestrator│    │ • Lessons       │
│ • Dopamine FX   │    │ • Adaptive Engine│    │ • Progress      │
│ • WebSocket     │    │ • WebSocket      │    │ • Engagement    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Components

### 1. Adaptive Dopamine Engine
- **File**: `server/services/adaptiveDopamineEngine.ts`
- **Purpose**: Learns user preferences and adjusts motivation intensity
- **Database**: `user_engagement_profiles`, `engagement_sessions`

### 2. Genuine AI Orchestrator  
- **File**: `server/services/genuineOrchestrator.ts`
- **Purpose**: Real multi-agent consultation for lesson recommendations
- **Features**: Live WebSocket updates, transparent reasoning

### 3. Hybrid Finance Learner
- **File**: `client/src/components/HybridFinanceLearner.tsx`
- **Purpose**: Main UI combining content + adaptive motivation
- **Features**: Performance detection, progressive enhancement

### 4. Optimized Dopamine Effects
- **File**: `client/src/components/OptimizedDopamineEffects.tsx`
- **Purpose**: Device-aware celebrations and sound effects
- **Features**: WebGL detection, hardware concurrency checks

## Database Schema

### Core Tables
- `finance_lessons` - Educational content with integrated assessments
- `user_progress` - Learning metrics and achievements  
- `lesson_completions` - Detailed performance tracking
- `user_engagement_profiles` - Adaptive motivation settings
- `engagement_sessions` - Individual session analytics

### Key Functions
- `update_user_progress()` - Updates learning metrics
- `update_engagement_profile()` - Learns user preferences
- `get_optimal_motivation()` - Returns personalized settings

## API Endpoints

```
GET  /api/finance-learner/motivation-settings/:userId
POST /api/finance-learner/engagement
POST /api/finance-learner/next-lesson  
POST /api/finance-learner/submit
GET  /api/finance-learner/progress/:userId
WS   /api/finance-learner/orchestration
```

## Deployment

```bash
# Build production
npm run build

# Start production server
npm start
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/finance_learner
PORT=3001
NODE_ENV=production
```

## Performance Optimizations

- **Device Detection**: WebGL + hardware concurrency checks
- **Adaptive Scaling**: Reduces effects based on engagement patterns
- **Memory Management**: Cleanup timers, optimized audio contexts
- **Database Indexing**: Optimized queries for user profiles

## User Journey

**Week 1-2 (New Users)**
- Full dopamine: sounds + animations + celebrations
- 2-second celebration duration
- All motivational features enabled

**Week 3-8 (Regular Users)**  
- Moderate dopamine: selective sounds + standard animations
- 1.5-second celebration duration
- User preferences learned and applied

**Week 9+ (Experienced Users)**
- Minimal dopamine: focus on content quality
- 0.8-second celebration duration  
- Educational excellence takes priority

## Success Metrics

- **Engagement**: Session length, completion rates
- **Learning**: Mastery level progression, real-world application
- **Retention**: Long-term user activity, intrinsic motivation development
- **Performance**: Load times, memory usage, battery impact

The system automatically balances engagement and education, starting with maximum motivation support and gradually shifting focus to pure learning value as users develop intrinsic interest in finance.