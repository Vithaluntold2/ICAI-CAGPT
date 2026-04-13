import { spawn } from 'child_process';
import { storage } from '../pgStorage';
import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectTaggingCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export interface VirusScanResult {
  clean: boolean;
  infected: boolean;
  details?: string;
  threats?: string[];
  scanProvider?: string;
  scanDuration?: number;
}

/**
 * Virus Scanning Service - PRODUCTION IMPLEMENTATION
 * Supports multiple scanning engines with real integrations:
 * - ClamAV: Local antivirus (free, requires installation)
 * - VirusTotal: Cloud-based multi-engine scanning (requires API key)
 * - AWS: S3 Malware Protection via GuardDuty (requires AWS setup)
 */
export class VirusScanService {
  private static scanProvider: 'clamav' | 'virustotal' | 'aws' = 
    (process.env.VIRUS_SCAN_PROVIDER as any) || 'clamav';
  
  private static s3Client: S3Client | null = null;
  private static readonly AWS_SCAN_BUCKET = process.env.AWS_VIRUS_SCAN_BUCKET;
  private static readonly AWS_REGION = process.env.AWS_REGION || 'us-east-1';

  /**
   * Scan a file for viruses
   */
  static async scanFile(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now();
    
    try {
      let result: VirusScanResult;
      
      switch (this.scanProvider) {
        case 'clamav':
          result = await this.scanWithClamAV(filePath);
          break;
        case 'virustotal':
          result = await this.scanWithVirusTotal(filePath);
          break;
        case 'aws':
          result = await this.scanWithAWS(filePath);
          break;
        default:
          console.warn(`[VirusScan] Unknown provider: ${this.scanProvider}, defaulting to ClamAV`);
          result = await this.scanWithClamAV(filePath);
      }
      
      result.scanProvider = this.scanProvider;
      result.scanDuration = Date.now() - startTime;
      
      return result;
      
    } catch (error) {
      console.error('[VirusScan] Scan failed:', error);
      return {
        clean: false,
        infected: false,
        details: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        scanProvider: this.scanProvider,
        scanDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Scan file using ClamAV (clamscan command)
   * Requires ClamAV to be installed: brew install clamav (macOS) or apt install clamav (Linux)
   */
  private static async scanWithClamAV(filePath: string): Promise<VirusScanResult> {
    return new Promise((resolve) => {
      // Check if file exists
      fs.access(filePath).catch(() => {
        return resolve({
          clean: false,
          infected: false,
          details: 'File not found'
        });
      });

      const clamscan = spawn('clamscan', ['--no-summary', filePath]);
      let stdout = '';
      let stderr = '';

      clamscan.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      clamscan.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      clamscan.on('close', (code) => {
        // ClamAV exit codes: 0 = clean, 1 = infected, 2 = error
        if (code === 0) {
          resolve({
            clean: true,
            infected: false,
            details: 'File is clean'
          });
        } else if (code === 1) {
          // Extract virus names from output
          const threats = stdout.match(/FOUND$/gm)?.map(line => 
            line.split(':')[1]?.trim()
          ).filter(Boolean) || [];
          
          resolve({
            clean: false,
            infected: true,
            details: stdout.trim(),
            threats
          });
        } else {
          // ClamAV not installed or error
          console.warn('[VirusScan] ClamAV error:', stderr);
          resolve({
            clean: false,
            infected: false,
            details: `ClamAV error (code ${code}): ${stderr || 'ClamAV may not be installed'}`
          });
        }
      });

      clamscan.on('error', (error) => {
        console.error('[VirusScan] ClamAV spawn error:', error);
        resolve({
          clean: false,
          infected: false,
          details: 'ClamAV not available. Please install ClamAV or configure alternative scan provider.'
        });
      });
    });
  }

  /**
   * Scan file using VirusTotal API - REAL IMPLEMENTATION
   * Requires: VIRUSTOTAL_API_KEY environment variable
   */
  private static async scanWithVirusTotal(filePath: string): Promise<VirusScanResult> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    
    if (!apiKey) {
      return {
        clean: false,
        infected: false,
        details: 'VirusTotal API key not configured. Set VIRUSTOTAL_API_KEY environment variable.'
      };
    }

    try {
      const fileBuffer = await fs.readFile(filePath);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), path.basename(filePath));

      console.log('[VirusScan] Uploading file to VirusTotal...');
      
      // Upload file
      const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
        method: 'POST',
        headers: {
          'x-apikey': apiKey
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`VirusTotal upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      const analysisId = uploadData.data.id;

      console.log(`[VirusScan] VirusTotal analysis ID: ${analysisId}`);

      // Wait and check analysis results (polling with timeout)
      let attempts = 0;
      const maxAttempts = 60; // 10 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const analysisResponse = await fetch(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          {
            headers: { 'x-apikey': apiKey }
          }
        );

        if (!analysisResponse.ok) {
          throw new Error(`VirusTotal analysis check failed: ${analysisResponse.status}`);
        }

        const analysisData = await analysisResponse.json();
        
        if (analysisData.data.attributes.status === 'completed') {
          const stats = analysisData.data.attributes.stats;
          const malicious = stats.malicious || 0;
          const suspicious = stats.suspicious || 0;
          const totalEngines = stats.harmless + stats.undetected + malicious + suspicious;
          
          // Collect threat names
          const threats: string[] = [];
          const results = analysisData.data.attributes.results || {};
          for (const [engine, result] of Object.entries(results) as any) {
            if (result.category === 'malicious' || result.category === 'suspicious') {
              threats.push(`${engine}: ${result.result}`);
            }
          }
          
          return {
            clean: malicious === 0 && suspicious === 0,
            infected: malicious > 0,
            details: `Scanned by ${totalEngines} engines. ${malicious} malicious, ${suspicious} suspicious detections.`,
            threats: threats.length > 0 ? threats : undefined
          };
        }
        
        attempts++;
        console.log(`[VirusScan] VirusTotal analysis in progress... (attempt ${attempts}/${maxAttempts})`);
      }

      return {
        clean: false,
        infected: false,
        details: 'VirusTotal scan timeout after 10 minutes'
      };
      
    } catch (error) {
      return {
        clean: false,
        infected: false,
        details: `VirusTotal scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scan file using AWS S3 Malware Protection - REAL IMPLEMENTATION
   * 
   * Prerequisites:
   * 1. Enable GuardDuty Malware Protection in AWS Console
   * 2. Create an S3 bucket with malware protection enabled
   * 3. Configure environment variables:
   *    - AWS_VIRUS_SCAN_BUCKET: S3 bucket name
   *    - AWS_REGION: AWS region
   *    - AWS credentials (via env vars, IAM role, or credentials file)
   */
  private static async scanWithAWS(filePath: string): Promise<VirusScanResult> {
    if (!this.AWS_SCAN_BUCKET) {
      return {
        clean: false,
        infected: false,
        details: 'AWS virus scan bucket not configured. Set AWS_VIRUS_SCAN_BUCKET environment variable.'
      };
    }

    try {
      // Initialize S3 client if not already done
      if (!this.s3Client) {
        this.s3Client = new S3Client({ region: this.AWS_REGION });
      }

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      
      // Generate unique key for this scan
      const scanId = crypto.randomUUID();
      const s3Key = `virus-scan/${scanId}/${fileName}`;

      console.log(`[VirusScan] Uploading to S3 for malware scan: s3://${this.AWS_SCAN_BUCKET}/${s3Key}`);

      // Upload to S3 (GuardDuty will automatically scan)
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.AWS_SCAN_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        // Enable server-side encryption
        ServerSideEncryption: 'AES256',
        // Add metadata for tracking
        Metadata: {
          'scan-id': scanId,
          'original-filename': fileName,
          'scan-timestamp': new Date().toISOString()
        }
      }));

      console.log('[VirusScan] File uploaded. Waiting for GuardDuty scan...');

      // Poll for scan results via object tagging
      // GuardDuty adds tags like: GuardDutyMalwareScanStatus, GuardDutyMalwareScanStatusReason
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max (10s intervals)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        try {
          const taggingResponse = await this.s3Client.send(new GetObjectTaggingCommand({
            Bucket: this.AWS_SCAN_BUCKET,
            Key: s3Key
          }));

          const tags = taggingResponse.TagSet || [];
          const statusTag = tags.find(t => t.Key === 'GuardDutyMalwareScanStatus');
          const reasonTag = tags.find(t => t.Key === 'GuardDutyMalwareScanStatusReason');
          
          if (statusTag?.Value) {
            // Clean up the scanned file
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: this.AWS_SCAN_BUCKET,
              Key: s3Key
            }));

            switch (statusTag.Value) {
              case 'NO_THREATS_FOUND':
                return {
                  clean: true,
                  infected: false,
                  details: 'AWS GuardDuty: No threats found'
                };
                
              case 'THREATS_FOUND':
                return {
                  clean: false,
                  infected: true,
                  details: `AWS GuardDuty: Threats detected - ${reasonTag?.Value || 'Unknown threat'}`,
                  threats: reasonTag?.Value ? [reasonTag.Value] : undefined
                };
                
              case 'UNSUPPORTED':
                return {
                  clean: false,
                  infected: false,
                  details: 'AWS GuardDuty: File type not supported for scanning'
                };
                
              case 'ACCESS_DENIED':
                return {
                  clean: false,
                  infected: false,
                  details: 'AWS GuardDuty: Access denied - check IAM permissions'
                };
                
              default:
                return {
                  clean: false,
                  infected: false,
                  details: `AWS GuardDuty: Unknown status - ${statusTag.Value}`
                };
            }
          }
          
        } catch (tagError: any) {
          // Tagging might not be available yet, continue polling
          if (tagError.name !== 'NoSuchKey') {
            console.warn('[VirusScan] Error checking tags:', tagError.message);
          }
        }
        
        attempts++;
        console.log(`[VirusScan] Waiting for GuardDuty scan... (attempt ${attempts}/${maxAttempts})`);
      }

      // Timeout - clean up and return
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.AWS_SCAN_BUCKET,
          Key: s3Key
        }));
      } catch (cleanupError) {
        console.warn('[VirusScan] Failed to cleanup scan file:', cleanupError);
      }

      return {
        clean: false,
        infected: false,
        details: 'AWS GuardDuty scan timeout. File may not be scanned or GuardDuty is not enabled.'
      };

    } catch (error: any) {
      if (error.name === 'CredentialsProviderError') {
        return {
          clean: false,
          infected: false,
          details: 'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
        };
      }
      
      return {
        clean: false,
        infected: false,
        details: `AWS scan failed: ${error.message}`
      };
    }
  }

  /**
   * Background job to scan all pending files
   */
  static async scanPendingFiles(): Promise<void> {
    // Prevent concurrent scans
    if (this.isScanning) {
      console.log('[VirusScan] Scan already in progress, skipping...');
      return;
    }

    this.isScanning = true;
    
    try {
      const pendingFiles = await storage.getTaxFilesByStatus('pending');
      
      // Skip if no files to scan - silent to reduce log noise
      if (pendingFiles.length === 0) {
        return; // Don't log when idle
      }
      
      console.log(`[VirusScan] Starting scan for ${pendingFiles.length} pending files...`);
      
      // Process files with delays to avoid hammering DB
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        try {
          // Update to scanning status
          await storage.updateTaxFileStatus(file.id, 'scanning', null);
          
          // Scan the file
          const result = await this.scanFile(file.storageKey);
          
          // Update status based on result
          if (result.clean) {
            await storage.updateTaxFileStatus(file.id, 'clean', {
              scannedAt: new Date().toISOString(),
              scanProvider: result.scanProvider,
              scanDuration: result.scanDuration,
              details: result.details
            });
            console.log(`[VirusScan] ✓ File ${file.id} is clean (${result.scanDuration}ms)`);
            
          } else if (result.infected) {
            await storage.updateTaxFileStatus(file.id, 'infected', {
              scannedAt: new Date().toISOString(),
              scanProvider: result.scanProvider,
              scanDuration: result.scanDuration,
              threats: result.threats,
              details: result.details
            });
            console.warn(`[VirusScan] ⚠ File ${file.id} is INFECTED:`, result.threats);
            
            // Alert admins about infected file
            await this.alertAdminsInfectedFile(file, result);
            
            // Quarantine the infected file
            await this.quarantineFile(file);
            
          } else {
            // Scan failed
            await storage.updateTaxFileStatus(file.id, 'failed', {
              scannedAt: new Date().toISOString(),
              scanProvider: result.scanProvider,
              scanDuration: result.scanDuration,
              details: result.details
            });
            console.error(`[VirusScan] ✗ Scan failed for file ${file.id}:`, result.details);
          }
          
          // Add small delay between files to avoid overwhelming DB
          if (i < pendingFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`[VirusScan] Error scanning file ${file.id}:`, error);
          try {
            await storage.updateTaxFileStatus(file.id, 'failed', {
              scannedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          } catch (dbError) {
            // If DB update fails, just log it - don't cascade errors
            console.error(`[VirusScan] Failed to update file status in DB:`, dbError);
          }
        }
      }
      
      console.log('[VirusScan] Scanning complete');
    } catch (error) {
      // Only log non-connection errors
      if (error instanceof Error && !error.message.includes('ECONNRESET')) {
        console.error('[VirusScan] Error in scanPendingFiles:', error.message);
      }
    } finally {
      this.isScanning = false;
    }
  }
  
  private static isScanning = false;

  /**
   * Alert admins about an infected file
   */
  private static async alertAdminsInfectedFile(file: any, scanResult: VirusScanResult): Promise<void> {
    try {
      // Get admin users
      // TODO: Implement getUsersByRole
      // const admins = await storage.getUsersByRole('admin');
      const admins: any[] = []; // Placeholder
      
      if (admins.length === 0) {
        console.warn('[VirusScan] No admin users found to alert');
        return;
      }
      
      // Create alert/notification for each admin
      const alertMessage = {
        type: 'security_alert',
        severity: 'critical',
        title: 'Infected File Detected',
        message: `File "${file.filename}" (ID: ${file.id}) was detected as infected.`,
        details: {
          fileId: file.id,
          filename: file.filename,
          uploadedBy: file.userId,
          uploadedAt: file.createdAt,
          threats: scanResult.threats,
          scanProvider: scanResult.scanProvider
        },
        createdAt: new Date().toISOString()
      };
      
      // Log critical security event
      console.error('[SECURITY ALERT] Infected file detected:', alertMessage);
      
      // In a production system, you would also:
      // - Send email notifications
      // - Send Slack/Teams alerts
      // - Create a ticket in your incident management system
      // - Log to SIEM
      
      // For now, create an in-app notification if the method exists
      // TODO: Implement createNotification
      /*
      if (typeof storage.createNotification === 'function') {
        for (const admin of admins) {
          await storage.createNotification({...});
        }
      }
      */
      
    } catch (error) {
      console.error('[VirusScan] Failed to alert admins:', error);
    }
  }

  /**
   * Quarantine an infected file
   */
  private static async quarantineFile(file: any): Promise<void> {
    try {
      const quarantineDir = process.env.QUARANTINE_DIR || './quarantine';
      
      // Ensure quarantine directory exists
      await fs.mkdir(quarantineDir, { recursive: true });
      
      // Generate quarantine filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const quarantineFilename = `${timestamp}_${file.id}_${file.filename}.quarantined`;
      const quarantinePath = path.join(quarantineDir, quarantineFilename);
      
      // Move file to quarantine
      const originalPath = file.storageKey;
      
      try {
        await fs.rename(originalPath, quarantinePath);
        console.log(`[VirusScan] File quarantined: ${quarantinePath}`);
      } catch (moveError) {
        // If rename fails (cross-device), copy and delete
        await fs.copyFile(originalPath, quarantinePath);
        await fs.unlink(originalPath);
        console.log(`[VirusScan] File quarantined (copy): ${quarantinePath}`);
      }
      
      // Update file record
      // TODO: Implement updateTaxFile
      // await storage.updateTaxFile(file.id, {...});
      
    } catch (error) {
      console.error('[VirusScan] Failed to quarantine file:', error);
      // Don't throw - the file is already marked as infected
    }
  }

  /**
   * Start periodic scanning of pending files
   */
  static startPeriodicScanning(intervalMinutes: number = 5): NodeJS.Timeout {
    console.log(`[VirusScan] Starting periodic scanning every ${intervalMinutes} minutes...`);
    
    // Run immediately
    this.scanPendingFiles();
    
    // Then run periodically
    return setInterval(() => {
      this.scanPendingFiles();
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * Get current scan provider
   */
  static getProvider(): string {
    return this.scanProvider;
  }
  
  /**
   * Health check for virus scanning
   */
  static async healthCheck(): Promise<{ healthy: boolean; provider: string; error?: string }> {
    try {
      switch (this.scanProvider) {
        case 'clamav':
          // Check if clamscan is available
          return new Promise((resolve) => {
            const check = spawn('clamscan', ['--version']);
            check.on('close', (code) => {
              resolve({
                healthy: code === 0,
                provider: 'clamav',
                error: code !== 0 ? 'ClamAV not installed or not accessible' : undefined
              });
            });
            check.on('error', () => {
              resolve({
                healthy: false,
                provider: 'clamav',
                error: 'ClamAV not installed'
              });
            });
          });
          
        case 'virustotal':
          return {
            healthy: !!process.env.VIRUSTOTAL_API_KEY,
            provider: 'virustotal',
            error: !process.env.VIRUSTOTAL_API_KEY ? 'VIRUSTOTAL_API_KEY not configured' : undefined
          };
          
        case 'aws':
          return {
            healthy: !!this.AWS_SCAN_BUCKET,
            provider: 'aws',
            error: !this.AWS_SCAN_BUCKET ? 'AWS_VIRUS_SCAN_BUCKET not configured' : undefined
          };
          
        default:
          return {
            healthy: false,
            provider: this.scanProvider,
            error: 'Unknown provider'
          };
      }
    } catch (error: any) {
      return {
        healthy: false,
        provider: this.scanProvider,
        error: error.message
      };
    }
  }
}
