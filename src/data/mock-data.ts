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

// GET /races/current
export type RaceStanding = {
  rank: number;
  user: UserSummary;
  volume: number;
  workouts: number;
};

export type WeeklyRace = {
  id: string;
  weekStart: string;
  endsAt: string;
  metric: 'volume';
  unit: WeightUnit;
  standings: RaceStanding[];
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
  type: 'workout_completed' | 'pr' | 'race_overtake';
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
    lifts: { lift: 'Squat' | 'Bench' | 'Deadlift'; weight: number }[];
  };
  prs: PersonalRecord[];
  consistency: ConsistencyDay[]; // 84 days (12 weeks), oldest first, starting on a Monday
  recentWorkouts: WorkoutSummary[];
};

// --- Mock values -------------------------------------------------------------
// Dates are relative to "now" so the placeholder UI always looks current.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  return out;
}

const weekStart = startOfWeek(new Date(now));
const weekEnd = new Date(weekStart.getTime() + 7 * DAY);

const users = {
  me: { id: 'u_me', name: 'Trevor Vick', handle: 'tvick', avatarUrl: null },
  maya: { id: 'u_maya', name: 'Maya Chen', handle: 'mayalifts', avatarUrl: null },
  jordan: { id: 'u_jordan', name: 'Jordan Reyes', handle: 'jreyes', avatarUrl: null },
  sam: { id: 'u_sam', name: 'Sam Okafor', handle: 'samo', avatarUrl: null },
  priya: { id: 'u_priya', name: 'Priya Nair', handle: 'priyapulls', avatarUrl: null },
} satisfies Record<string, UserSummary>;

export const mockMe: Me = { ...users.me, unit: 'lb' };

export const mockWeeklyRace: WeeklyRace = {
  id: 'race_current',
  weekStart: weekStart.toISOString(),
  endsAt: weekEnd.toISOString(),
  metric: 'volume',
  unit: 'lb',
  standings: [
    { rank: 1, user: users.maya, volume: 48250, workouts: 4 },
    { rank: 2, user: users.me, volume: 46910, workouts: 3 },
    { rank: 3, user: users.jordan, volume: 39400, workouts: 3 },
    { rank: 4, user: users.sam, volume: 31275, workouts: 2 },
    { rank: 5, user: users.priya, volume: 22980, workouts: 2 },
  ],
};

export const mockLastWorkout: LastWorkout = {
  id: 'w_104',
  title: 'Push Day',
  completedAt: ago(20 * HOUR),
  durationMin: 68,
  totalVolume: 16420,
  setCount: 18,
  exerciseCount: 5,
  prCount: 1,
  exercises: [
    { name: 'Bench Press', sets: 5, topSet: { weight: 245, reps: 3 }, isPr: true },
    { name: 'Overhead Press', sets: 4, topSet: { weight: 135, reps: 5 }, isPr: false },
    { name: 'Incline DB Press', sets: 3, topSet: { weight: 80, reps: 8 }, isPr: false },
  ],
};

export const mockFeed: FeedItem[] = [
  {
    id: 'f_1',
    type: 'race_overtake',
    user: users.maya,
    createdAt: ago(25 * 60 * 1000),
    headline: 'passed you for 1st in the weekly race',
    detail: 'Leg Day · 12,800 lb',
    flexCount: 3,
    flexedByMe: false,
  },
  {
    id: 'f_2',
    type: 'pr',
    user: users.jordan,
    createdAt: ago(3 * HOUR),
    headline: 'hit a new Deadlift PR',
    detail: '455 lb × 2',
    flexCount: 7,
    flexedByMe: true,
  },
  {
    id: 'f_3',
    type: 'workout_completed',
    user: users.sam,
    createdAt: ago(9 * HOUR),
    headline: 'finished Pull Day',
    detail: '54 min · 9,640 lb',
    flexCount: 1,
    flexedByMe: false,
  },
  {
    id: 'f_4',
    type: 'workout_completed',
    user: users.priya,
    createdAt: ago(26 * HOUR),
    headline: 'finished Full Body',
    detail: '41 min · 7,215 lb',
    flexCount: 2,
    flexedByMe: false,
  },
];

function mockConsistency(): ConsistencyDay[] {
  const start = new Date(weekStart.getTime() - 11 * 7 * DAY);
  const today = new Date(now);
  const days: ConsistencyDay[] = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Deterministic pattern: Mon/Wed/Fri plus some Saturdays, a PR every ~10 sessions.
    const dow = i % 7;
    const trained = d <= today && (dow === 0 || dow === 2 || dow === 4 || (dow === 5 && i % 3 === 0));
    const pr = trained && (i * 7) % 23 === 0;
    days.push({ date: iso, status: pr ? 'pr' : trained ? 'trained' : 'rest' });
  }
  return days;
}

export const mockProfile: Profile = {
  user: users.me,
  unit: 'lb',
  stats: { workouts: 142, streakDays: 9, friends: 4 },
  bigThree: {
    total: 1135,
    lifts: [
      { lift: 'Squat', weight: 385 },
      { lift: 'Bench', weight: 245 },
      { lift: 'Deadlift', weight: 505 },
    ],
  },
  prs: [
    { id: 'pr_1', exercise: 'Bench Press', weight: 245, reps: 3, achievedAt: ago(20 * HOUR) },
    { id: 'pr_2', exercise: 'Deadlift', weight: 505, reps: 1, achievedAt: ago(12 * DAY) },
    { id: 'pr_3', exercise: 'Back Squat', weight: 385, reps: 2, achievedAt: ago(26 * DAY) },
    { id: 'pr_4', exercise: 'Overhead Press', weight: 155, reps: 1, achievedAt: ago(41 * DAY) },
  ],
  consistency: mockConsistency(),
  recentWorkouts: [
    mockLastWorkout,
    {
      id: 'w_103',
      title: 'Leg Day',
      completedAt: ago(2 * DAY + 3 * HOUR),
      durationMin: 74,
      totalVolume: 18950,
      setCount: 20,
      exerciseCount: 5,
      prCount: 0,
    },
    {
      id: 'w_102',
      title: 'Pull Day',
      completedAt: ago(4 * DAY + 2 * HOUR),
      durationMin: 61,
      totalVolume: 11540,
      setCount: 17,
      exerciseCount: 5,
      prCount: 0,
    },
  ],
};
