# Agent Learnings & Development Notes

This file documents important lessons, gotchas, and discoveries for future development.

## Recent Lessons Learned

### 2026-02-13: Design System Work Should Follow Interview → Plan → Build → Migrate

**Pattern**: Instead of jumping into code, run a structured design interview first (10 questions covering aesthetic, typography, components, navigation, animations). This produces a specification that makes the build phase trivial.

**Workflow**: Interview → `UI_SYSTEM.md` spec → `theme.ts` overhaul → Component library → `AGENTS.md` agent rules → `UI_MIGRATION_PLAN.md` for screen-by-screen conversion.

**Key Insight**: Building the component library and theme tokens BEFORE migrating existing screens is safer. New components compile and type-check independently, and screens can be migrated one at a time without breaking the app.

### 2026-02-13: Use AGENTS.md + Barrel Exports to Prevent Component Drift

**Problem**: Without guardrails, every new screen creates ad-hoc buttons, cards, and inputs with inconsistent styling. AI agents are especially prone to this because they don't remember previous styling decisions.

**Solution**:
1. Create `components/ui/index.ts` barrel export for clean imports
2. Create per-app `AGENTS.md` with explicit rules: "always use `<Button>`, never create raw `<TouchableOpacity>`"
3. Include a component table, typography rules, and a new screen template

**Result**: Future agents (and humans) see the component catalog before writing any code. The barrel index makes the import path obvious.

### 2026-02-13: Theme Migration Requires Explicit Color Mapping Tables

**Gotcha**: Overhauling a theme file (e.g., removing `COLORS.cyan`) causes TypeScript errors in every file that referenced the old token. Simply renaming tokens isn't enough — you need a migration plan with exact `old → new` mappings for every screen.

**Solution**: After any theme overhaul, immediately:
1. Run `npx tsc --noEmit` to find all broken references
2. Fix type errors in existing code (map old names to new ones)
3. Create a migration plan doc listing every file + exact color/component substitutions

### 2026-02-13: `tsc --noEmit` Hangs in Monorepos — Always Use `timeout`

**Problem**: `npx tsc --noEmit --skipLibCheck` can hang indefinitely in monorepo workspaces (30+ minutes), blocking the entire workflow. This happened repeatedly in this project.

**Solution**: Always wrap tsc with a timeout:
```bash
timeout 60 npx tsc --noEmit --skipLibCheck 2>&1; echo "EXIT=$?"
```
Exit code 0 = clean, 124 = timed out (actual compilation issue). Applied to `/wrapup` and `/commit` workflows.

### 2026-02-13: Soft Magnetic Zoom Beats Hard Tier Snapping for 3D Camera UX

**Problem**: Hard-snapping zoom to fixed tiers (40/18/8) on pinch release felt broken — users zoom to 25, it snaps back to 40. Feels like "auto-reset."

**Solution**: Free zoom with soft magnetic pull near tier centers:
```typescript
function applySoftMagnetic(zoom: number): number {
  const tiers = [8, 18, 40]; // tier centers
  for (const tier of tiers) {
    const dist = Math.abs(zoom - tier);
    if (dist < 2.5 && dist > 0.1) { // magnetic zone
      return zoom + (tier - zoom) * 0.03; // gentle pull
    }
  }
  return zoom; // free zoom outside magnetic zone
}
```

Also: use dual lerp (fast 0.14 for orbit, slow 0.045 for fly-to/reset transitions) for smoother programmatic camera moves.

### 2026-02-13: BorshAccountsCoder Incompatibility with React Native

**Problem**: Anchor's `BorshAccountsCoder.decode()` uses Node.js `Buffer.readUIntLE()` which doesn't exist in React Native's Buffer polyfill. All account decoding was crashing with `"b.readUIntLE is not a function (it is undefined)"`.

**Solution**: Manual byte-level decoding using `DataView` and `Uint8Array` which work universally:

```typescript
// Read a u64 (8 bytes, little-endian) from raw account data
function readU64(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const lo = view.getUint32(offset, true);      // low 32 bits
    const hi = view.getUint32(offset + 4, true);  // high 32 bits
    return hi * 0x100000000 + lo;
}

// Read a PublicKey (32 bytes)
function readPubkey(data: Uint8Array, offset: number): PublicKey {
    return new PublicKey(data.slice(offset, offset + 32));
}

// Example: TowerState account (117 bytes)
// [0..8)     discriminator
// [8..40)    authority: Pubkey
// [40..72)   usdc_mint: Pubkey
// [104..112) total_deposited: u64
// [112..116) total_users: u32
const accountInfo = await connection.getAccountInfo(pda);
const authority = readPubkey(accountInfo.data, 8);
const totalDeposited = readU64(accountInfo.data, 104);
```

**Key Insight**: Map Rust struct byte layouts exactly. Use `DataView` for integers, `Uint8Array.slice()` for pubkeys. No Buffer methods needed.

**Related Gotcha**: IDL field names are `snake_case` (e.g., `usdc_mint`, `total_deposited`), not `camelCase`. BorshAccountsCoder returns snake_case field names matching the IDL.

### 2026-02-13: Workflow Improvements — Commit Verification

**Lesson**: Git commits can succeed even when the terminal hangs and doesn't return to prompt.

**Solution**: Always verify commit status after attempting commit:
```bash
git log --oneline -1  # Shows latest commit
git status --short     # Shows staged/unstaged changes
```

If the latest commit message matches what you just committed but the terminal hung, the commit succeeded.

**Applied**: Updated `/wrapup` and `/commit` workflows to include commit verification steps. Also added React Native platform compatibility notes to `expo-dev-client` skill documenting Buffer/crypto/fs limitations and Solana-specific gotchas.


### 2026-02-12: React Native Gesture Handler + R3F Canvas Touch Event Conflicts

**Problem**: When using `react-native-gesture-handler`'s `GestureDetector` with `onStartShouldSetPanResponder: () => true`, all touch events are captured immediately, preventing R3F Canvas from receiving tap events for raycasting/onClick on 3D objects.

**Solution**: Use `PanResponder` with `onStartShouldSetPanResponder: () => false` and `onMoveShouldSetPanResponder` that only captures after a drag threshold (e.g. 6px). This allows:
- Taps to pass through to R3F Canvas for block selection via raycasting
- Drags to be captured for camera orbit/navigation
- Pinch gestures to work for zoom

**Key Code Pattern**:
```typescript
PanResponder.create({
  // Don't capture on touch start — let taps through to R3F Canvas
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: (_, gesture) => {
    // Only capture once finger has moved enough to be a drag
    return (
      Math.abs(gesture.dx) > DRAG_THRESHOLD ||
      Math.abs(gesture.dy) > DRAG_THRESHOLD
    );
  },
  // ... handle drags
});
```

### 2026-02-12: Mobile 3D Camera Feel Best Practices

**Lesson**: For a tactile, responsive 3D camera orbit on mobile:
1. **Momentum**: Track velocity during drag, apply friction decay (0.92) after release for inertia
2. **Higher sensitivity**: 0.006 rad/px feels more responsive than 0.004
3. **Snappy lerp**: 0.12 feels more immediate than 0.08 while still smooth
4. **Kill momentum on programmatic camera moves**: Zero out velocity when flying to block or resetting

**Result**: Users reported "feels much better" and "more tactile/free" compared to basic lerp-only approach.

### 2026-02-12: GestureHandlerRootView Required for react-native-gesture-handler

**Problem**: `GestureDetector must be used as a descendant of GestureHandlerRootView` runtime error.

**Solution**: Wrap the root layout component with `GestureHandlerRootView`:
```typescript
// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Stack navigator, etc. */}
    </GestureHandlerRootView>
  );
}
```

This enables gesture recognition throughout the entire app tree.
