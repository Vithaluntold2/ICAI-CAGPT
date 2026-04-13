import crypto from 'crypto';
import { KMSClient, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

export type KeyVaultProvider = 'env' | 'aws-kms' | 'azure-keyvault';

/**
 * Key Vault Service - PRODUCTION IMPLEMENTATION
 * Manages encryption keys with support for multiple vault providers
 * 
 * Supported providers:
 * - 'env': Environment variables (development only)
 * - 'aws-kms': AWS Key Management Service (default for production)
 * - 'azure-keyvault': Azure Key Vault (alternative)
 *
 * Set KEY_VAULT_PROVIDER env var to override. Defaults to aws-kms in production.
 */
export class KeyVaultService {
  private static provider: KeyVaultProvider = 
    (process.env.KEY_VAULT_PROVIDER as KeyVaultProvider) || 
    (process.env.NODE_ENV === 'production' ? 'aws-kms' : 'env');
  
  private static encryptionKey: Buffer | null = null;
  private static kmsClient: KMSClient | null = null;
  private static azureClient: SecretClient | null = null;

  /**
   * Initialize the key vault service
   */
  static async initialize(): Promise<void> {
    console.log(`[KeyVault] Initializing (provider: ${this.provider})...`);
    
    try {
      switch (this.provider) {
        case 'env':
          await this.initializeEnvKeys();
          break;
        case 'aws-kms':
          await this.initializeAWSKMS();
          break;
        case 'azure-keyvault':
          await this.initializeAzureKeyVault();
          break;
        default:
          throw new Error(`Unknown key vault provider: ${this.provider}`);
      }
      
      console.log('[KeyVault] ✓ Initialized successfully');
    } catch (error) {
      console.error('[KeyVault] ✗ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get the master encryption key
   */
  static async getEncryptionKey(): Promise<Buffer> {
    if (!this.encryptionKey) {
      await this.initialize();
    }
    
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    return this.encryptionKey;
  }

  /**
   * Initialize using environment variables (least secure, for development)
   */
  private static async initializeEnvKeys(): Promise<void> {
    const keyHex = process.env.ENCRYPTION_KEY;
    
    if (!keyHex) {
      throw new Error(
        'ENCRYPTION_KEY environment variable not set. ' +
        'Please set a 64-character hexadecimal string (32 bytes for AES-256).'
      );
    }
    
    // Validate key format
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). ' +
        `Got ${keyHex.length} characters. ` +
        'Generate one with: openssl rand -hex 32'
      );
    }
    
    this.encryptionKey = Buffer.from(keyHex, 'hex');
    
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[KeyVault] ⚠️  WARNING: Using environment variable for encryption key in production. ' +
        'Consider using AWS KMS or Azure Key Vault.'
      );
    }
  }

  /**
   * Initialize using AWS KMS - REAL IMPLEMENTATION
   * Decrypts the data encryption key using AWS KMS
   */
  private static async initializeAWSKMS(): Promise<void> {
    const kmsKeyId = process.env.AWS_KMS_KEY_ID;
    const encryptedKeyBase64 = process.env.AWS_ENCRYPTED_KEY;
    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    
    if (!kmsKeyId) {
      throw new Error(
        'AWS KMS configuration incomplete. Required: AWS_KMS_KEY_ID. ' +
        'This should be the ARN or alias of your KMS key.'
      );
    }
    
    try {
      // Initialize KMS client
      this.kmsClient = new KMSClient({ 
        region: awsRegion,
        // AWS credentials are automatically loaded from:
        // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        // - IAM role (when running on EC2/ECS/Lambda)
        // - Shared credentials file (~/.aws/credentials)
      });
      
      if (encryptedKeyBase64) {
        // Mode 1: Decrypt an existing encrypted data key
        console.log('[KeyVault] Decrypting data key from AWS KMS...');
        
        const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');
        
        const decryptCommand = new DecryptCommand({
          KeyId: kmsKeyId,
          CiphertextBlob: encryptedKey,
        });
        
        const response = await this.kmsClient.send(decryptCommand);
        
        if (!response.Plaintext) {
          throw new Error('KMS decryption returned empty plaintext');
        }
        
        this.encryptionKey = Buffer.from(response.Plaintext);
        console.log('[KeyVault] ✓ Data key decrypted from AWS KMS');
        
      } else {
        // Mode 2: Generate a new data key (for initial setup)
        console.log('[KeyVault] Generating new data key from AWS KMS...');
        
        const generateCommand = new GenerateDataKeyCommand({
          KeyId: kmsKeyId,
          KeySpec: 'AES_256',
        });
        
        const response = await this.kmsClient.send(generateCommand);
        
        if (!response.Plaintext || !response.CiphertextBlob) {
          throw new Error('KMS key generation returned empty response');
        }
        
        this.encryptionKey = Buffer.from(response.Plaintext);
        
        // Log the encrypted key for storage (save this to AWS_ENCRYPTED_KEY env var)
        const encryptedKeyForStorage = Buffer.from(response.CiphertextBlob).toString('base64');
        console.log('[KeyVault] ✓ New data key generated');
        console.log('[KeyVault] IMPORTANT: Save this encrypted key to AWS_ENCRYPTED_KEY environment variable:');
        console.log(`AWS_ENCRYPTED_KEY=${encryptedKeyForStorage}`);
      }
      
    } catch (error: any) {
      if (error.name === 'CredentialsProviderError') {
        throw new Error(
          'AWS credentials not found. Please configure:\n' +
          '  - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, OR\n' +
          '  - IAM role if running on AWS infrastructure, OR\n' +
          '  - ~/.aws/credentials file'
        );
      }
      throw error;
    }
  }

  /**
   * Initialize using Azure Key Vault - REAL IMPLEMENTATION
   * Retrieves the encryption key from Azure Key Vault
   */
  private static async initializeAzureKeyVault(): Promise<void> {
    const vaultUrl = process.env.AZURE_KEYVAULT_URL;
    const secretName = process.env.AZURE_KEYVAULT_SECRET_NAME || 'luca-encryption-key';
    
    if (!vaultUrl) {
      throw new Error(
        'Azure Key Vault configuration incomplete. Required: AZURE_KEYVAULT_URL. ' +
        'Example: https://your-vault-name.vault.azure.net'
      );
    }
    
    try {
      console.log(`[KeyVault] Connecting to Azure Key Vault: ${vaultUrl}...`);
      
      // DefaultAzureCredential automatically handles:
      // - Environment credentials (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
      // - Managed Identity (when running on Azure)
      // - Azure CLI credentials (for local development)
      // - Visual Studio Code credentials
      const credential = new DefaultAzureCredential();
      
      this.azureClient = new SecretClient(vaultUrl, credential);
      
      // Retrieve the encryption key secret
      console.log(`[KeyVault] Retrieving secret: ${secretName}...`);
      const secret = await this.azureClient.getSecret(secretName);
      
      if (!secret.value) {
        throw new Error(`Secret '${secretName}' has no value`);
      }
      
      // Validate the key format (should be 64 hex characters)
      if (!/^[0-9a-f]{64}$/i.test(secret.value)) {
        throw new Error(
          `Secret '${secretName}' must be exactly 64 hexadecimal characters (32 bytes for AES-256). ` +
          `Got ${secret.value.length} characters.`
        );
      }
      
      this.encryptionKey = Buffer.from(secret.value, 'hex');
      console.log('[KeyVault] ✓ Encryption key retrieved from Azure Key Vault');
      
    } catch (error: any) {
      if (error.code === 'CredentialUnavailableError') {
        throw new Error(
          'Azure credentials not found. Please configure:\n' +
          '  - AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID for service principal, OR\n' +
          '  - Managed Identity if running on Azure, OR\n' +
          '  - Azure CLI: run "az login"'
        );
      }
      if (error.code === 'SecretNotFound') {
        throw new Error(
          `Secret '${secretName}' not found in Azure Key Vault. ` +
          'Please create the secret with a 64-character hex encryption key.'
        );
      }
      throw error;
    }
  }

  /**
   * Rotate encryption key
   * This re-encrypts all existing data with a new key
   */
  static async rotateKey(reEncryptCallback?: (oldKey: Buffer, newKey: Buffer) => Promise<void>): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Cannot rotate key: no current key initialized');
    }
    
    const oldKey = this.encryptionKey;
    
    // Generate new key based on provider
    let newKey: Buffer;
    
    switch (this.provider) {
      case 'aws-kms':
        if (!this.kmsClient) {
          throw new Error('KMS client not initialized');
        }
        const kmsKeyId = process.env.AWS_KMS_KEY_ID;
        const generateCommand = new GenerateDataKeyCommand({
          KeyId: kmsKeyId!,
          KeySpec: 'AES_256',
        });
        const response = await this.kmsClient.send(generateCommand);
        newKey = Buffer.from(response.Plaintext!);
        
        // Log new encrypted key
        const newEncryptedKey = Buffer.from(response.CiphertextBlob!).toString('base64');
        console.log('[KeyVault] New encrypted key for AWS_ENCRYPTED_KEY:');
        console.log(newEncryptedKey);
        break;
        
      case 'azure-keyvault':
        // Generate locally and store in Azure
        newKey = crypto.randomBytes(32);
        if (this.azureClient) {
          const secretName = process.env.AZURE_KEYVAULT_SECRET_NAME || 'luca-encryption-key';
          await this.azureClient.setSecret(secretName, newKey.toString('hex'));
        }
        break;
        
      default:
        newKey = crypto.randomBytes(32);
        console.log('[KeyVault] New ENCRYPTION_KEY (update your .env):');
        console.log(newKey.toString('hex'));
    }
    
    // Re-encrypt existing data if callback provided
    if (reEncryptCallback) {
      console.log('[KeyVault] Re-encrypting existing data...');
      await reEncryptCallback(oldKey, newKey);
    }
    
    this.encryptionKey = newKey;
    console.log('[KeyVault] ✓ Key rotation complete');
  }

  /**
   * Generate a new encryption key (for initial setup)
   */
  static generateNewKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate encryption key strength
   */
  static validateKey(keyHex: string): boolean {
    // Must be exactly 64 hex characters (32 bytes for AES-256)
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      return false;
    }
    
    // Check for weak keys (all zeros, repeating patterns)
    const key = Buffer.from(keyHex, 'hex');
    const allZeros = key.every(byte => byte === 0);
    const allSame = key.every(byte => byte === key[0]);
    
    return !allZeros && !allSame;
  }
  
  /**
   * Get current provider name
   */
  static getProvider(): KeyVaultProvider {
    return this.provider;
  }
  
  /**
   * Check if key vault is properly configured
   */
  static async healthCheck(): Promise<{ healthy: boolean; provider: string; error?: string }> {
    try {
      await this.getEncryptionKey();
      return { healthy: true, provider: this.provider };
    } catch (error: any) {
      return { healthy: false, provider: this.provider, error: error.message };
    }
  }
}
