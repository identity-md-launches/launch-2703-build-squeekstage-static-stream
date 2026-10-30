import { useEffect, useRef, useState } from "react";
import { Icon } from "./components/Art";
import { ConnectButton } from "./components/Connect";
import { Home, TipPage, SetupPage, StagePage, AboutPage } from "./pages";
import { Stage } from "./stage";

export default function App() {
  const [route, setRoute] = useState(
    () => location.hash.split("?")[0].replace(/^#\/?/, "") || "",
  );
  const main = useRef<HTMLElement>(null);
  const initial = useRef(true);
  useEffect(() => {
    const change = () =>
      setRoute(location.hash.split("?")[0].replace(/^#\/?/, "") || "");
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const obs =
    route === "stage" &&
    (params.get("obs") === "1" || hashParams.get("obs") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("obs", obs);
    const titles: Record<string, string> = {
      "": "Small paws. Real blocks.",
      stage: "Live stage",
      tip: "Tip the stream",
      setup: "Stream setup",
      about: "About",
    };
    document.title = `SqueekStage · ${titles[route] ?? "Page not found"}`;
    if (!initial.current) {
      main.current?.focus();
      window.scrollTo(0, 0);
    }
    initial.current = false;
  }, [route, obs]);
  if (obs) return <Stage />;
  const nav = [
    ["", "Overview"],
    ["stage", "Stage"],
    ["tip", "Tip"],
    ["setup", "Setup"],
  ];
  const pages: Record<string, React.ReactNode> = {
    "": <Home />,
    stage: <StagePage />,
    tip: <TipPage />,
    setup: <SetupPage />,
    about: <AboutPage />,
  };
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="SqueekStage home">
            <img
              width="36"
              height="36"
              alt=""
              src={`${import.meta.env.BASE_URL}favicon.svg`}
            />
            <span>
              Squeek<span className="brand-light">Stage</span>
            </span>
          </a>
          <nav aria-label="Primary">
            {nav.map(([path, name]) => (
              <a
                key={path}
                href={`#/${path}`}
                className={route === path ? "active" : ""}
                aria-current={route === path ? "page" : undefined}
              >
                {name}
              </a>
            ))}
          </nav>
          <div className="header-wallet">
            <span className="header-network">
              <span className="diamond" />
              Sepolia
            </span>
            <ConnectButton />
          </div>
        </div>
      </header>
      <main
        ref={main}
        id="main-content"
        tabIndex={-1}
        className="page-container"
      >
        {pages[route] ?? (
          <div className="not-found">
            <h1>This stage is empty.</h1>
            <p>The page you opened isn’t here.</p>
            <a href="#/" className="button primary">
              Open overview
              <Icon name="right" />
            </a>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <a href="#/" className="footer-brand">
            SqueekStage
          </a>
          <span>One hamster. Every block.</span>
        </div>
        <div>
          <span className="footer-network">
            <span className="tiny-dot live" />
            Built for Squeekchain
          </span>
          <a href="#/about">
            About & data
            <Icon name="arrow" size={14} />
          </a>
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noreferrer"
          >
            Sepolia explorer
            <Icon name="arrow" size={14} />
          </a>
        </div>
      </footer>
    </>
  );
}
