import { FitatuUserClient } from "../../api/users/FitatuUserClient.ts";
import type { FitatuUserProfile } from "../../api/users/FitatuUserProfile.ts";

export interface CurrentUserProvider {
	getCurrentUser(): Promise<FitatuUserProfile>;
}

export class CurrentUserService implements CurrentUserProvider {
	private readonly userClient: FitatuUserClient;

	public constructor(userClient: FitatuUserClient) {
		this.userClient = userClient;
	}

	public getCurrentUser(): Promise<FitatuUserProfile> {
		return this.userClient.getAuthenticatedUser();
	}
}
