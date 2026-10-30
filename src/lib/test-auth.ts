export const TEST_AUTH = {
  token: "test-api-token-aaaaaaaa",
  orgId: "11111111-1111-4111-8111-111111111111",
  actorId: "configured-test-actor",
  actorType: "agent" as const,
};

export function installTestAuth(
  overrides: Partial<typeof TEST_AUTH> = {},
): typeof TEST_AUTH {
  const cfg = { ...TEST_AUTH, ...overrides };
  process.env.APP_API_TOKEN = cfg.token;
  process.env.APP_ORG_ID = cfg.orgId;
  process.env.APP_ACTOR_ID = cfg.actorId;
  process.env.APP_ACTOR_TYPE = cfg.actorType;
  return cfg;
}

export function clearTestAuth(): void {
  delete process.env.APP_API_TOKEN;
  delete process.env.APP_ORG_ID;
  delete process.env.APP_ACTOR_ID;
  delete process.env.APP_ACTOR_TYPE;
}

export function authHeaders(token = TEST_AUTH.token): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}
