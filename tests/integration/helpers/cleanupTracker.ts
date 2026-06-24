import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";

interface TrackedMealItem {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}

export class CleanupTracker {
	private readonly items;
	private readonly dayPlanClient;

	public constructor(dayPlanClient: DayPlanClient) {
		this.dayPlanClient = dayPlanClient;
		this.items = new Map<string, TrackedMealItem>();
	}

	public track(date: string, mealKey: string, itemId: string | null | undefined): void {
		if (!itemId) {
			return;
		}

		this.items.set(this.key(date, mealKey, itemId), { date, mealKey, itemId });
	}

	public untrack(date: string, mealKey: string, itemId: string | null | undefined): void {
		if (!itemId) {
			return;
		}

		this.items.delete(this.key(date, mealKey, itemId));
	}

	public move(options: {
		readonly fromDate: string;
		readonly fromMealKey: string;
		readonly oldItemId: string | null | undefined;
		readonly toDate: string;
		readonly toMealKey: string;
		readonly newItemId: string | null | undefined;
	}): void {
		this.untrack(options.fromDate, options.fromMealKey, options.oldItemId);
		this.track(options.toDate, options.toMealKey, options.newItemId);
	}

	public async cleanup(): Promise<void> {
		const trackedItems = [...this.items.values()].reverse();

		for (const item of trackedItems) {
			try {
				await this.dayPlanClient.removeMealItem({
					date: item.date,
					mealKey: item.mealKey,
					itemId: item.itemId,
					itemKind: "auto",
				});
				await this.waitUntilAbsent(item);
				this.untrack(item.date, item.mealKey, item.itemId);
			} catch (error) {
				if (!isNotFoundError(error)) {
					throw error;
				}
				this.untrack(item.date, item.mealKey, item.itemId);
			}
		}
	}

	private key(date: string, mealKey: string, itemId: string): string {
		return `${date}:${mealKey}:${itemId}`;
	}

	private async waitUntilAbsent(item: TrackedMealItem): Promise<void> {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const dayPlan = await this.dayPlanClient.getDayPlan({ date: item.date });
			const meal = dayPlan.meals.find((candidate) => candidate.mealKey === item.mealKey);
			const exists = meal?.items.some((candidate) => candidate.itemId === item.itemId) ?? false;
			if (!exists) {
				return;
			}
			await wait(1_000);
		}

		throw new Error(`Cleanup did not remove item ${item.itemId} from ${item.mealKey} on ${item.date}`);
	}
}

function isNotFoundError(error: unknown): boolean {
	return error instanceof Error && error.message.toLowerCase().includes("not found");
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
