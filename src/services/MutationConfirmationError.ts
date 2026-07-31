import { ServiceError } from "./ServiceError.ts";
import { SERVICE_ERROR_CODES } from "./ServiceErrorCode.ts";
import type { MutationConfirmationContext } from "./MutationConfirmationContext.ts";

export class MutationConfirmationError extends ServiceError {
	public static timeout(context: MutationConfirmationContext): MutationConfirmationError {
		return new MutationConfirmationError(
			`Fitatu accepted the ${context.subject}, but its effect could not be confirmed within 60 seconds. Do not retry automatically; inspect the current state with ${context.inspectionTool}.`,
			SERVICE_ERROR_CODES.mutationConfirmationTimeout,
		);
	}

	public static readFailed(context: MutationConfirmationContext): MutationConfirmationError {
		return new MutationConfirmationError(
			`Fitatu accepted the ${context.subject}, but the confirmation read failed. Do not retry automatically; inspect the current state with ${context.inspectionTool}.`,
			SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
		);
	}

	private constructor(message: string, code: (typeof SERVICE_ERROR_CODES)[keyof typeof SERVICE_ERROR_CODES]) {
		super(message, "unconfirmed", code);
		this.name = "MutationConfirmationError";
	}
}
