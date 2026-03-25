'use server';

import { isSupportedLocale, type AppLocale } from '@/18n/config';
import { cookies } from 'next/headers';

export async function setLocaleAction(locale: AppLocale) {
  if (!isSupportedLocale(locale)) {
    throw new Error('Unsupported locale');
  }

  const store = await cookies();
  store.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
}
