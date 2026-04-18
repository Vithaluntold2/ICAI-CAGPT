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

// 1. Benford's Law Agent — full digit distribution + chi-square goodness-of-fit.
export class BenfordLawAgent implements ForensicAgent {
  name = "Benford's Law Agent";

  // Benford expected frequencies for first digit 1..9
  private static readonly EXPECTED: Record<number, number> = {
    1: 0.301, 2: 0.176, 3: 0.125, 4: 0.097, 5: 0.079,
    6: 0.067, 7: 0.058, 8: 0.051, 9: 0.046,
  };

  // Chi-square critical values at 8 degrees of freedom
  // p=0.05 → 15.507, p=0.01 → 20.090
  private static readonly CHI2_CRIT_P05 = 15.507;
  private static readonly CHI2_CRIT_P01 = 20.090;

  async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
    const findings: ForensicFinding[] = [];
    const amounts: number[] = [];

    const items = context.extractedData.items || context.extractedData.LineItems || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const amt = getAmount(item);
        if (amt !== null && Math.abs(amt) > 10) amounts.push(Math.abs(amt));
      });
    }
    const total = getAmount(context.extractedData);
    if (total !== null && Math.abs(total) > 10) amounts.push(Math.abs(total));

    // Benford needs a reasonable sample size; below this, results are noise.
    if (amounts.length < 30) return findings;

    const digitCounts = new Array(10).fill(0);
    for (const n of amounts) {
      const d = parseInt(String(n)[0], 10);
      if (d >= 1 && d <= 9) digitCounts[d]++;
    }
    const N = amounts.length;

    // Observed frequencies and expected counts
    const observedFreq: Record<number, number> = {};
    const expectedCount: Record<number, number> = {};
    let chi2 = 0;
    for (let d = 1; d <= 9; d++) {
      observedFreq[d] = digitCounts[d] / N;
      expectedCount[d] = BenfordLawAgent.EXPECTED[d] * N;
      const diff = digitCounts[d] - expectedCount[d];
      chi2 += (diff * diff) / expectedCount[d];
    }
    chi2 = Number(chi2.toFixed(2));

    // Largest single-digit deviation (for human-readable narrative)
    let maxDigit = 1;
    let maxDev = 0;
    for (let d = 1; d <= 9; d++) {
      const dev = Math.abs(observedFreq[d] - BenfordLawAgent.EXPECTED[d]);
      if (dev > maxDev) { maxDev = dev; maxDigit = d; }
    }

    const distributionTable = Array.from({ length: 9 }, (_, i) => {
      const d = i + 1;
      return {
        digit: d,
        expectedPct: Number((BenfordLawAgent.EXPECTED[d] * 100).toFixed(1)),
        observedPct: Number((observedFreq[d] * 100).toFixed(1)),
        count: digitCounts[d],
      };
    });

    if (chi2 > BenfordLawAgent.CHI2_CRIT_P01) {
      findings.push({
        findingType: 'fraud_indicator',
        severity: 'high',
        title: "Benford's Law — Strong Deviation",
        description: `First-digit distribution deviates strongly from Benford's Law (χ²=${chi2}, df=8, critical@p=0.01 is ${BenfordLawAgent.CHI2_CRIT_P01}; N=${N}). Largest deviation on digit ${maxDigit} (observed ${(observedFreq[maxDigit] * 100).toFixed(1)}% vs expected ${(BenfordLawAgent.EXPECTED[maxDigit] * 100).toFixed(1)}%). This pattern is consistent with fabricated or heavily-manipulated figures. Corroborating evidence required before drawing conclusions.`,
        impactedMetrics: { chiSquare: chi2, sampleSize: N, maxDeviationDigit: maxDigit },
        evidenceDetails: { distribution: distributionTable },
        remediationJson: { action: 'targeted_substantive_testing', priority: 'high' },
      });
    } else if (chi2 > BenfordLawAgent.CHI2_CRIT_P05) {
      findings.push({
        findingType: 'fraud_indicator',
        severity: 'medium',
        title: "Benford's Law — Moderate Deviation",
        description: `First-digit distribution deviates from Benford's Law at the 5% significance level (χ²=${chi2}, df=8, critical ${BenfordLawAgent.CHI2_CRIT_P05}; N=${N}). Largest deviation on digit ${maxDigit}. This may reflect a genuine business pattern (rounded prices, caps, cohorts) or data manipulation — requires expanded sampling to disambiguate.`,
        impactedMetrics: { chiSquare: chi2, sampleSize: N, maxDeviationDigit: maxDigit },
        evidenceDetails: { distribution: distributionTable },
        remediationJson: { action: 'expanded_sampling', priority: 'medium' },
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
