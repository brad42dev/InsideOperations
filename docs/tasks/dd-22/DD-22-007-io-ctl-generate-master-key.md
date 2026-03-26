---
id: DD-22-007
title: Implement io-ctl binary with generate-master-key subcommand
unit: DD-22
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The installation procedure includes a step where the admin runs `./bin/io-ctl generate-master-key` to generate a 256-bit master encryption key, seal it via systemd-creds (optionally binding to TPM2 if available), and store the encrypted blob at `/etc/io/creds/master-key.enc`. This key is used to encrypt sensitive credentials stored in the database. The plaintext key never exists on disk — only the encrypted credential.

The `io-ctl` binary is a command-line administration tool bundled with the installer. It does not exist in the codebase today.

## Spec Excerpt (verbatim)

> ```bash
> cd /opt/insideoperations
> ./bin/io-ctl generate-master-key
>
> # Generates a 256-bit random key, encrypts it via systemd-creds, and stores
> # the encrypted blob at /etc/io/creds/master-key.enc
> #
> # If TPM2 is available: key is sealed to the TPM (strongest protection)
> # If no TPM2: key is encrypted with the host key (/var/lib/systemd/credential.secret)
> #
> # The plaintext key NEVER exists on disk — only the encrypted credential.
> # At service start, systemd decrypts it into a tmpfs ($CREDENTIALS_DIRECTORY).
> #
> # CRITICAL: Back up the encrypted credential blob securely.
> ```
> — design-docs/22_DEPLOYMENT_GUIDE.md, §7. Generate Master Encryption Key

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/Cargo.toml` — workspace members list (no `io-ctl` entry)
- `/home/io/io-dev/io/services/` — no `ctl/` directory exists
- `/home/io/io-dev/io/scripts/build-installer.sh` — copies binaries; would need to add `io-ctl` to the binary list
- `/home/io/io-dev/io/installer/deploy.sh` — runs the install steps; step 7 references `io-ctl`

## Verification Checklist

- [ ] `services/ctl/` or equivalent directory exists with a Rust binary crate named `io-ctl`
- [ ] `Cargo.toml` workspace members include the `io-ctl` path
- [ ] `io-ctl generate-master-key` subcommand is implemented
- [ ] The command generates 32 random bytes using a cryptographically secure RNG
- [ ] The command invokes `systemd-creds encrypt` (or equivalent) to seal the key
- [ ] The encrypted blob is written to `/etc/io/creds/master-key.enc`
- [ ] If TPM2 is unavailable, falls back to host-key encryption (systemd-creds handles this automatically)
- [ ] `scripts/build-installer.sh` copies the `io-ctl` binary into the bundle

## Assessment

- **Status**: ❌ Missing
- No `io-ctl` crate exists anywhere in the workspace. The install step 7 in the design doc references this command but it has not been implemented.

## Fix Instructions

**Step 1 — Create the crate:**

Create a new binary crate at `/home/io/io-dev/io/services/ctl/` (or `tools/ctl/`):
```
services/ctl/
  Cargo.toml
  src/
    main.rs
    commands/
      generate_master_key.rs
```

In `services/ctl/Cargo.toml`:
```toml
[package]
name = "io-ctl"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "io-ctl"
path = "src/main.rs"

[dependencies]
clap = { version = "4", features = ["derive"] }
rand = "0.8"
tokio = { workspace = true }
anyhow = { workspace = true }
```

Add to workspace `Cargo.toml` members list:
```toml
"services/ctl",
```

**Step 2 — Implement the command:**

`src/commands/generate_master_key.rs`:
```rust
// 1. Generate 32 random bytes using OsRng
// 2. Write to a temp file in /tmp/
// 3. Invoke: systemd-creds encrypt --name=io-master-key --tpm2-device=auto /tmp/key /etc/io/creds/master-key.enc
// 4. Securely delete the temp file (overwrite with zeros, then remove)
// 5. Print confirmation and backup reminder
```

The `systemd-creds` CLI handles TPM2 detection automatically — pass `--tpm2-device=auto` and it falls back to host-key encryption if no TPM2 is present.

**Step 3 — Add to installer package:**

In `/home/io/io-dev/io/scripts/build-installer.sh`, add `io-ctl` to the `BINARIES` array:
```bash
BINARIES=(
    api-gateway
    ...
    io-ctl       # <-- add this
)
```

**Step 4 — Update deploy.sh step numbering comment:**

The current `installer/deploy.sh` runs migrations (step 6) and then starts services (step 8). The master key generation (step 7 per the spec) is a manual interactive step not automated by `deploy.sh`. Add a prompt/reminder in `deploy.sh` after migrations, before starting services:

```bash
echo ""
echo "  IMPORTANT: If this is a fresh install, run the master key generation step:"
echo "    $INSTALL_DIR/bin/io-ctl generate-master-key"
echo "  Press ENTER to continue, or Ctrl-C to pause and run the above command first."
read -r _ignored
```

Do NOT:
- Generate the master key automatically inside `deploy.sh` — the spec describes it as a conscious admin action
- Store the plaintext key anywhere on disk — only the systemd-creds encrypted blob
- Use `openssl rand` directly — use Rust's `OsRng` from the `rand` crate for cryptographically secure generation
