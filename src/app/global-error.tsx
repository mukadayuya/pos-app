"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ color: "#dc2626", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
            システムエラー
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            予期せぬエラーが発生しました。
            {error.digest && (
              <span style={{ display: "block", fontSize: "0.75rem", marginTop: "0.25rem", color: "#9ca3af" }}>
                エラーID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={unstable_retry}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#4f46e5",
              color: "white",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
