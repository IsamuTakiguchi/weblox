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

        <h2>🎮 あそびかた（Roblox とおなじ操作）</h2>
        <p>ゲームをえらんで「▶ あそぶ」をおすと、全画面でゲームがはじまります。左上のロゴボタン（または <kbd>Esc</kbd>）でメニューが開き、つづける・さいしょから・やめるがえらべます。</p>
        <ul>
          <li>
            <b>📱 スマホ・タブレット</b>：画面の<b>左側</b>をなぞると、その場所にジョイスティックが出てうごけます。右下の <b>⬆</b> ボタンでジャンプ。3D では画面の<b>右側</b>をなぞるとカメラがまわり、2 本指でひらく・とじるとズームします。
          </li>
          <li>
            <b>⌨️ パソコン</b>：<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> か矢印キーでうごき、<kbd>スペース</kbd> でジャンプ。3D ではマウスをドラッグしてカメラをまわし、ホイールか <kbd>I</kbd> <kbd>O</kbd> でズーム。
            <kbd>F</kbd> で全画面。
          </li>
          <li>
            <b>あるくゲーム</b>は上から見た画面、<b>ジャンプゲーム</b>は横から見た画面、<b>3D ゲーム</b>はうしろから見る三人称視点。てきは上からふむとたおせる。おちると 1 ミス。
          </li>
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

        <h2>🔥 Roblox で人気のあそび（風）</h2>
        <p>
          ホームの「Roblox で人気のあそび（風）」には、Roblox で人気のゲームをまねした ひとりで遊べるミニ版があります。「はたけを そだてよう」（Grow a Garden 風）と「つりの たび」（Fisch
          風）はタップだけで遊べます。「てっぺんまで のぼれ！タワー」（Tower of Hell 風）、「スピードラン！」、「ブロックの まち」（Brookhaven 風）、「フロア・イズ・ラバ」は 3D
          のオビーです。スタジオの「だん2〜5」タイルを使えば、自分でも高さのあるタワーが作れます。
        </p>

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
