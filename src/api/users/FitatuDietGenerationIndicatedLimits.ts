import { FitatuDietGenerationLimit } from "./FitatuDietGenerationLimit.ts";

export class FitatuDietGenerationIndicatedLimits {
	public readonly carbohydratePercentage: FitatuDietGenerationLimit | null;
	public readonly energy: FitatuDietGenerationLimit | null;
	public readonly fatPercentage: FitatuDietGenerationLimit | null;
	public readonly proteinPercentage: FitatuDietGenerationLimit | null;

	private constructor(data: Record<string, unknown>) {
		this.carbohydratePercentage = FitatuDietGenerationLimit.fromApiResponse(data.carbohydratePercentage);
		this.energy = FitatuDietGenerationLimit.fromApiResponse(data.energy);
		this.fatPercentage = FitatuDietGenerationLimit.fromApiResponse(data.fatPercentage);
		this.proteinPercentage = FitatuDietGenerationLimit.fromApiResponse(data.proteinPercentage);
	}

	public static fromApiResponse(data: unknown): FitatuDietGenerationIndicatedLimits | null {
		if (data === null || data === undefined) {
			return null;
		}

		return new FitatuDietGenerationIndicatedLimits(data as Record<string, unknown>);
	}
}
