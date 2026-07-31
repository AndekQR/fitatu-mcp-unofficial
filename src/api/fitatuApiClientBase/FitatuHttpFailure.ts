import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";

const MAX_RESPONSE_SNIPPET_LENGTH = 500;
const SENSITIVE_KEY_PATTERN = /(authorization|auth|cookie|email|password|secret|token|user)/i;

export class FitatuHttpFailure {
	public readonly kind = "http" as const;

	public readonly method: string;
	public readonly endpointTemplate: string;
	public readonly statusCode: number;
	public readonly statusText: string | null;
	public readonly upstreamCode: string | number | null;
	public readonly upstreamMessage: string | null;
	public readonly responseSnippet: string | null;

	private constructor(options: {
		readonly method: string;
		readonly endpointTemplate: string;
		readonly statusCode: number;
		readonly statusText: string | null;
		readonly upstreamCode: string | number | null;
		readonly upstreamMessage: string | null;
		readonly responseSnippet: string | null;
	}) {
		this.method = options.method;
		this.endpointTemplate = options.endpointTemplate;
		this.statusCode = options.statusCode;
		this.statusText = options.statusText;
		this.upstreamCode = options.upstreamCode;
		this.upstreamMessage = options.upstreamMessage;
		this.responseSnippet = options.responseSnippet;
	}

	public static async fromResponse(options: {
		readonly response: Response;
		readonly method: string;
		readonly endpointTemplate: string;
	}): Promise<FitatuHttpFailure> {
		const text = await options.response.text().catch(() => "");
		const data = parseJsonIfPossible(text);

		return new FitatuHttpFailure({
			method: options.method,
			endpointTemplate: options.endpointTemplate,
			statusCode: options.response.status,
			statusText: options.response.statusText || null,
			upstreamMessage: redactNullableText(firstStringFromData(data, "errorMessage", "error", "message")),
			upstreamCode: redactUpstreamCode(firstScalarFromData(data, "code", "errorCode", "statusCode")),
			responseSnippet: createResponseSnippet(data, text),
		});
	}
}

function parseJsonIfPossible(text: string): unknown {
	if (!text.trim()) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return null;
		}
		throw error;
	}
}

function createResponseSnippet(data: unknown, text: string): string | null {
	const redacted = data === null ? redactText(text) : JSON.stringify(redactJsonValue(data));
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
	if (!ObjectUtils.isRecord(value)) {
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
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
		.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
		.replace(/\b(token|password|secret|cookie)\s+[^,\s;]+/gi, "$1 [REDACTED]")
		.replace(
			/("?(?:authorization|cookie|email|password|secret|token|user)[^":=]*"?\s*[:=]\s*)"[^"]*"/gi,
			'$1"[REDACTED]"',
		);
}

function redactNullableText(value: string | null): string | null {
	return value === null ? null : redactText(value);
}

function redactUpstreamCode(value: string | number | null): string | number | null {
	return typeof value === "string" ? redactText(value) : value;
}

function firstStringFromData(data: unknown, ...keys: readonly string[]): string | null {
	const scalar = firstScalarFromData(data, ...keys);
	return StringUtils.firstNonEmptyString(scalar) ?? null;
}

function firstScalarFromData(data: unknown, ...keys: readonly string[]): string | number | null {
	if (!ObjectUtils.isRecord(data)) {
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
