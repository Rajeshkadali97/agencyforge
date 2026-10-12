import { MemoryItem, MemoryVisibility, MemorySecurityLevel } from '../types';

export interface ISecurityPolicy {
  canRead(item: MemoryItem, context: SecurityContext): boolean;
  canWrite(item: MemoryItem, context: SecurityContext): boolean;
  canDelete(item: MemoryItem, context: SecurityContext): boolean;
  canShare(item: MemoryItem, context: SecurityContext): boolean;
  canEncrypt(item: MemoryItem, context: SecurityContext): boolean;
}

export interface SecurityContext {
  userId: string;
  roles: string[];
  permissions: string[];
  projectId?: string;
  organizationId?: string;
}

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC' | 'ChaCha20-Poly1305';
  keySize: 128 | 192 | 256;
  keyRotationDays: number;
}

export interface AccessControlEntry {
  principal: string; // userId, role, or 'public'
  permission: 'read' | 'write' | 'delete' | 'share' | 'admin';
  allowed: boolean;
}

export class MemorySecurityManager implements ISecurityPolicy {
  private encryptionConfig: EncryptionConfig;
  private accessControlList: Map<string, AccessControlEntry[]> = new Map();
  private encryptionKeys: Map<string, CryptoKey> = new Map();

  constructor(config?: Partial<EncryptionConfig>) {
    this.encryptionConfig = {
      algorithm: 'AES-GCM',
      keySize: 256,
      keyRotationDays: 90,
      ...config,
    };
  }

  canRead(item: MemoryItem, context: SecurityContext): boolean {
    // Owner can always read
    if (item.owner === context.userId) return true;

    // Check visibility
    switch (item.visibility) {
      case 'public':
        return true;
      case 'organization':
        return context.organizationId !== undefined;
      case 'project':
        return context.projectId === item.metadata.projectId;
      case 'private':
      default:
        return this.checkExplicitPermission(item.id, context, 'read');
    }
  }

  canWrite(item: MemoryItem, context: SecurityContext): boolean {
    // Owner can always write
    if (item.owner === context.userId) return true;

    // Check explicit permissions
    return this.checkExplicitPermission(item.id, context, 'write');
  }

  canDelete(item: MemoryItem, context: SecurityContext): boolean {
    // Owner can always delete
    if (item.owner === context.userId) return true;

    // Check admin role
    if (context.roles.includes('admin')) return true;

    // Check explicit permissions
    return this.checkExplicitPermission(item.id, context, 'delete');
  }

  canShare(item: MemoryItem, context: SecurityContext): boolean {
    // Owner can always share
    if (item.owner === context.userId) return true;

    // Check admin role
    if (context.roles.includes('admin')) return true;

    // Check explicit permissions
    return this.checkExplicitPermission(item.id, context, 'share');
  }

  canEncrypt(item: MemoryItem, context: SecurityContext): boolean {
    // Encryption allowed for confidential and restricted items
    return item.security === 'confidential' || item.security === 'restricted';
  }

  async encryptContent(content: string, keyId: string): Promise<{ encrypted: string; iv: string; tag: string }> {
    const key = await this.getOrCreateKey(keyId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encrypted);
    const tag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);

    return {
      encrypted: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      tag: Buffer.from(tag).toString('base64'),
    };
  }

  async decryptContent(encrypted: string, iv: string, tag: string, keyId: string): Promise<string> {
    const key = await this.getOrCreateKey(keyId);
    const ivBytes = Buffer.from(iv, 'base64');
    const encryptedBytes = Buffer.from(encrypted, 'base64');
    const tagBytes = Buffer.from(tag, 'base64');

    const combined = new Uint8Array(encryptedBytes.length + tagBytes.length);
    combined.set(encryptedBytes);
    combined.set(tagBytes, encryptedBytes.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      combined
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  async encryptMemoryItem(item: MemoryItem): Promise<MemoryItem> {
    if (!this.canEncrypt(item, { userId: item.owner, roles: [], permissions: [] })) {
      return item;
    }

    const keyId = `memory_${item.id}`;
    const { encrypted, iv, tag } = await this.encryptContent(item.rawContent, keyId);

    return {
      ...item,
      rawContent: encrypted,
      metadata: {
        ...item.metadata,
        encrypted: true,
        encryption: { iv, tag, keyId, algorithm: this.encryptionConfig.algorithm },
      },
    };
  }

  async decryptMemoryItem(item: MemoryItem): Promise<MemoryItem> {
    const encryption = item.metadata.encryption as { iv: string; tag: string; keyId: string } | undefined;
    if (!encryption) return item;

    const decrypted = await this.decryptContent(
      item.rawContent,
      encryption.iv,
      encryption.tag,
      encryption.keyId
    );

    return {
      ...item,
      rawContent: decrypted,
      metadata: {
        ...item.metadata,
        encrypted: false,
        encryption: undefined,
      },
    };
  }

  setAccessControl(itemId: string, entries: AccessControlEntry[]): void {
    this.accessControlList.set(itemId, entries);
  }

  getAccessControl(itemId: string): AccessControlEntry[] {
    return this.accessControlList.get(itemId) || [];
  }

  private checkExplicitPermission(itemId: string, context: SecurityContext, permission: 'read' | 'write' | 'delete' | 'share'): boolean {
    const entries = this.accessControlList.get(itemId) || [];

    for (const entry of entries) {
      if (entry.permission !== permission) continue;
      if (!entry.allowed) continue;

      // Check if principal matches
      if (entry.principal === context.userId) return true;
      if (entry.principal === 'public') return true;
      if (context.roles.includes(entry.principal)) return true;
      if (context.permissions.includes(entry.principal)) return true;
    }

    return false;
  }

  private async getOrCreateKey(keyId: string): Promise<CryptoKey> {
    let key = this.encryptionKeys.get(keyId);
    if (!key) {
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: this.encryptionConfig.keySize },
        true,
        ['encrypt', 'decrypt']
      );
      this.encryptionKeys.set(keyId, key);
    }
    return key;
  }

  async rotateKeys(): Promise<void> {
    // In a real implementation, this would rotate keys and re-encrypt data
    this.encryptionKeys.clear();
  }
}

export function createSecurityManager(config?: Partial<EncryptionConfig>): MemorySecurityManager {
  return new MemorySecurityManager(config);
}