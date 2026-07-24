export class JsonUtils {
	public static toJsonValue(value: unknown): unknown {
		return JSON.parse(JSON.stringify(value));
	}

	public static parse(text: unknown, errorMessage = "Value was not valid JSON"): unknown {
		if (typeof text !== "string") {
			throw new Error(errorMessage);
		}

		if (!text.trim()) {
			throw new Error(errorMessage);
		}

		return JSON.parse(text);
	}
}
