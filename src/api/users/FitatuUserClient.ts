import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import type { FitatuUserClientOptions } from "./FitatuUserClientOptions.ts";
import { FitatuUserProfile } from "./FitatuUserProfile.ts";

export class FitatuUserClient extends FitatuApiClientBase {
	private static instance: FitatuUserClient | undefined;

	private readonly users = new Map<string, FitatuUserProfile>();

	private constructor(options: FitatuUserClientOptions = {}) {
		super({
			...options,
			authClient: options.authClient ?? FitatuAuthClient.getInstance(),
		});
	}

	public static getInstance(options: FitatuUserClientOptions = {}): FitatuUserClient {
		if (!FitatuUserClient.instance) {
			FitatuUserClient.instance = new FitatuUserClient(options);
		}

		return FitatuUserClient.instance;
	}

	public async getAuthenticatedUser(): Promise<FitatuUserProfile> {
		const userId = StringUtils.firstNonEmptyString(await this.getContextUserId());
		if (!userId) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.usersGet,
				message: "Fitatu user id is required",
			});
		}

		return this.getUser(userId);
	}

	public async getCurrentUser(): Promise<FitatuUserProfile> {
		return this.getAuthenticatedUser();
	}

	public async getUser(userId: string): Promise<FitatuUserProfile> {
		const normalizedUserId = StringUtils.firstNonEmptyString(userId);
		if (!normalizedUserId) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.usersGet,
				message: "Fitatu user id is required",
			});
		}
		const path = `/users/${encodeURIComponent(normalizedUserId)}`;

		const cachedUser = this.users.get(normalizedUserId);
		if (cachedUser) {
			return cachedUser;
		}

		const user = await this.requestJson({
			operation: FITATU_CLIENT_OPERATIONS.usersGet,
			method: "GET",
			path,
			endpointTemplate: "/users/:userId",
			failureMessage: "Fitatu user request failed",
			invalidResponseMessage: "Fitatu user response was invalid",
			decoder: FitatuUserProfile.fromApiResponse,
		});
		this.users.set(normalizedUserId, user);

		return user;
	}

	public clearUserCache(): void {
		this.users.clear();
	}
}
