interface StorageChain {
  name: string;
  type: "mainnet" | "testnet";
  gateway: string;
}

// key: {chainId}
export const storageChains = new Map<string, StorageChain>([
  [
    "5",
    {
      name: "Goerli",
      type: "testnet",
      gateway: "https://goerli.gateway.request.network/",
    },
  ],
  [
    "100",
    {
      name: "Gnosis",
      type: "mainnet",
      gateway: "https://xdai.gateway.request.network/",
    },
  ],
]);
