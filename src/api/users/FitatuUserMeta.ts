export class FitatuUserMeta {
  public declare readonly goalAchievement?: string;
  public declare readonly userPlannerNutritionParams?: string;

  private constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
  }

  public static fromApiResponse(data: unknown): FitatuUserMeta | null {
    if (data === null || data === undefined) {
      return null;
    }

    return new FitatuUserMeta(data as Record<string, unknown>);
  }
}
