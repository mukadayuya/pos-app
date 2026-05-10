// ─── Dify API 型定義 ──────────────────────────────────────────
// Dify アプリのタイプ: Chat / Completion / Workflow
// 現時点では Workflow が最も柔軟（入力→出力が明確）なので推奨。

export type DifyAppType = "workflow" | "chat" | "completion";

// Dify に渡す変数（Dify アプリ側の "inputs" と対応）
export type DifyInputs = Record<string, string | number | boolean | object>;

// ─── リクエスト ────────────────────────────────────────────────

export interface DifyWorkflowRequest {
  inputs: DifyInputs;
  response_mode: "blocking" | "streaming";
  user: string; // 識別用（"pos-app" など任意の文字列）
}

export interface DifyChatRequest {
  inputs: DifyInputs;
  query: string;
  response_mode: "blocking" | "streaming";
  conversation_id?: string;
  user: string;
}

// ─── レスポンス ───────────────────────────────────────────────

export interface DifyWorkflowOutput {
  // Dify Workflow の outputs オブジェクト（アプリ設計による）
  // TODO: 実際の Workflow 出力キーに合わせて型を定義する
  [key: string]: unknown;
}

export interface DifyWorkflowResponse {
  workflow_run_id: string;
  task_id: string;
  data: {
    id: string;
    workflow_id: string;
    status: "running" | "succeeded" | "failed" | "stopped";
    outputs: DifyWorkflowOutput;
    error: string | null;
    elapsed_time: number;
    total_tokens: number;
    total_steps: number;
    created_at: number;
    finished_at: number;
  };
}

export interface DifyChatResponse {
  message_id: string;
  conversation_id: string;
  mode: "chat";
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  created_at: number;
}

// ─── エラー ───────────────────────────────────────────────────

export interface DifyApiError {
  code: string;    // Dify エラーコード（例: "invalid_api_key"）
  message: string; // 人間向けメッセージ
  status: number;  // HTTP ステータス
}

// ─── プロキシ経由リクエスト（ブラウザ→ /api/dify） ───────────

// hooks から /api/dify へ POST するボディ
export interface DifyProxyRequest {
  appType: DifyAppType;
  inputs: DifyInputs;
  query?: string;           // chat モード用
  conversationId?: string;  // chat モード: 会話継続
  user?: string;
}

// /api/dify から返ってくるレスポンス（アプリタイプに依存しない共通形式）
export interface DifyProxyResponse<T = DifyWorkflowOutput> {
  ok: true;
  appType: DifyAppType;
  data: T;
  usage?: {
    total_tokens: number;
    elapsed_time?: number;
  };
}

export interface DifyProxyErrorResponse {
  ok: false;
  error: string;
  code?: string;
}
