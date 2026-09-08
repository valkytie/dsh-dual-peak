// dsh-dual-peak —— Host 半端（靜態 Cordis 插件）
// 雙供應商峰谷對照：DeepSeek 官方 API + Ollama Cloud。
// 時段為內建固定值（可經 settings.yaml 覆寫 timezone），RPC：POST /dualpeak/api/<name>。

const NS = 'dsbal-dualpeak'

// settings 命名空間 schema（可呼叫 + 最小 toJSON）。
function dualPeakSchema(value) {
  const v = (value && typeof value === 'object') ? value : {}
  return {
    timezone: (typeof v.timezone === 'string' && v.timezone.trim()) ? v.timezone.trim() : '',
  }
}
dualPeakSchema.toJSON = function () {
  return {
    type: 'object',
    dict: {
      timezone: { type: 'string' },
    },
  }
}

export const inject = ['webServer', 'settings']

export function apply(ctx) {
  const webServer = ctx.webServer
  const settings = ctx.settings

  try {
    settings.register(NS, dualPeakSchema)
  } catch (e) {
    console.error('[dsh-dual-peak] settings register failed:', e)
  }

  function readConfig() {
    const v = settings.get(NS)
    const obj = (v && typeof v === 'object') ? v : {}
    return {
      timezone: (typeof obj.timezone === 'string' && obj.timezone.trim()) ? obj.timezone.trim() : '',
    }
  }

  function registerRoute(name, handler) {
    webServer.register({
      kind: 'exact',
      path: '/dualpeak/api/' + name,
      handler: async (req, res) => {
        let body = ''
        try {
          for await (const chunk of req) body += chunk
        } catch (e) { /* ignore stream read error */ }
        let args = null
        try { args = body ? JSON.parse(body) : null } catch (e) { args = null }
        let result
        try {
          result = await handler(args)
        } catch (e) {
          result = { ok: false, error: String((e && e.message) || e).slice(0, 500) }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
      },
    })
  }

  registerRoute('getConfig', async () => {
    return { ok: true, config: readConfig() }
  })

  registerRoute('setConfig', async (args) => {
    const patch = (args && typeof args === 'object' && !Array.isArray(args)) ? args : null
    if (patch === null) return { ok: false, error: '配置無效' }
    await settings.update(NS, patch)
    return { ok: true, config: readConfig() }
  })
}
