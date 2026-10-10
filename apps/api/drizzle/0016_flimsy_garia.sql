ALTER TABLE "user" ALTER COLUMN "locale" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "locale" DROP NOT NULL;--> statement-breakpoint
UPDATE "user" SET "locale" = NULL;