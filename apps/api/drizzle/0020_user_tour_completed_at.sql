ALTER TABLE "user" ADD COLUMN "tour_completed_at" timestamp;--> statement-breakpoint
UPDATE "user" SET "tour_completed_at" = now();
