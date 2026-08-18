import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FoodSearchApiItem } from "./FoodSearchApiItem.ts";

export class FoodSearchApiResponse {
	public readonly items: readonly FoodSearchApiItem[];

	private constructor(items: readonly FoodSearchApiItem[]) {
		this.items = items;
	}

	public static fromApiResponse(data: unknown): FoodSearchApiResponse {
		if (Array.isArray(data)) {
			return new FoodSearchApiResponse(mapItems(data));
		}
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu response was not a valid JSON object or array");
		}

		const nested = ObjectUtils.isRecord(data.data) ? data.data : undefined;
		const rows = list(data.items) ?? list(data.results) ?? list(nested?.items) ?? [];
		return new FoodSearchApiResponse(mapItems(rows));
	}
}

function mapItems(values: readonly unknown[]): readonly FoodSearchApiItem[] {
	return values.flatMap((value) => (ObjectUtils.isRecord(value) ? [FoodSearchApiItem.fromApiResponse(value)] : []));
}

function list(value: unknown): readonly unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}
