// FLOWS POS プライバシーポリシー（Phase 5-⑰）
// 個人情報保護法対応。海外DB(Supabase)利用の明示。

import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー | FLOWS POS",
  description: "FLOWS POS のプライバシーポリシー",
};

const LAST_UPDATED = "2026年7月13日";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">プライバシーポリシー</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <p className="font-bold">⚠️ 本ポリシーはドラフト版です</p>
          <p className="text-xs mt-1">本番運用前に弁護士による内容確認を受けてください。</p>
        </div>

        <p className="text-xs text-slate-500 mb-6">最終更新: {LAST_UPDATED}</p>

        <p className="text-sm leading-relaxed text-slate-700 mb-8">
          向田侑矢（以下「当社」）は、POSレジサービス「FLOWS POS」（以下「本サービス」）の利用に伴い取得する
          個人情報について、以下のとおり適切に取り扱います。
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">1. 取得する情報</h2>

          <h3 className="text-sm font-bold text-slate-700 mt-4 mb-2">1-1. 利用者から直接ご提供いただく情報</h3>
          <ul className="text-sm leading-relaxed text-slate-700 list-disc list-inside space-y-1">
            <li>事業者名・屋号</li>
            <li>担当者氏名・連絡先（電話・メール）</li>
            <li>店舗所在地</li>
            <li>従業員数・年間売上（補助金診断機能で任意入力）</li>
          </ul>

          <h3 className="text-sm font-bold text-slate-700 mt-4 mb-2">1-2. 本サービスの利用によって生成される情報</h3>
          <ul className="text-sm leading-relaxed text-slate-700 list-disc list-inside space-y-1">
            <li>売上データ（金額・時刻・支払方法・商品）</li>
            <li>スタッフ勤怠情報（氏名・打刻時刻）</li>
            <li>予約情報（お客様名・電話・人数・希望席）</li>
            <li>免税販売記録（パスポート番号・氏名・国籍・入国日）</li>
            <li>アクセスログ・操作ログ</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">2. 利用目的</h2>
          <ul className="text-sm leading-relaxed text-slate-700 list-disc list-inside space-y-1">
            <li>本サービスの提供・保守運営</li>
            <li>お客様からのお問い合わせへの対応</li>
            <li>利用料金の請求・精算</li>
            <li>不正利用・障害の防止・調査</li>
            <li>本サービスの改善・新機能開発</li>
            <li>統計データの作成（個人を特定できない形式）</li>
            <li>補助金申請サポート（お客様の希望に基づき）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">3. 第三者提供</h2>
          <p className="text-sm leading-relaxed text-slate-700 mb-2">
            当社は、以下の場合を除き、取得した個人情報を第三者に提供しません。
          </p>
          <ul className="text-sm leading-relaxed text-slate-700 list-disc list-inside space-y-1">
            <li>ご本人の同意がある場合</li>
            <li>法令に基づく開示要請がある場合</li>
            <li>人の生命・身体・財産保護のために必要で、ご本人の同意取得が困難な場合</li>
            <li>補助金申請サポート業務において、社労士・税理士等の専門家に必要な範囲で提供する場合（お客様の依頼に基づく）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">4. 外部サービスの利用（越境データ移転を含む）</h2>
          <p className="text-sm leading-relaxed text-slate-700 mb-3">
            本サービスは以下の外部サービスを利用しており、これらのサービスに個人情報が保管される場合があります。
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-800">🗄️ Supabase Inc.（米国）</p>
              <p className="text-xs text-slate-600 mt-1">
                データベース・認証基盤。売上・予約・スタッフ情報等の全データが保管されます。<br />
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">Supabase プライバシーポリシー</a>
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">☁️ Vercel Inc.（米国）</p>
              <p className="text-xs text-slate-600 mt-1">
                Webサービスのホスティング。アクセスログが保存されます。<br />
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">Vercel プライバシーポリシー</a>
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">📊 Sentry（米国）</p>
              <p className="text-xs text-slate-600 mt-1">
                エラー監視。ソフトウェア障害時にエラー内容が送信されます（個人情報は含みません）。
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ※ 米国は個人情報保護委員会が指定する個人情報保護制度を有する国ではありませんが、
            上記各社は SOC 2 Type II 等の国際的な情報セキュリティ基準に準拠しています。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">5. 安全管理</h2>
          <ul className="text-sm leading-relaxed text-slate-700 list-disc list-inside space-y-1">
            <li>データベースへの通信は全てTLS暗号化</li>
            <li>店舗単位のアクセス制御（Row Level Security）で他店舗のデータは閲覧不可</li>
            <li>本人確認情報（免税販売のパスポート情報）は税務保管義務期間（7年）経過後、速やかに削除</li>
            <li>従業員（社労士等）には守秘義務を課しています</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">6. Cookie・アクセス解析</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            本サービスは、ログイン状態の保持と利用状況分析のため Cookie を使用します。
            Cookie の使用を拒否される場合はブラウザ設定で無効化できますが、
            本サービスの一部機能が制限される場合があります。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">7. 開示・訂正・削除の請求</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            ご本人からの開示・訂正・削除・利用停止のご請求について、
            下記の連絡先までご連絡いただければ、法令に従い対応いたします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">8. お問い合わせ</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-700"><b>向田侑矢</b></p>
            <p className="text-sm text-slate-700">Instagram: <a href="https://www.instagram.com/yuya_mukada/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">@yuya_mukada</a></p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">9. 本ポリシーの変更</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            当社は、必要に応じて本プライバシーポリシーを変更することがあります。
            重要な変更については本サービス上での告知またはメールでお知らせします。
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500">
          <p>最終更新日: {LAST_UPDATED}</p>
        </div>
      </main>
    </div>
  );
}
