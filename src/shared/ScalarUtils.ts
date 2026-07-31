export class ScalarUtils {
	public static stringOrFiniteNumberOrNull(value: unknown): string | number | null {
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}

		if (typeof value === "string") {
			return value.trim() || null;
		}

		return null;
	}
}
