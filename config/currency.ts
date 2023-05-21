import { Types } from "@requestnetwork/request-client.js";

// Tip: For more advanced currency managment, use CurrencyManager from @requestnetwork/currency

interface ICurrency extends Types.RequestLogic.ICurrency {
  name: string;
  symbol: string;
  chainId: number;
  decimals: number;
}

// key: {chainId}_{checksummedAddress}
export const currencies = new Map<string, ICurrency>([
  [
    "5_0xBA62BCfcAaFc6622853cca2BE6Ac7d845BC0f2Dc",
    {
      name: "FaucetToken",
      symbol: "FAU",
      value: "0xBA62BCfcAaFc6622853cca2BE6Ac7d845BC0f2Dc",
      chainId: 5,
      network: "goerli",
      decimals: 18,
      type: Types.RequestLogic.CURRENCY.ERC20,
    },
  ],
  [
    "5_0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    {
      name: "USD Coin",
      symbol: "USDC",
      value: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
      chainId: 5,
      network: "goerli",
      decimals: 18,
      type: Types.RequestLogic.CURRENCY.ERC20,
    },
  ],
]);
