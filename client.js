/**
 * Browser half of the reading board.
 *
 * Three registrations, one store:
 * - a right-Sidebar tab type (`ask-reader`) with its body, so a pinned excerpt
 *   lives in the right column beside the conversation and reads as rendered
 *   Markdown rather than source;
 * - an icon action under every finalized assistant reply that pins that reply;
 * - a header button that reveals the column.
 *
 * The pinned text stays in the browser (localStorage, per Session). Asking about
 * it goes back through the composer: the panel inserts the selection as a
 * Markdown quote, so the user's question and the text it is about reach the model
 * together in the main chat.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ask-reader',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Copy namespace of the plugin's own visible text. */
    const NS = 'askReader'
    /** Tab kind the panel opens under. */
    const KIND = 'ask-reader'
    /** Implementation id: the key the body registers under and the type's own name. */
    const TAB_ID = 'dsh-ask-reader'
    const STORAGE_PREFIX = 'dsh-ask-reader:v1:'
    /** Most recent pins kept per Session. */
    const ENTRY_LIMIT = 40
    /** Quote budget toward the composer: a reply is already in the log, a pasted excerpt is not. */
    const QUOTE_LIMIT_REPLY = 2000
    const QUOTE_LIMIT_PASTE = 6000

    const DICT = {
      zh: {
        'tab.title': '阅读板',
        'guide.title': '阅读板',
        'guide.description': '把一段回复钉在这里慢慢看，再就其中看不懂的地方提问。',
        'header.open': '打开阅读板',
        'save.action': '存入阅读板',
        'save.open': '在阅读板中打开',
        'save.empty': '这一条没有可保存的文字。',
        'empty.title': '还没有内容',
        'empty.hint': '在助手回复下方点「存入阅读板」，或把一段文字粘贴到下面。',
        'compose.toggle': '粘贴一段文字',
        'compose.placeholder': '把想留着看的文字粘贴到这里……',
        'compose.save': '保存',
        'compose.cancel': '取消',
        'action.ask': '提问',
        'action.askSelection': '提问所选',
        'action.copy': '复制',
        'action.remove': '删除',
        'action.jump': '跳转',
        'action.expand': '展开',
        'action.collapse': '收起',
        'clear': '清空',
        'clear.confirm': '再点一次清空',
        'source.reply': '回复',
        'source.paste': '摘录',
        'pick.action': '添加到主聊天',
        'quote.suffix': '\n…（后略）',
        'note.quoted': '已把这段放进主聊天输入框，补上你的问题再发送。',
        'note.quotedClipped': '已把这段放进主聊天输入框，超出长度的部分已截断；补上你的问题再发送。',
        'note.copied': '已复制到剪贴板。',
        'note.copiedForAsk': '输入框不可用，这段已复制到剪贴板，可以直接粘贴到主聊天。',
        'note.copyFailed': '复制没有成功，请手动选中文字复制。',
        'note.saved': '已存入阅读板。',
        'note.alreadySaved': '这条回复已经在阅读板里了。',
        'note.jumpMissing': '这条消息已经不在当前加载的对话里了。',
        'note.storageFailed': '浏览器拒绝保存，这次的内容只在当前页面有效。',
        'unit.entries': '条',
      },
      en: {
        'tab.title': 'Reading board',
        'guide.title': 'Reading board',
        'guide.description': 'Pin a reply here to read it, then ask about the parts that are unclear.',
        'header.open': 'Open the reading board',
        'save.action': 'Pin to reading board',
        'save.open': 'Open in the reading board',
        'save.empty': 'This message has no text to pin.',
        'empty.title': 'Nothing pinned yet',
        'empty.hint': 'Use “Pin to reading board” under a reply, or paste text below.',
        'compose.toggle': 'Paste text',
        'compose.placeholder': 'Paste the text you want to keep…',
        'compose.save': 'Save',
        'compose.cancel': 'Cancel',
        'action.ask': 'Ask',
        'action.askSelection': 'Ask selection',
        'action.copy': 'Copy',
        'action.remove': 'Remove',
        'action.jump': 'Jump',
        'action.expand': 'Expand',
        'action.collapse': 'Collapse',
        'clear': 'Clear',
        'clear.confirm': 'Click again to clear',
        'source.reply': 'Reply',
        'source.paste': 'Excerpt',
        'pick.action': 'Send to chat',
        'quote.suffix': '\n… (truncated)',
        'note.quoted': 'Added to the main composer — add your question and send.',
        'note.quotedClipped': 'Added to the main composer; the part over the limit was cut — add your question and send.',
        'note.copied': 'Copied to the clipboard.',
        'note.copiedForAsk': 'Composer unavailable; the text is on the clipboard.',
        'note.copyFailed': 'Copy failed — select the text and copy it by hand.',
        'note.saved': 'Pinned.',
        'note.alreadySaved': 'This reply is already on the board.',
        'note.jumpMissing': 'That message is no longer in the loaded conversation.',
        'note.storageFailed': 'The browser refused to save it; it lasts only for this page.',
        'unit.entries': 'pinned',
      },
    }

    const CSS = [
      '.akr-root{display:flex;flex-direction:column;height:100%;min-height:0;gap:8px;padding:10px;box-sizing:border-box;',
      'color:var(--dsw-alias-label-primary);font-size:var(--dsw-font-markdown-base-font-size,13px);line-height:1.55;}',
      '.akr-head{display:flex;align-items:center;gap:8px;flex:none;min-height:22px;}',
      '.akr-head-title{font-weight:600;}',
      '.akr-head-meta{color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.akr-spacer{flex:1;min-width:0;}',
      '.akr-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:12px;line-height:18px;border-radius:var(--dsw-radius-sm,8px);padding:2px 7px;cursor:pointer;',
      'display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}',
      '.akr-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);}',
      '.akr-btn[disabled]{opacity:.45;cursor:default;}',
      '.akr-btn-strong{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-border-l2);}',
      '.akr-btn-strong:hover{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));}',
      '.akr-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;}',
      '.akr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,8px);',
      'background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;min-height:0;flex:none;}',
      '.akr-card-head{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.akr-card-title{flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.akr-time{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);',
      'font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '.akr-tag{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:999px;padding:0 6px;line-height:16px;}',
      // A card reads in full by default; 收起 only folds it back to a preview.
      '.akr-body{padding:2px 0;overflow-y:auto;max-height:120px;user-select:text;}',
      '.akr-body-open{max-height:none;overflow-y:visible;}',
      // The selection pill: the same floating control the chat shows over a
      // selection, so quoting here feels like quoting there.
      '.akr-pick{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:4px;padding:5px 10px;',
      'border:1px solid var(--dsw-alias-brand-primary,#4c9ef0);border-radius:999px;',
      'background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay));',
      'color:var(--dsw-alias-brand-primary,#4c9ef0);box-shadow:var(--dsw-elevation-panel,0 6px 20px rgba(0,0,0,.22));',
      'font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:600;line-height:18px;',
      'white-space:nowrap;cursor:pointer;}',
      '.akr-pick:hover{background:var(--dsw-alias-button-floating-hover,var(--dsw-alias-bg-layer-2));}',
      '.akr-card-foot{display:flex;align-items:center;gap:2px;padding:4px 6px;',
      'border-top:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;}',
      '.akr-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;',
      'color:var(--dsw-alias-label-secondary);text-align:center;padding:24px 14px;font-size:12.5px;}',
      '.akr-empty-title{color:var(--dsw-alias-label-primary);font-weight:600;}',
      '.akr-compose{flex:none;display:flex;flex-direction:column;gap:6px;}',
      '.akr-input{width:100%;box-sizing:border-box;resize:vertical;min-height:68px;max-height:220px;padding:8px;',
      'border-radius:var(--dsw-radius-sm,8px);border:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1.6;}',
      '.akr-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}',
      '.akr-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.akr-note{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.akr-note-error{color:var(--dsw-alias-state-error-primary);}',
      // Markdown: the reply is read as rendered prose, not as source.
      '.akr-md{padding:8px 10px;font-size:var(--dsw-font-markdown-base-font-size,13px);line-height:1.65;overflow-wrap:anywhere;}',
      '.akr-md>:first-child{margin-top:0;}',
      '.akr-md>:last-child{margin-bottom:0;}',
      '.akr-md p{margin:0 0 .6em;}',
      '.akr-md strong{font-weight:600;}',
      '.akr-md em{font-style:italic;}',
      '.akr-md del{text-decoration:line-through;color:var(--dsw-alias-label-secondary);}',
      '.akr-md a{color:var(--dsw-alias-brand-primary);text-decoration:none;}',
      '.akr-md a:hover{text-decoration:underline;}',
      '.akr-md ul,.akr-md ol{margin:.2em 0 .6em;padding-left:1.3em;}',
      '.akr-md li{margin:.12em 0;}',
      '.akr-md blockquote{margin:.4em 0;padding:.1em 0 .1em .7em;',
      'border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);}',
      '.akr-md-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:.8em 0;}',
      '.akr-md-h{font-weight:600;line-height:1.4;margin:.8em 0 .4em;}',
      '.akr-md-h1{font-size:1.35em;}',
      '.akr-md-h2{font-size:1.2em;}',
      '.akr-md-h3{font-size:1.08em;}',
      '.akr-md-h4,.akr-md-h5,.akr-md-h6{font-size:1em;}',
      '.akr-md-tablewrap{overflow-x:auto;margin:.5em 0;}',
      '.akr-md-table{border-collapse:collapse;font-size:12px;line-height:1.5;}',
      '.akr-md-table th,.akr-md-table td{border:1px solid var(--dsw-alias-border-l1);padding:3px 7px;text-align:left;vertical-align:top;}',
      '.akr-md-table th{background:var(--dsw-alias-bg-layer-2);font-weight:600;}',
      // Code chrome follows the chat's own markdown tokens, so a fence reads the
      // same here as it does in the conversation.
      '.akr-md-fence{margin:.5em 0;border-radius:var(--dsw-radius-sm,8px);overflow:hidden;',
      'background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-2));}',
      '.akr-md-lang{font-size:11px;color:var(--dsw-alias-label-secondary);padding:3px 10px;',
      'background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));}',
      '.akr-md-code{margin:0;padding:8px 10px;overflow-x:auto;background:transparent;',
      'color:var(--shiki-foreground,var(--dsw-alias-label-primary));',
      'font:var(--dsw-font-markdown-code-block,12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace);white-space:pre;}',
      '.akr-md-code code{font:inherit;background:none;border:0;padding:0;}',
      '.akr-icode{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.92em;',
      'background:var(--dsw-alias-markdown-inline-code,var(--dsw-alias-bg-layer-2));border-radius:4px;padding:0 4px;}',
    ].join('')

    /** Theme-token stylesheet, rendered as an element so unmounting removes it. */
    function Styles() {
      return h('style', { 'data-dsh-ask-reader': '' }, CSS)
    }

    /** The action glyph: a right arrow, the "send it into the right column" mark. */
    function ArrowGlyph(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': 'true', className: props && props.className,
      },
      h('path', {
        d: 'M2.9 8h9.2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M8.9 3.9 13 8l-4.1 4.1', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    // ------------------------------------------------------------- markdown ---

    /** Link targets a board can open: same rules as a chat link. */
    function safeHref(raw) {
      const value = String(raw || '').trim()
      return /^(https?:\/\/|mailto:)/i.test(value) ? value : undefined
    }

    /**
     * Inline Markdown as React nodes: code, strong, em, strike, link. Everything
     * else stays text, so nothing from a reply can become markup.
     * @param text - one block's inline source.
     * @param prefix - key prefix, unique within the card.
     * @returns the inline nodes.
     */
    function inlineNodes(text, prefix) {
      const source = String(text == null ? '' : text)
      const out = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g
      let last = 0
      let index = 0
      let match = pattern.exec(source)
      while (match !== null) {
        if (match.index > last) out.push(source.slice(last, match.index))
        const token = match[0]
        const key = prefix + '-' + (index++)
        if (token.charAt(0) === '`') {
          out.push(h('code', { className: 'akr-icode', key }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          out.push(h('strong', { key }, inlineNodes(token.slice(2, -2), key)))
        } else if (token.startsWith('~~')) {
          out.push(h('del', { key }, inlineNodes(token.slice(2, -2), key)))
        } else if (token.charAt(0) === '*') {
          out.push(h('em', { key }, inlineNodes(token.slice(1, -1), key)))
        } else if (token.charAt(0) === '_') {
          out.push(h('em', { key }, inlineNodes(token.slice(1, -1), key)))
        } else {
          const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
          const href = link ? safeHref(link[2]) : undefined
          if (link && href !== undefined) {
            out.push(h('a', { key, href, target: '_blank', rel: 'noreferrer noopener' }, inlineNodes(link[1], key)))
          } else {
            out.push(token)
          }
        }
        last = match.index + token.length
        match = pattern.exec(source)
      }
      if (last < source.length) out.push(source.slice(last))
      return out
    }

    /** One paragraph: its lines kept as line breaks, its markup as nodes. */
    function paragraph(lines, prefix) {
      const nodes = []
      lines.forEach((line, row) => {
        if (row > 0) nodes.push(h('br', { key: prefix + '-br' + row }))
        nodes.push(h(React.Fragment, { key: prefix + '-l' + row }, inlineNodes(line, prefix + '-' + row)))
      })
      return h('p', { key: prefix }, nodes)
    }

    /**
     * Syntax colours: the theme's own shiki palette (the same custom properties
     * the chat's code blocks resolve), so a fence here is coloured exactly like
     * one in the conversation and follows light/dark with the rest of the app.
     */
    const CODE_INK = {
      comment: 'var(--shiki-token-comment, var(--dsw-alias-label-secondary))',
      string: 'var(--shiki-token-string, #2f9e44)',
      constant: 'var(--shiki-token-constant, #1c7ed6)',
      keyword: 'var(--shiki-token-keyword, #d6336c)',
      function: 'var(--shiki-token-function, #6741d9)',
      punctuation: 'var(--shiki-token-punctuation, #495057)',
    }

    /** Lexical hints per language family: comment leaders, keywords, literal words. */
    const CODE_RULES = {
      js: {
        lines: ['//'], block: '/*',
        keywords: new Set(('const let var function return if else for while do switch case default break continue throw try catch '
          + 'finally new delete typeof instanceof in of class extends super this import from export async await yield static '
          + 'get set void interface type enum implements public private protected readonly as declare namespace').split(' ')),
        literals: new Set(['null', 'undefined', 'true', 'false', 'NaN', 'Infinity']),
      },
      py: {
        lines: ['#'], block: null,
        keywords: new Set(('def class return if elif else for while in not and or is import from as with try except finally '
          + 'raise lambda pass global nonlocal yield async await assert del break continue').split(' ')),
        literals: new Set(['None', 'True', 'False']),
      },
      go: {
        lines: ['//'], block: '/*',
        keywords: new Set(('func package import return if else for range switch case default break continue type struct '
          + 'interface map chan go defer select var const fallthrough goto').split(' ')),
        literals: new Set(['nil', 'true', 'false', 'iota']),
      },
      rust: {
        lines: ['//'], block: '/*',
        keywords: new Set(('fn let mut pub use mod struct enum impl trait for while loop if else match return as where const '
          + 'static ref move async await dyn unsafe type self Self').split(' ')),
        literals: new Set(['true', 'false', 'None', 'Some', 'Ok', 'Err']),
      },
      sh: {
        lines: ['#'], block: null,
        keywords: new Set(('if then else elif fi for in do done while case esac function return export local set unset source '
          + 'alias read echo cd exit').split(' ')),
        literals: new Set(['true', 'false']),
      },
      sql: {
        lines: ['--'], block: '/*',
        keywords: new Set(('select from where insert into values update set delete create table drop alter join left right '
          + 'inner outer on group by order having limit offset as and or not primary key index distinct union case when then '
          + 'else end').split(' ')),
        literals: new Set(['null', 'true', 'false']),
      },
      json: { lines: [], block: null, keywords: new Set([]), literals: new Set(['true', 'false', 'null']) },
      yaml: { lines: ['#'], block: null, keywords: new Set([]), literals: new Set(['true', 'false', 'null']) },
    }

    /** Map a fence's language tag onto one of the lexical families above. */
    function codeFamily(lang) {
      const tag = String(lang || '').toLowerCase()
      if (/^(js|jsx|mjs|cjs|ts|tsx|mts|cts|javascript|typescript)$/.test(tag)) return 'js'
      if (/^(py|python|py3)$/.test(tag)) return 'py'
      if (/^(go|golang)$/.test(tag)) return 'go'
      if (/^(rs|rust)$/.test(tag)) return 'rust'
      if (/^(sh|bash|zsh|shell|console)$/.test(tag)) return 'sh'
      if (/^(sql|mysql|sqlite|postgres|psql)$/.test(tag)) return 'sql'
      if (/^(json|jsonc)$/.test(tag)) return 'json'
      if (/^(ya?ml)$/.test(tag)) return 'yaml'
      return ''
    }

    /**
     * Colour one fenced block. A small scanner, not a parser: it recognises
     * comments, strings, numbers, keywords, literals and call names, and leaves
     * everything else in the foreground ink. That is enough to read code the way
     * the chat shows it, without shipping a highlighter engine.
     * @param source - the fence body.
     * @param lang - the fence's language tag.
     * @returns text and coloured spans, in source order.
     */
    function highlightCode(source, lang) {
      const text = String(source == null ? '' : source)
      const family = codeFamily(lang)
      const rules = family === '' ? undefined : CODE_RULES[family]
      if (rules === undefined) return [text]
      const out = []
      let plain = ''
      let i = 0
      const flush = () => { if (plain !== '') { out.push(plain); plain = '' } }
      const emit = (kind, value) => {
        flush()
        out.push(h('span', { key: 'k' + out.length, style: { color: CODE_INK[kind] } }, value))
      }
      const identStart = (ch) => /[A-Za-z_$]/.test(ch)
      const identPart = (ch) => /[A-Za-z0-9_$]/.test(ch)
      while (i < text.length) {
        const ch = text.charAt(i)
        const lineLeader = rules.lines.find((lead) => text.startsWith(lead, i))
        if (lineLeader !== undefined) {
          let end = text.indexOf('\n', i)
          if (end < 0) end = text.length
          emit('comment', text.slice(i, end))
          i = end
          continue
        }
        if (rules.block !== null && rules.block !== undefined && text.startsWith(rules.block, i)) {
          const close = text.indexOf('*/', i + 2)
          const end = close < 0 ? text.length : close + 2
          emit('comment', text.slice(i, end))
          i = end
          continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          let j = i + 1
          while (j < text.length) {
            const at = text.charAt(j)
            if (at === '\\') { j += 2; continue }
            if (at === ch) { j += 1; break }
            if (ch !== '`' && at === '\n') break
            j += 1
          }
          emit('string', text.slice(i, j))
          i = j
          continue
        }
        if (/[0-9]/.test(ch) && !identPart(text.charAt(i - 1))) {
          let j = i
          while (j < text.length && /[0-9a-fA-FxXoObB._]/.test(text.charAt(j))) j += 1
          emit('constant', text.slice(i, j))
          i = j
          continue
        }
        if (identStart(ch)) {
          let j = i
          while (j < text.length && identPart(text.charAt(j))) j += 1
          const word = text.slice(i, j)
          if (rules.keywords.has(word)) emit('keyword', word)
          else if (rules.literals.has(word)) emit('constant', word)
          else {
            let k = j
            while (k < text.length && /[ \t]/.test(text.charAt(k))) k += 1
            if (text.charAt(k) === '(') emit('function', word)
            else plain += word
          }
          i = j
          continue
        }
        plain += ch
        i += 1
      }
      flush()
      return out
    }

    const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
    const HEADING = /^(#{1,6})\s+(.*)$/
    const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/
    const RULE = /^\s*([-*_])\s*(\1\s*){2,}$/
    const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

    /**
     * Markdown source as block elements: headings, paragraphs, lists, quotes,
     * fenced code, tables and rules. Math and inline HTML are shown as text.
     * @param text - the entry's Markdown source.
     * @returns the block nodes.
     */
    function mdBlocks(text) {
      const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let i = 0
      let seq = 0
      const keyOf = (tag) => 'md-' + (seq++) + '-' + tag

      while (i < lines.length) {
        const line = lines[i]
        if (/^\s*$/.test(line)) { i += 1; continue }

        const fence = FENCE.exec(line)
        if (fence) {
          const marker = fence[1].charAt(0)
          const lang = fence[2]
          const body = []
          i += 1
          while (i < lines.length && !new RegExp('^\\s*' + marker + '{3,}\\s*$').test(lines[i])) {
            body.push(lines[i])
            i += 1
          }
          i += 1
          blocks.push(h('div', { className: 'akr-md-fence', key: keyOf('fence') },
            lang ? h('div', { className: 'akr-md-lang', key: 'l' }, lang) : null,
            h('pre', { className: 'akr-md-code', key: 'c' },
              h('code', null, highlightCode(body.join('\n'), lang)))))
          continue
        }

        const heading = HEADING.exec(line)
        if (heading) {
          const level = heading[1].length
          blocks.push(h('div', {
            className: 'akr-md-h akr-md-h' + level,
            key: keyOf('h'),
          }, inlineNodes(heading[2], 'h' + seq)))
          i += 1
          continue
        }

        if (RULE.test(line)) {
          blocks.push(h('hr', { className: 'akr-md-hr', key: keyOf('hr') }))
          i += 1
          continue
        }

        if (line.includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
          const cells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim())
          const head = cells(line)
          i += 2
          const rows = []
          while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
            rows.push(cells(lines[i]))
            i += 1
          }
          blocks.push(h('div', { className: 'akr-md-tablewrap', key: keyOf('table') },
            h('table', { className: 'akr-md-table' },
              h('thead', null, h('tr', null, head.map((cell, column) => h('th', { key: 'h' + column }, inlineNodes(cell, 'th' + column))))),
              h('tbody', null, rows.map((row, index) => h('tr', { key: 'r' + index },
                row.map((cell, column) => h('td', { key: 'c' + column }, inlineNodes(cell, 'td' + index + '-' + column)))))))))
          continue
        }

        if (/^\s*>/.test(line)) {
          const inner = []
          while (i < lines.length && /^\s*>/.test(lines[i])) {
            inner.push(lines[i].replace(/^\s*>\s?/, ''))
            i += 1
          }
          blocks.push(h('blockquote', { key: keyOf('quote') }, mdBlocks(inner.join('\n'))))
          continue
        }

        const first = LIST_ITEM.exec(line)
        if (first) {
          const baseIndent = first[1].length
          const ordered = /\d/.test(first[2])
          const items = []
          while (i < lines.length) {
            const item = LIST_ITEM.exec(lines[i])
            if (!item) {
              if (items.length > 0 && /^\s+\S/.test(lines[i])) {
                items[items.length - 1].text += ' ' + lines[i].trim()
                i += 1
                continue
              }
              break
            }
            const indent = item[1].length
            if (indent < baseIndent) break
            if (indent >= baseIndent + 2 && items.length > 0) {
              items[items.length - 1].subs.push(item[3])
              i += 1
              continue
            }
            items.push({ text: item[3], subs: [] })
            i += 1
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: keyOf('list') }, items.map((item, index) => h('li', { key: 'i' + index },
            inlineNodes(item.text, 'li' + index),
            item.subs.length === 0 ? null : h('ul', null, item.subs.map((sub, subIndex) => h('li', { key: 's' + subIndex },
              inlineNodes(sub, 'sub' + index + '-' + subIndex))))))))
          continue
        }

        const paragraphLines = []
        while (i < lines.length && !/^\s*$/.test(lines[i])
          && !FENCE.test(lines[i]) && !HEADING.test(lines[i])
          && !/^\s*>/.test(lines[i]) && !LIST_ITEM.test(lines[i])
          && !RULE.test(lines[i])) {
          paragraphLines.push(lines[i])
          i += 1
        }
        if (paragraphLines.length === 0) { i += 1; continue }
        blocks.push(paragraph(paragraphLines, keyOf('p')))
      }

      return blocks
    }

    // ---------------------------------------------------------------- store ---

    /** One pinned entry; `messageId` is present only for a pinned reply. */
    function isEntry(value) {
      return value !== null && typeof value === 'object'
        && typeof value.id === 'string'
        && typeof value.text === 'string'
    }

    /**
     * The board's client-side store: entries per Session, mirrored into
     * localStorage so a reload keeps them, with a per-Session listener set so a
     * pin from the conversation updates the open panel and nothing else.
     */
    function createBoard() {
      const cache = new Map()
      const listeners = new Map()

      const keyOf = (sessionId) => STORAGE_PREFIX + String(sessionId)

      function read(sessionId) {
        try {
          const raw = window.localStorage.getItem(keyOf(sessionId))
          if (!raw) return []
          const parsed = JSON.parse(raw)
          return Array.isArray(parsed) ? parsed.filter(isEntry) : []
        } catch (error) {
          return []
        }
      }

      function entries(sessionId) {
        const key = String(sessionId)
        if (!cache.has(key)) cache.set(key, read(key))
        return cache.get(key)
      }

      /** Apply one change in memory, persist it, tell this Session's readers; @returns whether it was stored. */
      function commit(sessionId, next) {
        const key = String(sessionId)
        cache.set(key, next)
        let stored = true
        try {
          window.localStorage.setItem(keyOf(key), JSON.stringify(next))
        } catch (error) {
          stored = false
        }
        const set = listeners.get(key)
        if (set) for (const listener of Array.from(set)) { try { listener() } catch (error) { /* keep others */ } }
        return stored
      }

      return {
        entries,
        /**
         * Prepend one entry. The merge reads the persisted list, not the render
         * cache: a write must never replace entries this page has not loaded yet
         * (a reload between two writes used to be able to drop them).
         */
        add(sessionId, entry) {
          const fresh = read(String(sessionId))
          const merged = [entry, ...fresh.filter((row) => row.id !== entry.id)]
          return commit(sessionId, merged.slice(0, ENTRY_LIMIT))
        },
        /** @returns whether it was stored; a removal of an absent entry writes nothing. */
        remove(sessionId, id) {
          const fresh = read(String(sessionId))
          if (!fresh.some((entry) => entry.id === id)) return true
          return commit(sessionId, fresh.filter((entry) => entry.id !== id))
        },
        clear(sessionId) {
          return commit(sessionId, [])
        },
        subscribe(sessionId, listener) {
          const key = String(sessionId)
          let set = listeners.get(key)
          if (!set) { set = new Set(); listeners.set(key, set) }
          set.add(listener)
          return () => {
            set.delete(listener)
            if (set.size === 0) listeners.delete(key)
          }
        },
      }
    }

    const board = createBoard()

    /** Live entries of one Session. */
    function useEntries(sessionId) {
      const subscribe = React.useCallback((listener) => board.subscribe(sessionId, listener), [sessionId])
      const snapshot = React.useCallback(() => board.entries(sessionId), [sessionId])
      return React.useSyncExternalStore(subscribe, snapshot, snapshot)
    }

    function makeId() {
      return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    }

    /**
     * The stamp a card shows: the clock alone for today, the date and clock for
     * another day this year, and the year as well once it is not this year.
     * @param time - unix epoch ms.
     * @returns the compact stamp, or an empty string without a usable time.
     */
    function formatStamp(time) {
      if (!Number.isFinite(time)) return ''
      const at = new Date(time)
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const clock = pad(at.getHours()) + ':' + pad(at.getMinutes())
      const sameDay = at.getFullYear() === now.getFullYear()
        && at.getMonth() === now.getMonth()
        && at.getDate() === now.getDate()
      if (sameDay) return clock
      const date = pad(at.getMonth() + 1) + '-' + pad(at.getDate())
      return at.getFullYear() === now.getFullYear() ? date + ' ' + clock : at.getFullYear() + '-' + date + ' ' + clock
    }

    /** First non-empty line as a chip-sized title, with its markup marks removed. */
    function titleOf(text) {
      const line = String(text).split('\n').map((row) => row.trim()).find((row) => row.length > 0) || ''
      const plain = line.replace(/^[#>*\-\s]+/, '').replace(/[*_`]/g, '').trim() || line.trim()
      return plain.length > 60 ? plain.slice(0, 60) + '…' : plain
    }

    /** One finalized assistant reply: its readable text and the time it was written. */
    function replySnapshot(nodes, messageId) {
      let all = []
      try {
        all = nodes && typeof nodes.values === 'function' ? nodes.values() : []
      } catch (error) {
        return ''
      }
      for (const node of all) {
        const data = node && node.data
        const finalNode = data && data.finalNode
        if (!finalNode || finalNode.messageId !== messageId) continue
        const blocks = Array.isArray(finalNode.blocks) ? finalNode.blocks : []
        const text = blocks
          .filter((block) => block && block.kind === 'text' && typeof block.text === 'string')
          .map((block) => block.text)
          .join('\n\n')
          .trim()
        if (text === '') return null
        return { text, time: Number.isFinite(data.time) ? data.time : undefined }
      }
      return null
    }

    /** Put text on the clipboard; @returns whether the browser accepted it. */
    function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          return Promise.resolve(navigator.clipboard.writeText(text)).then(() => true, () => false)
        }
      } catch (error) {
        return Promise.resolve(false)
      }
      return Promise.resolve(false)
    }

    /** One transient line of feedback beside the panel's controls. */
    function useNote() {
      const [note, setNote] = React.useState(null)
      const timer = React.useRef(0)
      const show = React.useCallback((text, failed) => {
        setNote({ text, failed: failed === true })
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { setNote(null); timer.current = 0 }, 6000)
      }, [])
      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
      return [note, show]
    }

    // ----------------------------------------------------- icon-row chrome ---

    /**
     * The reply action row's geometry, taken from the host's own action buttons
     * (28px square, 17px glyph, tertiary ink, hover surface) so the pin sits in
     * the row as one more icon.
     */
    const actionStyle = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 'calc(28px + var(--dsh-content-font-delta, 0px))',
      height: 'calc(28px + var(--dsh-content-font-delta, 0px))',
      padding: '6px', border: 'none', borderRadius: 'var(--dsw-radius-sm, 8px)',
      background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer',
    }

    const actionHoverStyle = {
      background: 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))',
      color: 'var(--dsw-alias-label-secondary)',
    }

    /**
     * The bubble's look, placed by the caller: it floats above the icon, so it
     * must not be clipped by the message flow or painted under the composer.
     */
    const BUBBLE_LOOK = {
      zIndex: 2147483000,
      // Size from the bubble's own text, not from the 28px button it hangs off:
      // shrink-to-fit against such a narrow box wraps one glyph per line.
      width: 'max-content', maxWidth: '260px', padding: '4px 8px',
      borderRadius: 'var(--dsw-radius-sm, 8px)', border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)',
      fontSize: '12px', lineHeight: '18px', whiteSpace: 'normal', textAlign: 'left',
      boxShadow: '0 6px 20px rgba(0,0,0,.18)', pointerEvents: 'none',
    }

    /** React DOM for the portal that keeps the bubble above every host layer. */
    const ReactDOM = (() => {
      try { return require('react-dom') } catch (error) { return null }
    })()
    const CAN_PORTAL = !!(ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined')

    /**
     * One icon-row button: a 28px square whose label appears under it on hover,
     * the same place the row's shipped tooltips put theirs.
     * @param props - label, click handler, optional transient note.
     * @returns the button and, while shown, its floating bubble.
     */
    function IconAction(props) {
      const [hover, setHover] = React.useState(false)
      const [at, setAt] = React.useState(null)
      const btnRef = React.useRef(null)
      const timer = React.useRef(0)
      const note = props.note
      const visible = note !== null && note !== undefined ? true : hover

      /**
       * Anchor the bubble to the button's box in viewport coordinates. It hangs
       * below the icon like the rest of the row's tooltips, and flips above only
       * when the viewport has no room under it.
       */
      const measure = React.useCallback(() => {
        const node = btnRef.current
        if (!node || typeof node.getBoundingClientRect !== 'function') return
        const rect = node.getBoundingClientRect()
        const needed = props.note ? 68 : 36
        const below = window.innerHeight - rect.bottom >= needed
        setAt({
          left: Math.round(rect.left + rect.width / 2),
          top: Math.round(below ? rect.bottom + 8 : rect.top - 8),
          below,
        })
      }, [props.note])

      React.useEffect(() => {
        if (!visible) { setAt(null); return undefined }
        measure()
        const follow = () => { measure() }
        window.addEventListener('scroll', follow, true)
        window.addEventListener('resize', follow)
        return () => {
          window.removeEventListener('scroll', follow, true)
          window.removeEventListener('resize', follow)
        }
      }, [visible, measure])

      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

      // A short dwell before the label appears: sweeping the pointer across the
      // row should not flash a bubble out of every icon.
      const enter = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { timer.current = 0; setHover(true) }, 260)
      }
      const leave = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = 0 }
        setHover(false)
      }

      const text = note ? note.text : (hover ? props.label : null)
      const look = note && note.failed
        ? Object.assign({}, BUBBLE_LOOK, { color: 'var(--dsw-alias-state-error-primary)' })
        : BUBBLE_LOOK
      // Portalled to the body: a fixed bubble inside the message row would be
      // clipped by the flow and painted under the composer, which is exactly the
      // row this icon sits next to.
      // Portalled to the body: a fixed bubble inside the message row would be
      // clipped by the flow and painted under the composer, which is exactly the
      // row this icon sits next to. Without a portal it falls back to a plain
      // absolute bubble above the icon rather than losing the label.
      let bubble = null
      if (text !== null) {
        if (CAN_PORTAL && at !== null) {
          bubble = ReactDOM.createPortal(h('span', {
            style: Object.assign({}, look, {
              position: 'fixed', left: at.left, top: at.top,
              transform: at.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }),
          }, text), document.body)
        } else if (!CAN_PORTAL) {
          bubble = h('span', {
            style: Object.assign({}, look, {
              position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)',
            }),
          }, text)
        }
      }

      return h('span', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' } },
        h('button', {
          type: 'button',
          ref: btnRef,
          'aria-label': props.label,
          onClick: props.onClick,
          onMouseEnter: enter,
          onMouseLeave: leave,
          onFocus: () => { setHover(true) },
          onBlur: leave,
          style: hover ? Object.assign({}, actionStyle, actionHoverStyle) : actionStyle,
        }, h(ArrowGlyph, { size: 17 })),
        bubble,
      )
    }

    // ------------------------------------------------------------- the panel ---

    /**
     * Ask about one excerpt: quote it into the Session composer, so the question
     * and the text it is about reach the model in one message. When the composer
     * refuses (another submission in flight), the same text goes to the clipboard
     * instead and the note says so.
     */
    function askAbout(inputActions, text, limit, t, show, onQuoted) {
      const body = String(text == null ? '' : text).trim()
      if (!body) return
      const clipped = body.length > limit
      const payload = clipped ? body.slice(0, limit) + t('quote.suffix') : body
      let accepted = false
      try {
        if (inputActions && typeof inputActions.insertQuote === 'function') {
          accepted = inputActions.insertQuote(payload) === true
        }
      } catch (error) {
        accepted = false
      }
      if (accepted) {
        show(clipped ? t('note.quotedClipped') : t('note.quoted'), false)
        if (onQuoted) onQuoted()
        return
      }
      copyText(payload).then((copied) => {
        show(copied ? t('note.copiedForAsk') : t('note.copyFailed'), !copied)
      })
    }

    /** The right column's content: pins of this Session, and the way back into the chat. */
    function ReaderPanel(props) {
      const t = props.t
      const sessionId = props.sessionId
      const entries = useEntries(sessionId)
      const [composing, setComposing] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      const [folded, setFolded] = React.useState([])
      const [pick, setPick] = React.useState(null)
      const [confirmClear, setConfirmClear] = React.useState(false)
      const [note, showNote] = useNote()
      // The chat's own node table: the jump needs the anchor key of a message,
      // which only the conversation knows.
      const chatNodes = props.useChat((snapshot) => snapshot.nodes)
      const rootRef = React.useRef(null)
      const pillRef = React.useRef(null)
      const clearTimer = React.useRef(0)

      React.useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current) }, [])

      // Parse each pin once per change: a selection drag re-renders this panel on
      // every selectionchange, and re-parsing a long reply each time would stutter.
      const rendered = React.useMemo(
        () => entries.map((entry) => ({
          entry,
          blocks: mdBlocks(entry.text),
          stamp: formatStamp(entry.time),
          stampTitle: Number.isFinite(entry.time) ? new Date(entry.time).toLocaleString() : '',
        })),
        [entries],
      )

      /** The live selection inside this panel, and where to float its action. */
      const readPick = React.useCallback(() => {
        try {
          const active = window.getSelection()
          if (!active || active.isCollapsed || active.rangeCount === 0) return null
          const root = rootRef.current
          const anchor = active.anchorNode
          if (!root || !anchor || !root.contains(anchor)) return null
          const text = active.toString().trim()
          if (text.length < 2) return null
          const rect = active.getRangeAt(0).getBoundingClientRect()
          if (!rect || (rect.width === 0 && rect.height === 0)) return null
          const below = rect.top < 64
          return {
            text,
            left: Math.round(Math.min(Math.max(rect.left + rect.width / 2, 72), window.innerWidth - 72)),
            top: Math.round(below ? rect.bottom + 8 : rect.top - 8),
            below,
          }
        } catch (error) {
          return null
        }
      }, [])

      // The action appears once the gesture ENDS, not while the pointer is still
      // dragging: a release (or a keyboard selection) is what settles a passage.
      React.useEffect(() => {
        const refresh = () => { setPick(readPick()) }
        /** A press elsewhere drops the pill; a press on the pill must survive to its click. */
        const hide = (event) => {
          const pill = pillRef.current
          if (pill !== null && event && typeof event.composedPath === 'function'
            && event.composedPath().includes(pill)) return
          setPick(null)
        }
        /** Reposition an already shown pill, and drop it when the selection dies. */
        const follow = () => {
          setPick((current) => (current === null ? current : readPick()))
        }
        const onKeyUp = (event) => {
          if (event.key === 'Shift' || event.shiftKey || event.key === 'a' || event.key === 'A') refresh()
        }
        document.addEventListener('pointerdown', hide, true)
        document.addEventListener('pointerup', refresh, true)
        document.addEventListener('keyup', onKeyUp, true)
        document.addEventListener('selectionchange', follow)
        window.addEventListener('scroll', follow, true)
        window.addEventListener('resize', follow)
        return () => {
          document.removeEventListener('pointerdown', hide, true)
          document.removeEventListener('pointerup', refresh, true)
          document.removeEventListener('keyup', onKeyUp, true)
          document.removeEventListener('selectionchange', follow)
          window.removeEventListener('scroll', follow, true)
          window.removeEventListener('resize', follow)
        }
      }, [readPick])

      const toggleFold = (id) => {
        setFolded((current) => current.includes(id) ? current.filter((row) => row !== id) : [...current, id])
      }

      const saveDraft = () => {
        const text = draft.trim()
        if (!text) return
        const stored = board.add(sessionId, { id: makeId(), title: titleOf(text), text, source: 'paste', time: Date.now() })
        setDraft('')
        setComposing(false)
        showNote(stored ? t('note.saved') : t('note.storageFailed'), !stored)
      }

      const copyEntry = (entry) => {
        copyText(entry.text).then((copied) => {
          showNote(copied ? t('note.copied') : t('note.copyFailed'), !copied)
        })
      }

      const clearAll = () => {
        if (!confirmClear) {
          setConfirmClear(true)
          if (clearTimer.current) clearTimeout(clearTimer.current)
          clearTimer.current = setTimeout(() => { setConfirmClear(false); clearTimer.current = 0 }, 4000)
          return
        }
        if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = 0 }
        setConfirmClear(false)
        setFolded([])
        if (!board.clear(sessionId)) showNote(t('note.storageFailed'), true)
      }

      /**
       * Scroll the conversation to the message a pin came from. The chat marks
       * every row with its anchor key, so the jump is a lookup plus a scroll;
       * a row outside the loaded window simply is not there to find.
       */
      const jumpTo = (entry) => {
        if (typeof entry.messageId !== 'string' || entry.messageId === '') return
        const anchorKey = () => {
          try {
            for (const node of chatNodes.values()) {
              const finalNode = node && node.data && node.data.finalNode
              if (finalNode && finalNode.messageId === entry.messageId && typeof node.key === 'string') return node.key
            }
          } catch (error) {
            return ''
          }
          return ''
        }
        const reveal = () => {
          const key = anchorKey()
          if (key === '') return false
          const row = document.querySelector('[data-chat-anchor-key="' + key.replace(/["\\]/g, '\\$&') + '"]')
          if (row === null || typeof row.scrollIntoView !== 'function') return false
          row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
          return true
        }
        if (reveal()) return
        // A row that is paging in mounts a frame later.
        setTimeout(() => { if (!reveal()) showNote(t('note.jumpMissing'), true) }, 160)
      }

      /** Hand one picked passage to the composer and drop the selection. */
      const quotePicked = (text) => {
        setPick(null)
        askAbout(props.inputActions, text, QUOTE_LIMIT_PASTE, t, showNote, () => {
          try { window.getSelection().removeAllRanges() } catch (error) { /* nothing to clear */ }
          setPick(null)
        })
      }

      const pill = pick === null || !CAN_PORTAL ? null : ReactDOM.createPortal(h('button', {
        type: 'button',
        ref: pillRef,
        className: 'akr-pick',
        style: {
          left: pick.left,
          top: pick.top,
          transform: pick.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        },
        // Hold the selection through the press: without this the browser drops it
        // before the click handler runs.
        onPointerDown: (event) => { event.preventDefault() },
        onClick: () => { quotePicked(pick.text) },
      }, h(ArrowGlyph, { size: 13 }), h('span', null, t('pick.action'))), document.body)

      return h('div', { className: 'akr-root', ref: rootRef },
        h(Styles),
        h('div', { className: 'akr-head' },
          h('span', { className: 'akr-head-title' }, t('tab.title')),
          entries.length > 0 ? h('span', { className: 'akr-head-meta' }, entries.length + ' ' + t('unit.entries')) : null,
          h('span', { className: 'akr-spacer' }),
          entries.length > 0
            ? h('button', { type: 'button', className: 'akr-btn', onClick: clearAll },
                t(confirmClear ? 'clear.confirm' : 'clear'))
            : null,
        ),
        entries.length === 0
          ? h('div', { className: 'akr-empty' },
              h('span', { className: 'akr-empty-title' }, t('empty.title')),
              h('span', null, t('empty.hint')),
            )
          : h('div', { className: 'akr-list' },
              rendered.map(({ entry, blocks, stamp, stampTitle }) => {
                // Every pin reads in full on arrival; folding is the exception.
                const open = !folded.includes(entry.id)
                return h('div', { className: 'akr-card', key: entry.id },
                  h('div', { className: 'akr-card-head' },
                    h('span', { className: 'akr-tag' }, t(entry.source === 'paste' ? 'source.paste' : 'source.reply')),
                    h('span', { className: 'akr-card-title', title: entry.title }, entry.title),
                    stamp === '' ? null : h('span', { className: 'akr-time', title: stampTitle }, stamp),
                  ),
                  h('div', {
                    className: 'akr-body akr-md' + (open ? ' akr-body-open' : ''),
                  }, blocks),
                  h('div', { className: 'akr-card-foot' },
                    entry.source === 'paste'
                      ? null
                      : h('button', {
                          type: 'button', className: 'akr-btn',
                          title: t('action.jump'),
                          onClick: () => { jumpTo(entry) },
                        }, t('action.jump')),
                    h('button', {
                      type: 'button', className: 'akr-btn akr-btn-strong',
                      onClick: () => {
                        askAbout(props.inputActions, entry.text,
                          entry.source === 'paste' ? QUOTE_LIMIT_PASTE : QUOTE_LIMIT_REPLY, t, showNote)
                      },
                    }, t('action.ask')),
                    h('span', { className: 'akr-spacer' }),
                    h('button', { type: 'button', className: 'akr-btn', onClick: () => { toggleFold(entry.id) } },
                      open ? t('action.collapse') : t('action.expand')),
                    h('button', { type: 'button', className: 'akr-btn', onClick: () => { copyEntry(entry) } }, t('action.copy')),
                    h('button', {
                      type: 'button', className: 'akr-btn',
                      onClick: () => { board.remove(sessionId, entry.id) },
                    }, t('action.remove')),
                  ),
                )
              }),
            ),
        composing
          ? h('div', { className: 'akr-compose' },
              h('textarea', {
                className: 'akr-input',
                value: draft,
                placeholder: t('compose.placeholder'),
                spellCheck: false,
                onChange: (event) => { setDraft(event.target.value) },
              }),
              h('div', { className: 'akr-row' },
                h('button', { type: 'button', className: 'akr-btn akr-btn-strong', disabled: draft.trim().length === 0, onClick: saveDraft },
                  t('compose.save')),
                h('button', { type: 'button', className: 'akr-btn', onClick: () => { setComposing(false); setDraft('') } },
                  t('compose.cancel')),
              ),
            )
          : h('div', { className: 'akr-row' },
              h('button', { type: 'button', className: 'akr-btn', onClick: () => { setComposing(true) } },
                '+ ' + t('compose.toggle')),
            ),
        note ? h('div', { className: 'akr-note' + (note.failed ? ' akr-note-error' : '') }, note.text) : null,
        pill,
      )
    }

    // --------------------------------------------------------- conversation ---

    /** The icon under one finalized reply: pin it, then show the board. */
    function SaveAction(props) {
      const t = props.t
      const saved = useEntries(props.sessionId).some((entry) => entry.messageId === props.messageId)
      const nodes = props.useChat((snapshot) => snapshot.nodes)
      const [note, showNote] = useNote()

      const onClick = () => {
        if (saved) {
          props.openPanel()
          showNote(t('note.alreadySaved'), false)
          return
        }
        const snapshot = replySnapshot(nodes, props.messageId)
        if (snapshot === null) { showNote(t('save.empty'), true); return }
        const stored = board.add(props.sessionId, {
          id: makeId(), title: titleOf(snapshot.text), text: snapshot.text, source: 'reply',
          messageId: props.messageId, time: snapshot.time === undefined ? Date.now() : snapshot.time,
        })
        props.openPanel()
        showNote(stored ? t('note.saved') : t('note.storageFailed'), !stored)
      }

      return h(IconAction, {
        label: t(saved ? 'save.open' : 'save.action'),
        onClick,
        note,
      })
    }

    /** The header entry that reveals the column. */
    function HeaderEntry(props) {
      return h(IconAction, {
        label: props.t('header.open'),
        onClick: () => { props.openPanel() },
        note: null,
      })
    }

    // ------------------------------------------------------------ the plugin ---

    return {
      name: 'dsh-ask-reader',
      inject: ['slots'],
      apply(ctx) {
        /** Resolved copy; replaced once the locale service answers. */
        let translate = (key) => DICT.zh[key] || key

        ctx.inject(['locale'], (scope) => {
          const locale = scope.get('locale')
          if (!locale || typeof locale.register !== 'function' || typeof locale.bind !== 'function') return
          locale.register(NS, { zh: DICT.zh, en: DICT.en })
          const bound = locale.bind(NS)
          translate = (key) => {
            try {
              const value = bound(key)
              return typeof value === 'string' && value.length > 0 ? value : (DICT.zh[key] || key)
            } catch (error) {
              return DICT.zh[key] || key
            }
          }
        })

        const t = (key) => translate(key)

        /** Reveal the board's tab in the right column; @returns whether it opened. */
        const openPanel = () => {
          let right
          try {
            right = ctx.get('sidebarRight')
          } catch (error) {
            return false
          }
          if (!right || typeof right.openTab !== 'function') return false
          try {
            right.openTab(KIND)
            return true
          } catch (error) {
            return false
          }
        }

        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          inject: () => ({ t }),
        }, ReaderPanel))

        ctx.inject(['sidebarRightTabs'], (scope) => {
          const tabs = scope.get('sidebarRightTabs')
          if (!tabs || typeof tabs.register !== 'function') return
          tabs.register({
            id: TAB_ID,
            kind: KIND,
            priority: 'extension',
            keepMounted: true,
            title: () => t('tab.title'),
            guide: [{
              id: 'reader',
              order: 30,
              title: () => t('guide.title'),
              description: () => t('guide.description'),
              icon: ArrowGlyph,
            }],
          })
        })

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'ask-reader-save',
          order: 30,
          label: () => t('save.action'),
          inject: (sessionId) => ({ t, sessionId, openPanel }),
        }, SaveAction))

        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'ask-reader-open',
          order: 25,
          label: () => t('header.open'),
          inject: () => ({ t, openPanel }),
        }, HeaderEntry))
      },
    }
  },
})