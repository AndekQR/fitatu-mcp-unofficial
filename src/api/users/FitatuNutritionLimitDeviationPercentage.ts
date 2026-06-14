export class FitatuNutritionLimitDeviationPercentage {
	declare public readonly energy?: number;
	declare public readonly carbohydrate?: number;
	declare public readonly protein?: number;
	declare public readonly fat?: number;

	private constructor(data: Record<string, unknown>) {
		Object.assign(this, data);
	}

	public static fromApiResponse(data: unknown): FitatuNutritionLimitDeviationPercentage | null {
		if (data === null || data === undefined) {
			return null;
		}

		return new FitatuNutritionLimitDeviationPercentage(data as Record<string, unknown>);
	}
}
