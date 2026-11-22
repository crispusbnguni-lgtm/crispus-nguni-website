const MIME_SIGNATURES: Readonly<Record<string, (bytes: Uint8Array) => boolean>> = {
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte),
  "image/webp": (bytes) => ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP",
  "image/avif": (bytes) => ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4)),
  "image/gif": (bytes) => ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6)),
  "video/mp4": (bytes) => ascii(bytes, 4, 4) === "ftyp" && ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "MSNV"].includes(ascii(bytes, 8, 4)),
  "video/webm": (bytes) => bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/** Validates the actual file signature; MIME and filename are supplied by clients. */
export async function hasAllowedBackgroundMediaSignature(
  file: Pick<Blob, "slice"> & { type: string },
  allowedTypes: readonly string[],
): Promise<boolean> {
  if (!allowedTypes.includes(file.type) || !MIME_SIGNATURES[file.type]) return false;
  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    return MIME_SIGNATURES[file.type](bytes);
  } catch {
    return false;
  }
}
