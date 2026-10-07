import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/** Body for POST /auth/apple. */
export type AppleCredential = {
  identityToken: string;
  nonce: string;
  givenName: string | null;
  familyName: string | null;
};

/** Body for POST /auth/google. */
export type GoogleCredential = { idToken: string };

/** Sign in with Apple exists on iOS only (not Android or web). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Shows Apple's sheet. Resolves null if the user cancels.
 * Apple gets sha256(nonce); the server gets the raw nonce and checks they match,
 * so a token captured elsewhere can't be replayed.
 */
export async function signInWithApple(): Promise<AppleCredential | null> {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    return {
      identityToken: credential.identityToken,
      nonce,
      // Only present on the very first sign-in; the server stores it then.
      givenName: credential.fullName?.givenName ?? null,
      familyName: credential.fullName?.familyName ?? null,
    };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * Google needs a development build (not Expo Go / web) plus client IDs:
 * the web client ID on both platforms (it becomes the token's audience),
 * and the iOS client ID on iOS (app.config.ts adds the native plugin from it).
 */
export const isGoogleSignInConfigured =
  Platform.OS !== 'web' &&
  !!GOOGLE_WEB_CLIENT_ID &&
  (Platform.OS !== 'ios' || !!GOOGLE_IOS_CLIENT_ID);

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let google: GoogleSignInModule | null = null;

/** Loaded on first use: the native module doesn't exist in Expo Go or on web. */
function loadGoogle(): GoogleSignInModule {
  if (!google) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    google.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
  }
  return google;
}

/** Shows Google's account picker. Resolves null if the user cancels. */
export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  const { GoogleSignin, isCancelledResponse } = loadGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) return null;
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google did not return an ID token. Check the web client ID.');
  return { idToken };
}

/** Clears Google's cached account so the picker shows next time. Safe if unused. */
export async function signOutOfGoogle(): Promise<void> {
  if (!google) return;
  try {
    await google.GoogleSignin.signOut();
  } catch {
    // Not signed in with Google on this device.
  }
}
