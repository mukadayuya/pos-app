import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ホスト名ベースのルーティング
 *  - waraji-handy.vercel.app にアクセスされたら、`/` を `/handy` に書き換える
 *  - それ以外のホスト（waraji-pos.vercel.app 等）はそのままトップ画面を表示
 *
 *  → 1つのデプロイで「レジ管理用URL」と「ハンディ専用URL」を切り分けられる。
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const url = request.nextUrl;

  if (host.includes("handy") && url.pathname === "/") {
    url.pathname = "/handy";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
