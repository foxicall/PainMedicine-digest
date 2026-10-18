import { useEffect, useState } from 'react';
import { Check, Download, Monitor, Smartphone } from 'lucide-react';
import { Modal } from './ui';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function AppInstall() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)');
    const isStandalone = () =>
      Boolean(standalone?.matches || (navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone());
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const completed = () => {
      setInstalled(true);
      setPrompt(null);
      setMessage('已安裝，可從主畫面或應用程式清單開啟。');
    };
    const modeChanged = () => setInstalled(isStandalone());
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', completed);
    standalone?.addEventListener?.('change', modeChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', completed);
      standalone?.removeEventListener?.('change', modeChanged);
    };
  }, []);

  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted'
        ? '安裝要求已送出，請依瀏覽器提示完成。'
        : '已取消安裝。你仍可使用瀏覽器選單，隨時安裝。');
    } catch {
      setMessage('無法開啟安裝視窗，請依下方步驟使用瀏覽器選單。');
    } finally {
      // A captured browser prompt is single-use, including a dismissed prompt.
      setPrompt(null);
      setBusy(false);
    }
  };

  return (
    <>
      <button className="app-install-entry" onClick={() => setOpen(true)}>
        <Download size={16} /> <span>App 安裝</span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title="安裝 Pain Medicine App"
        description="將文獻閱讀工作區加入主畫面，從手機、平板或電腦快速開啟。">
        <div className="app-install-content" lang="zh-Hant">
          <div className="app-install-status">
            {installed ? <p><Check size={18} /> 已安裝或正在 App 模式中開啟。</p> : prompt ? (
              <button className="button button-primary" onClick={install} disabled={busy}>
                <Download size={16} /> {busy ? '正在開啟安裝視窗…' : '安裝到此裝置'}
              </button>
            ) : <p>請使用下方對應裝置的步驟。瀏覽器支援直接安裝時，這裡會顯示安裝按鈕。</p>}
            <p role="status" aria-live="polite">{message}</p>
          </div>
          <section className="app-install-guide" aria-labelledby="install-apple">
            <h3 id="install-apple"><Smartphone size={18} /> iPhone／iPad</h3>
            <ol>
              <li>使用 Safari 開啟本網站。</li>
              <li>點選「分享」，再選「加入主畫面」。</li>
              <li>若顯示「以網頁 App 打開」，請開啟後點選「加入」。</li>
            </ol>
          </section>
          <section className="app-install-guide" aria-labelledby="install-android">
            <h3 id="install-android"><Smartphone size={18} /> Android</h3>
            <ol>
              <li>使用 Chrome 開啟本網站。</li>
              <li>開啟右上角選單，選「安裝應用程式」或「加到主畫面」。</li>
              <li>依畫面提示確認，即可從主畫面開啟。</li>
            </ol>
          </section>
          <section className="app-install-guide" aria-labelledby="install-desktop">
            <h3 id="install-desktop"><Monitor size={18} /> 電腦</h3>
            <ol>
              <li>Chrome／Edge：點選網址列安裝圖示，或在瀏覽器選單尋找「安裝」此網站。</li>
              <li>Mac Safari：在支援的 macOS 版本選「檔案」→「加入 Dock」。</li>
            </ol>
          </section>
          <p className="app-install-note">這是網頁 App，無須從 App Store 下載。更新文獻與 PubMed 搜尋需要網路。
            書籤、已讀狀態與筆記保存在目前的瀏覽器或 App，不會自動跨裝置同步；安裝後請確認資料，並定期匯出備份。</p>
          <a className="source-link" href="https://foxicall.github.io/PainMedicine-digest/" target="_blank" rel="noreferrer">
            開啟網站進行安裝 ↗
          </a>
          <p className="small-text muted">HTML 檔案預覽或內嵌瀏覽器可能無法安裝，請在完整瀏覽器中開啟網站。</p>
        </div>
      </Modal>
    </>
  );
}
