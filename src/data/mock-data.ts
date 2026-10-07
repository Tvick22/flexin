/**
 * Placeholder data shaped like the expected API responses.
 * The types here are the contract the FastAPI backend should satisfy.
 * Timestamps are ISO 8601 strings; weights are in `unit`.
 */

export type WeightUnit = 'lb' | 'kg';

export type UserSummary = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
};

// GET /me
export type Me = UserSummary & { unit: WeightUnit };

// GET /challenges/current  (null when there's no active challenge)
export type ChallengeStanding = {
  rank: number;
  user: UserSummary;
  volume: number;
  workouts: number;
};

export type WeeklyChallenge = {
  id: string;
  weekStart: string;
  endsAt: string;
  metric: 'volume';
  unit: WeightUnit;
  standings: ChallengeStanding[];
};

// GET /workouts?limit=…  and  GET /workouts/{id}
export type WorkoutSummary = {
  id: string;
  title: string;
  completedAt: string;
  durationMin: number;
  totalVolume: number;
  setCount: number;
  exerciseCount: number;
  prCount: number;
};

export type WorkoutExerciseSummary = {
  name: string;
  sets: number;
  topSet: { weight: number; reps: number };
  isPr: boolean;
};

export type LastWorkout = WorkoutSummary & {
  exercises: WorkoutExerciseSummary[];
};

// GET /feed
export type FeedItem = {
  id: string;
  type: 'workout_completed' | 'pr' | 'challenge_overtake';
  user: UserSummary;
  createdAt: string;
  headline: string;
  detail: string | null;
  flexCount: number;
  flexedByMe: boolean;
};

// GET /users/{id}/profile
export type PersonalRecord = {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  achievedAt: string;
};

export type ConsistencyDay = {
  date: string; // YYYY-MM-DD
  status: 'rest' | 'trained' | 'pr';
};

export type Profile = {
  user: UserSummary;
  unit: WeightUnit;
  stats: { workouts: number; streakDays: number; friends: number };
  bigThree: {
    total: number;
    lifts: { lift: 'Squat' | 'Bench' | 'Deadlift'; weight: number | null }[];
  };
  prs: PersonalRecord[];
  consistency: ConsistencyDay[]; // 84 days (12 weeks), oldest first, starting on a Monday
  recentWorkouts: WorkoutSummary[];
};

// --- Mock values -------------------------------------------------------------
// A brand-new user: signed up, no friends, no workouts yet.

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  return out;
}

const weekStart = startOfWeek(new Date(now));

const me: UserSummary = { id: 'u_me', name: 'Trevor Vick', handle: 'tvick', avatarUrl: null };

export const mockMe: Me = { ...me, unit: 'lb' };

// null = the user isn't in an active challenge (GET /challenges/current → 204 or `null`).
export const mockWeeklyChallenge: WeeklyChallenge | null = null;

export const mockLastWorkout: LastWorkout | null = null;

export const mockFeed: FeedItem[] = [];

function emptyConsistency(): ConsistencyDay[] {
  const start = new Date(weekStart.getTime() - 11 * 7 * DAY);
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date, status: 'rest' as const };
  });
}

export const mockProfile: Profile = {
  user: me,
  unit: 'lb',
  stats: { workouts: 0, streakDays: 0, friends: 0 },
  bigThree: {
    total: 0,
    lifts: [
      { lift: 'Squat', weight: null },
      { lift: 'Bench', weight: null },
      { lift: 'Deadlift', weight: null },
    ],
  },
  prs: [],
  consistency: emptyConsistency(),
  recentWorkouts: [],
};
