export default function Home() {
  const NAVY = "#0D1B3E";
  const NAVY_DARK = "#070E21";
  const GOLD = "#C9A84C";
  const GOLD_LIGHT = "#E8C96A";

  return (
    <main className="font-sans overflow-x-hidden">

      {/* ━━━ HERO ━━━ */}
      <section
        style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #1a2f5e 100%)` }}
        className="relative min-h-screen flex flex-col items-center justify-center text-white px-4 py-24"
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `radial-gradient(${GOLD} 1px, transparent 1px)`, backgroundSize: "32px 32px" }}
        />
        <div
          className="absolute top-0 right-0 w-1/2 h-full opacity-10"
          style={{ background: `linear-gradient(135deg, transparent 40%, ${GOLD} 100%)` }}
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span
            className="inline-block text-xs md:text-sm font-bold tracking-[0.3em] uppercase px-5 py-2 rounded-full mb-8 border"
            style={{ color: GOLD, borderColor: GOLD, background: "rgba(201,168,76,0.1)" }}
          >
            Infotainment — インフォテインメント
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[1.15] mb-6 tracking-tight">
            <span style={{ color: GOLD }}>AI×補助金</span>で、
            <br />
            飲食店の<span style={{ color: GOLD }}>「利益」</span>を
            <br className="hidden sm:block" />
            最大化する。
          </h1>

          <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
            業務をAIで自動化し、補助金で投資コストをゼロに近づける。<br />
            オーナーが本業だけに集中できる仕組みをつくります。
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-4">
            {[
              ["支援実績", "累計30件以上"],
              ["補助金獲得", "最大3,000万円"],
              ["返信速度", "原則24時間以内"],
            ].map(([label, val]) => (
              <div
                key={label}
                className="text-center px-6 py-3 rounded-xl border"
                style={{ borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.06)" }}
              >
                <p className="text-xs text-gray-400 tracking-wider">{label}</p>
                <p className="font-black text-lg" style={{ color: GOLD }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M12 16l-6-6h12z" /></svg>
        </div>
      </section>

      {/* ━━━ 悩み ━━━ */}
      <section className="bg-white py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
            Pain Points
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4" style={{ color: NAVY }}>
            こんなお悩み、ありませんか？
          </h2>
          <p className="text-center text-gray-500 mb-14">多くの飲食店オーナーが、同じ壁にぶつかっています。</p>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              { icon: "📋", text: "補助金の申請書類が複雑で、何から手をつければいいか分からない" },
              { icon: "⏰", text: "事務作業に追われて、料理や接客など本業に集中できていない" },
              { icon: "💸", text: "厨房設備を新しくしたいが、まとまった資金が用意できない" },
              { icon: "😰", text: "デジタル化したいが、何をどう導入すれば効果が出るか分からない" },
            ].map(({ icon, text }) => (
              <div
                key={text}
                className="flex items-start gap-4 p-6 rounded-2xl border-l-4"
                style={{ borderColor: GOLD, background: "#FAFAF7" }}
              >
                <span className="text-3xl leading-none mt-0.5">{icon}</span>
                <p className="text-gray-700 font-medium leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div
            className="mt-12 p-8 rounded-2xl text-center text-white font-bold text-xl md:text-2xl leading-relaxed"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2f5e 100%)` }}
          >
            その悩み、<span style={{ color: GOLD_LIGHT }}>全部まとめて</span>解決できます。
          </div>
        </div>
      </section>

      {/* ━━━ 3つの柱 ━━━ */}
      <section
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)` }}
        className="py-24 px-4 text-white"
      >
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
            Our Three Pillars
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
            選ばれる<span style={{ color: GOLD }}>3つ</span>の柱
          </h2>
          <p className="text-center text-gray-400 mb-16">AIと補助金と現場DXを掛け合わせた、唯一無二のアプローチ。</p>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                num: "01",
                icon: "🤖",
                en: "AI Workload Automation",
                title: "AI業務自動化",
                body: "最新AIツールを活用し、発注・在庫・帳票・シフトなど、オーナーを縛る事務作業を自動化。時間を本業に取り戻します。",
              },
              {
                num: "02",
                icon: "🏪",
                en: "Next-gen Store Management DX",
                title: "次世代店舗DX",
                body: "POSや予約・顧客管理のデジタル化で、現場の混乱をなくし売上データを経営判断に活かせる店づくりをサポートします。",
              },
              {
                num: "03",
                icon: "💰",
                en: "Strategic Subsidy Solutions",
                title: "補助金戦略支援",
                body: "ものづくり補助金・IT導入補助金など、設備投資やDX導入のコストを補助金で最大限に圧縮。資金面の障壁を取り除きます。",
              },
            ].map(({ num, icon, en, title, body }) => (
              <div
                key={num}
                className="relative p-8 rounded-2xl border group hover:scale-105 transition-all duration-300"
                style={{ borderColor: "rgba(201,168,76,0.25)", background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-5xl font-black mb-4 opacity-20" style={{ color: GOLD }}>{num}</p>
                <span className="text-4xl block mb-3">{icon}</span>
                <p className="text-xs tracking-widest uppercase mb-1 opacity-60" style={{ color: GOLD }}>{en}</p>
                <h3 className="text-xl font-black mb-3" style={{ color: GOLD }}>{title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{body}</p>
                <div
                  className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full rounded-b-2xl transition-all duration-500"
                  style={{ background: GOLD }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ サービス内容 ━━━ */}
      <section className="bg-gray-50 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
            Services
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4" style={{ color: NAVY }}>
            サービス内容
          </h2>
          <p className="text-center text-gray-500 mb-16">補助金申請から現場DXまで、ワンストップでサポート。</p>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "⚙️",
                title: "AI業務効率化サポート",
                badge: "Strategic Subsidy Solutions",
                price: "月額制プラン",
                items: [
                  "発注・在庫管理のAI自動化",
                  "帳票・シフト作成の自動化",
                  "経営ダッシュボードの構築",
                  "チャットサポート付き",
                ],
              },
              {
                icon: "🏪",
                title: "次世代店舗DX支援",
                badge: "Next-gen Store Management DX",
                price: "初回相談無料",
                items: [
                  "POSシステム導入・最適化",
                  "予約・顧客管理のデジタル化",
                  "売上データ活用の仕組み構築",
                  "導入後の運用サポート",
                ],
              },
              {
                icon: "📝",
                title: "補助金診断・申請サポート",
                badge: "Strategic Subsidy Solutions",
                price: "完全成功報酬制",
                items: [
                  "利用可能な補助金の無料診断",
                  "申請書類のAI補助作成",
                  "採択後の交付申請まで対応",
                  "ものづくり・IT導入補助金等",
                ],
              },
            ].map(({ icon, title, badge, price, items }) => (
              <div key={title} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">
                <div className="px-8 py-6 text-white" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2f5e 100%)` }}>
                  <span className="text-4xl block mb-3">{icon}</span>
                  <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">{badge}</p>
                  <h3 className="text-lg font-black leading-tight">{title}</h3>
                  <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full" style={{ background: GOLD, color: NAVY }}>
                    {price}
                  </span>
                </div>
                <ul className="px-8 py-6 space-y-3">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <span style={{ color: GOLD }} className="mt-0.5 font-bold flex-shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <h3 className="text-xl font-black text-center mb-8" style={{ color: NAVY }}>
              ご相談から採択までの流れ
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
              {[
                { step: "STEP 1", label: "お問い合わせ", desc: "現状ヒアリング" },
                { step: "STEP 2", label: "無料診断", desc: "最適プランを提案" },
                { step: "STEP 3", label: "書類作成", desc: "AIで爆速サポート" },
                { step: "STEP 4", label: "採択・導入", desc: "最大3,000万円" },
              ].map(({ step, label, desc }, i) => (
                <div key={step} className="flex sm:flex-col items-center flex-1 w-full sm:w-auto">
                  <div
                    className="text-center px-4 py-5 rounded-2xl w-full"
                    style={{
                      background: i % 2 === 0 ? NAVY : "white",
                      color: i % 2 === 0 ? "white" : NAVY,
                      border: i % 2 !== 0 ? `2px solid ${NAVY}` : "none",
                    }}
                  >
                    <p className="text-xs font-bold tracking-widest mb-1 opacity-60">{step}</p>
                    <p className="text-lg font-black">{label}</p>
                    <p className="text-xs mt-1 opacity-70">{desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden sm:block text-2xl font-black mx-2" style={{ color: GOLD }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 問い合わせ ━━━ */}
      <section
        style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)` }}
        className="py-24 px-4 text-white text-center relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(${GOLD} 1.5px, transparent 1.5px)`, backgroundSize: "24px 24px" }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="text-sm font-bold tracking-[0.2em] uppercase mb-4" style={{ color: GOLD }}>Contact</p>
          <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
            まず、<span style={{ color: GOLD }}>無料相談</span>から<br />始めましょう。
          </h2>
          <p className="text-gray-400 mb-10 leading-relaxed">
            「補助金が使えるか分からない」「何をDX化すればいい？」<br />
            どんな小さな疑問でもOK。秘密厳守でお答えします。
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-0 text-sm text-gray-500">
            {["✅ 完全無料", "✅ 秘密厳守", "✅ 原則24時間以内にご返信", "✅ 強引な営業なし"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          {/* プロフィール — 名前はここの末尾にのみ表示 */}
          <div
            className="mt-16 p-8 rounded-2xl text-left flex flex-col sm:flex-row items-center gap-6 border"
            style={{ borderColor: "rgba(201,168,76,0.2)", background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center font-black border-2 text-2xl"
              style={{ borderColor: GOLD, background: "rgba(201,168,76,0.1)", color: GOLD }}
            >
              IT
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase mb-1" style={{ color: GOLD }}>About</p>
              <p className="font-black text-lg">Infotainment</p>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                AIと補助金と現場DXを掛け合わせた独自の視点で、飲食店・小売店の
                業務効率化・デジタル化・資金調達を一気通貫でサポート。
                テクノロジーと現場の間に立ち、オーナーの未来を設計します。
              </p>
              <p className="text-xs mt-4 opacity-40" style={{ color: GOLD }}>代表 向田 侑矢</p>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-6 text-center text-xs" style={{ background: NAVY_DARK }}>
        <p style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2024 Infotainment（インフォテインメント） — 代表 向田 侑矢. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
