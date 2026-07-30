import { ObjectUtils } from "../../shared/ObjectUtils.ts";

export class FitatuNutritionLimitDeviationPercentage {
	public readonly energy?: number;
	public readonly carbohydrate?: number;
	public readonly protein?: number;
	public readonly fat?: number;

	private constructor(data: Record<string, unknown>) {
		this.energy = optionalNumber(data.energy);
		this.carbohydrate = optionalNumber(data.carbohydrate);
		this.protein = optionalNumber(data.protein);
		this.fat = optionalNumber(data.fat);
	}

	public static fromApiResponse(data: unknown): FitatuNutritionLimitDeviationPercentage | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuNutritionLimitDeviationPercentage(data) : null;
	}
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
