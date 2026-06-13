import { FitatuDietGenerationIndicatedLimits } from "./FitatuDietGenerationIndicatedLimits.ts";

export class FitatuDietGeneration {
  public readonly indicatedLimits: FitatuDietGenerationIndicatedLimits | null;

  private constructor(data: Record<string, unknown>) {
    this.indicatedLimits = FitatuDietGenerationIndicatedLimits.fromApiResponse(
      data.indicatedLimits,
    );
  }

  public static fromApiResponse(data: unknown): FitatuDietGeneration | null {
    if (data === null || data === undefined) {
      return null;
    }

    return new FitatuDietGeneration(data as Record<string, unknown>);
  }
}
