'use server';

import { cookies } from 'next/headers';

export async function setAppThemeCookie(theme: 'dark' | 'light') {
	const store = await cookies();
	store.set('wrenlo-app-theme', theme, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
	});
}
