/**
 * Initialize the Monolith tower on devnet.
 * 
 * Run once after deploying the program:
 *   npx ts-node scripts/initialize-devnet.ts
 * 
 * This creates the TowerState PDA and the USDC vault ATA.
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Devnet USDC mint (Circle's official devnet USDC)
const DEVNET_USDC_MINT = new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

async function main() {
    // Use the Anchor provider from environment (reads Anchor.toml)
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Monolith;
    const authority = provider.wallet.publicKey;

    console.log("Program ID:", program.programId.toBase58());
    console.log("Authority:", authority.toBase58());
    console.log("USDC Mint:", DEVNET_USDC_MINT.toBase58());

    // Derive PDAs
    const [towerPda, towerBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("tower")],
        program.programId,
    );
    console.log("Tower PDA:", towerPda.toBase58());

    const vaultAta = await getAssociatedTokenAddress(
        DEVNET_USDC_MINT,
        towerPda,
        true, // allowOwnerOffCurve
    );
    console.log("Vault ATA:", vaultAta.toBase58());

    // Check if already initialized
    try {
        const existing = await program.account.towerState.fetch(towerPda);
        console.log("\n✅ Tower already initialized!");
        console.log("  Total deposited:", existing.totalDeposited.toNumber());
        console.log("  Total users:", existing.totalUsers);
        return;
    } catch {
        console.log("\nTower not yet initialized. Initializing...");
    }

    // Initialize
    const tx = await program.methods
        .initialize()
        .accounts({
            towerState: towerPda,
            usdcMint: DEVNET_USDC_MINT,
            vault: vaultAta,
            authority: authority,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

    console.log("\n✅ Tower initialized!");
    console.log("  Signature:", tx);
    console.log("  Tower PDA:", towerPda.toBase58());
    console.log("  Vault ATA:", vaultAta.toBase58());

    // Verify
    const tower = await program.account.towerState.fetch(towerPda);
    console.log("\n  Verified:");
    console.log("    Authority:", tower.authority.toBase58());
    console.log("    USDC Mint:", tower.usdcMint.toBase58());
    console.log("    Total deposited:", tower.totalDeposited.toNumber());
    console.log("    Total users:", tower.totalUsers);
}

main().catch(console.error);
