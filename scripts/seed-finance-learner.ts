import { db } from '../server/db';

const sampleModules = [
  {
    title: 'Budgeting 101',
    description: 'Learn the fundamentals of creating and managing a personal budget',
    category: 'personal_finance',
    difficulty_level: 'beginner',
    estimated_minutes: 15,
    order_index: 1
  },
  {
    title: 'Understanding Credit Scores',
    description: 'Master credit scores, reports, and how to improve your creditworthiness',
    category: 'personal_finance',
    difficulty_level: 'beginner',
    estimated_minutes: 20,
    order_index: 2
  },
  {
    title: 'Stock Market Basics',
    description: 'Introduction to stocks, how markets work, and basic investment principles',
    category: 'investing',
    difficulty_level: 'beginner',
    estimated_minutes: 25,
    order_index: 3
  }
];

const sampleLessons = [
  // Budgeting 101 lessons
  {
    title: 'What is a Budget?',
    content: {
      text: 'A budget is a plan for how you will spend your money over a specific period. It helps you track income and expenses to ensure you live within your means.',
      examples: ['50/30/20 rule', 'Zero-based budgeting', 'Envelope method'],
      keyPoints: ['Track all income sources', 'List all expenses', 'Set spending limits', 'Review regularly']
    },
    lesson_type: 'text',
    order_index: 1
  },
  {
    title: 'Creating Your First Budget',
    content: {
      text: 'Follow these steps to create an effective budget that works for your lifestyle and financial goals.',
      steps: ['Calculate monthly income', 'List fixed expenses', 'Identify variable expenses', 'Set savings goals', 'Track and adjust'],
      tips: ['Use budgeting apps', 'Start simple', 'Be realistic', 'Include fun money']
    },
    lesson_type: 'interactive',
    order_index: 2
  },
  // Credit Score lessons
  {
    title: 'What Affects Your Credit Score',
    content: {
      text: 'Your credit score is calculated based on five main factors that lenders use to assess your creditworthiness.',
      factors: [
        { name: 'Payment History', weight: '35%', description: 'On-time payments are crucial' },
        { name: 'Credit Utilization', weight: '30%', description: 'Keep balances low' },
        { name: 'Length of Credit History', weight: '15%', description: 'Older accounts help' },
        { name: 'Credit Mix', weight: '10%', description: 'Variety of credit types' },
        { name: 'New Credit', weight: '10%', description: 'Limit new applications' }
      ]
    },
    lesson_type: 'text',
    order_index: 1
  }
];

const sampleQuestions = [
  // Budgeting questions
  {
    question_text: 'What is the 50/30/20 budgeting rule?',
    question_type: 'multiple_choice',
    options: [
      '50% needs, 30% wants, 20% savings',
      '50% savings, 30% needs, 20% wants',
      '50% wants, 30% savings, 20% needs',
      '50% income, 30% expenses, 20% debt'
    ],
    correct_answer: '50% needs, 30% wants, 20% savings',
    explanation: 'The 50/30/20 rule suggests allocating 50% of after-tax income to needs, 30% to wants, and 20% to savings and debt repayment.',
    difficulty: 1
  },
  {
    question_text: 'Which expense category should you prioritize first in your budget?',
    question_type: 'multiple_choice',
    options: [
      'Entertainment',
      'Essential needs (housing, food, utilities)',
      'Luxury items',
      'Hobbies'
    ],
    correct_answer: 'Essential needs (housing, food, utilities)',
    explanation: 'Essential needs like housing, food, and utilities should always be prioritized first as they are necessary for basic living.',
    difficulty: 1
  },
  // Credit score questions
  {
    question_text: 'What factor has the biggest impact on your credit score?',
    question_type: 'multiple_choice',
    options: [
      'Credit utilization',
      'Payment history',
      'Length of credit history',
      'Types of credit'
    ],
    correct_answer: 'Payment history',
    explanation: 'Payment history accounts for 35% of your credit score and is the most important factor. Making payments on time consistently is crucial.',
    difficulty: 1
  }
];

async function seedFinanceLearnerData() {
  try {
    console.log('🌱 Seeding Finance Learner data...');

    // Insert modules and get their IDs
    const moduleIds: string[] = [];
    for (const module of sampleModules) {
      const result = await db.query(`
        INSERT INTO learning_modules (title, description, category, difficulty_level, estimated_minutes, order_index)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [module.title, module.description, module.category, module.difficulty_level, module.estimated_minutes, module.order_index]);
      
      moduleIds.push(result.rows[0].id);
      console.log(`✅ Created module: ${module.title}`);
    }

    // Insert lessons and get their IDs
    const lessonIds: string[] = [];
    let lessonIndex = 0;
    
    // Budgeting lessons (first 2 lessons)
    for (let i = 0; i < 2; i++) {
      const lesson = sampleLessons[lessonIndex];
      const result = await db.query(`
        INSERT INTO learning_lessons (module_id, title, content, lesson_type, order_index)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [moduleIds[0], lesson.title, JSON.stringify(lesson.content), lesson.lesson_type, lesson.order_index]);
      
      lessonIds.push(result.rows[0].id);
      console.log(`✅ Created lesson: ${lesson.title}`);
      lessonIndex++;
    }

    // Credit score lesson (1 lesson)
    const creditLesson = sampleLessons[lessonIndex];
    const result = await db.query(`
      INSERT INTO learning_lessons (module_id, title, content, lesson_type, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [moduleIds[1], creditLesson.title, JSON.stringify(creditLesson.content), creditLesson.lesson_type, creditLesson.order_index]);
    
    lessonIds.push(result.rows[0].id);
    console.log(`✅ Created lesson: ${creditLesson.title}`);

    // Insert quiz questions
    let questionIndex = 0;
    
    // Questions for budgeting lessons
    for (let i = 0; i < 2; i++) {
      const question = sampleQuestions[questionIndex];
      await db.query(`
        INSERT INTO quiz_questions (lesson_id, question_text, question_type, options, correct_answer, explanation, difficulty)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [lessonIds[0], question.question_text, question.question_type, JSON.stringify(question.options), question.correct_answer, question.explanation, question.difficulty]);
      
      console.log(`✅ Created question: ${question.question_text.substring(0, 50)}...`);
      questionIndex++;
    }

    // Question for credit score lesson
    const creditQuestion = sampleQuestions[questionIndex];
    await db.query(`
      INSERT INTO quiz_questions (lesson_id, question_text, question_type, options, correct_answer, explanation, difficulty)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [lessonIds[2], creditQuestion.question_text, creditQuestion.question_type, JSON.stringify(creditQuestion.options), creditQuestion.correct_answer, creditQuestion.explanation, creditQuestion.difficulty]);
    
    console.log(`✅ Created question: ${creditQuestion.question_text.substring(0, 50)}...`);

    console.log('🎉 Finance Learner data seeded successfully!');
    console.log(`📊 Created: ${sampleModules.length} modules, ${sampleLessons.length} lessons, ${sampleQuestions.length} questions`);

  } catch (error) {
    console.error('❌ Error seeding Finance Learner data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedFinanceLearnerData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedFinanceLearnerData };