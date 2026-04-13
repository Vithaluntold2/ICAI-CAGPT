# EasyLoans Admin API Reference

Complete API documentation for Super Admin DSA management endpoints.

## Base URL
```
/api/admin/easy-loans
```

## Authentication
All endpoints require **Super Admin** authentication. Include session cookie in requests.

## CSRF Protection
All mutation endpoints (POST, PUT, DELETE) require CSRF token:
1. First, get CSRF token: `GET /api/admin/csrf-token`
2. Include token in header: `X-CSRF-Token: <token>`

---

## Dashboard

### Get Statistics
```http
GET /api/admin/easy-loans/stats
```

**Response:**
```json
{
  "lenders": {
    "total": 9,
    "active": 9,
    "featured": 7
  },
  "products": {
    "total": 7,
    "active": 7,
    "featured": 5
  },
  "schemes": {
    "total": 5,
    "active": 5
  },
  "byLoanType": {
    "personal_loan": 2,
    "home_loan": 2,
    "business_loan_unsecured": 1,
    "working_capital": 1,
    "vehicle_loan": 1
  }
}
```

---

## Lenders Management

### List Lenders
```http
GET /api/admin/easy-loans/lenders?type=bank&isActive=true&search=HDFC&limit=20&offset=0
```

**Query Parameters:**
- `type` (optional): `bank`, `nbfc`, `hfc`, `fintech`, `cooperative`
- `category` (optional): `public_sector`, `private`, `foreign`, `small_finance`
- `isActive` (optional): `true` or `false`
- `search` (optional): Search by name or short name
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "lenders": [
    {
      "id": "uuid",
      "name": "HDFC Bank",
      "shortName": "HDFC",
      "type": "bank",
      "category": "private",
      "logoUrl": "https://...",
      "primaryColor": "#004C8F",
      "website": "https://www.hdfcbank.com",
      "customerCareNumber": "1800 202 6161",
      "isActive": true,
      "isFeatured": true,
      "priorityRank": 2,
      "totalBranches": 6000
    }
  ],
  "total": 1
}
```

### Get Lender Details
```http
GET /api/admin/easy-loans/lenders/:id
```

### Create Lender
```http
POST /api/admin/easy-loans/lenders
X-CSRF-Token: <token>
Content-Type: application/json

{
  "name": "Kotak Mahindra Bank",
  "shortName": "Kotak",
  "type": "bank",
  "category": "private",
  "primaryColor": "#ED232A",
  "website": "https://www.kotak.com",
  "customerCareNumber": "1860 266 2666",
  "customerCareEmail": "care@kotak.com",
  "rbiLicenseNumber": "INPB000005",
  "incorporationDate": "2003-03-25",
  "dsaCommissionDefault": 0.6,
  "isActive": true,
  "isFeatured": true,
  "priorityRank": 8,
  "servicedCountries": ["India"],
  "headquartersCity": "Mumbai",
  "totalBranches": 1600
}
```

### Update Lender
```http
PUT /api/admin/easy-loans/lenders/:id
X-CSRF-Token: <token>
Content-Type: application/json

{
  "priorityRank": 5,
  "isFeatured": false,
  "totalBranches": 1650
}
```

### Delete Lender (Soft Delete)
```http
DELETE /api/admin/easy-loans/lenders/:id
X-CSRF-Token: <token>
```

---

## Loan Products Management

### List Products
```http
GET /api/admin/easy-loans/products?lenderId=uuid&loanType=personal_loan&isActive=true&limit=20
```

**Query Parameters:**
- `lenderId` (optional): Filter by lender UUID
- `loanType` (optional): Filter by loan type
- `loanCategory` (optional): `personal` or `business`
- `isActive` (optional): `true` or `false`
- `search` (optional): Search by product name or code
- `limit`, `offset`: Pagination

**Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "lenderId": "uuid",
      "productCode": "SBI-PL-2024",
      "productName": "SBI Personal Loan",
      "displayName": "SBI Xpress Credit",
      "loanCategory": "personal",
      "loanType": "personal_loan",
      "minLoanAmount": 25000,
      "maxLoanAmount": 2000000,
      "interestRateMin": 10.50,
      "interestRateMax": 15.50,
      "minTenureMonths": 12,
      "maxTenureMonths": 72,
      "processingFeePercent": 1.0,
      "digitalProcess": true,
      "isActive": true,
      "isFeatured": true,
      "lender": {
        "id": "uuid",
        "name": "State Bank of India",
        "shortName": "SBI",
        "type": "bank"
      }
    }
  ],
  "total": 1
}
```

### Get Product Details
```http
GET /api/admin/easy-loans/products/:id
```

**Returns product with eligibility criteria and rate slabs.**

### Create Product
```http
POST /api/admin/easy-loans/products
X-CSRF-Token: <token>
Content-Type: application/json

{
  "lenderId": "uuid",
  "productCode": "PRODUCT-001",
  "productName": "Personal Loan Supreme",
  "displayName": "Supreme Personal Loan",
  "loanCategory": "personal",
  "loanType": "personal_loan",
  "minLoanAmount": 50000,
  "maxLoanAmount": 3000000,
  "interestRateType": "reducing",
  "baseRateName": "MCLR",
  "interestRateMin": 11.00,
  "interestRateMax": 18.00,
  "minTenureMonths": 12,
  "maxTenureMonths": 60,
  "processingFeeType": "percentage",
  "processingFeePercent": 2.0,
  "processingFeeMax": 5000,
  "prepaymentChargesPercent": 4.0,
  "digitalProcess": true,
  "doorstepService": false,
  "features": ["Instant approval", "Flexible EMI"],
  "requiredDocuments": ["PAN", "Aadhaar", "Salary slips"],
  "requiresCollateral": false,
  "isActive": true,
  "isFeatured": false
}
```

### Update Product
```http
PUT /api/admin/easy-loans/products/:id
X-CSRF-Token: <token>
Content-Type: application/json

{
  "interestRateMin": 10.75,
  "interestRateMax": 17.50,
  "isFeatured": true
}
```

### Delete Product
```http
DELETE /api/admin/easy-loans/products/:id
X-CSRF-Token: <token>
```

---

## Eligibility Criteria Management

### Get Eligibility for Product
```http
GET /api/admin/easy-loans/products/:productId/eligibility
```

**Response:**
```json
{
  "criteria": [
    {
      "id": "uuid",
      "productId": "uuid",
      "applicantType": "salaried",
      "minAge": 21,
      "maxAgeAtMaturity": 60,
      "minGrossIncome": 25000,
      "minCurrentJobMonths": 12,
      "minCibilScore": 700,
      "maxFoir": 50.0,
      "serviceableStates": ["ALL"],
      "requiresItr": false
    }
  ]
}
```

### Create Eligibility Criteria
```http
POST /api/admin/easy-loans/eligibility
X-CSRF-Token: <token>
Content-Type: application/json

{
  "productId": "uuid",
  "applicantType": "salaried",
  "minAge": 21,
  "maxAgeAtMaturity": 60,
  "minGrossIncome": 25000,
  "minNetIncome": 20000,
  "minCurrentJobMonths": 12,
  "minTotalExperienceMonths": 24,
  "acceptedEmploymentTypes": ["permanent"],
  "minCibilScore": 700,
  "acceptedBureauScoreTypes": ["cibil", "experian"],
  "maxFoir": 50.0,
  "maxExistingLoans": 3,
  "serviceableStates": ["Maharashtra", "Karnataka", "Delhi"],
  "employerCategories": ["CAT_A", "CAT_B", "GOVERNMENT"],
  "requiresItr": false,
  "requiresGst": false,
  "coApplicantMandatory": false
}
```

### Update Eligibility Criteria
```http
PUT /api/admin/easy-loans/eligibility/:id
X-CSRF-Token: <token>
Content-Type: application/json

{
  "minCibilScore": 720,
  "maxFoir": 55.0
}
```

### Delete Eligibility Criteria
```http
DELETE /api/admin/easy-loans/eligibility/:id
X-CSRF-Token: <token>
```

---

## Rate Slabs Management

### Get Rate Slabs for Product
```http
GET /api/admin/easy-loans/products/:productId/rate-slabs
```

**Response:**
```json
{
  "slabs": [
    {
      "id": "uuid",
      "productId": "uuid",
      "minCibilScore": 750,
      "maxCibilScore": 900,
      "interestRate": 10.50,
      "processingFeePercent": 0.5,
      "isActive": true
    }
  ]
}
```

### Create Rate Slab
```http
POST /api/admin/easy-loans/rate-slabs
X-CSRF-Token: <token>
Content-Type: application/json

{
  "productId": "uuid",
  "minCibilScore": 750,
  "maxCibilScore": 900,
  "minLoanAmount": 100000,
  "maxLoanAmount": 5000000,
  "minTenureMonths": 12,
  "maxTenureMonths": 60,
  "applicantType": "salaried",
  "employerCategory": "CAT_A",
  "interestRate": 10.50,
  "processingFeePercent": 0.5,
  "effectiveFrom": "2024-01-01",
  "effectiveUntil": "2024-12-31",
  "isActive": true
}
```

### Update Rate Slab
```http
PUT /api/admin/easy-loans/rate-slabs/:id
X-CSRF-Token: <token>
Content-Type: application/json

{
  "interestRate": 10.25,
  "effectiveUntil": "2025-03-31"
}
```

### Bulk Update Rate Slabs
Replace all rate slabs for a product:
```http
PUT /api/admin/easy-loans/products/:productId/rate-slabs/bulk
X-CSRF-Token: <token>
Content-Type: application/json

{
  "slabs": [
    {
      "minCibilScore": 750,
      "maxCibilScore": 900,
      "interestRate": 10.25,
      "isActive": true
    },
    {
      "minCibilScore": 700,
      "maxCibilScore": 749,
      "interestRate": 11.50,
      "isActive": true
    }
  ]
}
```

### Delete Rate Slab
```http
DELETE /api/admin/easy-loans/rate-slabs/:id
X-CSRF-Token: <token>
```

---

## Government Schemes Management

### List Schemes
```http
GET /api/admin/easy-loans/schemes?schemeType=government&schemeCategory=housing&isActive=true
```

**Query Parameters:**
- `schemeType` (optional): `government`, `rbi_mandated`, `bank_promotion`, `sector_specific`
- `schemeCategory` (optional): `housing`, `msme`, `agriculture`, `education`, `women`, `sc_st`
- `isActive` (optional): `true` or `false`
- `search` (optional): Search by name or code
- `limit`, `offset`: Pagination

**Response:**
```json
{
  "schemes": [
    {
      "id": "uuid",
      "schemeCode": "PMAY_CLSS",
      "schemeName": "Pradhan Mantri Awas Yojana - CLSS",
      "schemeShortName": "PMAY-CLSS",
      "schemeType": "government",
      "schemeCategory": "housing",
      "sponsoredBy": "GOI",
      "implementingAgency": "MoHUA",
      "maxLoanAmount": 1200000,
      "interestSubventionPercent": 6.5,
      "processingFeeWaiver": false,
      "minTenureMonths": 240,
      "maxTenureMonths": 240,
      "targetIncomeMax": 1800000,
      "firstHomeOnly": true,
      "isActive": true,
      "schemeUrl": "https://pmaymis.gov.in",
      "helplineNumber": "1800-11-6163"
    }
  ],
  "total": 1
}
```

### Get Scheme Details
```http
GET /api/admin/easy-loans/schemes/:id
```

### Create Scheme
```http
POST /api/admin/easy-loans/schemes
X-CSRF-Token: <token>
Content-Type: application/json

{
  "schemeCode": "SCHEME_2024",
  "schemeName": "New Government Scheme 2024",
  "schemeShortName": "NGS 2024",
  "schemeType": "government",
  "schemeCategory": "msme",
  "sponsoredBy": "GOI",
  "implementingAgency": "SIDBI",
  "maxLoanAmount": 5000000,
  "interestRateCap": 12.0,
  "interestSubventionPercent": 3.0,
  "processingFeeWaiver": true,
  "collateralFreeLimit": 1000000,
  "guaranteeCoveragePercent": 80.0,
  "minTenureMonths": 24,
  "maxTenureMonths": 84,
  "targetGender": ["all"],
  "targetCategories": ["SC", "ST", "OBC"],
  "targetIncomeMax": 1000000,
  "eligibleSectors": ["manufacturing", "services"],
  "isActive": true,
  "schemeUrl": "https://example.gov.in",
  "helplineNumber": "1800-XXX-XXXX"
}
```

### Update Scheme
```http
PUT /api/admin/easy-loans/schemes/:id
X-CSRF-Token: <token>
Content-Type: application/json

{
  "interestSubventionPercent": 4.0,
  "maxLoanAmount": 7500000
}
```

### Delete Scheme (Soft Delete)
```http
DELETE /api/admin/easy-loans/schemes/:id
X-CSRF-Token: <token>
```

---

## Product-Scheme Linking

### Get Schemes Linked to Product
```http
GET /api/admin/easy-loans/products/:productId/schemes
```

**Response:**
```json
{
  "schemes": [
    {
      "id": "uuid",
      "schemeCode": "PMAY_CLSS",
      "schemeName": "PMAY-CLSS",
      "linkData": {
        "id": "uuid",
        "productId": "uuid",
        "schemeId": "uuid",
        "applicableRate": 2.0,
        "additionalBenefits": "Interest subsidy",
        "isActive": true
      }
    }
  ]
}
```

### Link Product to Scheme
```http
POST /api/admin/easy-loans/products/:productId/schemes/:schemeId
X-CSRF-Token: <token>
Content-Type: application/json

{
  "applicableRate": 8.5,
  "additionalBenefits": "Government subsidy on interest"
}
```

### Unlink Product from Scheme
```http
DELETE /api/admin/easy-loans/products/:productId/schemes/:schemeId
X-CSRF-Token: <token>
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": [] // Optional validation details
}
```

**Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not super admin or CSRF token invalid
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Data Seeding

To populate the database with sample data:

```bash
npm run seed:easyloans
```

This will create:
- 9 major Indian lenders (SBI, HDFC, ICICI, Axis, Bajaj, LIC HFL, etc.)
- 7 loan products (Personal loans, Home loans, Business loans, Vehicle loans)
- 14 eligibility criteria configurations
- 26 rate slabs based on credit scores
- 5 government schemes (PMAY, MUDRA Shishu/Kishore/Tarun, Stand-Up India)
- Product-scheme linkages

---

## Audit Logging

All CRUD operations are automatically logged with:
- User ID
- Action type
- Resource type and ID
- Change details
- IP address
- User agent
- Timestamp

View audit logs in the `audit_logs` table.
