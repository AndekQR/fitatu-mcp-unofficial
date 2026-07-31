import type { ServiceErrorCode } from "./ServiceErrorCode.ts";
import type { ServiceErrorKind } from "./ServiceErrorKind.ts";

export class ServiceError extends Error {
	public readonly kind: ServiceErrorKind;
	public readonly code: ServiceErrorCode;

	public constructor(message: string, kind: ServiceErrorKind, code: ServiceErrorCode) {
		super(message);
		this.name = "ServiceError";
		this.kind = kind;
		this.code = code;
	}
}
