import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { asRecord } from "./DayPlanApiResponse.ts";
import { FoundDietItem } from "./FoundDietItem.ts";
import type { MealItemRemovalTarget } from "./MealItemRemovalTarget.ts";

export class DayPlanDietPlan {
	private readonly dietPlan: Record<string, unknown>;
	private readonly operation: FitatuClientOperation;

	public constructor(dietPlan: Record<string, unknown>, operation: FitatuClientOperation) {
		this.dietPlan = dietPlan;
		this.operation = operation;
	}

	public getMealItems(mealKey: string): Record<string, unknown>[] {
		let meal: Record<string, unknown>;
		try {
			meal = asRecord(this.dietPlan[mealKey], `meal ${mealKey}`);
		} catch (error) {
			if (!(error instanceof FitatuResponseDecodeError)) {
				throw error;
			}
			throw FitatuClientError.invalidResponse({
				operation: this.operation,
				message: error.message,
				method: "GET",
				endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
				cause: error,
			});
		}
		const items = meal.items;
		if (Array.isArray(items)) {
			const normalizedItems = items.filter(ObjectUtils.isRecord);
			meal.items = normalizedItems;
			return normalizedItems;
		}

		const normalizedItems: Record<string, unknown>[] = [];
		meal.items = normalizedItems;
		return normalizedItems;
	}

	public findItem(mealKey: string, itemId: string, anyMeal: boolean): FoundDietItem | null {
		const primary = this.findItemInMeal(mealKey, itemId);
		if (primary || !anyMeal) {
			return primary;
		}

		for (const key of Object.keys(this.dietPlan)) {
			if (key === mealKey) {
				continue;
			}

			const found = this.findItemInMeal(key, itemId);
			if (found) {
				return found;
			}
		}

		return null;
	}

	public findActiveItems(targets: readonly MealItemRemovalTarget[]): readonly FoundDietItem[] {
		return targets.flatMap((target) => {
			const found = this.findItemInMeal(target.mealKey, target.itemId);
			const deletedAt = typeof found?.item.deletedAt === "string" ? found.item.deletedAt.trim() : "";
			return found && !deletedAt ? [found] : [];
		});
	}

	private findItemInMeal(mealKey: string, itemId: string): FoundDietItem | null {
		const meal = this.dietPlan[mealKey];
		if (!ObjectUtils.isRecord(meal)) {
			return null;
		}

		const items = this.getMealItems(mealKey);
		const index = items.findIndex((item) => String(item.planDayDietItemId ?? "") === itemId);
		const item = items[index];

		return item ? new FoundDietItem(mealKey, item, items, index) : null;
	}
}
