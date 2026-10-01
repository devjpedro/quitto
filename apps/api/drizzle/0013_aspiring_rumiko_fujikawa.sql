CREATE TABLE "receipt_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installment_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "receipt_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "receipt_share" ADD CONSTRAINT "receipt_share_installment_id_installment_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_share" ADD CONSTRAINT "receipt_share_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_share_active_installment_uq" ON "receipt_share" USING btree ("installment_id") WHERE "receipt_share"."revoked_at" is null;