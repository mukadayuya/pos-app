"use client";

import { useCallback } from "react";
import { useDifyApi, UseDifyApiReturn } from "./useDifyApi";
import { SaleDetailRow } from "@/lib/db";

// ─── Dify Workflow の outputs に対応する型 ───────────────────
// TODO: Dify アプリ側の outputs 設計が確定したら具体化する

export interface SalesAnalysisResult {
  /** 今月の売上傾向の要約（1〜3文） */
  summary: string;
  /** 気づきのリスト（売れ筋、時間帯、客層など） */
  insights: string[];
  /** オーナー向けアクション提案 */
  recommendations: string[];
  /** Dify が判断した信頼度 0.0〜1.0（任意） */
  confidence?: number;
}

// ─── 売上データから Dify inputs を組み立てるヘルパー ─────────

interface AnalysisContext {
  monthLabel: string;           // 例: "2026年5月"
  orders: SaleDetailRow[];
  topItems?: { name: string; total: number }[];
  guestCount?: number;
}

function buildAnalysisInputs(ctx: AnalysisContext): Record<string, string | number> {
  const { orders, monthLabel, topItems, guestCount } = ctx;

  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
  const orderCount   = orders.length;

  // Dify Workflow の inputs キーと一致させる
  // TODO: Dify アプリ側の変数名が確定したら合わせる
  return {
    month_label:    monthLabel,
    total_revenue:  totalRevenue,
    order_count:    orderCount,
    guest_count:    guestCount ?? 0,
    top_items_json: JSON.stringify(topItems ?? []),
    // 全注文の JSONB は大きすぎるため要約だけ渡す
    // 詳細が必要な場合は orders をサンプリングして渡すこと
  };
}

// ─── フック ───────────────────────────────────────────────────

export interface UseDifyAnalysisReturn extends UseDifyApiReturn<SalesAnalysisResult> {
  /** 月次売上データを渡して AI 分析を実行する */
  analyze: (ctx: AnalysisContext) => Promise<SalesAnalysisResult | null>;
}

/**
 * POS 売上データの AI 分析フック（Dify Workflow 経由）。
 *
 * @example
 *   const { data, loading, error, analyze } = useDifyAnalysis();
 *
 *   // 分析タブの「AI分析」ボタン押下時などに呼び出す
 *   const result = await analyze({
 *     monthLabel: "2026年5月",
 *     orders: monthOrders,
 *     topItems: [...],
 *     guestCount: genderData.total,
 *   });
 *
 *   if (result) {
 *     // result.summary / result.insights / result.recommendations を表示
 *   }
 */
export function useDifyAnalysis(): UseDifyAnalysisReturn {
  const api = useDifyApi<SalesAnalysisResult>({
    appType: "workflow",
    user:    "pos-sales-analysis",
  });

  const analyze = useCallback(
    (ctx: AnalysisContext) => {
      const inputs = buildAnalysisInputs(ctx);
      return api.call(inputs);
    },
    [api.call], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { ...api, analyze };
}
