import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't need a real DB for a frontend-only demo, but we define the shapes here for type safety.

export const analysisResults = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  toolType: text("tool_type").notNull(), // 'document'
  riskScore: integer("risk_score").notNull(),
  priority: text("priority").notNull(), // 'LOW', 'MEDIUM', 'CRITICAL'
  decision: text("decision").notNull(), // 'APPROVE', 'REJECT', 'MANUAL_REVIEW'
  evidence: jsonb("evidence").$type<string[]>().notNull(),
  summary: text("summary"),
  batchId: text("batch_id"),
  storageKey: text("storage_key"),
  actionRequired: text("action_required"),
  timestamp: timestamp("timestamp").defaultNow(),
  previewUrl: text("preview_url"),
  previewUrls: jsonb("preview_urls").$type<string[]>(),
  identity: jsonb("identity").$type<{
    name?: string;
    dob?: string;
    address?: string;
    confidence?: number;
  }>(),
  metadata: jsonb("metadata").$type<{
    decision: string;
    evidence: string[];
    docId?: string;
    batchIds?: string[];
    sourceType?: string;
  }>(),
  geolocation: jsonb("geolocation").$type<{
    decision: string;
    evidence: string[];
  }>(),
});

export const insertAnalysisResultSchema = createInsertSchema(analysisResults);

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;

export type ToolType = 'document' | 'image' | 'video' | 'audio';

export type KpiStats = {
  total: number;
  rejected: number;
  manual: number;
  approved: number;
};
