/**
 * Challenges: lobby → live → finished. The host starts and ends it; anyone
 * with the join code can get in. Later: create → POST /challenges, join →
 * POST /challenges/join, and a WebSocket per challenge delivers
 * `participant.joined`, `challenge.started`, `challenge.ended` and
 * `set.logged` into the matching actions below.
 */

import {
  mockChallengeCodeDirectory,
  mockChallenges,
  mockMe,
  type Challenge,
  type ChallengeMetric,
  type ChallengeSet,
  type UserSummary,
} from '@/data/mock-data';
import { createStore, newId } from '@/stores/create-store';
import { formatNumber, formatWeight } from '@/utils/format';
import { generateJoinCode } from '@/utils/join-code';

/** Your next set for a live challenge. UI-only; never sent to the server. */
export type LoggerState = {
  draft: { weight: number; reps: number };
};

type State = {
  challenges: Challenge[]; // newest first
  loggers: Record<string, LoggerState>;
};

const store = createStore<State>({ challenges: mockChallenges, loggers: {} });

export const useChallengeStore = store.useStore;
export const getChallengeState = store.get;
export const subscribeChallenges = store.subscribe;

const DEFAULT_REPS = 8;
const EMPTY_LOGGER: LoggerState = { draft: { weight: 0, reps: DEFAULT_REPS } };

export function loggerFor(state: State, challengeId: string): LoggerState {
  return state.loggers[challengeId] ?? EMPTY_LOGGER;
}

// --- Scoring -----------------------------------------------------------------

export const METRICS: Record<
  ChallengeMetric,
  { label: string; description: string; unit: (weightUnit: string) => string }
> = {
  volume: {
    label: 'Volume',
    description: 'Weight × reps, every set added up.',
    unit: (u) => u,
  },
  reps: {
    label: 'Total reps',
    description: 'Every rep counts, weight doesn’t. Great for bodyweight.',
    unit: () => 'reps',
  },
  heaviest: {
    label: 'Heaviest lift',
    description: 'Your single heaviest set wins.',
    unit: (u) => u,
  },
};

export function formatScore(score: number, metric: ChallengeMetric): string {
  const value = metric === 'heaviest' ? formatWeight(score) : formatNumber(score);
  return `${value} ${METRICS[metric].unit(mockMe.unit)}`;
}

export function setScore(set: Pick<ChallengeSet, 'weight' | 'reps'>, metric: ChallengeMetric): number {
  if (metric === 'volume') return set.weight * set.reps;
  if (metric === 'reps') return set.reps;
  return set.weight;
}

export function scoreSets(sets: ChallengeSet[], metric: ChallengeMetric): number {
  if (metric === 'heaviest') return sets.reduce((m, s) => Math.max(m, s.weight), 0);
  return sets.reduce((sum, s) => sum + setScore(s, metric), 0);
}

export type Standing = {
  user: UserSummary;
  isMe: boolean;
  score: number;
  /** null until they've scored; ties share a rank. */
  rank: number | null;
  setCount: number;
  lastSet: ChallengeSet | null;
};

export function standingsFor(c: Challenge): Standing[] {
  const rows = c.participants.map((user) => {
    const sets = c.sets.filter((s) => s.userId === user.id);
    return {
      user,
      isMe: user.id === mockMe.id,
      score: scoreSets(sets, c.metric),
      setCount: sets.length,
      lastSet: sets[sets.length - 1] ?? null,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r) => ({
    ...r,
    rank: r.score > 0 ? 1 + rows.filter((o) => o.score > r.score).length : null,
  }));
}

export function isHost(c: Challenge): boolean {
  return c.hostId === mockMe.id;
}

// --- Actions -----------------------------------------------------------------

function updateChallenge(id: string, fn: (c: Challenge) => Challenge) {
  const s = store.get();
  store.set({ ...s, challenges: s.challenges.map((c) => (c.id === id ? fn(c) : c)) });
}

function updateLogger(id: string, fn: (l: LoggerState) => LoggerState) {
  const s = store.get();
  store.set({ ...s, loggers: { ...s.loggers, [id]: fn(loggerFor(s, id)) } });
}

const ME: UserSummary = { id: mockMe.id, name: mockMe.name, handle: mockMe.handle, avatarUrl: mockMe.avatarUrl };

export type NewChallenge = {
  name: string;
  metric: ChallengeMetric;
  invite: UserSummary[];
};

function newCode() {
  return generateJoinCode(
    (code) => store.get().challenges.some((c) => c.code === code) || code in mockChallengeCodeDirectory,
  );
}

function insert(c: Challenge) {
  const s = store.get();
  store.set({ ...s, challenges: [c, ...s.challenges] });
}

export const challengeActions = {
  /** Opens a lobby you host. Invited friends get a notification (later: push). */
  create(input: NewChallenge): Challenge {
    const challenge: Challenge = {
      id: newId('ch'),
      code: newCode(),
      name: input.name,
      metric: input.metric,
      hostId: ME.id,
      participants: [ME],
      invited: input.invite,
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      status: 'lobby',
      sets: [],
    };
    insert(challenge);
    return challenge;
  },

  /**
   * Join by code. Returns the challenge, or null if no open challenge has it.
   * Your own challenges resolve locally; others come from the (mock) server.
   */
  join(rawCode: string): Challenge | null {
    const code = rawCode.toUpperCase();
    const existing = store.get().challenges.find((c) => c.code === code && c.status !== 'finished');
    if (existing) {
      if (!existing.participants.some((p) => p.id === ME.id)) challengeActions.markJoined(existing.id, ME);
      return store.get().challenges.find((c) => c.id === existing.id) ?? null;
    }
    const remote = mockChallengeCodeDirectory[code];
    if (!remote) return null;
    const challenge: Challenge = {
      id: newId('ch'),
      code,
      name: remote.name,
      metric: remote.metric,
      hostId: remote.host.id,
      participants: [remote.host, ...remote.others, ME],
      invited: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      status: 'lobby',
      sets: [],
    };
    insert(challenge);
    return challenge;
  },

  /** Someone joined (socket: `participant.joined`). */
  markJoined(challengeId: string, user: UserSummary) {
    updateChallenge(challengeId, (c) =>
      c.status === 'finished' || c.participants.some((p) => p.id === user.id)
        ? c
        : {
            ...c,
            participants: [...c.participants, user],
            invited: c.invited.filter((u) => u.id !== user.id),
          },
    );
  },

  /** Host only. Scores start counting. */
  start(challengeId: string) {
    updateChallenge(challengeId, (c) =>
      c.status === 'lobby' ? { ...c, status: 'live', startedAt: new Date().toISOString() } : c,
    );
  },

  /** Host cancels a lobby, or you leave one you joined. Drops it locally. */
  remove(challengeId: string) {
    const s = store.get();
    const loggers = { ...s.loggers };
    delete loggers[challengeId];
    store.set({ challenges: s.challenges.filter((c) => c.id !== challengeId), loggers });
  },

  /** New lobby with the same people and settings; you host it. */
  rematch(challengeId: string): Challenge | null {
    const c = store.get().challenges.find((x) => x.id === challengeId);
    if (!c) return null;
    return challengeActions.create({
      name: c.name,
      metric: c.metric,
      invite: c.participants.filter((p) => p.id !== ME.id),
    });
  },

  /** A set from anyone. Your own sets go through `logSet`; others arrive here from the socket. */
  addSet(challengeId: string, set: Omit<ChallengeSet, 'id' | 'loggedAt'>) {
    updateChallenge(challengeId, (c) =>
      c.status === 'live'
        ? { ...c, sets: [...c.sets, { ...set, id: newId('s'), loggedAt: new Date().toISOString() }] }
        : c,
    );
  },

  /** Logs your current draft. The draft stays put so the next set is one tap. */
  logSet(challengeId: string) {
    const l = loggerFor(store.get(), challengeId);
    if (l.draft.reps <= 0) return;
    challengeActions.addSet(challengeId, {
      userId: mockMe.id,
      weight: l.draft.weight,
      reps: l.draft.reps,
    });
  },

  removeSet(challengeId: string, setId: string) {
    updateChallenge(challengeId, (c) =>
      c.status === 'live' ? { ...c, sets: c.sets.filter((s) => !(s.id === setId && s.userId === mockMe.id)) } : c,
    );
  },

  setDraft(challengeId: string, draft: Partial<LoggerState['draft']>) {
    updateLogger(challengeId, (l) => ({
      draft: {
        weight: Math.max(0, draft.weight ?? l.draft.weight),
        reps: Math.max(0, Math.round(draft.reps ?? l.draft.reps)),
      },
    }));
  },

  /** Host only. Scores lock for everyone. */
  end(challengeId: string) {
    updateChallenge(challengeId, (c) =>
      c.status === 'live' ? { ...c, status: 'finished', endedAt: new Date().toISOString() } : c,
    );
  },
};
