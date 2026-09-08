import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export class UserMultiDayMealConfigApiResponse {
	public readonly defaultMeal: string;
	public readonly meals: readonly string[];

	private constructor(defaultMeal: string, meals: readonly string[]) {
		this.defaultMeal = defaultMeal;
		this.meals = meals;
	}

	public static fromApiResponse(data: unknown): UserMultiDayMealConfigApiResponse | undefined {
		if (data === undefined) return undefined;
		if (!ObjectUtils.isRecord(data) || typeof data.defaultMeal !== "string") {
			throw new FitatuResponseDecodeError("Fitatu multi-day meal config was not a valid JSON object");
		}
		if (!Array.isArray(data.meals) || !data.meals.every((meal) => typeof meal === "string")) {
			throw new FitatuResponseDecodeError("Fitatu multi-day meal config meals was not a string array");
		}

		return new UserMultiDayMealConfigApiResponse(data.defaultMeal, data.meals);
	}
}
