/**
 * gbiz-leads-mcp Apify Actor版（Standby mode / Streamable HTTP）
 * 環境変数 GBIZINFO_API_TOKEN が必要（Apify ConsoleのActor環境変数でsecret設定）
 */
import { Actor } from "apify";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools, SERVER_INFO } from "./core.js";

await Actor.init();

const API_TOKEN = process.env.GBIZINFO_API_TOKEN ?? "";

// Apifyの日次自動テスト対策：Standbyでない通常実行のときは、
// サンプル検索を1件実行して結果をデータセットに出力し、正常終了する
if (process.env.APIFY_META_ORIGIN !== "STANDBY") {
  console.log("Standard run detected — running self-test search against gBizINFO API.");
  try {
    const res = await fetch(
      "https://api.info.gbiz.go.jp/hojin/v1/hojin?prefecture=13&employee_number_from=10&limit=3",
      { headers: { "X-hojinInfo-api-token": API_TOKEN } }
    );
    const json: any = await res.json();
    const items = (json["hojin-infos"] ?? []).map((r: any) => ({
      corporate_number: r.corporate_number,
      name: r.name,
      location: r.location,
      note: "Self-test sample. Connect via MCP for full functionality — see README.",
    }));
    await Actor.pushData(items.length > 0 ? items : [{ status: "ok", note: "API reachable." }]);
  } catch (e) {
    await Actor.pushData([{ status: "error", note: String(e) }]);
  }
  await Actor.exit();
}

const app = express();
app.use(express.json());

// Apifyのreadiness probe（ヘッダー付きGET /）には即200を返す
app.get("/", (_req, res) => {
  res.status(200).send(`${SERVER_INFO.name} v${SERVER_INFO.version} — MCP endpoint: POST /mcp`);
});

// ステートレス運用：リクエストごとにサーバー＋トランスポートを作る
app.post("/mcp", async (req, res) => {
  try {
    const server = new McpServer(SERVER_INFO);
    registerTools(server, API_TOKEN, async (toolName) => {
      await Actor.charge({ eventName: "tool-call" });
      console.log(`charged: tool-call (${toolName})`);
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP request error:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// ステートレスのためGET/DELETE（セッション系）は非対応と明示する
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST (stateless mode)." },
    id: null,
  });
});
app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST (stateless mode)." },
    id: null,
  });
});

const port = Number(
  process.env.ACTOR_WEB_SERVER_PORT ?? process.env.APIFY_CONTAINER_PORT ?? 3000
);
app.listen(port, () => {
  console.log(`${SERVER_INFO.name} v${SERVER_INFO.version} listening on :${port} (Actor standby)`);
});
