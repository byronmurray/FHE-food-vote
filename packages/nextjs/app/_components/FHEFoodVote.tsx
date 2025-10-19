"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import PuffLoader from "react-spinners/PuffLoader";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { COUNTRIES, FOOD_BY_COUNTRY } from "~~/constants/index";
import { useFHEFoodVoteWagmi } from "~~/hooks/useFHEFoodVoteWagmi";

export const FHEFoodVote = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const [selectedCountry, setSelectedCountry] = useState<string>("Japan");
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);

  const foods = FOOD_BY_COUNTRY[selectedCountry];
  const voteFood = useFHEFoodVoteWagmi({
    instance: fhevmInstance,
    initialMockChains,
    country: selectedCountry,
    foodId: selectedFoodId ?? 1,
  });

  const handleFoodClick = (foodId: number) => {
    setSelectedFoodId(foodId);
    voteFood.vote(selectedCountry, foodId);
  };

  useEffect(() => {
    if (voteFood.clear) {
      setSelectedFoodId(Number(voteFood.clear));
    }
  }, [voteFood.clear]);

  if (!isConnected) {
    return (
      <div
        className="max-w-4xl mx-auto p-8 text-gray-900 text-center flex items-center"
        style={{ height: "calc(100vh - 100px)" }}
      >
        <div className="bg-white border shadow-xl rounded-xl p-10">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-600 mb-6">🍕 Connect your wallet to join the food voting!</p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-1">🍕 FHE Food Voting</h1>
        <p className="text-gray-600">Vote privately for your favorite food by country</p>
      </div>

      {/* Country Selector */}
      <div className="bg-white border p-6 rounded-2xl shadow-md w-[760px] mx-auto border-amber-200">
        <h3 className="text-lg font-bold mb-3">🌍 Select your country:</h3>

        <div className="relative w-[240px]">
          <select
            className="appearance-none w-[240px] px-5 py-3 border rounded-xl shadow-sm text-gray-800 font-medium bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-yellow-400 transition"
            value={selectedCountry}
            onChange={e => {
              setSelectedCountry(e.target.value);
              setSelectedFoodId(null);
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c.name} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-3 text-gray-400 pointer-events-none">▼</span>
        </div>
      </div>

      {/* Food Selector */}
      <div className="bg-white border p-6 rounded-2xl shadow-md w-[760px] mx-auto border-amber-200">
        <h3 className="text-lg font-bold mb-3">
          Select your favorite dish in <span className="font-semibold">{selectedCountry}</span>:
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-[700px]">
          {foods.map(food => (
            <motion.button
              key={food.id}
              disabled={voteFood.isProcessing || voteFood.canDecrypt}
              onClick={() => handleFoodClick(food.id)}
              whileHover={!(voteFood.isProcessing || voteFood.canDecrypt) ? { scale: 1.05 } : {}}
              className={`w-[160px] h-[60px] p-2 rounded-xl border shadow-sm font-medium transition
              ${selectedFoodId === food.id ? "bg-yellow-400 text-black" : "bg-gray-50 text-gray-800 hover:bg-gray-100"}
              ${voteFood.isProcessing || voteFood.canDecrypt ? "cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {food.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Encrypted Info */}
      <div className="bg-white p-6 rounded-2xl shadow-md w-[760px] mx-auto border !border-amber-200">
        <h3 className="text-lg font-bold mb-3">🔐 Encrypted Vote Info</h3>
        {printProperty("Country", selectedCountry)}
        {printProperty("Status", voteFood.canDecrypt ? "✅ Voted" : "⏳ Not yet voted")}
        {printProperty("Vote Handle", voteFood.handle ?? "—")}
        {printProperty("Decrypted Value", voteFood.isDecrypted ? String(voteFood.clear) : "Not decrypted")}
        <button
          disabled={!voteFood.canDecrypt}
          onClick={voteFood.decryptVotes}
          className={`mt-4 px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition w-[240px] ${voteFood.canDecrypt ? "cursor-pointer" : "cursor-not-allowed"}`}
        >
          🔓 Decrypt Encrypted
        </button>
      </div>

      {voteFood.message && (
        <div className="bg-gray-50 border p-4 rounded-md w-[760px] mx-auto shadow-md w-[760px] border !border-amber-200">
          <strong>Message:</strong> {voteFood.message}
        </div>
      )}

      {voteFood.isProcessing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <PuffLoader color="#FFD208" size={60} />
        </div>
      )}
    </div>
  );
};

function printProperty(name: string, value: any) {
  return (
    <div className="flex justify-between border-b py-2 text-gray-800 w-full max-w-[700px] mx-auto">
      <span>{name}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}
