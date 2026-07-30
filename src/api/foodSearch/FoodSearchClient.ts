import { DateUtils } from "../../shared/DateUtils.ts";
import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FoodType, type FoodTypeName } from "../dayPlan/FoodType.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuRequestFailure } from "../fitatuApiClientBase/FitatuClientFailure.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { FoodMeasure } from "./FoodMeasure.ts";
import { FoodNutrition } from "./FoodNutrition.ts";
import { FoodSearchItem } from "./FoodSearchItem.ts";
import type { FoodSearchOptions } from "./FoodSearchOptions.ts";
import { FoodSearchQueryResult } from "./FoodSearchQueryResult.ts";
import { FoodSearchResult } from "./FoodSearchResult.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";
import { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";
import type { NestedFirstValue } from "./NestedFirstValue.ts";
import { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";
import { NormalizedFoodSearchOptions } from "./NormalizedFoodSearchOptions.ts";

const DEFAULT_ACCEPT_HEADER = "application/json";
const DEFAULT_LOCALE = "pl_PL";
const DEFAULT_LIMIT = 3;
const DEFAULT_DETAILS_LIMIT = 3;

export class FoodSearchClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });

		super({
			...options,
			authClient,
			userClient,
		});
	}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		const normalized = normalizeSearchOptions(options);
		const userId = normalized.includeUserFood
			? StringUtils.firstNonEmptyString(await this.getContextUserId())
			: undefined;
		if (normalized.includeUserFood && !userId) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: "Fitatu user id is required",
			});
		}
		const results: FoodSearchQueryResult[] = [];

		for (const query of normalized.queries) {
			results.push(await this.searchOne(query, normalized, userId));
		}

		const items = this.toOutputItems(results);
		const warnings = results.flatMap((result) => result.warnings);
		const warningDetails = results.flatMap((result) => result.warningDetails);
		const searchAttemptCount = results.reduce((sum, result) => sum + result.searchAttemptCount, 0);
		const searchSuccessCount = results.reduce((sum, result) => sum + result.searchSuccessCount, 0);

		if (searchAttemptCount > 0 && searchSuccessCount === 0) {
			const errors = warningDetails.map((warning) => warning.clientError);
			const finalError = errors.at(-1);
			if (finalError) {
				const attempts = errors.slice(0, -1).flatMap(toRequestFailures);
				throw finalError.withAttempts(
					[...attempts, ...finalError.attempts],
					"All Fitatu food search requests failed",
				);
			}
		}

		return new FoodSearchResult(normalized.date, normalized.queries, items, warnings, warningDetails);
	}

	public async getAvailableMeasureIds(foodId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>> {
		const measures = await this.getAvailableMeasures(foodId, foodType);
		return new Set(measures.flatMap((measure) => (measure.measureId === null ? [] : [measure.measureId])));
	}

	public async getAvailableMeasures(
		foodId: string | number,
		foodType: FoodTypeName,
	): Promise<readonly FoodMeasure[]> {
		let normalizedFoodId: string | number;
		try {
			normalizedFoodId = StringUtils.parseStringOrSafeInteger(foodId, "foodId is required");
			FoodType.resolve(foodType, "PRODUCT", "foodType");
		} catch (error) {
			if (!(error instanceof ValidationError)) {
				throw error;
			}
			throw invalidFoodSearchRequest(error);
		}
		const details = await this.getFoodDetails(String(normalizedFoodId), foodType);
		return mergeAvailableMeasuresById(normalizeMeasures(details));
	}

	private async searchOne(
		query: string,
		options: NormalizedFoodSearchOptions,
		userId: string | undefined,
	): Promise<FoodSearchQueryResult> {
		const warnings: string[] = [];
		const warningDetails: FoodSearchWarningDetail[] = [];
		const items: NormalizedFoodSearchItem[] = [];
		let searchAttemptCount = 0;
		let searchSuccessCount = 0;

		if (options.includePublicFood) {
			searchAttemptCount += 1;
			let rows: readonly Record<string, unknown>[];
			try {
				rows = await this.fetchSearchRows({
					path: "/search/new/food",
					query: {
						phrase: query,
						page: 1,
						locale: options.locale,
						limit: options.limit,
						accessType: ["FREE", "PREMIUM"],
					},
					failureMessage: "Fitatu public food search request failed",
				});
				searchSuccessCount += 1;
			} catch (error) {
				if (!(error instanceof FitatuClientError)) {
					throw error;
				}
				const warning = `public search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "public" }));
				rows = [];
			}
			items.push(...this.normalizeRows(rows, "public"));
		}

		if (options.includeUserFood) {
			searchAttemptCount += 1;
			const normalizedUserId = StringUtils.firstNonEmptyString(userId);
			if (!normalizedUserId) {
				throw FitatuClientError.authentication({
					operation: FITATU_CLIENT_OPERATIONS.foodSearch,
					message: "Fitatu user id is required",
				});
			}
			let rows: readonly Record<string, unknown>[];
			try {
				rows = await this.fetchSearchRows({
					path: `/search/food/user/${encodeURIComponent(normalizedUserId)}`,
					query: {
						date: options.date,
						phrase: query,
						page: 1,
						limit: options.limit,
					},
					failureMessage: "Fitatu user food search request failed",
				});
				searchSuccessCount += 1;
			} catch (error) {
				if (!(error instanceof FitatuClientError)) {
					throw error;
				}
				const warning = `user search failed for query='${query}': ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { query, source: "user" }));
				rows = [];
			}
			items.push(...this.normalizeRows(rows, "user"));
		}

		let scoredItems = deduplicateItems(items).map((item) => item.withMatchScore(matchScore(query, item)));

		const hadCandidates = scoredItems.length > 0;
		scoredItems = scoredItems.filter((item) => item.matchScore > 0);
		if (hadCandidates && scoredItems.length === 0) {
			warnings.push("low_confidence_results");
		}

		if (options.includeDetails && options.detailsLimit > 0) {
			scoredItems = await this.withDetails(scoredItems, options.detailsLimit, warnings, warningDetails);
		}

		return new FoodSearchQueryResult(
			query,
			scoredItems,
			warnings,
			warningDetails,
			searchAttemptCount,
			searchSuccessCount,
		);
	}

	private async fetchSearchRows(options: {
		readonly path: string;
		readonly query: Record<string, string | number | readonly string[]>;
		readonly failureMessage: string;
	}): Promise<readonly Record<string, unknown>[]> {
		return this.fetchRowsFromFirstSuccessfulVariant([
			{
				path: options.path,
				headers: { accept: this.V3_ACCEPT_HEADER },
				query: options.query,
				failureMessage: options.failureMessage,
			},
			{
				path: options.path,
				headers: { accept: DEFAULT_ACCEPT_HEADER },
				query: options.query,
				failureMessage: options.failureMessage,
			},
		]);
	}

	private async fetchRowsFromFirstSuccessfulVariant(
		variants: readonly {
			readonly path: string;
			readonly headers: Record<string, string>;
			readonly query?: Record<string, string | number | readonly string[]>;
			readonly failureMessage: string;
		}[],
	): Promise<readonly Record<string, unknown>[]> {
		return FitatuFallbackRunner.run(
			variants,
			(variant) =>
				this.performCallout({
					operation: FITATU_CLIENT_OPERATIONS.foodSearch,
					method: "GET",
					path: variant.path,
					endpointTemplate: endpointTemplateForSearchPath(variant.path),
					query: variant.query,
					headers: variant.headers,
					failureMessage: variant.failureMessage,
					invalidResponseMessage: "Fitatu search response was invalid",
					decoder: extractRows,
				}),
			(error) => error.failure.kind === "http",
		);
	}

	private async withDetails(
		items: readonly NormalizedFoodSearchItem[],
		limit: number,
		warnings: string[],
		warningDetails: FoodSearchWarningDetail[],
	): Promise<NormalizedFoodSearchItem[]> {
		const detailed: NormalizedFoodSearchItem[] = [];

		for (const [index, item] of items.entries()) {
			if (index >= limit) {
				detailed.push(item);
				continue;
			}

			let details: Record<string, unknown>;
			try {
				details = await this.getFoodDetails(
					item.foodId,
					item.foodType?.trim().toUpperCase() === "RECIPE" ? "RECIPE" : "PRODUCT",
				);
			} catch (error) {
				if (!(error instanceof FitatuClientError)) {
					throw error;
				}
				const warning = `${item.source} details failed for foodId=${item.foodId}: ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(toWarningDetail(warning, error, { source: item.source, foodId: item.foodId }));
				detailed.push(item);
				continue;
			}
			detailed.push(mergeDetails(item, details));
		}

		return detailed;
	}

	private async getFoodDetails(
		foodId: string,
		foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM",
	): Promise<Record<string, unknown>> {
		const encodedFoodId = encodeURIComponent(foodId);
		const paths =
			foodType === "RECIPE"
				? [`/recipes/${encodedFoodId}`]
				: [`/products/${encodedFoodId}`, `/v2/products/${encodedFoodId}`, `/v3/products/${encodedFoodId}`];
		return FitatuFallbackRunner.run(
			paths,
			(path) =>
				this.performCallout({
					operation: FITATU_CLIENT_OPERATIONS.foodDetailsGet,
					method: "GET",
					path,
					endpointTemplate: endpointTemplateForDetailsPath(path),
					headers: { accept: DEFAULT_ACCEPT_HEADER },
					failureMessage: "Fitatu product details request failed",
					invalidResponseMessage: "Fitatu response was not a valid JSON object",
					decoder: extractDetails,
				}),
			(error) => error.failure.kind === "http",
		);
	}

	private normalizeRows(
		rows: readonly Record<string, unknown>[],
		source: FoodSearchSource,
	): NormalizedFoodSearchItem[] {
		const items: NormalizedFoodSearchItem[] = [];

		for (const row of rows) {
			const foodId = StringUtils.stringOrNull(firstValue(row, "foodId", "id", "productId"));
			if (!foodId) {
				continue;
			}

			const measure = recordOrUndefined(row.measure);
			const measureEnergy = NumberUtils.parseOptionalFiniteNumber(
				firstValue(row, "measureEnergy", { record: measure, keys: ["measureEnergy", "energy"] }),
			);

			items.push(
				new NormalizedFoodSearchItem(
					source,
					foodId,
					FoodType.fromUpstream(firstValue(row, "type", "foodType"), "PRODUCT"),
					StringUtils.stringOrNull(row.name),
					StringUtils.stringOrNull(firstValue(row, "brand", "producer")),
					StringUtils.stringOrNull(
						firstValue(row, "measureId", "defaultMeasureId", {
							record: measure,
							keys: ["measureId", "defaultMeasureId", "id"],
						}),
					),
					StringUtils.stringOrNull(
						firstValue(row, "measureName", {
							record: measure,
							keys: ["measureName", "name"],
						}),
					),
					NumberUtils.parseOptionalFiniteNumber(
						firstValue(row, "measureQuantity", "quantity", {
							record: measure,
							keys: ["measureQuantity", "quantity"],
						}),
					),
					NumberUtils.parseOptionalFiniteNumber(
						firstValue(row, "measureWeight", {
							record: measure,
							keys: ["measureWeight", "weight", "capacity"],
						}),
					),
					measureEnergy,
					nutritionFromRecord(row),
					new FoodNutrition(measureEnergy, null, null, null, null, null, null, null),
					booleanOrNull(row.verified),
					photoUrlOrNull(row.photo) ?? photoUrlOrNull(row.mainPhoto),
					0,
					[],
				),
			);
		}

		return items;
	}

	private toOutputItems(results: readonly FoodSearchQueryResult[]): FoodSearchItem[] {
		const output: FoodSearchItem[] = [];

		for (const [queryIndex, result] of results.entries()) {
			for (const item of result.items) {
				output.push(new FoodSearchItem(item, output.length, queryIndex, result.query, displayName(item)));
			}
		}

		return output;
	}
}

function normalizeSearchOptions(options: FoodSearchOptions): NormalizedFoodSearchOptions {
	try {
		return normalizeOptions(options);
	} catch (error) {
		if (error instanceof FitatuClientError) throw error;
		if (!(error instanceof ValidationError)) throw error;
		throw invalidFoodSearchRequest(error);
	}
}

function normalizeOptions(options: FoodSearchOptions): NormalizedFoodSearchOptions {
	const queries = normalizeQueries(options.queries);
	const limit = NumberUtils.parseIntegerInRange(
		options.limit ?? DEFAULT_LIMIT,
		1,
		50,
		"limit must be between 1 and 50",
	);
	const detailsLimit = NumberUtils.parseIntegerInRange(
		options.detailsLimit ?? DEFAULT_DETAILS_LIMIT,
		0,
		50,
		"detailsLimit must be between 0 and 50",
	);
	const includeUserFood = options.includeUserFood ?? true;
	const includePublicFood = options.includePublicFood ?? true;

	if (!includeUserFood && !includePublicFood) {
		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			message: "At least one food source must be enabled",
		});
	}

	return new NormalizedFoodSearchOptions(
		queries,
		DateUtils.validateIsoDate(options.date ?? DateUtils.toLocalDateString(), {
			calendarErrorMessage: "date must use YYYY-MM-DD format",
		}),
		StringUtils.parseNonEmptyString(options.locale ?? DEFAULT_LOCALE, "locale is required"),
		limit,
		includeUserFood,
		includePublicFood,
		options.includeDetails ?? false,
		detailsLimit,
	);
}

function normalizeQueries(queries: readonly string[] | undefined): readonly string[] {
	if (!queries) {
		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			message: "queries is required",
		});
	}
	if (queries.length === 0) {
		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			message: "queries must not be empty",
		});
	}

	return queries.map((value) =>
		StringUtils.parseNonEmptyString(value, "queries must not contain empty values is required"),
	);
}

function extractRows(data: unknown): readonly Record<string, unknown>[] {
	if (Array.isArray(data)) {
		return data.filter(ObjectUtils.isRecord);
	}
	if (!ObjectUtils.isRecord(data)) {
		throw new FitatuResponseDecodeError("Fitatu search response was not a valid JSON object or array");
	}

	const nested = recordOrUndefined(data.data);
	const rows = listOrUndefined(data.items) ?? listOrUndefined(data.results) ?? listOrUndefined(nested?.items);
	return rows?.filter(ObjectUtils.isRecord) ?? [];
}

function mergeDetails(item: NormalizedFoodSearchItem, details: Record<string, unknown>): NormalizedFoodSearchItem {
	const detailsNutrition = nutritionFromRecord(details);
	const measures = normalizeMeasures(details);

	return item.withDetails(
		mergeNutrition(item.nutritionPer100g, detailsNutrition),
		item.verified ?? booleanOrNull(details.verified),
		item.photoUrl ?? photoUrlOrNull(details.photo) ?? photoUrlOrNull(details.mainPhoto),
		measures,
	);
}

function normalizeMeasures(details: Record<string, unknown>): readonly FoodMeasure[] {
	const measures: FoodMeasure[] = [];
	const directMeasureId = StringUtils.stringOrNull(firstValue(details, "measureId", "defaultMeasureId"));
	if (directMeasureId) {
		measures.push(
			new FoodMeasure(
				directMeasureId,
				StringUtils.stringOrNull(firstValue(details, "measureName")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(details, "measureWeight", "weight", "capacity")),
				StringUtils.stringOrNull(firstValue(details, "unit", "unitKey")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(details, "measureEnergy", "energy")),
			),
		);
	}

	for (const raw of listOrUndefined(details.measures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push(
			new FoodMeasure(
				StringUtils.stringOrNull(firstValue(measure, "id", "measureId", "key")),
				StringUtils.stringOrNull(firstValue(measure, "name", "measureName")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "weight", "weightPerUnit", "capacity")),
				StringUtils.stringOrNull(firstValue(measure, "unit", "unitKey")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "energy", "energyPerUnit")),
			),
		);
	}

	for (const raw of listOrUndefined(details.simpleMeasures) ?? []) {
		const measure = recordOrUndefined(raw);
		if (!measure) {
			continue;
		}
		measures.push(
			new FoodMeasure(
				StringUtils.stringOrNull(firstValue(measure, "measureId", "id", "key")),
				StringUtils.stringOrNull(firstValue(measure, "name", "measureName")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "weight", "capacity")),
				StringUtils.stringOrNull(firstValue(measure, "unit", "unitKey")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(measure, "energy", "energyPerUnit")),
			),
		);
	}

	const initial = recordOrUndefined(details.initialMeasure);
	if (initial) {
		measures.push(
			new FoodMeasure(
				StringUtils.stringOrNull(firstValue(initial, "key", "id", "measureId")),
				StringUtils.stringOrNull(firstValue(initial, "name", "measureName")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(initial, "weight", "capacity")),
				StringUtils.stringOrNull(firstValue(initial, "unit", "unitKey")),
				NumberUtils.parseOptionalFiniteNumber(firstValue(initial, "energy", "energyPerUnit")),
			),
		);
	}

	return deduplicateMeasures(measures);
}

function deduplicateItems(items: readonly NormalizedFoodSearchItem[]): NormalizedFoodSearchItem[] {
	const seen = new Set<string>();
	const deduplicated: NormalizedFoodSearchItem[] = [];

	for (const item of items) {
		const key = `${item.source}:${item.foodId}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduplicated.push(item);
	}

	return deduplicated;
}

function deduplicateMeasures(measures: readonly FoodMeasure[]): readonly FoodMeasure[] {
	const seen = new Set<string>();
	const deduplicated: FoodMeasure[] = [];

	for (const measure of measures) {
		const key = `${measure.measureId ?? ""}:${measure.measureName ?? ""}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduplicated.push(measure);
	}

	return deduplicated;
}

function mergeAvailableMeasuresById(measures: readonly FoodMeasure[]): readonly FoodMeasure[] {
	const byId = new Map<string, FoodMeasure>();
	for (const measure of measures) {
		if (measure.measureId === null) {
			continue;
		}
		const existing = byId.get(measure.measureId);
		byId.set(
			measure.measureId,
			new FoodMeasure(
				measure.measureId,
				existing?.measureName ?? measure.measureName,
				existing?.weightG ?? measure.weightG,
				existing?.unit ?? measure.unit,
				existing?.energyKcal ?? measure.energyKcal,
			),
		);
	}
	return [...byId.values()];
}

function nutritionFromRecord(record: Record<string, unknown>): FoodNutrition {
	return new FoodNutrition(
		NumberUtils.parseOptionalFiniteNumber(record.energy),
		NumberUtils.parseOptionalFiniteNumber(record.protein),
		NumberUtils.parseOptionalFiniteNumber(record.fat),
		NumberUtils.parseOptionalFiniteNumber(record.carbohydrate),
		NumberUtils.parseOptionalFiniteNumber(record.fiber),
		NumberUtils.parseOptionalFiniteNumber(record.sugars),
		NumberUtils.parseOptionalFiniteNumber(record.salt),
		NumberUtils.parseOptionalFiniteNumber(record.saturatedFat),
	);
}

function mergeNutrition(primary: FoodNutrition, fallback: FoodNutrition): FoodNutrition {
	return new FoodNutrition(
		primary.energyKcal ?? fallback.energyKcal,
		primary.proteinG ?? fallback.proteinG,
		primary.fatG ?? fallback.fatG,
		primary.carbsG ?? fallback.carbsG,
		primary.fiberG ?? fallback.fiberG,
		primary.sugarsG ?? fallback.sugarsG,
		primary.saltG ?? fallback.saltG,
		primary.saturatedFatG ?? fallback.saturatedFatG,
	);
}

function matchScore(query: string, item: NormalizedFoodSearchItem): number {
	const queryTokens = tokens(query);
	if (queryTokens.size === 0) {
		return 0;
	}

	const candidateTokens = tokens([item.name, item.brand].filter(isNonEmptyString).join(" "));
	if (candidateTokens.size === 0) {
		return 0;
	}

	let overlap = 0;
	for (const token of queryTokens) {
		if (candidateTokens.has(token)) {
			overlap += 1;
		}
	}

	return Math.round((overlap / queryTokens.size) * 10000) / 10000;
}

function tokens(value: string): Set<string> {
	return new Set(
		value
			.normalize("NFKD")
			.toLowerCase()
			.replace(/\p{Diacritic}/gu, "")
			.replace(/[łđðþæœø]/g, (character) => LATIN_CHARACTER_FOLD[character] ?? character)
			.match(/[a-z0-9]+/g)
			?.filter((token) => token.length > 1) ?? [],
	);
}

const LATIN_CHARACTER_FOLD: Readonly<Record<string, string>> = {
	ł: "l",
	đ: "d",
	ð: "d",
	þ: "th",
	æ: "ae",
	œ: "oe",
	ø: "o",
};

function displayName(item: NormalizedFoodSearchItem): string {
	const parts: string[] = [];
	const name = item.name ?? item.foodId;
	const measure = formatMeasure(item);
	if (measure) {
		parts.push(measure);
	}
	if (item.weightG !== null && !measureAlreadyDescribesWeight(item)) {
		parts.push(`${formatNumber(item.weightG)} g`);
	}
	if (item.kcal !== null) {
		parts.push(`${formatNumber(item.kcal)} kcal`);
	} else if (item.nutritionPer100g.energyKcal !== null) {
		parts.push(`${formatNumber(item.nutritionPer100g.energyKcal)} kcal`);
	}

	return parts.length > 0 ? `${name} - ${parts.join(", ")}` : name;
}

function formatMeasure(item: NormalizedFoodSearchItem): string | undefined {
	if (!item.measureName) {
		return undefined;
	}
	if (item.measureQuantity === null) {
		return item.measureName;
	}

	return `${formatNumber(item.measureQuantity)} ${item.measureName}`;
}

function measureAlreadyDescribesWeight(item: NormalizedFoodSearchItem): boolean {
	if (item.measureQuantity === null || item.weightG === null || item.measureName === null) {
		return false;
	}

	return (
		["g", "gram", "grams", "gramy"].includes(item.measureName.toLowerCase()) &&
		item.measureQuantity === item.weightG
	);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(value);
}

function firstValue(record: Record<string, unknown>, ...keys: readonly (string | NestedFirstValue)[]): unknown {
	for (const key of keys) {
		if (typeof key === "string") {
			if (record[key] !== undefined && record[key] !== null) {
				return record[key];
			}
			continue;
		}

		if (!key.record) {
			continue;
		}
		for (const nestedKey of key.keys) {
			if (key.record[nestedKey] !== undefined && key.record[nestedKey] !== null) {
				return key.record[nestedKey];
			}
		}
	}

	return undefined;
}

function booleanOrNull(value: unknown): boolean | null {
	if (typeof value === "boolean") {
		return value;
	}

	return null;
}

function photoUrlOrNull(value: unknown): string | null {
	if (typeof value === "string") {
		return value.trim() || null;
	}
	if (ObjectUtils.isRecord(value)) {
		return StringUtils.stringOrNull(value.url) ?? StringUtils.stringOrNull(value.path);
	}

	return null;
}

function listOrUndefined(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
	return ObjectUtils.isRecord(value) ? value : undefined;
}

function isNonEmptyString(value: string | null): value is string {
	return typeof value === "string" && value.length > 0;
}

function toWarningDetail(
	message: string,
	error: FitatuClientError,
	context: {
		readonly query?: string;
		readonly source?: FoodSearchSource;
		readonly foodId?: string;
	},
): FoodSearchWarningDetail {
	return new FoodSearchWarningDetail(message, error, context.query, context.source, context.foodId);
}

function safeWarningMessage(error: FitatuClientError): string {
	if (error.failure.kind !== "http") {
		return error.message;
	}

	const statusText = error.failure.statusText ? ` ${error.failure.statusText}` : "";
	const upstreamMessage = error.failure.upstreamMessage ? `: ${error.failure.upstreamMessage}` : "";
	return `${error.message} (HTTP ${error.failure.statusCode}${statusText}${upstreamMessage})`;
}

function invalidFoodSearchRequest(error: unknown): FitatuClientError {
	return FitatuClientError.invalidRequest({
		operation: FITATU_CLIENT_OPERATIONS.foodSearch,
		message: error instanceof Error ? error.message : "Food search request was invalid",
	});
}

function extractDetails(data: unknown): Record<string, unknown> {
	if (!ObjectUtils.isRecord(data)) {
		throw new FitatuResponseDecodeError("Fitatu response was not a valid JSON object");
	}
	return data;
}

function toRequestFailures(error: FitatuClientError): FitatuRequestFailure[] {
	const failures = [...error.attempts];
	if (
		error.failure.kind === "http" ||
		error.failure.kind === "transport" ||
		error.failure.kind === "invalidResponse"
	) {
		failures.push(error.failure);
	}
	return failures;
}

function endpointTemplateForSearchPath(path: string): string {
	return path.startsWith("/search/food/user/") ? "/search/food/user/:userId" : "/search/new/food";
}

function endpointTemplateForDetailsPath(path: string): string {
	if (path.startsWith("/recipes/")) return "/recipes/:foodId";
	if (path.startsWith("/v2/")) return "/v2/products/:foodId";
	if (path.startsWith("/v3/")) return "/v3/products/:foodId";
	return "/products/:foodId";
}
