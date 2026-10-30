CREATE TYPE "public"."actor_type" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."competitor_category" AS ENUM('DIRECT', 'INDIRECT', 'ALTERNATIVE');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('UNVERIFIED', 'VERIFIED', 'BOUNCED', 'OPTED_OUT');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('organization', 'product', 'icp', 'company', 'person', 'competitor', 'signal', 'lead', 'outreach', 'outreach_approval', 'citation', 'field_assertion', 'relationship_edge');--> statement-breakpoint
CREATE TYPE "public"."extractor" AS ENUM('agent', 'human');--> statement-breakpoint
CREATE TYPE "public"."fit_tier" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."icp_status" AS ENUM('DRAFT', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('MATCHED', 'CONTACTED', 'REPLIED', 'MEETING_BOOKED', 'CLOSED_LOST');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('EMAIL', 'LINKEDIN');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."relationship_edge_type" AS ENUM('WORKS_AT', 'COMPETES_WITH', 'MATCHED_TO', 'CONTACTED_VIA', 'REPLIED_TO', 'PREVIOUSLY_EMPLOYED_AT');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('FUNDING', 'HIRE', 'TECH_STACK_CHANGE', 'JOB_POSTING', 'RENEWAL', 'CHURN', 'HIRING_FREEZE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('WEBSITE', 'FILING', 'PRESS', 'JOB_POSTING', 'ENRICHMENT', 'REGULATORY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('VERIFIED', 'INFERRED', 'UNVERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"source_type" "source_type" NOT NULL,
	"quote" text NOT NULL,
	"content_hash" text NOT NULL,
	"extractor" "extractor" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"website_url" text,
	"industry" text,
	"headcount" integer,
	"revenue_band" text,
	"headquarters" text,
	"region" text,
	"fit_score" integer,
	"fit_tier" "fit_tier",
	"intent_score" integer,
	"negative_signals" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"domain" text,
	"website_url" text,
	"category" "competitor_category" NOT NULL,
	"positioning" text,
	"value_proposition" text,
	"pricing_tiers" jsonb NOT NULL,
	"differentiators" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_assertion_citations" (
	"assertion_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	CONSTRAINT "field_assertion_citations_assertion_id_citation_id_pk" PRIMARY KEY("assertion_id","citation_id")
);
--> statement-breakpoint
CREATE TABLE "field_assertions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"field_value" jsonb NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"asserted_by" "extractor" NOT NULL,
	"asserted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "icp_status" NOT NULL,
	"target_industries" jsonb NOT NULL,
	"company_size_min" integer,
	"company_size_max" integer,
	"revenue_band_min" real,
	"revenue_band_max" real,
	"buyer_personas" jsonb NOT NULL,
	"trigger_events" jsonb NOT NULL,
	"confidence_scores" jsonb NOT NULL,
	"expansion_suggestions" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"person_id" uuid,
	"product_id" uuid,
	"icp_id" uuid,
	"stage" "lead_stage" NOT NULL,
	"fit_score" integer,
	"fit_tier" "fit_tier",
	"owner_type" "actor_type" NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid,
	"person_id" uuid,
	"company_id" uuid,
	"channel" "outreach_channel" NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" "outreach_status" NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"variant" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"outreach_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"company_id" uuid,
	"full_name" text NOT NULL,
	"title" text,
	"seniority" text,
	"email" text,
	"linkedin_url" text,
	"contact_status" "contact_status" NOT NULL,
	"email_mx_valid" boolean,
	"fit_score" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"features" jsonb NOT NULL,
	"capabilities" jsonb NOT NULL,
	"technical_constraints" jsonb NOT NULL,
	"existing_customers" jsonb NOT NULL,
	"pricing_model" text,
	"contract_value_min" real,
	"contract_value_max" real,
	"monetization_model" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_edges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"from_entity_type" "entity_type" NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_type" "entity_type" NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"edge_type" "relationship_edge_type" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"company_id" uuid,
	"type" "signal_type" NOT NULL,
	"summary" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"strength" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_assertion_citations" ADD CONSTRAINT "field_assertion_citations_assertion_id_field_assertions_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."field_assertions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_assertion_citations" ADD CONSTRAINT "field_assertion_citations_citation_id_citations_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icps" ADD CONSTRAINT "icps_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_icp_id_icps_id_fk" FOREIGN KEY ("icp_id") REFERENCES "public"."icps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_approvals" ADD CONSTRAINT "outreach_approvals_outreach_id_outreach_id_fk" FOREIGN KEY ("outreach_id") REFERENCES "public"."outreach"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_org_id_idx" ON "audit_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "citations_org_id_idx" ON "citations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "companies_org_id_idx" ON "companies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "competitors_org_id_idx" ON "competitors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "field_assertions_entity_idx" ON "field_assertions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "icps_org_id_idx" ON "icps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leads_org_id_idx" ON "leads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "outreach_org_id_idx" ON "outreach" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "outreach_approvals_outreach_id_idx" ON "outreach_approvals" USING btree ("outreach_id");--> statement-breakpoint
CREATE INDEX "people_org_id_idx" ON "people" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "products_org_id_idx" ON "products" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "relationship_edges_org_id_idx" ON "relationship_edges" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "signals_org_id_idx" ON "signals" USING btree ("org_id");