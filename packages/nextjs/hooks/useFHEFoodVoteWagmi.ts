"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEFoodVoteWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
  country: string;
  foodId: number;
}) => {
  const { instance, initialMockChains, country, foodId } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheFoodVote } = useDeployedContractInfo({
    contractName: "FHEFoodVote",
    chainId: allowedChainId,
  });

  type FHEFoodVoteInfo = Contract<"FHEFoodVote"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheFoodVote?.address && fheFoodVote?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheFoodVote!.address, (fheFoodVote as FHEFoodVoteInfo).abi, providerOrSigner);
  };

  // --- Read encrypted vote count ---
  const {
    data: encryptedVotesHandle,
    refetch: refreshEncryptedVotes,
    isFetching: isRefreshing,
  } = useReadContract({
    address: hasContract ? (fheFoodVote!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((fheFoodVote as FHEFoodVoteInfo).abi as any) : undefined,
    functionName: "getEncryptedVotes" as const,
    args: [accounts ? accounts[0] : '', country],
    query: {
      enabled: Boolean(hasContract && hasProvider && country && foodId),
      refetchOnWindowFocus: false,
    },
  });

  const voteHandle = useMemo(() => (encryptedVotesHandle as string | undefined) ?? undefined, [encryptedVotesHandle]);

  const requests = useMemo(() => {
    if (!hasContract || !voteHandle || voteHandle === ethers.ZeroHash) return undefined;
    return [{ handle: voteHandle, contractAddress: fheFoodVote!.address }] as const;
  }, [hasContract, fheFoodVote?.address, voteHandle]);

  const {
    canDecrypt,
    decrypt,
    isDecrypting,
    message: decMsg,
    results,
    error,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const decryptedResult = useMemo(() => {
    if (!voteHandle) return undefined;
    const clear = results[voteHandle];
    if (typeof clear === "undefined") return undefined;
    return { handle: voteHandle, clear } as const;
  }, [voteHandle, results]);

  const isDecrypted = useMemo(() => {
    setIsProcessing(false);
    if (!voteHandle) return false;
    const val = results?.[voteHandle];
    return typeof val !== "undefined";
  }, [voteHandle, results]);


  useEffect(() => {
    setIsProcessing(false);
  }, [error]);


  const decryptVotes = () => {
    setIsProcessing(true);
    decrypt();
  };

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheFoodVote?.address,
  });

  const getEncryptionMethodFor = (functionName: "vote") => {
    const functionAbi = fheFoodVote?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) {
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` };
    }
    const firstEncrypted = functionAbi.inputs?.find(i => i.internalType.includes("externalEuint32"));
    return { method: getEncryptionMethod(firstEncrypted?.internalType), error: undefined };
  };

  const vote = async (country: string, foodId: number) => {
    if (isProcessing || !instance || !ethersSigner || !hasContract) return;
    setIsProcessing(true);
    setMessage(`Voting for ${country} / foodId=${foodId}...`);
    try {
      const { method, error } = getEncryptionMethodFor("vote");
      if (!method) return setMessage(error ?? "Encryption method not found");

      const enc = await encryptWith(builder => {
        (builder as any).add32(foodId);
      });
      if (!enc) return setMessage("Encryption failed");

      const writeContract = getContract("write");
      if (!writeContract) return setMessage("Contract or signer missing");

      const tx = await writeContract.vote(country, foodId, enc.handles[0], enc.inputProof, { gasLimit: 300_000 });
      setMessage("Waiting for transaction confirmation...");
      await tx.wait();

      setMessage(`✅ Voted for ${country} / foodId=${foodId}`);
      await refreshEncryptedVotes();
    } catch (e) {
      setMessage(`vote() failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    contractAddress: fheFoodVote?.address,
    canDecrypt,
    decryptVotes,
    vote,
    isDecrypted,
    message,
    clear: decryptedResult?.clear,
    handle: voteHandle,
    isDecrypting,
    isRefreshing,
    isProcessing,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
