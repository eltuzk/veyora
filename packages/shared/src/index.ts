import { z } from "zod";

export const RatingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** Body of POST /reviews (docs/SPEC.md, mục API). */
export const ReviewRequestSchema = z.object({
  id: z.uuid(),
  cardId: z.uuid(),
  rating: RatingSchema,
  reviewedAt: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  typedAnswer: z.string().optional(),
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
