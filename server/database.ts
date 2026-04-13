import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, jsonb, date } from 'drizzle-orm/pg-core';

const connectionString = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/finance_learner';
const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client);

// Finance Lessons Schema
export const financeLessons = pgTable('finance_lessons', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  keyTakeaway: text('key_takeaway').notNull(),
  actionableStep: text('actionable_step').notNull(),
  questionText: text('question_text').notNull(),
  questionOptions: jsonb('question_options').notNull(),
  correctAnswer: integer('correct_answer').notNull(),
  explanation: text('explanation').notNull(),
  realWorldExample: text('real_world_example').notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  difficulty: integer('difficulty').notNull(),
  orderIndex: integer('order_index').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const userProgress = pgTable('user_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  totalPoints: integer('total_points').default(0),
  lessonsCompleted: integer('lessons_completed').default(0),
  masteryLevel: integer('mastery_level').default(0),
  correctAnswers: integer('correct_answers').default(0),
  totalAttempts: integer('total_attempts').default(0),
  lastActivityDate: date('last_activity_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const lessonCompletions = pgTable('lesson_completions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  lessonId: integer('lesson_id').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  responseTimeSeconds: integer('response_time_seconds'),
  pointsEarned: integer('points_earned').notNull(),
  confidenceLevel: integer('confidence_level'),
  willApply: boolean('will_apply'),
  completedAt: timestamp('completed_at').defaultNow()
});

export const userEngagementProfiles = pgTable('user_engagement_profiles', {
  userId: integer('user_id').primaryKey(),
  totalSessions: integer('total_sessions').default(0),
  avgSessionLength: integer('avg_session_length').default(0),
  lastActiveDate: date('last_active_date').defaultNow(),
  motivationPreference: varchar('motivation_preference', { length: 10 }).default('adaptive'),
  soundsEnabled: boolean('sounds_enabled').default(true),
  animationsEnabled: boolean('animations_enabled').default(true),
  devicePerformance: varchar('device_performance', { length: 10 }).default('high'),
  totalCorrectAnswers: integer('total_correct_answers').default(0),
  totalWrongAnswers: integer('total_wrong_answers').default(0),
  avgResponseTime: integer('avg_response_time').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const engagementSessions = pgTable('engagement_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  durationMs: integer('duration_ms').notNull(),
  lessonsCompleted: integer('lessons_completed').default(0),
  soundsUsed: boolean('sounds_used').default(false),
  animationsViewed: boolean('animations_viewed').default(false),
  correctAnswers: integer('correct_answers').default(0),
  wrongAnswers: integer('wrong_answers').default(0),
  avgResponseTime: integer('avg_response_time').default(0),
  dopamineTriggersShown: integer('dopamine_triggers_shown').default(0),
  sessionCompletionRate: decimal('session_completion_rate', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow()
});

export const achievements = pgTable('achievements', {
  id: varchar('id', { length: 30 }).primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 10 }).notNull(),
  points: integer('points').notNull(),
  requiredLessons: integer('required_lessons'),
  requiredStreak: integer('required_streak'),
  requiredMastery: integer('required_mastery'),
  createdAt: timestamp('created_at').defaultNow()
});

export const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  achievementId: varchar('achievement_id', { length: 30 }).notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow()
});