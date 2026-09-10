# Changelog

## 0.2.0 - 2026-09-10

### Compatibility notes

- **Resource file hashes.** A bug was detected in versions prior to this one where files supplied by path hashed their bytes twice, resulting in spec-non-conformant hashes. This version outputs correct hashes for WARCs and copied pages, logs, and extras. Buffer/Uint8Array hashing, including the generated manifest's own hash, was already correct. See `Historical hashes` for how to validate signed historical archives with incorrect hashes.
- **Signing server checks.** Providing an invalid `signingUrl` now throws, including an empty string. Omit it or use `null`/`undefined` for unsigned output. Signing failures and responses containing an unrelated hash or an invalid cryptographic signature fail the export.
- **Atomic writes.** The destination file appears or is replaced only after ZIP generation succeeds. Construction and failed exports preserve an existing destination. Callers that watch a growing output file must instead wait for `process()` or `finalize()` to resolve. Missing inputs and archive/output stream errors reject the operation rather than producing an incomplete archive or an unhandled stream error.
- **Minimum node version.** The updated dependencies require Node.js 20 or later, replacing the previous declared minimum of 18.

### Fixes

- Select the root `datapackage.json` resource by its exact path when writing the digest and requesting a signature. An extra such as `extras/datapackage.json` no longer changes that selection.
- Check signer responses against the requested manifest hash and verify the signature with the included public key or first domain certificate. Supported encodings include ECDSA DER and IEEE P1363; domain certificates can also use RSA with PKCS#1 v1.5.
- Stage output in a private temporary directory beside the destination, await ZIP finalization and output completion, and rename the completed file into place.
- Remove a potential worker leak by initializing indexing workers only when needed and closing them after indexing. Repeated pool initialization reuses the current pool. Incremental callers can release an unfinished archive with the `dispose()` method.
- Update dependencies.
- Make signing tests self-contained using local JavaScript HTTP servers and certificate fixtures. Remove the Python development signer, its timestamp-service dependency, and the `dev-signer` command.

### Historical hashes

The old file-path hash implementation fed each read chunk into SHA-256 twice. For chunks `C1`, `C2`, etc., it computed `SHA256(C1 || C1 || C2 || C2 || ...)`. The size of the chunk is not specified but is typically 65,536 bytes.

If signed archives exist with this error, a verifier can supply legacy verification after validating the original manifest and its signature, by checking failed file hashes with this alternate algorithm and confirming each resource's signed byte length. Compatibility verification can fail if the original read chunk boundaries cannot be reproduced.
