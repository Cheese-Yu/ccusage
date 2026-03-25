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

function dateKeyToUtcDate(dateKey: string): Date {
	const [yearStr = '0', monthStr = '1', dayStr = '1'] = dateKey.split('-');
	const year = Number.parseInt(yearStr, 10);
	const month = Number.parseInt(monthStr, 10);
	const day = Number.parseInt(dayStr, 10);
	return new Date(Date.UTC(year, month - 1, day));
}

function toNormalizedDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
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
	const date = dateKeyToUtcDate(dateKey);
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

export function getLastNDaysDateRange(
	day: number,
	timezone?: string,
	now: Date = new Date(),
): {
	since: string;
	until: string;
} {
	if (!Number.isInteger(day) || day < 1) {
		throw new Error('Invalid day value. Expected a positive integer.');
	}

	const todayKey = toDateKey(now.toISOString(), timezone);
	const today = dateKeyToUtcDate(todayKey);

	const until = new Date(today);
	until.setUTCDate(until.getUTCDate() - 1);

	const since = new Date(today);
	since.setUTCDate(since.getUTCDate() - day);

	return {
		since: toNormalizedDateKey(since),
		until: toNormalizedDateKey(until),
	};
}

if (import.meta.vitest != null) {
	describe('getLastNDaysDateRange', () => {
		it('returns inclusive range ending yesterday in UTC timezone', () => {
			const range = getLastNDaysDateRange(10, 'UTC', new Date('2026-03-25T12:00:00.000Z'));
			expect(range).toEqual({
				since: '2026-03-15',
				until: '2026-03-24',
			});
		});

		it('calculates yesterday from timezone-specific current day', () => {
			const range = getLastNDaysDateRange(
				1,
				'America/Los_Angeles',
				new Date('2026-03-25T01:00:00.000Z'),
			);
			expect(range).toEqual({
				since: '2026-03-23',
				until: '2026-03-23',
			});
		});

		it('throws when day is invalid', () => {
			expect(() => getLastNDaysDateRange(0)).toThrow('Invalid day value');
			expect(() => getLastNDaysDateRange(-1)).toThrow('Invalid day value');
			expect(() => getLastNDaysDateRange(1.5)).toThrow('Invalid day value');
			expect(() => getLastNDaysDateRange(Number.NaN)).toThrow('Invalid day value');
			expect(() => getLastNDaysDateRange('10' as unknown as number)).toThrow('Invalid day value');
		});
	});
}
