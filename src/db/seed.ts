import { openDatabase } from "./client";
import { applyMigrations } from "./migrate";
import {
  approveOutreach,
  createCitation,
  createCompany,
  createCompetitor,
  createFieldAssertion,
  createIcp,
  createLead,
  createOrganization,
  createOutreach,
  createPerson,
  createProduct,
  createRelationshipEdge,
  createSignal,
  transitionOutreach,
} from "./repository";

const EXAMPLE_PREFIX = "EXAMPLE";

const actor = {
  actorType: "agent" as const,
  actorId: "seed-script",
};

export async function seedExampleData() {
  const handle = await openDatabase();
  await applyMigrations(handle);
  const { db } = handle;

  const org = await createOrganization(
    db,
    { name: `${EXAMPLE_PREFIX} Harborline GTM Workspace` },
    actor,
  );

  const product = await createProduct(
    db,
    {
      orgId: org.orgId,
      name: `${EXAMPLE_PREFIX} Harborline Ops Cloud`,
      description:
        "EXAMPLE fictional operations platform for mid-market freight brokers. Not a real product.",
      features: ["lane scoring", "capacity matching"],
      capabilities: ["intake chat", "evidence-backed discovery"],
      technicalConstraints: ["public sources only"],
      existingCustomers: [`${EXAMPLE_PREFIX} Cedar Freight Desk`],
      pricingModel: "annual subscription",
      contractValueMin: 24000,
      contractValueMax: 90000,
      monetizationModel: "seat + usage",
    },
    actor,
  );

  const icp = await createIcp(
    db,
    {
      orgId: org.orgId,
      productId: product.id,
      name: `${EXAMPLE_PREFIX} Mid-market freight brokers`,
      status: "APPROVED",
      targetIndustries: ["488510"],
      companySizeMin: 50,
      companySizeMax: 500,
      revenueBandMin: 10_000_000,
      revenueBandMax: 250_000_000,
      buyerPersonas: [
        { title: "Head of Capacity", seniority: "director" },
        { title: "VP Operations", seniority: "vp" },
      ],
      triggerEvents: ["new TMS rollout", "brokerage expansion hire"],
      confidenceScores: { targetIndustries: 0.72, buyerPersonas: 0.64 },
      expansionSuggestions: ["3PL control towers"],
      version: 1,
      inferenceMode: "mock",
      approvedBy: "example-rep",
      approvedAt: new Date("2026-10-15T12:00:00.000Z"),
    },
    actor,
  );

  const company = await createCompany(
    db,
    {
      orgId: org.orgId,
      name: `${EXAMPLE_PREFIX} Northwind Outfitters Logistics`,
      domain: "northwind-outfitters.example",
      websiteUrl: "https://northwind-outfitters.example",
      industry: "freight brokerage",
      headcount: 180,
      revenueBand: "50-100M",
      headquarters: "EXAMPLE City",
      region: "US-Midwest",
      fitScore: 81,
      fitTier: "A",
      intentScore: 67,
      negativeSignals: [],
    },
    actor,
  );

  const person = await createPerson(
    db,
    {
      orgId: org.orgId,
      companyId: company.id,
      fullName: `${EXAMPLE_PREFIX} Alex Rivera`,
      title: "Head of Capacity",
      seniority: "director",
      email: "alex.rivera@northwind-outfitters.example",
      linkedinUrl: "https://linkedin.com/in/example-alex-rivera",
      contactStatus: "UNVERIFIED",
      emailMxValid: null,
      fitScore: 74,
    },
    actor,
  );

  const competitor = await createCompetitor(
    db,
    {
      orgId: org.orgId,
      productId: product.id,
      name: `${EXAMPLE_PREFIX} Cedarline Suite`,
      domain: "cedarline-suite.example",
      websiteUrl: "https://cedarline-suite.example",
      category: "DIRECT",
      positioning: "EXAMPLE fictional TMS add-on",
      valueProposition: "EXAMPLE capacity marketplace",
      pricingTiers: [{ name: "Team", price: 499 }],
      differentiators: ["no public evidence of AI scoring"],
    },
    actor,
  );

  const signal = await createSignal(
    db,
    {
      orgId: org.orgId,
      companyId: company.id,
      type: "HIRE",
      summary: `${EXAMPLE_PREFIX} posted a Head of Capacity role (fictional).`,
      occurredAt: new Date("2026-10-01T00:00:00.000Z"),
      strength: 70,
    },
    actor,
  );

  const lead = await createLead(
    db,
    {
      orgId: org.orgId,
      companyId: company.id,
      personId: person.id,
      productId: product.id,
      icpId: icp.id,
      stage: "MATCHED",
      fitScore: 81,
      fitTier: "A",
      ownerType: "agent",
      ownerId: "seed-script",
    },
    actor,
  );

  const drafted = await createOutreach(
    db,
    {
      orgId: org.orgId,
      leadId: lead.id,
      personId: person.id,
      companyId: company.id,
      channel: "EMAIL",
      subject: `${EXAMPLE_PREFIX} capacity scoring note`,
      body: "EXAMPLE draft only. Not a real outreach message.",
      status: "DRAFT",
      dryRun: true,
      variant: "A",
      sentAt: null,
    },
    actor,
  );

  const pending = await transitionOutreach(
    db,
    { outreachId: drafted.id, status: "PENDING_APPROVAL" },
    actor,
  );

  await approveOutreach(
    db,
    {
      outreachId: pending.id,
      approvedBy: "example-rep",
      decision: "APPROVED",
      note: "EXAMPLE approval for seed data",
    },
    { actorType: "human", actorId: "example-rep" },
  );

  const citation = await createCitation(
    db,
    {
      orgId: org.orgId,
      sourceUrl: "https://northwind-outfitters.example/about",
      retrievedAt: new Date("2026-10-15T12:00:00.000Z"),
      sourceType: "WEBSITE",
      quote:
        "EXAMPLE snippet: Northwind Outfitters Logistics is a fictional brokerage.",
      extractor: "agent",
    },
    actor,
  );

  await createFieldAssertion(
    db,
    {
      orgId: org.orgId,
      entityType: "company",
      entityId: company.id,
      fieldName: "name",
      fieldValue: company.name,
      verificationStatus: "UNVERIFIED",
      assertedBy: "agent",
      citationIds: [citation.id],
      // EXAMPLE .example URL: sourceUrl+retrievedAt is necessary but not sufficient for VERIFIED.
    },
    actor,
  );

  await createRelationshipEdge(
    db,
    {
      orgId: org.orgId,
      fromEntityType: "person",
      fromEntityId: person.id,
      toEntityType: "company",
      toEntityId: company.id,
      edgeType: "WORKS_AT",
    },
    actor,
  );

  await createRelationshipEdge(
    db,
    {
      orgId: org.orgId,
      fromEntityType: "competitor",
      fromEntityId: competitor.id,
      toEntityType: "product",
      toEntityId: product.id,
      edgeType: "COMPETES_WITH",
    },
    actor,
  );

  await createRelationshipEdge(
    db,
    {
      orgId: org.orgId,
      fromEntityType: "lead",
      fromEntityId: lead.id,
      toEntityType: "company",
      toEntityId: company.id,
      edgeType: "MATCHED_TO",
    },
    actor,
  );

  await handle.close();

  return {
    orgId: org.orgId,
    productId: product.id,
    companyId: company.id,
    personId: person.id,
    signalId: signal.id,
    leadId: lead.id,
    outreachId: drafted.id,
    citationId: citation.id,
  };
}

async function main() {
  const ids = await seedExampleData();
  console.log("Seeded EXAMPLE data only:", ids);
}

const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith("src/db/seed.ts") ||
    process.argv[1].includes("src/db/seed"));

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
