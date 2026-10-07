import * as Linking from 'expo-linking';

import { FRIEND_CODE_ALPHABET } from '@/utils/friend-code';

export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)];
    }
    if (!taken(code)) return code;
  }
}

/** Uppercases and drops anything that isn't part of a code. */
export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((c) => FRIEND_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, JOIN_CODE_LENGTH);
}

/** K7Q2MX → K7Q 2MX */
export function formatJoinCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** flexin://join/K7Q2MX in builds; the dev server URL on web / Expo Go. */
export function joinLink(code: string): string {
  return Linking.createURL(`/join/${code}`);
}
