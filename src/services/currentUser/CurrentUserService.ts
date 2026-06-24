import { FitatuUserClient } from "../../api/users/FitatuUserClient.ts";
import type { FitatuUserProfile } from "../../api/users/FitatuUserProfile.ts";

export class CurrentUserService {
	private readonly userClient: FitatuUserClient;

	public constructor(userClient: FitatuUserClient) {
		this.userClient = userClient;
	}

	public getCurrentUser(): Promise<FitatuUserProfile> {
		return this.userClient.getAuthenticatedUser();
	}
}
