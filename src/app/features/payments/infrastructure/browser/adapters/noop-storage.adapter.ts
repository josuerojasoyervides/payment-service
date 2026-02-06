import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';

export class NoopStorageAdapter implements KeyValueStorage {
  getItem(_key: string): string | null {
    return null;
  }

  setItem(_key: string, _value: string): void {
    void _key;
    void _value;
  }

  removeItem(_key: string): void {
    void _key;
  }
}
