import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { ScalarUtils } from "../../shared/ScalarUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";

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
		this.itemId = StringUtils.stringOrNull(data.planDayDietItemId);
		this.name = StringUtils.stringOrNull(data.name);
		this.foodType = StringUtils.stringOrNull(data.foodType);
		this.productId = ScalarUtils.stringOrFiniteNumberOrNull(data.productId);
		this.recipeId = ScalarUtils.stringOrFiniteNumberOrNull(data.recipeId);
		this.brand = StringUtils.stringOrNull(data.brand);
		this.measureId = ScalarUtils.stringOrFiniteNumberOrNull(data.measureId);
		this.measureName = StringUtils.stringOrNull(data.measureName);
		this.measureQuantity = NumberUtils.parseOptionalFiniteNumber(data.measureQuantity);
		this.weight = NumberUtils.parseOptionalFiniteNumber(data.weight);
		this.capacity = NumberUtils.parseOptionalFiniteNumber(data.capacity);
		this.energy = NumberUtils.parseOptionalFiniteNumber(data.energy);
		this.protein = NumberUtils.parseOptionalFiniteNumber(data.protein);
		this.fat = NumberUtils.parseOptionalFiniteNumber(data.fat);
		this.carbohydrate = NumberUtils.parseOptionalFiniteNumber(data.carbohydrate);
		this.fiber = NumberUtils.parseOptionalFiniteNumber(data.fiber);
		this.sugars = NumberUtils.parseOptionalFiniteNumber(data.sugars);
		this.salt = NumberUtils.parseOptionalFiniteNumber(data.salt);
		this.visible = optionalBoolean(data.visible);
		this.eaten = optionalBoolean(data.eaten);
	}

	public static fromApiResponse(data: unknown): DayPlanItem | null {
		if (!ObjectUtils.isRecord(data)) {
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

function optionalBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}
