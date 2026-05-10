"use client";

import { useState, useCallback, useRef } from "react";
import {
  DifyAppType,
  DifyInputs,
  DifyProxyRequest,
  DifyProxyResponse,
  DifyProxyErrorResponse,
} from "@/lib/dify";

// ─── 型 ───────────────────────────────────────────────────────

export interface DifyApiState<TOut> {
  data: TOut | null;
  loading: boolean;
  error: string | null;
  usage: { total_tokens: number; elapsed_time?: number } | null;
}

export interface UseDifyApiReturn<TOut> extends DifyApiState<TOut> {
  /** Dify を呼び出してレスポンスを返す。state も更新される。 */
  call: (inputs: DifyInputs, query?: string) => Promise<TOut | null>;
  /** state をリセットする（再利用時など）。 */
  reset: () => void;
  /** 現在のリクエストをキャンセルする（abort）。 */
  abort: () => void;
}

const INITIAL_STATE = <TOut>(): DifyApiState<TOut> => ({
  data: null, loading: false, error: null, usage: null,
});

// ─── フック ───────────────────────────────────────────────────

/**
 * 汎用 Dify API フック。
 *
 * @template TOut  Dify Workflow の `outputs` をマップした型
 *
 * @example
 *   const { data, loading, error, call } = useDifyApi<AnalysisResult>({
 *     appType: "workflow",
 *     user: "pos-sales-data",
 *   });
 *   const result = await call({ sales_json: JSON.stringify(monthOrders) });
 */
export function useDifyApi<TOut = Record<string, unknown>>({
  appType = "workflow",
  user = "pos-app",
  conversationId,
}: {
  appType?: DifyAppType;
  user?: string;
  conversationId?: string;
} = {}): UseDifyApiReturn<TOut> {
  const [state, setState] = useState<DifyApiState<TOut>>(INITIAL_STATE<TOut>);
  const abortRef = useRef<AbortController | null>(null);

  const call = useCallback(
    async (inputs: DifyInputs, query?: string): Promise<TOut | null> => {
      // 前のリクエストをキャンセル
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setState({ data: null, loading: true, error: null, usage: null });

      const body: DifyProxyRequest = {
        appType,
        inputs,
        user,
        ...(query         !== undefined ? { query }         : {}),
        ...(conversationId !== undefined ? { conversationId } : {}),
      };

      try {
        const res = await fetch("/api/dify", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
          signal:  abortRef.current.signal,
        });

        const json = (await res.json()) as DifyProxyResponse<TOut> | DifyProxyErrorResponse;

        if (!json.ok) {
          const msg = (json as DifyProxyErrorResponse).error;
          setState(prev => ({ ...prev, loading: false, error: msg }));
          return null;
        }

        const success = json as DifyProxyResponse<TOut>;
        setState({
          data:    success.data,
          loading: false,
          error:   null,
          usage:   success.usage ?? null,
        });
        return success.data;

      } catch (e) {
        // AbortError は無視（意図的なキャンセル）
        if ((e as Error).name === "AbortError") return null;
        const msg = (e as Error).message ?? "不明なエラー";
        setState(prev => ({ ...prev, loading: false, error: msg }));
        return null;
      }
    },
    [appType, user, conversationId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE<TOut>());
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  return { ...state, call, reset, abort };
}
