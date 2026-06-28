/** Thin wrapper around the Web Crypto API for generating UUIDs */
export const crypto = {
  uuid(): string {
    return globalThis.crypto.randomUUID();
  },
};
