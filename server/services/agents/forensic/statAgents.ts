import { ForensicAgent, ForensicContext, ForensicFinding } from "./types";
import { db } from "../../../db";
import { forensicDocuments } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";

// Helper to reliably get numeric amount
const getAmount = (data: any): number | null => {
  const val = data.totalAmount || data.Amount || data.Total || data.amount;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ""));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Helper to reliably get date
const getDate = (data: any): Date | null => {
  const val = data.transactionDate || data.Date || data.InvoiceDate || data.date;
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Helper to get vendor
const getVendor = (data: any): string | null => {
  return data.vendor || data.VendorName || data.Vendor || null;
};

// 1. Benford's Law Agent
export class BenfordLawAgent implements ForensicAgent {
  name = "Benford's Law Agent";

  async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
    const findings: ForensicFinding[] = [];
    const amounts: number[] = [];

    // Collect amounts from line items if available
    const items = context.extractedData.items || context.extractedData.LineItems || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const amt = getAmount(item);
        if (amt && Math.abs(amt) > 10) amounts.push(amt); // Ignore very small numbers
      });
    }
    
    // Also include total
    const total = getAmount(context.extractedData);
    if (total && Math.abs(total) > 10) amounts.push(total);

    // Benford's Law requires a decent sample size.
    // < 15 points is statistically noisy/useless.
    if (amounts.length < 15) return findings;

    const firstDigits = amounts.map(n => parseInt(Math.abs(n).toString()[0]));
    const digitCounts = new Array(10).fill(0);
    firstDigits.forEach(d => digitCounts[d]++);

    // Check digit 1. Benford says ~30.1%
    const totalCount = firstDigits.length;
    const freq1 = digitCounts[1] / totalCount;

    // Tolerance range: 15% - 45% (Wide tolerance for small samples)
    if (freq1 < 0.15 || freq1 > 0.45) {
        findings.push({
            findingType: 'fraud_indicator',
            severity: 'low',
            title: "Benford's Law Deviation",
            description: `The distribution of first digits in amounts deviates from Benford's Law (Digit 1 frequency: ${(freq1 * 100).toFixed(1)}%, expected ~30%). Sample size: ${totalCount}.`,
            impactedMetrics: { digit1Frequency: freq1, sampleSize: totalCount },
            remediationJson: { action: "expanded_sampling", priority: "low" }
        });
    }

    return findings;
  }
}

// 2. Round Number Agent
export class RoundNumberAgent implements ForensicAgent {
    name = "Round Number Analysis Agent";
  
    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
      const findings: ForensicFinding[] = [];
      const total = getAmount(context.extractedData);
  
      if (total && total > 1000) {
          if (total % 1000 === 0) {
               findings.push({
                  findingType: 'anomaly',
                  severity: 'medium',
                  title: 'Suspicious Round Number',
                  description: `Transaction amount of ${total.toLocaleString()} is a perfect multiple of 1,000. Round numbers in large transactions can be a red flag.`,
                  impactedMetrics: { totalAmount: total },
                  evidenceDetails: { value: total },
                  remediationJson: { action: 'verify_supporting_documentation', priority: 'medium' }
              });
          } else if (total % 100 === 0) {
               findings.push({
                  findingType: 'anomaly',
                  severity: 'low',
                  title: 'Round Number',
                  description: `Transaction amount of ${total.toLocaleString()} is a perfect multiple of 100.`,
                  impactedMetrics: { totalAmount: total },
                  remediationJson: { action: 'review_approval', priority: 'low' }
              });
          }
      }
      return findings;
    }
  }

// 3. Weekend/Holiday Agent
export class WeekendHolidayAgent implements ForensicAgent {
    name = "Time Anomaly Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const date = getDate(context.extractedData);

        if (date) {
            const day = date.getDay();
            if (day === 0 || day === 6) {
                findings.push({
                    findingType: 'pattern_violation',
                    severity: 'low',
                    title: 'Weekend Transaction',
                    description: `Transaction date ${date.toDateString()} falls on a weekend (${day === 0 ? 'Sunday' : 'Saturday'}).`,
                    impactedMetrics: { date: date.toISOString() },
                    remediationJson: { action: 'verify_business_justification', priority: 'low' }
                });
            }
            
            // Simple check for Dec 25 or Jan 1
            const m = date.getMonth();
            const d = date.getDate();
            if ((m === 11 && d === 25) || (m === 0 && d === 1)) {
                 findings.push({
                    findingType: 'pattern_violation',
                    severity: 'medium',
                    title: 'Holiday Transaction',
                    description: `Transaction date ${date.toDateString()} falls on a major holiday.`,
                    impactedMetrics: { date: date.toISOString() },
                    remediationJson: { action: 'verify_business_necessity', priority: 'medium' }
                });
            }
        }
        return findings;
    }
}

// 4. Duplicate Transaction Agent
export class DuplicateTransactionAgent implements ForensicAgent {
    name = "Duplicate Detection Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const total = getAmount(context.extractedData);
        const date = getDate(context.extractedData);
        const vendor = getVendor(context.extractedData);
        const caseId = context.document.caseId;
        const currentDocId = context.document.id;

        if (total && date && caseId) {
             // Look for other documents in the same case with similar amount/date
             const peers = await db.select()
                .from(forensicDocuments)
                .where(and(
                    eq(forensicDocuments.caseId, caseId),
                    ne(forensicDocuments.id, currentDocId)
                ));
             
             for (const peer of peers) {
                 const peerData = peer.extractedData as any;
                 const peerTotal = getAmount(peerData);
                 const peerDate = getDate(peerData);
                 const peerVendor = getVendor(peerData);
                 
                 // Check amount match
                 if (peerTotal === total) {
                      // Check date match (within 24 hours)
                      if (peerDate && Math.abs(peerDate.getTime() - date.getTime()) < 24 * 60 * 60 * 1000) {
                           // Stronger check: Requires vendor match if vendor is available on both
                           if (vendor && peerVendor) {
                               const v1 = vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
                               const v2 = peerVendor.toLowerCase().replace(/[^a-z0-9]/g, '');
                               if (v1 !== v2) continue; // Different vendors, likely coincidence
                           }

                           findings.push({
                               findingType: 'anomaly',
                               severity: 'high',
                               title: 'Potential Duplicate Invoice',
                               description: `Found another document (${peer.id}) with identical amount (${total}), same date, and matching/similar details.`,
                               evidenceDetails: { duplicateDocumentId: peer.id, otherVendor: peerVendor },
                               remediationJson: { action: 'compare_invoices', priority: 'high' }
                           });
                           break; // Report once
                      }
                 }
             }
        }

        return findings;
    }
}

// 5. Sequence Analysis Agent (Checks for gaps/duplicates in Invoice ID if possible)
export class SequenceAnalysisAgent implements ForensicAgent {
    name = "Sequence Analysis Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const invoiceId = context.extractedData.invoiceId || context.extractedData.InvoiceId || context.extractedData.InvoiceNumber;

        if (invoiceId && typeof invoiceId === 'string') {
             // Look for duplicate invoice IDs in the case
             const caseId = context.document.caseId;
             const currentDocId = context.document.id;
             
             const peers = await db.select()
                .from(forensicDocuments)
                .where(and(
                    eq(forensicDocuments.caseId, caseId),
                    ne(forensicDocuments.id, currentDocId)
                ));

             const duplicate = peers.find(p => {
                 const d = p.extractedData as any;
                 const pid = d.invoiceId || d.InvoiceId || d.InvoiceNumber;
                 return pid === invoiceId;
             });

             if (duplicate) {
                  findings.push({
                    findingType: 'fraud_indicator',
                    severity: 'high',
                    title: 'Duplicate Invoice ID',
                    description: `Invoice ID ${invoiceId} is already used in document ${duplicate.id}.`,
                    remediationJson: { action: 'reject_submission', priority: 'high' }
                  });
             }
        }
        return findings;
    }
}

// 6. Threshold Split Agent (Structuring)
export class ThresholdSplitAgent implements ForensicAgent {
    name = "Structuring Detection Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const total = getAmount(context.extractedData);

        // Common approval limits: 5k, 10k, 50k
        const thresholds = [5000, 10000, 50000];

        if (total) {
            for (const limit of thresholds) {
                // If amount is just below limit (90% to 99.9%)
                if (total < limit && total > limit * 0.95) {
                    findings.push({
                        findingType: 'fraud_indicator',
                        severity: 'medium',
                        title: 'Potential Structuring (Just Below Limit)',
                        description: `Amount ${total} is just below the ${limit} threshold. This might indicate an attempt to bypass approval limits.`,
                        impactedMetrics: { threshold: limit, deviation: limit - total },
                        remediationJson: { action: 'manager_review', priority: 'medium' }
                    });
                }
            }
        }
        return findings;
    }
}

// 7. Data Completeness Agent
export class DataCompletenessAgent implements ForensicAgent {
    name = "Data Completeness Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const required = ['vendor', 'date', 'totalAmount']; // Minimal set
        const missing: string[] = [];

        if (!getAmount(context.extractedData)) missing.push('Total Amount');
        if (!getDate(context.extractedData)) missing.push('Date');
        if (!getVendor(context.extractedData)) missing.push('Vendor');

        if (missing.length > 0) {
            findings.push({
                findingType: 'missing_data',
                severity: 'high',
                title: 'Incomplete Document Data',
                description: `Critical fields missing: ${missing.join(', ')}.`,
                evidenceDetails: { missingFields: missing },
                remediationJson: { action: 'request_resubmission', priority: 'high' }
            });
        }
        return findings;
    }
}

// 8. Vendor Validation Agent (Risky keywords)
export class VendorValidationAgent implements ForensicAgent {
    name = "Vendor Validation Agent";

    async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
        const findings: ForensicFinding[] = [];
        const vendor = getVendor(context.extractedData);

        if (vendor) {
            const vLower = vendor.toLowerCase();
            const riskyKeywords = ['cash', 'consulting', 'services', 'misc', 'miscellaneous', 'employee'];
            
            // Check if vendor name is generic or risky
            if (riskyKeywords.some(k => vLower.includes(k) && vLower.length < 15)) {
                 findings.push({
                    findingType: 'anomaly',
                    severity: 'low',
                    title: 'Generic High-Risk Vendor Name',
                    description: `Vendor "${vendor}" contains generic terms often used in phantom vendor schemes.`,
                    evidenceDetails: { vendorName: vendor },
                    remediationJson: { action: 'validate_vendor_master', priority: 'medium' }
                });
            }
            // Check if vendor name is same as an employee? (Hard without employee list, but we can flag if it says "Employee")
        }
        return findings;
    }
}
