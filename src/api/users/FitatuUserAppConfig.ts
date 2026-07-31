import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuNutritionLimitDeviationPercentage } from "./FitatuNutritionLimitDeviationPercentage.ts";

export class FitatuUserAppConfig {
	public readonly searchDeviationRatePercentage?: number;
	public readonly nutritionLimitDeviationPercentage: FitatuNutritionLimitDeviationPercentage | null;
	public readonly isAllowedToReviewDiet?: boolean;

	private constructor(data: Record<string, unknown>) {
		this.searchDeviationRatePercentage = optionalNumber(data.searchDeviationRatePercentage);
		this.nutritionLimitDeviationPercentage = FitatuNutritionLimitDeviationPercentage.fromApiResponse(
			data.nutritionLimitDeviationPercentage,
		);
		this.isAllowedToReviewDiet =
			typeof data.isAllowedToReviewDiet === "boolean" ? data.isAllowedToReviewDiet : undefined;
	}

	public static fromApiResponse(data: unknown): FitatuUserAppConfig | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuUserAppConfig(data) : null;
	}
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
