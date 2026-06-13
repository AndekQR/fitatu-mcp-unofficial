import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuUserError } from "./FitatuUserError.ts";
import type { FitatuUserClientOptions } from "./FitatuUserClientOptions.ts";
import { FitatuUserProfile } from "./FitatuUserProfile.ts";

export class FitatuUserClient extends FitatuApiClientBase {
  private static instance: FitatuUserClient | undefined;

  private readonly authClient: FitatuAuthClient;
  private readonly users = new Map<string, FitatuUserProfile>();

  private constructor(options: FitatuUserClientOptions = {}) {
    super(options);
    this.authClient = options.authClient ?? FitatuAuthClient.getInstance();
  }

  public static getInstance(
    options: FitatuUserClientOptions = {},
  ): FitatuUserClient {
    if (!FitatuUserClient.instance) {
      FitatuUserClient.instance = new FitatuUserClient(options);
    }

    return FitatuUserClient.instance;
  }

  public async getAuthenticatedUser(): Promise<FitatuUserProfile> {
    const session = await this.authClient.getSession();
    return this.getUser(session.fitatuUserId);
  }

  public async getUser(userId: string): Promise<FitatuUserProfile> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new FitatuUserError("Fitatu user id is required");
    }

    const cachedUser = this.users.get(normalizedUserId);
    if (cachedUser) {
      return cachedUser;
    }

    const session = await this.authClient.getSession();
    const response = await this.fetchFitatuApi({
      method: "GET",
      path: `/users/${encodeURIComponent(normalizedUserId)}`,
      bootstrap: true,
      apiClusterUserId: normalizedUserId,
      authorizationToken: session.token,
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
