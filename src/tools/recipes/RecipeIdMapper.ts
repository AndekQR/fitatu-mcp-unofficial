import { StringUtils } from "../../shared/StringUtils.ts";

const RECIPE_ID_PREFIX = "recipe:";
const MCP_RECIPE_ID_PATTERN = /^recipe:([1-9]\d*)$/;

export class RecipeIdMapper {
	public static readonly mcpPattern = /^recipe:[1-9]\d*$/;

	public static toMcp(value: string | number): string {
		const raw = StringUtils.parseStringOrSafeInteger(value, "recipeId is required");
		if (!/^[1-9]\d*$/.test(String(raw))) {
			throw new Error("recipeId must contain positive digits");
		}
		return `${RECIPE_ID_PREFIX}${raw}`;
	}

	public static fromMcp(value: unknown): string {
		const text = StringUtils.parseNonEmptyString(value, "recipeId is required");
		const match = MCP_RECIPE_ID_PATTERN.exec(text);
		if (!match?.[1]) {
			throw new Error("recipeId must use recipe:<digits> format");
		}
		return match[1];
	}
}
