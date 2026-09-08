import type { UserDietSettingsPatch } from "./UserDietSettingsPatch.ts";

export class UpdateUserSettingsRequest {
	public readonly userId: string;
	public readonly userDietSettings?: UserDietSettingsPatch;
	public readonly waterServingSizeMl?: number;

	public constructor(userId: string, userDietSettings?: UserDietSettingsPatch, waterServingSizeMl?: number) {
		this.userId = userId;
		this.userDietSettings = userDietSettings;
		this.waterServingSizeMl = waterServingSizeMl;
	}
}
