# EasyLoans End-to-End User Features

## Overview
EasyLoans is a full loan discovery and match platform inside ICAI CAGPT, built for both retail borrowers and business users.
It combines AI-driven eligibility, lender comparison, government scheme matching, and DSA admin management into a single workflow.

## 1. User-facing loan journey

### 1.1 Loan selection
- Present the borrower with supported loan categories:
  - Personal Loan
  - Home Loan
  - Loan Against Property (LAP)
  - Vehicle Loan
  - Education Loan
  - Gold Loan
  - Credit Card
  - Business Loan (Unsecured)
  - Business Loan (Secured)
  - Working Capital Loan
  - Term Loan
  - Equipment Finance
  - Invoice Discounting
  - Overdraft Facility
  - MSME Loan
- Allow borrowers to choose the loan type that matches their requirement.

### 1.2 Profile intake and eligibility inputs
- Collect borrower profile data required for matching:
  - Personal details (name, phone, email)
  - Borrower type: salaried, self-employed, SME, corporate
  - Income, turnover, or business revenue
  - Credit score band or CIBIL band
  - Requested loan amount and preferred tenure
  - Loan purpose and collateral details when applicable
- Validate the input fields and guide the user to complete missing eligibility data.

### 1.3 AI-powered eligibility assessment
- Evaluate borrower profile against lender eligibility criteria.
- Generate an eligibility score for each loan product.
- Determine product fit using rule-based and AI-assisted match logic.
- Surface eligibility blockers and missing conditions clearly.

### 1.4 Loan recommendation and compare experience
- Display a shortlist of matched lenders and loan offers.
- Show comparison metrics for every matched offer:
  - interest rate
  - EMI / monthly payment estimate
  - processing fee
  - loan amount range
  - tenure available
  - lender type and partner status
- Highlight recommended offers with the highest fit score.
- Provide a simple comparison layout so the borrower can scan and choose quickly.

### 1.5 Government scheme support
- Identify government-backed loan schemes that apply to the borrower.
- Link schemes to eligible products and lenders.
- Display scheme benefits, eligibility criteria, and access details.

### 1.6 Application lead capture
- Capture loan enquiry details for the selected lender/product.
- Store borrower contact details and enquiry data for DSA follow-up.
- Create a lead with the selected offer and eligibility context.
- Allow the application or enquiry to be reviewed by the lending partner.

### 1.7 Result personalization and explanation
- Provide clear, personalized reasoning for each recommendation.
- Explain why a specific lender was matched or why one product is better for the borrower.
- Surface constraints such as credit score band, income threshold, collateral need, or document requirements.

## 2. EasyLoans DSA / Super Admin features

### 2.1 EasyLoans admin dashboard
- Dashboard page at `/superadmin/easyloans`.
- Real-time summary cards showing:
  - total lender count
  - loan product count
  - eligibility criteria count
  - rate slab count
  - government scheme count
- Quick links to major management sections.

### 2.2 Lender management
- Manage lender records via `/superadmin/easyloans/lenders`.
- Table view with lenders and key details.
- Search and filter lenders by name and status.
- Create and edit lender details including:
  - lender name, registered name, contact details
  - website, logo URL, incorporation date
  - RBI / NBFC registration details
  - active/inactive status
- Delete lenders with confirmation.

### 2.3 Loan product and eligibility management
- Create and manage loan products tied to lenders.
- Define eligibility rules for borrowers.
- Configure rate slabs by credit score and borrower category.
- Link loan products to government schemes.
- Enable or disable products based on DSA policy.

### 2.4 Rate slabs and government schemes
- Maintain rate slab definitions for lenders.
- Manage government scheme metadata and eligibility linkages.
- Attach schemes to eligible products.
- Keep scheme counts and active scheme status visible.

### 2.5 Secure admin access
- Super Admin guard for EasyLoans routes.
- CSRF protection on all admin mutations.
- Role-based access enforcement for DSA features.

## 3. Core user flows

### 3.1 Borrower loan search flow
1. Borrower selects loan category.
2. Borrower enters profile and financial details.
3. System evaluates eligibility and scores matches.
4. Matched lenders and offers are shown.
5. Borrower compares offers and picks one.
6. Lead or enquiry is captured for follow-up.

### 3.2 DSA management flow
1. Super Admin logs in and opens EasyLoans admin.
2. Reviews dashboard metrics.
3. Adds or updates lender details.
4. Configures loan products and eligibility rules.
5. Links products to schemes and rate slabs.
6. Reviews borrower leads and application matches.

## 4. Data and integration points

### 4.1 Backend services
- Loan matching engine and eligibility engine drive recommendation logic.
- Hybrid cache and persistence ensure fast lookup and fallback reliability.
- Admin routes provide CRUD operations for lenders, products, eligibility, rate slabs, and schemes.

### 4.2 Frontend routes
- `/superadmin/easyloans` — EasyLoans dashboard
- `/superadmin/easyloans/lenders` — Lender management
- `/superadmin/easyloans/products` — Product management placeholder
- `/superadmin/easyloans/eligibility` — Eligibility rule management placeholder
- `/superadmin/easyloans/rate-slabs` — Rate slab management placeholder
- `/superadmin/easyloans/schemes` — Government scheme management placeholder

## 5. User benefit summary
- Simplifies loan selection for retail and business users.
- Matches eligibility intelligently across many lender offers.
- Helps borrowers compare rates, EMIs, and scheme benefits.
- Gives DSAs a centralized management system for lenders, products, and rules.
- Supports secure configuration and admin workflows.

## 6. Notes
- EasyLoans is integrated into ICAI CAGPT as a chat-enabled loan advisor experience.
- The admin-facing EasyLoans DSA portal enables lender/product lifecycle management.
- Government scheme matching and eligibility scoring are core differentiators.
