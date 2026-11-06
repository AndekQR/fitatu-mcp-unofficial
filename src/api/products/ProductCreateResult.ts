import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";

/** Receipt returned by Fitatu for a newly created product. */
export class ProductCreateResult {
	public readonly productId: string;
	public readonly name: string;

	private constructor(productId: string, name: string) {
		this.productId = productId;
		this.name = name;
	}

	/** Fitatu echoes the stored name; the requested name is used when it does not. */
	public static fromApiResponse(data: unknown, requestedName: string): ProductCreateResult {
		if (!ObjectUtils.isRecord(data)) {
			throw new ValidationError("Fitatu product response was not a valid JSON object");
		}
		const productId = StringUtils.stringOrNull(data.id);
		if (!productId) {
			throw new ValidationError("Fitatu product response id is required");
		}
		return new ProductCreateResult(productId, StringUtils.firstNonEmptyString(data.name) ?? requestedName);
	}
}
