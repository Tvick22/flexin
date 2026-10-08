/**
 * DEV ONLY — fakes the other side of the network so the live UI can be built
 * without a backend. Stands in for the challenge WebSocket:
 *  - invited friends join your lobby a few seconds after you create it,
 *  - challenges hosted by someone else (join code MAYA42) get started, and
 *    later ended, by that host,
 *  - other participants in a live challenge log sets every so often.
 *
 * Delete this file (and its call in app/_layout.tsx) once the backend exists.
 */

import { EXERCISES, type Exercise } from '@/data/exercises';
import { mockMe, type Challenge } from '@/data/mock-data';
import { challengeActions, getChallengeState, subscribeChallenges } from '@/stores/challenge-store';

export const SIMULATE = __DEV__;

const HOST_START_AFTER_MS = 6_000;
const HOST_END_AFTER_MS = 3 * 60_000;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const findChallenge = (id: string) => getChallengeState().challenges.find((c) => c.id === id);

/** Stable per-person strength so someone doesn't bench 95 then 225. */
function baseWeight(userId: string): number {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 95 + (h % 12) * 10; // 95–205
}

function weightFor(userId: string, exercise: Exercise): number {
  if (exercise.equipment === 'Bodyweight') return 0;
  const scale = exercise.equipment === 'Dumbbell' ? 0.35 : exercise.equipment === 'Barbell' ? 1 : 0.7;
  return Math.max(5, Math.round((baseWeight(userId) * scale * rand(0.85, 1.15)) / 5) * 5);
}

function logOpponentSet(c: Challenge) {
  const others = c.participants.filter((p) => p.id !== mockMe.id);
  if (others.length === 0) return;
  const who = pick(others);
  // Bodyweight sets score 0 for volume/heaviest, which makes for a dull demo.
  const pool = c.metric === 'reps' ? EXERCISES : EXERCISES.filter((e) => e.equipment !== 'Bodyweight');
  const exercise = pick(pool);
  challengeActions.addSet(c.id, {
    userId: who.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    weight: weightFor(who.id, exercise),
    reps: Math.round(rand(5, 12)),
  });
}

const handled = new Set<string>(); // `${kind}:${id}` so each thing is scheduled once

function once(key: string, fn: () => void) {
  if (handled.has(key)) return;
  handled.add(key);
  fn();
}

function simulateChallenge(c: Challenge) {
  // Invited friends trickle into the lobby.
  for (const user of c.invited) {
    once(`join:${c.id}:${user.id}`, () =>
      setTimeout(() => challengeActions.markJoined(c.id, user), rand(1_500, 4_000)),
    );
  }

  // Someone else is hosting: they start it, and eventually end it.
  if (c.hostId !== mockMe.id) {
    if (c.status === 'lobby') {
      once(`start:${c.id}`, () => setTimeout(() => challengeActions.start(c.id), HOST_START_AFTER_MS));
    }
    if (c.status === 'live') {
      once(`end:${c.id}`, () => setTimeout(() => challengeActions.end(c.id), HOST_END_AFTER_MS));
    }
  }

  // Other participants log sets while it's live.
  if (c.status === 'live') {
    once(`sets:${c.id}`, () => {
      const tick = (delayMs: number) =>
        setTimeout(() => {
          const current = findChallenge(c.id);
          if (current?.status !== 'live') return;
          logOpponentSet(current);
          tick(rand(10_000, 25_000));
        }, delayMs);
      tick(rand(3_000, 6_000)); // first set lands quickly so the board comes alive
    });
  }
}

let started = false;

export function startDevSimulation() {
  if (!SIMULATE || started) return;
  started = true;
  subscribeChallenges(() => {
    for (const c of getChallengeState().challenges) if (c.status !== 'finished') simulateChallenge(c);
  });
}
