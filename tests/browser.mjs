import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { previewServer } from "./preview-server.mjs";

const output = "test/scratch/interaction";
await mkdir(output, { recursive: true });
const { server, url } = await previewServer();
const results = [];
// All synthetic identities and log data below are test fixtures, never runtime defaults.
const sender = "0x" + "11".repeat(20);
const recipient = "0x" + "22".repeat(20);
const token = "0x" + "33".repeat(20);
const txHash = "0x" + "44".repeat(32);
const blockHash = "0x" + "55".repeat(32);
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topic = (address) => "0x" + address.slice(2).padStart(64, "0");
const fixtures = {
  core: {
    chain: { chainId: "11155111" },
    core: {
      blockHeight: "4135",
      blockProgress: "35822082",
      settledThroughRound: "540",
    },
    configuration: {
      blockUnitsPerBlock: "1000000000",
      genesisTimestamp: String(Math.floor(Date.now() / 1000) - 180),
      roundDuration: "600",
    },
  },
  "economy/state": {
    chain: { chainId: "11155111" },
    asset: { address: token, symbol: "SQK", decimals: 18 },
    staking: { totalStakedBaseUnits: "120000000000000000000" },
    supply: { liveSupplyBaseUnits: "5000000000000000000000" },
    lifecycle: { currentRound: "541" },
  },
  "measurement/stats": {
    lifetime: {
      observedDistanceMm: "40350246",
      acceptedWorkUnits: "45957",
      settlementCount: "497",
      activeDayCount: 4,
    },
  },
  status: { measurement: { freshness: "online" } },
  events: {
    events: Array.from({ length: 10 }, (_, i) => ({
      id: "fixture-event-" + i,
      type: i % 2 ? "account.rewards_claimed" : "system.settlement_completed",
      occurredAt: new Date(Date.now() - i * 60000).toISOString(),
      source: { transactionHash: txHash },
      payload: { throughRound: String(540 - i) },
    })),
  },
};

async function fixtureRoutes(context) {
  const state = {
    apiFailure: false,
    balance: 100n * 10n ** 18n,
    logs: [],
    head: 12006000,
    requests: [],
  };
  await context.route("https://api.squeekchain.com/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/v1/", "");
    if (state.apiFailure) return route.fulfill({ status: 503, body: "{}" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures[path]),
    });
  });
  for (const pattern of [
    "https://ethereum-sepolia-rpc.publicnode.com/**",
    "https://1rpc.io/sepolia**",
  ]) {
    await context.route(pattern, async (route) => {
      const body = route.request().postDataJSON();
      state.requests.push(body);
      let result;
      if (body.method === "eth_chainId") result = "0xaa36a7";
      else if (body.method === "eth_blockNumber")
        result = "0x" + state.head.toString(16);
      else if (body.method === "eth_call")
        result = "0x" + state.balance.toString(16);
      else if (body.method === "eth_getLogs") {
        const filter = body.params[0];
        const from = parseInt(filter.fromBlock, 16),
          to = parseInt(filter.toBlock, 16);
        assert.ok(
          to - from < 2000,
          "RPC chunk must contain no more than 2,000 blocks",
        );
        assert.equal(filter.address.toLowerCase(), token);
        assert.equal(filter.topics[0], transferTopic);
        assert.equal(filter.topics[2], topic(recipient));
        result = state.logs.filter(
          (l) =>
            parseInt(l.blockNumber, 16) >= from &&
            parseInt(l.blockNumber, 16) <= to,
        );
      } else if (body.method === "eth_getTransactionReceipt")
        result = { status: "0x1", transactionHash: txHash };
      else throw new Error("Unexpected read method: " + body.method);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      });
    });
  }
  return state;
}
async function mockWallet(context) {
  await context.addInitScript(
    ({ sender, txHash }) => {
      const listeners = new Map();
      window.__wallet = {
        chain: "0xaa36a7",
        reject: false,
        authorized: false,
        writes: [],
        switches: [],
      };
      const provider = {
        on(event, fn) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(fn);
        },
        removeListener(event, fn) {
          listeners.get(event)?.delete(fn);
        },
        async request({ method, params }) {
          if (method === "eth_chainId") return window.__wallet.chain;
          if (method === "eth_requestAccounts") {
            window.__wallet.authorized = true;
            return [sender];
          }
          if (method === "eth_accounts")
            return window.__wallet.authorized ? [sender] : [];
          if (method === "net_version")
            return String(parseInt(window.__wallet.chain, 16));
          if (
            method === "wallet_requestPermissions" ||
            method === "wallet_getPermissions"
          )
            return [
              {
                parentCapability: "eth_accounts",
                caveats: [
                  { type: "restrictReturnedAccounts", value: [sender] },
                ],
              },
            ];
          if (method === "wallet_switchEthereumChain") {
            window.__wallet.switches.push(params);
            window.__wallet.chain = params[0].chainId;
            for (const listener of listeners.get("chainChanged") ?? [])
              listener(params[0].chainId);
            return null;
          }
          if (method === "eth_sendTransaction") {
            if (window.__wallet.reject) {
              const e = new Error("User rejected the request");
              e.code = 4001;
              throw e;
            }
            window.__wallet.writes.push(params[0]);
            return txHash;
          }
          if (method === "wallet_revokePermissions") return null;
          throw new Error("Unexpected wallet method: " + method);
        },
      };
      window.ethereum = provider;
      const info = {
        uuid: "12345678-1234-4234-8234-123456789012",
        name: "Test browser wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="blue"/></svg>',
        rdns: "test.squeekstage.wallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: { info, provider },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { sender, txHash },
  );
}
async function run(name, fn) {
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({
      name,
      passed: true,
      durationMs: Date.now() - start,
      detail,
    });
    console.log("PASS", name, detail ?? "");
  } catch (e) {
    results.push({
      name,
      passed: false,
      durationMs: Date.now() - start,
      error: e.message,
    });
    console.error("FAIL", name, e.stack);
  }
}
for (const [engine, type] of [
  ["Chromium", chromium],
  ["WebKit", webkit],
]) {
  let browser;
  try {
    browser = await type.launch({ headless: true });
  } catch (e) {
    results.push({
      name: `${engine} availability`,
      passed: null,
      limitation:
        "Browser runtime could not start; rendered and interaction checks for this engine were not performed.",
    });
    console.log("UNPERFORMED", engine, e.message.split("\n")[0]);
    continue;
  }
  try {
    await run(
      `${engine}: mobile first screen, all routes, and reflow`,
      async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await fixtureRoutes(context);
        const page = await context.newPage();
        const errors = [];
        const failed = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("response", (r) => {
          if (r.url().startsWith(url) && r.status() >= 400)
            failed.push(r.url());
        });
        const start = Date.now();
        await page.goto(url);
        await page.getByText("4,135", { exact: true }).waitFor();
        const visibleAt = Date.now() - start;
        assert.ok(visibleAt < 2000, `Fixture numbers took ${visibleAt}ms`);
        assert.ok(
          (
            await page
              .getByRole("link", { name: "Send a tip", exact: true })
              .boundingBox()
          ).y < 500,
        );
        await page.screenshot({
          path: `${output}/${engine.toLowerCase()}-390.png`,
          fullPage: true,
        });
        for (const width of [320, 390, 740, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          for (const route of ["", "tip", "setup", "stage", "about"]) {
            await page.goto(url + "#/" + route);
            await page.locator("main").waitFor();
            await page.evaluate(() => document.fonts.ready);
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `Overflow on ${route || "home"} at ${width}`,
            );
          }
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(failed, []);
        await context.close();
        return {
          fixtureFirstNumberMs: visibleAt,
          widths: [320, 390, 740, 1440],
          routes: 5,
          scriptErrors: 0,
          failedLocalResources: 0,
        };
      },
    );
    await run(
      `${engine}: setup validation, persistence, links, demo, and keyboard dialog`,
      async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await fixtureRoutes(context);
        const page = await context.newPage();
        await page.goto(url + "#/setup");
        await page.getByLabel("Streamer wallet", { exact: false }).fill("bad");
        await page.getByRole("button", { name: "Save settings" }).click();
        await page
          .getByText(
            "Enter a valid Ethereum receiving address, or leave it blank to preview.",
          )
          .waitFor();
        assert.equal(
          await page
            .locator("#streamer")
            .evaluate((el) => el === document.activeElement),
          true,
          "Invalid recipient should receive focus",
        );
        await page.locator("#streamer").fill(recipient);
        await page.locator("#accent").fill("#000000");
        await page.getByRole("button", { name: "Save settings" }).click();
        await page
          .getByText(
            "Choose a brighter accent colour so text is readable on dark panels.",
          )
          .waitFor();
        await page.locator("#accent").fill("#f2c230");
        await page.locator("#threshold").fill("5");
        await page.locator("#demo").check();
        await page.getByRole("button", { name: "Save settings" }).click();
        await page.getByText("Settings saved. Your links are ready.").waitFor();
        const link = await page.getByLabel("OBS overlay URL").inputValue();
        assert.ok(
          link.includes("obs=1") &&
            link.includes("threshold=5") &&
            link.includes("demo=1") &&
            link.includes(recipient),
        );
        if (engine === "Chromium") {
          await context.grantPermissions(["clipboard-read", "clipboard-write"]);
          await page
            .getByRole("button", { name: "Copy", exact: true })
            .first()
            .click();
          await page
            .getByRole("button", { name: "Copied", exact: true })
            .waitFor();
          assert.equal(
            await page.evaluate(() => navigator.clipboard.readText()),
            link,
          );
        }
        await page.reload();
        assert.equal(await page.locator("#streamer").inputValue(), recipient);
        assert.equal(
          await page.locator("#demo").isChecked(),
          true,
          "Demo persists after reload",
        );
        await page.goto(url + "#/tip");
        assert.equal(
          await page.getByRole("button", { name: "Send 1 SQK" }).isDisabled(),
          true,
        );
        await page.goto(url + "#/stage");
        const rounds = await page
          .locator(".stage-round strong")
          .allTextContents();
        assert.ok(
          Number(rounds[0].replaceAll(",", "")) >
            Number(rounds[1].replaceAll(",", "")),
          "Demo current round follows its simulated settled round",
        );
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor();
        assert.equal(
          await page
            .locator("dialog")
            .evaluate((el) => el.contains(document.activeElement)),
          true,
          "Opening dialog should move focus inside",
        );
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator("dialog")
              .evaluate((el) => el.contains(document.activeElement)),
            true,
            `Tab ${i} should stay in dialog`,
          );
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await context.close();
        return "Invalid address focuses field; settings persist and travel in URL; demo blocks writes; native dialog traps/restores focus.";
      },
    );
    await run(
      `${engine}: mobile wallet entry points and missing-extension recovery`,
      async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        });
        await fixtureRoutes(context);
        const page = await context.newPage();
        await page.goto(url + "#/tip");
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
        for (const name of [
          "MetaMask",
          "Coinbase Wallet",
          "Rabby",
          "Phantom",
        ]) {
          const link = page.getByRole("link", {
            name: "Open in " + name,
            exact: true,
          });
          await link.waitFor();
          assert.ok((await link.getAttribute("href")).startsWith("https://"));
          if (name === "Rabby") {
            const target = new URL(await link.getAttribute("href"));
            assert.equal(target.searchParams.get("_cmd"), "open-dapp");
            assert.equal(target.searchParams.get("dapp"), url + "#/tip");
          }
          assert.equal(
            await link
              .locator("img")
              .evaluate((img) => img.complete && img.naturalWidth > 0),
            true,
          );
        }
        await page
          .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Browser wallet", exact: true })
            .count(),
          0,
        );
        await context.close();
        const desktop = await browser.newContext();
        await fixtureRoutes(desktop);
        const desk = await desktop.newPage();
        await desk.goto(url);
        await desk
          .getByRole("button", { name: "Connect", exact: true })
          .click();
        await desk
          .getByRole("button", { name: "Browser wallet", exact: true })
          .click();
        await desk
          .getByText(
            "No browser wallet was found. Install a wallet extension, or choose Coinbase Wallet.",
          )
          .waitFor();
        await desktop.close();
        return "All four mobile links and local wallet marks present; Coinbase Smart Wallet offered; missing extension gives a recovery path.";
      },
    );
    await run(
      `${engine}: discovered wallet, low balance, rejection, switch, and transfer`,
      async () => {
        const context = await browser.newContext();
        const state = await fixtureRoutes(context);
        await mockWallet(context);
        const page = await context.newPage();
        await page.goto(url + "?streamer=" + recipient + "#/tip");
        await page.waitForFunction(() =>
          localStorage.getItem("squeekstage:api:v2:status"),
        );
        await page
          .getByRole("button", { name: "Connect", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Browser wallet", exact: true })
            .count(),
          0,
        );
        await page.getByRole("button", { name: "Test browser wallet" }).click();
        await page.getByText("Balance: 100.00 SQK").waitFor();
        await page.getByRole("button", { name: "25", exact: true }).click();
        assert.equal(await page.locator("#tip-amount").inputValue(), "25");
        await page.locator("#tip-amount").fill("101");
        await page.getByRole("button", { name: "Send 101 SQK" }).click();
        await page.getByText(/Not enough SQK/).waitFor();
        assert.equal(
          await page.evaluate(() => window.__wallet.writes.length),
          0,
        );
        await page.locator("#tip-amount").fill("1");
        await page.evaluate(() => {
          window.__wallet.reject = true;
        });
        await page.getByRole("button", { name: "Send 1 SQK" }).click();
        await page.getByText(/Request declined in your wallet/).waitFor();
        assert.equal(
          await page.evaluate(() => window.__wallet.writes.length),
          0,
        );
        await page.evaluate(() => {
          window.__wallet.reject = false;
        });
        // Reload retains the discovered connection and picks up an initially wrong wallet chain.
        await page.evaluate(() =>
          window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x1" }],
          }),
        );
        await page
          .getByRole("button", { name: "Switch to Sepolia", exact: true })
          .first()
          .waitFor();
        assert.equal(
          await page.getByRole("button", { name: "Send 1 SQK" }).isDisabled(),
          true,
        );
        await page
          .getByRole("button", { name: "Switch to Sepolia", exact: true })
          .first()
          .click();
        await page.getByText("Balance: 100.00 SQK").waitFor();
        await page.getByRole("button", { name: "Send 1 SQK" }).click();
        await page.getByText("Tip confirmed. Thank you!").waitFor();
        const writes = await page.evaluate(() => window.__wallet.writes);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].to, token);
        assert.equal(writes[0].from.toLowerCase(), sender);
        assert.equal(writes[0].value, "0x0");
        assert.equal(writes[0].chainId, "0xaa36a7");
        assert.equal(writes[0].data.slice(0, 10), "0xa9059cbb");
        assert.equal(
          writes[0].data.slice(10, 74),
          recipient.slice(2).padStart(64, "0"),
        );
        assert.equal(BigInt("0x" + writes[0].data.slice(74)), 10n ** 18n);
        assert.equal(
          await page
            .getByRole("link", { name: "View transaction", exact: true })
            .getAttribute("href"),
          "https://sepolia.etherscan.io/tx/" + txHash,
        );
        await context.close();
        return {
          discoveredWallet: true,
          lowBalanceGuard: true,
          rejection4001: true,
          networkSwitch: true,
          exactTransferWrites: 1,
          receiptConfirmed: true,
        };
      },
    );
    await run(
      `${engine}: initial history, incremental log alerts, threshold, and maximum four`,
      async () => {
        const context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
        });
        const state = await fixtureRoutes(context);
        const page = await context.newPage();
        await page.goto(
          url + "?streamer=" + recipient + "&threshold=1&obs=1#/stage",
        );
        await page.getByText("Live", { exact: true }).waitFor();
        await page.waitForFunction(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((r) => r.name.includes("publicnode")).length >= 4,
        );
        assert.equal(await page.locator(".tip-alert").count(), 0);
        const initialScans = state.requests.filter(
          (r) => r.method === "eth_getLogs",
        );
        assert.equal(initialScans.length, 3);
        for (let i = 0; i < 6; i++)
          state.logs.push({
            address: token,
            topics: [transferTopic, topic(sender), topic(recipient)],
            data:
              "0x" +
              (
                BigInt(i === 0 ? 0 : i) * 10n ** 18n +
                (i === 0 ? 1n : 0n)
              ).toString(16),
            blockNumber: "0x" + (state.head + 1).toString(16),
            blockHash,
            transactionHash: "0x" + String(i + 1).repeat(64),
            logIndex: "0x" + i.toString(16),
          });
        state.head++;
        await page.locator(".tip-alert").nth(3).waitFor({ timeout: 15000 });
        assert.equal(await page.locator(".tip-alert").count(), 4);
        assert.equal(
          await page.locator(".tip-alert").filter({ hasText: "+0.00" }).count(),
          0,
        );
        const scans = state.requests.filter((r) => r.method === "eth_getLogs");
        assert.ok(
          parseInt(scans.at(-1).params[0].toBlock, 16) -
            parseInt(scans.at(-1).params[0].fromBlock, 16) <
            20,
        );
        assert.equal(
          await page.evaluate(
            () => getComputedStyle(document.documentElement).backgroundColor,
          ),
          "rgba(0, 0, 0, 0)",
        );
        assert.equal(await page.locator(".site-header").count(), 0);
        await page.screenshot({
          path: `${output}/${engine.toLowerCase()}-obs-1920.png`,
          omitBackground: true,
        });
        await page.setViewportSize({ width: 1280, height: 720 });
        assert.ok(
          await page
            .locator(".stage-block")
            .evaluate(
              (el) =>
                el.getBoundingClientRect().bottom <
                document.querySelector(".stage-bottom").getBoundingClientRect()
                  .top -
                  8,
            ),
          "Overlay statistics must not overlap the wheel panel at 720p",
        );
        assert.ok(
          await page
            .locator(".tip-alerts")
            .evaluate(
              (el) =>
                el.getBoundingClientRect().bottom <=
                document.querySelector(".stage-bottom").getBoundingClientRect()
                  .top -
                  8,
            ),
          "Tip alerts need a visible gap above the 720p statistics strip",
        );
        await page.screenshot({
          path: `${output}/${engine.toLowerCase()}-obs-720.png`,
          omitBackground: true,
        });
        // Re-use the same feed for both the rankings and recent transfer list.
        await page.goto(url + "?streamer=" + recipient + "#/tip");
        await page.locator(".recent-tips li").first().waitFor();
        assert.equal(await page.locator(".recent-tips li").count(), 6);
        assert.equal(await page.locator(".leaderboard li").count(), 1);
        assert.ok(
          await page
            .locator(".leaderboard")
            .innerText()
            .then((t) => t.includes("15.00")),
        );
        await context.close();
        return {
          initialChunks: 3,
          boundedIncrementalScan: true,
          alerts: 4,
          thresholdApplied: true,
          obsTransparent: true,
          viewports: ["1920×1080", "1280×720"],
          recentTips: 6,
          sameLogLeaderboardTotal: "15 SQK",
        };
      },
    );
    await run(
      `${engine}: retained snapshot, source failure, accessibility scan and reduced motion`,
      async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          reducedMotion: "reduce",
        });
        const state = await fixtureRoutes(context);
        const page = await context.newPage();
        await page.goto(url);
        await page.getByText("Live", { exact: true }).waitFor();
        state.apiFailure = true;
        await page
          .getByText("Stale", { exact: true })
          .waitFor({ timeout: 10000 });
        assert.equal(await page.locator(".block-number").innerText(), "4,135");
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        state.apiFailure = false;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.getByText("Live", { exact: true }).waitFor();
        assert.equal(
          await page
            .locator(".hamster-run")
            .evaluate((el) => getComputedStyle(el).animationName),
          "none",
        );
        const scans = [];
        for (const route of ["", "tip", "setup", "stage", "about"]) {
          await page.goto(url + "#/" + route);
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          scans.push({
            route: route || "overview",
            violations: result.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target),
            })),
          });
        }
        await writeFile(
          `${output}/${engine.toLowerCase()}-axe.json`,
          JSON.stringify(scans, null, 2),
        );
        assert.equal(
          scans.reduce((n, s) => n + s.violations.length, 0),
          0,
          JSON.stringify(scans),
        );
        await context.close();
        return {
          retainedValue: "4,135",
          retryRecovery: true,
          reducedMotion: true,
          axeRoutes: 5,
          violations: 0,
        };
      },
    );
  } finally {
    await browser.close();
  }
}
await new Promise((done) => server.close(done));
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
if (results.some((r) => r.passed === false)) process.exitCode = 1;
