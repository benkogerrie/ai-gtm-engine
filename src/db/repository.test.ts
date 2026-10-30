// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import type { DatabaseHandle } from "./client";
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
  createSignal,
  getCompany,
  getCompanyWithEvidence,
  getCompetitor,
  getIcp,
  getLead,
  getOutreach,
  getPerson,
  getProduct,
  getSignal,
  listAuditEvents,
  transitionOutreach,
} from "./repository";
import { createTestDatabase } from "./test-utils";

const actor = { actorType: "agent" as const, actorId: "test-agent" };

describe("repository", () => {
  let handle: DatabaseHandle;
  let orgId: string;

  beforeEach(async () => {
    handle = await createTestDatabase();
    const org = await createOrganization(
      handle.db,
      { name: "EXAMPLE Test Org" },
      actor,
    );
    orgId = org.orgId;
  });

  afterEach(async () => {
    await handle.close();
  });

  it("round-trips core entities and writes audit events", async () => {
    const product = await createProduct(
      handle.db,
      {
        orgId,
        name: "EXAMPLE Product",
        description: "EXAMPLE description",
      },
      actor,
    );
    expect(await getProduct(handle.db, product.id)).toMatchObject({
      name: "EXAMPLE Product",
    });

    const icp = await createIcp(
      handle.db,
      { orgId, productId: product.id, name: "EXAMPLE ICP" },
      actor,
    );
    expect(await getIcp(handle.db, icp.id)).toMatchObject({
      name: "EXAMPLE ICP",
      status: "DRAFT",
    });

    const company = await createCompany(
      handle.db,
      {
        orgId,
        name: "EXAMPLE Company",
        domain: null,
        websiteUrl: null,
        industry: null,
        fitScore: 55,
      },
      actor,
    );
    expect(company.domain).toBeNull();
    expect(await getCompany(handle.db, company.id)).toMatchObject({
      name: "EXAMPLE Company",
      fitScore: 55,
    });

    const person = await createPerson(
      handle.db,
      { orgId, companyId: company.id, fullName: "EXAMPLE Person" },
      actor,
    );
    expect(await getPerson(handle.db, person.id)).toMatchObject({
      contactStatus: "UNVERIFIED",
      email: null,
    });

    const competitor = await createCompetitor(
      handle.db,
      { orgId, productId: product.id, name: "EXAMPLE Competitor" },
      actor,
    );
    expect(await getCompetitor(handle.db, competitor.id)).toMatchObject({
      category: "DIRECT",
    });

    const signal = await createSignal(
      handle.db,
      { orgId, companyId: company.id, type: "HIRE", summary: "EXAMPLE hire" },
      actor,
    );
    expect(await getSignal(handle.db, signal.id)).toMatchObject({
      type: "HIRE",
    });

    const lead = await createLead(
      handle.db,
      {
        orgId,
        companyId: company.id,
        personId: person.id,
        productId: product.id,
        icpId: icp.id,
        ownerId: "test-agent",
      },
      actor,
    );
    expect(await getLead(handle.db, lead.id)).toMatchObject({
      stage: "MATCHED",
    });

    const drafted = await createOutreach(
      handle.db,
      {
        orgId,
        leadId: lead.id,
        body: "EXAMPLE draft",
        channel: "EMAIL",
      },
      actor,
    );
    expect(drafted.dryRun).toBe(true);
    expect(drafted.status).toBe("DRAFT");
    expect(await getOutreach(handle.db, drafted.id)).toMatchObject({
      dryRun: true,
    });

    const events = await listAuditEvents(handle.db, { orgId, limit: 50 });
    const actions = events.map((event) => event.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "organization.create",
        "product.create",
        "company.create",
        "person.create",
        "outreach.create",
      ]),
    );
  });

  it("treats missing company fields as UNVERIFIED, never verified", async () => {
    const company = await createCompany(
      handle.db,
      { orgId, name: "EXAMPLE Unknown Co" },
      actor,
    );
    const view = await getCompanyWithEvidence(handle.db, company.id);
    expect(view?.fields.domain).toMatchObject({
      value: null,
      verificationStatus: "UNVERIFIED",
      citations: [],
    });
    expect(view?.fields.name.verificationStatus).toBe("UNVERIFIED");
  });

  it("rejects a VERIFIED field assertion without a citation", async () => {
    const company = await createCompany(
      handle.db,
      { orgId, name: "EXAMPLE Co" },
      actor,
    );

    await expect(
      createFieldAssertion(
        handle.db,
        {
          orgId,
          entityType: "company",
          entityId: company.id,
          fieldName: "name",
          fieldValue: "EXAMPLE Co",
          verificationStatus: "VERIFIED",
          assertedBy: "agent",
          citationIds: [],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("accepts a VERIFIED assertion when a sourced citation is linked", async () => {
    const company = await createCompany(
      handle.db,
      {
        orgId,
        name: "EXAMPLE Cited Co",
        websiteUrl: "https://cited-co.example",
      },
      actor,
    );
    const citation = await createCitation(
      handle.db,
      {
        orgId,
        sourceUrl: "https://cited-co.example/about",
        retrievedAt: new Date("2026-10-01T00:00:00.000Z"),
        sourceType: "WEBSITE",
        quote: "EXAMPLE quote",
        extractor: "agent",
      },
      actor,
    );
    await createFieldAssertion(
      handle.db,
      {
        orgId,
        entityType: "company",
        entityId: company.id,
        fieldName: "name",
        fieldValue: "EXAMPLE Cited Co",
        verificationStatus: "VERIFIED",
        assertedBy: "agent",
        citationIds: [citation.id],
      },
      actor,
    );

    const view = await getCompanyWithEvidence(handle.db, company.id);
    expect(view?.fields.name.verificationStatus).toBe("VERIFIED");
    expect(view?.fields.name.citations[0]?.sourceUrl).toBe(
      "https://cited-co.example/about",
    );
  });

  it("rejects SENT outreach without an approval record", async () => {
    const drafted = await createOutreach(
      handle.db,
      {
        orgId,
        channel: "EMAIL",
        body: "EXAMPLE body",
        status: "APPROVED",
      },
      actor,
    );

    await expect(
      transitionOutreach(
        handle.db,
        { outreachId: drafted.id, status: "SENT" },
        actor,
      ),
    ).rejects.toMatchObject({ code: "SENT_WITHOUT_APPROVAL" });
  });

  it("allows SENT after a HITL approval record exists", async () => {
    const drafted = await createOutreach(
      handle.db,
      { orgId, channel: "LINKEDIN", body: "EXAMPLE body" },
      actor,
    );
    await transitionOutreach(
      handle.db,
      { outreachId: drafted.id, status: "PENDING_APPROVAL" },
      actor,
    );
    await approveOutreach(
      handle.db,
      {
        outreachId: drafted.id,
        approvedBy: "example-rep",
        decision: "APPROVED",
      },
      { actorType: "human", actorId: "example-rep" },
    );
    const sent = await transitionOutreach(
      handle.db,
      { outreachId: drafted.id, status: "SENT" },
      actor,
    );
    expect(sent.status).toBe("SENT");
    expect(sent.sentAt).toBeTruthy();
  });
});
