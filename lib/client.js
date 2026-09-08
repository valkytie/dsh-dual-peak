// dsh-dual-peak —— Client 半端（靜態 web 插件，ModuleLoader bundle）
// 雙供應商峰谷對照：DeepSeek 官方 API + Ollama Cloud。
// RPC：fetch POST /dualpeak/api/<name>。

window.__ModuleLoader__.load({
  id: 'dsh-dual-peak',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var React = require('react');

    async function apiCall(name, args) {
      const res = await fetch('/dualpeak/api/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args || null),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    }

    function insertStyles(css) {
      try {
        const style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
        return () => { try { style.remove() } catch (e) { /* ignore */ } }
      } catch (e) {
        return () => {}
      }
    }

    // ---- 供應商峰谷定義（台灣時間 Asia/Taipei，UTC+8）----
    // DeepSeek 官方 API：週一至五 09:00-12:00、14:00-18:00 為尖峰（其餘離峰，週末全日離峰）
    // Ollama Cloud：週一至五 20:00-02:00(+1) 為尖峰（其餘離峰，週末全日離峰）
    const PROVIDERS = [
      {
        id: 'deepseek',
        name: 'DeepSeek 官方',
        short: 'DS',
        peakRanges: [
          { start: 9 * 60, end: 12 * 60 },
          { start: 14 * 60, end: 18 * 60 },
        ],
        note: '尖峰 09:00–12:00 / 14:00–18:00（週一至五）',
      },
      {
        id: 'ollama',
        name: 'Ollama Cloud',
        short: 'OL',
        peakRanges: [
          { start: 20 * 60, end: 24 * 60 },
          { start: 0, end: 2 * 60 },
        ],
        note: '尖峰 20:00–02:00（週一至五）',
      },
    ]

    function isWeekday(d) {
      const day = d.getDay()
      return day >= 1 && day <= 5
    }

    function computeNowMinutes(timezone) {
      const d = new Date()
      if (timezone) {
        try {
          const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
          const m = parts.match(/(\d{2}):(\d{2})/)
          if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
        } catch (e) { /* ignore */ }
      }
      return d.getHours() * 60 + d.getMinutes()
    }

    function inRange(now, range) {
      if (range.start < range.end) return now >= range.start && now < range.end
      return now >= range.start || now < range.end
    }

    function providerState(now, weekday, prov) {
      if (!weekday) return 'offpeak'
      return prov.peakRanges.some((r) => inRange(now, r)) ? 'peak' : 'offpeak'
    }

    // 找下一個狀態轉換（分鐘數）。週末視為全日離峰。
    function nextTransition(now, weekday, prov) {
      for (let i = 1; i <= 1440; i++) {
        const t = (now + i) % 1440
        const wd = weekday || (now + i >= 1440 ? false : weekday)
        // 簡化：只掃當日 24h 內，跨日一律視為週一至五（保守）
        const ns = providerState(t, true, prov)
        const cs = providerState(now, weekday, prov)
        if (ns !== cs) return { minutes: i, next: ns }
      }
      return null
    }

    function fmtDuration(min) {
      if (min == null) return ''
      const h = Math.floor(min / 60)
      const m = min % 60
      if (h > 0) return h + 'h' + (m > 0 ? m + 'm' : '')
      return m + 'm'
    }

    const CSS = `
.dpk-root { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; pointer-events: auto; font-family: inherit; }
.dpk-pill {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 999px; cursor: pointer; user-select: none;
  background: var(--dsw-alias-bg-overlay, rgba(255,255,255,0.92));
  color: var(--dsw-alias-label-primary, #171717);
  border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
  box-shadow: 0 8px 24px rgba(0,0,0,0.18); font-size: 13px; line-height: 1;
}
.dpk-pill:hover { background: var(--dsw-alias-bg-layer-1, #ffffff); }
.dpk-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dsw-alias-label-secondary, #9ca3af); flex: none; }
.dpk-dot.peak { background: var(--dsw-alias-state-warn-primary, #f59e0b); }
.dpk-dot.offpeak { background: var(--dsw-alias-state-success-primary, #22c55e); }
.dpk-card {
  width: 300px; margin-bottom: 8px; border-radius: 12px; overflow: hidden;
  background: var(--dsw-alias-bg-overlay, #ffffff);
  color: var(--dsw-alias-label-primary, #171717);
  border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
  box-shadow: 0 12px 32px rgba(0,0,0,0.22);
}
.dpk-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; cursor: move; touch-action: none; user-select: none; -webkit-user-select: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.08));
  background: var(--dsw-alias-bg-layer-1, #fafafa);
}
.dpk-title { font-size: 13px; font-weight: 600; }
.dpk-x { border: none; background: transparent; cursor: pointer; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 16px; line-height: 1; padding: 2px 8px; border-radius: 6px; }
.dpk-x:hover { background: rgba(0,0,0,0.08); }
.dpk-body { padding: 12px; }
.dpk-provider { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06)); }
.dpk-provider:last-of-type { border-bottom: none; }
.dpk-pname { font-size: 13px; font-weight: 600; width: 96px; flex: none; }
.dpk-pstate { font-size: 13px; font-weight: 700; flex: 1; }
.dpk-pcount { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dpk-reco {
  margin-top: 8px; padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
  background: var(--dsw-alias-bg-layer-1, #fafafa);
  border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.08));
}
.dpk-note { font-size: 11px; color: var(--dsw-alias-label-secondary, #9ca3af); margin-top: 8px; line-height: 1.5; }
.dpk-meta { font-size: 11px; color: var(--dsw-alias-label-secondary, #9ca3af); margin-top: 4px; }
.dpk-error { font-size: 12px; color: var(--dsw-alias-state-error-primary, #ef4444); }
.dpk-loading { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); padding: 14px 12px; }
.dpk-settings { padding: 0 12px 12px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06)); }
.dpk-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); margin-top: 8px; }
.dpk-field input {
  width: 100%; padding: 6px 8px; font-size: 12px; border-radius: 6px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #171717);
  font-family: inherit;
}
.dpk-actions { display: flex; gap: 8px; padding: 0 12px 12px; }
.dpk-btn {
  flex: 1; border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
  background: transparent; color: var(--dsw-alias-label-primary, #171717);
  border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
  text-decoration: none; text-align: center; box-sizing: border-box;
}
.dpk-btn:hover { background: rgba(0,0,0,0.05); }
.dpk-btn.primary { background: var(--dsw-alias-brand-primary, #4d6bfe); color: #fff; border-color: transparent; }
.dpk-btn:disabled { opacity: 0.5; cursor: default; }
`

    function createDualPeakWidget(ctx) {
      return function DualPeakWidget() {
        const [open, setOpen] = React.useState(false)
        const [loading, setLoading] = React.useState(false)
        const [cfg, setCfg] = React.useState({ timezone: 'Asia/Taipei' })
        const [error, setError] = React.useState(null)
        const [showSettings, setShowSettings] = React.useState(false)
        const [tzDraft, setTzDraft] = React.useState('Asia/Taipei')
        const [tick, setTick] = React.useState(0)
        const dragRef = React.useRef(null)
        const [offset, setOffset] = React.useState({ dx: 0, dy: 0 })

        const refresh = React.useCallback(() => {
          setLoading(true)
          apiCall('getConfig').then((res) => {
            if (res && res.ok) {
              setCfg(res.config)
              setError(null)
              setTzDraft(res.config.timezone || 'Asia/Taipei')
            } else {
              setError((res && res.error) || '讀取設定失敗')
            }
          }).catch((err) => {
            setError(String(err && err.message ? err.message : err))
          }).finally(() => {
            setLoading(false)
          })
        }, [])

        React.useEffect(() => { refresh() }, [refresh])
        React.useEffect(() => ctx.interval(() => setTick((t) => t + 1), 30000), [])

        const nowMin = computeNowMinutes(cfg.timezone)
        const weekday = isWeekday(new Date())

        const states = PROVIDERS.map((p) => {
          const st = providerState(nowMin, weekday, p)
          const trans = nextTransition(nowMin, weekday, p)
          return { prov: p, state: st, trans }
        })

        const ds = states[0]
        const ol = states[1]
        // 建議：兩邊都離峰 → 任選（預設 DeepSeek）；DeepSeek 峰 → Ollama；Ollama 峰 → DeepSeek；都峰 → 都貴
        let reco = ''
        if (ds.state === 'offpeak' && ol.state === 'offpeak') reco = '兩邊都離峰，任選（DeepSeek 官方）'
        else if (ds.state === 'peak' && ol.state === 'offpeak') reco = '現在用 Ollama Cloud（DeepSeek 尖峰中）'
        else if (ds.state === 'offpeak' && ol.state === 'peak') reco = '現在用 DeepSeek 官方（Ollama 尖峰中）'
        else reco = '兩邊都尖峰，建議暫緩大量呼叫'

        const pillText = 'DS ' + (ds.state === 'peak' ? '峰' : '谷') + ' · OL ' + (ol.state === 'peak' ? '峰' : '谷')

        const toggle = () => {
          const next = !open
          setOpen(next)
          if (next) refresh()
        }

        const openSettings = () => {
          setTzDraft(cfg.timezone || 'Asia/Taipei')
          setShowSettings((s) => !s)
        }

        const saveSettings = () => {
          const patch = { timezone: tzDraft.trim() }
          setLoading(true)
          apiCall('setConfig', patch).then((res) => {
            if (res && res.ok) {
              setCfg(res.config)
              setError(null)
              setShowSettings(false)
              setLoading(false)
            } else {
              setError((res && res.error) || '儲存失敗')
              setLoading(false)
            }
          }).catch((err) => {
            setError(String(err && err.message ? err.message : err))
            setLoading(false)
          })
        }

        const onDown = (e) => {
          const t = e.target
          if (t && typeof t.closest === 'function' && t.closest('button, a, input, textarea, label')) return
          e.preventDefault()
          dragRef.current = { sx: e.clientX, sy: e.clientY, dx: offset.dx, dy: offset.dy }
          // 鎖定全域選取：Safari 拖曳時若啟動文字選取會觸發 pointercancel 打斷拖曳（根因）
          document.body.style.userSelect = 'none'
          document.body.style.webkitUserSelect = 'none'
          // setPointerCapture：Chrome 正常；Safari 對 mouse 可能拋 NotFoundError，忽略即可
          const el = e.currentTarget
          if (el && typeof el.setPointerCapture === 'function') {
            try { el.setPointerCapture(e.pointerId) } catch (err) {}
          }
          // window fallback：capture 失敗時 pointermove 仍能收到（冒泡到 window）
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
          window.addEventListener('pointercancel', onUp)
        }
        const onMove = (e) => {
          const d = dragRef.current
          if (!d) return
          setOffset({ dx: d.dx + (e.clientX - d.sx), dy: d.dy + (e.clientY - d.sy) })
        }
        const onUp = () => {
          dragRef.current = null
          document.body.style.userSelect = ''
          document.body.style.webkitUserSelect = ''
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
        }

        const providerRow = (s) => {
          const label = s.state === 'peak' ? '尖峰 ×2' : '離峰 半價'
          const count = s.trans ? ' · ' + fmtDuration(s.trans.minutes) + '後轉' + (s.trans.next === 'peak' ? '峰' : '谷') : ''
          return React.createElement('div', { className: 'dpk-provider' },
            React.createElement('span', { className: 'dpk-dot ' + s.state }),
            React.createElement('span', { className: 'dpk-pname' }, s.prov.name),
            React.createElement('span', { className: 'dpk-pstate' }, label),
            React.createElement('span', { className: 'dpk-pcount' }, count),
          )
        }

        let body = null
        if (loading) {
          body = React.createElement('div', { className: 'dpk-loading' }, '載入中…')
        } else if (error) {
          body = React.createElement('div', { className: 'dpk-body' }, React.createElement('div', { className: 'dpk-error' }, error))
        } else {
          body = React.createElement('div', { className: 'dpk-body' },
            providerRow(ds),
            providerRow(ol),
            React.createElement('div', { className: 'dpk-reco' }, reco),
            React.createElement('div', { className: 'dpk-note' },
              'DeepSeek 官方：' + PROVIDERS[0].note + '；Ollama Cloud：' + PROVIDERS[1].note + '。週末兩邊全日離峰。'),
            React.createElement('div', { className: 'dpk-meta' }, '時區：' + (cfg.timezone || '本機時間')),
          )
        }

        const settingsPanel = React.createElement('div', { className: 'dpk-settings' },
          React.createElement('label', { className: 'dpk-field' },
            React.createElement('span', null, '時區（IANA，如 Asia/Taipei，留空=本機）'),
            React.createElement('input', { type: 'text', value: tzDraft, placeholder: 'Asia/Taipei', onChange: (e) => setTzDraft(e.target.value) }),
          ),
          React.createElement('div', { className: 'dpk-actions', style: { padding: '10px 0 0' } },
            React.createElement('button', { type: 'button', className: 'dpk-btn primary', onClick: saveSettings }, '儲存'),
          ),
        )

        const card = React.createElement('div', { className: 'dpk-card' },
          React.createElement('div', { className: 'dpk-head', onPointerDown: onDown },
            React.createElement('span', { className: 'dpk-title' }, '雙供應商峰谷'),
            React.createElement('button', { type: 'button', className: 'dpk-x', onClick: toggle, title: '收起' }, '\u00d7'),
          ),
          body,
          showSettings ? settingsPanel : null,
          React.createElement('div', { className: 'dpk-actions' },
            React.createElement('button', { type: 'button', className: 'dpk-btn', onClick: openSettings }, showSettings ? '完成' : '設定'),
            React.createElement('button', { type: 'button', className: 'dpk-btn', onClick: refresh, disabled: loading }, '重新整理'),
          ),
        )

        const pill = React.createElement('div', { className: 'dpk-pill', onClick: toggle, title: '雙供應商峰谷對照' },
          React.createElement('span', { className: 'dpk-dot ' + ds.state }),
          React.createElement('span', null, pillText),
        )

        return React.createElement('div', { className: 'dpk-root', style: { transform: 'translate(' + offset.dx + 'px,' + offset.dy + 'px)' } },
          open ? card : null,
          pill,
        )
      }
    }

    const inject = ['timer']

    function apply(ctx) {
      insertStyles(CSS)
      const slots = ctx.get('slots')
      if (slots === undefined) return
      const DualPeakWidget = createDualPeakWidget(ctx)
      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'dsh-dual-peak', order: 9001, label: '雙供應商峰谷' },
        () => React.createElement(DualPeakWidget),
      ))
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
