# Security Vault Architecture (format 1)

## Library review and choice

The selected dependency is `hash-wasm` 4.13.0, pinned exactly in `package.json` and `package-lock.json`. It is MIT-licensed, has no runtime dependencies, includes TypeScript definitions, supports modern browsers and Node, and bundles its per-algorithm WebAssembly as package assets. The Argon2 C source is included in the package; its Argon2id output uses version 19 (v1.3). It has recent releases, no published GitHub advisories, and no declared security policy. Its Argon2 implementation does not have a separately verified independent audit in the material reviewed; therefore the application describes this vault as experimental pending external cryptographic review. Sources: [hash-wasm npm package and API](https://www.npmjs.com/package/hash-wasm), [hash-wasm source repository](https://github.com/Daninet/hash-wasm), [release history](https://github.com/Daninet/hash-wasm/releases), [security page](https://github.com/Daninet/hash-wasm/security).

The existing `argon2` package remains server-side for authentication and is not used by the vault.

## Key hierarchy

* Browser CSPRNG generates 32 random bytes for the vault data encryption key (DEK), 16-byte independent salts, and fresh 12-byte AES-GCM nonces.
* Master password and recovery-key text are NFC-normalized and passed as bytes to Argon2id v1.3 (`m=65536 KiB`, `t=3`, `p=1`, output 32 bytes). Intermediate byte arrays are cleared in `finally`; JavaScript strings and WebCrypto key objects cannot be reliably zeroized.
* Each derived key wraps the random DEK using AES-256-GCM, 128-bit tag. Key-wrap AAD binds format version, vault ID, and wrapper role (`master` or `recovery`). Separate random salts are used.
* Each complete record JSON (including name, URL, username, email, password, category, folder, notes, favorite and timestamps) is AES-256-GCM encrypted with a new nonce. AAD binds format version, vault ID, and record ID. IDs, nonces, ciphertext lengths and timestamps are visible to the server; record text is not.
* Master password change and recovery rotation create a new role-specific wrapper around the same DEK; records remain decryptable without a key migration. Recovery-key rotation is confirmed before replacing the previous wrapper.

## Storage and API boundary

`SecurityVault` is unique per `PersonalWorkspace`; its workspace FK cascades on deletion. It stores only KDF parameters, salts, wrapped DEK ciphertexts, opaque vault ID, revision, and timestamps. `SecurityVaultRecord` stores opaque record ID, nonce, ciphertext, and timestamps. There are no plaintext credential columns. APIs authenticate the session, resolve the workspace from the authenticated owner, check owner/workspace and vault ID on each mutation, require same-origin mutations, reject unknown input keys and oversized requests, return no-store responses, and use a revision compare-and-swap inside a transaction. Concurrent stale writes fail with 409.

No code path sends master-password/recovery-key text, a derived key, exported DEK, or decrypted record JSON to an application API. Encrypted backup is a local download; restore validates its size and schema, authenticates records with AES-GCM before replacing records, and requires the same vault ID/key. The optional plaintext export requires a conspicuous checkbox and creates a local download only.

## Threat model and limitations

This protects stored vault data from a database-only disclosure and prevents the application server from decrypting records using stored values alone. It does not protect against compromised browser/device memory, malicious extensions, clipboard readers, XSS or a compromised application deployment: the server delivers the client code and could deliver code that steals unlocked data. JavaScript cannot guarantee secure erasure or constant-time KDF behavior. There is no independent Argon2 audit, external penetration test, hardware-backed key storage, cross-device concurrent merge, server-side rate limiter for offline password guesses, or recovery if both master password and recovery key are lost. The five-minute idle lock and background-tab lock are best-effort UX controls, not a defense against hostile code already running in the page.

The vault is not labelled production-grade until independent security review and deployment-level CSP/XSS review are completed. Keep a separate encrypted backup and recovery key offline.
