#!/usr/bin/env node
/**
 * gbiz-leads-mcp ローカル版（stdio）
 * 環境変数 GBIZINFO_API_TOKEN が必要（無料申請: https://content.info.gbiz.go.jp/api/index.html）
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, SERVER_INFO } from "./core.js";

const server = new McpServer(SERVER_INFO);
registerTools(server, process.env.GBIZINFO_API_TOKEN ?? "");

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`${SERVER_INFO.name} v${SERVER_INFO.version} 起動（stdio）`);
