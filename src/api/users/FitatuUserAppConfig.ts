import { FitatuNutritionLimitDeviationPercentage } from "./FitatuNutritionLimitDeviationPercentage.ts";

export class FitatuUserAppConfig {
  public declare readonly searchDeviationRatePercentage?: number;
  public readonly nutritionLimitDeviationPercentage: FitatuNutritionLimitDeviationPercentage | null;
  public declare readonly isAllowedToReviewDiet?: boolean;

  private constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
    this.nutritionLimitDeviationPercentage =
      FitatuNutritionLimitDeviationPercentage.fromApiResponse(
        data.nutritionLimitDeviationPercentage,
      );
  }

  public static fromApiResponse(data: unknown): FitatuUserAppConfig | null {
    if (data === null || data === undefined) {
      return null;
    }

    return new FitatuUserAppConfig(data as Record<string, unknown>);
  }
}
