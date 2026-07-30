import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FitatuClientError } from "../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";

interface TrackedMealItem {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}

const CLEANUP_ATTEMPTS = 60;

export class CleanupTracker {
	private readonly items;
	private readonly recipeIds;
	private readonly dayPlanClient;
	private readonly recipeClient;

	public constructor(dayPlanClient: DayPlanClient, recipeClient?: RecipeClient) {
		this.dayPlanClient = dayPlanClient;
		this.recipeClient = recipeClient;
		this.items = new Map<string, TrackedMealItem>();
		this.recipeIds = new Set<string>();
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

	public trackRecipe(recipeId: string | null | undefined): void {
		if (recipeId) {
			this.recipeIds.add(recipeId);
		}
	}

	public untrackRecipe(recipeId: string | null | undefined): void {
		if (recipeId) {
			this.recipeIds.delete(recipeId);
		}
	}

	public async cleanup(): Promise<void> {
		const trackedItems = [...this.items.values()].reverse();

		for (const item of trackedItems) {
			try {
				await this.dayPlanClient.removeMealItem({
					date: item.date,
					mealKey: item.mealKey,
					itemId: item.itemId,
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

		if (!this.recipeClient) {
			return;
		}

		for (const recipeId of [...this.recipeIds].reverse()) {
			try {
				await this.recipeClient.deleteRecipe(recipeId);
				this.recipeIds.delete(recipeId);
			} catch (error) {
				if (!isMissingRecipeClientFailure(error)) {
					throw error;
				}
				this.recipeIds.delete(recipeId);
			}
		}
	}

	private key(date: string, mealKey: string, itemId: string): string {
		return `${date}:${mealKey}:${itemId}`;
	}

	private async waitUntilAbsent(item: TrackedMealItem): Promise<void> {
		for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
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

function isMissingRecipeClientFailure(error: unknown): boolean {
	return (
		error instanceof FitatuClientError &&
		error.failure.kind === "http" &&
		(error.failure.statusCode === 404 || error.failure.statusCode === 410)
	);
}

function isNotFoundError(error: unknown): boolean {
	return error instanceof Error && error.message.toLowerCase().includes("not found");
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
