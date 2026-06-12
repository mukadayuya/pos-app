import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // org/project/authToken は SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN 環境変数から自動読み込み
  silent: true,            // ビルドログを抑制
  telemetry: false,        // Sentryへの使用状況送信をオフ
});
