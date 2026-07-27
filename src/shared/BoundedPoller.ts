const DEFAULT_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 10_000;

export type BoundedPollerOptions = Readonly<{
	intervalMs?: number;
	timeoutMs?: number;
}>;

export class BoundedPoller {
	private readonly intervalMs: number;
	private readonly timeoutMs: number;

	public constructor(options: BoundedPollerOptions = {}) {
		this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	public async pollUntil(isConfirmed: () => Promise<boolean>, createTimeoutError: () => Error): Promise<void> {
		const deadline = Date.now() + this.timeoutMs;

		while (true) {
			const remainingBeforeAttempt = deadline - Date.now();
			if (remainingBeforeAttempt <= 0) {
				throw createTimeoutError();
			}

			const confirmed = await this.runAttemptWithin(isConfirmed, remainingBeforeAttempt, createTimeoutError);
			if (confirmed) {
				return;
			}

			const remainingAfterAttempt = deadline - Date.now();
			if (remainingAfterAttempt <= 0) {
				throw createTimeoutError();
			}

			await wait(Math.min(this.intervalMs, remainingAfterAttempt));
		}
	}

	private async runAttemptWithin(
		attempt: () => Promise<boolean>,
		timeoutMs: number,
		createTimeoutError: () => Error,
	): Promise<boolean> {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeout = setTimeout(() => {
				reject(createTimeoutError());
			}, timeoutMs);
		});

		try {
			return await Promise.race([attempt(), timeoutPromise]);
		} finally {
			if (timeout !== undefined) {
				clearTimeout(timeout);
			}
		}
	}
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
