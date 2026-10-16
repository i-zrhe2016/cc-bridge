'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import translations from './translations.json';
import './landing.css';

type Language = keyof typeof translations;
const loginLabels: Record<Language, string> = {
  'zh-Hans': '登录',
  'zh-Hant': '登入',
  'en': 'Log in',
  'es': 'Iniciar sesión',
  'fr': 'Connexion',
  'de': 'Anmelden',
  'ja': 'ログイン',
  'pt': 'Entrar',
  'ar': 'تسجيل الدخول',
  'ko': '로그인',
};
const workspaceLabels: Record<Language, string> = {
  'zh-Hans': '体验工作台',
  'zh-Hant': '體驗工作台',
  'en': 'Try workspace',
  'es': 'Probar panel',
  'fr': 'Essayer le tableau de bord',
  'de': 'Arbeitsbereich testen',
  'ja': 'ワークスペースを試す',
  'pt': 'Experimentar painel',
  'ar': 'جرّب مساحة العمل',
  'ko': '워크스페이스 체험',
};
const messages: Record<
  Language,
  { copied: string; fallback: string; language: string; title: string }
> = {
  'en': {
    copied: 'Copied ✓',
    fallback: 'Configuration selected. Please copy it manually.',
    language: 'Language',
    title: 'CC Bridge — Use GPT in Claude Code',
  },
  'zh-Hans': {
    copied: '已复制 ✓',
    fallback: '已选中配置，请手动复制',
    language: '选择语言',
    title: 'CC Bridge — 在 Claude Code 中使用 GPT',
  },
  'zh-Hant': {
    copied: '已複製 ✓',
    fallback: '已選取設定，請手動複製',
    language: '選擇語言',
    title: 'CC Bridge — 在 Claude Code 中使用 GPT',
  },
  'es': {
    copied: 'Copiado ✓',
    fallback: 'Configuración seleccionada. Cópiala manualmente.',
    language: 'Idioma',
    title: 'CC Bridge — Usa GPT en Claude Code',
  },
  'fr': {
    copied: 'Copié ✓',
    fallback: 'Configuration sélectionnée. Copiez-la manuellement.',
    language: 'Langue',
    title: 'CC Bridge — Utilisez GPT dans Claude Code',
  },
  'de': {
    copied: 'Kopiert ✓',
    fallback: 'Konfiguration markiert. Bitte manuell kopieren.',
    language: 'Sprache',
    title: 'CC Bridge — GPT in Claude Code nutzen',
  },
  'ja': {
    copied: 'コピーしました ✓',
    fallback: '設定を選択しました。手動でコピーしてください。',
    language: '言語',
    title: 'CC Bridge — Claude Code で GPT を使う',
  },
  'pt': {
    copied: 'Copiado ✓',
    fallback: 'Configuração selecionada. Copie manualmente.',
    language: 'Idioma',
    title: 'CC Bridge — Use GPT no Claude Code',
  },
  'ar': {
    copied: 'تم النسخ ✓',
    fallback: 'تم تحديد الإعدادات. يرجى نسخها يدويًا.',
    language: 'اللغة',
    title: 'CC Bridge — استخدم GPT داخل Claude Code',
  },
  'ko': {
    copied: '복사됨 ✓',
    fallback: '설정이 선택되었습니다. 직접 복사해 주세요.',
    language: '언어',
    title: 'CC Bridge — Claude Code에서 GPT 사용',
  },
};

function isLanguage(value: string | null): value is Language {
  return value !== null && Object.hasOwn(translations, value);
}
function matchLanguage(tag: string): Language | undefined {
  const code = tag.toLowerCase().replaceAll('_', '-');
  if (code === 'zh' || code.startsWith('zh-')) {
    return /hant|tw|hk|mo/.test(code) ? 'zh-Hant' : 'zh-Hans';
  }
  const base = code.split('-')[0] ?? '';
  return isLanguage(base) ? base : undefined;
}

export default function LandingPage() {
  const [language, setLanguage] = useState<Language>('zh-Hans');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const configurationRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const t = (index: number) => translations[language][index];

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('cc-bridge-language');
    }
    catch {
      /* Browser storage may be unavailable. */
    }
    const detected = (navigator.languages?.length ? navigator.languages : [navigator.language])
      .map(matchLanguage)
      .find(Boolean);
    // Browser preferences are only available after hydration.
    // eslint-disable-next-line react/set-state-in-effect
    setLanguage(isLanguage(saved) ? saved : (detected ?? 'en'));
    return () => {
      clearTimeout(timerRef.current);
      document.documentElement.lang = 'zh-CN';
      document.documentElement.dir = 'ltr';
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = messages[language].title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', `${translations[language][7]} ${translations[language][8]}`);
  }, [language]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    setCopied(false);
    setToast('');
    try {
      localStorage.setItem('cc-bridge-language', next);
    }
    catch {
      /* Language switching also works without storage. */
    }
  }
  async function copyConfiguration() {
    const configuration = configurationRef.current;
    if (!configuration) {
      return;
    }
    clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(configuration.textContent ?? '');
      setCopied(true);
      timerRef.current = setTimeout(setCopied, 2000, false);
    }
    catch {
      const range = document.createRange();
      range.selectNodeContents(configuration);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setToast(messages[language].fallback);
      timerRef.current = setTimeout(setToast, 3000, '');
    }
  }

  return (
    <div className="landing-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {'\n'}
      <header>
        <nav>
          <Link href="/" className="brand" aria-label="CC Bridge 首页">
            <span className="mark" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            CC Bridge
            <span style={{ color: '#aaa', fontWeight: '400' }}>.</span>
          </Link>
          <div className="links">
            <a href="#features">{t(0)}</a>
            <a href="#start">{t(1)}</a>
            <a href="#faq">{t(2)}</a>
            <select
              id="language"
              className="language"
              aria-label={messages[language].language}
              value={language}
              onChange={event => changeLanguage(event.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="zh-Hans">简体中文</option>
              <option value="zh-Hant">繁體中文</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="pt">Português</option>
              <option value="ar">العربية</option>
              <option value="ko">한국어</option>
            </select>
            <Link href="/auth/sign-in" className="login-link">
              {loginLabels[language]}
            </Link>
            <Link className="nav-cta" href="/auth/sign-in">
              {t(3)}
            </Link>
          </div>
        </nav>
      </header>
      {'\n'}
      <main>
        <div className="workspace-entry">
          <Link href="/dashboard">
            {workspaceLabels[language]}
            {' '}
            ↗
          </Link>
        </div>
        <section className="hero">
          <div className="eyebrow">
            <span className="dot"></span>
            {t(4)}
          </div>
          <h1>
            {t(5)}
            <br />
            <span>{t(6)}</span>
          </h1>
          <p className="lead">
            {t(7)}
            <br />
            {t(8)}
          </p>
          <div className="actions">
            <Link href="/auth/sign-in" className="btn primary">
              {t(9)}
              <span>↗</span>
            </Link>
            <a href="#how" className="btn">
              {t(10)}
              <span>↓</span>
            </a>
          </div>
          <div className="micro">{t(11)}</div>
          {'\n'}
          <div className="diagram" id="how">
            <div className="windowbar">
              <i></i>
              <i></i>
              <i></i>
              <span>{t(12)}</span>
              <span className="live">{t(13)}</span>
            </div>
            <div className="flow">
              <div className="endpoint">
                <strong>⌘ Claude Code</strong>
                <small>Anthropic Messages</small>
              </div>
              <div className="connector">
                REQUEST
                <b>→</b>
              </div>
              <div className="endpoint center">
                <strong>CC Bridge</strong>
                <small>{t(14)}</small>
              </div>
              <div className="connector">
                FORWARD
                <b>→</b>
              </div>
              <div className="endpoint">
                <strong>✳ GPT</strong>
                <small>OpenAI API</small>
              </div>
            </div>
            <div className="flow-note">
              <span>{t(15)}</span>
              <span>{t(16)}</span>
            </div>
          </div>
          <div className="intro-strip">
            <span>{t(17)}</span>
            <span>{t(18)}</span>
            <span>{t(19)}</span>
          </div>
        </section>
        {'\n'}
        <section className="section" id="features">
          <div className="section-label">01 / CC BRIDGE</div>
          <div className="section-head">
            <h2>{t(20)}</h2>
            <p>
              {t(21)}
              <br />
              {t(22)}
            </p>
          </div>
          <div className="features">
            <article className="feature">
              <span className="icon">⌘</span>
              <h3>{t(23)}</h3>
              <p>{t(24)}</p>
            </article>
            <article className="feature">
              <span className="icon">⇄</span>
              <h3>{t(25)}</h3>
              <p>{t(26)}</p>
            </article>
            <article className="feature">
              <span className="icon">↗</span>
              <h3>{t(27)}</h3>
              <p>{t(28)}</p>
            </article>
          </div>
        </section>
        {'\n'}
        <section className="section setup" id="start">
          <div>
            <div className="section-label">02 / QUICK START</div>
            <h2>
              {t(29)}
              <br />
              {t(30)}
            </h2>
            <p>
              {t(31)}
              <br />
              {t(32)}
            </p>
            <div className="steps">
              <span>
                <b>01</b>
                {t(33)}
              </span>
              <span>
                <b>02</b>
                {t(34)}
              </span>
              <span>
                <b>03</b>
                {t(35)}
              </span>
            </div>
          </div>
          <div className="terminal">
            <div className="terminal-top">
              <span>{t(36)}</span>
              <button className="copy" id="copy" type="button" onClick={copyConfiguration}>
                {copied ? messages[language].copied : t(37)}
              </button>
            </div>
            <pre id="config" ref={configurationRef}>
              <span className="comment">{t(38)}</span>
              {'\nexport ANTHROPIC_BASE_URL='}
              <span className="value">"https://your-gateway.example"</span>
              {'\nexport ANTHROPIC_AUTH_TOKEN='}
              <span className="value">"your-api-key"</span>
              {'\nexport ANTHROPIC_MODEL='}
              <span className="value">"your-gpt-model"</span>
              {'\n\n'}
              <span className="comment">{t(39)}</span>
              {'\nclaude'}
            </pre>
            <div className="terminal-bottom">{t(40)}</div>
          </div>
        </section>
        {'\n'}
        <section className="faq" id="faq">
          <h2>{t(41)}</h2>
          <details open>
            <summary>{t(42)}</summary>
            <p>{t(43)}</p>
          </details>
          <details>
            <summary>{t(44)}</summary>
            <p>{t(45)}</p>
          </details>
          <details>
            <summary>{t(46)}</summary>
            <p>{t(47)}</p>
          </details>
          <details>
            <summary>{t(48)}</summary>
            <p>{t(49)}</p>
          </details>
          <details>
            <summary>{t(50)}</summary>
            <p>{t(51)}</p>
          </details>
        </section>
        {'\n'}
        <section className="closing">
          <div className="section-label" style={{ marginBottom: '18px' }}>
            LESS FRICTION. MORE BUILDING.
          </div>
          <h2>{t(52)}</h2>
          <Link href="/auth/sign-in" className="btn primary">
            {t(9)}
            <span>↗</span>
          </Link>
        </section>
      </main>
      <footer>
        <Link className="brand" href="/">
          CC Bridge
        </Link>
        <p>
          {t(53)}
          <br />
          {t(54)}
        </p>
      </footer>
      <div
        role="status"
        className={toast ? 'toast show' : 'toast'}
        id="toast"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast}
      </div>
    </div>
  );
}
