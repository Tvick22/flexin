/**
 * Who's signed in. Restores the session on launch from the stored refresh
 * token, keeps the access token in memory, and refreshes it on demand.
 */

import {
  api,
  ApiError,
  bindAuth,
  NetworkError,
  type ApiMe,
  type HandleAvailability,
  type TokenResponse,
} from '@/lib/api';
import { signOutOfGoogle, type AppleCredential, type GoogleCredential } from '@/lib/social-sign-in';
import { tokenStorage } from '@/lib/token-storage';
import { createStore } from '@/stores/create-store';

type Status = 'restoring' | 'signedOut' | 'signedIn';

type State = {
  status: Status;
  user: ApiMe | null;
  accessToken: string | null;
  /** Set when restoring hit a network problem: we kept the stored session to retry. */
  restoreError: string | null;
};

const store = createStore<State>({ status: 'restoring', user: null, accessToken: null, restoreError: null });

export const useAuthStore = store.useStore;

/** The signed-in user. Only use inside screens behind the signed-in guard. */
export function useMe(): ApiMe {
  const user = store.useStore((s) => s.user);
  if (!user) throw new Error('useMe() used while signed out');
  return user;
}

async function applyTokens(res: TokenResponse): Promise<void> {
  await tokenStorage.set(res.refreshToken);
  store.set({ status: 'signedIn', user: res.user, accessToken: res.accessToken, restoreError: null });
}

async function clearLocalSession(): Promise<void> {
  await tokenStorage.clear();
  store.set({ status: 'signedOut', user: null, accessToken: null, restoreError: null });
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the stored refresh token for new tokens. Concurrent callers share one request. */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await tokenStorage.get();
      if (!refreshToken) return false;
      const res = await api<TokenResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        authenticated: false,
      });
      await applyTokens(res);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await clearLocalSession();
      if (e instanceof NetworkError) throw e;
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

bindAuth({
  accessToken: () => store.get().accessToken,
  refresh: () => refresh().catch(() => false),
});

export const authActions = {
  /** On launch: resume the previous session if there is one. */
  async restore(): Promise<void> {
    try {
      if (!(await refresh())) await clearLocalSession();
    } catch (e) {
      // Offline or server down: don't throw away a session that may still be valid.
      store.set({
        status: 'signedOut',
        user: null,
        accessToken: null,
        restoreError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async signInWithApple(credential: AppleCredential): Promise<void> {
    await applyTokens(
      await api<TokenResponse>('/auth/apple', { method: 'POST', body: credential, authenticated: false }),
    );
  },

  async signInWithGoogle(credential: GoogleCredential): Promise<void> {
    await applyTokens(
      await api<TokenResponse>('/auth/google', { method: 'POST', body: credential, authenticated: false }),
    );
  },

  /** Development-only server endpoint: sign in as a test account by email. */
  async devSignIn(email: string): Promise<void> {
    await applyTokens(
      await api<TokenResponse>('/auth/dev', { method: 'POST', body: { email }, authenticated: false }),
    );
  },

  async updateProfile(patch: Partial<Pick<ApiMe, 'name' | 'handle' | 'unit' | 'avatarUrl'>>): Promise<ApiMe> {
    const user = await api<ApiMe>('/me', { method: 'PATCH', body: patch });
    store.set({ ...store.get(), user });
    return user;
  },

  checkHandle(handle: string): Promise<HandleAvailability> {
    return api<HandleAvailability>(`/handles/${encodeURIComponent(handle)}`);
  },

  async signOut(): Promise<void> {
    const refreshToken = await tokenStorage.get();
    if (refreshToken) {
      // Best effort: even if the server is unreachable, sign out locally.
      await api('/auth/logout', { method: 'POST', body: { refreshToken }, authenticated: false }).catch(
        () => undefined,
      );
    }
    await signOutOfGoogle();
    await clearLocalSession();
  },
};
