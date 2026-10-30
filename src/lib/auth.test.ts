import { afterEach, describe, expect, it } from "vitest";
import { getAuthContext } from "./auth";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "./test-auth";

function request(headers: HeadersInit): Request {
  return new Request("http://localhost/api/products", { headers });
}

describe("getAuthContext", () => {
  afterEach(() => {
    clearTestAuth();
  });

  it("returns null when APP_API_TOKEN is unset", () => {
    clearTestAuth();
    expect(
      getAuthContext(request({ authorization: "Bearer anything" })),
    ).toBeNull();
  });

  it("returns null for a missing or invalid bearer token", () => {
    installTestAuth();
    expect(getAuthContext(request({}))).toBeNull();
    expect(
      getAuthContext(request({ authorization: "Bearer wrong-token" })),
    ).toBeNull();
  });

  it("maps a valid token to the server-configured org and actor", () => {
    installTestAuth();
    const ctx = getAuthContext(
      request({ authorization: `Bearer ${TEST_AUTH.token}` }),
    );
    expect(ctx).toEqual({
      orgId: TEST_AUTH.orgId,
      actor: { actorType: "agent", actorId: TEST_AUTH.actorId },
    });
  });

  it("ignores spoofed org and actor headers", () => {
    installTestAuth();
    const ctx = getAuthContext(
      request({
        authorization: `Bearer ${TEST_AUTH.token}`,
        "x-actor-id": "spoofed-actor",
        "x-actor-type": "human",
        "x-org-id": "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(ctx?.orgId).toBe(TEST_AUTH.orgId);
    expect(ctx?.actor).toEqual({
      actorType: "agent",
      actorId: TEST_AUTH.actorId,
    });
  });
});
