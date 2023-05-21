"use client";

import "@rainbow-me/rainbowkit/styles.css";
import styles from "@/app/page.module.css";
import { useState } from "react";
import { parseUnits, zeroAddress } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useWalletClient,
  useAccount,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { currencies } from "@/config/currency";
import { storageChains } from "@/config/storage-chain";
import {
  RequestNetwork,
  Types,
  Utils,
} from "@requestnetwork/request-client.js";
import { Web3SignatureProvider } from "@requestnetwork/web3-signature";
import {
  approveErc20,
  hasErc20Approval,
  hasSufficientFunds,
  payRequest,
} from "@requestnetwork/payment-processor";
import { getPaymentNetworkExtension } from "@requestnetwork/payment-detection";
import { useEthersV5Provider } from "@/hooks/use-ethers-v5-provider";
import { useEthersV5Signer } from "@/hooks/use-ethers-v5-signer";

enum APP_STATUS {
  AWAITING_INPUT = "awaiting input",
  SUBMITTING = "submitting",
  PERSISTING_TO_IPFS = "persisting to ipfs",
  PERSISTING_ON_CHAIN = "persisting on-chain",
  REQUEST_CONFIRMED = "request confirmed",
  APPROVING = "approving",
  APPROVED = "approved",
  PAYING = "paying",
  REQUEST_PAID = "request paid",
  ERROR_OCCURRED = "error occurred",
}

export default function Home() {
  const [storageChain, setStorageChain] = useState("5");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [currency, setCurrency] = useState(
    "5_0xBA62BCfcAaFc6622853cca2BE6Ac7d845BC0f2Dc"
  );
  const [paymentRecipient, setPaymentRecipient] = useState("");
  const [payerIdentity, setPayerIdentity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(APP_STATUS.AWAITING_INPUT);
  const { data: walletClient, isError, isLoading } = useWalletClient();
  const { address, isConnecting, isDisconnected } = useAccount();
  const { chain } = useNetwork();
  const {
    chains,
    error,
    isLoading: isSwitchNetworkLoading,
    switchNetwork,
  } = useSwitchNetwork();
  const [requestData, setRequestData] =
    useState<Types.IRequestDataWithEvents>();
  const provider = useEthersV5Provider();
  const signer = useEthersV5Signer();

  async function payTheRequest() {
    const requestClient = new RequestNetwork({
      nodeConnectionConfig: {
        baseURL: storageChains.get(storageChain)!.gateway,
      },
    });

    try {
      const _request = await requestClient.fromRequestId(
        requestData!.requestId
      );
      let _requestData = _request.getData();
      const paymentTx = await payRequest(_requestData, signer);
      await paymentTx.wait(2);

      // TODO: Add Timeout
      while (_requestData.balance?.balance! < _requestData.expectedAmount) {
        _requestData = await _request.refresh();
        alert(`balance = ${_requestData.balance?.balance}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setRequestData(_requestData);
      setStatus(APP_STATUS.REQUEST_PAID);
    } catch (err) {
      setStatus(APP_STATUS.APPROVED);
      alert(err);
    }
  }

  function canPay() {
    return (
      status === APP_STATUS.APPROVED &&
      !isDisconnected &&
      !isConnecting &&
      !isError &&
      !isLoading &&
      !isSwitchNetworkLoading &&
      requestData?.currencyInfo.network === chain?.network
    );
  }

  function handlePay(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!canPay()) {
      return;
    }
    setStatus(APP_STATUS.PAYING);
    payTheRequest();
  }

  async function approve() {
    const requestClient = new RequestNetwork({
      nodeConnectionConfig: {
        baseURL: storageChains.get(storageChain)!.gateway,
      },
    });

    try {
      const _request = await requestClient.fromRequestId(
        requestData!.requestId
      );
      const _requestData = _request.getData();
      alert(`Checking if payer has sufficient funds...`);
      const _hasSufficientFunds = await hasSufficientFunds(
        _requestData,
        address as string,
        { provider: provider }
      );
      alert(`_hasSufficientFunds = ${_hasSufficientFunds}`);
      if (
        getPaymentNetworkExtension(_requestData)?.id ===
        Types.Extension.PAYMENT_NETWORK_ID.ERC20_FEE_PROXY_CONTRACT
      ) {
        alert(`ERC20 Request detected. Checking approval...`);
        const _hasErc20Approval = await hasErc20Approval(
          _requestData,
          address as string,
          provider
        );
        alert(`_hasErc20Approval = ${_hasErc20Approval}`);
        if (!_hasErc20Approval) {
          const approvalTx = await approveErc20(_requestData, signer);
          await approvalTx.wait(2);
        }
      }
      setStatus(APP_STATUS.APPROVED);
    } catch (err) {
      setStatus(APP_STATUS.REQUEST_CONFIRMED);
      alert(err);
    }
  }

  function canApprove() {
    return (
      status === APP_STATUS.REQUEST_CONFIRMED &&
      !isDisconnected &&
      !isConnecting &&
      !isError &&
      !isLoading &&
      !isSwitchNetworkLoading &&
      requestData?.currencyInfo.network === chain?.network
    );
  }

  function handleApprove(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!canApprove()) {
      return;
    }
    setStatus(APP_STATUS.APPROVING);
    approve();
  }

  async function createRequest() {
    const signatureProvider = new Web3SignatureProvider(walletClient);
    const requestClient = new RequestNetwork({
      nodeConnectionConfig: {
        baseURL: storageChains.get(storageChain)!.gateway,
      },
      signatureProvider,
    });
    const requestCreateParameters: Types.ICreateRequestParameters = {
      requestInfo: {
        currency: {
          type: currencies.get(currency)!.type,
          value: currencies.get(currency)!.value,
          network: currencies.get(currency)!.network,
        },
        expectedAmount: parseUnits(
          expectedAmount as `${number}`,
          currencies.get(currency)!.decimals
        ).toString(),
        payee: {
          type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
          value: address as string,
        },
        timestamp: Utils.getCurrentTimestampInSecond(),
      },
      paymentNetwork: {
        id: Types.Extension.PAYMENT_NETWORK_ID.ERC20_FEE_PROXY_CONTRACT,
        parameters: {
          paymentNetworkName: currencies.get(currency)!.network,
          paymentAddress: paymentRecipient || address,
          feeAddress: zeroAddress,
          feeAmount: "0",
        },
      },
      contentData: {
        // Tip: Consider using rnf_invoice v0.0.3 format from @requestnetwork/data-format
        reason: reason,
        dueDate: dueDate,
      },
      signer: {
        type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
        value: address as string,
      },
    };

    if (payerIdentity.length > 0) {
      requestCreateParameters.requestInfo.payer = {
        type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
        value: payerIdentity,
      };
    }

    try {
      setStatus(APP_STATUS.PERSISTING_TO_IPFS);
      const request = await requestClient.createRequest(
        requestCreateParameters
      );

      setStatus(APP_STATUS.PERSISTING_ON_CHAIN);
      setRequestData(request.getData());
      const confirmedRequestData = await request.waitForConfirmation();

      setStatus(APP_STATUS.REQUEST_CONFIRMED);
      setRequestData(confirmedRequestData);
    } catch (err) {
      setStatus(APP_STATUS.ERROR_OCCURRED);
      alert(err);
    }
  }

  function canSubmit() {
    return (
      status !== APP_STATUS.SUBMITTING &&
      !isDisconnected &&
      !isConnecting &&
      !isError &&
      !isLoading &&
      storageChain.length > 0 &&
      // Payment Recipient is empty || isAddress
      (paymentRecipient.length === 0 ||
        (paymentRecipient.startsWith("0x") &&
          paymentRecipient.length === 42)) &&
      // Payer is empty || isAddress
      (payerIdentity.length === 0 ||
        (payerIdentity.startsWith("0x") && payerIdentity.length === 42)) &&
      expectedAmount.length > 0 &&
      currency.length > 0
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit()) {
      return;
    }
    setRequestData(undefined);
    setStatus(APP_STATUS.SUBMITTING);
    createRequest();
  }

  function handleClear(_: React.MouseEvent<HTMLButtonElement>) {
    setRequestData(undefined);
    setStatus(APP_STATUS.AWAITING_INPUT);
  }

  return (
    <div>
      <h3>Pay a request</h3>
      <ul>
        <li>
          &#8226; This demo creates and pays an unencrypted ERC20 request.
        </li>
        <li>
          &#8226; The code is intentionally simple with minimal dependencies.
        </li>
        <li>&#8226; Input fields annotated with a * are required.</li>
      </ul>
      <br></br>
      <h4>Create a request</h4>
      <form onSubmit={handleSubmit}>
        <label>Payee Identity*</label>
        <ConnectButton chainStatus="none" showBalance={false} />
        <p className={styles.text_sm}>
          The identity address of the Payee. Creating a request requires a
          signature from either the Payee Identity or Payer Identity. This demo
          only supports signing with the Payee Identity. {styles.w_96}
        </p>
        <br></br>
        <label>
          Storage Chain *
          <div>
            <select
              name="storage-chain"
              onChange={(e) => setStorageChain(e.target.value)}
              defaultValue={storageChain}
              className={styles.h9_w96}
            >
              {Array.from(storageChains.entries()).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name} ({value.type})
                </option>
              ))}
            </select>
            <p className={styles.text_sm}>
              A hash of the request contents (IPFS CID) is stored on the Storage
              Chain regardless of the selected Currency and Payment Chain.
            </p>
          </div>
        </label>
        <br></br>
        <label>
          Amount *
          <div>
            <input
              type="number"
              name="expected-amount"
              step="any"
              onChange={(e) => setExpectedAmount(e.target.value)}
              className={styles.h9_w96}
            />
            <p className={styles.text_sm}>
              The requested amount in human-readable units. This demo uses
              viem&apos;s parseUnits function to convert to EVM-compatible
              units, respecting the token&apos;s decimals.
            </p>
          </div>
        </label>
        <br></br>
        <label>
          Currency *
          <div>
            <select
              name="currency"
              onChange={(e) => setCurrency(e.target.value)}
              defaultValue={currency}
              className={styles.h9_w96}
            >
              {Array.from(currencies.entries()).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.symbol} ({value.network})
                </option>
              ))}
            </select>
            <p className={styles.text_sm}>
              The requested currency. This determines the Payment Chain.
            </p>
          </div>
        </label>
        <br></br>
        <label>
          Payment Recipient
          <div>
            <input
              type="text"
              name="payment-recipient"
              placeholder={address}
              onChange={(e) => setPaymentRecipient(e.target.value)}
              className={styles.h9_w96}
            />
            <p className={styles.text_sm}>
              The address that will receive the payment. If not specfied,
              defaults to the Payee Identity.
            </p>
          </div>
        </label>
        <br></br>
        <label>
          Payer Identity
          <div>
            <input
              type="text"
              name="payer-identity"
              placeholder="0x..."
              onChange={(e) => setPayerIdentity(e.target.value)}
              className={styles.h9_w96}
            />
            <p className={styles.text_sm}>
              The identity address of the Payer. The Payer will see this request
              the next time they query requests associated with their identity.
              A request without a Payer Identity can be paid by any identity but
              requires an out-of-band notification to notify the Payer.
            </p>
          </div>
        </label>
        <br></br>
        <label>
          Due Date
          <div>
            <input
              type="date"
              name="due-date"
              onChange={(e) => setDueDate(e.target.value)}
              className={styles.h9_w96}
            />
          </div>
          <p className={styles.text_sm}>
            The date by which the request should be paid. Due Date is stored in
            the contentData of the request. For a standardized invoice schema,
            consider using rnf_invoice format from @requestnetwork/data-format
          </p>
        </label>
        <br></br>
        <label>
          Reason
          <div>
            <input
              type="text"
              name="reason"
              onChange={(e) => setReason(e.target.value)}
              className={styles.h9_w96}
            />
          </div>
          <p className={styles.text_sm}>
            The reason for the request. Reason is stored in the contentData of
            the request. For a standardized invoice schema, consider using
            rnf_invoice format from @requestnetwork/data-format
          </p>
        </label>
        <br></br>
        <button type="submit" disabled={!canSubmit()} className={styles.h9_w24}>
          Submit
        </button>
      </form>
      <br></br>
      <h4>Pay a request</h4>
      <br></br>
      <ConnectButton showBalance={false} />
      <br></br>
      <button
        disabled={
          !switchNetwork ||
          !requestData ||
          requestData?.currencyInfo.network === chain?.network
        }
        onClick={() =>
          switchNetwork?.(
            chains.find(
              (chain) => chain.network === requestData?.currencyInfo.network
            )?.id
          )
        }
        className={styles.h9_w96}
      >
        Switch to Payment Chain: {requestData?.currencyInfo.network}
        {isSwitchNetworkLoading && " (switching)"}
      </button>
      <br></br>
      <br></br>
      <button
        type="button"
        disabled={!canApprove()}
        onClick={handleApprove}
        className={styles.h9_w24}
      >
        Approve
      </button>
      <br></br>
      <div>
        {!switchNetwork &&
          "Programmatic switch network not supported by wallet."}
      </div>
      <div>{error && error.message}</div>
      <br></br>
      <button
        type="button"
        onClick={handlePay}
        disabled={!canPay()}
        className={styles.h9_w24}
      >
        Pay now
      </button>
      <br></br>
      <br></br>
      <h4>Request info</h4>
      <br></br>
      <button type="button" onClick={handleClear} className={styles.h9_w24}>
        Clear
      </button>
      <p>App status: {status}</p>
      <p>Request state: {requestData?.state}</p>
      <pre>{JSON.stringify(requestData, undefined, 2)}</pre>
    </div>
  );
}
