/**
 * Flexin' design tokens.
 *
 * Plate colors are the only accents, and they ALWAYS encode rank:
 * red = 1st, blue = 2nd, yellow = 3rd, green = 4th and below.
 * Red doubles as the primary CTA color and the PR marker.
 */

import type { TextStyle } from 'react-native';

export const Plate = {
  red: '#D0312D',
  blue: '#1F5FBF',
  yellow: '#F2B705',
  green: '#2E8B57',
} as const;

export const Palette = {
  chalk: '#EDEFF2',
  ink: '#16203A',
  surface: '#FFFFFF',
  // Tints of ink / white rather than new hues.
  inkMuted: 'rgba(22, 32, 58, 0.6)',
  inkFaint: 'rgba(22, 32, 58, 0.35)',
  line: 'rgba(22, 32, 58, 0.1)',
  wash: 'rgba(22, 32, 58, 0.05)',
  onInk: '#FFFFFF',
  onInkMuted: 'rgba(255, 255, 255, 0.6)',
  onInkLine: 'rgba(255, 255, 255, 0.12)',
} as const;

export const Colors = {
  background: Palette.chalk,
  surface: Palette.surface,
  text: Palette.ink,
  textMuted: Palette.inkMuted,
  textFaint: Palette.inkFaint,
  line: Palette.line,
  // Gray placeholder boxes (e.g. "create a challenge").
  wash: Palette.wash,
  primary: Plate.red,
  onPrimary: Palette.onInk,
  pr: Plate.red,
  // Dark "ink" cards (challenge, big three).
  inkCard: Palette.ink,
  onInkCard: Palette.onInk,
  onInkCardMuted: Palette.onInkMuted,
  onInkCardLine: Palette.onInkLine,
} as const;

export function rankColor(rank: number): string {
  if (rank === 1) return Plate.red;
  if (rank === 2) return Plate.blue;
  if (rank === 3) return Plate.yellow;
  return Plate.green;
}

/** Foreground to use on top of a rank plate (yellow needs ink for contrast). */
export function onRankColor(rank: number): string {
  return rank === 3 ? Palette.ink : Palette.onInk;
}

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

const num: TextStyle = { fontVariant: ['tabular-nums'] };

export const Type = {
  display: { fontSize: 44, fontWeight: '900', letterSpacing: -1, ...num },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 15, fontWeight: '600' },
  bodyStrong: { fontSize: 15, fontWeight: '800' },
  caption: { fontSize: 13, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  stat: { fontSize: 22, fontWeight: '900', ...num },
  number: { fontWeight: '800', ...num },
} satisfies Record<string, TextStyle>;
