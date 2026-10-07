import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with the native config sign-in needs.
 *
 * Google sign-in's plugin needs the iOS URL scheme, which is the iOS OAuth client ID
 * reversed. It's only added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set (in .env.local
 * locally, or as an EAS environment variable for builds), so builds work before then.
 */
function googleIosUrlScheme(): string | null {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId?.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = googleIosUrlScheme();
  return {
    ...config,
    name: config.name ?? 'flexin',
    slug: config.slug ?? 'flexin',
    ios: { ...config.ios, usesAppleSignIn: true },
    plugins: [
      ...(config.plugins ?? []),
      'expo-apple-authentication',
      'expo-secure-store',
      ...(iosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, object]]
        : []),
    ],
  };
};
