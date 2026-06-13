export class FitatuDietGenerationLimit {
  public declare readonly max?: number;
  public declare readonly min?: number;

  private constructor(data: Record<string, unknown>) {
    Object.assign(this, data);
  }

  public static fromApiResponse(data: unknown): FitatuDietGenerationLimit | null {
    if (data === null || data === undefined) {
      return null;
    }

    return new FitatuDietGenerationLimit(data as Record<string, unknown>);
  }
}
