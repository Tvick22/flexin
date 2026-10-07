/**
 * Friends + friend requests. Local until the API exists; each action maps to
 * one REST call (see the endpoint list in the PR/notes).
 */

import { mockFriendRequests, mockFriends, type Friend, type FriendRequest, type UserSummary } from '@/data/mock-data';
import { createStore, newId } from '@/stores/create-store';

type State = { friends: Friend[]; requests: FriendRequest[] };

const store = createStore<State>({ friends: mockFriends, requests: mockFriendRequests });

export const useFriendsStore = store.useStore;
export const getFriendsState = store.get;
export const subscribeFriends = store.subscribe;

export const friendsActions = {
  /** POST /friends/requests { friendCode } */
  sendRequest(user: UserSummary): FriendRequest {
    const request: FriendRequest = {
      id: newId('req'),
      direction: 'outgoing',
      user,
      createdAt: new Date().toISOString(),
    };
    const s = store.get();
    store.set({ ...s, requests: [request, ...s.requests] });
    return request;
  },

  /** POST /friends/requests/{id}/accept. Also used when the other person accepts ours. */
  accept(requestId: string) {
    const s = store.get();
    const request = s.requests.find((r) => r.id === requestId);
    if (!request) return;
    store.set({
      requests: s.requests.filter((r) => r.id !== requestId),
      friends: [{ user: request.user, since: new Date().toISOString() }, ...s.friends],
    });
  },

  /** DELETE /friends/requests/{id} (decline incoming or cancel outgoing). */
  remove(requestId: string) {
    const s = store.get();
    store.set({ ...s, requests: s.requests.filter((r) => r.id !== requestId) });
  },
};
