import { JsonUtils } from "../../shared/JsonUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
	if (!ObjectUtils.isRecord(value)) {
		throw new FitatuResponseDecodeError(`${fieldName} was not a valid JSON object`);
	}

	return value;
}

export async function parseOptionalJson(response: Response): Promise<unknown> {
	const text = await response.text();
	return text.trim() ? JsonUtils.parse(text) : null;
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

	if (!ObjectUtils.isRecord(data)) {
		return null;
	}

	const errorMessage = parseOptionalProblemMessage(data.errorMessage, data.error);
	if (errorMessage) {
		return errorMessage;
	}

	if (data.ok === false) {
		return parseOptionalProblemMessage(data.message) ?? "Fitatu request failed";
	}

	const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
	if (["error", "failed", "failure"].includes(status)) {
		return parseOptionalProblemMessage(data.message) ?? "Fitatu request failed";
	}

	return null;
}

function parseOptionalProblemMessage(...values: readonly unknown[]): string | null {
	if (values.every((value) => value === null || value === undefined)) {
		return null;
	}

	const message = StringUtils.firstNonEmptyString(...values);
	if (!message) {
		throw new FitatuResponseDecodeError("Fitatu problem message must be a non-empty string");
	}

	return message;
}
