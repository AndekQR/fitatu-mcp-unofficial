import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";

/**
 * Optional micronutrient fields accepted by Fitatu's product form. The web app
 * sends every one of them as null when the user leaves the field empty.
 */
const UNSET_MICRONUTRIENT_FIELDS = [
	"animalProtein",
	"vegetableProtein",
	"monounsaturatedFat",
	"polyunsaturatedFat",
	"omega3",
	"omega6",
	"cholesterol",
	"caffeine",
	"vitaminA",
	"vitaminB1",
	"vitaminB2",
	"vitaminB5",
	"vitaminB6",
	"vitaminB7",
	"folicAcid",
	"vitaminB12",
	"vitaminC",
	"vitaminD",
	"vitaminE",
	"vitaminPP",
	"vitaminK",
	"zinc",
	"phosphorus",
	"iodine",
	"magnesium",
	"copper",
	"potassium",
	"selenium",
	"sodium",
	"calcium",
	"iron",
] as const;

/** Nutrition values in the payload are always declared per this many grams. */
const NUTRITION_REFERENCE_WEIGHT_GRAMS = 100;

/** A new user-owned product. All nutrition values are per 100 g. */
export class ProductWriteInput {
	public readonly name: string;
	public readonly brand: string | null;
	public readonly barcode: string | null;
	public readonly energy: number;
	public readonly fat: number;
	public readonly carbohydrate: number;
	public readonly protein: number;
	public readonly saturatedFat: number | null;
	public readonly sugars: number | null;
	public readonly fiber: number | null;
	public readonly salt: number | null;

	public constructor(
		name: string,
		brand: string | null,
		barcode: string | null,
		energy: number,
		fat: number,
		carbohydrate: number,
		protein: number,
		saturatedFat: number | null,
		sugars: number | null,
		fiber: number | null,
		salt: number | null,
	) {
		this.name = name;
		this.brand = brand;
		this.barcode = barcode;
		this.energy = energy;
		this.fat = fat;
		this.carbohydrate = carbohydrate;
		this.protein = protein;
		this.saturatedFat = saturatedFat;
		this.sugars = sugars;
		this.fiber = fiber;
		this.salt = salt;
	}

	public static toProductPayload(input: ProductWriteInput): Record<string, unknown> {
		return {
			name: StringUtils.parseNonEmptyString(input.name, "name is required"),
			brand: input.brand?.trim() ?? "",
			barcode: input.barcode?.trim() ?? "",
			energy: parseNutritionValue(input.energy, "energy"),
			fat: parseNutritionValue(input.fat, "fat"),
			saturatedFat: parseOptionalNutritionValue(input.saturatedFat, "saturatedFat"),
			carbohydrate: parseNutritionValue(input.carbohydrate, "carbohydrate"),
			sugars: parseOptionalNutritionValue(input.sugars, "sugars"),
			fiber: parseOptionalNutritionValue(input.fiber, "fiber"),
			protein: parseNutritionValue(input.protein, "protein"),
			salt: parseOptionalNutritionValue(input.salt, "salt"),
			...Object.fromEntries(UNSET_MICRONUTRIENT_FIELDS.map((field) => [field, null])),
			measures: [{ measureKey: "GRAM", measureUnit: "g", weight: NUTRITION_REFERENCE_WEIGHT_GRAMS }],
		};
	}
}

function parseNutritionValue(value: number, fieldName: string): number {
	return NumberUtils.parseNonNegativeFiniteNumber(value, `${fieldName} must be a non-negative finite number`);
}

function parseOptionalNutritionValue(value: number | null, fieldName: string): number | null {
	return value === null ? null : parseNutritionValue(value, fieldName);
}
