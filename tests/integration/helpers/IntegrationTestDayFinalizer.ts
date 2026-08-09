import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";

const MAX_CLEAR_ATTEMPTS = 3;
const CLEAR_RETRY_DELAY_MS = 1_000;

export class IntegrationTestDayFinalizer {
	private readonly dayPlanClient: DayPlanClient;

	public constructor(dayPlanClient: DayPlanClient = new DayPlanClient()) {
		this.dayPlanClient = dayPlanClient;
	}

	public async clearDates(dates: readonly string[]): Promise<void> {
		for (const date of dates) {
			await this.clearDate(date);
		}
	}

	private async clearDate(date: string): Promise<void> {
		let lastError: unknown;

		for (let attempt = 0; attempt < MAX_CLEAR_ATTEMPTS; attempt += 1) {
			const dayPlan = await this.dayPlanClient.getDayPlan({ date });
			const items = dayPlan.meals.flatMap((meal) => meal.items.map((item) => ({ mealKey: meal.mealKey, item })));
			if (items.length === 0) {
				return;
			}

			const targets = items.flatMap(({ mealKey, item }) =>
				item.itemId === null ? [] : [{ mealKey, itemId: item.itemId }],
			);
			if (targets.length !== items.length) {
				throw new Error(`Cannot clear integration test day ${date}: an active meal item has no itemId`);
			}

			try {
				await this.dayPlanClient.removeMealItems({ date, items: targets });
				lastError = undefined;
			} catch (error) {
				lastError = error;
			}

			await wait(CLEAR_RETRY_DELAY_MS);
		}

		const remainingDayPlan = await this.dayPlanClient.getDayPlan({ date });
		const remainingItemCount = remainingDayPlan.meals.reduce((sum, meal) => sum + meal.items.length, 0);
		if (remainingItemCount === 0) {
			return;
		}

		throw new Error(
			`Failed to clear ${remainingItemCount} meal items from integration test day ${date}`,
			lastError === undefined ? undefined : { cause: lastError },
		);
	}
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
