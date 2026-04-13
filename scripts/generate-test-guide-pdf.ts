/**
 * Generates a comprehensive Super Admin User Journey Test Guide PDF
 * Run: npx tsx scripts/generate-test-guide-pdf.ts
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '..', 'SuperAdmin_Test_Guide.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 60, left: 50, right: 50 },
  bufferPages: true,
  info: {
    Title: 'ICAI CAGPT — Super Admin Complete Test Guide',
    Author: 'ICAI CAGPT QA Team',
    Subject: 'Comprehensive Manual E2E Testing Instructions',
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUTPUT_PATH);
doc.pipe(stream);

// ─── Design Tokens ───
const BRAND = '#1a56db';
const BRAND_LIGHT = '#dbeafe';
const DARK = '#111827';
const GRAY = '#4b5563';
const LIGHT_GRAY = '#9ca3af';
const LIGHT_BG = '#f3f4f6';
const GREEN = '#16a34a';
const GREEN_BG = '#dcfce7';
const RED = '#dc2626';
const RED_BG = '#fee2e2';
const AMBER = '#d97706';
const AMBER_BG = '#fef3c7';
const WHITE = '#ffffff';
const PAGE_WIDTH = 495;

// ─── Reusable drawing functions ───

function divider() {
  doc.strokeColor(BRAND).lineWidth(1.5)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.4);
}

function thinDivider() {
  doc.strokeColor('#e5e7eb').lineWidth(0.5)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
}

function sectionTitle(text: string) {
  pageCheck(60);
  doc.moveDown(0.5);
  doc.fontSize(20).fillColor(BRAND).font('Helvetica-Bold').text(text);
  doc.moveDown(0.2);
  divider();
}

function stepTitle(num: number, text: string) {
  pageCheck(50);
  doc.moveDown(0.4);
  const badgeY = doc.y;
  doc.save();
  doc.roundedRect(50, badgeY, 36, 22, 4).fill(BRAND);
  doc.fontSize(12).fillColor(WHITE).font('Helvetica-Bold')
    .text(`${num}`, 50, badgeY + 5, { width: 36, align: 'center' });
  doc.restore();
  doc.fontSize(15).fillColor(DARK).font('Helvetica-Bold')
    .text(text, 94, badgeY + 3);
  doc.y = badgeY + 28;
  doc.moveDown(0.2);
}

function heading(text: string) {
  pageCheck(30);
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text(text);
  doc.moveDown(0.15);
}

function subheading(text: string) {
  pageCheck(20);
  doc.fontSize(10).fillColor(BRAND).font('Helvetica-Bold').text(text);
  doc.moveDown(0.1);
}

function body(text: string) {
  doc.fontSize(10).fillColor(DARK).font('Helvetica').text(text, { lineGap: 3 });
}

function grayNote(text: string) {
  doc.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique').text(text, { lineGap: 2 });
}

function bullet(text: string) {
  doc.fontSize(10).fillColor(DARK).font('Helvetica')
    .text(`•  ${text}`, { lineGap: 2, indent: 10 });
}

function numberedStep(n: number, text: string) {
  doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
    .text(`${n}. `, { continued: true, indent: 10 });
  doc.font('Helvetica').text(text, { lineGap: 2 });
}

function verify(text: string) {
  pageCheck(16);
  doc.fontSize(10).fillColor(GREEN).font('Helvetica-Bold')
    .text('   ✓ Verify: ', { continued: true });
  doc.fillColor(DARK).font('Helvetica').text(text, { lineGap: 2 });
}

function fail(text: string) {
  pageCheck(16);
  doc.fontSize(10).fillColor(RED).font('Helvetica-Bold')
    .text('   ✗ Fail if: ', { continued: true });
  doc.fillColor(DARK).font('Helvetica').text(text, { lineGap: 2 });
}

function warn(text: string) {
  pageCheck(16);
  doc.fontSize(10).fillColor(AMBER).font('Helvetica-Bold')
    .text('   ⚠ Note: ', { continued: true });
  doc.fillColor(DARK).font('Helvetica').text(text, { lineGap: 2 });
}

function codeBlock(text: string, height = 28) {
  pageCheck(height + 10);
  const x = 60;
  const y = doc.y + 4;
  doc.save();
  doc.roundedRect(x, y, PAGE_WIDTH - 20, height, 4).fill('#1e293b');
  doc.fontSize(9).fillColor('#e2e8f0').font('Courier')
    .text(text, x + 10, y + 7, { width: PAGE_WIDTH - 40, lineGap: 3 });
  doc.restore();
  doc.y = y + height + 8;
}

function infoBox(title: string, content: string, bgColor = BRAND_LIGHT, borderColor = BRAND) {
  pageCheck(50);
  const startY = doc.y + 4;
  doc.save();
  doc.roundedRect(55, startY, PAGE_WIDTH - 10, 44, 4).fill(bgColor);
  doc.roundedRect(55, startY, 4, 44, 2).fill(borderColor);
  doc.fontSize(9).fillColor(borderColor).font('Helvetica-Bold')
    .text(title, 68, startY + 6, { width: PAGE_WIDTH - 40 });
  doc.fontSize(9).fillColor(DARK).font('Helvetica')
    .text(content, 68, startY + 20, { width: PAGE_WIDTH - 40, lineGap: 2 });
  doc.restore();
  doc.y = startY + 52;
}

function warnBox(content: string) {
  infoBox('⚠ IMPORTANT', content, AMBER_BG, AMBER);
}

function pageCheck(needed = 80) {
  if (doc.y > 760 - needed) doc.addPage();
}

function tableHeader(cols: { text: string; width: number }[]) {
  pageCheck(22);
  const y = doc.y;
  doc.save();
  doc.rect(50, y, PAGE_WIDTH, 20).fill(BRAND);
  let x = 55;
  cols.forEach(col => {
    doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold')
      .text(col.text, x, y + 5, { width: col.width });
    x += col.width;
  });
  doc.restore();
  doc.y = y + 22;
}

function tableRow(cols: { text: string; width: number }[], alt = false) {
  pageCheck(18);
  const y = doc.y;
  if (alt) {
    doc.save();
    doc.rect(50, y - 2, PAGE_WIDTH, 16).fill(LIGHT_BG);
    doc.restore();
  }
  let x = 55;
  cols.forEach(col => {
    doc.fontSize(8).fillColor(DARK).font('Helvetica')
      .text(col.text, x, y, { width: col.width });
    x += col.width;
  });
  doc.y = y + 16;
}

// ═══════════════════════════════════════════════════════════════
//  COVER PAGE
// ═══════════════════════════════════════════════════════════════

doc.moveDown(5);
doc.save();
doc.roundedRect(210, doc.y, 175, 50, 8).fill(BRAND);
doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold')
  .text('ICAI CAGPT', 210, doc.y + 12, { width: 175, align: 'center' });
doc.restore();
doc.y += 70;

doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
  .text('Super Admin User Journey', { align: 'center' });
doc.moveDown(0.2);
doc.fontSize(16).fillColor(GRAY).font('Helvetica')
  .text('Comprehensive E2E Test Guide', { align: 'center' });
doc.moveDown(1.5);
doc.strokeColor('#e5e7eb').lineWidth(1)
  .moveTo(150, doc.y).lineTo(445, doc.y).stroke();
doc.moveDown(1.5);

const metaItems = [
  ['Document Version', '2.0'],
  ['Platform URL', 'https://cagpt.icai.org'],
  ['Environment', 'Production / Staging'],
  ['Date Generated', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ['Total Test Steps', '12 steps, 65+ verifications'],
  ['Estimated Duration', '45–60 minutes'],
  ['Required Role', 'Super Admin (isSuperAdmin=true)'],
];
metaItems.forEach(([label, value]) => {
  doc.fontSize(10).fillColor(GRAY).font('Helvetica-Bold')
    .text(`${label}:  `, 140, doc.y, { continued: true, width: 150 });
  doc.fillColor(DARK).font('Helvetica').text(value);
  doc.moveDown(0.1);
});

doc.moveDown(2);
doc.save();
doc.roundedRect(60, doc.y, PAGE_WIDTH - 20, 80, 6).fill(LIGHT_BG);
doc.fontSize(9).fillColor(GRAY).font('Helvetica')
  .text(
    'This guide walks through the complete super admin user journey from registration through logout. ' +
    'Each step includes precise actions, expected results, failure criteria, API-level verification commands, ' +
    'browser DevTools checks, edge cases, and database validation queries. ' +
    'The checklist at the end provides a sign-off sheet for QA approval.',
    75, doc.y + 12, { width: PAGE_WIDTH - 50, lineGap: 3 }
  );
doc.restore();
doc.y += 90;

// ═══════════════════════════════════════════════════════════════
//  TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('Table of Contents');
doc.moveDown(0.3);
const tocItems = [
  'Prerequisites & Environment Setup',
  'Step 1 — Register a New Account',
  'Step 2 — Login with Credentials',
  'Step 3 — Verify Authenticated Session',
  'Step 4 — Start a New Chat',
  'Step 5 — Upload a PDF Document',
  'Step 6 — Ask AI About the PDF',
  'Step 7 — Test Multiline Input (Shift+Enter)',
  'Step 8 — Chat History & Navigation',
  'Step 9 — Test Chat Modes',
  'Step 10 — Search Conversations',
  'Step 11 — Super Admin Dashboard & System Monitoring',
  'Step 12 — Logout & Session Verification',
  'API-Level Verification Commands (curl)',
  'Security & Edge Case Testing',
  'Database Validation Queries',
  'Bug Report Template',
  'Final Sign-Off Checklist',
];
tocItems.forEach(item => {
  doc.fontSize(10).fillColor(DARK).font('Helvetica').text(item, 70);
  doc.moveDown(0.05);
});

// ═══════════════════════════════════════════════════════════════
//  PREREQUISITES
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('Prerequisites & Environment Setup');

heading('Browser Requirements');
bullet('Chrome 100+ or Firefox 100+ (latest recommended)');
bullet('DevTools accessible (F12 / Cmd+Option+I)');
bullet('Cookies and JavaScript enabled');
bullet('Screen resolution: 1280x720 minimum');
doc.moveDown(0.2);

heading('Test Environment');
bullet('Production: https://cagpt.icai.org');
bullet('Local dev: http://localhost:5000');
grayNote('If testing locally, ensure the server is running: npm run dev');
doc.moveDown(0.2);

heading('Test Data Required');
bullet('A valid PDF file (1-5 pages, under 10MB) — e.g., a sample balance sheet');
bullet('A second PDF with "invoice" in the filename — e.g., invoice-march-2026.pdf');
bullet('An Excel file (.xlsx) with sample financial data');
bullet('An invalid file (.exe or .zip) for rejection testing');
bullet('A file over 10MB for size limit testing');
doc.moveDown(0.2);

heading('Database Access (for Super Admin setup)');
body('You need direct database access to promote a user to super admin.');
doc.moveDown(0.2);
codeBlock('psql $DATABASE_URL', 20);
doc.moveDown(0.1);

heading('Accounts Needed');
tableHeader([
  { text: 'Account', width: 140 },
  { text: 'Role', width: 100 },
  { text: 'Purpose', width: 245 },
]);
tableRow([{ text: 'superadmin@yourco.com', width: 140 }, { text: 'Super Admin', width: 100 }, { text: 'Full journey test (register fresh or use existing)', width: 245 }], false);
tableRow([{ text: 'regularuser@test.com', width: 140 }, { text: 'Regular User', width: 100 }, { text: 'Verify permission denials on admin endpoints', width: 245 }], true);
doc.moveDown(0.3);

heading('Promoting to Super Admin');
body('After registering, run this SQL:');
doc.moveDown(0.2);
codeBlock("UPDATE users\nSET is_admin = true, is_super_admin = true\nWHERE email = 'superadmin@yourco.com';", 42);

// ═══════════════════════════════════════════════════════════════
//  STEP 1: REGISTER
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(1, 'Register a New Account');

heading('Actions');
numberedStep(1, 'Open the platform URL in your browser');
numberedStep(2, 'Click "Sign Up" or "Register"');
numberedStep(3, 'Fill in the registration form:');
doc.moveDown(0.1);
tableHeader([
  { text: 'Field', width: 100 },
  { text: 'Value', width: 200 },
  { text: 'Validation', width: 185 },
]);
tableRow([{ text: 'Name', width: 100 }, { text: 'Super Admin Tester', width: 200 }, { text: 'Required, min 1 char', width: 185 }], false);
tableRow([{ text: 'Email', width: 100 }, { text: 'superadmin@yourco.com', width: 200 }, { text: 'Required, valid email format', width: 185 }], true);
tableRow([{ text: 'Password', width: 100 }, { text: 'SecureP@ss123!', width: 200 }, { text: 'Required, 8-128 characters', width: 185 }], false);
doc.moveDown(0.2);
numberedStep(4, 'Click "Register"');
doc.moveDown(0.2);

heading('Expected Results');
verify('HTTP 200 response (check Network tab)');
verify('Redirected to chat interface automatically');
verify('No password in the API response body');
verify('Cookie "luca.sid" in DevTools > Application > Cookies');
verify('Name displayed in sidebar / profile area');
doc.moveDown(0.2);

heading('Failure Criteria');
fail('Registration succeeds with password under 8 characters');
fail('Registration succeeds with invalid email format');
fail('Password appears anywhere in API response');
fail('Duplicate email returns 200 instead of 400');
doc.moveDown(0.2);

heading('Browser DevTools Check');
body('Network tab > POST /api/auth/register:');
bullet('Status: 200');
bullet('Response: { user: { id, email, name, ... } }');
bullet('Response does NOT contain "password", "mfaSecret", "mfaBackupCodes"');
bullet('Response Headers: Set-Cookie with "luca.sid"');
doc.moveDown(0.2);

heading('Edge Cases');
bullet('Same email again → 400 "Email already registered"');
bullet('Empty name → 400 validation error');
bullet('129-char password → 400');
bullet("Special chars in name (O'Brien) → should succeed");

// ═══════════════════════════════════════════════════════════════
//  STEP 2: LOGIN
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(2, 'Login with Credentials');

heading('Actions');
numberedStep(1, 'If logged in from Step 1, click Logout first');
numberedStep(2, 'Navigate to login page');
numberedStep(3, 'Enter email and password from Step 1');
numberedStep(4, 'Click "Login"');
doc.moveDown(0.2);

heading('Expected Results');
verify('HTTP 200 with user object');
verify('Chat interface loads');
verify('User name visible in sidebar');
verify('isSuperAdmin: true in API response (after DB promotion)');
verify('Session cookie refreshed');
doc.moveDown(0.2);

heading('Failure Criteria');
fail('Login succeeds with wrong password');
fail('Login succeeds with non-existent email');
fail('Sensitive fields (password, mfaSecret) in response');
doc.moveDown(0.2);

heading('Account Lockout Testing');
numberedStep(1, 'Enter correct email with WRONG password');
numberedStep(2, 'Repeat 5 times');
verify('After 3-4 attempts, warning shows remaining attempts');
verify('After 5 fails, account locked (HTTP 423)');
verify('Lockout message includes time remaining');
doc.moveDown(0.1);
warn('After lockout testing, reset in DB:');
codeBlock("UPDATE users SET failed_login_attempts=0, locked_until=NULL\nWHERE email='superadmin@yourco.com';", 34);

heading('Edge Cases');
bullet('Empty password → should fail');
bullet('Wrong email → "No account found"');

// ═══════════════════════════════════════════════════════════════
//  STEP 3: VERIFY SESSION
// ═══════════════════════════════════════════════════════════════

pageCheck(200);
stepTitle(3, 'Verify Authenticated Session');

heading('Actions');
numberedStep(1, 'After login, open DevTools > Console');
numberedStep(2, 'Run:');
codeBlock('fetch("/api/auth/me").then(r=>r.json()).then(d=>console.log(d))');
doc.moveDown(0.2);

heading('Expected Results');
verify('Status: 200');
verify('Body: { user: { id, email, name, isSuperAdmin: true, ... } }');
verify('No sensitive fields');
doc.moveDown(0.2);

heading('Cookie Inspection');
body('DevTools > Application > Cookies > your domain > "luca.sid":');
doc.moveDown(0.1);
tableHeader([
  { text: 'Property', width: 100 },
  { text: 'Expected', width: 200 },
  { text: 'Security Impact', width: 185 },
]);
tableRow([{ text: 'Name', width: 100 }, { text: 'luca.sid', width: 200 }, { text: 'Custom name hides tech stack', width: 185 }], false);
tableRow([{ text: 'HttpOnly', width: 100 }, { text: 'true (checked)', width: 200 }, { text: 'Prevents XSS cookie theft', width: 185 }], true);
tableRow([{ text: 'Secure', width: 100 }, { text: 'true (HTTPS)', width: 200 }, { text: 'Cookie only over TLS', width: 185 }], false);
tableRow([{ text: 'SameSite', width: 100 }, { text: 'Lax', width: 200 }, { text: 'CSRF protection', width: 185 }], true);
tableRow([{ text: 'Max-Age', width: 100 }, { text: '30 days', width: 200 }, { text: 'Rolling — resets on activity', width: 185 }], false);

// ═══════════════════════════════════════════════════════════════
//  STEP 4: NEW CHAT
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(4, 'Start a New Chat');

heading('Actions');
numberedStep(1, 'Click "+ New Chat" in the sidebar');
doc.moveDown(0.2);

heading('Expected Results');
verify('Chat area clears — shows empty conversation');
verify('Text input visible at bottom');
verify('Send button visible (arrow icon)');
verify('Attach file button (paperclip) visible');
verify('Chat mode selector visible');
verify('No error messages or blank screens');
doc.moveDown(0.2);

heading('UI Element Checklist');
bullet('Sidebar: conversation list on the left');
bullet('Main area: empty chat with welcome or prompt suggestions');
bullet('Input area: textarea + attach button + send button');
bullet('Mode dock: ribbon showing available chat modes');
bullet('Profile: user avatar/name accessible');

// ═══════════════════════════════════════════════════════════════
//  STEP 5: UPLOAD PDF
// ═══════════════════════════════════════════════════════════════

pageCheck(200);
stepTitle(5, 'Upload a PDF Document');

heading('Supported File Types');
tableHeader([
  { text: 'Format', width: 100 },
  { text: 'MIME Type', width: 220 },
  { text: 'Max Size', width: 165 },
]);
tableRow([{ text: 'PDF', width: 100 }, { text: 'application/pdf', width: 220 }, { text: '10MB', width: 165 }], false);
tableRow([{ text: 'PNG', width: 100 }, { text: 'image/png', width: 220 }, { text: '10MB', width: 165 }], true);
tableRow([{ text: 'JPEG', width: 100 }, { text: 'image/jpeg', width: 220 }, { text: '10MB', width: 165 }], false);
tableRow([{ text: 'TIFF', width: 100 }, { text: 'image/tiff', width: 220 }, { text: '10MB', width: 165 }], true);
tableRow([{ text: 'Excel (.xlsx)', width: 100 }, { text: 'application/vnd.openxmlformats...', width: 220 }, { text: '10MB', width: 165 }], false);
tableRow([{ text: 'Excel (.xls)', width: 100 }, { text: 'application/vnd.ms-excel', width: 220 }, { text: '10MB', width: 165 }], true);
tableRow([{ text: 'CSV', width: 100 }, { text: 'text/csv', width: 220 }, { text: '10MB', width: 165 }], false);
tableRow([{ text: 'Text', width: 100 }, { text: 'text/plain', width: 220 }, { text: '10MB', width: 165 }], true);

doc.moveDown(0.3);
heading('Document Type Auto-Detection');
tableHeader([
  { text: 'Filename Contains', width: 150 },
  { text: 'Detected Type', width: 150 },
  { text: 'Test File Example', width: 185 },
]);
tableRow([{ text: '"invoice"', width: 150 }, { text: 'Invoice', width: 150 }, { text: 'invoice-march-2026.pdf', width: 185 }], false);
tableRow([{ text: '"receipt"', width: 150 }, { text: 'Receipt', width: 150 }, { text: 'receipt-supplies.pdf', width: 185 }], true);
tableRow([{ text: '"w2" or "w-2"', width: 150 }, { text: 'W-2', width: 150 }, { text: 'w2-2025-acme.pdf', width: 185 }], false);
tableRow([{ text: '"1040"', width: 150 }, { text: '1040', width: 150 }, { text: '1040-federal-2025.pdf', width: 185 }], true);
tableRow([{ text: '"1098"', width: 150 }, { text: '1098', width: 150 }, { text: '1098-mortgage.pdf', width: 185 }], false);
tableRow([{ text: '"1099"', width: 150 }, { text: '1099', width: 150 }, { text: '1099-misc.pdf', width: 185 }], true);
tableRow([{ text: 'Anything else', width: 150 }, { text: 'Document', width: 150 }, { text: 'balance-sheet.pdf', width: 185 }], false);

doc.moveDown(0.3);
heading('Test Actions');
numberedStep(1, 'Click the paperclip icon next to the text input');
numberedStep(2, 'Select a PDF (e.g., "balance-sheet-2025.pdf")');
numberedStep(3, 'Wait for upload to complete');
doc.moveDown(0.2);

heading('Expected Results');
verify('File name appears as a badge near the input');
verify('No error toasts');
verify('Network: POST /api/chat/upload-file → 200');
verify('Response: { success: true, file: { name, size, type, base64Data, documentType } }');
doc.moveDown(0.2);

heading('Rejection Test Cases');
tableHeader([
  { text: 'Test Case', width: 200 },
  { text: 'Expected', width: 100 },
  { text: 'Error Message', width: 185 },
]);
tableRow([{ text: 'Upload .exe file', width: 200 }, { text: '400', width: 100 }, { text: 'Invalid file type', width: 185 }], false);
tableRow([{ text: 'Upload .zip file', width: 200 }, { text: '400', width: 100 }, { text: 'Invalid file type', width: 185 }], true);
tableRow([{ text: 'Upload file > 10MB', width: 200 }, { text: '400', width: 100 }, { text: 'File too large', width: 185 }], false);
tableRow([{ text: 'Upload with no auth', width: 200 }, { text: '401', width: 100 }, { text: 'Authentication required', width: 185 }], true);
tableRow([{ text: 'Upload no file', width: 200 }, { text: '400', width: 100 }, { text: 'No file uploaded', width: 185 }], false);

// ═══════════════════════════════════════════════════════════════
//  STEP 6: ASK ABOUT PDF
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(6, 'Ask AI About the Uploaded PDF');

heading('Actions');
numberedStep(1, 'With PDF attached (badge visible), type:');
codeBlock('"Analyze this balance sheet and calculate the debt-to-equity ratio"');
numberedStep(2, 'Press Enter or click Send');
numberedStep(3, 'Wait for AI to respond');
doc.moveDown(0.2);

heading('Expected Results');
verify('Loading indicator appears');
verify('AI response arrives within 5-30 seconds');
verify('Response references content from the document');
verify('Markdown formatting: headers, tables, bold');
verify('No raw JSON dumps');
verify('No Excel formulas like =NPV() or =IRR()');
verify('Financial numbers formatted readably ($125,000 not 125000)');
doc.moveDown(0.2);

heading('API-Level Verification');
body('Network tab > POST /api/chat:');
bullet('Request body has documentAttachment with base64 data');
bullet('Response: { conversationId, message: { role: "assistant", content }, metadata }');
bullet('metadata.modelUsed is a valid model (e.g., "gpt-4o")');
doc.moveDown(0.2);

heading('Follow-Up Test');
numberedStep(4, 'WITHOUT attaching another file, type:');
codeBlock('"What are the key observations from that document?"');
numberedStep(5, 'Press Enter');
verify('AI responds with context from the SAME conversation');
verify('No "I don\'t have access to documents" response');
doc.moveDown(0.2);

heading('Alternative Test Prompts');
bullet('"Identify the top 3 financial concerns"');
bullet('"What is the current ratio based on this balance sheet?"');
bullet('"Summarize key line items and year-over-year changes"');
bullet('"Any red flags for an auditor?"');

// ═══════════════════════════════════════════════════════════════
//  STEP 7: MULTILINE
// ═══════════════════════════════════════════════════════════════

pageCheck(200);
stepTitle(7, 'Test Multiline Input (Shift+Enter)');

heading('Actions');
numberedStep(1, 'Click in the text input');
numberedStep(2, 'Type: "First line of my question"');
numberedStep(3, 'Press Shift+Enter (new line, NOT send)');
numberedStep(4, 'Type: "Second line with more context"');
numberedStep(5, 'Press Shift+Enter again');
numberedStep(6, 'Type: "Third line"');
numberedStep(7, 'Press Enter alone (sends the message)');
doc.moveDown(0.2);

heading('Expected Results');
verify('Shift+Enter creates a visible new line in input');
verify('Input area grows taller for multiple lines');
verify('Enter alone sends the complete multi-line message');
verify('Message displays with line breaks preserved');
doc.moveDown(0.2);

heading('Failure Criteria');
fail('Shift+Enter sends the message');
fail('Enter does not send');
fail('Input area does not grow');
fail('Line breaks lost in displayed message');

// ═══════════════════════════════════════════════════════════════
//  STEP 8: CHAT HISTORY
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(8, 'Chat History & Navigation');

heading('Actions');
numberedStep(1, 'Verify current conversation has an auto-generated title in sidebar');
grayNote('Title auto-generates from first message (may take a few seconds)');
numberedStep(2, 'Click "+ New Chat" for a second conversation');
numberedStep(3, 'Send a message in the new conversation');
numberedStep(4, 'Click back on the FIRST conversation');
doc.moveDown(0.2);

heading('Expected Results');
verify('First conversation loads with ALL previous messages');
verify('Messages in correct chronological order');
verify('User messages on the right, AI on the left');
verify('Auto-scrolls to the most recent (bottom) message');
verify('PDF attachment reference still visible');
verify('Markdown formatting preserved');
doc.moveDown(0.2);

heading('Performance');
bullet('Messages load within 1-2 seconds');
bullet('No visible flicker or layout shift');
bullet('Scroll position lands at the bottom');
doc.moveDown(0.2);

heading('Edge Cases');
bullet('Rapidly click between 3+ conversations → all load correctly');
bullet('Scroll up, switch away, switch back → scrolls to bottom');
bullet('50+ message conversations still load smoothly');

// ═══════════════════════════════════════════════════════════════
//  STEP 9: CHAT MODES
// ═══════════════════════════════════════════════════════════════

pageCheck(200);
stepTitle(9, 'Test Chat Modes');

heading('Available Modes');
tableHeader([
  { text: 'Mode', width: 120 },
  { text: 'Purpose', width: 220 },
  { text: 'Test Query', width: 145 },
]);
tableRow([{ text: 'Standard', width: 120 }, { text: 'General accounting Q&A', width: 220 }, { text: '"What is GAAP?"', width: 145 }], false);
tableRow([{ text: 'Deep Research', width: 120 }, { text: 'Multi-source analysis', width: 220 }, { text: '"Compare IFRS vs GAAP"', width: 145 }], true);
tableRow([{ text: 'Tax Advisor', width: 120 }, { text: 'Tax-specific guidance', width: 220 }, { text: '"Section 179 deduction"', width: 145 }], false);
tableRow([{ text: 'Calculation', width: 120 }, { text: 'Financial calculations', width: 220 }, { text: '"NPV of $10K/yr for 5yr"', width: 145 }], true);
tableRow([{ text: 'Audit Assistant', width: 120 }, { text: 'Audit procedures', width: 220 }, { text: '"Audit cash accounts"', width: 145 }], false);
doc.moveDown(0.2);

heading('Actions');
numberedStep(1, 'Switch to "Deep Research" mode');
numberedStep(2, 'Type: "Compare IFRS vs US GAAP treatment of goodwill"');
numberedStep(3, 'Send');
numberedStep(4, 'Switch to "Tax Advisor" mode');
numberedStep(5, 'Type: "Section 179 deduction limits for 2025?"');
numberedStep(6, 'Send');
doc.moveDown(0.2);

heading('Expected Results');
verify('Mode indicator updates in UI');
verify('Deep Research response is longer, cites standards');
verify('Tax Advisor focuses on tax law, correct jurisdiction');
verify('Calculation mode returns Excel formulas (not computed numbers)');

// ═══════════════════════════════════════════════════════════════
//  STEP 10: SEARCH
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(10, 'Search Conversations');

heading('Actions');
numberedStep(1, 'Locate search bar in sidebar');
numberedStep(2, 'Type a keyword from a previous conversation');
numberedStep(3, 'Observe filtering');
numberedStep(4, 'Clear the search field');
doc.moveDown(0.2);

heading('Expected Results');
verify('Conversations filter in real-time');
verify('Only matching conversations shown');
verify('Clearing restores full list');
verify('Clicking a result opens it');
doc.moveDown(0.2);

heading('Edge Cases');
bullet('No matches → "No conversations found"');
bullet('Special characters → should not crash');
bullet('Very long search string → handled gracefully');

// ═══════════════════════════════════════════════════════════════
//  STEP 11: SUPER ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

stepTitle(11, 'Super Admin Dashboard & System Monitoring');
warnBox('Requires isSuperAdmin=true in DB. Run the SQL from Prerequisites if needed.');
doc.moveDown(0.2);

heading('Dashboard Panels');
tableHeader([
  { text: 'Panel', width: 130 },
  { text: 'API Endpoint', width: 200 },
  { text: 'Expected', width: 155 },
]);
tableRow([{ text: 'KPI Dashboard', width: 130 }, { text: 'GET /api/admin/kpis', width: 200 }, { text: '200', width: 155 }], false);
tableRow([{ text: 'System Health', width: 130 }, { text: 'GET /api/admin/system/health', width: 200 }, { text: '200', width: 155 }], true);
tableRow([{ text: 'Security Threats', width: 130 }, { text: 'GET /api/admin/system/threats', width: 200 }, { text: '200', width: 155 }], false);
tableRow([{ text: 'AI Costs', width: 130 }, { text: 'GET /api/superadmin/ai-costs', width: 200 }, { text: '200', width: 155 }], true);
tableRow([{ text: 'Integrations', width: 130 }, { text: 'GET /api/admin/system/integrations', width: 200 }, { text: '200', width: 155 }], false);
tableRow([{ text: 'Alerts', width: 130 }, { text: 'GET /api/admin/system/alerts', width: 200 }, { text: '200', width: 155 }], true);
tableRow([{ text: 'Maintenance', width: 130 }, { text: 'GET /api/admin/system/maintenance', width: 200 }, { text: '200', width: 155 }], false);
tableRow([{ text: 'Deployments', width: 130 }, { text: 'GET /api/admin/system/deployments', width: 200 }, { text: '200', width: 155 }], true);
tableRow([{ text: 'Performance', width: 130 }, { text: 'GET /api/admin/system/performance', width: 200 }, { text: '200', width: 155 }], false);
tableRow([{ text: 'Routes', width: 130 }, { text: 'GET /api/admin/system/routes', width: 200 }, { text: '200', width: 155 }], true);
doc.moveDown(0.2);

heading('Permission Denial Test');
numberedStep(1, 'Log in as a REGULAR user (not super admin)');
numberedStep(2, 'Try navigating to admin dashboard');
verify('All admin endpoints return HTTP 403');
verify('Error: "Super admin access required"');
verify('No data leakage in error response');

// ═══════════════════════════════════════════════════════════════
//  STEP 12: LOGOUT
// ═══════════════════════════════════════════════════════════════

doc.addPage();
stepTitle(12, 'Logout & Session Verification');

heading('Actions');
numberedStep(1, 'Click profile/avatar or settings dropdown');
numberedStep(2, 'Click "Logout"');
doc.moveDown(0.2);

heading('Expected Results');
verify('Redirected to login page');
verify('luca.sid cookie cleared');
verify('No flash of auth content before redirect');
doc.moveDown(0.2);

heading('Post-Logout Verification');
numberedStep(3, 'Try navigating to chat URL');
verify('Redirects to login');
numberedStep(4, 'DevTools Console:');
codeBlock('fetch("/api/auth/me").then(r=>console.log("Status:", r.status))');
verify('Prints "Status: 401"');
numberedStep(5, 'Try admin endpoint:');
codeBlock('fetch("/api/admin/kpis").then(r=>console.log("Status:", r.status))');
verify('Prints "Status: 401"');
numberedStep(6, 'Try file upload:');
codeBlock('let f=new FormData();f.append("file",new Blob(["x"]),"t.pdf");\nfetch("/api/chat/upload-file",{method:"POST",body:f})\n  .then(r=>console.log(r.status))', 42);
verify('Prints 401');

// ═══════════════════════════════════════════════════════════════
//  CURL COMMANDS
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('API-Level Verification Commands (curl)');
body('Use these from a terminal independently of the UI. Replace values as needed.');
doc.moveDown(0.3);

heading('Register');
codeBlock('curl -X POST https://cagpt.icai.org/api/auth/register \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"t@x.com","password":"Test1234!","name":"T"}\' \\\n  -c cookies.txt', 50);

heading('Login');
codeBlock('curl -X POST https://cagpt.icai.org/api/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"t@x.com","password":"Test1234!"}\' \\\n  -c cookies.txt', 42);

heading('Check Session');
codeBlock('curl https://cagpt.icai.org/api/auth/me -b cookies.txt', 20);

heading('Upload PDF');
codeBlock('curl -X POST https://cagpt.icai.org/api/chat/upload-file \\\n  -b cookies.txt -F "file=@balance-sheet.pdf"', 34);

heading('Send Chat');
codeBlock('curl -X POST https://cagpt.icai.org/api/chat \\\n  -H "Content-Type: application/json" -b cookies.txt \\\n  -d \'{"message":"What is GAAP?","chatMode":"standard"}\'', 42);

heading('Super Admin Health');
codeBlock('curl https://cagpt.icai.org/api/admin/system/health -b cookies.txt', 20);

heading('Logout + Verify');
codeBlock('curl -X POST https://cagpt.icai.org/api/auth/logout -b cookies.txt\ncurl https://cagpt.icai.org/api/auth/me -b cookies.txt\n# Should return: {"error":"Authentication required"}', 42);

// ═══════════════════════════════════════════════════════════════
//  SECURITY TESTING
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('Security & Edge Case Testing');

heading('Input Validation Attacks');
tableHeader([
  { text: 'Test', width: 200 },
  { text: 'Input', width: 150 },
  { text: 'Expected', width: 135 },
]);
tableRow([{ text: 'XSS in chat', width: 200 }, { text: '<script>alert(1)</script>', width: 150 }, { text: 'Rendered as text', width: 135 }], false);
tableRow([{ text: 'SQL injection in search', width: 200 }, { text: "'; DROP TABLE users;--", width: 150 }, { text: 'No SQL error', width: 135 }], true);
tableRow([{ text: 'XSS in register name', width: 200 }, { text: '<img onerror=alert(1)>', width: 150 }, { text: 'Sanitized/escaped', width: 135 }], false);
tableRow([{ text: 'Very long message 50K', width: 200 }, { text: '"A".repeat(50000)', width: 150 }, { text: 'Handled gracefully', width: 135 }], true);
tableRow([{ text: 'Empty message', width: 200 }, { text: '""', width: 150 }, { text: 'Not sent', width: 135 }], false);
tableRow([{ text: 'Unicode/emoji', width: 200 }, { text: '🧮 "Analyze 会計"', width: 150 }, { text: 'Works correctly', width: 135 }], true);
doc.moveDown(0.3);

heading('Rate Limiting');
bullet('100+ rapid chat messages → HTTP 429 after limit');
bullet('10 rapid registrations → rate limited');
bullet('Rapid file uploads → rate limited');
doc.moveDown(0.2);

heading('Session Security');
bullet('Copy cookie to another browser → session works');
bullet('Modify cookie value → 401');
bullet('2 tabs same session → both work');
bullet('Idle 30+ days → expires');
doc.moveDown(0.2);

heading('File Upload Security');
bullet('Rename .exe to .pdf → rejected by MIME check');
bullet('Polyglot file → virus scan flags it');
bullet('0-byte PDF → rejected or handled gracefully');

// ═══════════════════════════════════════════════════════════════
//  DATABASE VALIDATION
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('Database Validation Queries');
body('Run after testing to verify data integrity:');
doc.moveDown(0.3);

heading('Verify User');
codeBlock("SELECT id, email, name, is_admin, is_super_admin,\n  subscription_tier, created_at\nFROM users WHERE email = 'superadmin@yourco.com';", 42);

heading('Verify Conversations');
codeBlock("SELECT c.id, c.title, c.preview, c.created_at,\n  COUNT(m.id) as msg_count\nFROM conversations c\nLEFT JOIN messages m ON m.conversation_id = c.id\nWHERE c.user_id = '<USER_ID>'\nGROUP BY c.id ORDER BY c.created_at DESC;", 70);

heading('Verify Messages');
codeBlock("SELECT id, role, LEFT(content, 80) as preview,\n  model_used, tokens_used, created_at\nFROM messages\nWHERE conversation_id = '<CONV_ID>'\nORDER BY created_at;", 58);

heading('Check Sessions');
codeBlock("SELECT sid, expire,\n  sess::json->>'userId' as user_id\nFROM user_sessions\nWHERE sess::text LIKE '%<USER_ID>%';", 42);

heading('No Password Leakage');
codeBlock("SELECT id, content FROM messages\nWHERE content LIKE '%$2b$%'\n   OR content LIKE '%password%';", 42);

// ═══════════════════════════════════════════════════════════════
//  BUG REPORT TEMPLATE
// ═══════════════════════════════════════════════════════════════

pageCheck(300);
sectionTitle('Bug Report Template');
body('Copy when filing bugs:');
doc.moveDown(0.3);

doc.save();
doc.roundedRect(55, doc.y, PAGE_WIDTH - 10, 210, 4).fill(LIGHT_BG);
const bugY = doc.y + 8;
doc.fontSize(9).fillColor(DARK).font('Courier')
  .text(
    'Title: [Step X] Brief description\n\n' +
    'Environment: Production / Staging / Local\n' +
    'URL: https://cagpt.icai.org/...\n' +
    'Browser: Chrome 120 / Firefox 120\n' +
    'User Role: Super Admin / Regular User\n\n' +
    'Steps to Reproduce:\n' +
    '1. ...\n' +
    '2. ...\n' +
    '3. ...\n\n' +
    'Expected Result: ...\n' +
    'Actual Result: ...\n\n' +
    'Screenshots/Recordings: [attach]\n' +
    'Console Errors: [paste from DevTools]\n' +
    'Network Request/Response: [paste relevant]\n\n' +
    'Severity: Critical / High / Medium / Low\n' +
    'Frequency: Always / Sometimes / Once',
    65, bugY, { width: PAGE_WIDTH - 40, lineGap: 2 }
  );
doc.restore();
doc.y = bugY + 220;

// ═══════════════════════════════════════════════════════════════
//  FINAL CHECKLIST
// ═══════════════════════════════════════════════════════════════

doc.addPage();
sectionTitle('Final Sign-Off Checklist');
body('Check each item after verifying. Sign and date at the bottom.');
doc.moveDown(0.4);

const CHECK = '☐';

const checklistSections = [
  {
    title: 'Authentication & Session',
    items: [
      'Registration succeeds with valid data',
      'Registration rejects invalid email / weak password / duplicate',
      'Login succeeds with correct credentials',
      'Login rejects wrong password / non-existent email',
      'Account locks after 5 failed login attempts',
      'Session cookie has HttpOnly, Secure, SameSite=Lax',
      'GET /api/auth/me returns user data when logged in',
      'Sensitive fields never in any API response',
    ],
  },
  {
    title: 'Chat & PDF Upload',
    items: [
      'New chat creates empty conversation',
      'PDF upload succeeds (200, badge appears)',
      'Document type auto-detected from filename',
      'Invalid file types rejected (.exe, .zip → 400)',
      'Oversized files rejected (>10MB → 400)',
      'Upload rejected without auth (401)',
      'Chat message with PDF processes successfully',
      'AI response references document content',
      'Follow-up messages retain conversation context',
    ],
  },
  {
    title: 'UI & Input',
    items: [
      'Shift+Enter creates new line (not send)',
      'Enter alone sends message',
      'Input area grows for multiline',
      'Chat history loads correctly on switch',
      'Auto-scrolls to bottom',
      'Markdown renders (tables, bold, code)',
      'No raw JSON or Excel formulas in responses',
      'Chat modes switch correctly',
      'Search filters conversations in real-time',
    ],
  },
  {
    title: 'Super Admin Access',
    items: [
      'KPI dashboard loads (200)',
      'System health returns status',
      'Security threats log accessible',
      'AI costs breakdown loads',
      'Integrations list loads',
      'System alerts panel works',
      'Maintenance tasks accessible',
      'Deployment history loads',
      'Regular user gets 403 on all admin endpoints',
    ],
  },
  {
    title: 'Logout & Security',
    items: [
      'Logout clears session',
      'All protected endpoints return 401 after logout',
      'XSS payloads rendered as plain text',
      'SQL injection handled gracefully',
      'Rate limiting works on rapid requests',
    ],
  },
];

checklistSections.forEach(section => {
  pageCheck(40 + section.items.length * 16);
  subheading(section.title.toUpperCase());
  doc.moveDown(0.1);
  section.items.forEach((item, i) => {
    pageCheck(16);
    const y = doc.y;
    if (i % 2 === 0) {
      doc.save();
      doc.rect(50, y - 2, PAGE_WIDTH, 14).fill(LIGHT_BG);
      doc.restore();
    }
    doc.fontSize(9).fillColor(DARK).font('Helvetica')
      .text(`${CHECK}  ${item}`, 55, y, { width: PAGE_WIDTH - 30 });
    doc.y = y + 15;
  });
  doc.moveDown(0.3);
});

// Sign-off
doc.moveDown(0.5);
thinDivider();
doc.moveDown(0.5);

let sy = doc.y;
doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('Tested By:', 55, sy);
doc.strokeColor(GRAY).lineWidth(0.5).moveTo(130, sy + 12).lineTo(300, sy + 12).stroke();
doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('Date:', 320, sy);
doc.strokeColor(GRAY).lineWidth(0.5).moveTo(355, sy + 12).lineTo(500, sy + 12).stroke();

doc.moveDown(1.5);
sy = doc.y;
doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('Approved By:', 55, sy);
doc.strokeColor(GRAY).lineWidth(0.5).moveTo(140, sy + 12).lineTo(300, sy + 12).stroke();
doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('Date:', 320, sy);
doc.strokeColor(GRAY).lineWidth(0.5).moveTo(355, sy + 12).lineTo(500, sy + 12).stroke();

doc.moveDown(2);
doc.fontSize(8).fillColor(LIGHT_GRAY).font('Helvetica')
  .text('— End of Super Admin Test Guide —', { align: 'center' });

// ═══════════════════════════════════════════════════════════════
//  PAGE NUMBERS & HEADERS
// ═══════════════════════════════════════════════════════════════

const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  doc.fontSize(8).fillColor(LIGHT_GRAY).font('Helvetica')
    .text(`Page ${i + 1} of ${totalPages}`, 50, 780, { width: PAGE_WIDTH, align: 'center' });
  if (i > 0) {
    doc.fontSize(7).fillColor(LIGHT_GRAY).font('Helvetica')
      .text('ICAI CAGPT — Super Admin Test Guide', 50, 35, { width: 250 });
    doc.fontSize(7).fillColor(LIGHT_GRAY).font('Helvetica')
      .text('CONFIDENTIAL', 400, 35, { width: 145, align: 'right' });
  }
}

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`✅ PDF generated: ${OUTPUT_PATH}`);
  console.log(`   Pages: ${totalPages}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
});
