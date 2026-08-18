import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { NestedFirstValue } from "./NestedFirstValue.ts";

export class FoodSearchApiItem {
	public readonly foodId: string | null;
	public readonly rawFoodType: string | null;
	public readonly name: string | null;
	public readonly brand: string | null;
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly measureQuantity: number | null;
	public readonly measureWeight: number | null;
	public readonly measureEnergy: number | null;
	public readonly energy: number | null;
	public readonly protein: number | null;
	public readonly fat: number | null;
	public readonly carbohydrate: number | null;
	public readonly fiber: number | null;
	public readonly sugars: number | null;
	public readonly salt: number | null;
	public readonly saturatedFat: number | null;
	public readonly verified: boolean | null;
	public readonly photoUrl: string | null;

	private constructor(
		foodId: string | null,
		rawFoodType: string | null,
		name: string | null,
		brand: string | null,
		measureId: string | null,
		measureName: string | null,
		measureQuantity: number | null,
		measureWeight: number | null,
		measureEnergy: number | null,
		energy: number | null,
		protein: number | null,
		fat: number | null,
		carbohydrate: number | null,
		fiber: number | null,
		sugars: number | null,
		salt: number | null,
		saturatedFat: number | null,
		verified: boolean | null,
		photoUrl: string | null,
	) {
		this.foodId = foodId;
		this.rawFoodType = rawFoodType;
		this.name = name;
		this.brand = brand;
		this.measureId = measureId;
		this.measureName = measureName;
		this.measureQuantity = measureQuantity;
		this.measureWeight = measureWeight;
		this.measureEnergy = measureEnergy;
		this.energy = energy;
		this.protein = protein;
		this.fat = fat;
		this.carbohydrate = carbohydrate;
		this.fiber = fiber;
		this.sugars = sugars;
		this.salt = salt;
		this.saturatedFat = saturatedFat;
		this.verified = verified;
		this.photoUrl = photoUrl;
	}

	public static fromApiResponse(response: Readonly<Record<string, unknown>>): FoodSearchApiItem {
		const measure = recordOrUndefined(response.measure);
		return new FoodSearchApiItem(
			StringUtils.stringOrNull(firstValue(response, "foodId", "id", "productId")),
			StringUtils.stringOrNull(firstValue(response, "type", "foodType")),
			StringUtils.stringOrNull(response.name),
			StringUtils.stringOrNull(firstValue(response, "brand", "producer")),
			StringUtils.stringOrNull(
				firstValue(response, "measureId", "defaultMeasureId", {
					record: measure,
					keys: ["measureId", "defaultMeasureId", "id"],
				}),
			),
			StringUtils.stringOrNull(
				firstValue(response, "measureName", { record: measure, keys: ["measureName", "name"] }),
			),
			NumberUtils.parseOptionalFiniteNumber(
				firstValue(response, "measureQuantity", "quantity", {
					record: measure,
					keys: ["measureQuantity", "quantity"],
				}),
			),
			NumberUtils.parseOptionalFiniteNumber(
				firstValue(response, "measureWeight", {
					record: measure,
					keys: ["measureWeight", "weight", "capacity"],
				}),
			),
			NumberUtils.parseOptionalFiniteNumber(
				firstValue(response, "measureEnergy", { record: measure, keys: ["measureEnergy", "energy"] }),
			),
			NumberUtils.parseOptionalFiniteNumber(response.energy),
			NumberUtils.parseOptionalFiniteNumber(response.protein),
			NumberUtils.parseOptionalFiniteNumber(response.fat),
			NumberUtils.parseOptionalFiniteNumber(response.carbohydrate),
			NumberUtils.parseOptionalFiniteNumber(response.fiber),
			NumberUtils.parseOptionalFiniteNumber(response.sugars),
			NumberUtils.parseOptionalFiniteNumber(response.salt),
			NumberUtils.parseOptionalFiniteNumber(response.saturatedFat),
			typeof response.verified === "boolean" ? response.verified : null,
			photoUrlOrNull(response.photo) ?? photoUrlOrNull(response.mainPhoto),
		);
	}
}

function firstValue(
	record: Readonly<Record<string, unknown>>,
	...keys: readonly (string | NestedFirstValue)[]
): unknown {
	for (const key of keys) {
		if (typeof key === "string") {
			if (record[key] !== undefined && record[key] !== null) return record[key];
			continue;
		}
		if (!key.record) continue;
		for (const nestedKey of key.keys) {
			if (key.record[nestedKey] !== undefined && key.record[nestedKey] !== null) return key.record[nestedKey];
		}
	}
	return undefined;
}

function photoUrlOrNull(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	if (ObjectUtils.isRecord(value)) return StringUtils.stringOrNull(value.url) ?? StringUtils.stringOrNull(value.path);
	return null;
}

function recordOrUndefined(value: unknown): Readonly<Record<string, unknown>> | undefined {
	return ObjectUtils.isRecord(value) ? value : undefined;
}
