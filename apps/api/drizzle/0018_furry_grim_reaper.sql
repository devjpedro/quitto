CREATE INDEX "contract_owner_id_idx" ON "contract" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "invite_email_idx" ON "invite" USING btree ("email");