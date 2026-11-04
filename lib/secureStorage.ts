import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Session storage for iOS/Android, following Supabase's React Native
 * guidance. The session JSON is too big for the Keychain/Keystore (~2 KB
 * limit), so it's AES-256 encrypted into AsyncStorage while the key lives
 * in SecureStore (hardware-backed where available). Anything reading the
 * app's plain storage - a backup, a rooted device - gets ciphertext only.
 *
 * A fresh key is generated on every write, so the fixed CTR counter is
 * never reused with the same key.
 */
export class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    try {
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(encryptionKeyHex),
        new aesjs.Counter(1),
      );
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
    } catch {
      // Corrupt or pre-encryption plain value: treat as signed out.
      return null;
    }
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}
