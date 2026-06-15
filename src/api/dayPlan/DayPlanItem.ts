export class DayPlanItem {
	public readonly itemId: string | null;
	public readonly name: string | null;
	public readonly foodType: string | null;
	public readonly productId: number | string | null;
	public readonly recipeId: number | string | null;
	public readonly brand: string | null;
	public readonly measureId: number | string | null;
	public readonly measureName: string | null;
	public readonly measureQuantity: number | null;
	public readonly weight: number | null;
	public readonly capacity: number | null;
	public readonly energy: number | null;
	public readonly protein: number | null;
	public readonly fat: number | null;
	public readonly carbohydrate: number | null;
	public readonly fiber: number | null;
	public readonly sugars: number | null;
	public readonly salt: number | null;
	public readonly visible: boolean | null;
	public readonly eaten: boolean | null;

	private constructor(data: Record<string, unknown>) {
		this.itemId = optionalString(data.planDayDietItemId);
		this.name = optionalString(data.name);
		this.foodType = optionalString(data.foodType);
		this.productId = optionalId(data.productId);
		this.recipeId = optionalId(data.recipeId);
		this.brand = optionalString(data.brand);
		this.measureId = optionalId(data.measureId);
		this.measureName = optionalString(data.measureName);
		this.measureQuantity = optionalNumber(data.measureQuantity);
		this.weight = optionalNumber(data.weight);
		this.capacity = optionalNumber(data.capacity);
		this.energy = optionalNumber(data.energy);
		this.protein = optionalNumber(data.protein);
		this.fat = optionalNumber(data.fat);
		this.carbohydrate = optionalNumber(data.carbohydrate);
		this.fiber = optionalNumber(data.fiber);
		this.sugars = optionalNumber(data.sugars);
		this.salt = optionalNumber(data.salt);
		this.visible = optionalBoolean(data.visible);
		this.eaten = optionalBoolean(data.eaten);
	}

	public static fromApiResponse(data: unknown): DayPlanItem | null {
		if (!isRecord(data)) {
			return null;
		}

		if (typeof data.deletedAt === "string" && data.deletedAt.trim()) {
			return null;
		}

		return new DayPlanItem(data);
	}

	public static fromApiResponseArray(data: unknown): readonly DayPlanItem[] {
		if (!Array.isArray(data)) {
			return [];
		}

		return data.flatMap((item) => {
			const dayPlanItem = DayPlanItem.fromApiResponse(item);
			return dayPlanItem ? [dayPlanItem] : [];
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function optionalId(value: unknown): number | string | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return null;
}
