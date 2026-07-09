import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 1) LINEアプリ内ブラウザからのアクセスを外部ブラウザ（Safari/Chrome）へ自動で逃がす
 *    - LINE内ブラウザはOS制限で音声入力（Web Speech API）が使えないため
 *    - `openExternalBrowser=1` はLINE公式パラメータで、リダイレクト先のURLに
 *      含まれているとLINEが外部ブラウザを自動起動する
 *    - パラメータが既に付いている場合はリダイレクトしない（無限ループ防止）
 *
 * 2) ホスト名ベースのルーティング
 *    - *-handy.vercel.app にアクセスされたら `/` を `/handy` に書き換える
 *    - 1つのデプロイで「レジ管理用URL」と「ハンディ専用URL」を切り分ける
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const url = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";

  // LINE内ブラウザ検知 → 外部ブラウザへ自動リダイレクト
  // UA例: "... Mobile/15E148 Safari Line/14.5.0"（\b で Outline/ 等の誤検知を防ぐ）
  if (/\bLine\//.test(ua) && url.searchParams.get("openExternalBrowser") !== "1") {
    const external = url.clone();
    external.searchParams.set("openExternalBrowser", "1");
    return NextResponse.redirect(external);
  }

  if (host.includes("handy") && url.pathname === "/") {
    const rewritten = url.clone();
    rewritten.pathname = "/handy";
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/handy", "/customer/:path*"],
};
