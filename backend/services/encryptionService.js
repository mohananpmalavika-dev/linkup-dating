/**
 * Encryption Service
 * Handles message encryption, key generation, and security operations
 */
const crypto = require('crypto');
const db = require('../config/database');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;

class EncryptionService {
  /**
   * Generate a new encryption key pair for a match
   */
  static async generateKeyPair(userId, matchId) {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      return { publicKey, privateKey };
    } catch (error) {
      console.error('Key pair generation error:', error);
      throw new Error('Failed to generate encryption keys');
    }
  }

  /**
   * Encrypt message content using AES-256-GCM
   */
  static encryptMessage(messageText, encryptionKey) {
    try {
      if (!messageText || !encryptionKey) {
        throw new Error('Missing message or encryption key');
      }

      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(encryptionKey, 'hex'), iv);

      let encrypted = cipher.update(messageText, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      const nonce = iv.toString('hex');

      return {
        encryptedContent: encrypted,
        nonce: nonce,
        authTag: authTag.toString('hex'),
        algorithm: ENCRYPTION_ALGORITHM
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt message content using AES-256-GCM
   */
  static decryptMessage(encryptedContent, nonce, authTag, encryptionKey) {
    try {
      if (!encryptedContent || !nonce || !authTag || !encryptionKey) {
        throw new Error('Missing decryption parameters');
      }

      const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        Buffer.from(encryptionKey, 'hex'),
        Buffer.from(nonce, 'hex')
      );

      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encryptedContent, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Generate a random encryption key for session
   */
  static generateSessionKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Hash a string using SHA-256
   */
  static hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Generate a secure random string (nonce/token)
   */
  static generateNonce(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify data integrity using HMAC
   */
  static verifyHmac(data, signature, secret) {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(data);
      const computed = hmac.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch (error) {
      return false;
    }
  }

  /**
   * Create HMAC signature for data
   */
  static createHmac(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Store encryption key in database
   */
  static async storeEncryptionKey(userId, matchId, publicKey, encryptedPrivateKey) {
    try {
      const { EncryptionKey } = db.models;

      const key = await EncryptionKey.findOne({
        where: { user_id: userId, match_id: matchId }
      });

      if (key) {
        return await key.update({
          public_key: publicKey,
          encrypted_private_key: encryptedPrivateKey,
          key_version: key.key_version + 1,
          is_active: true
        });
      }

      return await EncryptionKey.create({
        user_id: userId,
        match_id: matchId,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
        key_version: 1,
        is_active: true
      });
    } catch (error) {
      console.error('Store encryption key error:', error);
      throw new Error('Failed to store encryption key');
    }
  }

  /**
   * Retrieve encryption key from database
   */
  static async getEncryptionKey(userId, matchId) {
    try {
      const { EncryptionKey } = db.models;

      return await EncryptionKey.findOne({
        where: {
          user_id: userId,
          match_id: matchId,
          is_active: true
        }
      });
    } catch (error) {
      console.error('Get encryption key error:', error);
      throw new Error('Failed to retrieve encryption key');
    }
  }

  /**
   * Generate full-text search vector for message
   */
  static generateSearchVector(text) {
    // In PostgreSQL, this would be: to_tsvector('english', text)
    // For now, we'll just prepare the text
    return text ? text.toLowerCase().trim() : null;
  }

  /**
   * Encrypt file with AES-256-GCM
   */
  static encryptFile(fileBuffer, encryptionKey) {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(encryptionKey, 'hex'), iv);

      let encrypted = cipher.update(fileBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        nonce: iv,
        authTag: authTag
      };
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file with AES-256-GCM
   */
  static decryptFile(encryptedBuffer, nonce, authTag, encryptionKey) {
    try {
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        Buffer.from(encryptionKey, 'hex'),
        nonce
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  }
}

module.exports = EncryptionService;
