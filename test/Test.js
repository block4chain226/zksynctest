const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const {ethers} = require("hardhat");
const {parseUnits} = require('viem');

describe("Test", function () {
    async function deploy() {
        const [owner, user] = await ethers.getSigners();

        const thousand_tokens = parseUnits("1000", 18);
        const tenMillion_tokens = parseUnits("10000000", 18);
        const tenThousand_tokens = parseUnits("10000", 18);


        const RewardToken = await ethers.getContractFactory("RewardToken");
        const rewardTokenContract = await RewardToken.deploy();
        await rewardTokenContract.waitForDeployment();
        const DepositToken = await ethers.getContractFactory("DepositToken");
        const depositTokenContract = await DepositToken.deploy();
        await depositTokenContract.waitForDeployment();
        const Farm = await ethers.getContractFactory("Farm");
        const farmContract = await Farm.deploy(rewardTokenContract.getAddress(), depositTokenContract.getAddress());
        await farmContract.waitForDeployment();

        await depositTokenContract.connect(user).mint(user.address, thousand_tokens);
        await rewardTokenContract.connect(owner).approve(farmContract.getAddress(), tenMillion_tokens);
        await farmContract.connect(owner).depositRewardToken(tenMillion_tokens);

        return {
            rewardTokenContract,
            depositTokenContract,
            farmContract,
            owner,
            user,
            thousand_tokens,
            tenMillion_tokens,
            tenThousand_tokens
        };
    }

    describe("Tokens", () => {
        it("user must have 1000e18 deposit tokens on the balance after minting", async () => {
            const {depositTokenContract, user, thousand_tokens} = await loadFixture(deploy);
            expect(await depositTokenContract.balanceOf(user.address)).to.eq(thousand_tokens);
        })
        it("only owner can mint reward tokens", async () => {
            const {depositTokenContract, rewardTokenContract, user, thousand_tokens} = await loadFixture(deploy);
            await expect(rewardTokenContract.connect(user).mint(user.address, thousand_tokens)).to.reverted;
        })
    })

    describe("Farming", () => {
        describe("depositRewardToken", () => {
            it("farm contract must have 10000000e18 reward tokens on balance after they were deposited by owner", async () => {
                const {rewardTokenContract, farmContract, tenMillion_tokens} = await loadFixture(deploy);
                const rewardTokensBalance = await rewardTokenContract.balanceOf(farmContract.getAddress());
                expect(rewardTokensBalance).to.eq(tenMillion_tokens);
            })
            it("must be reverted if function was called not by owner", async () => {
                const {rewardTokenContract, farmContract, user} = await loadFixture(deploy);
                await expect(farmContract.connect(user).depositRewardToken("100")).to.be.revertedWith("Ownable: caller is not the owner");
            })
            it("depositRewardToken should be reverted with: amount 0", async () => {
                const {farmContract, owner} = await loadFixture(deploy);
                await expect(farmContract.connect(owner).depositRewardToken("0")).to.be.revertedWith("amount 0");
            });
            it("depositRewardToken should be reverted with: you have not enough reward tokens", async () => {
                const {farmContract, rewardTokenContract, owner, tenThousand_tokens} = await loadFixture(deploy);
                await rewardTokenContract.connect(owner).approve(farmContract.getAddress(), tenThousand_tokens);
                await expect(farmContract.connect(owner).depositRewardToken(tenThousand_tokens)).to.be.revertedWith("you have not enough reward tokens");
            });
            it("depositRewardToken should be reverted with: you haven't enough allowance", async () => {
                const {farmContract, rewardTokenContract, owner, tenThousand_tokens} = await loadFixture(deploy);
                await rewardTokenContract.connect(owner).mint(owner.address, tenThousand_tokens);
                await rewardTokenContract.connect(owner).approve(farmContract.getAddress(), "1000");
                await expect(farmContract.connect(owner).depositRewardToken(tenThousand_tokens)).to.be.revertedWith("you haven't enough allowance");
            });
        });
    });

    describe("setAccRewardPerSecond", () => {
        it("must be reverted if function was called not by owner", async () => {
            const {rewardTokenContract, farmContract, owner, user} = await loadFixture(deploy);
            await expect(farmContract.connect(user).setAccRewardPerSecond("100")).to.be.revertedWith("Ownable: caller is not the owner");
        })
        it("must be reverted if function set to 0", async () => {
            const {rewardTokenContract, farmContract, user, owner} = await loadFixture(deploy);
            await expect(farmContract.connect(owner).setAccRewardPerSecond("0")).to.be.revertedWith("accRewardPerShare can't be 0");
        })
        it("accRewardPerSecond should be changed to 100", async () => {
            const {farmContract, rewardTokenContract, owner} = await loadFixture(deploy);
            const tx = await farmContract.connect(owner).setAccRewardPerSecond("100");
            const newAccRewardPerSecond = await farmContract.accRewardPerSecond();
            expect(newAccRewardPerSecond).to.eq("100");
            await expect(tx).to.emit(farmContract, "SetAccRewardPerSecond");
        });
    })

    describe("stake", () => {
        it("user should have more reward tokens on his balance after stake and claim", async () => {
            const {
                farmContract,
                rewardTokenContract,
                depositTokenContract,
                user,
                thousand_tokens,
            } = await loadFixture(deploy);
            await depositTokenContract.connect(user).approve(farmContract.getAddress(), thousand_tokens);
            await farmContract.connect(user).stake(thousand_tokens);
            await time.increase(86400);
            const rewardTokensBefore = await rewardTokenContract.balanceOf(user.address);
            const tx = await farmContract.connect(user).claim();
            const rewardTokensAfter = await rewardTokenContract.balanceOf(user.address);
            expect(rewardTokensBefore < rewardTokensAfter).to.eq(true);
            await expect(tx).to.emit(farmContract, "Claim");
        })
        it("user shouldn't have pending rewards after re stake", async () => {
            const {
                farmContract,
                depositTokenContract,
                user,
                thousand_tokens,
            } = await loadFixture(deploy);
            await depositTokenContract.connect(user).approve(farmContract.getAddress(), thousand_tokens);
            await farmContract.connect(user).stake(thousand_tokens);
            await time.increase(86400);
            const penddingAmountBefore = await farmContract.getPendingRewards(user.address);
            await depositTokenContract.connect(user).mint(user.address, thousand_tokens);
            await depositTokenContract.connect(user).approve(farmContract.getAddress(), thousand_tokens);
            const tx = await farmContract.connect(user).stake(thousand_tokens);
            const penddingAmountAfter = await farmContract.getPendingRewards(user.address);
            expect(penddingAmountBefore > penddingAmountAfter).to.eq(true);
            await expect(tx).to.emit(farmContract, "Stake");
        })
        it("user should get back 1000e18 deposit tokens back and reward tokens after unstake", async () => {
            const {
                farmContract,
                rewardTokenContract,
                depositTokenContract,
                user,
                thousand_tokens,
            } = await loadFixture(deploy);
            await depositTokenContract.connect(user).approve(farmContract.getAddress(), thousand_tokens);
            await farmContract.connect(user).stake(thousand_tokens);
            const depositTokensAfterStake = await depositTokenContract.balanceOf(user.address);
            await time.increase(86400);
            const rewardTokensBefore = await rewardTokenContract.balanceOf(user.address);
            const tx = await farmContract.connect(user).unStake(thousand_tokens);
            const depositTokensAfterUnStake = await depositTokenContract.balanceOf(user.address);
            const rewardTokensAfter = await rewardTokenContract.balanceOf(user.address);
            expect(depositTokensAfterStake == 0).to.eq(true);
            expect(depositTokensAfterUnStake == thousand_tokens).to.eq(true);
            expect(rewardTokensBefore < rewardTokensAfter).to.eq(true);
            await expect(tx).to.emit(farmContract, "UnStake");
        })
        it("user should get back 500e18 deposit tokens back and reward tokens after unstake", async () => {
            const {
                farmContract,
                rewardTokenContract,
                depositTokenContract,
                user,
                thousand_tokens,
            } = await loadFixture(deploy);
            const fiveHundreds_tokens = parseUnits("500", 18);
            await depositTokenContract.connect(user).approve(farmContract.getAddress(), thousand_tokens);
            await farmContract.connect(user).stake(thousand_tokens);
            const depositTokensAfterStake = await depositTokenContract.balanceOf(user.address);
            await time.increase(86400);
            const rewardTokensBefore = await rewardTokenContract.balanceOf(user.address);
            const tx = await farmContract.connect(user).unStake(fiveHundreds_tokens);
            const depositTokensAfterUnStake = await depositTokenContract.balanceOf(user.address);
            const rewardTokensAfter = await rewardTokenContract.balanceOf(user.address);
            expect(depositTokensAfterStake == 0).to.eq(true);
            expect(depositTokensAfterUnStake == fiveHundreds_tokens).to.eq(true);
            expect(rewardTokensBefore < rewardTokensAfter).to.eq(true);
            await expect(tx).to.emit(farmContract, "UnStake");
        })
    })
});
