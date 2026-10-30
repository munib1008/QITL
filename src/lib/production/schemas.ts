/** Request schemas for the Story Production Studio routes (shared with the Studio forms). */
import { z } from "zod";
import { SCENE_KINDS, SCENE_STEP_ROLES, SCRIPT_AUDIENCES, SCRIPT_LANGUAGES } from "@/lib/player/types";

export const ANIMATION_KEYS = ["rain-flood", "sea-path", "wheat-cycles", "cave-daylight", "foundations-rising", "palace-architecture", "beginning-timeline", "desert-route"] as const;

export const SceneInput = z
  .object({
    kind: z.enum(SCENE_KINDS),
    stepRole: z.enum(SCENE_STEP_ROLES).nullable().default(null),
    title: z.string().trim().min(1).max(200),
    narrationText: z.string().trim().min(1).max(5000),
    lessons: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
    animationKey: z.enum(ANIMATION_KEYS).nullable().default(null),
    ambientKey: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable().default(null),
    estDurationMs: z.number().int().min(500).max(600000).nullable().default(null),
  })
  .refine((s) => s.kind === "sequence" || s.stepRole === null, { message: "Only sequence scenes take a step role.", path: ["stepRole"] });

const Subject = z
  .object({ personId: z.string().uuid().optional(), eventId: z.string().uuid().optional() })
  .refine((s) => Boolean(s.personId) !== Boolean(s.eventId), { message: "Choose exactly one person or event." });

export const ScriptCreate = z.intersection(
  Subject,
  z.object({
    language: z.enum(SCRIPT_LANGUAGES),
    audience: z.enum(SCRIPT_AUDIENCES),
    title: z.string().trim().min(1).max(200),
    scenes: z.array(SceneInput).min(1).max(40),
  }),
);

export const ClaimLink = z.object({ sceneId: z.string().uuid(), claimId: z.string().uuid(), anchor: z.string().trim().max(300).optional() });

export const ScriptReview = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), scriptId: z.string().uuid() }),
  z.object({ action: z.literal("publish"), scriptId: z.string().uuid() }),
  z.object({ action: z.literal("decide"), scriptId: z.string().uuid(), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
]);

export const TranslateRequest = z.object({ scriptId: z.string().uuid(), targetLanguage: z.enum(SCRIPT_LANGUAGES) });

export const TranslationReview = z.object({
  scriptId: z.string().uuid(),
  aspect: z.enum(["linguistic", "religious", "terminology"]),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

export const NarrateRequest = z.object({ sceneId: z.string().uuid(), voiceId: z.string().uuid() });

export const AudioQa = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pronunciation"), audioId: z.string().uuid(), ok: z.boolean() }),
  z.object({ action: z.literal("approve"), audioId: z.string().uuid() }),
  z.object({ action: z.literal("reject"), audioId: z.string().uuid() }),
]);

export const AmbienceRequest = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    key: z.string().regex(/^[a-z0-9-]{2,40}$/),
    label: z.string().trim().min(1).max(120),
    storagePath: z.string().trim().min(1).max(300).regex(/^[A-Za-z0-9/_.-]+$/),
    licenceSourceId: z.string().uuid(),
    defaultGain: z.number().min(0).max(0.4),
    kidsOk: z.boolean(),
  }),
  z.object({ action: z.literal("approve"), key: z.string().regex(/^[a-z0-9-]{2,40}$/) }),
]);

export const DraftRequest = z.intersection(
  Subject,
  z.object({
    language: z.enum(SCRIPT_LANGUAGES),
    audience: z.enum(SCRIPT_AUDIENCES),
    title: z.string().trim().min(1).max(200),
    claimIds: z.array(z.string().uuid()).min(1).max(60),
  }),
);
