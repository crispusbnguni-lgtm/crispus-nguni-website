import test from "node:test";
import assert from "node:assert/strict";

import {
  getZonedDateTimeCandidates,
  zonedDateTimeToUtc,
  getZonedDayRange,
  isValidIanaTimezone,
} from "../src/lib/consultations/timezone-core.ts";

test("rejects nonexistent New York time during spring-forward", () => {
  const candidates = getZonedDateTimeCandidates(
    2026,
    3,
    8,
    2,
    30,
    "America/New_York",
  );

  assert.equal(candidates.length, 0);

  assert.throws(
    () =>
      zonedDateTimeToUtc(
        2026,
        3,
        8,
        2,
        30,
        "America/New_York",
      ),
    /does not exist/,
  );
});

test("returns both New York occurrences during fall-back", () => {
  const candidates = getZonedDateTimeCandidates(
    2026,
    11,
    1,
    1,
    30,
    "America/New_York",
  );

  assert.equal(candidates.length, 2);

  assert.deepEqual(
    candidates.map((date) => date.toISOString()),
    [
      "2026-11-01T05:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
    ],
  );

  assert.throws(
    () =>
      zonedDateTimeToUtc(
        2026,
        11,
        1,
        1,
        30,
        "America/New_York",
      ),
    /occurs more than once/,
  );
});

test("resolves ordinary Nairobi local time correctly", () => {
  const candidates = getZonedDateTimeCandidates(
    2026,
    11,
    15,
    12,
    0,
    "Africa/Nairobi",
  );

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].toISOString(),
    "2026-11-15T09:00:00.000Z",
  );

  assert.equal(
    zonedDateTimeToUtc(
      2026,
      11,
      15,
      12,
      0,
      "Africa/Nairobi",
    ).toISOString(),
    "2026-11-15T09:00:00.000Z",
  );
});

test("validates IANA timezones", () => {
  assert.equal(isValidIanaTimezone("Africa/Nairobi"), true);
  assert.equal(isValidIanaTimezone("America/New_York"), true);
  assert.equal(isValidIanaTimezone("Not/A_Timezone"), false);
  assert.equal(isValidIanaTimezone(""), false);
});

test("calculates Nairobi local day boundaries correctly", () => {
  const range = getZonedDayRange(
    "2026-11-15",
    "Africa/Nairobi",
  );

  assert.equal(
    range.startDate.toISOString(),
    "2026-11-14T21:00:00.000Z",
  );

  assert.equal(
    range.endDate.toISOString(),
    "2026-11-15T21:00:00.000Z",
  );
});
test("resolves São Paulo midnight DST gap to the first valid local instant", () => {
  const range = getZonedDayRange("2018-11-04", "America/Sao_Paulo");

  assert.equal(range.startDate.toISOString(), "2018-11-04T03:00:00.000Z");
  assert.equal(range.endDate.toISOString(), "2018-11-05T02:00:00.000Z");
  assert.equal(
    (range.endDate.getTime() - range.startDate.getTime()) / 3_600_000,
    23,
  );
});

test("returns an empty range for the skipped Apia calendar date", () => {
  const range = getZonedDayRange("2011-12-30", "Pacific/Apia");

  assert.equal(range.startDate.toISOString(), "2011-12-30T10:00:00.000Z");
  assert.equal(range.endDate.toISOString(), "2011-12-30T10:00:00.000Z");
  assert.equal(range.startDate.getTime(), range.endDate.getTime());
});

test("calculates the 23-hour New York spring-forward day", () => {
  const range = getZonedDayRange("2026-03-08", "America/New_York");

  assert.equal(range.startDate.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(range.endDate.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(
    (range.endDate.getTime() - range.startDate.getTime()) / 3_600_000,
    23,
  );
});

test("calculates the 25-hour New York fall-back day", () => {
  const range = getZonedDayRange("2026-11-01", "America/New_York");

  assert.equal(range.startDate.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(range.endDate.toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(
    (range.endDate.getTime() - range.startDate.getTime()) / 3_600_000,
    25,
  );
});