/**
 * IndexedDB & LocalStorage Storage Layer with AES-GCM Encryption
 * Guarantees zero unencrypted persistence for all data and API keys.
 */

import { encryptData, decryptData } from './crypto.js';

const DB_NAME = 'LivingStudyGuideDB';
const DB_VERSION = 1;
const STORE_NAME = 'vault_store';
const AUTH_TOKEN_MAGIC = 'LIVING_STUDY_GUIDE_AUTH_VERIFIED_V1';

class StorageManager {
  constructor() {
    this.db = null;
    this.useLocalStorageFallback = false;
  }

  async initDb() {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') {
      this.useLocalStorageFallback = true;
      return null;
    }

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          this.useLocalStorageFallback = true;
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB error, falling back to localStorage:', err);
        this.useLocalStorageFallback = true;
        resolve(null);
      }
    });
  }

  async getRawItem(key) {
    await this.initDb();
    if (this.useLocalStorageFallback || !this.db) {
      const raw = localStorage.getItem(`lsg_${key}`);
      return raw ? JSON.parse(raw) : null;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async setRawItem(key, value) {
    await this.initDb();
    if (this.useLocalStorageFallback || !this.db) {
      localStorage.setItem(`lsg_${key}`, JSON.stringify(value));
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async isVaultInitialized() {
    const authCheck = await this.getRawItem('auth_check');
    return Boolean(authCheck && authCheck.salt && authCheck.data);
  }

  /**
   * Set up a new passphrase and initialize the encrypted vault
   */
  async initializeVault(passphrase, initialAppState) {
    if (!passphrase || passphrase.length < 4) {
      throw new Error('Passphrase must be at least 4 characters long.');
    }

    // Encrypt authentication token for quick unlock verification
    const authPayload = JSON.stringify({ token: AUTH_TOKEN_MAGIC, created: Date.now() });
    const authEnvelope = await encryptData(authPayload, passphrase);
    await this.setRawItem('auth_check', authEnvelope);

    // Encrypt the application state
    const statePayload = JSON.stringify(initialAppState);
    const dataEnvelope = await encryptData(statePayload, passphrase);
    await this.setRawItem('encrypted_vault', dataEnvelope);

    return true;
  }

  /**
   * Unlocks the vault by testing the passphrase against the auth envelope,
   * then decrypts and returns the application state.
   */
  async unlockVault(passphrase) {
    const authEnvelope = await this.getRawItem('auth_check');
    if (!authEnvelope) {
      throw new Error('No encrypted vault found. Please set up a passphrase first.');
    }

    // Verify passphrase
    let authObj;
    try {
      const authDecrypted = await decryptData(authEnvelope, passphrase);
      authObj = JSON.parse(authDecrypted);
    } catch {
      throw new Error('Incorrect passphrase. Please try again.');
    }

    if (!authObj || authObj.token !== AUTH_TOKEN_MAGIC) {
      throw new Error('Corrupted auth token. Unlock rejected.');
    }

    // Decrypt data vault
    const dataEnvelope = await this.getRawItem('encrypted_vault');
    if (!dataEnvelope) {
      return null;
    }

    const stateJson = await decryptData(dataEnvelope, passphrase);
    return JSON.parse(stateJson);
  }

  /**
   * Persists updated application state with the active session passphrase
   */
  async saveVault(passphrase, appState) {
    if (!passphrase) {
      throw new Error('Active passphrase required to persist encrypted data.');
    }
    const statePayload = JSON.stringify(appState);
    const dataEnvelope = await encryptData(statePayload, passphrase);
    await this.setRawItem('encrypted_vault', dataEnvelope);
  }

  /**
   * Clears all local storage and IndexedDB data (Full Reset)
   */
  async clearAll() {
    await this.initDb();
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (e) {
        console.warn('Error clearing IndexedDB:', e);
      }
    }
    // Clear localStorage keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lsg_')) {
        localStorage.removeItem(k);
      }
    }
  }
}

export const storage = new StorageManager();
