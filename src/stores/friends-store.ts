/**
 * Friends + friend requests, from the API. Loaded when the app opens and
 * whenever the Friends tab is focused (no live updates yet).
 */

import { api } from '@/lib/api';
import type { Friend, FriendRequest } from '@/data/mock-data';
import { createStore } from '@/stores/create-store';

type State = {
  friends: Friend[];
  requests: FriendRequest[];
  /** 'idle' until the first load; stays 'ready' while refreshing so lists don't flicker. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  refreshing: boolean;
};

const EMPTY: State = { friends: [], requests: [], status: 'idle', error: null, refreshing: false };

const store = createStore<State>(EMPTY);

export const useFriendsStore = store.useStore;
export const getFriendsState = store.get;
export const subscribeFriends = store.subscribe;

function patch(next: Partial<State>) {
  store.set({ ...store.get(), ...next });
}

let loading: Promise<void> | null = null;

export const friendsActions = {
  /** GET /friends + /friends/requests. Concurrent calls share one load. */
  load(): Promise<void> {
    loading ??= (async () => {
      const first = store.get().status !== 'ready';
      patch(first ? { status: 'loading', error: null } : { refreshing: true, error: null });
      try {
        const [friends, requests] = await Promise.all([
          api<Friend[]>('/friends'),
          api<FriendRequest[]>('/friends/requests'),
        ]);
        patch({ friends, requests, status: 'ready', refreshing: false });
      } catch (e) {
        patch({
          status: first ? 'error' : 'ready',
          refreshing: false,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        loading = null;
      }
    })();
    return loading;
  },

  /** POST /friends/requests. Throws ApiError with a user-facing message (404/409/400). */
  async sendRequest(friendCode: string): Promise<FriendRequest> {
    const request = await api<FriendRequest>('/friends/requests', {
      method: 'POST',
      body: { friendCode },
    });
    patch({ requests: [request, ...store.get().requests] });
    return request;
  },

  /** POST /friends/requests/{id}/accept */
  async accept(requestId: string): Promise<void> {
    const friend = await api<Friend>(`/friends/requests/${requestId}/accept`, { method: 'POST' });
    const s = store.get();
    patch({
      requests: s.requests.filter((r) => r.id !== requestId),
      friends: [friend, ...s.friends.filter((f) => f.user.id !== friend.user.id)],
    });
  },

  /** DELETE /friends/requests/{id}: decline incoming or cancel outgoing. */
  async remove(requestId: string): Promise<void> {
    await api(`/friends/requests/${requestId}`, { method: 'DELETE' });
    patch({ requests: store.get().requests.filter((r) => r.id !== requestId) });
  },

  /** DELETE /friends/{userId} */
  async unfriend(userId: string): Promise<void> {
    await api(`/friends/${userId}`, { method: 'DELETE' });
    patch({ friends: store.get().friends.filter((f) => f.user.id !== userId) });
  },

  /** On sign-out: the next account must not see these. */
  reset() {
    store.set(EMPTY);
  },
};
