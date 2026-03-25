import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
	DEFAULT_LOCALE,
	isSupportedLocale,
	resolveLocaleFromAcceptLanguage,
} from './18n/config';

const isPublic = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/api/chat(.*)',
	'/api/intake/preview-chat(.*)',
	'/w/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
	const urlLocale = req.nextUrl.searchParams.get('locale');
	const existingLocale = req.cookies.get('locale')?.value;
	const detectedLocale = resolveLocaleFromAcceptLanguage(
		req.headers.get('accept-language'),
	);
	const locale = isSupportedLocale(urlLocale)
		? urlLocale
		: isSupportedLocale(existingLocale)
		? existingLocale
		: detectedLocale ?? DEFAULT_LOCALE;

	const requestHeaders = new Headers(req.headers);
	requestHeaders.set('x-wrenlo-locale', locale);
	const response = NextResponse.next({ request: { headers: requestHeaders } });

	if (isSupportedLocale(urlLocale) || !isSupportedLocale(existingLocale)) {
		response.cookies.set('locale', locale, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false,
		});
	}

	if (!isPublic(req)) await auth.protect();

	return response;
});

export const config = {
	matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
