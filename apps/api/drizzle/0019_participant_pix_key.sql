ALTER TABLE "participant" ADD COLUMN "pix_key" text;--> statement-breakpoint
UPDATE "participant" SET "pix_key" = "contract"."pix_key" FROM "contract" WHERE "participant"."contract_id" = "contract"."id" AND "participant"."role" = 'seller' AND "contract"."pix_key" IS NOT NULL;
