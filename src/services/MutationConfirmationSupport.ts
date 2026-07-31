import { FitatuClientError } from "../api/fitatuApiClientBase/FitatuClientError.ts";
import { BoundedPoller } from "../shared/BoundedPoller.ts";
import type { MutationConfirmationContext } from "./MutationConfirmationContext.ts";
import { MutationConfirmationError } from "./MutationConfirmationError.ts";

export class MutationConfirmationSupport {
	private readonly poller: BoundedPoller;

	public constructor(poller: BoundedPoller) {
		this.poller = poller;
	}

	public async confirm(context: MutationConfirmationContext, isConfirmed: () => Promise<boolean>): Promise<void> {
		await this.poller.pollUntil(
			async () => {
				try {
					return await isConfirmed();
				} catch (error) {
					if (isRetryableReadError(error)) {
						return false;
					}
					if (error instanceof FitatuClientError) {
						throw MutationConfirmationError.readFailed(context);
					}
					throw error;
				}
			},
			() => MutationConfirmationError.timeout(context),
		);
	}
}

function isRetryableReadError(error: unknown): boolean {
	if (!(error instanceof FitatuClientError)) {
		return false;
	}
	if (error.failure.kind === "transport") {
		return true;
	}
	if (error.failure.kind !== "http") {
		return false;
	}
	return (
		error.failure.statusCode === 408 ||
		error.failure.statusCode === 425 ||
		error.failure.statusCode === 429 ||
		error.failure.statusCode >= 500
	);
}
