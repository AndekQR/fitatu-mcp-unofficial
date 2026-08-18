import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import type { AddMealItemsOptions } from "../../../src/api/dayPlan/AddMealItemsOptions.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import type { MealItemMutationResult } from "../../../src/api/dayPlan/MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "../../../src/api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../../src/api/dayPlan/RemoveMealItemsOptions.ts";
import type { ReplaceMealItemOptions } from "../../../src/api/dayPlan/ReplaceMealItemOptions.ts";
import type { UpdateMealItemOptions } from "../../../src/api/dayPlan/UpdateMealItemOptions.ts";
import { FitatuClientError } from "../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import type { RecipeDetails } from "../../../src/api/recipes/RecipeDetails.ts";
import type { RecipeReplacementInput } from "../../../src/api/recipes/RecipeReplacementInput.ts";
import type { RecipeWriteInput } from "../../../src/api/recipes/RecipeWriteInput.ts";
import type { MealItemMutationConfirmationProvider } from "../../../src/services/dayPlan/MealItemMutationService.ts";
import type { RecipeMutationConfirmationProvider } from "../../../src/services/recipes/RecipeService.ts";

interface TrackedMealItem {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}

interface PendingMealAddition {
	readonly date: string;
	readonly mealKey: string;
	readonly initialItemIds: ReadonlySet<string>;
	readonly expectedCount: number;
}

const CLEANUP_ATTEMPTS = 120;

export class CleanupTracker {
	private readonly items;
	private readonly recipeIds;
	private readonly dayPlanClient;
	private readonly recipeClient;
	private readonly pendingMealAdditions;

	public constructor(dayPlanClient: DayPlanClient, recipeClient?: RecipeClient) {
		this.dayPlanClient = dayPlanClient;
		this.recipeClient = recipeClient;
		this.items = new Map<string, TrackedMealItem>();
		this.recipeIds = new Set<string>();
		this.pendingMealAdditions = new Map<string, PendingMealAddition>();
	}

	public async prepareMealAddition(date: string, mealKey: string, expectedCount: number): Promise<void> {
		const dayPlan = await this.dayPlanClient.getDayPlan({ date });
		const initialItemIds = new Set(
			dayPlan.meals
				.find((meal) => meal.mealKey === mealKey)
				?.items.flatMap((item) => (item.itemId ? [item.itemId] : [])) ?? [],
		);
		this.pendingMealAdditions.set(this.key(date, mealKey, "addition"), {
			date,
			mealKey,
			initialItemIds,
			expectedCount,
		});
	}

	public confirmMealAddition(date: string, mealKey: string): void {
		this.pendingMealAdditions.delete(this.key(date, mealKey, "addition"));
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
		await this.discoverPendingMealAdditions();
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
				await this.waitUntilRecipeDeleted(recipeId);
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

	private async discoverPendingMealAdditions(): Promise<void> {
		for (const addition of this.pendingMealAdditions.values()) {
			for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
				const dayPlan = await this.dayPlanClient.getDayPlan({ date: addition.date });
				const addedItems =
					dayPlan.meals
						.find((meal) => meal.mealKey === addition.mealKey)
						?.items.filter((item) => item.itemId !== null && !addition.initialItemIds.has(item.itemId)) ??
					[];
				for (const item of addedItems) {
					this.track(addition.date, addition.mealKey, item.itemId);
				}
				if (addedItems.length >= addition.expectedCount) {
					break;
				}
				await wait(1_000);
			}
			this.pendingMealAdditions.delete(this.key(addition.date, addition.mealKey, "addition"));
		}
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

	private async waitUntilRecipeDeleted(recipeId: string): Promise<void> {
		if (!this.recipeClient) {
			return;
		}

		for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
			try {
				if ((await this.recipeClient.getRecipe(recipeId)).deleted) {
					return;
				}
			} catch (error) {
				if (isMissingRecipeClientFailure(error)) {
					return;
				}
				throw error;
			}
			await wait(1_000);
		}

		throw new Error(`Cleanup did not delete recipe ${recipeId}`);
	}
}

export class CleanupTrackingMealItemMutationConfirmer implements MealItemMutationConfirmationProvider {
	private readonly delegate: MealItemMutationConfirmationProvider;
	private readonly cleanup: CleanupTracker;

	public constructor(delegate: MealItemMutationConfirmationProvider, cleanup: CleanupTracker) {
		this.delegate = delegate;
		this.cleanup = cleanup;
	}

	public async confirmAdded(options: AddMealItemsOptions, result: MealItemMutationResult): Promise<void> {
		for (const itemId of result.provisionalItemIds) {
			this.cleanup.track(options.date, options.mealKey, itemId);
		}
		await this.delegate.confirmAdded(options, result);
		this.cleanup.confirmMealAddition(options.date, options.mealKey);
	}

	public confirmUpdated(options: UpdateMealItemOptions): Promise<void> {
		return this.delegate.confirmUpdated(options);
	}

	public confirmRemoved(options: RemoveMealItemsOptions): Promise<void> {
		return this.delegate.confirmRemoved(options);
	}

	public getMoveSource(options: MoveMealItemOptions): Promise<DayPlanItem> {
		return this.delegate.getMoveSource(options);
	}

	public async confirmMoved(
		options: MoveMealItemOptions,
		result: MealItemMutationResult,
		source: DayPlanItem,
	): Promise<void> {
		this.cleanup.track(
			options.toDate ?? options.fromDate,
			options.toMealKey ?? options.fromMealKey,
			result.newItemId,
		);
		await this.delegate.confirmMoved(options, result, source);
	}

	public async confirmReplaced(options: ReplaceMealItemOptions, result: MealItemMutationResult): Promise<void> {
		this.cleanup.move({
			fromDate: options.date,
			fromMealKey: options.mealKey,
			oldItemId: options.itemId,
			toDate: options.date,
			toMealKey: options.mealKey,
			newItemId: result.newItemId,
		});
		await this.delegate.confirmReplaced(options, result);
	}
}

export class CleanupTrackingRecipeMutationConfirmer implements RecipeMutationConfirmationProvider {
	private readonly delegate: RecipeMutationConfirmationProvider;
	private readonly cleanup: CleanupTracker;

	public constructor(delegate: RecipeMutationConfirmationProvider, cleanup: CleanupTracker) {
		this.delegate = delegate;
		this.cleanup = cleanup;
	}

	public async confirmCreated(recipeId: string, expected: RecipeWriteInput): Promise<RecipeDetails> {
		this.cleanup.trackRecipe(recipeId);
		return this.delegate.confirmCreated(recipeId, expected);
	}

	public async confirmReplaced(
		previousRecipeId: string,
		recipeId: string,
		expected: RecipeReplacementInput,
	): Promise<RecipeDetails> {
		this.cleanup.trackRecipe(recipeId);
		return this.delegate.confirmReplaced(previousRecipeId, recipeId, expected);
	}

	public confirmDeleted(recipeId: string): Promise<void> {
		return this.delegate.confirmDeleted(recipeId);
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
