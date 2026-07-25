import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { asRecord } from "./DayPlanApiResponse.ts";
import { FoundDietItem } from "./FoundDietItem.ts";

export class DayPlanDietPlan {
	private readonly dietPlan: Record<string, unknown>;

	public constructor(dietPlan: Record<string, unknown>) {
		this.dietPlan = dietPlan;
	}

	public getMealItems(mealKey: string): Record<string, unknown>[] {
		const meal = asRecord(this.dietPlan[mealKey], `meal ${mealKey}`);
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

	public findActiveItems(itemIds: ReadonlySet<string>): readonly FoundDietItem[] {
		const found: FoundDietItem[] = [];

		for (const key of Object.keys(this.dietPlan)) {
			const meal = this.dietPlan[key];
			if (!ObjectUtils.isRecord(meal)) {
				continue;
			}

			const items = this.getMealItems(key);
			items.forEach((item, index) => {
				const itemId = typeof item.planDayDietItemId === "string" ? item.planDayDietItemId : "";
				const deletedAt = typeof item.deletedAt === "string" ? item.deletedAt.trim() : "";
				if (!deletedAt && itemIds.has(itemId)) {
					found.push(new FoundDietItem(key, item, items, index));
				}
			});
		}

		return found;
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
