interface StorageChain {
  name: string;
  type: "mainnet" | "testnet";
  gateway: string;
}

// key: {chainId}
export const storageChains = new Map<string, StorageChain>([
  [
    "11155111",
    {
      name: "Sepolia",
      type: "testnet",
      gateway: "https://sepolia.gateway.request.network/",
    },
  ],
  [
    "100",
    {
      name: "Gnosis",
      type: "mainnet",
      gateway: "https://gnosis.gateway.request.network/",
    },
  ],
]);
