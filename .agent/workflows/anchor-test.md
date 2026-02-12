---
description: Build and test the Anchor Solana program (build, test, sync IDs, copy IDL)
---

# Anchor Test

// turbo-all

## 1. Sync program IDs

```bash
cd /home/epic/Downloads/monolith && anchor keys sync
```

## 2. Build the program

```bash
cd /home/epic/Downloads/monolith && anchor build 2>&1 | tail -10
```

If the build fails, stop and fix the errors before continuing.

## 3. Run the test suite

```bash
cd /home/epic/Downloads/monolith && anchor test 2>&1
```

All tests must pass. If any fail, investigate and fix before continuing.

## 4. Copy IDL to mobile app

After a successful build, sync the generated IDL to the mobile app:

```bash
cp /home/epic/Downloads/monolith/target/idl/monolith.json /home/epic/Downloads/monolith/apps/mobile/services/monolith-idl.json
```

## 5. Verify mobile TypeScript still compiles

```bash
cd /home/epic/Downloads/monolith/apps/mobile && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

If there are errors, fix them before continuing.
