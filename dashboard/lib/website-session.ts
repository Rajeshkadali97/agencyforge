import { randomUUID } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'wb_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveUserId(request: NextRequest): { userId: string; isNew: boolean } {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing && UUID_REGEX.test(existing)) {
    return { userId: existing, isNew: false };
  }
  return { userId: randomUUID(), isNew: true };
}

export function setUserIdCookie(response: NextResponse, userId: string): void {
  response.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getSessionUserId(): Promise<string> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? '';
}
