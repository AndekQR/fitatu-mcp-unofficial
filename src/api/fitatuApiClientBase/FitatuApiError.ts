const MAX_RESPONSE_SNIPPET_LENGTH = 500;
const SENSITIVE_KEY_PATTERN = /(authorization|auth|cookie|email|password|secret|token|user)/i;

export interface FitatuApiErrorDetails {
	readonly statusCode: number;
	readonly statusText: string | null;
	readonly method: string;
	readonly path: string;
	readonly upstreamMessage: string | null;
	readonly upstreamCode: string | number | null;
	readonly responseSnippet: string | null;
}

export interface FitatuApiErrorOptions {
	readonly statusCode?: number;
	readonly fitatuApiError?: FitatuApiErrorDetails;
	readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];
}

export interface ErrorWithFitatuApiDetails extends Error {
	readonly statusCode?: number;
	readonly fitatuApiError?: FitatuApiErrorDetails;
	readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];
}

export async function createFitatuApiErrorDetails(
	response: Response,
	request: { readonly method: string; readonly path: string },
): Promise<FitatuApiErrorDetails> {
	const text = await response.text().catch(() => "");
	const data = parseJsonOrNull(text);

	return createFitatuApiErrorDetailsFromData({
		data,
		method: request.method,
		path: request.path,
		statusCode: response.status,
		statusText: response.statusText || null,
		text,
	});
}

export function createFitatuApiErrorDetailsFromData(options: {
	readonly data: unknown;
	readonly method: string;
	readonly path: string;
	readonly statusCode: number;
	readonly statusText?: string | null;
	readonly text?: string;
}): FitatuApiErrorDetails {
	return {
		statusCode: options.statusCode,
		statusText: options.statusText ?? null,
		method: options.method,
		path: options.path,
		upstreamMessage: firstNonEmptyStringFromData(options.data, "errorMessage", "error", "message"),
		upstreamCode: firstScalarFromData(options.data, "code", "errorCode", "statusCode"),
		responseSnippet: createResponseSnippet(options.data, options.text),
	};
}

export function isErrorWithFitatuApiDetails(error: unknown): error is ErrorWithFitatuApiDetails {
	return error instanceof Error && ("fitatuApiError" in error || "fitatuApiErrors" in error || "statusCode" in error);
}

export function getFitatuApiErrors(error: unknown): readonly FitatuApiErrorDetails[] {
	if (!isErrorWithFitatuApiDetails(error)) {
		return [];
	}

	return [...(error.fitatuApiErrors ?? []), ...(error.fitatuApiError ? [error.fitatuApiError] : [])];
}

function parseJsonOrNull(text: string): unknown {
	if (!text.trim()) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function createResponseSnippet(data: unknown, text: string | undefined): string | null {
	const redacted = data === null ? redactText(text ?? "") : JSON.stringify(redactJsonValue(data));
	const trimmed = redacted.trim();
	if (!trimmed) {
		return null;
	}

	return trimmed.length > MAX_RESPONSE_SNIPPET_LENGTH
		? `${trimmed.slice(0, MAX_RESPONSE_SNIPPET_LENGTH)}...`
		: trimmed;
}

function redactJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactJsonValue);
	}
	if (!isRecord(value)) {
		return typeof value === "string" ? redactText(value) : value;
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, child]) => [
			key,
			SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactJsonValue(child),
		]),
	);
}

function redactText(value: string): string {
	return value
		.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
		.replace(
			/("?(?:authorization|cookie|email|password|secret|token|user)[^":=]*"?\s*[:=]\s*)"[^"]*"/gi,
			'$1"[REDACTED]"',
		);
}

function firstNonEmptyStringFromData(data: unknown, ...keys: readonly string[]): string | null {
	const scalar = firstScalarFromData(data, ...keys);
	return typeof scalar === "string" && scalar.trim() ? scalar.trim() : null;
}

function firstScalarFromData(data: unknown, ...keys: readonly string[]): string | number | null {
	if (!isRecord(data)) {
		return null;
	}

	for (const key of keys) {
		const value = data[key];
		if ((typeof value === "string" && value.trim()) || typeof value === "number") {
			return value;
		}
	}

	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
