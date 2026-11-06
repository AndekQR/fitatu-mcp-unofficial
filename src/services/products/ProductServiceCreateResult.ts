import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import type { ProductCreateResult } from "../../api/products/ProductCreateResult.ts";
import type { ProductWarning } from "./ProductWarning.ts";

export type ProductCreateStatus = "confirmed" | "unconfirmed";

export class ProductServiceCreateResult {
	public readonly created: ProductCreateResult;
	/** Measures read back from Fitatu; empty when the read-back failed. */
	public readonly measures: readonly FoodMeasure[];
	/** Measure id whose quantity is a number of grams, or null when the read-back did not expose one. */
	public readonly gramMeasureId: string | null;
	public readonly warnings: readonly ProductWarning[];
	public readonly status: ProductCreateStatus;

	public constructor(
		created: ProductCreateResult,
		measures: readonly FoodMeasure[],
		gramMeasureId: string | null,
		warnings: readonly ProductWarning[],
		status: ProductCreateStatus,
	) {
		this.created = created;
		this.measures = measures;
		this.gramMeasureId = gramMeasureId;
		this.warnings = warnings;
		this.status = status;
	}

	public get productId(): string {
		return this.created.productId;
	}

	public get name(): string {
		return this.created.name;
	}
}
