import type { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";

export type ProductWarningCode = "PRODUCT_MEASURES_UNAVAILABLE" | "GRAM_MEASURE_NOT_FOUND";

/** Non-fatal problem found after Fitatu has already stored the product. */
export class ProductWarning {
	public readonly code: ProductWarningCode;
	public readonly message: string;
	public readonly clientError: FitatuClientError | null;

	public constructor(code: ProductWarningCode, message: string, clientError: FitatuClientError | null = null) {
		this.code = code;
		this.message = message;
		this.clientError = clientError;
	}
}
