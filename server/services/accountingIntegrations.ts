import { encryptApiKey, decryptApiKey } from "../utils/encryption";

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dataCenterLocation: string;
}

export class AccountingIntegrationService {
  
  /**
   * QuickBooks OAuth - Get authorization URL
   */
  static getQuickBooksAuthUrl(config: QuickBooksConfig, state: string): string {
    const baseUrl = config.environment === 'production'
      ? 'https://appcenter.intuit.com/connect/oauth2'
      : 'https://appcenter.intuit.com/connect/oauth2';
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state: state,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * QuickBooks - Exchange authorization code for tokens
   */
  static async exchangeQuickBooksCode(
    config: QuickBooksConfig,
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenUrl = config.environment === 'production'
      ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
      : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange QuickBooks authorization code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Xero OAuth - Get authorization URL
   */
  static getXeroAuthUrl(config: XeroConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings',
      state: state,
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  /**
   * Xero - Exchange authorization code for tokens
   */
  static async exchangeXeroCode(
    config: XeroConfig,
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Xero authorization code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Zoho OAuth - Get authorization URL
   */
  static getZohoAuthUrl(config: ZohoConfig, state: string): string {
    const baseUrl = `https://accounts.zoho.${config.dataCenterLocation}`;
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'ZohoBooks.fullaccess.all',
      state: state,
      access_type: 'offline',
    });

    return `${baseUrl}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Zoho - Exchange authorization code for tokens
   */
  static async exchangeZohoCode(
    config: ZohoConfig,
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenUrl = `https://accounts.zoho.${config.dataCenterLocation}/oauth/v2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code: code,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Zoho authorization code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * ADP - Get authorization URL
   */
  static getADPAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.ADP_CLIENT_ID || 'demo-adp-client-id';
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state,
      scope: 'openid profile email adp_workforce_now_api',
    });

    return `https://accounts.adp.com/auth/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * ADP - Exchange authorization code for tokens
   */
  static async exchangeADPCode(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const clientId = process.env.ADP_CLIENT_ID || 'demo-adp-client-id';
    const clientSecret = process.env.ADP_CLIENT_SECRET || 'demo-adp-client-secret';
    
    const tokenUrl = 'https://accounts.adp.com/auth/oauth/v2/token';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange ADP authorization code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  /**
   * ADP - Fetch company/worker information
   */
  static async fetchADPCompanyInfo(accessToken: string): Promise<{ companyId: string; companyName: string }> {
    try {
      const response = await fetch('https://api.adp.com/hr/v2/workers', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          companyId: 'adp-company',
          companyName: 'ADP Company'
        };
      }

      const data = await response.json();
      return {
        companyId: data.companyId || 'adp-company',
        companyName: data.companyName || 'ADP Company'
      };
    } catch (error) {
      return {
        companyId: 'adp-company',
        companyName: 'ADP Company'
      };
    }
  }

  /**
   * Refresh QuickBooks access token
   */
  static async refreshQuickBooksToken(
    config: QuickBooksConfig,
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh QuickBooks token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Fetch company information from QuickBooks
   */
  static async getQuickBooksCompanyInfo(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production'
  ): Promise<{ name: string; id: string }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch QuickBooks company info');
    }

    const data = await response.json();
    return {
      name: data.CompanyInfo?.CompanyName || 'Unknown',
      id: realmId,
    };
  }

  /**
   * QuickBooks - Get Trial Balance Report
   */
  static async getQuickBooksTrialBalance(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { startDate?: string; endDate?: string; accountingMethod?: 'Cash' | 'Accrual' }
  ): Promise<{
    reportName: string;
    reportDate: string;
    accounts: Array<{ name: string; accountType: string; debit: number; credit: number; balance: number }>;
    totals: { totalDebit: number; totalCredit: number };
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const params = new URLSearchParams();
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);
    if (options?.accountingMethod) params.append('accounting_method', options.accountingMethod);

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/reports/TrialBalance?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Trial Balance: ${errorText}`);
    }

    const data = await response.json();
    const rows = data.Rows?.Row || [];
    
    const accounts: Array<{ name: string; accountType: string; debit: number; credit: number; balance: number }> = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        const cols = row.ColData;
        const debit = parseFloat(cols[1]?.value || '0');
        const credit = parseFloat(cols[2]?.value || '0');
        accounts.push({
          name: cols[0]?.value || 'Unknown',
          accountType: row.group || 'Other',
          debit,
          credit,
          balance: debit - credit
        });
        totalDebit += debit;
        totalCredit += credit;
      }
    }

    return {
      reportName: 'Trial Balance',
      reportDate: options?.endDate || new Date().toISOString().split('T')[0],
      accounts,
      totals: { totalDebit, totalCredit }
    };
  }

  /**
   * QuickBooks - Get Profit and Loss Report
   */
  static async getQuickBooksProfitAndLoss(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { startDate?: string; endDate?: string; accountingMethod?: 'Cash' | 'Accrual' }
  ): Promise<{
    reportName: string;
    period: { start: string; end: string };
    income: Array<{ name: string; amount: number }>;
    expenses: Array<{ name: string; amount: number }>;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const params = new URLSearchParams();
    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);
    if (options?.accountingMethod) params.append('accounting_method', options.accountingMethod);

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/reports/ProfitAndLoss?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Profit and Loss: ${errorText}`);
    }

    const data = await response.json();
    const rows = data.Rows?.Row || [];
    
    const income: Array<{ name: string; amount: number }> = [];
    const expenses: Array<{ name: string; amount: number }> = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let currentSection = '';

    for (const row of rows) {
      if (row.type === 'Section' && row.Header) {
        currentSection = row.Header.ColData?.[0]?.value || '';
      }
      if (row.type === 'Data' && row.ColData) {
        const name = row.ColData[0]?.value || 'Unknown';
        const amount = parseFloat(row.ColData[1]?.value || '0');
        
        if (currentSection.toLowerCase().includes('income')) {
          income.push({ name, amount });
          totalIncome += amount;
        } else if (currentSection.toLowerCase().includes('expense')) {
          expenses.push({ name, amount });
          totalExpenses += amount;
        }
      }
    }

    return {
      reportName: 'Profit and Loss',
      period: {
        start: options?.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: options?.endDate || new Date().toISOString().split('T')[0]
      },
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses
    };
  }

  /**
   * QuickBooks - Get Balance Sheet Report
   */
  static async getQuickBooksBalanceSheet(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { asOfDate?: string; accountingMethod?: 'Cash' | 'Accrual' }
  ): Promise<{
    reportName: string;
    asOfDate: string;
    assets: Array<{ name: string; amount: number; category: string }>;
    liabilities: Array<{ name: string; amount: number; category: string }>;
    equity: Array<{ name: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const params = new URLSearchParams();
    if (options?.asOfDate) params.append('date_macro', options.asOfDate);
    if (options?.accountingMethod) params.append('accounting_method', options.accountingMethod);

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/reports/BalanceSheet?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Balance Sheet: ${errorText}`);
    }

    const data = await response.json();
    const rows = data.Rows?.Row || [];
    
    const assets: Array<{ name: string; amount: number; category: string }> = [];
    const liabilities: Array<{ name: string; amount: number; category: string }> = [];
    const equity: Array<{ name: string; amount: number }> = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let currentSection = '';
    let currentCategory = '';

    const processRows = (rows: any[]) => {
      for (const row of rows) {
        if (row.type === 'Section' && row.Header) {
          const headerName = row.Header.ColData?.[0]?.value || '';
          if (headerName.toLowerCase().includes('asset')) {
            currentSection = 'assets';
            currentCategory = headerName;
          } else if (headerName.toLowerCase().includes('liabilit')) {
            currentSection = 'liabilities';
            currentCategory = headerName;
          } else if (headerName.toLowerCase().includes('equity')) {
            currentSection = 'equity';
          }
          if (row.Rows?.Row) {
            processRows(row.Rows.Row);
          }
        }
        if (row.type === 'Data' && row.ColData) {
          const name = row.ColData[0]?.value || 'Unknown';
          const amount = parseFloat(row.ColData[1]?.value || '0');
          
          if (currentSection === 'assets') {
            assets.push({ name, amount, category: currentCategory });
            totalAssets += amount;
          } else if (currentSection === 'liabilities') {
            liabilities.push({ name, amount, category: currentCategory });
            totalLiabilities += amount;
          } else if (currentSection === 'equity') {
            equity.push({ name, amount });
            totalEquity += amount;
          }
        }
      }
    };

    processRows(rows);

    return {
      reportName: 'Balance Sheet',
      asOfDate: options?.asOfDate || new Date().toISOString().split('T')[0],
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity
    };
  }

  /**
   * QuickBooks - Get Customer List
   */
  static async getQuickBooksCustomers(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { maxResults?: number; startPosition?: number }
  ): Promise<{
    customers: Array<{
      id: string;
      displayName: string;
      companyName?: string;
      email?: string;
      phone?: string;
      balance: number;
      active: boolean;
    }>;
    totalCount: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const maxResults = options?.maxResults || 100;
    const startPosition = options?.startPosition || 1;
    const query = encodeURIComponent(`SELECT * FROM Customer MAXRESULTS ${maxResults} STARTPOSITION ${startPosition}`);

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${query}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch customers: ${errorText}`);
    }

    const data = await response.json();
    const qbCustomers = data.QueryResponse?.Customer || [];

    return {
      customers: qbCustomers.map((c: any) => ({
        id: c.Id,
        displayName: c.DisplayName,
        companyName: c.CompanyName,
        email: c.PrimaryEmailAddr?.Address,
        phone: c.PrimaryPhone?.FreeFormNumber,
        balance: c.Balance || 0,
        active: c.Active !== false
      })),
      totalCount: data.QueryResponse?.totalCount || qbCustomers.length
    };
  }

  /**
   * QuickBooks - Get Vendor List
   */
  static async getQuickBooksVendors(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { maxResults?: number; startPosition?: number }
  ): Promise<{
    vendors: Array<{
      id: string;
      displayName: string;
      companyName?: string;
      email?: string;
      phone?: string;
      balance: number;
      active: boolean;
    }>;
    totalCount: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const maxResults = options?.maxResults || 100;
    const startPosition = options?.startPosition || 1;
    const query = encodeURIComponent(`SELECT * FROM Vendor MAXRESULTS ${maxResults} STARTPOSITION ${startPosition}`);

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${query}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch vendors: ${errorText}`);
    }

    const data = await response.json();
    const qbVendors = data.QueryResponse?.Vendor || [];

    return {
      vendors: qbVendors.map((v: any) => ({
        id: v.Id,
        displayName: v.DisplayName,
        companyName: v.CompanyName,
        email: v.PrimaryEmailAddr?.Address,
        phone: v.PrimaryPhone?.FreeFormNumber,
        balance: v.Balance || 0,
        active: v.Active !== false
      })),
      totalCount: data.QueryResponse?.totalCount || qbVendors.length
    };
  }

  /**
   * QuickBooks - Get Recent Invoices
   */
  static async getQuickBooksInvoices(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production',
    options?: { startDate?: string; endDate?: string; maxResults?: number }
  ): Promise<{
    invoices: Array<{
      id: string;
      docNumber: string;
      customerName: string;
      txnDate: string;
      dueDate: string;
      totalAmount: number;
      balance: number;
      status: 'Paid' | 'Open' | 'Overdue';
    }>;
    totalCount: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const maxResults = options?.maxResults || 100;
    let query = `SELECT * FROM Invoice`;
    if (options?.startDate) {
      query += ` WHERE TxnDate >= '${options.startDate}'`;
      if (options?.endDate) {
        query += ` AND TxnDate <= '${options.endDate}'`;
      }
    }
    query += ` MAXRESULTS ${maxResults}`;

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch invoices: ${errorText}`);
    }

    const data = await response.json();
    const qbInvoices = data.QueryResponse?.Invoice || [];
    const today = new Date();

    return {
      invoices: qbInvoices.map((inv: any) => {
        const balance = inv.Balance || 0;
        const dueDate = new Date(inv.DueDate);
        let status: 'Paid' | 'Open' | 'Overdue' = 'Open';
        if (balance === 0) status = 'Paid';
        else if (dueDate < today) status = 'Overdue';

        return {
          id: inv.Id,
          docNumber: inv.DocNumber || '',
          customerName: inv.CustomerRef?.name || 'Unknown',
          txnDate: inv.TxnDate,
          dueDate: inv.DueDate,
          totalAmount: inv.TotalAmt || 0,
          balance,
          status
        };
      }),
      totalCount: data.QueryResponse?.totalCount || qbInvoices.length
    };
  }

  /**
   * QuickBooks - Get Chart of Accounts
   */
  static async getQuickBooksAccounts(
    accessToken: string,
    realmId: string,
    environment: 'sandbox' | 'production'
  ): Promise<{
    accounts: Array<{
      id: string;
      name: string;
      accountType: string;
      accountSubType: string;
      currentBalance: number;
      active: boolean;
      classification: string;
    }>;
    totalCount: number;
  }> {
    const baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');

    const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${query}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch accounts: ${errorText}`);
    }

    const data = await response.json();
    const qbAccounts = data.QueryResponse?.Account || [];

    return {
      accounts: qbAccounts.map((acc: any) => ({
        id: acc.Id,
        name: acc.Name,
        accountType: acc.AccountType,
        accountSubType: acc.AccountSubType || '',
        currentBalance: acc.CurrentBalance || 0,
        active: acc.Active !== false,
        classification: acc.Classification || ''
      })),
      totalCount: data.QueryResponse?.totalCount || qbAccounts.length
    };
  }

  /**
   * Xero - Get Trial Balance
   */
  static async getXeroTrialBalance(
    accessToken: string,
    tenantId: string,
    options?: { date?: string }
  ): Promise<{
    reportName: string;
    reportDate: string;
    accounts: Array<{ name: string; accountCode: string; debit: number; credit: number }>;
    totals: { totalDebit: number; totalCredit: number };
  }> {
    const dateParam = options?.date || new Date().toISOString().split('T')[0];
    
    const response = await fetch(`https://api.xero.com/api.xro/2.0/Reports/TrialBalance?date=${dateParam}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Xero Trial Balance: ${errorText}`);
    }

    const data = await response.json();
    const report = data.Reports?.[0] || {};
    const rows = report.Rows || [];
    
    const accounts: Array<{ name: string; accountCode: string; debit: number; credit: number }> = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const section of rows) {
      if (section.RowType === 'Section' && section.Rows) {
        for (const row of section.Rows) {
          if (row.RowType === 'Row' && row.Cells) {
            const cells = row.Cells;
            const debit = parseFloat(cells[1]?.Value || '0');
            const credit = parseFloat(cells[2]?.Value || '0');
            accounts.push({
              name: cells[0]?.Value || 'Unknown',
              accountCode: cells[0]?.Attributes?.[0]?.Value || '',
              debit,
              credit
            });
            totalDebit += debit;
            totalCredit += credit;
          }
        }
      }
    }

    return {
      reportName: 'Trial Balance',
      reportDate: dateParam,
      accounts,
      totals: { totalDebit, totalCredit }
    };
  }

  /**
   * Xero - Get Profit and Loss
   */
  static async getXeroProfitAndLoss(
    accessToken: string,
    tenantId: string,
    options?: { fromDate?: string; toDate?: string }
  ): Promise<{
    reportName: string;
    period: { start: string; end: string };
    income: Array<{ name: string; amount: number }>;
    expenses: Array<{ name: string; amount: number }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  }> {
    const params = new URLSearchParams();
    if (options?.fromDate) params.append('fromDate', options.fromDate);
    if (options?.toDate) params.append('toDate', options.toDate);

    const response = await fetch(`https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Xero P&L: ${errorText}`);
    }

    const data = await response.json();
    const report = data.Reports?.[0] || {};
    const rows = report.Rows || [];

    const income: Array<{ name: string; amount: number }> = [];
    const expenses: Array<{ name: string; amount: number }> = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let netProfit = 0;
    let currentSection = '';

    for (const section of rows) {
      if (section.RowType === 'Section') {
        currentSection = section.Title || '';
        if (section.Rows) {
          for (const row of section.Rows) {
            if (row.RowType === 'Row' && row.Cells) {
              const name = row.Cells[0]?.Value || 'Unknown';
              const amount = parseFloat(row.Cells[1]?.Value || '0');
              
              if (currentSection.toLowerCase().includes('income') || currentSection.toLowerCase().includes('revenue')) {
                income.push({ name, amount });
                totalIncome += amount;
              } else if (currentSection.toLowerCase().includes('expense') || currentSection.toLowerCase().includes('cost')) {
                expenses.push({ name, amount });
                totalExpenses += amount;
              }
            }
            if (row.RowType === 'SummaryRow' && row.Cells?.[0]?.Value?.toLowerCase().includes('net profit')) {
              netProfit = parseFloat(row.Cells[1]?.Value || '0');
            }
          }
        }
      }
    }

    return {
      reportName: 'Profit and Loss',
      period: {
        start: options?.fromDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: options?.toDate || new Date().toISOString().split('T')[0]
      },
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit: netProfit || (totalIncome - totalExpenses)
    };
  }

  /**
   * Encrypt tokens before storing
   */
  static encryptTokens(accessToken: string, refreshToken?: string): {
    encryptedAccessToken: string;
    encryptedRefreshToken?: string;
  } {
    return {
      encryptedAccessToken: encryptApiKey(accessToken),
      encryptedRefreshToken: refreshToken ? encryptApiKey(refreshToken) : undefined,
    };
  }

  /**
   * Decrypt tokens for use
   */
  static decryptTokens(encryptedAccessToken: string, encryptedRefreshToken?: string): {
    accessToken: string;
    refreshToken?: string;
  } {
    return {
      accessToken: decryptApiKey(encryptedAccessToken),
      refreshToken: encryptedRefreshToken ? decryptApiKey(encryptedRefreshToken) : undefined,
    };
  }
}
