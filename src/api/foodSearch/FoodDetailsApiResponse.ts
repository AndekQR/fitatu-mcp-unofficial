import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FoodMeasureApiResponse } from "./FoodMeasureApiResponse.ts";

export class FoodDetailsApiResponse {
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
	public readonly measures: readonly FoodMeasureApiResponse[];

	private constructor(
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
		measures: readonly FoodMeasureApiResponse[],
	) {
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
		this.measures = measures;
	}

	public static fromApiResponse(data: unknown): FoodDetailsApiResponse {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu response was not a valid JSON object");
		}
		return new FoodDetailsApiResponse(
			NumberUtils.parseOptionalFiniteNumber(data.energy),
			NumberUtils.parseOptionalFiniteNumber(data.protein),
			NumberUtils.parseOptionalFiniteNumber(data.fat),
			NumberUtils.parseOptionalFiniteNumber(data.carbohydrate),
			NumberUtils.parseOptionalFiniteNumber(data.fiber),
			NumberUtils.parseOptionalFiniteNumber(data.sugars),
			NumberUtils.parseOptionalFiniteNumber(data.salt),
			NumberUtils.parseOptionalFiniteNumber(data.saturatedFat),
			typeof data.verified === "boolean" ? data.verified : null,
			photoUrlOrNull(data.photo) ?? photoUrlOrNull(data.mainPhoto),
			mapMeasures(data),
		);
	}
}

function mapMeasures(data: Readonly<Record<string, unknown>>): readonly FoodMeasureApiResponse[] {
	const measures: FoodMeasureApiResponse[] = [];
	const directMeasureId = StringUtils.stringOrNull(firstValue(data, "measureId", "defaultMeasureId"));
	if (directMeasureId) {
		measures.push(
			new FoodMeasureApiResponse(
				directMeasureId,
				StringUtils.stringOrNull(data.measureName),
				NumberUtils.parseOptionalFiniteNumber(firstValue(data, "measureWeight", "weight", "capacity")),
				StringUtils.stringOrNull(firstValue(data, "unit", "unitKey")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(data, "measureEnergy", "energy")),
			),
		);
	}

	for (const value of list(data.measures)) {
		if (ObjectUtils.isRecord(value)) {
			measures.push(mapMeasure(value, ["id", "measureId", "key"], ["weight", "weightPerUnit", "capacity"]));
		}
	}
	for (const value of list(data.simpleMeasures)) {
		if (ObjectUtils.isRecord(value)) {
			measures.push(mapMeasure(value, ["measureId", "id", "key"], ["weight", "capacity"]));
		}
	}
	if (ObjectUtils.isRecord(data.initialMeasure)) {
		measures.push(mapMeasure(data.initialMeasure, ["key", "id", "measureId"], ["weight", "capacity"]));
	}
	return measures;
}

function mapMeasure(
	record: Readonly<Record<string, unknown>>,
	idKeys: readonly string[],
	weightKeys: readonly string[],
): FoodMeasureApiResponse {
	return new FoodMeasureApiResponse(
		StringUtils.stringOrNull(firstValue(record, ...idKeys)),
		StringUtils.stringOrNull(firstValue(record, "name", "measureName")),
		NumberUtils.parseOptionalFiniteNumber(firstValue(record, ...weightKeys)),
		StringUtils.stringOrNull(firstValue(record, "unit", "unitKey")),
		NumberUtils.parseOptionalFiniteNumber(firstValue(record, "energy", "energyPerUnit")),
	);
}

function firstValue(record: Readonly<Record<string, unknown>>, ...keys: readonly string[]): unknown {
	for (const key of keys) {
		if (record[key] !== undefined && record[key] !== null) return record[key];
	}
	return undefined;
}

function photoUrlOrNull(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	if (ObjectUtils.isRecord(value)) return StringUtils.stringOrNull(value.url) ?? StringUtils.stringOrNull(value.path);
	return null;
}

function list(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}
