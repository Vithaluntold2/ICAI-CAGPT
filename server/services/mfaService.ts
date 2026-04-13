import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';

export class MFAService {
  /**
   * Generate a new TOTP secret for a user
   */
  static generateSecret(userEmail: string, appName: string = 'CA GPT Accounting'): {
    secret: string;
    otpauthUrl: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `${appName} (${userEmail})`,
      issuer: appName,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate QR code data URL for TOTP setup
   */
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const dataUrl = await qrcode.toDataURL(otpauthUrl);
      return dataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP token
   */
  static verifyToken(secret: string, token: string, window: number = 1): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window, // Allow tokens from 1 time step before/after (30 seconds)
    });
  }

  /**
   * Generate backup codes (encrypted)
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Encrypt MFA secret for database storage
   */
  static encryptSecret(secret: string): string {
    return encryptApiKey(secret);
  }

  /**
   * Decrypt MFA secret from database
   */
  static decryptSecret(encryptedSecret: string): string {
    return decryptApiKey(encryptedSecret);
  }

  /**
   * Encrypt backup codes for database storage
   */
  static encryptBackupCodes(codes: string[]): string[] {
    return codes.map(code => encryptApiKey(code));
  }

  /**
   * Decrypt backup codes from database
   */
  static decryptBackupCodes(encryptedCodes: string[]): string[] {
    return encryptedCodes.map(code => decryptApiKey(code));
  }

  /**
   * Verify backup code and mark as used
   */
  static verifyBackupCode(
    code: string, 
    encryptedCodes: string[]
  ): { valid: boolean; remainingCodes: string[] } {
    const decryptedCodes = this.decryptBackupCodes(encryptedCodes);
    const codeIndex = decryptedCodes.indexOf(code.toUpperCase());
    
    if (codeIndex === -1) {
      return { valid: false, remainingCodes: encryptedCodes };
    }
    
    // Remove used code
    const remainingCodes = [...encryptedCodes];
    remainingCodes.splice(codeIndex, 1);
    
    return { valid: true, remainingCodes };
  }
}
