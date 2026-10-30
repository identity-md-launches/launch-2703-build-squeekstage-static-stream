import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

export function previewServer(port = 0) {
  const root = resolve("dist");
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      ).replace(/^\/preview\//, "/");
      const file = resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (!file.startsWith(root + "/")) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      response
        .writeHead(200, {
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-cache",
        })
        .end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((done) =>
    server.listen(port, "0.0.0.0", () =>
      done({
        server,
        url: `http://127.0.0.1:${server.address().port}/preview/`,
      }),
    ),
  );
}
if (process.argv.includes("--standalone")) {
  const { server, url } = await previewServer();
  console.log(`SqueekStage export preview: ${url}`);
  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());
}
