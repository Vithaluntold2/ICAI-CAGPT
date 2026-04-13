/**
 * EasyLoans Seeding Script
 * 
 * Populates the database with:
 * - Major Indian lenders (Banks, NBFCs, HFCs)
 * - Loan products with realistic rates
 * - Eligibility criteria
 * - Rate slabs based on credit score
 * - Government schemes (PMAY, MUDRA, etc.)
 */

import { db } from '../server/db';
import {
  easyLoansLenders,
  easyLoansProducts,
  easyLoansEligibility,
  easyLoansRateSlabs,
  easyLoansSchemes,
  easyLoansProductSchemes
} from '../shared/schema';

console.log('[EasyLoans Seed] Starting database seeding...');

async function seedLenders() {
  console.log('[EasyLoans Seed] Seeding lenders...');
  
  const lenders = [
    // Public Sector Banks
    {
      name: 'State Bank of India',
      shortName: 'SBI',
      type: 'bank',
      category: 'public_sector',
      logoUrl: 'https://www.sbi.co.in/documents/77530/89479/SBI_Logo.png',
      primaryColor: '#1C4587',
      website: 'https://www.sbi.co.in',
      customerCareNumber: '1800 1234',
      customerCareEmail: 'care@sbi.co.in',
      rbiLicenseNumber: 'INPB000001',
      incorporationDate: new Date('1955-07-01'),
      dsaCommissionDefault: 0.5,
      isActive: true,
      isFeatured: true,
      priorityRank: 1,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 22000
    },
    {
      name: 'HDFC Bank',
      shortName: 'HDFC',
      type: 'bank',
      category: 'private',
      logoUrl: 'https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/common/images/common/logo.png',
      primaryColor: '#004C8F',
      website: 'https://www.hdfcbank.com',
      customerCareNumber: '1800 202 6161',
      customerCareEmail: 'support@hdfcbank.com',
      rbiLicenseNumber: 'INPB000002',
      incorporationDate: new Date('1994-08-01'),
      dsaCommissionDefault: 0.6,
      isActive: true,
      isFeatured: true,
      priorityRank: 2,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 6000
    },
    {
      name: 'ICICI Bank',
      shortName: 'ICICI',
      type: 'bank',
      category: 'private',
      logoUrl: 'https://www.icicibank.com/etc/designs/icicibank/images/icici-logo.png',
      primaryColor: '#F05A28',
      website: 'https://www.icicibank.com',
      customerCareNumber: '1860 120 7777',
      customerCareEmail: 'customer.care@icicibank.com',
      rbiLicenseNumber: 'INPB000003',
      incorporationDate: new Date('1994-01-05'),
      dsaCommissionDefault: 0.6,
      isActive: true,
      isFeatured: true,
      priorityRank: 3,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 5500
    },
    {
      name: 'Axis Bank',
      shortName: 'Axis',
      type: 'bank',
      category: 'private',
      primaryColor: '#97144D',
      website: 'https://www.axisbank.com',
      customerCareNumber: '1860 419 5555',
      customerCareEmail: 'customer.care@axisbank.com',
      rbiLicenseNumber: 'INPB000004',
      incorporationDate: new Date('1993-12-03'),
      dsaCommissionDefault: 0.55,
      isActive: true,
      isFeatured: true,
      priorityRank: 4,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 4700
    },
    
    // NBFCs
    {
      name: 'Bajaj Finance',
      shortName: 'Bajaj Finserv',
      type: 'nbfc',
      category: 'private',
      primaryColor: '#0099CC',
      website: 'https://www.bajajfinserv.in',
      customerCareNumber: '8698 01 8698',
      customerCareEmail: 'care@bajajfinserv.in',
      rbiLicenseNumber: 'B-14.00300',
      incorporationDate: new Date('1987-03-25'),
      dsaCommissionDefault: 1.0,
      isActive: true,
      isFeatured: true,
      priorityRank: 5,
      servicedCountries: ['India'],
      headquartersCity: 'Pune',
      totalBranches: 1300
    },
    {
      name: 'Tata Capital',
      shortName: 'Tata Capital',
      type: 'nbfc',
      category: 'private',
      primaryColor: '#1A4B8C',
      website: 'https://www.tatacapital.com',
      customerCareNumber: '1860 267 6868',
      customerCareEmail: 'contactus@tatacapital.com',
      rbiLicenseNumber: 'B-14.01938',
      incorporationDate: new Date('2007-11-29'),
      dsaCommissionDefault: 0.9,
      isActive: true,
      isFeatured: false,
      priorityRank: 10,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 280
    },
    
    // HFCs
    {
      name: 'LIC Housing Finance',
      shortName: 'LICHFL',
      type: 'hfc',
      category: 'public_sector',
      primaryColor: '#E31E25',
      website: 'https://www.lichousing.com',
      customerCareNumber: '1800 103 3211',
      customerCareEmail: 'customer.care@lichousing.com',
      rbiLicenseNumber: 'N-14.03259',
      incorporationDate: new Date('1989-06-19'),
      dsaCommissionDefault: 0.7,
      isActive: true,
      isFeatured: true,
      priorityRank: 6,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 350
    },
    {
      name: 'HDFC Limited',
      shortName: 'HDFC',
      type: 'hfc',
      category: 'private',
      primaryColor: '#004C8F',
      website: 'https://www.hdfc.com',
      customerCareNumber: '1800 266 4555',
      customerCareEmail: 'homes@hdfc.com',
      rbiLicenseNumber: 'N-14.01495',
      incorporationDate: new Date('1977-10-17'),
      dsaCommissionDefault: 0.65,
      isActive: true,
      isFeatured: true,
      priorityRank: 7,
      servicedCountries: ['India'],
      headquartersCity: 'Mumbai',
      totalBranches: 480
    },
    
    // Fintech
    {
      name: 'Paytm Postpaid',
      shortName: 'Paytm',
      type: 'fintech',
      category: 'private',
      primaryColor: '#00BAF2',
      website: 'https://paytm.com',
      customerCareNumber: '0120-4456-456',
      customerCareEmail: 'care@paytm.com',
      incorporationDate: new Date('2010-08-01'),
      dsaCommissionDefault: 1.5,
      isActive: true,
      isFeatured: false,
      priorityRank: 15,
      servicedCountries: ['India'],
      headquartersCity: 'Noida',
      totalBranches: 0
    }
  ];
  
  const insertedLenders = await db.insert(easyLoansLenders).values(lenders).returning();
  console.log(`[EasyLoans Seed] Inserted ${insertedLenders.length} lenders`);
  
  return insertedLenders;
}

async function seedProducts(lenders: any[]) {
  console.log('[EasyLoans Seed] Seeding loan products...');
  
  const sbi = lenders.find(l => l.shortName === 'SBI');
  const hdfc = lenders.find(l => l.shortName === 'HDFC' && l.type === 'bank');
  const icici = lenders.find(l => l.shortName === 'ICICI');
  const axis = lenders.find(l => l.shortName === 'Axis');
  const bajaj = lenders.find(l => l.shortName === 'Bajaj Finserv');
  const lichfl = lenders.find(l => l.shortName === 'LICHFL');
  
  const products = [
    // SBI Personal Loan
    {
      lenderId: sbi.id,
      productCode: 'SBI-PL-2024',
      productName: 'SBI Personal Loan',
      displayName: 'SBI Xpress Credit',
      loanCategory: 'personal',
      loanType: 'personal_loan',
      minLoanAmount: 25000,
      maxLoanAmount: 2000000,
      interestRateType: 'reducing',
      baseRateName: 'MCLR',
      interestRateMin: 10.50,
      interestRateMax: 15.50,
      minTenureMonths: 12,
      maxTenureMonths: 72,
      processingFeeType: 'percentage',
      processingFeePercent: 1.0,
      processingFeeMin: 1000,
      processingFeeMax: 10000,
      prepaymentChargesPercent: 3.0,
      foreclosureChargesPercent: 5.0,
      avgDisbursementDays: 3,
      maxProcessingDays: 7,
      digitalProcess: true,
      doorstepService: false,
      features: ['Minimal documentation', 'Quick approval', 'Flexible tenure', 'Instant disbursal for existing customers'],
      requiredDocuments: ['PAN Card', 'Aadhaar Card', 'Salary slips (3 months)', 'Bank statements (6 months)'],
      requiresCollateral: false,
      isActive: true,
      isFeatured: true,
      termsUrl: 'https://sbi.co.in/portal/web/personal-banking/personal-loan'
    },
    
    // HDFC Personal Loan
    {
      lenderId: hdfc.id,
      productCode: 'HDFC-PL-001',
      productName: 'HDFC Personal Loan',
      displayName: 'HDFC Bank Personal Loan',
      loanCategory: 'personal',
      loanType: 'personal_loan',
      minLoanAmount: 50000,
      maxLoanAmount: 4000000,
      interestRateType: 'reducing',
      baseRateName: 'MCLR',
      interestRateMin: 10.75,
      interestRateMax: 21.00,
      minTenureMonths: 12,
      maxTenureMonths: 60,
      processingFeeType: 'percentage',
      processingFeePercent: 2.0,
      processingFeeMin: 999,
      processingFeeMax: 5000,
      prepaymentChargesPercent: 4.0,
      avgDisbursementDays: 2,
      maxProcessingDays: 5,
      digitalProcess: true,
      doorstepService: true,
      features: ['Instant approval', 'Pre-approved offers', 'Flexi loan option', 'Balance transfer'],
      requiredDocuments: ['Identity proof', 'Address proof', 'Income proof', 'Employment proof'],
      requiresCollateral: false,
      isActive: true,
      isFeatured: true,
      applyUrl: 'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan'
    },
    
    // SBI Home Loan
    {
      lenderId: sbi.id,
      productCode: 'SBI-HL-001',
      productName: 'SBI Home Loan',
      displayName: 'SBI Home Loan Regular',
      loanCategory: 'personal',
      loanType: 'home_loan',
      minLoanAmount: 100000,
      maxLoanAmount: 30000000,
      interestRateType: 'floating',
      baseRateName: 'RLLR',
      interestRateMin: 8.50,
      interestRateMax: 9.65,
      spreadOverBase: 0.0,
      minTenureMonths: 60,
      maxTenureMonths: 360,
      processingFeeType: 'flat',
      processingFeeMin: 10000,
      processingFeeMax: 10000,
      prepaymentChargesPercent: 0.0,
      avgDisbursementDays: 15,
      maxProcessingDays: 30,
      digitalProcess: false,
      doorstepService: true,
      features: ['Low interest rates', 'Tax benefits', 'Flexi repayment', 'Balance transfer facility'],
      requiredDocuments: ['KYC documents', 'Income proof', 'Property documents', 'Bank statements'],
      requiresCollateral: true,
      acceptedCollateralTypes: ['property'],
      ltvMax: 90.0,
      isActive: true,
      isFeatured: true
    },
    
    // LICHFL Home Loan
    {
      lenderId: lichfl.id,
      productCode: 'LIC-HL-001',
      productName: 'LIC Home Loan',
      displayName: 'LIC HFL Home Loan',
      loanCategory: 'personal',
      loanType: 'home_loan',
      minLoanAmount: 100000,
      maxLoanAmount: 50000000,
      interestRateType: 'floating',
      baseRateName: 'PLR',
      interestRateMin: 8.40,
      interestRateMax: 9.80,
      minTenureMonths: 60,
      maxTenureMonths: 300,
      processingFeeType: 'percentage',
      processingFeePercent: 0.5,
      processingFeeMin: 5000,
      processingFeeMax: 20000,
      prepaymentChargesPercent: 0.0,
      avgDisbursementDays: 20,
      maxProcessingDays: 45,
      digitalProcess: false,
      doorstepService: true,
      features: ['Special rates for women borrowers', 'No hidden charges', 'Flexible repayment'],
      requiredDocuments: ['Identity & address proof', 'Income documents', 'Property papers'],
      requiresCollateral: true,
      acceptedCollateralTypes: ['property'],
      ltvMax: 85.0,
      isActive: true,
      isFeatured: true
    },
    
    // Bajaj Business Loan
    {
      lenderId: bajaj.id,
      productCode: 'BAJAJ-BL-001',
      productName: 'Bajaj Finserv Business Loan',
      displayName: 'Business Loan for SMEs',
      loanCategory: 'business',
      loanType: 'business_loan_unsecured',
      minLoanAmount: 100000,
      maxLoanAmount: 8000000,
      interestRateType: 'reducing',
      interestRateMin: 14.00,
      interestRateMax: 28.00,
      minTenureMonths: 12,
      maxTenureMonths: 96,
      processingFeeType: 'percentage',
      processingFeePercent: 3.93,
      prepaymentChargesPercent: 4.0,
      foreclosureChargesPercent: 5.0,
      avgDisbursementDays: 2,
      maxProcessingDays: 5,
      digitalProcess: true,
      doorstepService: false,
      features: ['Instant approval', 'Minimal documentation', 'Flexi loan option', 'No collateral required'],
      requiredDocuments: ['Business proof', 'Income tax returns', 'Bank statements', 'GST returns'],
      requiresCollateral: false,
      isActive: true,
      isFeatured: true
    },
    
    // ICICI Bank Business Loan
    {
      lenderId: icici.id,
      productCode: 'ICICI-BL-001',
      productName: 'ICICI Bank Business Loan',
      displayName: 'ICICI Business Advantage',
      loanCategory: 'business',
      loanType: 'working_capital',
      minLoanAmount: 500000,
      maxLoanAmount: 10000000,
      interestRateType: 'floating',
      baseRateName: 'MCLR',
      interestRateMin: 11.25,
      interestRateMax: 17.50,
      minTenureMonths: 12,
      maxTenureMonths: 60,
      processingFeeType: 'percentage',
      processingFeePercent: 2.0,
      processingFeeMax: 25000,
      avgDisbursementDays: 7,
      maxProcessingDays: 15,
      digitalProcess: true,
      doorstepService: true,
      features: ['Overdraft facility', 'Working capital support', 'Cash credit limit'],
      requiredDocuments: ['Business registration', 'ITR (2 years)', 'GST returns', 'Financial statements'],
      requiresCollateral: false,
      isActive: true,
      isFeatured: false
    },
    
    // Axis Bank Vehicle Loan
    {
      lenderId: axis.id,
      productCode: 'AXIS-VL-001',
      productName: 'Axis Bank Car Loan',
      displayName: 'New Car Loan',
      loanCategory: 'personal',
      loanType: 'vehicle_loan',
      minLoanAmount: 100000,
      maxLoanAmount: 5000000,
      interestRateType: 'reducing',
      interestRateMin: 8.75,
      interestRateMax: 12.50,
      minTenureMonths: 12,
      maxTenureMonths: 84,
      processingFeeType: 'percentage',
      processingFeePercent: 1.0,
      processingFeeMax: 5000,
      prepaymentChargesPercent: 3.0,
      avgDisbursementDays: 3,
      maxProcessingDays: 7,
      digitalProcess: true,
      doorstepService: false,
      features: ['Instant approval', 'Up to 100% on-road price', 'Attractive interest rates'],
      requiredDocuments: ['KYC documents', 'Income proof', 'Vehicle quotation/invoice'],
      requiresCollateral: true,
      acceptedCollateralTypes: ['vehicle'],
      ltvMax: 90.0,
      isActive: true,
      isFeatured: false
    }
  ];
  
  const insertedProducts = await db.insert(easyLoansProducts).values(products).returning();
  console.log(`[EasyLoans Seed] Inserted ${insertedProducts.length} products`);
  
  return insertedProducts;
}

async function seedEligibility(products: any[]) {
  console.log('[EasyLoans Seed] Seeding eligibility criteria...');
  
  const eligibilityCriteria = [];
  
  // For each product, create eligibility criteria for different applicant types
  for (const product of products) {
    if (product.loanCategory === 'personal') {
      // Salaried eligibility
      eligibilityCriteria.push({
        productId: product.id,
        applicantType: 'salaried',
        minAge: 21,
        maxAgeAtMaturity: 60,
        minGrossIncome: product.loanType === 'home_loan' ? 25000 : 20000,
        minNetIncome: product.loanType === 'home_loan' ? 20000 : 15000,
        minCurrentJobMonths: 12,
        minTotalExperienceMonths: 24,
        acceptedEmploymentTypes: ['permanent'],
        minCibilScore: product.loanType === 'home_loan' ? 650 : 700,
        acceptedBureauScoreTypes: ['cibil', 'experian', 'crif'],
        maxFoir: 50.0,
        maxExistingLoans: 3,
        maxCreditUtilization: 50.0,
        serviceableStates: ['ALL'],
        employerCategories: ['CAT_A', 'CAT_B', 'CAT_C', 'GOVERNMENT'],
        requiresItr: false,
        itrYearsRequired: 0,
        requiresGst: false,
        coApplicantMandatory: false
      });
      
      // Self-employed professional eligibility
      eligibilityCriteria.push({
        productId: product.id,
        applicantType: 'self_employed_professional',
        minAge: 25,
        maxAgeAtMaturity: 65,
        minNetIncome: product.loanType === 'home_loan' ? 30000 : 25000,
        minTotalExperienceMonths: 36,
        minCibilScore: product.loanType === 'home_loan' ? 700 : 720,
        acceptedBureauScoreTypes: ['cibil', 'experian'],
        maxFoir: 55.0,
        serviceableStates: ['ALL'],
        requiresItr: true,
        itrYearsRequired: 2,
        requiresGst: false,
        coApplicantMandatory: false
      });
    } else {
      // Business loan eligibility
      eligibilityCriteria.push({
        productId: product.id,
        applicantType: 'self_employed_business',
        minAge: 25,
        maxAgeAtMaturity: 65,
        minAnnualTurnover: 1000000,
        minAnnualProfit: 100000,
        minBusinessVintageMonths: 24,
        minCibilScore: 680,
        acceptedBureauScoreTypes: ['cibil', 'experian', 'crif'],
        maxFoir: 60.0,
        serviceableStates: ['ALL'],
        requiresItr: true,
        itrYearsRequired: 2,
        requiresGst: true,
        gstMonthsRequired: 12,
        coApplicantMandatory: false
      });
      
      // Company eligibility
      eligibilityCriteria.push({
        productId: product.id,
        applicantType: 'company',
        minAge: 21,
        maxAgeAtMaturity: 70,
        minAnnualTurnover: 5000000,
        minAnnualProfit: 500000,
        minBusinessVintageMonths: 36,
        minCibilScore: 700,
        acceptedBureauScoreTypes: ['cibil', 'experian', 'crif', 'equifax'],
        maxFoir: 65.0,
        serviceableStates: ['ALL'],
        requiresItr: true,
        itrYearsRequired: 3,
        requiresGst: true,
        gstMonthsRequired: 24,
        coApplicantMandatory: false
      });
    }
  }
  
  const insertedCriteria = await db.insert(easyLoansEligibility).values(eligibilityCriteria).returning();
  console.log(`[EasyLoans Seed] Inserted ${insertedCriteria.length} eligibility criteria`);
  
  return insertedCriteria;
}

async function seedRateSlabs(products: any[]) {
  console.log('[EasyLoans Seed] Seeding rate slabs...');
  
  const rateSlabs = [];
  
  for (const product of products) {
    // Rate slab based on CIBIL score - Excellent
    rateSlabs.push({
      productId: product.id,
      minCibilScore: 750,
      maxCibilScore: 900,
      interestRate: product.interestRateMin,
      processingFeePercent: product.processingFeePercent ? product.processingFeePercent * 0.5 : undefined,
      effectiveFrom: new Date('2024-01-01'),
      isActive: true
    });
    
    // Good credit score
    rateSlabs.push({
      productId: product.id,
      minCibilScore: 700,
      maxCibilScore: 749,
      interestRate: product.interestRateMin + (product.interestRateMax - product.interestRateMin) * 0.3,
      processingFeePercent: product.processingFeePercent ? product.processingFeePercent * 0.75 : undefined,
      effectiveFrom: new Date('2024-01-01'),
      isActive: true
    });
    
    // Fair credit score
    rateSlabs.push({
      productId: product.id,
      minCibilScore: 650,
      maxCibilScore: 699,
      interestRate: product.interestRateMin + (product.interestRateMax - product.interestRateMin) * 0.6,
      processingFeePercent: product.processingFeePercent,
      effectiveFrom: new Date('2024-01-01'),
      isActive: true
    });
    
    // Below average credit score
    if (product.loanType !== 'home_loan') {
      rateSlabs.push({
        productId: product.id,
        minCibilScore: 600,
        maxCibilScore: 649,
        interestRate: product.interestRateMax,
        processingFeePercent: product.processingFeePercent ? product.processingFeePercent * 1.2 : undefined,
        effectiveFrom: new Date('2024-01-01'),
        isActive: true
      });
    }
  }
  
  const insertedSlabs = await db.insert(easyLoansRateSlabs).values(rateSlabs).returning();
  console.log(`[EasyLoans Seed] Inserted ${insertedSlabs.length} rate slabs`);
  
  return insertedSlabs;
}

async function seedSchemes() {
  console.log('[EasyLoans Seed] Seeding government schemes...');
  
  const schemes = [
    // PMAY - Pradhan Mantri Awas Yojana
    {
      schemeCode: 'PMAY_CLSS',
      schemeName: 'Pradhan Mantri Awas Yojana - Credit Linked Subsidy Scheme',
      schemeShortName: 'PMAY-CLSS',
      schemeType: 'government',
      schemeCategory: 'housing',
      sponsoredBy: 'GOI',
      implementingAgency: 'Ministry of Housing and Urban Affairs',
      maxLoanAmount: 1200000,
      interestSubventionPercent: 6.5,
      processingFeeWaiver: false,
      minTenureMonths: 240,
      maxTenureMonths: 240,
      targetGender: ['all'],
      targetCategories: ['EWS', 'LIG', 'MIG'],
      targetIncomeMax: 1800000,
      targetLocationType: ['urban'],
      propertyValueMax: 4500000,
      carpetAreaMaxSqft: 1200,
      firstHomeOnly: true,
      specialDocuments: ['Income certificate', 'First-time buyer declaration'],
      schemeStartDate: new Date('2015-06-25'),
      isActive: true,
      schemeUrl: 'https://pmaymis.gov.in',
      helplineNumber: '1800-11-6163'
    },
    
    // MUDRA - Micro Units Development and Refinance Agency
    {
      schemeCode: 'MUDRA_SHISHU',
      schemeName: 'Pradhan Mantri MUDRA Yojana - Shishu',
      schemeShortName: 'PMMY Shishu',
      schemeType: 'government',
      schemeCategory: 'msme',
      sponsoredBy: 'GOI',
      implementingAgency: 'MUDRA',
      maxLoanAmount: 50000,
      interestRateCap: 12.0,
      processingFeeWaiver: true,
      collateralFreeLimit: 50000,
      guaranteeCoveragePercent: 85.0,
      minTenureMonths: 12,
      maxTenureMonths: 60,
      targetGender: ['all'],
      targetCategories: ['general', 'SC', 'ST', 'OBC', 'minority'],
      businessVintageMinMonths: 0,
      businessVintageMaxMonths: 24,
      turnoverMax: 500000,
      eligibleSectors: ['manufacturing', 'trading', 'services'],
      specialDocuments: ['Business plan', 'Project report'],
      schemeStartDate: new Date('2015-04-08'),
      isActive: true,
      schemeUrl: 'https://www.mudra.org.in',
      helplineNumber: '1800-180-1111'
    },
    
    {
      schemeCode: 'MUDRA_KISHORE',
      schemeName: 'Pradhan Mantri MUDRA Yojana - Kishore',
      schemeShortName: 'PMMY Kishore',
      schemeType: 'government',
      schemeCategory: 'msme',
      sponsoredBy: 'GOI',
      implementingAgency: 'MUDRA',
      maxLoanAmount: 500000,
      interestRateCap: 13.0,
      processingFeeWaiver: true,
      collateralFreeLimit: 500000,
      guaranteeCoveragePercent: 80.0,
      minTenureMonths: 24,
      maxTenureMonths: 84,
      targetGender: ['all'],
      targetCategories: ['general', 'SC', 'ST', 'OBC', 'minority'],
      businessVintageMinMonths: 6,
      turnoverMin: 50000,
      turnoverMax: 5000000,
      eligibleSectors: ['manufacturing', 'trading', 'services'],
      schemeStartDate: new Date('2015-04-08'),
      isActive: true,
      schemeUrl: 'https://www.mudra.org.in',
      helplineNumber: '1800-180-1111'
    },
    
    {
      schemeCode: 'MUDRA_TARUN',
      schemeName: 'Pradhan Mantri MUDRA Yojana - Tarun',
      schemeShortName: 'PMMY Tarun',
      schemeType: 'government',
      schemeCategory: 'msme',
      sponsoredBy: 'GOI',
      implementingAgency: 'MUDRA',
      maxLoanAmount: 1000000,
      interestRateCap: 14.0,
      processingFeeWaiver: false,
      collateralFreeLimit: 1000000,
      guaranteeCoveragePercent: 75.0,
      minTenureMonths: 36,
      maxTenureMonths: 84,
      targetGender: ['all'],
      targetCategories: ['general', 'SC', 'ST', 'OBC', 'minority'],
      businessVintageMinMonths: 12,
      turnoverMin: 500000,
      turnoverMax: 10000000,
      eligibleSectors: ['manufacturing', 'trading', 'services'],
      schemeStartDate: new Date('2015-04-08'),
      isActive: true,
      schemeUrl: 'https://www.mudra.org.in',
      helplineNumber: '1800-180-1111'
    },
    
    // Stand-Up India
    {
      schemeCode: 'STANDUP_INDIA',
      schemeName: 'Stand-Up India Scheme',
      schemeShortName: 'Stand-Up India',
      schemeType: 'government',
      schemeCategory: 'msme',
      sponsoredBy: 'GOI',
      implementingAgency: 'SIDBI',
      maxLoanAmount: 10000000,
      interestRateCap: 12.0,
      processingFeeWaiver: false,
      collateralFreeLimit: 1000000,
      guaranteeCoveragePercent: 85.0,
      minTenureMonths: 84,
      maxTenureMonths: 84,
      moratoriumMonths: 18,
      targetGender: ['female'],
      targetCategories: ['SC', 'ST', 'women'],
      businessVintageMinMonths: 0,
      turnoverMin: 1000000,
      turnoverMax: 100000000,
      eligibleSectors: ['manufacturing', 'services', 'trading'],
      specialDocuments: ['SC/ST certificate', 'Project report'],
      schemeStartDate: new Date('2016-04-05'),
      isActive: true,
      schemeUrl: 'https://www.standupmitra.in',
      helplineNumber: '1800-180-1111'
    }
  ];
  
  const insertedSchemes = await db.insert(easyLoansSchemes).values(schemes).returning();
  console.log(`[EasyLoans Seed] Inserted ${insertedSchemes.length} schemes`);
  
  return insertedSchemes;
}

async function linkProductsToSchemes(products: any[], schemes: any[]) {
  console.log('[EasyLoans Seed] Linking products to schemes...');
  
  const homeLoans = products.filter(p => p.loanType === 'home_loan');
  const businessLoans = products.filter(p => p.loanCategory === 'business');
  
  const pmayScheme = schemes.find(s => s.schemeCode === 'PMAY_CLSS');
  const mudraSchemes = schemes.filter(s => s.schemeCode.startsWith('MUDRA_'));
  const standupScheme = schemes.find(s => s.schemeCode === 'STANDUP_INDIA');
  
  const links = [];
  
  // Link home loans to PMAY
  if (pmayScheme) {
    for (const product of homeLoans) {
      links.push({
        productId: product.id,
        schemeId: pmayScheme.id,
        applicableRate: product.interestRateMin - pmayScheme.interestSubventionPercent,
        additionalBenefits: 'Interest subsidy on home loans for economically weaker sections',
        isActive: true
      });
    }
  }
  
  // Link business loans to MUDRA schemes
  for (const scheme of mudraSchemes) {
    for (const product of businessLoans) {
      if (product.maxLoanAmount >= scheme.maxLoanAmount) {
        links.push({
          productId: product.id,
          schemeId: scheme.id,
          applicableRate: Math.min(product.interestRateMin, scheme.interestRateCap),
          additionalBenefits: 'Collateral-free loan with CGFMU guarantee',
          isActive: true
        });
      }
    }
  }
  
  // Link business loans to Stand-Up India
  if (standupScheme) {
    for (const product of businessLoans) {
      if (product.maxLoanAmount >= standupScheme.maxLoanAmount / 2) {
        links.push({
          productId: product.id,
          schemeId: standupScheme.id,
          applicableRate: Math.min(product.interestRateMin, standupScheme.interestRateCap!),
          additionalBenefits: 'Special scheme for SC/ST/Women entrepreneurs',
          isActive: true
        });
      }
    }
  }
  
  if (links.length > 0) {
    const insertedLinks = await db.insert(easyLoansProductSchemes).values(links).returning();
    console.log(`[EasyLoans Seed] Linked ${insertedLinks.length} product-scheme combinations`);
  }
}

async function main() {
  try {
    console.log('[EasyLoans Seed] Starting seeding process...');
    
    const lenders = await seedLenders();
    const products = await seedProducts(lenders);
    const eligibility = await seedEligibility(products);
    const rateSlabs = await seedRateSlabs(products);
    const schemes = await seedSchemes();
    await linkProductsToSchemes(products, schemes);
    
    console.log('[EasyLoans Seed] ✅ Seeding completed successfully!');
    console.log(`[EasyLoans Seed] Summary:
  - Lenders: ${lenders.length}
  - Products: ${products.length}
  - Eligibility Criteria: ${eligibility.length}
  - Rate Slabs: ${rateSlabs.length}
  - Government Schemes: ${schemes.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('[EasyLoans Seed] ❌ Error during seeding:', error);
    process.exit(1);
  }
}

main();
