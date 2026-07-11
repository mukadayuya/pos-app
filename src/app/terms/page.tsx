// FLOWS POS 利用規約（Phase 5-⑰）
// SaaS標準テンプレート。本番運用前に弁護士レビュー必須。

import Link from "next/link";

export const metadata = {
  title: "利用規約 | FLOWS POS",
  description: "FLOWS POS の利用規約",
};

const LAST_UPDATED = "2026年7月13日";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-600 text-sm">← HOME</Link>
          <h1 className="text-lg font-bold text-slate-900">利用規約</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 prose prose-slate">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <p className="font-bold">⚠️ 本規約はドラフト版です</p>
          <p className="text-xs mt-1">本番運用前に弁護士による内容確認を受けてください。</p>
        </div>

        <p className="text-xs text-slate-500 mb-6">最終更新: {LAST_UPDATED}</p>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第1条（適用）</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            本規約は、向田侑矢（以下「当社」）が提供するPOSレジサービス「FLOWS POS」（以下「本サービス」）の
            利用に関する一切の関係に適用されます。本サービスを利用される事業者様（以下「利用者」）は、
            本規約に同意した上で本サービスを利用するものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第2条（利用契約の成立）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>利用者は当社所定の申込フォームより本サービスの利用を申し込むものとします。</li>
            <li>当社が申込を承諾し、利用者にその旨を通知した時点で利用契約が成立します。</li>
            <li>未成年者・成年被後見人等は法定代理人の同意を得た上で申込を行ってください。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第3条（料金・支払方法）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>本サービスの利用料金は、当社が別途定める料金プランに従います。</li>
            <li>利用料金は毎月末日締めで、翌月末日までに指定の方法でお支払いいただきます。</li>
            <li>料金の支払いが遅延した場合、年14.6%の遅延損害金を申し受けることがあります。</li>
            <li>初期費用・出張サポート費用等は別途見積いたします。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第4条（禁止事項）</h2>
          <p className="text-sm leading-relaxed text-slate-700 mb-2">
            利用者は本サービスの利用にあたり、以下の行為を行ってはなりません。
          </p>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>本サービスの運営を妨害するおそれのある行為</li>
            <li>他の利用者・第三者の権利を侵害する行為</li>
            <li>本サービスを通じて得られた情報の複製・改変・二次利用（正当な業務利用を除く）</li>
            <li>本サービスのリバースエンジニアリング</li>
            <li>その他、当社が不適切と判断する行為</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第5条（本サービスの中断・変更）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>当社は、システムメンテナンス・障害対応・その他運営上必要な場合、事前通知なく本サービスを一時中断できるものとします。</li>
            <li>当社は、本サービスの内容を利用者への事前通知の上、変更・廃止することができます。</li>
            <li>これらによって利用者に生じた損害について、当社は一切の責任を負いません。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第6条（免責事項）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>当社は、本サービスが利用者の特定の目的に適合すること、期待する機能・正確性を有すること、および利用者による本サービスの利用が中断なく行われることを保証しません。</li>
            <li>当社は、本サービスの利用によって利用者に生じたあらゆる損害について、当社の故意または重過失による場合を除き、責任を負いません。</li>
            <li>当社が損害賠償責任を負う場合であっても、賠償額は当該損害の直接原因となった月の利用料金相当額を上限とします。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第7条（データの取扱い）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>利用者が本サービスに入力したデータ（売上・メニュー・顧客情報等）の所有権は利用者に帰属します。</li>
            <li>当社は、本サービスの提供・改善・統計分析の目的で必要な範囲でデータを利用できるものとします。</li>
            <li>利用者データは Supabase Inc.（米国）が提供するクラウドインフラに保存されます。詳細は<Link href="/privacy" className="text-emerald-700 underline">プライバシーポリシー</Link>をご確認ください。</li>
            <li>契約終了時は、利用者の求めに応じてデータをCSV等でエクスポート可能とし、当社側のデータは30日以内に削除します。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第8条（契約の解除）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>利用者は、当社所定の方法により、いつでも本契約を解除することができます。解除の効力は解除申請月の末日をもって発生します。</li>
            <li>当社は、利用者が本規約に違反した場合、事前通知なく利用契約を解除できるものとします。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第9条（規約の変更）</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            当社は、必要と判断した場合、利用者への事前通知（1ヶ月前）の上、本規約を変更できるものとします。
            変更後の規約に同意されない利用者は、変更適用日までに契約を解除するものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-2">第10条（準拠法・裁判管轄）</h2>
          <ol className="text-sm leading-relaxed text-slate-700 list-decimal list-inside space-y-2">
            <li>本規約の解釈にあたっては日本法を準拠法とします。</li>
            <li>本サービスに関して紛争が生じた場合、当社所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
          </ol>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500">
          <p>向田侑矢</p>
          <p>Instagram: @yuya_mukada</p>
        </div>
      </main>
    </div>
  );
}
