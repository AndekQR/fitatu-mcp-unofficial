import type { NormalizedFoodSearchItem } from "../../api/foodSearch/NormalizedFoodSearchItem.ts";

const MINIMUM_TOKEN_LENGTH = 2;

const LATIN_CHARACTER_FOLD: Readonly<Record<string, string>> = {
	ł: "l",
	đ: "d",
	ð: "d",
	þ: "th",
	æ: "ae",
	œ: "oe",
	ø: "o",
};

export class UserFoodRelevanceFilter {
	public filter(query: string, items: readonly NormalizedFoodSearchItem[]): readonly NormalizedFoodSearchItem[] {
		const queryTokens = tokens(query);
		if (queryTokens.size === 0) {
			return [];
		}

		return items.filter((item) => this.hasMatchingToken(queryTokens, item));
	}

	private hasMatchingToken(queryTokens: ReadonlySet<string>, item: NormalizedFoodSearchItem): boolean {
		const candidateTokens = tokens([item.name, item.brand].filter(isNonEmptyString).join(" "));
		for (const queryToken of queryTokens) {
			if (candidateTokens.has(queryToken)) {
				return true;
			}
		}
		return false;
	}
}

function tokens(value: string): ReadonlySet<string> {
	return new Set(
		value
			.normalize("NFKD")
			.toLowerCase()
			.replace(/\p{Diacritic}/gu, "")
			.replace(/[łđðþæœø]/g, (character) => LATIN_CHARACTER_FOLD[character] ?? character)
			.match(/[\p{Letter}\p{Number}]+/gu)
			?.filter((token) => token.length >= MINIMUM_TOKEN_LENGTH) ?? [],
	);
}

function isNonEmptyString(value: string | null): value is string {
	return typeof value === "string" && value.length > 0;
}
