import { z } from "zod";
import { DateUtils } from "../../shared/DateUtils.ts";

export function nonEmptyStringSchema(fieldName: string) {
	return z.string().trim().min(1, `${fieldName} must be a non-empty string`);
}

export const rawRecipeIdSchema = nonEmptyStringSchema("recipeId");

export function isoCalendarDateSchema(fieldName = "date") {
	return z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, `${fieldName} must use YYYY-MM-DD format`)
		.refine((value) => {
			try {
				DateUtils.validateIsoDate(value);
				return true;
			} catch {
				return false;
			}
		}, `${fieldName} must be a real calendar date in YYYY-MM-DD format`);
}
