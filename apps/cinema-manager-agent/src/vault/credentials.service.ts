import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface StoredCredentials {
  agentToken: string;
  deviceId: string;
  userId?: string;
  deviceName?: string;
  pairedAt: string;
  watchPaths?: string[];
}

export class CredentialsService {
  private readonly vaultDir: string;
  private readonly vaultFile: string;
  private cachedCredentials: StoredCredentials | null = null;

  constructor() {
    this.vaultDir = path.join(os.homedir(), '.cinema-manager');
    this.vaultFile = path.join(this.vaultDir, 'agent-vault.enc');
  }

  /**
   * Derives a machine- and user-specific 256-bit encryption key using native crypto
   */
  private deriveKey(): Buffer {
    const machineEntropy = `${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`;
    return crypto.createHash('sha256').update(machineEntropy).digest();
  }

  /**
   * Securely saves credentials to the encrypted vault
   */
  saveCredentials(credentials: StoredCredentials): void {
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true, mode: 0o700 });
    }

    const key = this.deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(credentials);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const envelope = JSON.stringify({
      iv: iv.toString('hex'),
      authTag,
      data: encrypted,
    });

    fs.writeFileSync(this.vaultFile, envelope, { mode: 0o600 });
    this.cachedCredentials = credentials;
  }

  /**
   * Loads and decrypts credentials from the vault
   */
  loadCredentials(): StoredCredentials | null {
    if (this.cachedCredentials) {
      return this.cachedCredentials;
    }

    if (!fs.existsSync(this.vaultFile)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.vaultFile, 'utf8');
      const envelope = JSON.parse(raw);
      const key = this.deriveKey();
      const iv = Buffer.from(envelope.iv, 'hex');
      const authTag = Buffer.from(envelope.authTag, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(envelope.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.cachedCredentials = JSON.parse(decrypted);
      return this.cachedCredentials;
    } catch (err) {
      console.warn('Failed to decrypt agent credentials vault (machine identity changed or file corrupt):', err);
      return null;
    }
  }

  /**
   * Returns current active agent token or null
   */
  getAgentToken(): string | null {
    const creds = this.loadCredentials();
    return creds ? creds.agentToken : null;
  }

  /**
   * Returns device ID if paired
   */
  getDeviceId(): string | null {
    const creds = this.loadCredentials();
    return creds ? creds.deviceId : null;
  }

  /**
   * Returns true if the agent is paired
   */
  isPaired(): boolean {
    return !!this.getAgentToken();
  }

  /**
   * Clears stored credentials (unpair)
   */
  clearCredentials(): void {
    this.cachedCredentials = null;
    if (fs.existsSync(this.vaultFile)) {
      fs.unlinkSync(this.vaultFile);
    }
  }
}
