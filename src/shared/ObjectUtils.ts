export class ObjectUtils {
	public static isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
}
