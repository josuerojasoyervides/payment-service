import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';

export class BrowserStorageAdapter implements KeyValueStorage {
  constructor(private readonly storage: Storage) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }
}
