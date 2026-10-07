/**
 * Built-in exercise library. Will eventually come from GET /exercises;
 * ids are stable slugs so logged workouts can reference them.
 */

export type Muscle = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';
export type Equipment = 'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight';

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
};

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export const EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'incline-bench-press', name: 'Incline Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'db-bench-press', name: 'Dumbbell Bench Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'cable-fly', name: 'Cable Fly', muscle: 'Chest', equipment: 'Cable' },
  { id: 'push-up', name: 'Push-up', muscle: 'Chest', equipment: 'Bodyweight' },
  { id: 'dip', name: 'Dip', muscle: 'Chest', equipment: 'Bodyweight' },

  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', equipment: 'Barbell' },
  { id: 'barbell-row', name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell' },
  { id: 'db-row', name: 'Dumbbell Row', muscle: 'Back', equipment: 'Dumbbell' },
  { id: 'pull-up', name: 'Pull-up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'chin-up', name: 'Chin-up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscle: 'Back', equipment: 'Cable' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'Back', equipment: 'Cable' },

  { id: 'back-squat', name: 'Back Squat', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'front-squat', name: 'Front Squat', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'hip-thrust', name: 'Hip Thrust', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'leg-press', name: 'Leg Press', muscle: 'Legs', equipment: 'Machine' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscle: 'Legs', equipment: 'Dumbbell' },
  { id: 'walking-lunge', name: 'Walking Lunge', muscle: 'Legs', equipment: 'Dumbbell' },
  { id: 'leg-extension', name: 'Leg Extension', muscle: 'Legs', equipment: 'Machine' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'Legs', equipment: 'Machine' },
  { id: 'calf-raise', name: 'Calf Raise', muscle: 'Legs', equipment: 'Machine' },

  { id: 'overhead-press', name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell' },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle: 'Shoulders', equipment: 'Dumbbell' },

  { id: 'barbell-curl', name: 'Barbell Curl', muscle: 'Arms', equipment: 'Barbell' },
  { id: 'db-curl', name: 'Dumbbell Curl', muscle: 'Arms', equipment: 'Dumbbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Arms', equipment: 'Dumbbell' },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', muscle: 'Arms', equipment: 'Cable' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle: 'Arms', equipment: 'Barbell' },
  { id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', muscle: 'Arms', equipment: 'Dumbbell' },

  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscle: 'Core', equipment: 'Cable' },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', muscle: 'Core', equipment: 'Bodyweight' },
];
