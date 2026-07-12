export interface FetchCall {
	readonly input: Parameters<typeof fetch>[0];
	readonly init: Parameters<typeof fetch>[1];
}

export interface FetchStub {
	readonly calls: readonly FetchCall[];
	readonly fetchFn: typeof fetch;
}

export function createFetchStub(...responses: readonly Response[]): FetchStub {
	const calls: FetchCall[] = [];

	const fetchFn: typeof fetch = async (input, init) => {
		calls.push({ input, init });
		const response = responses[calls.length - 1];

		if (!response) {
			throw new Error(`Unexpected fetch call: no response configured for call ${calls.length}`);
		}

		return response;
	};

	return { calls, fetchFn };
}

export function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	if (!headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}

	return new Response(JSON.stringify(body), { ...init, headers });
}
