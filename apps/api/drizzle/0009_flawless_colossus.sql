ALTER TABLE "proof" DROP CONSTRAINT "proof_uploaded_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "proof" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proof" ADD CONSTRAINT "proof_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;