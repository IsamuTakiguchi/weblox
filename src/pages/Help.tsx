import { SpeakButton } from '../components/ui';
import { TILES } from '../engine/tiles';
import { hrefFor } from '../router';

export function HelpPage() {
  return (
    <main className="page">
      <div className="prose">
        <div className="kid-title" style={{ justifyContent: 'flex-start' }}>
          <span>❓ あそびかた・つくりかた</span>
          <SpeakButton text="あそびかたと つくりかたの せつめいです" />
        </div>

        <h2>🎮 あそびかた</h2>
        <ul>
          <li>
            <b>あるくゲーム</b>：<kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>（または W A S D）でうごく。
          </li>
          <li>
            <b>ジャンプゲーム</b>：<kbd>←</kbd> <kbd>→</kbd> でうごき、<kbd>スペース</kbd> か <kbd>↑</kbd> でジャンプ。てきは上からふむとたおせる。
          </li>
          <li>
            <b>3D ゲーム</b>：<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>（または矢印）でうごき、<kbd>スペース</kbd> でジャンプ。画面をドラッグするか{' '}
            <kbd>Q</kbd> <kbd>E</kbd> でカメラをまわせる。うしろから見る三人称視点で、おちると 1 ミス。
          </li>
          <li>スマホ・タブレットでは画面の下のボタンでそうさできます（3D は ↶ ↷ でカメラ）。</li>
          <li>クリアすると <b className="wbx">◈ ウェブックス</b> がもらえて、アバターのぼうしが買えます。</li>
        </ul>

        <h2>✨ かんたんモード（5さいから）</h2>
        <ol>
          <li>「せかい」をえらぶ（そうげん・うちゅう・うみ…）。あるく／ジャンプ／3D のどれで遊ぶかもえらぶ。3D では「あな」をあけると奈落になる。</li>
          <li>「しゅじんこう」をえらぶ。</li>
          <li>パーツをえらんで、マスをタッチしておく。「🎲 おまかせ」でランダムに作ることもできる。</li>
          <li>「▶ ためす」であそんでみて、「🎉 できた！」→「🌍 みんなにみせる」で公開。</li>
        </ol>
        <p>
          スタートやゴールを置きわすれても、自動でおぎなうので大丈夫。字がまだ読めないときは 🔊 ボタンでこえが読んでくれます（マイページで
          よみあげをオン／オフできます）。
        </p>

        <h2>🛠️ スタジオ（くわしくつくる）</h2>
        <p>大きなマップ、かぎとドア、ワープ、ばね、制限時間、クリア条件など、ルールを細かく決められます。JSON で書き出して友だちと交換もできます。</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {TILES.filter((t) => t.id !== 'empty').map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px', fontSize: 22 }}>{t.emoji}</td>
                <td style={{ padding: '6px 8px', fontWeight: 800 }}>{t.label}</td>
                <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{t.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>🌍 公開とシェアについて</h2>
        <p>
          「公開」すると、このアプリの『みんなのゲーム』に並びます。データはこの端末のブラウザに保存されるので、ほかの人にあそんでもらうときは
          「🔗 シェア」でリンクを送ってください。リンクの中にゲームがまるごと入っているので、サーバーもアカウントもいりません。
          受け取った人は「📚 ほぞん」で自分のライブラリに入れられます。
        </p>

        <h2>👨‍👩‍👧 おうちの方へ</h2>
        <ul>
          <li>個人情報の入力は不要で、通信もしません。すべてブラウザ内で動きます。</li>
          <li>アバターの名前はご家庭で決めてください（本名を入れる必要はありません）。</li>
          <li>ゲーム内のウェブックスは無料の遊びのポイントで、課金要素はありません。</li>
        </ul>

        <p>
          <a className="btn btn-primary" href={hrefFor({ name: 'home' })}>
            🏠 ホームへ
          </a>
        </p>
      </div>
    </main>
  );
}
