// Stripe Terminal クライアントラッパー（Phase 4-⑮）
// カードリーダー（WisePOS E / iPhoneのTap to Pay）で card_present 決済を行う。
// 実機接続時は Discover→Connect→ProcessPayment のフローで動作する。

import { loadStripeTerminal } from "@stripe/terminal-js";
import type { Terminal, Reader } from "@stripe/terminal-js";

let terminalInstance: Terminal | null = null;
let connectedReader: Reader | null = null;

async function getTerminal(): Promise<Terminal> {
  if (terminalInstance) return terminalInstance;

  const StripeTerminal = await loadStripeTerminal();
  if (!StripeTerminal) throw new Error("Stripe Terminal SDK の読み込みに失敗しました");

  terminalInstance = StripeTerminal.create({
    onFetchConnectionToken: async () => {
      const res = await fetch("/api/stripe/terminal/connection-token", { method: "POST" });
      if (!res.ok) throw new Error("Connection Token取得失敗");
      const { secret } = await res.json();
      return secret;
    },
    onUnexpectedReaderDisconnect: () => {
      connectedReader = null;
    },
  });
  return terminalInstance;
}

/** リーダーを探索して最初のオンラインリーダーに接続 */
export async function connectFirstAvailableReader(): Promise<Reader> {
  if (connectedReader) return connectedReader;
  const terminal = await getTerminal();

  // 実機探索（Wi-Fi接続の物理リーダー）
  const discoverResult = await terminal.discoverReaders({
    simulated: process.env.NEXT_PUBLIC_STRIPE_TERMINAL_SIMULATED === "true",
  });

  if ("error" in discoverResult) {
    throw new Error(`リーダー探索エラー: ${discoverResult.error.message}`);
  }
  if (discoverResult.discoveredReaders.length === 0) {
    throw new Error("接続可能なカードリーダーが見つかりません。電源とWi-Fi接続を確認してください。");
  }

  const reader = discoverResult.discoveredReaders[0];
  const connectResult = await terminal.connectReader(reader);

  if ("error" in connectResult) {
    throw new Error(`リーダー接続エラー: ${connectResult.error.message}`);
  }

  connectedReader = connectResult.reader;
  return connectResult.reader;
}

/** 決済処理（PaymentIntent 作成 → リーダー処理 → 完了確認） */
export async function chargeViaTerminal(
  amountYen: number,
  description: string,
  metadata?: Record<string, string>,
): Promise<{ success: true; paymentIntentId: string } | { success: false; error: string }> {
  try {
    // 1. リーダーが接続されているか
    if (!connectedReader) {
      await connectFirstAvailableReader();
    }

    // 2. サーバー側で PaymentIntent 作成
    const res = await fetch("/api/stripe/terminal/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountYen, description, metadata }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "PaymentIntent作成失敗"));
    const { client_secret, id: intentId } = await res.json();

    // 3. リーダー側で PaymentMethod 収集
    const terminal = await getTerminal();
    const collectResult = await terminal.collectPaymentMethod(client_secret);
    if ("error" in collectResult) {
      return { success: false, error: collectResult.error.message ?? "決済取消" };
    }

    // 4. Process (実際にカードから引き落とし)
    const processResult = await terminal.processPayment(collectResult.paymentIntent);
    if ("error" in processResult) {
      return { success: false, error: processResult.error.message ?? "決済処理失敗" };
    }

    return { success: true, paymentIntentId: intentId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** 接続中リーダーの状態を返す */
export function getReaderStatus(): { connected: boolean; label?: string } {
  if (!connectedReader) return { connected: false };
  return { connected: true, label: connectedReader.label ?? connectedReader.serial_number };
}
