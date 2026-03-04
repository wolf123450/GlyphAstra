<template>
  <Teleport to="body">
    <div v-if="show" class="md-ref-overlay" @click.self="$emit('close')">
      <div class="md-ref-modal" role="dialog" aria-modal="true" aria-label="Markdown Reference" @keydown.escape="$emit('close')" tabindex="-1" ref="modalEl">
        <div class="md-ref-header">
          <span class="md-ref-title">Markdown Reference</span>
          <button class="md-ref-close" @click="$emit('close')" title="Close (Esc)" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="mdiClose"/></svg></button>
        </div>

        <div class="md-ref-body">
          <p class="md-ref-intro">All supported syntax in Glyph Astra's seamless, markdown, and preview modes.</p>

          <!-- ─── Headings ──────────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Headings</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr><td><code># Heading 1</code></td><td><span class="ex-h1">Heading 1</span></td></tr>
                <tr><td><code>## Heading 2</code></td><td><span class="ex-h2">Heading 2</span></td></tr>
                <tr><td><code>### Heading 3</code></td><td><span class="ex-h3">Heading 3</span></td></tr>
                <tr><td><code>#### Heading 4</code></td><td><span class="ex-h4">Heading 4</span></td></tr>
                <tr><td><code>##### Heading 5</code></td><td><span class="ex-h5">Heading 5</span></td></tr>
                <tr><td><code>###### Heading 6</code></td><td><span class="ex-h6">Heading 6</span></td></tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Text Formatting ─────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Text Formatting</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr><td><code>**bold text**</code></td><td><strong>bold text</strong></td></tr>
                <tr><td><code>*italic text*</code></td><td><em>italic text</em></td></tr>
                <tr><td><code>_italic text_</code></td><td><em>italic text</em></td></tr>
                <tr><td><code>**bold and *italic***</code></td><td><strong>bold and <em>italic</em></strong></td></tr>
                <tr><td><code>~~strikethrough~~</code></td><td><s>strikethrough</s></td></tr>
                <tr><td><code>`inline code`</code></td><td><code class="ex-inline-code">inline code</code></td></tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Lists ────────────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Lists</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <code>- First item</code><br>
                    <code>- Second item</code><br>
                    <code>&nbsp;&nbsp;- Nested item</code>
                  </td>
                  <td>
                    <ul class="ex-list">
                      <li>First item</li>
                      <li>Second item
                        <ul class="ex-list ex-nested"><li>Nested item</li></ul>
                      </li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>1. First item</code><br>
                    <code>2. Second item</code><br>
                    <code>3. Third item</code>
                  </td>
                  <td>
                    <ol class="ex-list">
                      <li>First item</li>
                      <li>Second item</li>
                      <li>Third item</li>
                    </ol>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Blockquotes ──────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Blockquotes</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>&gt; A quoted passage</code></td>
                  <td><blockquote class="ex-blockquote">A quoted passage</blockquote></td>
                </tr>
                <tr>
                  <td><code>&gt;&gt; Nested quote</code></td>
                  <td>
                    <blockquote class="ex-blockquote">
                      <blockquote class="ex-blockquote ex-nested-bq">Nested quote</blockquote>
                    </blockquote>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Code Blocks ──────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Fenced Code Blocks</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <code>```javascript</code><br>
                    <code>const x = 42;</code><br>
                    <code>```</code>
                  </td>
                  <td>
                    <div class="ex-fenced">
                      <span class="ex-lang-label">javascript</span>
                      <pre>const x = 42;</pre>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>```</code><br>
                    <code>plain text block</code><br>
                    <code>```</code>
                  </td>
                  <td>
                    <div class="ex-fenced">
                      <pre>plain text block</pre>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Links ────────────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Links</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>[Link text](https://example.com)</code></td>
                  <td><a class="ex-link">Link text</a></td>
                </tr>
                <tr>
                  <td><code>[Chapter name](chapter://Chapter%20Name)</code></td>
                  <td><a class="ex-link ex-chapter-link">Chapter name</a> <span class="ex-note">(navigates to that chapter)</span></td>
                </tr>
                <tr>
                  <td><code>[Story title](story://story-id)</code></td>
                  <td><a class="ex-link ex-chapter-link">Story title</a> <span class="ex-note">(opens that story)</span></td>
                </tr>
                <tr>
                  <td><code>[Ch. 1 in Book 2](story://story-id/chapter-id)</code></td>
                  <td><a class="ex-link ex-chapter-link">Ch. 1 in Book 2</a> <span class="ex-note">(opens story, lands on chapter)</span></td>
                </tr>
                <tr>
                  <td colspan="2" class="ex-tip">
                    💡 In Seamless mode, use <kbd>Ctrl+Click</kbd> to follow a link.
                    External links open in your system browser.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Images ───────────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Images</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>![Alt text](https://example.com/image.png)</code></td>
                  <td><span class="ex-img-placeholder">🖼️ Alt text <span class="ex-note">(remote image)</span></span></td>
                </tr>
                <tr>
                  <td><code>![Caption](./images/cover.jpg)</code></td>
                  <td><span class="ex-img-placeholder">🖼️ Caption <span class="ex-note">(local path, relative to story folder)</span></span></td>
                </tr>
                <tr>
                  <td><code>![Caption|w300](./cover.jpg)</code></td>
                  <td><span class="ex-img-placeholder">🖼️ <span class="ex-note">explicit width 300 px, height auto (ratio preserved)</span></span></td>
                </tr>
                <tr>
                  <td><code>![Caption|h150](./cover.jpg)</code></td>
                  <td><span class="ex-img-placeholder">🖼️ <span class="ex-note">explicit height 150 px, width auto</span></span></td>
                </tr>
                <tr>
                  <td><code>![Caption|w300 h200](./cover.jpg)</code></td>
                  <td><span class="ex-img-placeholder">🖼️ <span class="ex-note">both set — only width used (ratio preserved); use the resize handle to set a free size</span></span></td>
                </tr>
                <tr>
                  <td colspan="2" class="ex-tip">
                    💡 In Seamless mode, <strong>click a rendered image</strong> to show the grab-handle overlay.
                    Drag the <strong>SE corner handle</strong> to resize. The 🔒 button toggles aspect-ratio lock (default: locked).
                    Local paths are relative to the story folder; remote URLs are lazy-loaded.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Horizontal Rules ─────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Horizontal Rule</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>---</code> or <code>***</code></td>
                  <td><hr class="ex-hr"></td>
                </tr>
                <tr>
                  <td colspan="2" class="ex-tip">Must be on its own line with no other content.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Combinations ─────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Nesting &amp; Combinations</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Result</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>## Heading with **bold**</code></td>
                  <td><span class="ex-h2">Heading with <strong>bold</strong></span></td>
                </tr>
                <tr>
                  <td><code>- Item with *italic* and `code`</code></td>
                  <td>
                    <ul class="ex-list"><li>Item with <em>italic</em> and <code class="ex-inline-code">code</code></li></ul>
                  </td>
                </tr>
                <tr>
                  <td><code>&gt; Quote with **bold**</code></td>
                  <td><blockquote class="ex-blockquote">Quote with <strong>bold</strong></blockquote></td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Tables ──────────────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Tables</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Rendered</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <code>| Col A | Col B |</code><br>
                    <code>|-------|-------|</code><br>
                    <code>| Val 1 | Val 2 |</code><br>
                    <code>| Val 3 | Val 4 |</code>
                  </td>
                  <td>
                    <div class="ex-table-wrapper">
                      <table class="ex-table">
                        <thead><tr><th>Col A</th><th>Col B</th></tr></thead>
                        <tbody>
                          <tr><td>Val 1</td><td>Val 2</td></tr>
                          <tr><td>Val 3</td><td>Val 4</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" class="ex-tip">
                    Column alignment: <code>|:---|</code> left &nbsp;·&nbsp;
                    <code>|---:|</code> right &nbsp;·&nbsp;
                    <code>|:---:|</code> center<br>
                    Cells can contain inline formatting: <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- ─── Escape Characters ────────────────────────── -->
          <section class="md-section">
            <h3 class="md-section-title">Escape Characters</h3>
            <table class="md-table">
              <thead><tr><th>Syntax</th><th>Result</th></tr></thead>
              <tbody>
                <tr><td><code>\*</code></td><td>*</td></tr>
                <tr><td><code>\_</code></td><td>_</td></tr>
                <tr><td><code>\~</code></td><td>~</td></tr>
                <tr><td><code>\`</code></td><td>`</td></tr>
                <tr><td><code>\[</code></td><td>[</td></tr>
                <tr><td><code>\#</code></td><td>#</td></tr>
                <tr><td><code>\|</code></td><td>|</td></tr>
                <tr><td><code>\\</code></td><td>\</td></tr>
                <tr>
                  <td colspan="2" class="ex-tip">
                    Prefix any Markdown control character with <code>\</code> to render it literally.
                    Works inside headings, list items, blockquotes, and table cells.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div><!-- /body -->
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { mdiClose } from '@mdi/js'

const props = defineProps<{ show: boolean }>()
defineEmits<{ close: [] }>()

const modalEl = ref<HTMLElement | null>(null)

watch(() => props.show, async (val) => {
  if (val) {
    await nextTick()
    modalEl.value?.focus()
  }
})
</script>

<style scoped>
/* ─── Overlay ─────────────────────────────────────────── */
.md-ref-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* ─── Modal shell ─────────────────────────────────────── */
.md-ref-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 680px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  outline: none;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* ─── Header ──────────────────────────────────────────── */
.md-ref-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.md-ref-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.md-ref-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}
.md-ref-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* ─── Body ────────────────────────────────────────────── */
.md-ref-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.md-ref-intro {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

/* ─── Sections ────────────────────────────────────────── */
.md-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.md-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-color);
  margin: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

/* ─── Table ───────────────────────────────────────────── */
.md-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.md-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  width: 50%;
}

.md-table td {
  padding: 8px 10px;
  vertical-align: middle;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);
  color: var(--text-primary);
  line-height: 1.5;
}

.md-table tr:last-child td {
  border-bottom: none;
}

.md-table code {
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  color: var(--accent-color);
  background: var(--bg-tertiary, color-mix(in srgb, var(--bg-primary) 50%, var(--bg-secondary)));
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

/* ─── Rendered example elements ───────────────────────── */
.ex-h1 { font-size: 1.5em; font-weight: 700; color: var(--text-primary); }
.ex-h2 { font-size: 1.25em; font-weight: 700; color: var(--text-primary); }
.ex-h3 { font-size: 1.1em;  font-weight: 600; color: var(--text-primary); }
.ex-h4 { font-size: 1em;    font-weight: 600; color: var(--text-primary); }
.ex-h5 { font-size: 0.9em;  font-weight: 500; color: var(--text-muted);   }
.ex-h6 { font-size: 0.85em; font-weight: 500; color: var(--text-muted);   font-style: italic; }

.ex-inline-code {
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  background: var(--bg-tertiary, color-mix(in srgb, var(--bg-primary) 50%, var(--bg-secondary)));
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--accent-color);
}

.ex-list {
  margin: 0;
  padding-left: 18px;
  list-style-type: disc;
}
ol.ex-list {
  list-style-type: decimal;
}
.ex-nested {
  padding-left: 14px;
  margin-top: 2px;
  list-style-type: circle;
}

.ex-blockquote {
  margin: 0;
  padding: 2px 10px;
  border-left: 3px solid var(--accent-color);
  color: var(--text-muted);
  font-style: italic;
  background: color-mix(in srgb, var(--accent-color) 6%, transparent);
  border-radius: 0 3px 3px 0;
}
.ex-nested-bq {
  margin-top: 2px;
  opacity: 0.85;
}

.ex-fenced {
  background: var(--bg-tertiary, color-mix(in srgb, var(--bg-primary) 50%, var(--bg-secondary)));
  border: 1px solid var(--border-color);
  border-radius: 5px;
  padding: 6px 10px;
  position: relative;
}
.ex-fenced pre {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-primary);
}
.ex-lang-label {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'Fira Code', monospace;
  margin-bottom: 4px;
  opacity: 0.7;
}

.ex-link {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: default;
}
.ex-chapter-link {
  text-decoration: underline dashed;
}
.ex-img-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-style: italic;
  color: var(--text-secondary);
  font-size: 0.88em;
}
.ex-img-local {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.88em;
  font-style: italic;
}
.ex-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 4px;
}

.ex-hr {
  border: none;
  border-top: 1px solid var(--border-color);
  width: 100%;
  margin: 4px 0;
}

/* ─── Example table ─────────────────────────────────────────── */
.ex-table-wrapper {
  overflow-x: auto;
}

.ex-table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: 120px;
}

.ex-table th,
.ex-table td {
  border: 1px solid var(--border-color);
  padding: 3px 10px;
  text-align: left;
  white-space: nowrap;
}

.ex-table thead th {
  background: var(--bg-tertiary, color-mix(in srgb, var(--bg-primary) 50%, var(--bg-secondary)));
  font-weight: 600;
  color: var(--text-primary);
}

.ex-table tbody td {
  color: var(--text-primary);
}

.ex-tip {
  font-size: 12px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--accent-color) 5%, transparent);
  border-radius: 4px;
  padding: 6px 10px !important;
}

kbd {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  background: var(--bg-hover, var(--bg-primary));
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--text-primary);
}
</style>
