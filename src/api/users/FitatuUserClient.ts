import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserError } from "./FitatuUserError.ts";
import type { FitatuUserClientOptions } from "./FitatuUserClientOptions.ts";
import { FitatuUserProfile } from "./FitatuUserProfile.ts";

export class FitatuUserClient extends FitatuApiClientBase {
	private static instance: FitatuUserClient | undefined;

	private readonly users = new Map<string, FitatuUserProfile>();

	private constructor(options: FitatuUserClientOptions = {}) {
		super({
			...options,
			sessionProvider: options.sessionProvider ?? FitatuAuthClient.getInstance(),
		});
	}

	public static getInstance(options: FitatuUserClientOptions = {}): FitatuUserClient {
		if (!FitatuUserClient.instance) {
			FitatuUserClient.instance = new FitatuUserClient(options);
		}

		return FitatuUserClient.instance;
	}

	public async getAuthenticatedUser(): Promise<FitatuUserProfile> {
		return this.getUser(normalizeUserId(await this.getContextUserId()));
	}

	public async getCurrentUser(): Promise<FitatuUserProfile> {
		return this.getAuthenticatedUser();
	}

	public async getUser(userId: string): Promise<FitatuUserProfile> {
		const normalizedUserId = normalizeUserId(userId);

		const cachedUser = this.users.get(normalizedUserId);
		if (cachedUser) {
			return cachedUser;
		}

		const response = await this.fetchFitatuApi({
			method: "GET",
			path: `/users/${encodeURIComponent(normalizedUserId)}`,
		});

		if (!response.ok) {
			throw new FitatuUserError("Fitatu user request failed", {
				statusCode: response.status,
			});
		}

		const user = FitatuUserProfile.fromApiResponse(await response.json());
		this.users.set(normalizedUserId, user);

		return user;
	}

	public clearUserCache(): void {
		this.users.clear();
	}
}

function normalizeUserId(value: string | undefined): string {
	const userId = value?.trim();
	if (!userId) {
		throw new FitatuUserError("Fitatu user id is required");
	}

	return userId;
}
