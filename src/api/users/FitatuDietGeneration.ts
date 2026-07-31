import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuDietGenerationIndicatedLimits } from "./FitatuDietGenerationIndicatedLimits.ts";

export class FitatuDietGeneration {
	public readonly indicatedLimits: FitatuDietGenerationIndicatedLimits | null;

	private constructor(data: Record<string, unknown>) {
		this.indicatedLimits = FitatuDietGenerationIndicatedLimits.fromApiResponse(data.indicatedLimits);
	}

	public static fromApiResponse(data: unknown): FitatuDietGeneration | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuDietGeneration(data) : null;
	}
}
