import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Military-grade AES-256-GCM file encryption with per-file keys

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_KEY;

if (!MASTER_KEY || MASTER_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
}

const MASTER_KEY_BUFFER = Buffer.from(MASTER_KEY, 'hex');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

/**
 * Generate a random 256-bit encryption key for a single file
 */
export function generateFileKey(): Buffer {
  return crypto.randomBytes(32); // 256 bits
}

/**
 * Encrypt a file-specific key using the master key
 */
export function encryptFileKey(fileKey: Buffer): string {
  const iv = crypto.randomBytes(12); // 96 bits for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY_BUFFER, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(fileKey),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv + authTag + encrypted data (all base64 encoded)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a file-specific key using the master key
 */
export function decryptFileKey(encryptedKey: string): Buffer {
  const combined = Buffer.from(encryptedKey, 'base64');
  
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

/**
 * Encrypt file contents using a file-specific key
 */
export function encryptFileData(data: Buffer, fileKey: Buffer, nonce: Buffer): {
  encrypted: Buffer;
  authTag: Buffer;
} {
  const cipher = crypto.createCipheriv(ALGORITHM, fileKey, nonce);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return { encrypted, authTag };
}

/**
 * Decrypt file contents using a file-specific key
 */
export function decryptFileData(
  encrypted: Buffer,
  fileKey: Buffer,
  nonce: Buffer,
  authTag: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, fileKey, nonce);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

/**
 * Calculate SHA-256 checksum for tamper detection
 */
export function calculateChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Store encrypted file on disk
 */
export async function storeEncryptedFile(
  data: Buffer,
  filename: string
): Promise<{ storageKey: string; nonce: string; fileKey: Buffer; checksum: string; encryptedFileKey: string }> {
  await ensureUploadDir();
  
  // Generate per-file encryption key and nonce
  const fileKey = generateFileKey();
  const nonce = crypto.randomBytes(12); // 96 bits for GCM
  
  // Encrypt the file data
  const { encrypted, authTag } = encryptFileData(data, fileKey, nonce);
  
  // Calculate checksum of original data
  const checksum = calculateChecksum(data);
  
  // Store encrypted data + auth tag
  const combined = Buffer.concat([authTag, encrypted]);
  const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${filename}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);
  
  await fs.writeFile(filePath, combined);
  
  // Encrypt the file key with master key
  const encryptedFileKey = encryptFileKey(fileKey);
  
  return {
    storageKey,
    nonce: nonce.toString('base64'),
    fileKey,
    checksum,
    encryptedFileKey
  };
}

/**
 * Retrieve and decrypt file from disk
 */
export async function retrieveEncryptedFile(
  storageKey: string,
  encryptedFileKey: string,
  nonce: string
): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  
  // Read encrypted file
  const combined = await fs.readFile(filePath);
  
  // Extract auth tag and encrypted data
  const authTag = combined.subarray(0, 16);
  const encrypted = combined.subarray(16);
  
  // Decrypt file key
  const fileKey = decryptFileKey(encryptedFileKey);
  
  // Decrypt file data
  const nonceBuffer = Buffer.from(nonce, 'base64');
  const decrypted = decryptFileData(encrypted, fileKey, nonceBuffer, authTag);
  
  return decrypted;
}

/**
 * Securely delete file from disk (overwrite then delete)
 */
export async function secureDeleteFile(storageKey: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  
  try {
    // Get file size
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // Overwrite with random data 3 times (DOD 5220.22-M standard)
    for (let i = 0; i < 3; i++) {
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(filePath, randomData);
    }
    
    // Final overwrite with zeros
    await fs.writeFile(filePath, Buffer.alloc(fileSize, 0));
    
    // Delete file
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Secure file deletion failed:', error);
    // Try simple deletion as fallback
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error('File deletion failed:', unlinkError);
    }
  }
}
