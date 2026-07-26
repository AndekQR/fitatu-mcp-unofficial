import { z } from "zod";

const requestFailureBaseShape = {
	method: z.string(),
	endpointTemplate: z.string(),
};

const httpFailureOutputSchema = z.object({
	kind: z.literal("http"),
	...requestFailureBaseShape,
	statusCode: z.number().int().describe("HTTP status code returned by Fitatu."),
	statusText: z.string().nullable(),
	upstreamMessage: z.string().nullable(),
	upstreamCode: z.union([z.string(), z.number()]).nullable(),
	responseSnippet: z.string().nullable(),
});

const requestFailureOutputSchema = z.union([
	httpFailureOutputSchema,
	z.object({ kind: z.literal("transport"), ...requestFailureBaseShape, errorName: z.string() }),
	z.object({ kind: z.literal("invalidResponse"), ...requestFailureBaseShape }),
]);

const clientFailureOutputSchema = z.union([
	requestFailureOutputSchema,
	z.object({ kind: z.literal("invalidRequest") }),
	z.object({ kind: z.literal("authentication") }),
]);

export const fitatuClientErrorOutputSchema = z.object({
	name: z.literal("FitatuClientError"),
	message: z.string(),
	operation: z.string(),
	failure: clientFailureOutputSchema,
	attempts: z.array(requestFailureOutputSchema),
});

export const FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS = ["attempts"] as const;
export const FITATU_CLIENT_ERROR_NULL_KEYS = [
	"statusText",
	"upstreamMessage",
	"upstreamCode",
	"responseSnippet",
] as const;
