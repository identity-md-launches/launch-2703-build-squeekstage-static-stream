import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  type Connector,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { friendlyError, short } from "../lib/format";
import { OPEN_IN } from "../lib/wallet";
import { Icon } from "./Art";

const WalletContext = createContext({
  openWallet: () => {},
  switchNetwork: async () => {},
});
export const useWalletUI = () => useContext(WalletContext);
export function WalletUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const { isConnected, connector } = useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const dialog = useRef<HTMLDialogElement>(null);
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected") &&
    !(window as any).ethereum;
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  async function switchNetwork() {
    if (!connector) return;
    try {
      const provider = (await connector.getProvider()) as {
        request: (args: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      };
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (e) {
        if ((e as { code: number }).code !== 4902) throw e;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: sepolia.name,
              nativeCurrency: sepolia.nativeCurrency,
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      }
    } catch (e) {
      setError(friendlyError(e));
      setOpen(true);
      throw e;
    }
  }
  async function choose(c: Connector) {
    setError("");
    if (c.id === "injected" && !(await c.getProvider())) {
      setError(
        "No browser wallet was found. Install a wallet extension, or choose Coinbase Wallet.",
      );
      return;
    }
    try {
      await connect.mutateAsync({ connector: c });
      setOpen(false);
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK" && mobile
        ? "Coinbase Smart Wallet"
        : c.name;
  const mark = (c: Connector) =>
    c.icon ??
    (c.id === "coinbaseWalletSDK"
      ? `${import.meta.env.BASE_URL}wallets/coinbase.svg`
      : undefined);
  return (
    <WalletContext
      value={{
        openWallet: () => {
          setError("");
          setOpen(true);
        },
        switchNetwork,
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className="wallet-sheet"
        aria-labelledby="wallet-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = [
            ...e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href],input:not(:disabled)",
            ),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sheet-content">
          <div className="section-head">
            <h2 id="wallet-title">Connect a wallet</h2>
            <button
              className="icon-button"
              aria-label="Close wallet picker"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <p className="muted">Use a wallet on Ethereum Sepolia.</p>
          {mobile &&
            OPEN_IN.map((wallet) => (
              <a
                className="wallet-row"
                key={wallet.id}
                href={wallet.href(location.href)}
              >
                <img
                  width="28"
                  height="28"
                  alt=""
                  src={`${import.meta.env.BASE_URL}wallets/${wallet.id}.svg`}
                />
                <span>Open in {wallet.name}</span>
                <Icon name="arrow" />
              </a>
            ))}
          {listed.map((c) => (
            <button
              className="wallet-row"
              key={c.uid}
              disabled={connect.isPending}
              onClick={() => choose(c)}
            >
              {mark(c) ? (
                <img width="28" height="28" src={mark(c)} alt="" />
              ) : (
                <Icon name="wallet" size={28} />
              )}
              <span>
                {label(c)}
                {connect.isPending && connect.variables?.connector === c
                  ? " · Opening…"
                  : ""}
              </span>
              <Icon name="chevron" />
            </button>
          ))}
          <div role="status" className="form-message error">
            {error}
          </div>
          <p className="sheet-note">
            <Icon name="shield" size={16} /> You control every transaction.
          </p>
        </div>
      </dialog>
    </WalletContext>
  );
}
export function ConnectButton() {
  const { address, isConnected, chainId } = useConnection();
  const disconnect = useDisconnect();
  const { openWallet, switchNetwork } = useWalletUI();
  if (isConnected && chainId !== sepolia.id)
    return (
      <button
        className="button small"
        onClick={() => void switchNetwork().catch(() => {})}
      >
        Switch to Sepolia
      </button>
    );
  if (isConnected && address)
    return (
      <button
        className="button wallet-control"
        onClick={() => disconnect.mutate()}
        aria-label={`${short(address)}, disconnect wallet`}
      >
        <span className="connection-dot" />
        {short(address)}
        <span className="disconnect-label"> · Disconnect</span>
      </button>
    );
  return (
    <button className="button wallet-control" onClick={openWallet}>
      <Icon name="wallet" size={18} />
      <span>Connect</span>
    </button>
  );
}
