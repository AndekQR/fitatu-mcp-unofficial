import { DayPlanItem } from "./DayPlanItem.ts";

export class DayPlanMeal {
	public readonly mealKey: string;
	public readonly mealName: string | null;
	public readonly mealTime: string | null;
	public readonly items: readonly DayPlanItem[];

	private constructor(mealKey: string, data: Record<string, unknown>) {
		this.mealKey = mealKey;
		this.mealName = optionalString(data.mealName);
		this.mealTime = optionalString(data.mealTime);
		this.items = DayPlanItem.fromApiResponseArray(data.items);
	}

	public static fromApiResponse(mealKey: string, data: unknown): DayPlanMeal | null {
		if (!isRecord(data)) {
			return null;
		}

		return new DayPlanMeal(mealKey, data);
	}

	public static fromDietPlan(data: unknown): readonly DayPlanMeal[] {
		if (!isRecord(data)) {
			return [];
		}

		return Object.entries(data).flatMap(([mealKey, mealData]) => {
			const meal = DayPlanMeal.fromApiResponse(mealKey, mealData);
			return meal ? [meal] : [];
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}
