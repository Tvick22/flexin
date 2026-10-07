/** No 0/O, 1/I/L so codes survive being read aloud or typed from a screenshot. */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 8;

/** Uppercases and drops anything that isn't part of a code (spaces, dashes). */
export function normalizeFriendCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((c) => FRIEND_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, FRIEND_CODE_LENGTH);
}

export function isValidFriendCode(code: string): boolean {
  return code.length === FRIEND_CODE_LENGTH && normalizeFriendCode(code) === code;
}

/** 7K2Q9MXP → 7K2Q-9MXP */
export function formatFriendCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
