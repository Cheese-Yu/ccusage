import type {
	ModelPricing,
	ModelUsage,
	PricingSource,
	TokenUsageEvent,
	WeeklyReportRow,
	WeeklyUsageSummary,
} from './_types.ts';
import type { WeekDay } from './date-utils.ts';
import { isWithinRange, toDateKey, toWeekKey } from './date-utils.ts';
import { addUsage, calculateCostUSD, createEmptyUsage } from './token-utils.ts';

export type WeeklyReportOptions = {
	timezone?: string;
	locale?: string;
	since?: string;
	until?: string;
	startOfWeek?: WeekDay;
	pricingSource: PricingSource;
};

function createSummary(week: string, initialTimestamp: string): WeeklyUsageSummary {
	return {
		week,
		firstTimestamp: initialTimestamp,
		inputTokens: 0,
		cachedInputTokens: 0,
		outputTokens: 0,
		reasoningOutputTokens: 0,
		totalTokens: 0,
		costUSD: 0,
		models: new Map(),
	};
}

export async function buildWeeklyReport(
	events: TokenUsageEvent[],
	options: WeeklyReportOptions,
): Promise<WeeklyReportRow[]> {
	const timezone = options.timezone;
	const since = options.since;
	const until = options.until;
	const startOfWeek = options.startOfWeek ?? 'sunday';
	const pricingSource = options.pricingSource;

	const summaries = new Map<string, WeeklyUsageSummary>();

	for (const event of events) {
		const modelName = event.model?.trim();
		if (modelName == null || modelName === '') {
			continue;
		}

		const dateKey = toDateKey(event.timestamp, timezone);
		if (!isWithinRange(dateKey, since, until)) {
			continue;
		}

		// Weekly buckets are calendar-week based (not rolling last-7-days windows).
		const weekKey = toWeekKey(event.timestamp, timezone, startOfWeek);
		const summary = summaries.get(weekKey) ?? createSummary(weekKey, event.timestamp);
		if (!summaries.has(weekKey)) {
			summaries.set(weekKey, summary);
		}

		addUsage(summary, event);
		const modelUsage: ModelUsage = summary.models.get(modelName) ?? {
			...createEmptyUsage(),
			isFallback: false,
		};
		if (!summary.models.has(modelName)) {
			summary.models.set(modelName, modelUsage);
		}
		addUsage(modelUsage, event);
		if (event.isFallbackModel === true) {
			modelUsage.isFallback = true;
		}
	}

	const uniqueModels = new Set<string>();
	for (const summary of summaries.values()) {
		for (const modelName of summary.models.keys()) {
			uniqueModels.add(modelName);
		}
	}

	const modelPricing = new Map<string, Awaited<ReturnType<PricingSource['getPricing']>>>();
	for (const modelName of uniqueModels) {
		modelPricing.set(modelName, await pricingSource.getPricing(modelName));
	}

	const rows: WeeklyReportRow[] = [];

	const sortedSummaries = Array.from(summaries.values()).sort((a, b) =>
		a.week.localeCompare(b.week),
	);
	for (const summary of sortedSummaries) {
		let cost = 0;
		for (const [modelName, usage] of summary.models) {
			const pricing = modelPricing.get(modelName);
			if (pricing == null) {
				continue;
			}
			cost += calculateCostUSD(usage, pricing);
		}
		summary.costUSD = cost;

		const rowModels: Record<string, ModelUsage> = {};
		for (const [modelName, usage] of summary.models) {
			rowModels[modelName] = { ...usage };
		}

		rows.push({
			week: summary.week,
			inputTokens: summary.inputTokens,
			cachedInputTokens: summary.cachedInputTokens,
			outputTokens: summary.outputTokens,
			reasoningOutputTokens: summary.reasoningOutputTokens,
			totalTokens: summary.totalTokens,
			costUSD: cost,
			models: rowModels,
		});
	}

	return rows;
}

if (import.meta.vitest != null) {
	describe('buildWeeklyReport', () => {
		it('aggregates events by week and supports custom week starts', async () => {
			const pricing = new Map([
				[
					'gpt-5',
					{ inputCostPerMToken: 1.25, cachedInputCostPerMToken: 0.125, outputCostPerMToken: 10 },
				],
				[
					'gpt-5-mini',
					{ inputCostPerMToken: 0.6, cachedInputCostPerMToken: 0.06, outputCostPerMToken: 2 },
				],
			]);
			const stubPricingSource: PricingSource = {
				async getPricing(model: string): Promise<ModelPricing> {
					const value = pricing.get(model);
					if (value == null) {
						throw new Error(`Missing pricing for ${model}`);
					}
					return value;
				},
			};
			const report = await buildWeeklyReport(
				[
					{
						sessionId: 'session-1',
						timestamp: '2025-09-14T03:00:00.000Z',
						model: 'gpt-5',
						inputTokens: 1_000,
						cachedInputTokens: 200,
						outputTokens: 500,
						reasoningOutputTokens: 0,
						totalTokens: 1_500,
					},
					{
						sessionId: 'session-1',
						timestamp: '2025-09-15T05:00:00.000Z',
						model: 'gpt-5-mini',
						inputTokens: 400,
						cachedInputTokens: 100,
						outputTokens: 200,
						reasoningOutputTokens: 50,
						totalTokens: 750,
					},
					{
						sessionId: 'session-2',
						timestamp: '2025-09-20T01:00:00.000Z',
						model: 'gpt-5',
						inputTokens: 2_000,
						cachedInputTokens: 0,
						outputTokens: 800,
						reasoningOutputTokens: 0,
						totalTokens: 2_800,
					},
				],
				{
					pricingSource: stubPricingSource,
					since: '2025-09-14',
					until: '2025-09-21',
					startOfWeek: 'monday',
				},
			);

			expect(report).toHaveLength(2);
			const first = report[0]!;
			expect(first.week).toBe('2025-09-08');
			expect(first.inputTokens).toBe(1_000);
			const second = report[1]!;
			expect(second.week).toBe('2025-09-15');
			expect(second.inputTokens).toBe(2_400);
			expect(second.cachedInputTokens).toBe(100);
			expect(second.outputTokens).toBe(1_000);
			expect(second.reasoningOutputTokens).toBe(50);
		});
	});
}
