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
});
