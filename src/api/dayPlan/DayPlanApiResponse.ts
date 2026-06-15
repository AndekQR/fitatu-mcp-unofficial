import { DayPlanError } from "./DayPlanError.ts";

export function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new DayPlanError(`${fieldName} was not a valid JSON object`);
	}

	return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function parseOptionalJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text.trim()) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export function getApiProblemMessage(data: unknown): string | null {
	if (Array.isArray(data)) {
		for (const item of data) {
			const message = getApiProblemMessage(item);
			if (message) {
				return message;
			}
		}
		return null;
	}

	if (!isRecord(data)) {
		return null;
	}

	const errorMessage = firstNonEmptyString(data.errorMessage, data.error);
	if (errorMessage) {
		return errorMessage;
	}

	if (data.ok === false) {
		return firstNonEmptyString(data.message) ?? "Fitatu request failed";
	}

	const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
	if (["error", "failed", "failure"].includes(status)) {
		return firstNonEmptyString(data.message) ?? "Fitatu request failed";
	}

	return null;
}

function firstNonEmptyString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return null;
}
