/**
 * Placeholder data shaped like the expected API responses.
 * The types here are the contract the FastAPI backend should satisfy.
 * Timestamps are ISO 8601 strings; weights are in the user's `unit`.
 */

export type WeightUnit = 'lb' | 'kg';

export type UserSummary = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
};

// GET /me
export type Me = UserSummary & {
  unit: WeightUnit;
  /** 8 chars from FRIEND_CODE_ALPHABET (utils/friend-code), stored without the dash. */
  friendCode: string;
};

// GET /friends
export type Friend = {
  user: UserSummary;
  since: string;
};

// GET /friends/requests
export type FriendRequest = {
  id: string;
  direction: 'incoming' | 'outgoing';
  user: UserSummary;
  createdAt: string;
};

// --- Challenges --------------------------------------------------------------
// POST /challenges creates a lobby; people join with the code; the host starts
// and ends it. A WebSocket per challenge streams joins, start/end, and sets.

export type ChallengeMetric = 'volume' | 'reps' | 'heaviest';

/**
 * One logged set, by any participant. Over the socket: `set.logged`.
 * No exercise: every set counts toward the score, whatever the movement.
 * weight 0 = bodyweight.
 */
export type ChallengeSet = {
  id: string;
  userId: string;
  weight: number;
  reps: number;
  loggedAt: string;
};

export type Challenge = {
  id: string;
  /** 6 chars from the friend-code alphabet; anyone with it (or the link) can join. */
  code: string;
  name: string;
  metric: ChallengeMetric;
  /** Only the host can start and end the challenge. */
  hostId: string;
  /** Joined, including the host. Over the socket: `participant.joined`. */
  participants: UserSummary[];
  /** Friends the host invited who haven't joined yet. */
  invited: UserSummary[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: 'lobby' | 'live' | 'finished';
  sets: ChallengeSet[];
};

// --- Mock values -------------------------------------------------------------
// A brand-new user: signed up, no friends, no challenges yet.

const me: UserSummary = { id: 'u_me', name: 'Trevor Vick', handle: 'tvick', avatarUrl: null };

export const mockMe: Me = { ...me, unit: 'lb', friendCode: '7K2Q9MXP' };

export const mockChallenges: Challenge[] = [];

/**
 * Stand-in for looking up a join code on the server: challenges hosted by
 * other people. Enter one of these keys as a join code.
 */
export const mockChallengeCodeDirectory: Record<
  string,
  Pick<Challenge, 'name' | 'metric'> & { host: UserSummary; others: UserSummary[] }
> = {
  MAYA42: {
    name: "Maya's leg day",
    metric: 'volume',
    host: { id: 'u_maya', name: 'Maya Chen', handle: 'mayalifts', avatarUrl: null },
    others: [{ id: 'u_sam', name: 'Sam Okafor', handle: 'samo', avatarUrl: null }],
  },
};
