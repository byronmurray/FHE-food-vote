import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEFoodVote, FHEFoodVote__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEFoodVote")) as FHEFoodVote__factory;
  const contract = (await factory.deploy()) as FHEFoodVote;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("FHEFoodVote", function () {
  let signers: Signers;
  let contract: FHEFoodVote;
  let contractAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("⚠️ This test suite runs only on FHE mock (not on Sepolia).");
      this.skip();
    }
    ({ contract, contractAddress } = await deployFixture());
  });

  // ===== Basic Tests =====

  it("should allow a user to vote for a food in a country", async function () {
    const country = "Japan";
    const foodId = 1; // e.g. Sushi

    const encrypted = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(foodId).encrypt();

    await (
      await contract.connect(signers.alice).vote(country, foodId, encrypted.handles[0], encrypted.inputProof)
    ).wait();

    const hasVoted = await contract.hasVoted(signers.alice.address, country);
    expect(hasVoted).to.eq(true);

    const encryptedVote = await contract.getEncryptedVotes(signers.alice.address, country);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedVote, contractAddress, signers.alice);

    expect(decrypted).to.eq(foodId);
  });

  it("should prevent a user from voting twice for the same country", async function () {
    const country = "Vietnam";
    const foodId = 2; // Pho

    const enc1 = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(foodId).encrypt();

    await (await contract.connect(signers.alice).vote(country, foodId, enc1.handles[0], enc1.inputProof)).wait();

    const enc2 = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(3).encrypt();

    await expect(contract.connect(signers.alice).vote(country, 3, enc2.handles[0], enc2.inputProof)).to.be.revertedWith(
      "Already voted for this country",
    );
  });

  it("should allow the same user to vote for multiple countries", async function () {
    const countries = ["Italy", "France"];
    const choices = [1, 2];

    for (let i = 0; i < countries.length; i++) {
      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(choices[i])
        .encrypt();

      await (
        await contract.connect(signers.alice).vote(countries[i], choices[i], encrypted.handles[0], encrypted.inputProof)
      ).wait();

      expect(await contract.hasVoted(signers.alice.address, countries[i])).to.eq(true);

      const encryptedVote = await contract.getEncryptedVotes(signers.alice.address, countries[i]);
      const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedVote, contractAddress, signers.alice);
      expect(decrypted).to.eq(choices[i]);
    }
  });

  it("should allow multiple users to vote for the same country independently", async function () {
    const country = "Korea";
    const aliceChoice = 1; // Kimchi
    const bobChoice = 3; // Bibimbap

    const aliceEnc = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceChoice)
      .encrypt();
    const bobEnc = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(bobChoice).encrypt();

    await (
      await contract.connect(signers.alice).vote(country, aliceChoice, aliceEnc.handles[0], aliceEnc.inputProof)
    ).wait();
    await (await contract.connect(signers.bob).vote(country, bobChoice, bobEnc.handles[0], bobEnc.inputProof)).wait();

    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedVotes(signers.alice.address, country),
      contractAddress,
      signers.alice,
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedVotes(signers.bob.address, country),
      contractAddress,
      signers.bob,
    );

    expect(aliceDecrypted).to.eq(aliceChoice);
    expect(bobDecrypted).to.eq(bobChoice);
  });

  it("should revert when getting vote for user who hasn’t voted", async function () {
    const country = "Japan";
    await expect(contract.getEncryptedVotes(signers.bob.address, country)).to.be.revertedWith(
      "User has not voted for this country",
    );
  });

  it("should emit FoodVoted event with correct parameters", async function () {
    const country = "USA";
    const foodId = 4;

    const encrypted = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(foodId).encrypt();

    await expect(contract.connect(signers.alice).vote(country, foodId, encrypted.handles[0], encrypted.inputProof))
      .to.emit(contract, "FoodVoted")
      .withArgs(signers.alice.address, country, foodId);
  });

  it("should handle unusual country names and large food IDs", async function () {
    const country = "São Tomé & Príncipe";
    const foodId = 9999;

    const encrypted = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(foodId).encrypt();

    await (
      await contract.connect(signers.bob).vote(country, foodId, encrypted.handles[0], encrypted.inputProof)
    ).wait();

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.getEncryptedVotes(signers.bob.address, country),
      contractAddress,
      signers.bob,
    );
    expect(decrypted).to.eq(foodId);
  });
});
