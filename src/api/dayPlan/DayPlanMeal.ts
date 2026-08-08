import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { DayPlanItem } from "./DayPlanItem.ts";

export class DayPlanMeal {
	public readonly mealKey: string;
	public readonly mealName: string | null;
	public readonly mealTime: string | null;
	public readonly items: readonly DayPlanItem[];

	private constructor(mealKey: string, data: Record<string, unknown>) {
		this.mealKey = mealKey;
		this.mealName = StringUtils.stringOrNull(data.mealName);
		this.mealTime = StringUtils.stringOrNull(data.mealTime);
		this.items = DayPlanItem.fromApiResponseArray(data.items);
	}

	public static fromApiResponse(mealKey: string, data: unknown): DayPlanMeal | null {
		if (!ObjectUtils.isRecord(data)) {
			return null;
		}
		if (!mealKey.trim()) {
			throw new FitatuResponseDecodeError("DayPlan response contained an empty meal key");
		}

		return new DayPlanMeal(mealKey, data);
	}

	public static fromDietPlan(data: unknown): readonly DayPlanMeal[] {
		if (!ObjectUtils.isRecord(data)) {
			return [];
		}

		return Object.entries(data).flatMap(([mealKey, mealData]) => {
			const meal = DayPlanMeal.fromApiResponse(mealKey, mealData);
			return meal ? [meal] : [];
		});
	}
}
