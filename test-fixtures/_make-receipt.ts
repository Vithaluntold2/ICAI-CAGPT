/* One-shot fixture generator. Produces test-fixtures/sample-receipt.pdf */
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT = join(__dirname, 'sample-receipt.pdf');

interface LineItem {
  date: string;
  vendor: string;
  description: string;
  amount: number;
}

const ITEMS: LineItem[] = [
  { date: '2026-03-14', vendor: 'Acme Consulting',   description: 'Advisory retainer',         amount: 9500 },    // weekend (Sat) + just below 10k
  { date: '2026-03-14', vendor: 'Acme Consulting',   description: 'Advisory retainer (dup)',    amount: 9500 },    // duplicate
  { date: '2026-03-15', vendor: 'Cash Payee',        description: 'Misc reimbursement',          amount: 4900 },    // Sunday + generic vendor + just below 5k
  { date: '2026-03-16', vendor: 'Delta Logistics',   description: 'Freight',                     amount: 12000 },   // round 1000
  { date: '2026-03-21', vendor: 'Elite Services',    description: 'Consulting - Weekend',        amount: 9800 },    // Saturday
  { date: '2026-03-22', vendor: 'Forge Metals',      description: 'Raw materials - Sunday',       amount: 47500 },   // Sunday + just below 50k
  { date: '2026-03-23', vendor: 'Global Traders',    description: 'Bulk procurement',             amount: 50000 },   // round 50k
  { date: '2026-03-24', vendor: 'Horizon Tech',      description: 'IT services',                  amount: 9750 },
  { date: '2026-03-25', vendor: 'Iris Media',        description: 'Marketing',                    amount: 9950 },
  { date: '2026-03-26', vendor: 'Misc Services',     description: 'Miscellaneous expense',        amount: 4950 },
];

const total = ITEMS.reduce((s, i) => s + i.amount, 0);

const doc = new PDFDocument({ margin: 48, size: 'A4' });
doc.pipe(createWriteStream(OUT));

// Header
doc.fontSize(20).font('Helvetica-Bold').text('ACME HOLDINGS PVT LTD', { align: 'center' });
doc.fontSize(10).font('Helvetica').text('Official Expense Receipt', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(9).fillColor('#555');
doc.text('123 Fictional Road, Mumbai 400001 · GSTIN: 27AAACA0000A1ZZ', { align: 'center' });
doc.moveDown(1);

// Receipt metadata
doc.fillColor('#111').fontSize(10).font('Helvetica');
doc.text(`Receipt No: ACME-2026-00438`,    48, doc.y);
doc.text(`Issued: 2026-03-26`,             48, doc.y);
doc.text(`Period: 2026-03-14 to 2026-03-26`, 48, doc.y);
doc.moveDown(1);

// Table header
const startX = 48;
const tableTop = doc.y;
const colWidths = [70, 140, 160, 80];
const headers = ['Date', 'Vendor', 'Description', 'Amount (INR)'];
doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
let x = startX;
headers.forEach((h, i) => {
  doc.text(h, x, tableTop, { width: colWidths[i], align: i === 3 ? 'right' : 'left' });
  x += colWidths[i];
});
doc.moveTo(startX, tableTop + 14).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), tableTop + 14).stroke();

// Rows
doc.font('Helvetica').fontSize(9);
let y = tableTop + 20;
for (const item of ITEMS) {
  let colX = startX;
  doc.text(item.date, colX, y, { width: colWidths[0] });                                 colX += colWidths[0];
  doc.text(item.vendor, colX, y, { width: colWidths[1] });                               colX += colWidths[1];
  doc.text(item.description, colX, y, { width: colWidths[2] });                          colX += colWidths[2];
  doc.text(item.amount.toLocaleString('en-IN'), colX, y, { width: colWidths[3], align: 'right' });
  y += 18;
}

doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
y += 8;

doc.font('Helvetica-Bold').fontSize(11);
doc.text('Total', startX, y, { width: colWidths[0] + colWidths[1] + colWidths[2] });
doc.text(total.toLocaleString('en-IN'), startX + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3], align: 'right' });

// Footer
doc.moveDown(4);
doc.font('Helvetica').fontSize(8).fillColor('#666');
doc.text('This receipt is generated for testing purposes and does not represent a real transaction. Signatures and authorizations are omitted.', { align: 'center' });
doc.text('Authorised signatory: _________________________', { align: 'center' });

doc.end();
console.log(`✓ Wrote ${OUT}`);
