import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule(""), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { hasAllowedBackgroundMediaSignature } = await import("../src/lib/background-media.ts");

test("signature validation accepts genuine JPEG, PNG, WebP, GIF, AVIF, MP4 and WebM headers", async () => {
  const cases = [
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/webp", [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]],
    ["image/gif", [...Buffer.from("GIF89a"), 0]],
    ["image/avif", [0, 0, 0, 0, ...Buffer.from("ftypavif")]],
    ["video/mp4", [0, 0, 0, 0, ...Buffer.from("ftypmp42")]],
    ["video/webm", [0x1a, 0x45, 0xdf, 0xa3]],
  ];

  for (const [type, bytes] of cases) {
    const file = new Blob([Uint8Array.from(bytes)], { type });
    assert.equal(await hasAllowedBackgroundMediaSignature(file, [type]), true, type);
  }
});

test("client MIME labels cannot disguise unrelated bytes or enable a disallowed type", async () => {
  const forgedPng = new Blob(["not a png"], { type: "image/png" });
  assert.equal(await hasAllowedBackgroundMediaSignature(forgedPng, ["image/png"]), false);
  assert.equal(await hasAllowedBackgroundMediaSignature(forgedPng, ["image/jpeg"]), false);
});
