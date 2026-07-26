import { ValidationError } from "../../shared/ValidationError.ts";

export const FOOD_TYPES = ["PRODUCT", "RECIPE", "CUSTOM_ITEM"] as const;

export type FoodTypeName = (typeof FOOD_TYPES)[number];

export class FoodType {
	public static resolve(value: unknown, fallback: FoodTypeName, parameter?: string): FoodTypeName {
		const normalized = this.normalize(value);
		if (!normalized) {
			return fallback;
		}
		if (this.isFoodType(normalized)) {
			return normalized;
		}
		throw new ValidationError(`${parameter ?? "foodType"} must be one of: ${FOOD_TYPES.join(", ")}`);
	}

	public static fromUpstream(value: unknown, fallback: FoodTypeName): FoodTypeName {
		const normalized = this.normalize(value);
		return normalized && this.isFoodType(normalized) ? normalized : fallback;
	}

	private static normalize(value: unknown): string {
		return typeof value === "string" ? value.trim().toUpperCase() : "";
	}

	private static isFoodType(value: string): value is FoodTypeName {
		return FOOD_TYPES.some((foodType) => foodType === value);
	}
}
