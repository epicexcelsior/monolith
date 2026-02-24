import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Monolith } from "../target/types/monolith";
import {
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddress,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("monolith", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Monolith as Program<Monolith>;
    const user = provider.wallet;

    let usdcMint: PublicKey;
    let mintAuthority: Keypair;
    let userTokenAccount: PublicKey;
    let towerPda: PublicKey;
    let towerBump: number;
    let vaultAta: PublicKey;
    let userDepositPda: PublicKey;

    const USDC_DECIMALS = 6;
    const ONE_USDC = 1_000_000;
    const INITIAL_BALANCE = 1000 * ONE_USDC; // 1000 USDC

    before(async () => {
        // Create a mint authority keypair and fund it
        mintAuthority = Keypair.generate();
        const airdropSig = await provider.connection.requestAirdrop(
            mintAuthority.publicKey,
            2 * LAMPORTS_PER_SOL,
        );
        await provider.connection.confirmTransaction(airdropSig);

        // Create a USDC-like mint on localnet
        usdcMint = await createMint(
            provider.connection,
            mintAuthority,
            mintAuthority.publicKey,
            null,
            USDC_DECIMALS,
        );

        // Create user's USDC ATA
        userTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            mintAuthority,
            usdcMint,
            user.publicKey,
        );

        // Mint 1000 USDC to user
        await mintTo(
            provider.connection,
            mintAuthority,
            usdcMint,
            userTokenAccount,
            mintAuthority,
            INITIAL_BALANCE,
        );

        // Derive PDAs
        [towerPda, towerBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("tower")],
            program.programId,
        );

        vaultAta = await getAssociatedTokenAddress(
            usdcMint,
            towerPda,
            true,
        );

        [userDepositPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("deposit"), user.publicKey.toBuffer()],
            program.programId,
        );
    });

    // ----- INITIALIZE -----

    it("initializes the tower and vault", async () => {
        await program.methods
            .initialize()
            .accounts({
                towerState: towerPda,
                usdcMint: usdcMint,
                vault: vaultAta,
                authority: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();

        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.authority.toBase58()).to.equal(user.publicKey.toBase58());
        expect(tower.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
        expect(tower.vault.toBase58()).to.equal(vaultAta.toBase58());
        expect(tower.totalDeposited.toNumber()).to.equal(0);
        expect(tower.totalUsers).to.equal(0);
    });

    // ----- DEPOSIT -----

    it("deposits 1 USDC", async () => {
        const depositAmount = ONE_USDC;

        await program.methods
            .deposit(new anchor.BN(depositAmount))
            .accounts({
                towerState: towerPda,
                userDeposit: userDepositPda,
                vault: vaultAta,
                userTokenAccount: userTokenAccount,
                usdcMint: usdcMint,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        // User deposit created
        const deposit = await program.account.userDeposit.fetch(userDepositPda);
        expect(deposit.owner.toBase58()).to.equal(user.publicKey.toBase58());
        expect(deposit.amount.toNumber()).to.equal(depositAmount);
        expect(deposit.lastDepositAt.toNumber()).to.be.greaterThan(0);

        // Tower updated
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalDeposited.toNumber()).to.equal(depositAmount);
        expect(tower.totalUsers).to.equal(1);

        // Vault has the USDC
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(depositAmount);

        // User balance decreased
        const userAccount = await getAccount(provider.connection, userTokenAccount);
        expect(Number(userAccount.amount)).to.equal(INITIAL_BALANCE - depositAmount);
    });

    it("deposits more USDC (same user)", async () => {
        const additionalAmount = 500_000; // 0.5 USDC

        await program.methods
            .deposit(new anchor.BN(additionalAmount))
            .accounts({
                towerState: towerPda,
                userDeposit: userDepositPda,
                vault: vaultAta,
                userTokenAccount: userTokenAccount,
                usdcMint: usdcMint,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const deposit = await program.account.userDeposit.fetch(userDepositPda);
        expect(deposit.amount.toNumber()).to.equal(ONE_USDC + additionalAmount);

        // User count should still be 1 (same user)
        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalUsers).to.equal(1);
        expect(tower.totalDeposited.toNumber()).to.equal(ONE_USDC + additionalAmount);
    });

    // ----- WITHDRAW -----

    it("withdraws partial USDC", async () => {
        const withdrawAmount = 500_000; // 0.5 USDC
        const balanceBefore = ONE_USDC + 500_000; // 1.5 USDC total

        await program.methods
            .withdraw(new anchor.BN(withdrawAmount))
            .accounts({
                towerState: towerPda,
                userDeposit: userDepositPda,
                vault: vaultAta,
                userTokenAccount: userTokenAccount,
                usdcMint: usdcMint,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const deposit = await program.account.userDeposit.fetch(userDepositPda);
        expect(deposit.amount.toNumber()).to.equal(balanceBefore - withdrawAmount);

        const tower = await program.account.towerState.fetch(towerPda);
        expect(tower.totalDeposited.toNumber()).to.equal(balanceBefore - withdrawAmount);
    });

    it("withdraws remaining USDC", async () => {
        const remaining = ONE_USDC; // 1.0 USDC left

        await program.methods
            .withdraw(new anchor.BN(remaining))
            .accounts({
                towerState: towerPda,
                userDeposit: userDepositPda,
                vault: vaultAta,
                userTokenAccount: userTokenAccount,
                usdcMint: usdcMint,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const deposit = await program.account.userDeposit.fetch(userDepositPda);
        expect(deposit.amount.toNumber()).to.equal(0);

        // User should have all their USDC back
        const userAccount = await getAccount(provider.connection, userTokenAccount);
        expect(Number(userAccount.amount)).to.equal(INITIAL_BALANCE);

        // Vault should be empty
        const vaultAccount = await getAccount(provider.connection, vaultAta);
        expect(Number(vaultAccount.amount)).to.equal(0);
    });

    // ----- ERROR CASES -----

    it("fails to deposit zero amount", async () => {
        try {
            await program.methods
                .deposit(new anchor.BN(0))
                .accounts({
                    towerState: towerPda,
                    userDeposit: userDepositPda,
                    vault: vaultAta,
                    userTokenAccount: userTokenAccount,
                    usdcMint: usdcMint,
                    user: user.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            expect.fail("Should have thrown");
        } catch (err: any) {
            expect(err.toString()).to.include("InsufficientDeposit");
        }
    });

    it("fails to withdraw more than deposited", async () => {
        try {
            await program.methods
                .withdraw(new anchor.BN(999 * ONE_USDC))
                .accounts({
                    towerState: towerPda,
                    userDeposit: userDepositPda,
                    vault: vaultAta,
                    userTokenAccount: userTokenAccount,
                    usdcMint: usdcMint,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            expect.fail("Should have thrown");
        } catch (err: any) {
            expect(err.toString()).to.include("InsufficientBalance");
        }
    });

    it("fails to withdraw zero amount", async () => {
        try {
            await program.methods
                .withdraw(new anchor.BN(0))
                .accounts({
                    towerState: towerPda,
                    userDeposit: userDepositPda,
                    vault: vaultAta,
                    userTokenAccount: userTokenAccount,
                    usdcMint: usdcMint,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            expect.fail("Should have thrown");
        } catch (err: any) {
            expect(err.toString()).to.include("InsufficientDeposit");
        }
    });

    // ----- MULTI-USER -----

    describe("second user", () => {
        let user2: Keypair;
        let user2TokenAccount: PublicKey;
        let user2DepositPda: PublicKey;
        const USER2_BALANCE = 500 * ONE_USDC;

        before(async () => {
            // Create and fund second user
            user2 = Keypair.generate();
            const airdropSig = await provider.connection.requestAirdrop(
                user2.publicKey,
                2 * LAMPORTS_PER_SOL,
            );
            await provider.connection.confirmTransaction(airdropSig);

            // Create user2's USDC ATA and mint tokens
            user2TokenAccount = await createAssociatedTokenAccount(
                provider.connection,
                user2,
                usdcMint,
                user2.publicKey,
            );
            await mintTo(
                provider.connection,
                mintAuthority,
                usdcMint,
                user2TokenAccount,
                mintAuthority,
                USER2_BALANCE,
            );

            // Derive user2 deposit PDA
            [user2DepositPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("deposit"), user2.publicKey.toBuffer()],
                program.programId,
            );
        });

        it("second user deposits independently", async () => {
            const depositAmount = 50 * ONE_USDC;

            await program.methods
                .deposit(new anchor.BN(depositAmount))
                .accounts({
                    towerState: towerPda,
                    userDeposit: user2DepositPda,
                    vault: vaultAta,
                    userTokenAccount: user2TokenAccount,
                    usdcMint: usdcMint,
                    user: user2.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user2])
                .rpc();

            // User2 deposit created with correct amount
            const deposit2 = await program.account.userDeposit.fetch(user2DepositPda);
            expect(deposit2.owner.toBase58()).to.equal(user2.publicKey.toBase58());
            expect(deposit2.amount.toNumber()).to.equal(depositAmount);

            // Tower total_users incremented to 2
            const tower = await program.account.towerState.fetch(towerPda);
            expect(tower.totalUsers).to.equal(2);
            expect(tower.totalDeposited.toNumber()).to.equal(depositAmount);

            // User2 balance decreased
            const user2Account = await getAccount(provider.connection, user2TokenAccount);
            expect(Number(user2Account.amount)).to.equal(USER2_BALANCE - depositAmount);
        });

        it("user1 deposit is isolated from user2", async () => {
            // User1 deposit should still be 0 (withdrew everything earlier)
            const deposit1 = await program.account.userDeposit.fetch(userDepositPda);
            expect(deposit1.amount.toNumber()).to.equal(0);

            // User2 deposit should be 50 USDC
            const deposit2 = await program.account.userDeposit.fetch(user2DepositPda);
            expect(deposit2.amount.toNumber()).to.equal(50 * ONE_USDC);
        });

        it("user2 withdraws partial amount", async () => {
            const withdrawAmount = 20 * ONE_USDC;

            await program.methods
                .withdraw(new anchor.BN(withdrawAmount))
                .accounts({
                    towerState: towerPda,
                    userDeposit: user2DepositPda,
                    vault: vaultAta,
                    userTokenAccount: user2TokenAccount,
                    usdcMint: usdcMint,
                    user: user2.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user2])
                .rpc();

            const deposit2 = await program.account.userDeposit.fetch(user2DepositPda);
            expect(deposit2.amount.toNumber()).to.equal(30 * ONE_USDC);

            const tower = await program.account.towerState.fetch(towerPda);
            expect(tower.totalDeposited.toNumber()).to.equal(30 * ONE_USDC);
        });

        it("user2 cannot withdraw more than their balance", async () => {
            try {
                await program.methods
                    .withdraw(new anchor.BN(100 * ONE_USDC))
                    .accounts({
                        towerState: towerPda,
                        userDeposit: user2DepositPda,
                        vault: vaultAta,
                        userTokenAccount: user2TokenAccount,
                        usdcMint: usdcMint,
                        user: user2.publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([user2])
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err: any) {
                expect(err.toString()).to.include("InsufficientBalance");
            }
        });

        it("user1 can re-deposit after full withdrawal", async () => {
            const reDepositAmount = 10 * ONE_USDC;

            await program.methods
                .deposit(new anchor.BN(reDepositAmount))
                .accounts({
                    towerState: towerPda,
                    userDeposit: userDepositPda,
                    vault: vaultAta,
                    userTokenAccount: userTokenAccount,
                    usdcMint: usdcMint,
                    user: user.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            const deposit1 = await program.account.userDeposit.fetch(userDepositPda);
            expect(deposit1.amount.toNumber()).to.equal(reDepositAmount);

            // Tower should show both users' deposits combined
            const tower = await program.account.towerState.fetch(towerPda);
            expect(tower.totalDeposited.toNumber()).to.equal(30 * ONE_USDC + reDepositAmount);
            // total_users stays 2 (re-deposit uses existing PDA)
            expect(tower.totalUsers).to.equal(2);
        });

        it("vault balance matches sum of all user deposits", async () => {
            const deposit1 = await program.account.userDeposit.fetch(userDepositPda);
            const deposit2 = await program.account.userDeposit.fetch(user2DepositPda);
            const tower = await program.account.towerState.fetch(towerPda);
            const vaultAccount = await getAccount(provider.connection, vaultAta);

            const sumDeposits = deposit1.amount.toNumber() + deposit2.amount.toNumber();
            expect(Number(vaultAccount.amount)).to.equal(sumDeposits);
            expect(tower.totalDeposited.toNumber()).to.equal(sumDeposits);
        });
    });
});
