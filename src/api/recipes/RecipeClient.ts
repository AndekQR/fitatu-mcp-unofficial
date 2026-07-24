import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ResponseUtils } from "../../shared/ResponseUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { RecipeError } from "./RecipeError.ts";
import type { RecipeCreateResult } from "./RecipeCreateResult.ts";
import { RecipeDetails } from "./RecipeDetails.ts";
import type { RecipeReplacementInput } from "./RecipeReplacementInput.ts";
import type { RecipeReplaceResult } from "./RecipeReplaceResult.ts";
import type { RecipeSearchItem } from "./RecipeSearchItem.ts";
import type { RecipeSearchOptions } from "./RecipeSearchOptions.ts";
import { RecipeSearchResult } from "./RecipeSearchResult.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";
import { RecipeWriteInput } from "./RecipeWriteInput.ts";

const JSON_ACCEPT_HEADER = "application/json";
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const READ_AFTER_WRITE_ATTEMPTS = 5;

export class RecipeClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });
		super({ ...options, authClient, userClient });
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeDetails> {
		const normalizedRecipeId = StringUtils.stringOrNull(recipeId);
		if (normalizedRecipeId === null) {
			throw new Error("recipeId is required");
		}
		const userId = StringUtils.parseNonEmptyString(await this.getContextUserId(), "Fitatu user id is required");
		const path = `/recipes-and-user-action/${encodeURIComponent(normalizedRecipeId)}/${encodeURIComponent(userId)}`;
		const response = await this.fetchFitatuApi({
			method: "GET",
			path,
			headers: { accept: JSON_ACCEPT_HEADER },
		});

		if (!response.ok) {
			throw await RecipeError.fromResponse(response, "GET", path, "Fitatu recipe details request failed");
		}
		return RecipeDetails.fromApiResponse(
			await ResponseUtils.parseJsonObject(response, "Fitatu recipe response was not a valid JSON object"),
		);
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeCreateResult> {
		const created = await this.requestJsonObject({
			method: "POST",
			path: "/recipes",
			body: RecipeWriteInput.toRecipePayload(input, null),
			failureMessage: "Fitatu recipe creation failed",
		});
		const recipeId = StringUtils.parseStringValue(created.id, "Recipe creation response id is required");

		return { recipeId, details: await this.getRecipeAfterWrite(recipeId) };
	}

	public async replaceRecipe(recipeId: string | number, input: RecipeReplacementInput): Promise<RecipeReplaceResult> {
		const previousRecipeId = StringUtils.stringOrNull(recipeId);
		if (previousRecipeId === null) {
			throw new Error("recipeId is required");
		}
		const created = await this.requestJsonObject({
			method: "PUT",
			path: `/recipes/${encodeURIComponent(previousRecipeId)}`,
			body: RecipeWriteInput.toRecipePayload(input, input.categories),
			failureMessage: "Fitatu recipe update failed",
		});
		const nextRecipeId = StringUtils.parseStringValue(created.id, "Recipe update response id is required");

		return {
			previousRecipeId,
			recipeId: nextRecipeId,
			identityChanged: nextRecipeId !== previousRecipeId,
			details: await this.getRecipeAfterWrite(nextRecipeId),
		};
	}

	public async deleteRecipe(recipeId: string | number): Promise<{ readonly recipeId: string }> {
		const normalizedRecipeId = StringUtils.stringOrNull(recipeId);
		if (normalizedRecipeId === null) {
			throw new Error("recipeId is required");
		}
		const path = `/recipes/${encodeURIComponent(normalizedRecipeId)}`;
		const response = await this.fetchFitatuApi({
			method: "DELETE",
			path,
			headers: { accept: JSON_ACCEPT_HEADER },
		});

		if (!response.ok) {
			throw await RecipeError.fromResponse(response, "DELETE", path, "Fitatu recipe deletion failed");
		}
		await response.json();
		return { recipeId: normalizedRecipeId };
	}

	public async searchRecipes(options: RecipeSearchOptions = {}): Promise<RecipeSearchResult> {
		const query = options.query?.trim() ?? "";
		const scope = options.scope ?? "mine";
		const page = NumberUtils.parsePositiveInteger(options.page ?? 1, "page must be a positive integer");
		const limit = NumberUtils.parseIntegerInRange(
			options.limit ?? DEFAULT_SEARCH_LIMIT,
			1,
			MAX_SEARCH_LIMIT,
			`limit must be between 1 and ${MAX_SEARCH_LIMIT}`,
		);
		const limited =
			scope === "all"
				? await this.searchCombinedRecipePage({ query, page, limit })
				: RecipeSearchResult.deduplicateItems(
						await this.searchRecipeSource({ query, source: scope, page, limit }),
					).slice(0, limit);
		return { query, scope, page, limit, count: limited.length, items: limited };
	}

	private async searchRecipeSource(options: {
		readonly query: string;
		readonly source: RecipeSearchSource;
		readonly page: number;
		readonly limit: number;
	}): Promise<readonly RecipeSearchItem[]> {
		const path =
			options.source === "mine"
				? `/search/food/user/${encodeURIComponent(
						StringUtils.parseNonEmptyString(await this.getContextUserId(), "Fitatu user id is required"),
					)}`
				: "/search/new/food";
		const response = await this.fetchFitatuApi({
			method: "GET",
			path,
			headers: { accept: this.V3_ACCEPT_HEADER },
			query: {
				phrase: options.query,
				page: options.page,
				limit: options.limit,
				...(options.source === "public"
					? {
							locale: await this.getContextSearchLocale(),
							accessType: ["FREE", "PREMIUM"],
						}
					: {}),
			},
		});

		if (!response.ok) {
			throw await RecipeError.fromResponse(response, "GET", path, "Fitatu recipe search failed");
		}
		return RecipeSearchResult.extractItems(await response.json(), options.source);
	}

	private async searchCombinedRecipePage(options: {
		readonly query: string;
		readonly page: number;
		readonly limit: number;
	}): Promise<readonly RecipeSearchItem[]> {
		const mine: RecipeSearchItem[] = [];
		const publicItems: RecipeSearchItem[] = [];

		for (let sourcePage = 1; sourcePage <= options.page; sourcePage += 1) {
			const minePage = await this.searchRecipeSource({
				...options,
				source: "mine",
				page: sourcePage,
			});
			const publicPage = await this.searchRecipeSource({
				...options,
				source: "public",
				page: sourcePage,
			});
			mine.push(...minePage);
			publicItems.push(...publicPage);
		}

		const combined = RecipeSearchResult.deduplicateItems(interleave(mine, publicItems));
		const offset = (options.page - 1) * options.limit;
		return combined.slice(offset, offset + options.limit);
	}

	private async requestJsonObject(options: {
		readonly method: "POST" | "PUT";
		readonly path: string;
		readonly body: Record<string, unknown>;
		readonly failureMessage: string;
	}): Promise<Record<string, unknown>> {
		const response = await this.fetchFitatuApi({
			method: options.method,
			path: options.path,
			headers: {
				accept: JSON_ACCEPT_HEADER,
				"content-type": "application/json;charset=UTF-8",
			},
			body: JSON.stringify(options.body),
		});

		if (!response.ok) {
			throw await RecipeError.fromResponse(response, options.method, options.path, options.failureMessage);
		}
		return ResponseUtils.parseJsonObject(response, "Fitatu recipe response was not a valid JSON object");
	}

	private async getRecipeAfterWrite(recipeId: string): Promise<RecipeDetails> {
		let lastError: unknown;
		for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
			try {
				return await this.getRecipe(recipeId);
			} catch (error) {
				lastError = error;
				if (!(error instanceof RecipeError) || error.statusCode !== 404) {
					throw error;
				}
				if (attempt + 1 < READ_AFTER_WRITE_ATTEMPTS) {
					await wait(250);
				}
			}
		}
		throw lastError;
	}
}

function interleave(
	first: readonly RecipeSearchItem[],
	second: readonly RecipeSearchItem[],
): readonly RecipeSearchItem[] {
	const result: RecipeSearchItem[] = [];
	const length = Math.max(first.length, second.length);
	for (let index = 0; index < length; index += 1) {
		const firstItem = first[index];
		const secondItem = second[index];
		if (firstItem) {
			result.push(firstItem);
		}
		if (secondItem) {
			result.push(secondItem);
		}
	}
	return result;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
