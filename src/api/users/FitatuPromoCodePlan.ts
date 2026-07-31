import { ObjectUtils } from "../../shared/ObjectUtils.ts";

export class FitatuPromoCodePlan {
	public readonly rawData: Readonly<Record<string, unknown>>;

	private constructor(data: Record<string, unknown>) {
		this.rawData = Object.freeze({ ...data });
	}

	public static fromApiResponse(data: unknown): FitatuPromoCodePlan | null {
		if (data === null || data === undefined) {
			return null;
		}

		return ObjectUtils.isRecord(data) ? new FitatuPromoCodePlan(data) : null;
	}

	public static fromApiResponseArray(data: unknown): readonly FitatuPromoCodePlan[] {
		if (!Array.isArray(data)) {
			return [];
		}

		return data.flatMap((item) => {
			const plan = FitatuPromoCodePlan.fromApiResponse(item);
			return plan ? [plan] : [];
		});
	}
}
