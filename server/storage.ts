import { type AnalysisResult, type InsertAnalysisResult } from "@shared/schema";

export interface IStorage {
  // We don't strictly need these for the frontend-only demo, but it satisfies the template
  createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult>;
}

export class MemStorage implements IStorage {
  private results: Map<number, AnalysisResult>;
  private currentId: number;

  constructor() {
    this.results = new Map();
    this.currentId = 1;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }

  private normalizeMetadata(value: unknown): AnalysisResult["metadata"] {
    if (!value || typeof value !== "object") return null;
    const decisionRaw = (value as { decision?: unknown }).decision;
    const evidenceRaw = (value as { evidence?: unknown }).evidence;
    const decision = typeof decisionRaw === "string" ? decisionRaw : "";
    const evidence = this.normalizeStringArray(evidenceRaw);
    if (!decision && evidence.length === 0) return null;
    return { decision, evidence };
  }

  async createAnalysisResult(insertResult: InsertAnalysisResult): Promise<AnalysisResult> {
    const id = this.currentId++;
    const timestamp = insertResult.timestamp ? new Date(insertResult.timestamp as Date) : new Date();
    const evidence = this.normalizeStringArray(insertResult.evidence);
    const previewUrls =
      insertResult.previewUrls && Array.isArray(insertResult.previewUrls)
        ? this.normalizeStringArray(insertResult.previewUrls)
        : null;
    const result: AnalysisResult = { 
      ...insertResult, 
      id, 
      timestamp,
      actionRequired: insertResult.actionRequired ?? null,
      summary: insertResult.summary ?? null,
      metadata: this.normalizeMetadata(insertResult.metadata),
      geolocation: this.normalizeMetadata(insertResult.geolocation),
      evidence,
      previewUrl: insertResult.previewUrl ?? null,
      previewUrls: previewUrls && previewUrls.length > 0 ? previewUrls : null,
    };
    this.results.set(id, result);
    return result;
  }
}

export const storage = new MemStorage();
