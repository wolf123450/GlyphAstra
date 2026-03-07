import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/global.css";

const app = createApp(App);
const pinia = createPinia();

// ── Production error overlay ─────────────────────────────────────────────────
// Makes startup crashes visible even when DevTools are disabled.
// Shows the error on-screen so it can be read & reported.
if (import.meta.env.PROD) {
  const showError = (msg: string) => {
    // Try to write to localStorage so errors survive a restart
    try { localStorage.setItem('__ga_last_error', msg) } catch (_) {}
    const el = document.getElementById('__ga_err') ?? document.createElement('div')
    el.id = '__ga_err'
    el.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:#1a1a1a', 'color:#ff6b6b',
      'padding:32px', 'font:13px/1.6 monospace',
      'white-space:pre-wrap', 'overflow:auto',
    ].join(';'))
    el.textContent = 'Glyph Astra — startup error\n\n' + msg
    document.body?.appendChild(el)
  }

  app.config.errorHandler = (err, _vm, info) => {
    const e = err instanceof Error ? (err.stack ?? err.message) : String(err)
    showError(`Vue error [${info}]:\n${e}`)
  }

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason
    showError(`Unhandled rejection:\n${r instanceof Error ? (r.stack ?? r.message) : String(r)}`)
  })

  // Catch any error that fires before Vue is ready (module-level throws, etc.)
  window.onerror = (_msg, _src, _line, _col, err) => {
    showError(`Uncaught error:\n${err instanceof Error ? (err.stack ?? err.message) : String(err ?? _msg)}`)
  }

  // Show any error from a previous run
  const prev = localStorage.getItem('__ga_last_error')
  if (prev) {
    console.warn('[GlyphAstra] Previous run error:\n', prev)
    localStorage.removeItem('__ga_last_error')
  }
}

app.use(pinia);
app.mount("#app");
