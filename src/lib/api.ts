/**
 * Flexin' API client. JSON is camelCase on both sides.
 * Base URL: EXPO_PUBLIC_API_URL (see .env.example; set it in .env.local).
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

/** GET /me (backend MeRead). */
export type ApiMe = {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  unit: 'lb' | 'kg';
  friendCode: string;
  onboarded: boolean;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'bearer';
  expiresIn: number;
  user: ApiMe;
  isNewUser: boolean;
};

export type HandleAvailability = {
  handle: string;
  available: boolean;
  reason: 'taken' | 'invalid' | null;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The server couldn't be reached at all (offline, wrong URL, server down). */
export class NetworkError extends Error {}

type AuthBinding = {
  accessToken: () => string | null;
  /** Try to get a fresh access token; resolves false if the user must sign in again. */
  refresh: () => Promise<boolean>;
};

let auth: AuthBinding | null = null;

/** Called once by the auth store so requests can attach and renew tokens. */
export function bindAuth(binding: AuthBinding) {
  auth = binding;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the access token and retry once after a refresh on 401. Default true. */
  authenticated?: boolean;
  timeoutMs?: number;
};

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = opts.authenticated === false ? null : auth?.accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    return await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError(`Couldn't reach the Flexin' server at ${API_URL}.`);
  } finally {
    clearTimeout(timer);
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    // FastAPI validation errors: [{ msg: "Value error, Handles are ..." }]
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') {
      return detail[0].msg.replace(/^Value error, /, '');
    }
  } catch {
    // not JSON
  }
  return `Request failed (${res.status})`;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts);
  if (res.status === 401 && opts.authenticated !== false && auth && (await auth.refresh())) {
    res = await send(path, opts);
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}
