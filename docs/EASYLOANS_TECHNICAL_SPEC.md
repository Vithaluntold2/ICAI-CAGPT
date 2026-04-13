# EasyLoans Module - Technical Implementation Specification

## Version 1.0 | January 7, 2026

---

## 1. Module Overview

**EasyLoans** is a comprehensive loan comparison and eligibility assessment platform within ICAI CAGPT that:
- Serves both **Personal** and **Corporate/Business** loan seekers
- Enables **Super Admin (DSA)** to manage lender partnerships
- Uses **AI-powered matching** against bank/NBFC eligibility criteria
- Provides **real-time rate comparisons** and eligibility scores

---

## 2. Supported Loan Types

### Personal Loans
| Loan Type | Target Users | Typical Amount | Tenure |
|-----------|--------------|----------------|--------|
| Personal Loan | Salaried/Self-employed | ₹50K - ₹40L | 1-5 years |
| Home Loan | Individuals | ₹10L - ₹10Cr | 10-30 years |
| Loan Against Property (LAP) | Property owners | ₹5L - ₹5Cr | 5-15 years |
| Vehicle Loan | Car/Bike buyers | ₹1L - ₹1Cr | 1-7 years |
| Education Loan | Students/Parents | ₹1L - ₹75L | 5-15 years |
| Gold Loan | Gold owners | ₹10K - ₹50L | 3-24 months |
| Credit Card | All | N/A | Revolving |

### Corporate/Business Loans
| Loan Type | Target Users | Typical Amount | Tenure |
|-----------|--------------|----------------|--------|
| Business Loan (Unsecured) | SMEs | ₹1L - ₹2Cr | 1-5 years |
| Business Loan (Secured) | SMEs/Corporates | ₹10L - ₹50Cr | 3-10 years |
| Working Capital Loan | All businesses | ₹5L - ₹25Cr | 1-3 years |
| Term Loan | Manufacturing/Infra | ₹25L - ₹500Cr | 5-20 years |
| Equipment Finance | All industries | ₹5L - ₹50Cr | 3-7 years |
| Invoice Discounting | B2B businesses | Variable | 30-180 days |
| Overdraft Facility | All businesses | ₹1L - ₹10Cr | 1 year (renewable) |
| MSME Loans | Micro/Small enterprises | ₹10K - ₹2Cr | 1-7 years |

---

## 3. Database Schema (Complete)

### 3.1 Core Lender Tables

```sql
-- =============================================
-- LENDER MASTER DATA
-- =============================================

-- Main lenders table
CREATE TABLE easy_loans_lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(50),
  type VARCHAR(50) NOT NULL CHECK (type IN ('bank', 'nbfc', 'hfc', 'fintech', 'cooperative')),
  category VARCHAR(50), -- 'public_sector', 'private', 'foreign', 'small_finance'
  
  -- Branding
  logo_url VARCHAR(500),
  primary_color VARCHAR(7), -- Hex color for UI
  
  -- Contact
  website VARCHAR(500),
  customer_care_number VARCHAR(50),
  customer_care_email VARCHAR(255),
  
  -- Regulatory
  rbi_license_number VARCHAR(100),
  incorporation_date DATE,
  
  -- DSA Partnership Details
  dsa_agreement_date DATE,
  dsa_commission_default DECIMAL(5,2), -- Default commission %
  dsa_contact_name VARCHAR(255),
  dsa_contact_phone VARCHAR(50),
  dsa_contact_email VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  priority_rank INTEGER DEFAULT 100, -- Lower = higher priority in results
  
  -- Metadata
  serviced_countries JSONB DEFAULT '["India"]',
  headquarters_city VARCHAR(100),
  total_branches INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Indexes for lenders
CREATE INDEX idx_lenders_type ON easy_loans_lenders(type);
CREATE INDEX idx_lenders_active ON easy_loans_lenders(is_active);
CREATE INDEX idx_lenders_priority ON easy_loans_lenders(priority_rank);


-- =============================================
-- LOAN PRODUCTS
-- =============================================

CREATE TABLE easy_loans_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES easy_loans_lenders(id) ON DELETE CASCADE,
  
  -- Product Identity
  product_code VARCHAR(50), -- Bank's internal code
  product_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255), -- Marketing name
  
  -- Classification
  loan_category VARCHAR(50) NOT NULL CHECK (loan_category IN ('personal', 'business')),
  loan_type VARCHAR(100) NOT NULL, -- 'personal_loan', 'home_loan', 'business_loan', etc.
  
  -- Amount Limits
  min_loan_amount DECIMAL(15,2) NOT NULL,
  max_loan_amount DECIMAL(15,2) NOT NULL,
  
  -- Interest Rates
  interest_rate_type VARCHAR(20) CHECK (interest_rate_type IN ('fixed', 'floating', 'reducing')),
  base_rate_name VARCHAR(50), -- 'MCLR', 'RLLR', 'EBLR', 'PLR'
  interest_rate_min DECIMAL(6,3), -- e.g., 8.500
  interest_rate_max DECIMAL(6,3), -- e.g., 16.000
  spread_over_base DECIMAL(6,3), -- For floating rates
  
  -- Tenure
  min_tenure_months INTEGER NOT NULL,
  max_tenure_months INTEGER NOT NULL,
  
  -- Fees & Charges
  processing_fee_type VARCHAR(20) CHECK (processing_fee_type IN ('percentage', 'flat', 'range')),
  processing_fee_percent DECIMAL(5,2),
  processing_fee_min DECIMAL(10,2),
  processing_fee_max DECIMAL(10,2),
  
  prepayment_charges_percent DECIMAL(5,2), -- 0 if no prepayment penalty
  foreclosure_charges_percent DECIMAL(5,2),
  late_payment_charges JSONB, -- {type: 'percent'/'flat', value: X}
  
  -- Operational
  avg_disbursement_days INTEGER,
  max_processing_days INTEGER,
  digital_process BOOLEAN DEFAULT false, -- Fully online?
  doorstep_service BOOLEAN DEFAULT false,
  
  -- Features
  features JSONB, -- ['Balance transfer', 'Top-up available', 'Flexi EMI']
  
  -- Documents Required (template)
  required_documents JSONB,
  /*
  Example:
  {
    "salaried": ["ID Proof", "Address Proof", "3 months salary slips", "6 months bank statement", "Form 16"],
    "self_employed": ["ID Proof", "Address Proof", "ITR 2 years", "GST Returns", "Business registration"],
    "business": ["Company PAN", "Director KYC", "3 years audited financials", "GST Returns"]
  }
  */
  
  -- Collateral (for secured loans)
  requires_collateral BOOLEAN DEFAULT false,
  accepted_collateral_types JSONB, -- ['property', 'fd', 'shares', 'gold']
  ltv_max DECIMAL(5,2), -- Loan-to-value ratio max (e.g., 80%)
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Rate validity
  rate_effective_from DATE,
  rate_valid_until DATE,
  last_rate_update TIMESTAMPTZ,
  
  -- Metadata
  terms_url VARCHAR(500),
  brochure_url VARCHAR(500),
  apply_url VARCHAR(500), -- Direct application link
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_lender ON easy_loans_products(lender_id);
CREATE INDEX idx_products_category ON easy_loans_products(loan_category);
CREATE INDEX idx_products_type ON easy_loans_products(loan_type);
CREATE INDEX idx_products_active ON easy_loans_products(is_active);


-- =============================================
-- ELIGIBILITY CRITERIA
-- =============================================

CREATE TABLE easy_loans_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES easy_loans_products(id) ON DELETE CASCADE,
  
  -- Applicant Type
  applicant_type VARCHAR(50) NOT NULL, -- 'salaried', 'self_employed_professional', 'self_employed_business', 'company'
  
  -- Age Criteria
  min_age INTEGER,
  max_age_at_maturity INTEGER, -- Age at loan end
  
  -- Income Criteria (Monthly)
  min_gross_income DECIMAL(15,2),
  min_net_income DECIMAL(15,2),
  
  -- For Business
  min_annual_turnover DECIMAL(18,2),
  min_annual_profit DECIMAL(18,2),
  min_business_vintage_months INTEGER,
  
  -- Employment/Business
  min_current_job_months INTEGER, -- For salaried
  min_total_experience_months INTEGER,
  accepted_employment_types JSONB, -- ['permanent', 'contract', 'probation']
  
  -- Credit Score
  min_cibil_score INTEGER,
  min_experian_score INTEGER,
  accepted_bureau_score_types JSONB, -- ['cibil', 'experian', 'crif', 'equifax']
  
  -- Existing Obligations
  max_foir DECIMAL(5,2), -- Fixed Obligations to Income Ratio
  max_existing_loans INTEGER,
  max_credit_utilization DECIMAL(5,2), -- For credit cards
  
  -- Geography
  serviceable_states JSONB, -- ['Maharashtra', 'Karnataka'] or ['ALL']
  serviceable_cities JSONB, -- Tier-wise or specific cities
  excluded_pincodes JSONB,
  
  -- Company/Employer Categories (for salaried)
  employer_categories JSONB, -- ['CAT_A', 'CAT_B', 'CAT_C', 'GOVERNMENT']
  approved_employers JSONB, -- Specific company names (optional whitelist)
  negative_employers JSONB, -- Blacklisted employers
  
  -- Industry Restrictions (for business)
  negative_industries JSONB, -- ['Real Estate', 'Crypto', 'Gambling']
  preferred_industries JSONB, -- Get rate discount
  
  -- Special Conditions
  requires_itr BOOLEAN DEFAULT true,
  itr_years_required INTEGER DEFAULT 2,
  requires_gst BOOLEAN DEFAULT false,
  gst_months_required INTEGER,
  
  -- Property Specific (for Home/LAP)
  accepted_property_types JSONB, -- ['apartment', 'villa', 'plot', 'commercial']
  property_age_max_years INTEGER,
  property_cities JSONB,
  builder_approved_list JSONB,
  
  -- Vehicle Specific
  accepted_vehicle_types JSONB, -- ['new_car', 'used_car', 'two_wheeler', 'commercial']
  vehicle_age_max_years INTEGER,
  
  -- Co-applicant Rules
  co_applicant_mandatory BOOLEAN DEFAULT false,
  co_applicant_relationship JSONB, -- ['spouse', 'parent', 'sibling', 'co-owner']
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for lookups
CREATE INDEX idx_eligibility_product_type ON easy_loans_eligibility(product_id, applicant_type);


-- =============================================
-- RATE SLABS (Interest rate variations)
-- =============================================

CREATE TABLE easy_loans_rate_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES easy_loans_products(id) ON DELETE CASCADE,
  
  -- Slab Conditions
  min_cibil_score INTEGER,
  max_cibil_score INTEGER,
  min_loan_amount DECIMAL(15,2),
  max_loan_amount DECIMAL(15,2),
  min_tenure_months INTEGER,
  max_tenure_months INTEGER,
  applicant_type VARCHAR(50),
  employer_category VARCHAR(50),
  
  -- Rate for this slab
  interest_rate DECIMAL(6,3) NOT NULL,
  processing_fee_percent DECIMAL(5,2),
  
  -- Validity
  effective_from DATE,
  effective_until DATE,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_slabs_product ON easy_loans_rate_slabs(product_id);
```

### 3.2 User & Application Tables

```sql
-- =============================================
-- USER LOAN PROFILES
-- =============================================

CREATE TABLE easy_loans_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  
  -- Profile Type
  profile_type VARCHAR(50) NOT NULL, -- 'individual', 'business'
  profile_name VARCHAR(255), -- For multiple profiles
  
  -- === INDIVIDUAL FIELDS ===
  
  -- Personal
  full_name VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(20),
  pan_number VARCHAR(10),
  aadhar_last_4 VARCHAR(4),
  
  -- Contact
  mobile_number VARCHAR(15),
  email VARCHAR(255),
  current_city VARCHAR(100),
  current_pincode VARCHAR(10),
  residence_type VARCHAR(50), -- 'owned', 'rented', 'company_provided', 'with_parents'
  years_at_current_address INTEGER,
  
  -- Employment (Individual)
  employment_type VARCHAR(50), -- 'salaried', 'self_employed_professional', 'self_employed_business'
  employer_name VARCHAR(255),
  employer_type VARCHAR(50), -- 'private', 'government', 'psu', 'mnc'
  employer_category VARCHAR(20), -- 'CAT_A', 'CAT_B', 'CAT_C'
  designation VARCHAR(255),
  department VARCHAR(255),
  employee_id VARCHAR(100),
  office_city VARCHAR(100),
  office_pincode VARCHAR(10),
  current_job_start_date DATE,
  total_work_experience_months INTEGER,
  
  -- Income (Individual)
  monthly_gross_salary DECIMAL(15,2),
  monthly_net_salary DECIMAL(15,2),
  annual_bonus DECIMAL(15,2),
  other_monthly_income DECIMAL(15,2),
  other_income_source VARCHAR(255),
  
  -- === BUSINESS FIELDS ===
  
  -- Business Details
  business_name VARCHAR(255),
  business_type VARCHAR(50), -- 'proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd'
  business_category VARCHAR(100), -- Industry
  business_sub_category VARCHAR(100),
  business_start_date DATE,
  gst_number VARCHAR(20),
  udyam_number VARCHAR(30),
  business_city VARCHAR(100),
  business_pincode VARCHAR(10),
  
  -- Business Financials
  annual_turnover DECIMAL(18,2),
  annual_profit DECIMAL(18,2),
  itr_filed_years INTEGER,
  gst_filing_status VARCHAR(50), -- 'regular', 'quarterly', 'not_applicable'
  
  -- Directors/Partners (for companies)
  directors_info JSONB, -- [{name, pan, shareholding}]
  
  -- === COMMON FIELDS ===
  
  -- Credit Profile
  cibil_score INTEGER,
  cibil_score_date DATE,
  experian_score INTEGER,
  credit_score_source VARCHAR(50), -- 'self_reported', 'verified', 'api'
  
  -- Existing Obligations
  existing_loans JSONB,
  /*
  [
    {lender: 'HDFC', type: 'home_loan', outstanding: 5000000, emi: 45000, end_date: '2035-01-01'},
    {lender: 'ICICI', type: 'car_loan', outstanding: 300000, emi: 12000, end_date: '2026-06-01'}
  ]
  */
  total_existing_emi DECIMAL(15,2),
  credit_card_limit DECIMAL(15,2),
  credit_card_outstanding DECIMAL(15,2),
  
  -- Property (if any)
  owns_property BOOLEAN DEFAULT false,
  property_details JSONB,
  /*
  [
    {type: 'apartment', city: 'Mumbai', estimated_value: 8000000, has_loan: true}
  ]
  */
  
  -- Vehicle (if any)
  owns_vehicle BOOLEAN DEFAULT false,
  vehicle_details JSONB,
  
  -- Banking
  primary_bank VARCHAR(255),
  primary_bank_account_type VARCHAR(50),
  banking_relationship_years INTEGER,
  
  -- Documents Status
  documents_uploaded JSONB, -- {pan: true, aadhar: true, salary_slips: false}
  
  -- Profile Completeness
  completeness_percent INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user ON easy_loans_user_profiles(user_id);
CREATE INDEX idx_user_profiles_type ON easy_loans_user_profiles(profile_type);


-- =============================================
-- LOAN INQUIRIES & MATCHING
-- =============================================

CREATE TABLE easy_loans_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  profile_id UUID REFERENCES easy_loans_user_profiles(id),
  
  -- Request Details
  loan_category VARCHAR(50) NOT NULL, -- 'personal', 'business'
  loan_type VARCHAR(100) NOT NULL,
  requested_amount DECIMAL(15,2) NOT NULL,
  preferred_tenure_months INTEGER,
  purpose VARCHAR(255),
  purpose_detail TEXT,
  urgency VARCHAR(50), -- 'immediate', 'within_week', 'within_month', 'exploring'
  
  -- Property Details (for secured loans)
  property_type VARCHAR(50),
  property_city VARCHAR(100),
  property_value_estimated DECIMAL(15,2),
  is_property_identified BOOLEAN,
  
  -- Vehicle Details
  vehicle_type VARCHAR(50),
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  is_new_vehicle BOOLEAN,
  on_road_price DECIMAL(15,2),
  
  -- Matching Results
  products_matched INTEGER DEFAULT 0,
  best_rate_found DECIMAL(6,3),
  highest_eligibility_score INTEGER,
  matching_completed_at TIMESTAMPTZ,
  
  -- Results stored
  match_results JSONB,
  /*
  [
    {
      product_id: 'uuid',
      lender_name: 'HDFC Bank',
      eligibility_score: 85,
      max_eligible_amount: 1500000,
      indicative_rate: 10.75,
      indicative_emi: 32450,
      matched_criteria: ['credit_score', 'income', 'employment'],
      failed_criteria: [],
      rate_slab_applied: 'uuid'
    }
  ]
  */
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'converted', 'expired', 'cancelled'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_inquiries_user ON easy_loans_inquiries(user_id);
CREATE INDEX idx_inquiries_type ON easy_loans_inquiries(loan_type);
CREATE INDEX idx_inquiries_status ON easy_loans_inquiries(status);


-- =============================================
-- LEAD MANAGEMENT (DSA)
-- =============================================

CREATE TABLE easy_loans_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES easy_loans_inquiries(id),
  product_id UUID REFERENCES easy_loans_products(id),
  user_id INTEGER REFERENCES users(id),
  
  -- Lead Source
  source VARCHAR(50), -- 'organic', 'referral', 'campaign'
  source_detail VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Lead Details
  lead_stage VARCHAR(50) DEFAULT 'interested',
  /*
  Stages:
  - 'interested' - User clicked "Get Quote" or "Apply"
  - 'contacted' - User provided contact details
  - 'documents_pending' - Awaiting documents
  - 'documents_submitted' - Documents uploaded
  - 'sent_to_lender' - Shared with bank
  - 'lender_processing' - Bank reviewing
  - 'sanctioned' - Loan approved by bank
  - 'disbursed' - Money disbursed
  - 'rejected' - Bank rejected
  - 'withdrawn' - User cancelled
  */
  
  -- Application Details
  applied_amount DECIMAL(15,2),
  applied_tenure_months INTEGER,
  application_reference VARCHAR(100), -- Bank's reference
  
  -- Sanction Details
  sanctioned_amount DECIMAL(15,2),
  sanctioned_rate DECIMAL(6,3),
  sanctioned_tenure_months INTEGER,
  sanctioned_emi DECIMAL(15,2),
  sanction_date DATE,
  sanction_letter_url VARCHAR(500),
  
  -- Disbursement
  disbursed_amount DECIMAL(15,2),
  disbursement_date DATE,
  
  -- Rejection (if applicable)
  rejection_reason VARCHAR(255),
  rejection_date DATE,
  
  -- DSA Commission
  commission_structure VARCHAR(50), -- 'percentage', 'flat', 'slab'
  commission_percent DECIMAL(5,2),
  commission_flat DECIMAL(15,2),
  commission_amount DECIMAL(15,2), -- Calculated
  commission_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'invoiced', 'paid'
  commission_paid_date DATE,
  
  -- Communication Log
  communications JSONB,
  /*
  [
    {date: '2026-01-07', type: 'call', notes: 'Discussed documents required', by: 'system'},
    {date: '2026-01-08', type: 'email', notes: 'Sent document checklist', by: 'user123'}
  ]
  */
  
  -- Timestamps
  last_activity_at TIMESTAMPTZ,
  stage_updated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_inquiry ON easy_loans_leads(inquiry_id);
CREATE INDEX idx_leads_product ON easy_loans_leads(product_id);
CREATE INDEX idx_leads_stage ON easy_loans_leads(lead_stage);
CREATE INDEX idx_leads_commission ON easy_loans_leads(commission_status);


-- =============================================
-- RATE SHEET UPLOADS (for RAG)
-- =============================================

CREATE TABLE easy_loans_rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES easy_loans_lenders(id),
  
  -- File Details
  filename VARCHAR(255) NOT NULL,
  file_url VARCHAR(500),
  file_type VARCHAR(50), -- 'pdf', 'xlsx', 'csv'
  file_size_bytes INTEGER,
  
  -- Content (extracted)
  extracted_text TEXT, -- OCR/parsed content
  structured_data JSONB, -- Parsed rate tables
  
  -- RAG Integration
  embedding_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  vector_ids JSONB, -- IDs in vector store
  
  -- Validity
  effective_from DATE,
  effective_until DATE,
  is_current BOOLEAN DEFAULT true,
  
  -- Metadata
  uploaded_by INTEGER REFERENCES users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_sheets_lender ON easy_loans_rate_sheets(lender_id);
```

---

## 4. API Endpoints

### 4.1 User-Facing APIs

```typescript
// User Profile
POST   /api/easy-loans/profiles              // Create loan profile
GET    /api/easy-loans/profiles              // List user's profiles
GET    /api/easy-loans/profiles/:id          // Get profile details
PUT    /api/easy-loans/profiles/:id          // Update profile
DELETE /api/easy-loans/profiles/:id          // Delete profile

// Loan Inquiry
POST   /api/easy-loans/inquiries             // Create new inquiry (triggers matching)
GET    /api/easy-loans/inquiries             // List user's inquiries
GET    /api/easy-loans/inquiries/:id         // Get inquiry with matches
GET    /api/easy-loans/inquiries/:id/matches // Get detailed match results

// Lead Actions
POST   /api/easy-loans/leads                 // Express interest in a product
GET    /api/easy-loans/leads                 // Track user's applications
GET    /api/easy-loans/leads/:id             // Lead details
POST   /api/easy-loans/leads/:id/documents   // Upload documents

// Public/Info
GET    /api/easy-loans/products              // Browse loan products (public)
GET    /api/easy-loans/products/:id          // Product details
GET    /api/easy-loans/lenders               // List lenders (public)
GET    /api/easy-loans/calculator            // EMI calculator
```

### 4.2 Super Admin APIs

```typescript
// Lender Management
POST   /api/admin/easy-loans/lenders         // Add lender
GET    /api/admin/easy-loans/lenders         // List all lenders
GET    /api/admin/easy-loans/lenders/:id     // Lender details
PUT    /api/admin/easy-loans/lenders/:id     // Update lender
DELETE /api/admin/easy-loans/lenders/:id     // Deactivate lender

// Product Management
POST   /api/admin/easy-loans/products        // Add product
GET    /api/admin/easy-loans/products        // List all products
PUT    /api/admin/easy-loans/products/:id    // Update product
POST   /api/admin/easy-loans/products/:id/eligibility  // Set eligibility
POST   /api/admin/easy-loans/products/:id/rate-slabs   // Add rate slabs

// Rate Sheets
POST   /api/admin/easy-loans/rate-sheets     // Upload rate sheet (PDF/Excel)
GET    /api/admin/easy-loans/rate-sheets     // List rate sheets
DELETE /api/admin/easy-loans/rate-sheets/:id // Remove rate sheet

// Lead Management
GET    /api/admin/easy-loans/leads           // All leads with filters
PUT    /api/admin/easy-loans/leads/:id       // Update lead status
GET    /api/admin/easy-loans/leads/stats     // Dashboard stats

// Commission Management
GET    /api/admin/easy-loans/commissions     // Commission report
POST   /api/admin/easy-loans/commissions/mark-paid  // Mark as paid
```

---

## 5. Eligibility Matching Engine

### 5.1 Core Algorithm

```typescript
// server/services/easyLoans/eligibilityEngine.ts

interface MatchInput {
  profile: UserLoanProfile;
  loanType: string;
  requestedAmount: number;
  requestedTenure?: number;
}

interface MatchResult {
  productId: string;
  lender: {
    id: string;
    name: string;
    logo: string;
  };
  product: {
    name: string;
    type: string;
  };
  eligibilityScore: number; // 0-100
  eligibilityStatus: 'high' | 'medium' | 'low' | 'not_eligible';
  maxEligibleAmount: number;
  indicativeRate: number;
  indicativeEMI: number;
  matchedCriteria: CriteriaMatch[];
  failedCriteria: CriteriaMatch[];
  warnings: string[];
  recommendations: string[];
  rateSlabApplied?: string;
  processingFee: {
    type: string;
    value: number;
    min?: number;
    max?: number;
  };
}

interface CriteriaMatch {
  criterion: string;
  required: string;
  actual: string;
  passed: boolean;
  weight: number;
  message: string;
}

export class EligibilityEngine {
  private readonly CRITERION_WEIGHTS = {
    age: 5,
    credit_score: 25,
    income: 20,
    employment_type: 10,
    employment_tenure: 5,
    foir: 15,
    geography: 5,
    employer_category: 5,
    business_vintage: 10,
  };

  async calculateEligibility(input: MatchInput): Promise<MatchResult[]> {
    // 1. Get all active products for loan type
    const products = await this.getProducts(input.loanType);
    
    const results: MatchResult[] = [];
    
    for (const product of products) {
      const eligibilityCriteria = await this.getEligibilityCriteria(
        product.id, 
        input.profile.employmentType
      );
      
      if (!eligibilityCriteria) continue;
      
      const matchResult = this.evaluateCriteria(input, product, eligibilityCriteria);
      results.push(matchResult);
    }
    
    // Sort by eligibility score descending
    return results
      .filter(r => r.eligibilityScore > 0)
      .sort((a, b) => {
        // First by eligibility score
        if (b.eligibilityScore !== a.eligibilityScore) {
          return b.eligibilityScore - a.eligibilityScore;
        }
        // Then by interest rate (lower is better)
        return a.indicativeRate - b.indicativeRate;
      });
  }

  private evaluateCriteria(
    input: MatchInput,
    product: LoanProduct,
    criteria: EligibilityCriteria
  ): MatchResult {
    const matched: CriteriaMatch[] = [];
    const failed: CriteriaMatch[] = [];
    const warnings: string[] = [];
    let totalScore = 100;
    let isHardFail = false;
    
    const profile = input.profile;
    
    // === AGE CHECK ===
    const age = this.calculateAge(profile.dateOfBirth);
    const ageAtMaturity = age + (input.requestedTenure || product.maxTenureMonths) / 12;
    
    if (age < criteria.minAge) {
      failed.push({
        criterion: 'Minimum Age',
        required: `${criteria.minAge} years`,
        actual: `${age} years`,
        passed: false,
        weight: this.CRITERION_WEIGHTS.age,
        message: `You must be at least ${criteria.minAge} years old`
      });
      isHardFail = true;
    } else if (ageAtMaturity > criteria.maxAgeAtMaturity) {
      failed.push({
        criterion: 'Age at Maturity',
        required: `≤ ${criteria.maxAgeAtMaturity} years`,
        actual: `${Math.round(ageAtMaturity)} years`,
        passed: false,
        weight: this.CRITERION_WEIGHTS.age,
        message: `Loan must mature before you turn ${criteria.maxAgeAtMaturity}`
      });
      totalScore -= 20;
      warnings.push(`Consider shorter tenure to meet age limit`);
    } else {
      matched.push({
        criterion: 'Age',
        required: `${criteria.minAge}-${criteria.maxAgeAtMaturity} years`,
        actual: `${age} years`,
        passed: true,
        weight: this.CRITERION_WEIGHTS.age,
        message: 'Age requirement met'
      });
    }
    
    // === CREDIT SCORE CHECK ===
    if (profile.cibilScore) {
      if (profile.cibilScore < criteria.minCibilScore) {
        const gap = criteria.minCibilScore - profile.cibilScore;
        const penalty = Math.min(gap / 10, 30);
        totalScore -= penalty;
        
        failed.push({
          criterion: 'CIBIL Score',
          required: `≥ ${criteria.minCibilScore}`,
          actual: `${profile.cibilScore}`,
          passed: false,
          weight: this.CRITERION_WEIGHTS.credit_score,
          message: `Credit score is ${gap} points below requirement`
        });
        
        if (gap > 100) isHardFail = true;
      } else {
        matched.push({
          criterion: 'CIBIL Score',
          required: `≥ ${criteria.minCibilScore}`,
          actual: `${profile.cibilScore}`,
          passed: true,
          weight: this.CRITERION_WEIGHTS.credit_score,
          message: 'Credit score meets requirement'
        });
        
        // Bonus for excellent score
        if (profile.cibilScore >= 750) {
          totalScore += 5;
        }
      }
    } else {
      warnings.push('Credit score not provided - please update for accurate matching');
      totalScore -= 10;
    }
    
    // === INCOME CHECK ===
    const monthlyIncome = profile.monthlyGrossSalary || profile.annualTurnover / 12;
    if (monthlyIncome < criteria.minGrossIncome) {
      const shortfall = ((criteria.minGrossIncome - monthlyIncome) / criteria.minGrossIncome) * 100;
      totalScore -= Math.min(shortfall / 2, 25);
      
      failed.push({
        criterion: 'Monthly Income',
        required: `≥ ₹${criteria.minGrossIncome.toLocaleString()}`,
        actual: `₹${monthlyIncome.toLocaleString()}`,
        passed: false,
        weight: this.CRITERION_WEIGHTS.income,
        message: `Income is ₹${(criteria.minGrossIncome - monthlyIncome).toLocaleString()} below requirement`
      });
    } else {
      matched.push({
        criterion: 'Monthly Income',
        required: `≥ ₹${criteria.minGrossIncome.toLocaleString()}`,
        actual: `₹${monthlyIncome.toLocaleString()}`,
        passed: true,
        weight: this.CRITERION_WEIGHTS.income,
        message: 'Income requirement met'
      });
    }
    
    // === FOIR (Fixed Obligations to Income Ratio) ===
    const existingEMI = profile.totalExistingEmi || 0;
    const proposedEMI = this.calculateEMI(
      input.requestedAmount,
      product.interestRateMin,
      input.requestedTenure || product.maxTenureMonths
    );
    const newFOIR = (existingEMI + proposedEMI) / monthlyIncome;
    
    if (newFOIR > criteria.maxFoir) {
      const excess = ((newFOIR - criteria.maxFoir) / criteria.maxFoir) * 100;
      totalScore -= Math.min(excess, 30);
      
      failed.push({
        criterion: 'FOIR (Debt-to-Income)',
        required: `≤ ${(criteria.maxFoir * 100).toFixed(0)}%`,
        actual: `${(newFOIR * 100).toFixed(1)}%`,
        passed: false,
        weight: this.CRITERION_WEIGHTS.foir,
        message: 'Total EMIs would exceed affordable limit'
      });
      
      // Calculate max eligible amount based on FOIR
      const availableFOIR = Math.max(0, criteria.maxFoir - (existingEMI / monthlyIncome));
      const maxEMI = availableFOIR * monthlyIncome;
      warnings.push(`Based on FOIR, max eligible amount: ₹${this.calculatePrincipal(maxEMI, product.interestRateMin, product.maxTenureMonths).toLocaleString()}`);
    } else {
      matched.push({
        criterion: 'FOIR',
        required: `≤ ${(criteria.maxFoir * 100).toFixed(0)}%`,
        actual: `${(newFOIR * 100).toFixed(1)}%`,
        passed: true,
        weight: this.CRITERION_WEIGHTS.foir,
        message: 'Debt-to-income ratio is healthy'
      });
    }
    
    // === EMPLOYMENT TYPE ===
    if (!criteria.acceptedEmploymentTypes?.includes(profile.employmentType)) {
      failed.push({
        criterion: 'Employment Type',
        required: criteria.acceptedEmploymentTypes.join(', '),
        actual: profile.employmentType,
        passed: false,
        weight: this.CRITERION_WEIGHTS.employment_type,
        message: 'Employment type not supported for this product'
      });
      isHardFail = true;
    } else {
      matched.push({
        criterion: 'Employment Type',
        required: criteria.acceptedEmploymentTypes.join(', '),
        actual: profile.employmentType,
        passed: true,
        weight: this.CRITERION_WEIGHTS.employment_type,
        message: 'Employment type eligible'
      });
    }
    
    // === GEOGRAPHY ===
    if (criteria.serviceableCities && !criteria.serviceableCities.includes('ALL')) {
      if (!criteria.serviceableCities.includes(profile.currentCity)) {
        failed.push({
          criterion: 'Serviceable City',
          required: `In: ${criteria.serviceableCities.slice(0, 5).join(', ')}...`,
          actual: profile.currentCity,
          passed: false,
          weight: this.CRITERION_WEIGHTS.geography,
          message: 'Location not serviced by this lender'
        });
        isHardFail = true;
      }
    }
    
    // === CALCULATE FINAL SCORE ===
    if (isHardFail) {
      totalScore = 0;
    }
    
    // Determine eligibility status
    let eligibilityStatus: 'high' | 'medium' | 'low' | 'not_eligible';
    if (totalScore >= 80) eligibilityStatus = 'high';
    else if (totalScore >= 60) eligibilityStatus = 'medium';
    else if (totalScore >= 30) eligibilityStatus = 'low';
    else eligibilityStatus = 'not_eligible';
    
    // Calculate indicative rate from rate slabs
    const rateSlabResult = this.findApplicableRateSlab(product, profile, input.requestedAmount);
    
    // Calculate max eligible amount
    const maxAmount = this.calculateMaxEligibleAmount(profile, criteria, product);
    
    return {
      productId: product.id,
      lender: {
        id: product.lender.id,
        name: product.lender.name,
        logo: product.lender.logoUrl
      },
      product: {
        name: product.productName,
        type: product.loanType
      },
      eligibilityScore: Math.max(0, Math.min(100, Math.round(totalScore))),
      eligibilityStatus,
      maxEligibleAmount: Math.min(maxAmount, product.maxLoanAmount),
      indicativeRate: rateSlabResult?.rate || product.interestRateMin,
      indicativeEMI: proposedEMI,
      matchedCriteria: matched,
      failedCriteria: failed,
      warnings,
      recommendations: this.generateRecommendations(failed, warnings, profile),
      rateSlabApplied: rateSlabResult?.slabId,
      processingFee: {
        type: product.processingFeeType,
        value: product.processingFeePercent || 0,
        min: product.processingFeeMin,
        max: product.processingFeeMax
      }
    };
  }
  
  private calculateEMI(principal: number, annualRate: number, months: number): number {
    const r = annualRate / 100 / 12;
    if (r === 0) return principal / months;
    return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  }
  
  private calculatePrincipal(emi: number, annualRate: number, months: number): number {
    const r = annualRate / 100 / 12;
    if (r === 0) return emi * months;
    return emi * (Math.pow(1 + r, months) - 1) / (r * Math.pow(1 + r, months));
  }
  
  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }
  
  private generateRecommendations(
    failed: CriteriaMatch[],
    warnings: string[],
    profile: UserLoanProfile
  ): string[] {
    const recs: string[] = [];
    
    failed.forEach(f => {
      switch (f.criterion) {
        case 'CIBIL Score':
          recs.push('Improve credit score by paying bills on time and reducing credit utilization');
          break;
        case 'FOIR':
          recs.push('Consider closing existing loans or adding a co-applicant with income');
          recs.push('Request a lower loan amount or longer tenure to reduce EMI');
          break;
        case 'Monthly Income':
          recs.push('Add a co-applicant to increase combined income');
          break;
      }
    });
    
    return [...new Set(recs)].slice(0, 5);
  }
}
```

---

## 6. Frontend Pages

### 6.1 User-Facing Pages

```
client/src/pages/
├── EasyLoans.tsx                # Landing page with loan types
├── loans/
│   ├── ProfileForm.tsx          # Multi-step loan profile form
│   ├── LoanSearch.tsx           # Search/filter loans
│   ├── Results.tsx              # Match results with comparison
│   ├── ProductDetail.tsx        # Single product view
│   ├── Apply.tsx                # Apply flow with docs
│   └── MyApplications.tsx       # Track applications
```

### 6.2 Super Admin Pages

```
client/src/pages/superadmin/
├── EasyLoansAdmin.tsx           # Dashboard
├── loans/
│   ├── Lenders.tsx              # Manage lenders
│   ├── LenderForm.tsx           # Add/edit lender
│   ├── Products.tsx             # Manage products
│   ├── ProductForm.tsx          # Add/edit product
│   ├── Eligibility.tsx          # Configure criteria
│   ├── RateSlabs.tsx            # Manage rate slabs
│   ├── RateSheets.tsx           # Upload rate PDFs
│   ├── Leads.tsx                # Lead pipeline
│   └── Commissions.tsx          # Commission tracking
```

---

## 7. AI Integration Points

### 7.1 Natural Language Queries
```typescript
// Example: "Can I get a home loan of 50 lakhs with 720 CIBIL and 80k salary in Mumbai?"

// AI parses into structured query:
{
  loanType: 'home_loan',
  requestedAmount: 5000000,
  cibilScore: 720,
  monthlyIncome: 80000,
  city: 'Mumbai'
}
```

### 7.2 Rate Sheet RAG
- Upload PDF rate sheets to vector store
- Query: "What is HDFC's home loan rate for 750+ CIBIL?"
- AI retrieves from indexed rate sheets

### 7.3 Document Analysis
- Use existing document analyzer for:
  - Salary slip extraction
  - Bank statement analysis
  - ITR parsing
  - Auto-fill profile from documents

---

## 8. Implementation Checklist

### Week 1-2: Foundation
- [ ] Create database migrations
- [ ] Implement lender CRUD APIs
- [ ] Implement product CRUD APIs
- [ ] Build Super Admin lender management UI

### Week 3: Eligibility Engine
- [ ] Build eligibility matching algorithm
- [ ] Implement rate slab selection
- [ ] Create EMI calculator API
- [ ] Add FOIR calculation

### Week 4: User Experience
- [ ] Build multi-step profile form
- [ ] Create loan search/filter UI
- [ ] Build results comparison page
- [ ] Add product detail modal

### Week 5: Lead Management
- [ ] Implement lead creation flow
- [ ] Build lead tracking dashboard
- [ ] Add status update APIs
- [ ] Create commission calculation

### Week 6: AI Integration
- [ ] Add natural language query parsing
- [ ] Integrate rate sheet RAG
- [ ] Add document auto-fill
- [ ] Implement recommendations engine

---

*Document Version: 1.0*
*Author: GitHub Copilot*
*Date: January 7, 2026*
