/**
 * gbiz-leads-mcp コアロジック
 * データソース: 経済産業省 gBizINFO REST API（無料・要APIトークン）
 *   https://content.info.gbiz.go.jp/api/index.html
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API_BASE = "https://api.info.gbiz.go.jp/hojin/v1";
const PORTAL_BASE = "https://info.gbiz.go.jp/hojin/ichiran?hojinBango=";

export const SERVER_INFO = { name: "gbiz-leads-mcp", version: "0.1.0" };

// JIS X 0401 都道府県コード
const PREFECTURE_CODES: Record<string, string> = {
  北海道: "01", 青森県: "02", 岩手県: "03", 宮城県: "04", 秋田県: "05",
  山形県: "06", 福島県: "07", 茨城県: "08", 栃木県: "09", 群馬県: "10",
  埼玉県: "11", 千葉県: "12", 東京都: "13", 神奈川県: "14", 新潟県: "15",
  富山県: "16", 石川県: "17", 福井県: "18", 山梨県: "19", 長野県: "20",
  岐阜県: "21", 静岡県: "22", 愛知県: "23", 三重県: "24", 滋賀県: "25",
  京都府: "26", 大阪府: "27", 兵庫県: "28", 奈良県: "29", 和歌山県: "30",
  鳥取県: "31", 島根県: "32", 岡山県: "33", 広島県: "34", 山口県: "35",
  徳島県: "36", 香川県: "37", 愛媛県: "38", 高知県: "39", 福岡県: "40",
  佐賀県: "41", 長崎県: "42", 熊本県: "43", 大分県: "44", 沖縄県: "47",
  宮崎県: "45", 鹿児島県: "46",
};

function prefCode(name: string): string {
  const code = PREFECTURE_CODES[name.trim()];
  if (!code) {
    throw new Error(
      `都道府県名「${name}」を認識できません。「東京都」「大阪府」のような正式名称で指定してください。`
    );
  }
  return code;
}

async function apiGet(path: string, token: string, params?: URLSearchParams): Promise<any> {
  if (!token) {
    throw new Error(
      "gBizINFO APIトークンが未設定です。環境変数 GBIZINFO_API_TOKEN を設定してください（無料申請: https://content.info.gbiz.go.jp/api/index.html）"
    );
  }
  const url = `${API_BASE}${path}${params ? `?${params}` : ""}`;
  const res = await fetch(url, { headers: { "X-hojinInfo-api-token": token } });
  if (!res.ok) {
    throw new Error(`gBizINFO APIエラー: HTTP ${res.status}（URL: ${url}）`);
  }
  return res.json();
}

/**
 * @param apiToken gBizINFO APIトークン
 * @param onToolCall 課金など、ツール実行前に呼ぶフック（Apify版で使用。省略可）
 */
export function registerTools(
  server: McpServer,
  apiToken: string,
  onToolCall?: (toolName: string) => Promise<void>
): void {
  server.registerTool(
    "search_companies",
    {
      title: "日本企業をリード条件で検索",
      description:
        "日本の法人データベース（経産省gBizINFO、約100万社超の活動情報）から営業リード候補を検索する。" +
        "都道府県・従業員数・資本金・売上・設立年・補助金受給歴の有無で絞り込める。" +
        "結果のcorporate_number（法人番号）をget_company_profile / get_company_subsidiesに渡すと詳細が取れる。",
      inputSchema: {
        name: z.string().optional().describe("法人名（部分一致）"),
        prefecture: z.string().optional().describe("都道府県名（例: 東京都）"),
        employees_min: z.number().int().min(0).optional().describe("従業員数の下限"),
        employees_max: z.number().int().min(0).optional().describe("従業員数の上限"),
        capital_min_yen: z.number().int().min(0).optional().describe("資本金の下限（円）"),
        capital_max_yen: z.number().int().min(0).optional().describe("資本金の上限（円）"),
        founded_year: z.number().int().optional().describe("設立年（例: 2015）"),
        with_subsidy_history: z
          .boolean()
          .default(false)
          .describe("trueで国の補助金受給歴がある企業に限定（予算獲得力・投資意欲のシグナル）"),
        max_results: z.number().int().min(1).max(50).default(10).describe("最大件数（1〜50）"),
        page: z.number().int().min(1).max(10).default(1).describe("ページ番号（1〜10）"),
      },
    },
    async (input) => {
      await onToolCall?.("search_companies");
      const params = new URLSearchParams();
      if (input.name) params.set("name", input.name);
      if (input.prefecture) params.set("prefecture", prefCode(input.prefecture));
      if (input.employees_min !== undefined) params.set("employee_number_from", String(input.employees_min));
      if (input.employees_max !== undefined) params.set("employee_number_to", String(input.employees_max));
      if (input.capital_min_yen !== undefined) params.set("capital_stock_from", String(input.capital_min_yen));
      if (input.capital_max_yen !== undefined) params.set("capital_stock_to", String(input.capital_max_yen));
      if (input.founded_year !== undefined) params.set("founded_year", String(input.founded_year));
      if (input.with_subsidy_history) params.set("source", "4");
      params.set("limit", String(input.max_results));
      params.set("page", String(input.page));

      const json = await apiGet("/hojin", apiToken, params);
      const results = (json["hojin-infos"] ?? []).map((r: any) => ({
        corporate_number: r.corporate_number,
        name: r.name,
        location: r.location ?? null,
        public_records_count: r.number_of_activity ?? null,
        last_updated: r.update_date ?? null,
        profile_page: `${PORTAL_BASE}${r.corporate_number}`,
      }));
      const payload = {
        query: input,
        returned: results.length,
        results,
        hint:
          results.length === 0
            ? "ヒットなし。条件を緩めて再検索してください（都道府県や従業員数の範囲を広げる等）。"
            : "各社の代表者名・事業概要・会社URLはget_company_profile、補助金受給歴はget_company_subsidiesで取得できます。",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.registerTool(
    "get_company_profile",
    {
      title: "企業プロフィールを取得",
      description:
        "法人番号を指定して企業の詳細プロフィールを取得する：代表者名・役職、従業員数、資本金、設立日、事業概要、会社URL、全省庁統一資格など。営業アプローチの下調べに使う。",
      inputSchema: {
        corporate_number: z.string().length(13).describe("法人番号（13桁）"),
      },
    },
    async ({ corporate_number }) => {
      await onToolCall?.("get_company_profile");
      const json = await apiGet(`/hojin/${encodeURIComponent(corporate_number)}`, apiToken);
      const r = (json["hojin-infos"] ?? [])[0];
      if (!r) {
        return {
          content: [{ type: "text" as const, text: `法人番号「${corporate_number}」は見つかりませんでした。` }],
          isError: true,
        };
      }
      const payload = {
        corporate_number: r.corporate_number,
        name: r.name,
        kana: r.kana ?? null,
        representative: r.representative_name
          ? `${r.representative_position ?? ""} ${r.representative_name}`.trim()
          : null,
        location: r.location ?? null,
        postal_code: r.postal_code ?? null,
        employee_number: r.employee_number ?? null,
        capital_stock: r.capital_stock ?? null,
        date_of_establishment: r.date_of_establishment ?? null,
        business_summary: r.business_summary ?? null,
        company_url: r.company_url ?? null,
        qualification_grade: r.qualification_grade ?? null,
        profile_page: `${PORTAL_BASE}${r.corporate_number}`,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.registerTool(
    "get_company_subsidies",
    {
      title: "企業の補助金受給歴を取得",
      description:
        "法人番号を指定して、その企業が国から受給した補助金の履歴を取得する。" +
        "「補助金で設備投資した企業」「IT導入補助金の受給企業」など、予算と投資意欲のある企業の発掘に使える。",
      inputSchema: {
        corporate_number: z.string().length(13).describe("法人番号（13桁）"),
      },
    },
    async ({ corporate_number }) => {
      await onToolCall?.("get_company_subsidies");
      const json = await apiGet(`/hojin/${encodeURIComponent(corporate_number)}/subsidy`, apiToken);
      const r = (json["hojin-infos"] ?? [])[0];
      const subsidies = (r?.subsidy ?? []).map((s: any) => ({
        date_of_approval: s.date_of_approval ?? null,
        title: s.title ?? null,
        amount: s.amount ?? null,
        government_department: s.government_departments ?? null,
        target: s.target ?? null,
        note: s.note ?? null,
      }));
      const payload = {
        corporate_number,
        company_name: r?.name ?? null,
        subsidy_count: subsidies.length,
        subsidies,
        hint:
          subsidies.length === 0
            ? "この企業の補助金受給記録はありません。"
            : "受給歴は投資意欲・予算獲得力のシグナルとして営業提案に活用できます。",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.registerTool(
    "get_company_procurement",
    {
      title: "企業の官公庁取引実績を取得",
      description:
        "法人番号を指定して、その企業の政府調達（官公庁との取引）実績を取得する。官公需に強い企業の発掘や、取引先の信用調査の参考に使える。",
      inputSchema: {
        corporate_number: z.string().length(13).describe("法人番号（13桁）"),
      },
    },
    async ({ corporate_number }) => {
      await onToolCall?.("get_company_procurement");
      const json = await apiGet(`/hojin/${encodeURIComponent(corporate_number)}/procurement`, apiToken);
      const r = (json["hojin-infos"] ?? [])[0];
      const procurements = (r?.procurement ?? []).map((p: any) => ({
        date_of_order: p.date_of_order ?? null,
        title: p.title ?? null,
        amount: p.amount ?? null,
        government_department: p.government_departments ?? null,
      }));
      const payload = {
        corporate_number,
        company_name: r?.name ?? null,
        procurement_count: procurements.length,
        procurements,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
    }
  );
}
