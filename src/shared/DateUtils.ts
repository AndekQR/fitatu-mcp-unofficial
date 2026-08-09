import { ValidationError } from "./ValidationError.ts";

export interface IsoDateValidationOptions {
	readonly fieldName?: string;
	readonly formatErrorMessage?: string;
	readonly calendarErrorMessage?: string;
	readonly minimumYear?: number;
	readonly minimumYearErrorMessage?: string;
}

export class DateUtils {
	public static toLocalDateString(date: unknown = new Date()): string {
		if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
			throw new ValidationError("Value must be a valid date");
		}

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	public static validateIsoDate(value: unknown, options: IsoDateValidationOptions = {}): string {
		const fieldName = options.fieldName ?? "date";
		if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
			throw new ValidationError(options.formatErrorMessage ?? `${fieldName} must use YYYY-MM-DD format`);
		}

		const date = value.trim();
		const year = Number(date.slice(0, 4));
		const minimumYear = options.minimumYear ?? 1;
		if (year < minimumYear) {
			throw new ValidationError(
				options.minimumYearErrorMessage ?? `${fieldName} year must be greater than or equal to ${minimumYear}`,
			);
		}

		const parsed = new Date(`${date}T00:00:00.000Z`);
		if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
			throw new ValidationError(options.calendarErrorMessage ?? `${fieldName} must be a valid calendar date`);
		}

		return date;
	}
}
