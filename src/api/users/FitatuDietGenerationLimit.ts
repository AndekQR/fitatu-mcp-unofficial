import { ObjectUtils } from "../../shared/ObjectUtils.ts";

export class FitatuDietGenerationLimit {
	public readonly max?: number;
	public readonly min?: number;

	private constructor(data: Record<string, unknown>) {
		this.max = optionalNumber(data.max);
		this.min = optionalNumber(data.min);
	}

	public static fromApiResponse(data: unknown): FitatuDietGenerationLimit | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuDietGenerationLimit(data) : null;
	}
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
