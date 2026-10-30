import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { previewServer } from "./preview-server.mjs";

const { server, url } = await previewServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const result = {
  checkedAt: new Date().toISOString(),
  environment: "production export at a local subpath",
  source: "unmodified public API and public Sepolia RPC",
  observations: {},
};
try {
  const errors = [],
    failedLocal = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      failedLocal.push(r.url().replace(url, "./"));
  });
  const started = Date.now();
  await page.goto(url);
  await page.waitForFunction(
    () =>
      /^\d/.test(document.querySelector(".block-number")?.textContent ?? ""),
    { timeout: 10000 },
  );
  const firstNumberMs = Date.now() - started;
  await page.getByText("Live", { exact: true }).waitFor({ timeout: 15000 });
  const fullLiveMs = Date.now() - started;
  await page.evaluate(() => document.fonts.ready);
  result.observations = {
    firstNumberMs,
    fullLiveMs,
    liveWithinTwoSeconds: fullLiveMs < 2000,
    status: await page.locator(".status-pill").innerText(),
    metricsPresent: await page.locator(".metric").count(),
    fonts: await page.evaluate(() => ({
      barlow: document.fonts.check('600 80px "Barlow Condensed"'),
      labels: document.fonts.check('400 12px "IBM Plex Mono"'),
      prose: document.fonts.check("400 16px Quicksand"),
    })),
  };
  await mkdir("test/scratch/live", { recursive: true });
  await page.screenshot({
    path: "test/scratch/live/home-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test/scratch/live/home-390.png",
    fullPage: true,
  });
  result.observations.primaryActionOnFirstPhoneScreen = await page
    .getByRole("link", { name: "Send a tip", exact: true })
    .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight);
  for (const route of ["tip", "setup", "stage", "about"]) {
    await page.goto(url + "#/" + route);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `test/scratch/live/${route}-390.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No overflow on " + route,
    );
  }
  result.observations.publicRpc = await page.evaluate(async () => {
    const call = async (url, method, params = []) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    };
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    const chain = await call(rpc, "eth_chainId");
    const head = Number(BigInt(await call(rpc, "eth_blockNumber")));
    const asset = JSON.parse(
      localStorage.getItem("squeekstage:api:v2:economy/state"),
    ).data.asset.address;
    // Exercise the real 2,000-block logs interface; no viewer or recipient wallet is needed for a read.
    const logs = await call(rpc, "eth_getLogs", [
      {
        address: asset,
        fromBlock: "0x" + (head - 1999).toString(16),
        toBlock: "0x" + head.toString(16),
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        ],
      },
    ]);
    let fallback;
    try {
      fallback = await call("https://1rpc.io/sepolia", "eth_chainId");
    } catch {
      fallback = "unavailable";
    }
    return {
      chainId: Number(BigInt(chain)),
      logRangeBlocks: 2000,
      logsReturned: logs.length,
      fallbackChainId:
        fallback === "unavailable" ? fallback : Number(BigInt(fallback)),
    };
  });
  result.observations.scriptErrors = errors;
  result.observations.failedLocalResources = failedLocal;
  assert.deepEqual(errors, []);
  assert.deepEqual(failedLocal, []);
  assert.equal(result.observations.publicRpc.chainId, 11155111);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await writeFile(
    "test/scratch/live-results.json",
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  await new Promise((done) => server.close(done));
}
