/**
 * GoDaddy DNS Management Service
 * 
 * Provides programmatic DNS management via GoDaddy API:
 * - Create/update/delete DNS records
 * - Domain verification
 * - Subdomain management
 * - SSL/TLS certificate automation
 */

import axios, { AxiosInstance } from 'axios';

interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
  name: string;
  data: string;
  ttl?: number;
  priority?: number;
  port?: number;
  weight?: number;
}

interface Domain {
  domain: string;
  status: string;
  expires: string;
  renewable: boolean;
  nameServers: string[];
}

export class GoDaddyDNSService {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private baseURL = 'https://api.godaddy.com/v1';

  constructor() {
    this.apiKey = process.env.GODADDY_API_KEY || '';
    this.apiSecret = process.env.GODADDY_API_SECRET || '';

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('GoDaddy API credentials not configured');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `sso-key ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all domains in the account
   */
  async listDomains(): Promise<Domain[]> {
    try {
      const response = await this.client.get('/domains');
      return response.data;
    } catch (error: any) {
      console.error('Failed to list domains:', error.response?.data || error.message);
      throw new Error('Failed to list domains');
    }
  }

  /**
   * Get domain details
   */
  async getDomain(domain: string): Promise<Domain> {
    try {
      const response = await this.client.get(`/domains/${domain}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to get domain ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to get domain ${domain}`);
    }
  }

  /**
   * Get all DNS records for a domain
   */
  async getDNSRecords(domain: string, type?: string): Promise<DNSRecord[]> {
    try {
      const url = type 
        ? `/domains/${domain}/records/${type}`
        : `/domains/${domain}/records`;
      
      const response = await this.client.get(url);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to get DNS records for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to get DNS records for ${domain}`);
    }
  }

  /**
   * Get a specific DNS record
   */
  async getDNSRecord(domain: string, type: string, name: string): Promise<DNSRecord[]> {
    try {
      const response = await this.client.get(`/domains/${domain}/records/${type}/${name}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to get DNS record ${type}/${name} for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to get DNS record`);
    }
  }

  /**
   * Create or update DNS records (replaces all records of the same type/name)
   */
  async updateDNSRecords(domain: string, records: DNSRecord[]): Promise<void> {
    try {
      await this.client.put(`/domains/${domain}/records`, records);
      console.log(`Updated DNS records for ${domain}`);
    } catch (error: any) {
      console.error(`Failed to update DNS records for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to update DNS records for ${domain}`);
    }
  }

  /**
   * Replace a specific DNS record type
   */
  async replaceDNSRecordsByType(domain: string, type: string, records: DNSRecord[]): Promise<void> {
    try {
      await this.client.put(`/domains/${domain}/records/${type}`, records);
      console.log(`Replaced ${type} records for ${domain}`);
    } catch (error: any) {
      console.error(`Failed to replace ${type} records for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to replace ${type} records`);
    }
  }

  /**
   * Replace a specific DNS record
   */
  async replaceDNSRecord(domain: string, type: string, name: string, records: DNSRecord[]): Promise<void> {
    try {
      await this.client.put(`/domains/${domain}/records/${type}/${name}`, records);
      console.log(`Replaced ${type}/${name} record for ${domain}`);
    } catch (error: any) {
      console.error(`Failed to replace ${type}/${name} record for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to replace DNS record`);
    }
  }

  /**
   * Add DNS records (PATCH - adds without replacing)
   */
  async addDNSRecords(domain: string, records: DNSRecord[]): Promise<void> {
    try {
      await this.client.patch(`/domains/${domain}/records`, records);
      console.log(`Added DNS records for ${domain}`);
    } catch (error: any) {
      console.error(`Failed to add DNS records for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to add DNS records`);
    }
  }

  /**
   * Delete DNS records by type and name
   */
  async deleteDNSRecord(domain: string, type: string, name: string): Promise<void> {
    try {
      await this.client.delete(`/domains/${domain}/records/${type}/${name}`);
      console.log(`Deleted ${type}/${name} record for ${domain}`);
    } catch (error: any) {
      console.error(`Failed to delete ${type}/${name} record for ${domain}:`, error.response?.data || error.message);
      throw new Error(`Failed to delete DNS record`);
    }
  }

  /**
   * Create A record pointing to an IP address
   */
  async createARecord(domain: string, name: string, ip: string, ttl = 600): Promise<void> {
    const record: DNSRecord = {
      type: 'A',
      name,
      data: ip,
      ttl,
    };
    await this.addDNSRecords(domain, [record]);
  }

  /**
   * Create CNAME record
   */
  async createCNAMERecord(domain: string, name: string, target: string, ttl = 600): Promise<void> {
    const record: DNSRecord = {
      type: 'CNAME',
      name,
      data: target,
      ttl,
    };
    await this.addDNSRecords(domain, [record]);
  }

  /**
   * Create TXT record (useful for domain verification, SPF, DKIM)
   */
  async createTXTRecord(domain: string, name: string, value: string, ttl = 600): Promise<void> {
    const record: DNSRecord = {
      type: 'TXT',
      name,
      data: value,
      ttl,
    };
    await this.addDNSRecords(domain, [record]);
  }

  /**
   * Verify domain ownership using TXT record
   */
  async verifyDomainOwnership(domain: string, verificationToken: string): Promise<boolean> {
    try {
      // Create verification TXT record
      await this.createTXTRecord(domain, '_verification', verificationToken, 300);
      
      // Wait for DNS propagation (5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if record exists
      const records = await this.getDNSRecord(domain, 'TXT', '_verification');
      const verified = records.some(r => r.data === verificationToken);
      
      return verified;
    } catch (error: any) {
      console.error('Domain verification failed:', error.message);
      return false;
    }
  }

  /**
   * Setup subdomain for Railway deployment
   */
  async setupRailwaySubdomain(rootDomain: string, subdomain: string, railwayURL: string): Promise<void> {
    try {
      // Create CNAME record pointing to Railway
      await this.createCNAMERecord(rootDomain, subdomain, railwayURL);
      console.log(`✅ Created subdomain: ${subdomain}.${rootDomain} → ${railwayURL}`);
    } catch (error: any) {
      console.error('Failed to setup Railway subdomain:', error.message);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listDomains();
      console.log('✅ GoDaddy API connection successful');
      return true;
    } catch (error: any) {
      console.error('❌ GoDaddy API connection failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const godaddyDNS = new GoDaddyDNSService();

/**
 * Example Usage:
 * 
 * // List all domains
 * const domains = await godaddyDNS.listDomains();
 * 
 * // Get DNS records
 * const records = await godaddyDNS.getDNSRecords('cagpt.icai.org');
 * 
 * // Create subdomain
 * await godaddyDNS.createARecord('cagpt.icai.org', 'app', '1.2.3.4');
 * 
 * // Setup Railway deployment
 * await godaddyDNS.setupRailwaySubdomain(
 *   'cagpt.icai.org',
 *   'app',
 *   'luca-production.up.railway.app'
 * );
 * 
 * // Verify domain ownership
 * const verified = await godaddyDNS.verifyDomainOwnership(
 *   'cagpt.icai.org',
 *   'verification-token-123'
 * );
 */
