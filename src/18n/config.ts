export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type AppLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export function isSupportedLocale(
	value: string | null | undefined,
): value is AppLocale {
	if (!value) return false;
	return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function resolveLocaleFromAcceptLanguage(
	headerValue: string | null,
): AppLocale {
	if (!headerValue) return DEFAULT_LOCALE;

	const tokens = headerValue
		.split(',')
		.map(part => part.trim().toLowerCase().split(';')[0])
		.filter(Boolean);

	for (const token of tokens) {
		if (isSupportedLocale(token)) return token;
		const base = token.split('-')[0];
		if (isSupportedLocale(base)) return base;
	}

	return DEFAULT_LOCALE;
}
