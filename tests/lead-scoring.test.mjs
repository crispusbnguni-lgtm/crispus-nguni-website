import assert from "node:assert/strict";
import test from "node:test";
import { leadPortfolioScope } from "../src/lib/lead-access.ts";
import { leadContactMatches, normalizeLeadEmail, normalizeLeadPhone } from "../src/lib/lead-contacts.ts";
import {
  calculateLeadScore,
  classifyLeadTemperature,
  shouldApplyAutomaticTemperature,
} from "../src/lib/lead-scoring.ts";
import { canSkipAdditionalIdentityVerification } from "../src/lib/auth-verification-policy.ts";

const now = new Date("2026-11-10T12:00:00.000Z");

function base(overrides = {}) {
  return {
    createdAt: now,
    activities: [],
    consultations: [],
    ...overrides,
  };
}

test("score uses the 25/35/25/15 component caps and explains each signal", () => {
  const result = calculateLeadScore(
    base({
      interestedIn: "Brand strategy",
      serviceNames: ["Brand strategy"],
      decisionMaker: true,
      budget: "Shared by lead",
      timeline: "This quarter",
      consultations: [
        {
          id: "consult-1",
          status: "PENDING",
          createdAt: now,
          scheduledAt: new Date(now.getTime() + 2 * 86400000),
        },
      ],
    }),
    now,
  );

  assert.deepEqual(result.components, {
    fit: 25,
    intent: 35,
    engagement: 0,
    recency: 15,
  });
  assert.equal(result.total, 75);
  assert.equal(result.temperature, "HOT");
  assert.equal(result.reasons.length, 7);
  assert.ok(result.nextBestAction.length > 0);
});

test("unknown fields and notes do not create negative or engagement points", () => {
  const result = calculateLeadScore(
    base({
      activities: [
        { id: "note", type: "NOTE", createdAt: now },
        {
          id: "no-answer",
          type: "CALL",
          createdAt: now,
          metadata: { outcome: "No answer" },
        },
      ],
    }),
    now,
  );

  assert.equal(result.components.fit, 0);
  assert.equal(result.components.intent, 0);
  assert.equal(result.components.engagement, 0);
  assert.equal(result.components.recency, 15);
  assert.equal(result.total, 15);
  assert.ok(result.reasons.some((reason) => reason.label.includes("unknown")));
});

test("an unanswered call does not gain engagement or recency from the legacy contact timestamp", () => {
  const createdAt = new Date(now.getTime() - 40 * 86400000);
  const lastContactedAt = new Date(now.getTime() - 2 * 86400000);
  const result = calculateLeadScore(
    base({
      createdAt,
      lastContactedAt,
      activities: [{
        id: "no-answer",
        type: "CALL",
        createdAt: lastContactedAt,
        metadata: { outcome: "No answer" },
      }],
    }),
    now,
  );
  assert.equal(result.components.engagement, 0);
  assert.equal(result.components.recency, 0);
});

test("recalculating after a contact event changes the score deterministically", () => {
  const initial = calculateLeadScore(base(), now);
  const afterContact = calculateLeadScore(
    base({
      activities: [{ id: "call-1", type: "CALL", createdAt: now }],
    }),
    now,
  );
  const sameContactRecomputed = calculateLeadScore(
    base({
      activities: [{ id: "call-1", type: "CALL", createdAt: now }],
    }),
    now,
  );

  assert.equal(initial.total, 15);
  assert.equal(afterContact.total, 20);
  assert.equal(sameContactRecomputed.total, afterContact.total);
});

test("a completed consultation and its linked meeting activity count once", () => {
  const completedAt = new Date(now.getTime() - 60 * 60 * 1000);
  const result = calculateLeadScore(
    base({
      createdAt: new Date(now.getTime() - 10 * 86400000),
      activities: [
        {
          id: "meeting-activity",
          type: "MEETING",
          createdAt: completedAt,
          metadata: { consultationId: "consult-2" },
        },
      ],
      consultations: [
        {
          id: "consult-2",
          status: "COMPLETED",
          createdAt: new Date(now.getTime() - 3 * 86400000),
          scheduledAt: completedAt,
          completedAt,
        },
      ],
    }),
    now,
  );

  assert.equal(result.components.engagement, 5);
  assert.equal(result.components.recency, 15);
});

test("separate unlinked meetings are not collapsed by a nearby completed consultation", () => {
  const completedAt = new Date(now.getTime() - 2 * 86400000);
  const result = calculateLeadScore(
    base({
      activities: [
        { id: "legacy-meeting-1", type: "MEETING", createdAt: completedAt },
        { id: "legacy-meeting-2", type: "MEETING", createdAt: new Date(completedAt.getTime() + 60 * 60 * 1000) },
      ],
      consultations: [
        {
          id: "consult-legacy",
          status: "COMPLETED",
          createdAt: completedAt,
          scheduledAt: completedAt,
          completedAt,
        },
      ],
    }),
    now,
  );

  assert.equal(result.components.engagement, 15);
});

test("a future follow-up schedules score refresh at the exact due boundary", () => {
  const dueAt = new Date(now.getTime() + 3 * 86400000);
  const result = calculateLeadScore(base({ nextFollowUpAt: dueAt }), now);
  assert.equal(result.nextRefreshAt?.toISOString(), dueAt.toISOString());
});

test("recency decays with inactivity and schedules the next score refresh", () => {
  const result = calculateLeadScore(
    base({ createdAt: new Date(now.getTime() - 10 * 86400000) }),
    now,
  );
  assert.equal(result.components.recency, 8);
  assert.equal(result.nextRefreshAt?.toISOString(), "2026-11-15T12:00:00.000Z");
});

test("temperature classification stays separate from pipeline status", () => {
  assert.equal(classifyLeadTemperature(80, 15), "HOT");
  assert.equal(classifyLeadTemperature(50, 4), "WARM");
  assert.equal(classifyLeadTemperature(30, 15), "COLD");
  assert.equal(classifyLeadTemperature(100, 0), "DORMANT");
});

test("legacy temperature overrides are preserved while new automatic temperatures recalculate", () => {
  assert.equal(shouldApplyAutomaticTemperature(true), false);
  assert.equal(shouldApplyAutomaticTemperature(false), true);
});

test("email and phone normalization support ownership-scoped duplicate matching", () => {
  assert.equal(normalizeLeadEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(normalizeLeadPhone("+1 415 555 2671"), "+14155552671");
  assert.equal(normalizeLeadPhone("not a phone"), null);
  assert.equal(
    leadContactMatches(
      { email: " Person@Example.COM ", phone: "+1 (415) 555-2671" },
      { emailNormalized: "person@example.com", phoneNormalized: "+14155552671" },
    ),
    true,
  );
});

test("portfolio access is constrained for users and global only for super admins", () => {
  assert.deepEqual(leadPortfolioScope({ id: "user-1", role: "USER" }), {
    portfolio: { is: { userId: "user-1" } },
  });
  assert.deepEqual(leadPortfolioScope({ id: "admin-1", role: "SUPER_ADMIN" }), {});
});

test("verification exemption is granted only for the database role value", () => {
  assert.equal(canSkipAdditionalIdentityVerification("SUPER_ADMIN"), true);
  assert.equal(canSkipAdditionalIdentityVerification("USER"), false);
  assert.equal(canSkipAdditionalIdentityVerification("super_admin"), false);
});
