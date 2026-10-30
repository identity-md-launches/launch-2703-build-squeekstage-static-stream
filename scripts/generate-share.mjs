import { chromium } from "playwright";
import { previewServer } from "../tests/preview-server.mjs";
const { server, url } = await previewServer();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(url + "?demo=1");
  await page.evaluate(async () => {
    await document.fonts.ready;
    const wheel = document.querySelector(".wheel-art").outerHTML;
    document.getElementById("root").innerHTML =
      `<main class="share-card"><div class="share-copy"><div class="brand"><img src="./favicon.svg" width="44" height="44" alt=""/><span>Squeek<span class="brand-light">Stage</span></span></div><h1>Small paws.<br><span>Real blocks.</span></h1><p>The live Squeekchain stream companion.</p><div class="share-footer"><span>Live overlay</span><span>Direct SQK tips</span><span>Ethereum Sepolia</span></div></div><div class="share-wheel">${wheel}</div></main>`;
    const style = document.createElement("style");
    style.textContent = `.share-card{height:630px;padding:64px;display:flex;align-items:center;gap:60px;border:14px solid #18181d;background:#0b0b0d}.share-copy{flex:1}.share-copy h1{font-size:80px;line-height:1.05;margin:42px 0 20px}.share-copy p{color:#a1a1ae;font-size:20px;white-space:nowrap}.share-footer{display:flex;gap:22px;margin-top:42px;font:12px 'IBM Plex Mono';color:#a1a1ae}.share-footer span+span:before{content:'·';margin-right:20px;color:#f2c230}.share-wheel{width:390px}.share-wheel .wheel-art{width:390px;max-width:100%}.share-wheel .wheel-caption{display:none}.share-wheel .hamster-run{inset:4% 4% 25% 4%;animation:none}`;
    document.head.append(style);
  });
  await page.screenshot({ path: "public/share.png" });
  console.log("Generated public/share.png, 1200 × 630");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
