import { db, financeLessons, achievements } from './database';
import { sql } from 'drizzle-orm';

async function runMigrations() {
  console.log('Running database migrations...');

  try {
    // Create tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS finance_lessons (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        key_takeaway TEXT NOT NULL,
        actionable_step TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_options JSONB NOT NULL,
        correct_answer INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        real_world_example TEXT NOT NULL,
        category VARCHAR(20) NOT NULL CHECK (category IN ('budgeting', 'investing', 'debt', 'tax')),
        difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
        order_index INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        lessons_completed INTEGER DEFAULT 0,
        mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
        correct_answers INTEGER DEFAULT 0,
        total_attempts INTEGER DEFAULT 0,
        last_activity_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lesson_completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        lesson_id INTEGER NOT NULL,
        is_correct BOOLEAN NOT NULL,
        response_time_seconds INTEGER,
        points_earned INTEGER NOT NULL,
        confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
        will_apply BOOLEAN,
        completed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, lesson_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_engagement_profiles (
        user_id INTEGER PRIMARY KEY,
        total_sessions INTEGER DEFAULT 0,
        avg_session_length INTEGER DEFAULT 0,
        last_active_date DATE DEFAULT CURRENT_DATE,
        motivation_preference VARCHAR(10) DEFAULT 'adaptive' CHECK (motivation_preference IN ('high', 'medium', 'low', 'adaptive')),
        sounds_enabled BOOLEAN DEFAULT true,
        animations_enabled BOOLEAN DEFAULT true,
        device_performance VARCHAR(10) DEFAULT 'high' CHECK (device_performance IN ('high', 'medium', 'low')),
        total_correct_answers INTEGER DEFAULT 0,
        total_wrong_answers INTEGER DEFAULT 0,
        avg_response_time INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS achievements (
        id VARCHAR(30) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        icon VARCHAR(10) NOT NULL,
        points INTEGER NOT NULL,
        required_lessons INTEGER,
        required_streak INTEGER,
        required_mastery INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        achievement_id VARCHAR(30) NOT NULL,
        unlocked_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      );
    `);

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_finance_lessons_active_order ON finance_lessons(is_active, order_index) WHERE is_active = true;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lesson_completions_user ON lesson_completions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON lesson_completions(lesson_id);`);

    console.log('✅ Database tables created successfully');

    // Seed data
    await seedData();
    
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function seedData() {
  console.log('Seeding initial data...');

  // Check if lessons already exist
  const existingLessons = await db.execute(sql`SELECT COUNT(*) as count FROM finance_lessons`);
  if (existingLessons[0].count > 0) {
    console.log('Lessons already exist, skipping seed');
    return;
  }

  // Insert high-quality educational content
  await db.insert(financeLessons).values([
    {
      title: 'Emergency Fund: Your Financial Safety Net',
      content: 'An emergency fund is money set aside for unexpected expenses like medical bills, car repairs, or job loss. Financial experts recommend 3-6 months of living expenses, but start with $1,000 as your first milestone.',
      keyTakeaway: 'Emergency funds prevent debt when life happens unexpectedly.',
      actionableStep: 'Calculate your monthly expenses and set a goal to save $1,000 within 3 months.',
      questionText: 'What\'s the primary purpose of an emergency fund?',
      questionOptions: JSON.stringify([
        "To invest in the stock market when opportunities arise",
        "To cover unexpected expenses without going into debt",
        "To save for vacation and entertainment",
        "To pay regular monthly bills"
      ]),
      correctAnswer: 1,
      explanation: 'Emergency funds act as a financial buffer, preventing you from using credit cards or loans when unexpected expenses occur. This keeps you out of debt and reduces financial stress.',
      realWorldExample: 'Sarah\'s car needed a $800 repair. Because she had an emergency fund, she paid cash instead of putting it on a credit card at 22% interest, saving her $176 in interest charges.',
      category: 'budgeting',
      difficulty: 1,
      orderIndex: 1
    },
    {
      title: 'Compound Interest: The Eighth Wonder of the World',
      content: 'Compound interest is earning interest on both your original investment and previously earned interest. Einstein allegedly called it "the eighth wonder of the world." The key is time - starting early makes a massive difference.',
      keyTakeaway: 'Time is more powerful than the amount you invest when it comes to building wealth.',
      actionableStep: 'Start investing $100/month in a low-cost index fund, even if you think it\'s too small to matter.',
      questionText: 'If you invest $100/month starting at age 25 vs age 35 (both earning 7% annually), how much more will you have at age 65?',
      questionOptions: JSON.stringify([
        "About $50,000 more",
        "About $100,000 more",
        "About $200,000 more",
        "About $300,000 more"
      ]),
      correctAnswer: 2,
      explanation: 'Starting 10 years earlier results in about $200,000 more due to compound interest. The person starting at 25 will have ~$525,000 vs ~$325,000 for the person starting at 35.',
      realWorldExample: 'Twin brothers Mike and Dave both invest $100/month at 7% returns. Mike starts at 25, Dave at 35. At retirement, Mike has $200,000 more despite only investing $12,000 more total.',
      category: 'investing',
      difficulty: 2,
      orderIndex: 2
    },
    {
      title: 'Credit Utilization: The 30% Rule That Builds Credit',
      content: 'Credit utilization is how much of your available credit you\'re using. Keeping it below 30% (ideally below 10%) significantly improves your credit score. This affects loan rates, apartment approvals, and even job opportunities.',
      keyTakeaway: 'Low credit utilization is one of the fastest ways to improve your credit score.',
      actionableStep: 'Check your credit card balances and pay them down to below 30% of your credit limits.',
      questionText: 'You have a credit card with a $1,000 limit. To maintain good credit utilization, your balance should stay below:',
      questionOptions: JSON.stringify([
        "$100 (10%)",
        "$300 (30%)",
        "$500 (50%)",
        "$900 (90%)"
      ]),
      correctAnswer: 1,
      explanation: 'Keeping balances below 30% of your credit limit helps your credit score. Below 10% is even better. This shows lenders you can manage credit responsibly without maxing out your cards.',
      realWorldExample: 'Jessica lowered her credit card balance from $2,800 to $900 on her $3,000 limit card. Her credit score increased by 45 points in two months, qualifying her for a better car loan rate.',
      category: 'debt',
      difficulty: 1,
      orderIndex: 3
    }
  ]);

  // Insert meaningful achievements
  await db.insert(achievements).values([
    {
      id: 'first_lesson',
      title: 'First Step',
      description: 'Completed your first finance lesson',
      icon: '🎓',
      points: 25,
      requiredLessons: 1,
      requiredStreak: null,
      requiredMastery: null
    },
    {
      id: 'budgeting_basics',
      title: 'Budget Master',
      description: 'Completed 3 budgeting lessons',
      icon: '💰',
      points: 50,
      requiredLessons: 3,
      requiredStreak: null,
      requiredMastery: null
    },
    {
      id: 'week_learner',
      title: 'Consistent Learner',
      description: 'Learned for 7 days in a row',
      icon: '🔥',
      points: 75,
      requiredLessons: null,
      requiredStreak: 7,
      requiredMastery: null
    },
    {
      id: 'finance_student',
      title: 'Finance Student',
      description: 'Completed 10 lessons',
      icon: '📚',
      points: 100,
      requiredLessons: 10,
      requiredStreak: null,
      requiredMastery: null
    },
    {
      id: 'mastery_seeker',
      title: 'Knowledge Seeker',
      description: 'Reached 50% mastery level',
      icon: '⭐',
      points: 150,
      requiredLessons: null,
      requiredStreak: null,
      requiredMastery: 50
    }
  ]);

  console.log('✅ Seed data inserted successfully');
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations, seedData };