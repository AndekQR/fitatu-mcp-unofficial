export class FitatuPromoCodePlan {
	private constructor(data: Record<string, unknown>) {
		Object.assign(this, data);
	}

	public static fromApiResponse(data: unknown): FitatuPromoCodePlan | null {
		if (data === null || data === undefined) {
			return null;
		}

		return new FitatuPromoCodePlan(data as Record<string, unknown>);
	}

	public static fromApiResponseArray(
		data: unknown,
	): readonly FitatuPromoCodePlan[] {
		if (!Array.isArray(data)) {
			return [];
		}

		return data.flatMap((item) => {
			const plan = FitatuPromoCodePlan.fromApiResponse(item);
			return plan ? [plan] : [];
		});
	}
}
