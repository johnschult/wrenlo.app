import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import {
	DEFAULT_LOCALE,
	isSupportedLocale,
	resolveLocaleFromAcceptLanguage,
} from './config';

export default getRequestConfig(async () => {
	const store = await cookies();
	const requestedLocale = store.get('locale')?.value;
	const headerStore = await headers();
	const localeFromMiddleware = headerStore.get('x-wrenlo-locale');
	const detectedLocale = resolveLocaleFromAcceptLanguage(
		headerStore.get('accept-language'),
	);
	const locale = isSupportedLocale(localeFromMiddleware)
		? localeFromMiddleware
		: isSupportedLocale(requestedLocale)
		? requestedLocale
		: detectedLocale ?? DEFAULT_LOCALE;

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
