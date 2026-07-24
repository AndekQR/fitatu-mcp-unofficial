import { ObjectUtils } from "./ObjectUtils.ts";

export class ResponseUtils {
	public static async parseJsonObject(
		response: Response,
		errorMessage = "Response was not a valid JSON object",
	): Promise<Record<string, unknown>> {
		const data: unknown = await response.json();
		if (!ObjectUtils.isRecord(data)) {
			throw new Error(errorMessage);
		}

		return data;
	}
}
