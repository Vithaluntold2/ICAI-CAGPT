import PDFDocument from 'pdfkit';
import { db } from '../../db';
import { forensicCases, forensicDocuments, forensicFindings } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

interface CaseSummary {
  id: string;
  title: string;
  overallRiskScore: number | null;
  totalFindings: number | null;
  criticalFindings: number | null;
  severityLevel: string | null;
  status: string | null;
  createdAt: Date;
}

interface DocSummary {
  id: string;
  filename: string;
  analysisStatus: string | null;
  rowCount?: number;
}

interface FindingRow {
  id: string;
  title: string | null;
  description: string | null;
  severity: string | null;
  findingType: string | null;
  evidenceDetails: any;
  documentId: string | null;
}

export class ForensicReportGenerator {
  static async generate(caseId: string, userId: string): Promise<Buffer | null> {
    const [forensicCase] = await db
      .select()
      .from(forensicCases)
      .where(eq(forensicCases.id, caseId))
      .limit(1);

    if (!forensicCase || forensicCase.userId !== userId) {
      return null;
    }

    const documents = await db
      .select()
      .from(forensicDocuments)
      .where(eq(forensicDocuments.caseId, caseId));

    const findings = await db
      .select()
      .from(forensicFindings)
      .where(eq(forensicFindings.caseId, caseId))
      .orderBy(desc(forensicFindings.severity), desc(forensicFindings.createdAt));

    const docSummaries: DocSummary[] = documents.map(d => {
      const extracted = (d.extractedData ?? {}) as any;
      return {
        id: d.id,
        filename: d.filename,
        analysisStatus: d.analysisStatus,
        rowCount: typeof extracted.rowCount === 'number' ? extracted.rowCount : undefined,
      };
    });

    const caseSummary: CaseSummary = {
      id: forensicCase.id,
      title: forensicCase.title,
      overallRiskScore: forensicCase.overallRiskScore ?? null,
      totalFindings: forensicCase.totalFindings ?? null,
      criticalFindings: forensicCase.criticalFindings ?? null,
      severityLevel: forensicCase.severityLevel ?? null,
      status: forensicCase.status ?? null,
      createdAt: forensicCase.createdAt,
    };

    return this.renderPdf({
      caseSummary,
      documents: docSummaries,
      findings: findings as unknown as FindingRow[],
    });
  }

  private static renderPdf(data: {
    caseSummary: CaseSummary;
    documents: DocSummary[];
    findings: FindingRow[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { caseSummary, documents, findings } = data;

      this.renderCoverPage(doc, caseSummary);
      doc.addPage();
      this.renderScope(doc, caseSummary, documents);
      doc.addPage();
      this.renderMethodology(doc);
      doc.addPage();
      this.renderFindings(doc, findings);
      doc.addPage();
      this.renderEvidence(doc, documents, findings);
      doc.addPage();
      this.renderExpertOpinion(doc, caseSummary, findings);

      doc.end();
    });
  }

  private static renderCoverPage(doc: PDFKit.PDFDocument, c: CaseSummary) {
    doc.fontSize(10).fillColor('#666').text('FORENSIC EXAMINATION REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#999').stroke();
    doc.moveDown(2);

    doc.fontSize(24).fillColor('#111').font('Helvetica-Bold').text(c.title || 'Untitled Case', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#333').font('Helvetica');
    doc.text(`Case ID: ${c.id}`, { align: 'center' });
    doc.text(`Report Date: ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    doc.moveDown(3);

    const severityColor = this.severityColor(c.severityLevel);
    doc.fontSize(14).fillColor('#333').text('Overall Risk Assessment', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(36).fillColor(severityColor).font('Helvetica-Bold')
      .text(`${c.overallRiskScore ?? 0} / 100`, { align: 'center' });
    doc.fontSize(14).fillColor(severityColor)
      .text((c.severityLevel || 'low').toUpperCase(), { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#333').font('Helvetica').fontSize(11);
    doc.text(`Total Findings: ${c.totalFindings ?? 0}`, { align: 'center' });
    doc.text(`Critical / High Priority: ${c.criticalFindings ?? 0}`, { align: 'center' });

    doc.moveDown(4);
    doc.fontSize(9).fillColor('#888').font('Helvetica-Oblique')
      .text('This report is prepared for internal investigative use. Findings represent risk indicators identified through data analytics and should be corroborated with supporting documentation before any conclusions are drawn.', 50, 720, { width: 495, align: 'center' });
  }

  private static renderScope(doc: PDFKit.PDFDocument, c: CaseSummary, documents: DocSummary[]) {
    this.sectionHeader(doc, '1. Scope of Examination');

    doc.fontSize(11).fillColor('#222').font('Helvetica');
    doc.text('This examination was conducted to identify potential financial irregularities, anomalous patterns, and indicators of fraud within the transaction records and supporting documents provided for this case.');
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Scope Boundaries:');
    doc.font('Helvetica');
    this.bullet(doc, 'Data analytics over structured transaction records (CSV / Excel).');
    this.bullet(doc, 'Document-level inspection of uploaded PDF / image evidence.');
    this.bullet(doc, 'Cross-document reconciliation where paired records are available.');
    this.bullet(doc, 'Statistical testing for distribution anomalies (Benford\'s Law, structuring).');

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Documents Examined:');
    doc.font('Helvetica');
    if (documents.length === 0) {
      doc.text('(No documents on file.)', { indent: 20 });
    } else {
      for (const d of documents) {
        const rc = d.rowCount !== undefined ? ` — ${d.rowCount} rows` : '';
        this.bullet(doc, `${d.filename}${rc} [status: ${d.analysisStatus || 'unknown'}]`);
      }
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Case Metadata:');
    doc.font('Helvetica');
    this.bullet(doc, `Case opened: ${new Date(c.createdAt).toISOString().split('T')[0]}`);
    this.bullet(doc, `Case status: ${c.status || 'open'}`);
  }

  private static renderMethodology(doc: PDFKit.PDFDocument) {
    this.sectionHeader(doc, '2. Methodology');

    doc.fontSize(11).fillColor('#222').font('Helvetica');
    doc.text('The investigation applied a combination of data analytics, statistical testing, and document review. Procedures were applied consistently to each document ingested into the case.');
    doc.moveDown();

    doc.font('Helvetica-Bold').text('2.1 Data Ingestion and Normalization');
    doc.font('Helvetica');
    doc.text('Structured spreadsheet inputs (CSV / XLSX) were parsed row-by-row. Heterogeneous column names (e.g. "Amount" vs "Txn Amount") were mapped onto a canonical schema (Amount, Date, Vendor) to allow uniform analysis.');
    doc.moveDown(0.7);

    doc.font('Helvetica-Bold').text('2.2 Pattern Detection');
    doc.font('Helvetica');
    this.bullet(doc, 'Round-number detection: amounts that are exact multiples of 1,000 or 100 (potential fabricated figures).');
    this.bullet(doc, 'Temporal anomaly detection: transactions dated on weekends or major holidays, flagged for business-justification review.');
    this.bullet(doc, 'Structuring detection: amounts falling within 5% below common approval thresholds (5k / 10k / 50k).');
    this.bullet(doc, 'Vendor-name validation: generic / high-risk descriptors associated with phantom-vendor schemes.');
    this.bullet(doc, 'Duplicate detection: near-identical amount + date + vendor across documents in the same case.');
    this.bullet(doc, 'Sequence analysis: duplicate invoice identifiers.');
    this.bullet(doc, 'Data completeness: missing core fields (vendor / date / amount).');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('2.3 Statistical Testing');
    doc.font('Helvetica');
    doc.text('Benford\'s Law first-digit analysis was applied to the amount population. The sample-level distribution was compared against the expected Benford distribution and a chi-square goodness-of-fit statistic was computed. Deviations are reported as risk indicators, not as conclusions of fraud.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('2.4 Document Review');
    doc.font('Helvetica');
    doc.text('Uploaded PDFs and images were analyzed via Azure Document Intelligence OCR and structured extraction. Extracted text, key-value pairs, and tables were retained as evidence.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('2.5 Cross-Document Reconciliation');
    doc.font('Helvetica');
    doc.text('When two or more tabular documents are present, records are matched by amount (within tolerance) and date (within a configurable window). Unmatched entries and amount differences are surfaced as discrepancies for follow-up.');
  }

  private static renderFindings(doc: PDFKit.PDFDocument, findings: FindingRow[]) {
    this.sectionHeader(doc, '3. Findings');

    if (findings.length === 0) {
      doc.fontSize(11).font('Helvetica').fillColor('#222')
        .text('No findings were produced by the analytic pipeline. This may indicate that the data is clean, insufficient, or that documents were not successfully parsed.');
      return;
    }

    const grouped = new Map<string, FindingRow[]>();
    for (const f of findings) {
      const sev = (f.severity || 'low').toLowerCase();
      if (!grouped.has(sev)) grouped.set(sev, []);
      grouped.get(sev)!.push(f);
    }

    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of order) {
      const list = grouped.get(sev);
      if (!list || list.length === 0) continue;

      doc.moveDown(0.5);
      doc.fontSize(13).fillColor(this.severityColor(sev)).font('Helvetica-Bold')
        .text(`${sev.toUpperCase()} — ${list.length} finding${list.length === 1 ? '' : 's'}`);
      doc.moveDown(0.3);

      for (const f of list) {
        doc.fontSize(11).fillColor('#111').font('Helvetica-Bold')
          .text(f.title || '(Untitled)', { continued: false });
        doc.fontSize(10).fillColor('#333').font('Helvetica')
          .text(f.description || '');
        if (f.findingType) {
          doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique')
            .text(`Type: ${f.findingType}`);
        }
        doc.moveDown(0.5);
      }
    }
  }

  private static renderEvidence(doc: PDFKit.PDFDocument, documents: DocSummary[], findings: FindingRow[]) {
    this.sectionHeader(doc, '4. Evidence Summary');

    doc.fontSize(11).fillColor('#222').font('Helvetica');
    doc.text('Each finding in this report is traceable to a specific source document. The table below cross-references findings to their underlying evidence.');
    doc.moveDown();

    const byDoc = new Map<string, FindingRow[]>();
    for (const f of findings) {
      const key = f.documentId || '(case-level)';
      if (!byDoc.has(key)) byDoc.set(key, []);
      byDoc.get(key)!.push(f);
    }

    for (const d of documents) {
      const docFindings = byDoc.get(d.id) || [];
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111').text(`Source: ${d.filename}`);
      doc.fontSize(9).fillColor('#666').font('Helvetica')
        .text(`Document ID: ${d.id}`);
      doc.fontSize(10).fillColor('#333')
        .text(`Findings referencing this document: ${docFindings.length}`);

      if (docFindings.length > 0) {
        for (const f of docFindings.slice(0, 8)) {
          const row = (f.evidenceDetails || {}).row;
          const rowIdx = (f.evidenceDetails || {}).rowIndex;
          const suffix = typeof rowIdx === 'number' ? ` (row ${rowIdx + 1})` : '';
          this.bullet(doc, `[${(f.severity || 'low').toUpperCase()}] ${f.title}${suffix}`);
          if (row && typeof row === 'object') {
            const preview = Object.entries(row).slice(0, 4)
              .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join(', ');
            doc.fontSize(8).fillColor('#777').font('Helvetica-Oblique')
              .text(`   ${preview}`, { indent: 30 });
            doc.fontSize(10).fillColor('#333').font('Helvetica');
          }
        }
        if (docFindings.length > 8) {
          doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique')
            .text(`  (… and ${docFindings.length - 8} more)`, { indent: 20 });
        }
      }
      doc.moveDown(0.8);
    }

    const caseLevel = byDoc.get('(case-level)') || [];
    if (caseLevel.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111').text('Case-Level Findings');
      for (const f of caseLevel.slice(0, 10)) {
        this.bullet(doc, `[${(f.severity || 'low').toUpperCase()}] ${f.title}`);
      }
    }
  }

  private static renderExpertOpinion(doc: PDFKit.PDFDocument, c: CaseSummary, findings: FindingRow[]) {
    this.sectionHeader(doc, '5. Expert Opinion');

    doc.fontSize(11).fillColor('#222').font('Helvetica');

    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const medium = findings.filter(f => f.severity === 'medium').length;
    const score = c.overallRiskScore ?? 0;

    let tone: string;
    let recommendation: string;
    if (score >= 75 || critical > 0) {
      tone = 'The indicators identified in this case warrant immediate investigative follow-up.';
      recommendation = 'Recommend suspension of related disbursements pending detailed review, interview of relevant personnel, and full reconciliation of impacted accounts.';
    } else if (score >= 50 || high >= 3) {
      tone = 'A meaningful cluster of risk indicators was identified.';
      recommendation = 'Recommend targeted substantive testing on the flagged transactions, vendor master review, and an authorisation-trail walkthrough.';
    } else if (score >= 25 || medium > 0) {
      tone = 'Low-to-moderate risk indicators were identified.';
      recommendation = 'Recommend inclusion of the flagged items in routine exception review and periodic reassessment.';
    } else {
      tone = 'No material risk indicators were identified within the examined dataset.';
      recommendation = 'Recommend standard monitoring and periodic re-testing as transaction volume grows.';
    }

    doc.text(tone);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Professional Recommendation:');
    doc.font('Helvetica').text(recommendation);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Caveats and Limitations:');
    doc.font('Helvetica');
    this.bullet(doc, 'The findings in this report are risk indicators produced by automated analytics. They do not of themselves constitute evidence of fraud.');
    this.bullet(doc, 'Conclusions should only be drawn after corroborating evidence is obtained — invoices, approvals, supporting ledgers, or personnel interviews.');
    this.bullet(doc, 'Document extraction is subject to the accuracy of OCR and upstream data quality.');
    this.bullet(doc, 'Statistical tests assume a sufficient sample size; results on small datasets should be interpreted cautiously.');

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique')
      .text(`Report generated on ${new Date().toISOString()} by the forensic intelligence pipeline. This is a system-generated report and does not constitute a signed professional opinion.`);
  }

  private static sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#111').text(title);
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#999').stroke();
    doc.moveDown(1);
  }

  private static bullet(doc: PDFKit.PDFDocument, text: string) {
    doc.fontSize(10).font('Helvetica').fillColor('#333')
      .text(`• ${text}`, { indent: 20 });
  }

  private static severityColor(sev?: string | null): string {
    switch ((sev || '').toLowerCase()) {
      case 'critical': return '#b91c1c';
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#2563eb';
      default: return '#555';
    }
  }
}
