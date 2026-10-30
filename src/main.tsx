import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { walletConfig } from "./lib/wallet";
import { SettingsProvider } from "./lib/settings";
import { FeedProvider } from "./lib/data";
import { TipsProvider } from "./lib/tips";
import { WalletUIProvider } from "./components/Connect";
import App from "./App";
import "./style.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>The stage couldn’t load.</h1>
        <p>Reload to try again.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload SqueekStage
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <FeedProvider>
            <TipsProvider>
              <WalletUIProvider>
                <App />
              </WalletUIProvider>
            </TipsProvider>
          </FeedProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ErrorBoundary>,
);
