import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Monolith } from "../target/types/monolith";
import { expect } from "chai";
import {
    PublicKey,
    SystemProgram,
    Keypair,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddress,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("monolith — USDC vault staking", () => {
    // Configure the client to use the local cluster
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Monolith as Program<Monolith>;
    const authority = provider.wallet;

    // A second player keypair for testing authorization checks
    let player2: Keypair;

    // USDC-like mint (6 decimals, created in tests)
    let usdcMint: PublicKey;
    const USDC_DECIMALS = 6;
    const ONE_USDC = 1_000_000; // 10^6

    // PDA addresses
    let towerPda: PublicKey;
    let towerBump: number;
    let vaultAta: PublicKey;

    // Block test constants
    const BLOCK_ID_1 = 42;
    const BLOCK_ID_2 = 100;
    let blockPda1: PublicKey;
    let blockPda2: PublicKey;

    // Player token accounts
    let authorityTokenAccount: PublicKey;
    let player2TokenAccount: PublicKey;

    before(async () => {
        // ---------------------------------------------------------------
        // 1. Create a second player and fund with SOL
        // ---------------------------------------------------------------
        player2 = Keypair.generate();
        const airdropSig = await provider.connection.requestAirdrop(
            player2.publicKey,
            2 * LAMPORTS_PER_SOL,
        );
        await provider.connection.confirmTransaction(airdropSig, "confirmed");

        // ---------------------------------------------------------------
        // 2. Create a mock USDC mint (6 decimals, authority = wallet)
        // ---------------------------------------------------------------
        usdcMint = await createMint(
            provider.connection,
            (authority as any).payer, // payer
            authority.publicKey, // mint authority
            null, // freeze authority
            USDC_DECIMALS,
        );

        // ---------------------------------------------------------------
        // 3. Derive PDAs
        // ---------------------------------------------------------------
        [towerPda, towerBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("tower")],
            program.programId,
        );

        vaultAta = await getAssociatedTokenAddress(
            usdcMint,
            towerPda,
            true, // allowOwnerOffCurve (PDA)
        );

        const blockIdBytes1 = Buffer.alloc(4);
        blockIdBytes1.writeUInt32LE(BLOCK_ID_1);
        [blockPda1] = PublicKey.findProgramAddressSync(
            [Buffer.from("block"), blockIdBytes1],
            program.programId,
        );

        const blockIdBytes2 = Buffer.alloc(4);
        blockIdBytes2.writeUInt32LE(BLOCK_ID_2);
        [blockPda2] = PublicKey.findProgramAddressSync(
            [Buffer.from("block"), blockIdBytes2],
            program.programId,
        );

        // ---------------------------------------------------------------
        // 4. Create ATAs and mint USDC to players
        // ---------------------------------------------------------------
        authorityTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            (authority as any).payer,
            usdcMint,
            authority.publicKey,
        );

        player2TokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            (authority as any).payer,
            usdcMint,
            player2.publicKey,
        );

        // Mint 100 USDC to authority, 50 USDC to player2
        await mintTo(
            provider.connection,
            (authority as any).payer,
            usdcMint,
            authorityTokenAccount,
            authority.publicKey,
            100 * ONE_USDC,
        );

        await mintTo(
            provider.connection,
            (authority as any).payer,
            usdcMint,
            player2TokenAccount,
            authority.publicKey,
            50 * ONE_USDC,
        );
    });

    // ===================================================================
    // Test 1: Initialize tower
    // ===================================================================
    it("initializes the tower with USDC mint and vault ATA", async () => {
        const tx = await program.methods
            .initializeTower()
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                usdcMint: usdcMint,
                authority: authority.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log("  Initialize tower tx:", tx);

        // Verify tower state
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.authority.toBase58()).to.equal(
            authority.publicKey.toBase58(),
        );
        expect(tower.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
        expect(tower.totalBlocksClaimed.toNumber()).to.equal(0);
        expect(tower.totalStaked.toNumber()).to.equal(0);
        expect(tower.bump).to.equal(towerBump);

        // Verify vault ATA exists and is empty
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(0);
        expect(vaultAccount.mint.toBase58()).to.equal(usdcMint.toBase58());
    });

    // ===================================================================
    // Test 2: Deposit stake — claim a new block
    // ===================================================================
    it("deposits USDC and claims a new block", async () => {
        const stakeAmount = 5 * ONE_USDC; // 5 USDC

        const balanceBefore = await getAccount(
            provider.connection,
            authorityTokenAccount,
        );

        const tx = await program.methods
            .depositStake(BLOCK_ID_1, new anchor.BN(stakeAmount), 5, 1, 3)
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: blockPda1,
                usdcMint: usdcMint,
                playerTokenAccount: authorityTokenAccount,
                player: authority.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log("  Deposit stake tx:", tx);

        // Verify block was created
        const block = await program.account.blockAccount.fetch(blockPda1);
        expect(block.owner.toBase58()).to.equal(
            authority.publicKey.toBase58(),
        );
        expect(block.blockId).to.equal(BLOCK_ID_1);
        expect(block.stakeAmount.toNumber()).to.equal(stakeAmount);
        expect(block.positionX).to.equal(5);
        expect(block.positionY).to.equal(1);
        expect(block.positionZ).to.equal(3);

        // Verify tower totals
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalBlocksClaimed.toNumber()).to.equal(1);
        expect(tower.totalStaked.toNumber()).to.equal(stakeAmount);

        // Verify USDC moved to vault
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(stakeAmount);

        // Verify player balance decreased
        const balanceAfter = await getAccount(
            provider.connection,
            authorityTokenAccount,
        );
        expect(Number(balanceAfter.amount)).to.equal(
            Number(balanceBefore.amount) - stakeAmount,
        );
    });

    // ===================================================================
    // Test 3: Deposit stake below minimum — should fail
    // ===================================================================
    it("rejects deposit below minimum stake (0.10 USDC)", async () => {
        const tinyAmount = 50_000; // 0.05 USDC — below 0.10 minimum

        try {
            await program.methods
                .depositStake(BLOCK_ID_2, new anchor.BN(tinyAmount), 0, 0, 0)
                .accounts({
                    towerState: towerPda,
                    vaultTokenAccount: vaultAta,
                    blockAccount: blockPda2,
                    usdcMint: usdcMint,
                    playerTokenAccount: authorityTokenAccount,
                    player: authority.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .rpc();
            expect.fail("Should have thrown InsufficientStake error");
        } catch (err: any) {
            expect(err.error.errorCode.code).to.equal("InsufficientStake");
        }
    });

    // ===================================================================
    // Test 4: Add stake to an existing block
    // ===================================================================
    it("adds more USDC stake to an owned block", async () => {
        const additionalAmount = 2 * ONE_USDC; // 2 more USDC

        const blockBefore = await program.account.blockAccount.fetch(blockPda1);
        const stakeBefore = blockBefore.stakeAmount.toNumber();

        const tx = await program.methods
            .addStake(BLOCK_ID_1, new anchor.BN(additionalAmount))
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: blockPda1,
                usdcMint: usdcMint,
                playerTokenAccount: authorityTokenAccount,
                owner: authority.publicKey,
                player: authority.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log("  Add stake tx:", tx);

        // Verify stake increased
        const blockAfter = await program.account.blockAccount.fetch(blockPda1);
        expect(blockAfter.stakeAmount.toNumber()).to.equal(
            stakeBefore + additionalAmount,
        );

        // Verify tower total increased
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalStaked.toNumber()).to.equal(
            stakeBefore + additionalAmount,
        );

        // Verify vault balance matches
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(
            stakeBefore + additionalAmount,
        );
    });

    // ===================================================================
    // Test 5: Add stake by non-owner — should fail
    // ===================================================================
    it("rejects add stake from non-owner", async () => {
        try {
            await program.methods
                .addStake(BLOCK_ID_1, new anchor.BN(ONE_USDC))
                .accounts({
                    towerState: towerPda,
                    vaultTokenAccount: vaultAta,
                    blockAccount: blockPda1,
                    usdcMint: usdcMint,
                    playerTokenAccount: player2TokenAccount,
                    owner: player2.publicKey, // wrong owner
                    player: player2.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([player2])
                .rpc();
            expect.fail("Should have thrown Unauthorized error");
        } catch (err: any) {
            // The has_one constraint triggers a ConstraintHasOne or custom Unauthorized
            expect(err.error.errorCode.code).to.be.oneOf([
                "Unauthorized",
                "ConstraintHasOne",
            ]);
        }
    });

    // ===================================================================
    // Test 6: Withdraw — returns USDC and closes block
    // ===================================================================
    it("withdraws all USDC and releases the block", async () => {
        const block = await program.account.blockAccount.fetch(blockPda1);
        const expectedReturn = block.stakeAmount.toNumber();

        const playerBalanceBefore = await getAccount(
            provider.connection,
            authorityTokenAccount,
        );

        const tx = await program.methods
            .withdraw(BLOCK_ID_1)
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: blockPda1,
                usdcMint: usdcMint,
                playerTokenAccount: authorityTokenAccount,
                owner: authority.publicKey,
                player: authority.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log("  Withdraw tx:", tx);

        // Verify block account is closed
        const blockInfo =
            await provider.connection.getAccountInfo(blockPda1);
        expect(blockInfo).to.be.null;

        // Verify tower totals decremented
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalBlocksClaimed.toNumber()).to.equal(0);
        expect(tower.totalStaked.toNumber()).to.equal(0);

        // Verify vault is now empty
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(0);

        // Verify player got USDC back
        const playerBalanceAfter = await getAccount(
            provider.connection,
            authorityTokenAccount,
        );
        expect(Number(playerBalanceAfter.amount)).to.equal(
            Number(playerBalanceBefore.amount) + expectedReturn,
        );
    });

    // ===================================================================
    // Test 7: Withdraw by non-owner — should fail
    // ===================================================================
    it("rejects withdrawal from non-owner", async () => {
        // First, claim a block as authority so we have something to try to steal
        const stakeAmount = ONE_USDC;

        await program.methods
            .depositStake(BLOCK_ID_2, new anchor.BN(stakeAmount), 0, 2, 0)
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: blockPda2,
                usdcMint: usdcMint,
                playerTokenAccount: authorityTokenAccount,
                player: authority.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();

        // Now player2 tries to withdraw authority's block
        try {
            await program.methods
                .withdraw(BLOCK_ID_2)
                .accounts({
                    towerState: towerPda,
                    vaultTokenAccount: vaultAta,
                    blockAccount: blockPda2,
                    usdcMint: usdcMint,
                    playerTokenAccount: player2TokenAccount,
                    owner: player2.publicKey,
                    player: player2.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([player2])
                .rpc();
            expect.fail("Should have thrown Unauthorized error");
        } catch (err: any) {
            expect(err.error.errorCode.code).to.be.oneOf([
                "Unauthorized",
                "ConstraintHasOne",
            ]);
        }
    });

    // ===================================================================
    // Test 8: Block ID out of range — should fail
    // ===================================================================
    it("rejects block ID >= MAX_BLOCKS (1000)", async () => {
        const invalidBlockId = 1000;
        const blockIdBytes = Buffer.alloc(4);
        blockIdBytes.writeUInt32LE(invalidBlockId);
        const [invalidBlockPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("block"), blockIdBytes],
            program.programId,
        );

        try {
            await program.methods
                .depositStake(
                    invalidBlockId,
                    new anchor.BN(ONE_USDC),
                    0, 0, 0,
                )
                .accounts({
                    towerState: towerPda,
                    vaultTokenAccount: vaultAta,
                    blockAccount: invalidBlockPda,
                    usdcMint: usdcMint,
                    playerTokenAccount: authorityTokenAccount,
                    player: authority.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .rpc();
            expect.fail("Should have thrown InvalidBlockId error");
        } catch (err: any) {
            expect(err.error.errorCode.code).to.equal("InvalidBlockId");
        }
    });

    // ===================================================================
    // Test 9: Player 2 can claim and manage their own block
    // ===================================================================
    it("allows a second player to claim and withdraw their own block", async () => {
        const blockId = 99;
        const blockIdBytes = Buffer.alloc(4);
        blockIdBytes.writeUInt32LE(blockId);
        const [player2BlockPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("block"), blockIdBytes],
            program.programId,
        );

        const stakeAmount = 3 * ONE_USDC;

        // Player 2 deposits
        await program.methods
            .depositStake(blockId, new anchor.BN(stakeAmount), 2, 3, 1)
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: player2BlockPda,
                usdcMint: usdcMint,
                playerTokenAccount: player2TokenAccount,
                player: player2.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        // Verify block ownership
        const block =
            await program.account.blockAccount.fetch(player2BlockPda);
        expect(block.owner.toBase58()).to.equal(player2.publicKey.toBase58());
        expect(block.stakeAmount.toNumber()).to.equal(stakeAmount);

        // Tower now has 2 blocks (block_100 from test 7 + this one)
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalBlocksClaimed.toNumber()).to.equal(2);

        // Player 2 withdraws
        const balanceBefore = await getAccount(
            provider.connection,
            player2TokenAccount,
        );

        await program.methods
            .withdraw(blockId)
            .accounts({
                towerState: towerPda,
                vaultTokenAccount: vaultAta,
                blockAccount: player2BlockPda,
                usdcMint: usdcMint,
                playerTokenAccount: player2TokenAccount,
                owner: player2.publicKey,
                player: player2.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([player2])
            .rpc();

        // Verify USDC returned
        const balanceAfter = await getAccount(
            provider.connection,
            player2TokenAccount,
        );
        expect(Number(balanceAfter.amount)).to.equal(
            Number(balanceBefore.amount) + stakeAmount,
        );

        // Tower back to 1 block
        const towerAfter = await program.account.towerState.fetch(towerPda);
        expect(towerAfter.totalBlocksClaimed.toNumber()).to.equal(1);
    });
});
