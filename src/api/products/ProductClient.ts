import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { ProductCreateResult } from "./ProductCreateResult.ts";
import { ProductWriteInput } from "./ProductWriteInput.ts";

const JSON_ACCEPT_HEADER = "application/json";

/** Fitatu `/products` resource: user-owned food products. */
export class ProductClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });
		super({ ...options, authClient, userClient });
	}

	public async createProduct(input: ProductWriteInput): Promise<ProductCreateResult> {
		const body = createProductPayload(input);
		return this.performCallout({
			operation: FITATU_CLIENT_OPERATIONS.productsCreate,
			method: "POST",
			path: "/products",
			endpointTemplate: "/products",
			failureMessage: "Fitatu product creation failed",
			invalidResponseMessage: "Fitatu product response was invalid",
			headers: {
				accept: JSON_ACCEPT_HEADER,
				"content-type": "application/json;charset=UTF-8",
			},
			body: JSON.stringify(body),
			decoder: (data) => decodeProductCreateResponse(data, String(body.name)),
		});
	}
}

function createProductPayload(input: ProductWriteInput): Record<string, unknown> {
	try {
		return ProductWriteInput.toProductPayload(input);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.productsCreate,
			message: error.message,
		});
	}
}

function decodeProductCreateResponse(data: unknown, requestedName: string): ProductCreateResult {
	try {
		return ProductCreateResult.fromApiResponse(data, requestedName);
	} catch (error) {
		if (!(error instanceof ValidationError)) throw error;
		throw new FitatuResponseDecodeError(error.message);
	}
}
