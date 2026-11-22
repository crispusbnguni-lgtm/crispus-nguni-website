import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__welcomeCmsDefault = {
  hero: { title: "Default welcome" },
};
globalThis.__welcomeCmsActor = Object.freeze({ userId: "server-admin-id", role: "SUPER_ADMIN" });
globalThis.__welcomeCmsState = null;
globalThis.__welcomeCmsAuthAllowed = true;
globalThis.__welcomeCmsAuditFailure = false;
globalThis.__welcomeCmsMutationFailure = false;
globalThis.__welcomeCmsAuthCalls = 0;
globalThis.__welcomeCmsActorCalls = 0;
globalThis.__welcomeCmsAuditCalls = [];
globalThis.__welcomeCmsEvents = [];
globalThis.__welcomeCmsCurrentTx = null;
globalThis.__welcomeCmsPrisma = {
  welcomePageSettings: {
    async findUnique() {
      return globalThis.__welcomeCmsState?.settings ?? null;
    },
  },
  async $transaction(callback) {
    const working = {
      settings: globalThis.__welcomeCmsState?.settings
        ? structuredClone(globalThis.__welcomeCmsState.settings)
        : null,
      auditRecords: globalThis.__welcomeCmsState?.auditRecords
        ? structuredClone(globalThis.__welcomeCmsState.auditRecords)
        : [],
    };

    const tx = {
      welcomePageSettings: {
        async findUnique() {
          globalThis.__welcomeCmsEvents.push("settings.find");
          return working.settings ? structuredClone(working.settings) : null;
        },
        async upsert({ create, update }) {
          globalThis.__welcomeCmsEvents.push("settings.upsert");
          if (globalThis.__welcomeCmsMutationFailure) {
            throw new Error("simulated CMS write failure");
          }
          if (working.settings) {
            working.settings = { ...working.settings, ...structuredClone(update) };
          } else {
            working.settings = {
              id: "cms-created-row-id",
              ...structuredClone(create),
            };
          }
          return structuredClone(working.settings);
        },
      },
      auditLog: {
        async create({ data }) {
          globalThis.__welcomeCmsEvents.push("audit.create");
          if (globalThis.__welcomeCmsAuditFailure) {
            throw new Error("simulated audit write failure");
          }
          working.auditRecords.push(structuredClone(data));
          return data;
        },
      },
    };
    globalThis.__welcomeCmsCurrentTx = tx;

    const result = await callback(tx);
    globalThis.__welcomeCmsState = working;
    return result;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export const NextResponse = {
            json(body, init = {}) { return { body, status: init.status ?? 200 }; }
          };
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@prisma/client") {
      return { url: dataModule("export const Prisma = {};"), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule("export const prisma = globalThis.__welcomeCmsPrisma;"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`
          export async function requireApiPermission(permission) {
            globalThis.__welcomeCmsAuthCalls += 1;
            if (permission !== "CMS_MANAGE") throw new Error("unexpected permission");
            if (!globalThis.__welcomeCmsAuthAllowed) {
              return { user: null, response: { status: 403 } };
            }
            return {
              user: { id: "server-admin-id", role: "SUPER_ADMIN" },
              response: null,
            };
          }
          export function requireSameOriginApiRequest(request) {
            try {
              const origin = request.headers.get("origin");
              return origin && new URL(origin).origin === origin && origin === new URL(request.url).origin
                ? null
                : Response.json({ success: false }, { status: 403 });
            } catch {
              return Response.json({ success: false }, { status: 403 });
            }
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/welcome-page") {
      return {
        url: dataModule(`
          export const defaultWelcomePageContent = globalThis.__welcomeCmsDefault;
          export function isWelcomePageContent(value) {
            return Boolean(value && typeof value === "object" && !Array.isArray(value));
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/public-site-pages") {
      return {
        url: dataModule(`
          const keys = ["about", "how-it-works", "services", "contact"];
          export function isPublicSitePageKey(value) { return keys.includes(value); }
          export function isPublicSitePageContent(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
          export function getPublicSitePageAdminState(stored, key) {
            const page = stored && stored.__cms && stored.__cms.pages && stored.__cms.pages[key];
            return {
              publishedContent: page && page.published || { title: "Default" },
              draftContent: page && page.draft || null,
              history: page && page.history || [],
              publishedAt: page && page.publishedAt || null,
            };
          }
        `),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/admin-audit") {
      return {
        url: dataModule(`
          export async function resolveAdminAuditActor() {
            globalThis.__welcomeCmsActorCalls += 1;
            return globalThis.__welcomeCmsActor;
          }
          export async function writeAdminAudit(actor, input, tx) {
            globalThis.__welcomeCmsAuditCalls.push({ actor, input, transaction: tx });
            await tx.auditLog.create({
              data: {
                eventId: "mock-event-id",
                actorUserId: actor.userId,
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId,
                metadata: input.metadata,
              },
            });
          }
        `),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { PUT } = await import("../src/app/api/admin/backgrounds/welcome-page/route.ts");

const expectedAuditActions = {
  draft: "ADMIN_CMS_DRAFT_SAVED",
  publish: "ADMIN_CMS_PUBLISHED",
  restore: "ADMIN_CMS_VERSION_RESTORED",
  schedule: "ADMIN_CMS_SCHEDULED",
  cancel_schedule: "ADMIN_CMS_SCHEDULE_CANCELLED",
};

function makeSettings(content, id = "settings-persisted-id") {
  return { id, key: "main", content: structuredClone(content) };
}

function reset({ settings = null } = {}) {
  globalThis.__welcomeCmsState = { settings, auditRecords: [] };
  globalThis.__welcomeCmsAuthAllowed = true;
  globalThis.__welcomeCmsAuditFailure = false;
  globalThis.__welcomeCmsMutationFailure = false;
  globalThis.__welcomeCmsAuthCalls = 0;
  globalThis.__welcomeCmsActorCalls = 0;
  globalThis.__welcomeCmsAuditCalls.length = 0;
  globalThis.__welcomeCmsEvents.length = 0;
  globalThis.__welcomeCmsCurrentTx = null;
}

function request(body) {
  return new Request("https://example.test/api/admin/backgrounds/welcome-page", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(body),
  });
}

function publishedSettings(overrides = {}) {
  return makeSettings({
    hero: { title: "Current public title" },
    __cms: {
      publishedAt: "2026-01-01T00:00:00.000Z",
      history: [],
      ...overrides,
    },
  });
}

test("all five CMS actions write the matching content-free audit in the mutation transaction", async () => {
  const cases = [
    {
      action: "draft",
      settings: null,
      body: { action: "draft", content: { hero: { title: "PRIVATE DRAFT" }, imageUrl: "https://media.example/draft" } },
      targetId: "cms-created-row-id",
      changedFields: ["draft"],
    },
    {
      action: "publish",
      settings: publishedSettings({ draft: { title: "OLD DRAFT" } }),
      body: { action: "publish", content: { hero: { title: "PRIVATE PUBLISHED BODY" }, imageUrl: "https://media.example/published" } },
      targetId: "settings-persisted-id",
      changedFields: ["publishedAt", "publishedContent"],
    },
    {
      action: "restore",
      settings: publishedSettings({
        scheduledContent: { title: "SCHEDULED PRIVATE BODY" },
        scheduledAt: "2027-01-01T00:00:00.000Z",
        history: [{
          publishedAt: "2025-12-01T12:00:00.000Z",
          content: { hero: { title: "RESTORED PRIVATE BODY" }, imageUrl: "https://media.example/restore" },
        }],
      }),
      body: { action: "restore", versionPublishedAt: "2025-12-01T12:00:00.000Z" },
      targetId: "settings-persisted-id",
      changedFields: ["draft", "scheduledContent", "scheduledAt"],
    },
    {
      action: "schedule",
      settings: publishedSettings(),
      body: {
        action: "schedule",
        content: { hero: { title: "PRIVATE SCHEDULED BODY" }, imageUrl: "https://media.example/scheduled" },
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      targetId: "settings-persisted-id",
      changedFields: ["scheduledContent", "scheduledAt"],
    },
    {
      action: "cancel_schedule",
      settings: publishedSettings({
        scheduledContent: { title: "PRIVATE SCHEDULED BODY" },
        scheduledAt: "2027-01-01T00:00:00.000Z",
      }),
      body: { action: "cancel_schedule" },
      targetId: "settings-persisted-id",
      changedFields: ["scheduledContent", "scheduledAt"],
    },
  ];

  for (const entry of cases) {
    reset({ settings: entry.settings });
    const response = await PUT(request(entry.body));
    assert.equal(response.status, 200, `${entry.action} should succeed`);
    assert.equal(globalThis.__welcomeCmsAuthCalls, 1);
    assert.equal(globalThis.__welcomeCmsActorCalls, 1);
    assert.deepEqual(globalThis.__welcomeCmsEvents, [
      "settings.find",
      "settings.upsert",
      "audit.create",
    ]);

    const [auditCall] = globalThis.__welcomeCmsAuditCalls;
    assert.equal(auditCall.actor, globalThis.__welcomeCmsActor);
    assert.equal(auditCall.input.action, expectedAuditActions[entry.action]);
    assert.equal(auditCall.input.targetType, "WelcomePageSettings");
    assert.equal(auditCall.input.targetId, entry.targetId);
    assert.deepEqual(auditCall.input.metadata, { changedFields: entry.changedFields });
    assert.equal(auditCall.input.reason, "ADMIN_REQUEST");
    assert.equal(auditCall.input.outcome, "SUCCEEDED");
    assert.equal(globalThis.__welcomeCmsState.auditRecords.length, 1);
    assert.equal(globalThis.__welcomeCmsState.auditRecords[0].targetId, entry.targetId);
    assert.equal(auditCall.transaction, globalThis.__welcomeCmsCurrentTx);

    const serializedAudit = JSON.stringify(globalThis.__welcomeCmsState.auditRecords);
    for (const sensitiveContent of [
      "PRIVATE DRAFT",
      "PRIVATE PUBLISHED BODY",
      "RESTORED PRIVATE BODY",
      "PRIVATE SCHEDULED BODY",
      "https://media.example/",
    ]) {
      assert.equal(serializedAudit.includes(sensitiveContent), false);
    }

    if (entry.action === "restore") {
      const content = globalThis.__welcomeCmsState.settings.content;
      assert.equal(content.hero.title, "Current public title");
      assert.equal(content.__cms.draft.hero.title, "RESTORED PRIVATE BODY");
      assert.equal("scheduledContent" in content.__cms, false);
      assert.equal("scheduledAt" in content.__cms, false);
      assert.equal(content.__cms.history.length, 1);
    }
  }
});

test("omitted action retains the existing draft default", async () => {
  reset();
  const response = await PUT(request({ content: { hero: { title: "Draft without action" } } }));
  assert.equal(response.status, 200);
  assert.equal(response.body.action, "draft");
  assert.equal(globalThis.__welcomeCmsAuditCalls[0].input.action, "ADMIN_CMS_DRAFT_SAVED");
});

test("restoration preserves history and leaves live content unchanged", async () => {
  reset({
    settings: publishedSettings({
      history: Array.from({ length: 20 }, (_, index) => ({
        publishedAt: `2025-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        content: { title: `Version ${index + 1}` },
      })),
    }),
  });
  const response = await PUT(request({
    action: "restore",
    versionPublishedAt: "2025-01-01T00:00:00.000Z",
  }));
  assert.equal(response.status, 200);
  const content = globalThis.__welcomeCmsState.settings.content;
  assert.equal(content.__cms.history.length, 20);
  assert.equal(content.__cms.draft.title, "Version 1");
  assert.equal(content.hero.title, "Current public title");
});

test("publishing retains the prior public version and enforces the twenty-version history limit", async () => {
  reset({
    settings: publishedSettings({
      history: Array.from({ length: 20 }, (_, index) => ({
        publishedAt: `2025-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        content: { title: `Historical version ${index + 1}` },
      })),
    }),
  });

  const response = await PUT(request({
    action: "publish",
    content: { hero: { title: "New public title" } },
  }));

  assert.equal(response.status, 200);
  const content = globalThis.__welcomeCmsState.settings.content;
  assert.equal(content.hero.title, "New public title");
  assert.equal(content.__cms.history.length, 20);
  assert.equal(content.__cms.history[0].content.hero.title, "Current public title");
  assert.equal(content.__cms.history[0].publishedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(globalThis.__welcomeCmsState.auditRecords.length, 1);
});

test("audit insertion failure rolls back the CMS mutation", async () => {
  const original = publishedSettings();
  reset({ settings: original });
  globalThis.__welcomeCmsAuditFailure = true;

  const response = await PUT(request({ action: "draft", content: { title: "Uncommitted draft" } }));
  assert.equal(response.status, 500);
  assert.deepEqual(globalThis.__welcomeCmsState.settings, original);
  assert.equal(globalThis.__welcomeCmsState.auditRecords.length, 0);
  assert.deepEqual(globalThis.__welcomeCmsEvents, ["settings.find", "settings.upsert", "audit.create"]);
});

test("CMS mutation failure leaves no audit record", async () => {
  const original = publishedSettings();
  reset({ settings: original });
  globalThis.__welcomeCmsMutationFailure = true;

  const response = await PUT(request({ action: "publish", content: { title: "Uncommitted publish" } }));
  assert.equal(response.status, 500);
  assert.deepEqual(globalThis.__welcomeCmsState.settings, original);
  assert.equal(globalThis.__welcomeCmsState.auditRecords.length, 0);
  assert.equal(globalThis.__welcomeCmsAuditCalls.length, 0);
});

test("server-side Super Admin authorization remains required and browser actor fields are ignored", async () => {
  reset();
  globalThis.__welcomeCmsAuthAllowed = false;
  const denied = await PUT(request({
    action: "draft",
    actorId: "browser-admin-id",
    role: "SUPER_ADMIN",
    content: { title: "Should not save" },
  }));
  assert.equal(denied.status, 403);
  assert.equal(globalThis.__welcomeCmsEvents.length, 0);
  assert.equal(globalThis.__welcomeCmsActorCalls, 0);
  assert.equal(globalThis.__welcomeCmsAuditCalls.length, 0);

  reset();
  const allowed = await PUT(request({
    action: "draft",
    actorId: "browser-attacker-id",
    role: "USER",
    content: { title: "Audit uses server actor" },
  }));
  assert.equal(allowed.status, 200);
  assert.equal(globalThis.__welcomeCmsAuditCalls[0].actor, globalThis.__welcomeCmsActor);
  assert.equal(globalThis.__welcomeCmsAuditCalls[0].actor.userId, "server-admin-id");
});

test("unmatched restoration returns 404 without mutation or audit", async () => {
  reset({ settings: publishedSettings({ history: [] }) });
  const response = await PUT(request({ action: "restore", versionPublishedAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(response.status, 404);
  assert.deepEqual(globalThis.__welcomeCmsEvents, ["settings.find"]);
  assert.equal(globalThis.__welcomeCmsState.auditRecords.length, 0);
});

test("public page draft saves to isolated CMS JSON and does not alter the home page", async () => {
  reset({ settings: publishedSettings() });
  const content = { title: "Private page draft", sections: [] };
  const response = await PUT(request({ pageKey: "about", action: "draft", content, actorUserId: "forged" }));
  assert.equal(response.status, 200);
  assert.equal(globalThis.__welcomeCmsState.settings.content.hero.title, "Current public title");
  assert.deepEqual(globalThis.__welcomeCmsState.settings.content.__cms.pages.about.draft, content);
  assert.equal(globalThis.__welcomeCmsAuditCalls.at(-1).input.action, "ADMIN_CMS_DRAFT_SAVED");
  assert.equal(globalThis.__welcomeCmsAuditCalls.at(-1).input.targetId, "settings-persisted-id");
  assert.deepEqual(globalThis.__welcomeCmsAuditCalls.at(-1).input.metadata, { changedFields: ["about_draft"] });
  assert.equal(globalThis.__welcomeCmsAuditCalls.at(-1).actor.userId, "server-admin-id");
});

test("public page publish archives prior version and keeps audit content-free", async () => {
  reset({ settings: makeSettings({ hero: { title: "Home stays intact" }, __cms: { pages: { services: {
    published: { title: "Old services" }, publishedAt: "2026-01-01T00:00:00.000Z", history: [],
  } } } }) });
  const content = { title: "New services", privateText: "must not be audited" };
  const response = await PUT(request({ pageKey: "services", action: "publish", content }));
  assert.equal(response.status, 200);
  const saved = globalThis.__welcomeCmsState.settings.content;
  assert.equal(saved.hero.title, "Home stays intact");
  assert.equal(saved.__cms.pages.services.published.title, "New services");
  assert.equal(saved.__cms.pages.services.history[0].content.title, "Old services");
  const audit = globalThis.__welcomeCmsAuditCalls.at(-1).input;
  assert.equal(audit.action, "ADMIN_CMS_PUBLISHED");
  assert.doesNotMatch(JSON.stringify(audit.metadata), /New services|must not be audited/);
});

test("public page restore saves a historical page as a draft and invalid page keys are rejected", async () => {
  const historical = { title: "Earlier about", sections: [] };
  reset({ settings: makeSettings({ __cms: { pages: { about: {
    published: { title: "Current about" }, publishedAt: "2026-02-01T00:00:00.000Z",
    history: [{ content: historical, publishedAt: "2026-01-01T00:00:00.000Z" }],
  } } } }) });
  const response = await PUT(request({ pageKey: "about", action: "restore", versionPublishedAt: "2026-01-01T00:00:00.000Z" }));
  assert.equal(response.status, 200);
  assert.deepEqual(globalThis.__welcomeCmsState.settings.content.__cms.pages.about.draft, historical);
  assert.equal(globalThis.__welcomeCmsAuditCalls.at(-1).input.action, "ADMIN_CMS_VERSION_RESTORED");
  const invalid = await PUT(request({ pageKey: "other", action: "draft", content: {} }));
  assert.equal(invalid.status, 400);
});
