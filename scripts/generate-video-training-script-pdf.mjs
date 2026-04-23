import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outputPath = path.resolve('docs/ICAI_CAGPT_Educational_Video_Script.pdf');

const modules = [
  {
    title: 'Module 1: Login, Workspace, and Navigation',
    goal: 'Help viewers start correctly and understand the layout before using advanced modes.',
    presenterScript: [
      'Hi everyone, in this training we will learn ICAI CAGPT step by step using practical examples.',
      'I am sharing only one screen, and after each module I will run a short test so you can verify your result.',
      'First, log in and open the main chat workspace. Notice the mode selector, input area, history, and output panel.'
    ],
    onScreenSteps: [
      'Open app URL and log in.',
      'Point to chat mode selector and explain that each mode solves a different problem.',
      'Show chat history panel and where previous sessions are reopened.',
      'Show attachment/upload button and export/download actions.'
    ],
    demoPrompt: 'I am briefing a client CFO in 3 minutes: explain AS 10 vs Ind AS 16 differences with one practical impact example per point.',
    expected: 'A concise response appears in default chat, proving the workspace and model pipeline are working.',
    testChecklist: [
      'Can create a new chat.',
      'Can switch modes.',
      'Can submit a prompt and receive streamed output.',
      'Can reopen conversation from history.'
    ]
  },
  {
    title: 'Module 2: Deep Research Mode',
    goal: 'Show long-form, source-aware, structured research output.',
    presenterScript: [
      'Now we switch to Deep Research mode for detailed investigation tasks.',
      'This mode is best when you need complete analysis, assumptions, and structured reasoning.'
    ],
    onScreenSteps: [
      'Select Deep Research mode.',
      'Enter prompt with scope and format requirement.',
      'Show the final response structure and depth.'
    ],
    demoPrompt: 'A restaurant chain sells buffet + gaming credits + welcome drink in one package. Prepare a structured GST brief deciding mixed vs composite supply, with recommended billing language and risk notes.',
    expected: 'Well-organized sections: definitions, legal logic, examples, and compliance implications.',
    testChecklist: [
      'Response contains section headers.',
      'Includes practical examples.',
      'Includes caveats/assumptions and not only generic text.'
    ]
  },
  {
    title: 'Module 3: Financial Calculation Mode (Excel-First)',
    goal: 'Demonstrate that calculations are delivered as Excel formulas and model-ready structure.',
    presenterScript: [
      'For financial calculations, this platform is Excel-first. We use formulas and references, not manual arithmetic narration.',
      'In videos, always verify the output includes formula-based steps.'
    ],
    onScreenSteps: [
      'Select Financial Calculation mode.',
      'Ask for NPV and IRR setup using cell references.',
      'Show formula table and explain where to paste in Excel.'
    ],
    demoPrompt: 'Prepare an investment committee-ready NPV and IRR Excel setup for a plant automation project: discount rate in B1, capex in B2, yearly cash inflows C3:C7, and include sensitivity formula slots for +/- 2% discount rate.',
    expected: 'Output includes formulas like =NPV(B1,C3:C7)+B2 and =IRR(B2:C7) with clear cell mapping.',
    testChecklist: [
      'Output is formula-based.',
      'Cell references are clear.',
      'No freehand final number is blindly asserted without model context.'
    ]
  },
  {
    title: 'Module 4: Workflow Visualization Mode',
    goal: 'Show process-to-diagram conversion for business and compliance flows.',
    presenterScript: [
      'Workflow mode converts logic into visual process steps useful for training, audits, and SOPs.',
      'We can use this to explain end-to-end controls quickly to teams.'
    ],
    onScreenSteps: [
      'Switch to Workflow Visualization mode.',
      'Ask for process with decision points.',
      'Open generated visualization and explain each node.'
    ],
    demoPrompt: 'Design a workflow for urgent vendor onboarding where payment must be released in 24 hours but KYC is incomplete; include controls, exception approvals, and post-facto remediation path.',
    expected: 'A stepwise visual flow with decisions and alternate paths appears.',
    testChecklist: [
      'Start and end nodes are visible.',
      'At least one decision branch is present.',
      'Narrative and visual are consistent.'
    ]
  },
  {
    title: 'Module 5: Audit Planning Mode',
    goal: 'Demonstrate risk-based audit plan generation from a scenario.',
    presenterScript: [
      'Now we move to Audit Planning mode, ideal for engagement planning and risk prioritization.',
      'The output should guide scope, controls, and testing strategy.'
    ],
    onScreenSteps: [
      'Select Audit Planning mode.',
      'Provide client profile and risk context.',
      'Review suggested audit areas, controls, and test procedures.'
    ],
    demoPrompt: 'Generate a risk-based statutory audit plan for a manufacturing client where inventory grew 38% YoY and receivable days moved from 62 to 109; provide high-risk assertions, test procedures, and team allocation for a 2-week field window.',
    expected: 'Output includes risk register, controls to test, sample audit procedures, and timeline guidance.',
    testChecklist: [
      'Risks are prioritized.',
      'Procedures map to risks.',
      'Output is practical for team allocation.'
    ]
  },
  {
    title: 'Module 6: Scenario Simulator Mode',
    goal: 'Show decision-making across multiple future cases.',
    presenterScript: [
      'Scenario Simulator helps compare alternatives before final advisory decisions.',
      'This is useful for tax planning, financing options, and compliance strategy.'
    ],
    onScreenSteps: [
      'Switch to Scenario Simulator mode.',
      'Enter base case and two alternative assumptions.',
      'Show side-by-side scenario impact summary.'
    ],
    demoPrompt: 'Simulate three policy choices for a CFO meeting: continue current depreciation policy, accelerate depreciation for tax efficiency, and straight-line smoothing for investor reporting; compare 3-year P&L, tax outgo direction, and cash impact narrative.',
    expected: 'Clear comparison across scenarios with assumptions and likely impact direction.',
    testChecklist: [
      'At least 3 scenarios returned.',
      'Each scenario has assumptions.',
      'Comparison summary is explicit.'
    ]
  },
  {
    title: 'Module 7: Deliverable Composer Mode',
    goal: 'Demonstrate conversion from analysis to client-ready deliverables.',
    presenterScript: [
      'Deliverable Composer turns analysis into professional outputs like memo, report, or presentation content.',
      'In practice, teams use this to reduce drafting time and keep quality consistent.'
    ],
    onScreenSteps: [
      'Select Deliverable Composer mode.',
      'Specify deliverable type, tone, and target audience.',
      'Show generated structure and polish level.'
    ],
    demoPrompt: 'Draft a board-ready advisory memo after IFC walkthrough revealed maker-checker bypass in payments, weak user access controls, and delayed bank reconciliations; include 30-60-90 day remediation plan with owners.',
    expected: 'Structured deliverable with executive summary, recommendations, timeline, and owner/action mapping.',
    testChecklist: [
      'Professional format and tone.',
      'Action items are implementation-ready.',
      'Output can be directly edited into final client document.'
    ]
  },
  {
    title: 'Module 8: Attachments, Evidence, and Exports',
    goal: 'Demonstrate practical usage with files and output sharing.',
    presenterScript: [
      'In live engagements, users rarely work with plain text only. This module shows file context and exports.',
      'We also verify the output can be shared with team or client.'
    ],
    onScreenSteps: [
      'Upload a sample PDF/Excel document.',
      'Ask a question that requires file context.',
      'Export results as needed (document or spreadsheet where applicable).'
    ],
    demoPrompt: 'From this uploaded internal control note and management response sheet, extract top 5 control gaps, map each to evidence in the file, and propose remediation priority by business impact.',
    expected: 'Response references uploaded context and provides structured actionable output.',
    testChecklist: [
      'File accepted and processed.',
      'Answer reflects file context.',
      'Export/download action is successful.'
    ]
  }
];

const introLines = [
  'ICAI CAGPT Educational Video Script',
  'Audience: New and intermediate users',
  'Presenter format: Single on-screen presenter (female host) sharing live product screen',
  'Style: Explain > demonstrate > run a quick test > summarize outcome for each module',
  'Recording target: 35-45 minutes total',
  '',
  'Video production rule for every module:',
  '1) State module goal in one line',
  '2) Run the exact demo prompt',
  '3) Validate using the test checklist',
  '4) Tell viewers where this module is used in real practice',
  '',
  'Important presenter note:',
  'Keep narration simple and practical. Avoid technical jargon unless demonstrating a mode-specific concept.',
  ''
];

const edgeInstructions = [
  'To clearly demonstrate ICAI CAGPT edge over generic chat tools, run a side-by-side benchmark in every module.',
  'Use the same prompt in ICAI CAGPT and ChatGPT, then compare outcomes using the scoring rubric below.',
  'Record measurable evidence: total completion time, number of manual edits needed, and readiness for client use.',
  'For calculation tasks, verify formula-first outputs and cell mappings instead of narrative arithmetic.',
  'For advisory tasks, verify implementation-ready action items, not just explanatory text.',
];

const scoringRubric = [
  'Domain accuracy (0-5): Is the response aligned with CA practice context?',
  'Structure quality (0-5): Is output clearly formatted for professional use?',
  'Actionability (0-5): Can a practitioner execute next steps directly?',
  'Compliance readiness (0-5): Are controls, assumptions, and caveats visible?',
  'Deliverable readiness (0-5): Is output ready for client/internal sharing with minimal edits?',
];

const closingLines = [
  'Final Wrap-Up Script',
  'Today we covered all major ICAI CAGPT modules with practical examples and quick validation tests.',
  'If you are new, start with Deep Research and Financial Calculation, then move to Audit, Scenario, and Deliverable workflows.',
  'For advanced users, combine Audit Planning, Scenario Simulator, and Deliverable Composer for complex advisory cases.',
  'Thank you for watching. In the next video, we will do a full end-to-end client case from query to final deliverable.'
];

function drawTitle(doc, text) {
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0c3b5a').text(text, { align: 'left' });
  doc.moveDown(0.4);
}

function drawSubTitle(doc, text) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#123d5f').text(text);
  doc.moveDown(0.25);
}

function drawParagraph(doc, text) {
  doc.font('Helvetica').fontSize(10.5).fillColor('#1b2733').text(text, {
    width: 500,
    lineGap: 2,
  });
}

function drawBullets(doc, items) {
  items.forEach((item) => {
    doc.font('Helvetica').fontSize(10.5).fillColor('#1b2733').text(`• ${item}`, {
      width: 500,
      indent: 10,
      lineGap: 2,
    });
  });
}

function ensureSpace(doc, minSpace = 120) {
  if (doc.y > doc.page.height - minSpace) {
    doc.addPage();
  }
}

function buildPdf() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 50, right: 45 },
    info: {
      Title: 'ICAI CAGPT Educational Video Script',
      Author: 'ICAI CAGPT Team',
      Subject: 'Platform training script for educational videos',
    },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  drawTitle(doc, 'ICAI CAGPT Educational Video Script');
  introLines.forEach((line) => {
    if (line === '') {
      doc.moveDown(0.3);
    } else {
      drawParagraph(doc, line);
    }
  });

  doc.moveDown(0.3);
  drawSubTitle(doc, 'Edge Demonstration Instructions (Mandatory)');
  drawBullets(doc, edgeInstructions);
  doc.moveDown(0.2);
  drawSubTitle(doc, 'Scoring Rubric For Comparison');
  drawBullets(doc, scoringRubric);

  doc.moveDown(0.5);

  modules.forEach((module) => {
    ensureSpace(doc, 170);
    doc.roundedRect(48, doc.y - 4, 505, 20, 4).fill('#eaf3fb');
    doc.fillColor('#123d5f').font('Helvetica-Bold').fontSize(12).text(module.title, 55, doc.y - 0.5);
    doc.moveDown(1.0);

    drawSubTitle(doc, 'Goal');
    drawParagraph(doc, module.goal);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'Presenter Script (read on video)');
    drawBullets(doc, module.presenterScript);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'On-Screen Actions');
    drawBullets(doc, module.onScreenSteps);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'Demo Prompt');
    drawParagraph(doc, module.demoPrompt);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'Expected Result');
    drawParagraph(doc, module.expected);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'Module Test Checklist');
    drawBullets(doc, module.testChecklist);
    doc.moveDown(0.35);

    drawSubTitle(doc, 'Comparison Instructions (ICAI CAGPT vs ChatGPT)');
    drawBullets(doc, [
      `Run the same demo prompt in both tools: "${module.demoPrompt}"`,
      'Show both outputs on screen and score each using the rubric (0-5 per criterion).',
      'State a one-line verdict for this module: where ICAI CAGPT provided practical advantage.',
      'Capture measurable proof: time taken, manual edits required, and production readiness.',
    ]);
    doc.moveDown(0.8);
  });

  ensureSpace(doc, 120);
  drawSubTitle(doc, 'Closing Script');
  drawBullets(doc, closingLines);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

buildPdf()
  .then(() => {
    process.stdout.write(`PDF generated: ${outputPath}\n`);
  })
  .catch((error) => {
    process.stderr.write(`Failed to generate PDF: ${error.message}\n`);
    process.exitCode = 1;
  });
