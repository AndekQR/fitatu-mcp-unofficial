export class FitatuNutritionLimitDeviationPercentage {
  public declare readonly energy?: number;
  public declare readonly carbohydrate?: number;
  public declare readonly protein?: number;
  public declare readonly fat?: number;

  private constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
  }

  public static fromApiResponse(
    data: unknown,
  ): FitatuNutritionLimitDeviationPercentage | null {
    if (data === null || data === undefined) {
      return null;
    }

    return new FitatuNutritionLimitDeviationPercentage(
      data as Record<string, unknown>,
    );
  }
}
