function safeTimeZone(timezone?: string): string {
	if (timezone == null || timezone.trim() === '') {
		return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
	}

	try {
		// Validate timezone by creating a formatter
		Intl.DateTimeFormat('en-US', { timeZone: timezone });
		return timezone;
	} catch {
		return 'UTC';
	}
}

export function toDateKey(timestamp: string, timezone?: string): string {
	const tz = safeTimeZone(timezone);
	const date = new Date(timestamp);
	const formatter = new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone: tz,
	});
	return formatter.format(date);
}

export function normalizeFilterDate(value?: string): string | undefined {
	if (value == null) {
		return undefined;
	}

	const compact = value.replaceAll('-', '').trim();
	if (!/^\d{8}$/.test(compact)) {
		throw new Error(`Invalid date format: ${value}. Expected YYYYMMDD or YYYY-MM-DD.`);
	}

	return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function shiftDateKey(dateKey: string, days: number): string {
	const [yearStr = '0', monthStr = '1', dayStr = '1'] = dateKey.split('-');
	const year = Number.parseInt(yearStr, 10);
	const month = Number.parseInt(monthStr, 10);
	const day = Number.parseInt(dayStr, 10);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function normalizeLastDays(value: string): number {
	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		throw new Error(`Invalid --day value: ${value}. Expected a positive integer.`);
	}

	const parsed = Number.parseInt(normalized, 10);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid --day value: ${value}. Expected a positive integer.`);
	}

	return parsed;
}

export function getLastDaysRange(
	dayCount: number,
	timezone?: string,
): { since: string; until: string } {
	const todayKey = toDateKey(new Date().toISOString(), timezone);
	return {
		since: shiftDateKey(todayKey, -dayCount),
		until: shiftDateKey(todayKey, -1),
	};
}

export function isWithinRange(dateKey: string, since?: string, until?: string): boolean {
	const value = dateKey.replaceAll('-', '');
	const sinceValue = since?.replaceAll('-', '');
	const untilValue = until?.replaceAll('-', '');

	if (sinceValue != null && value < sinceValue) {
		return false;
	}

	if (untilValue != null && value > untilValue) {
		return false;
	}

	return true;
}

export function formatDisplayDate(dateKey: string, locale?: string, _timezone?: string): string {
	// dateKey is already computed for the target timezone via toDateKey().
	// Treat it as a plain calendar date and avoid shifting it by applying a timezone.
	const [yearStr = '0', monthStr = '1', dayStr = '1'] = dateKey.split('-');
	const year = Number.parseInt(yearStr, 10);
	const month = Number.parseInt(monthStr, 10);
	const day = Number.parseInt(dayStr, 10);
	const date = new Date(Date.UTC(year, month - 1, day));
	const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		timeZone: 'UTC',
	});
	return formatter.format(date);
}

export function toMonthKey(timestamp: string, timezone?: string): string {
	const tz = safeTimeZone(timezone);
	const date = new Date(timestamp);
	const formatter = new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		timeZone: tz,
	});
	const [year, month] = formatter.format(date).split('-');
	return `${year}-${month}`;
}

export function formatDisplayMonth(monthKey: string, locale?: string, _timezone?: string): string {
	// monthKey is already derived in the target timezone via toMonthKey().
	// Render it as a calendar month without shifting by timezone.
	const [yearStr = '0', monthStr = '1'] = monthKey.split('-');
	const year = Number.parseInt(yearStr, 10);
	const month = Number.parseInt(monthStr, 10);
	const date = new Date(Date.UTC(year, month - 1, 1));
	const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', {
		year: 'numeric',
		month: 'short',
		timeZone: 'UTC',
	});
	return formatter.format(date);
}

export function formatDisplayDateTime(
	timestamp: string,
	locale?: string,
	timezone?: string,
): string {
	const tz = safeTimeZone(timezone);
	const date = new Date(timestamp);
	const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: tz,
	});
	return formatter.format(date);
}

if (import.meta.vitest != null) {
	describe('normalizeLastDays', () => {
		it('parses positive integer strings', () => {
			expect(normalizeLastDays('10')).toBe(10);
			expect(normalizeLastDays(' 3 ')).toBe(3);
		});

		it('throws for non-numeric, zero, and negative values', () => {
			expect(() => normalizeLastDays('abc')).toThrow();
			expect(() => normalizeLastDays('0')).toThrow();
			expect(() => normalizeLastDays('-2')).toThrow();
		});
	});

	describe('getLastDaysRange', () => {
		it('returns an inclusive range ending yesterday in the target timezone', () => {
			const range = getLastDaysRange(10, 'UTC');
			expect(range.until < toDateKey(new Date().toISOString(), 'UTC')).toBe(true);
			expect(isWithinRange(range.since, range.since, range.until)).toBe(true);
		});
	});
}
