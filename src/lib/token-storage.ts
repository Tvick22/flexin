import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where the refresh token lives between launches: iOS Keychain / Android
 * Keystore via SecureStore. Web (dev only) has no secure store, so it falls
 * back to localStorage there. The access token is only ever kept in memory.
 */

const KEY = 'flexin.refreshToken';

export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, token);
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  },
};
