ALTER TABLE "icps" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "icps" ADD COLUMN "parent_icp_id" uuid;--> statement-breakpoint
ALTER TABLE "icps" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "icps" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "icps" ADD COLUMN "inference_mode" text DEFAULT 'mock' NOT NULL;--> statement-breakpoint
ALTER TABLE "icps" ADD COLUMN "structured" jsonb DEFAULT '{}'::jsonb NOT NULL;