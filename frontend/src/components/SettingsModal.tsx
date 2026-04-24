import { useEffect, useState } from 'react'
import {
  X, Settings as SettingsIcon, RefreshCw, Save, Loader2,
  CheckCircle2, AlertCircle, Database, DollarSign, Sparkles,
} from 'lucide-react'
import { api } from '../api'
import { useTheme } from '../hooks/useTheme'
import type { AppSettings, RefreshTarget, RefreshResult } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onRefreshed: (result: RefreshResult) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  tokscale: { runner: 'bunx', spec: 'tokscale@latest', extraArgs: [] },
}

export function SettingsModal({ open, onClose, onRefreshed }: Props) {
  const { isDark } = useTheme()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [extraArgsText, setExtraArgsText] = useState('')
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshingTarget, setRefreshingTarget] = useState<RefreshTarget | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [log, setLog] = useState<string>('')

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setLog('')
    setLoadingSettings(true)
    api.getSettings()
      .then(({ settings: loaded }) => {
        setSettings(loaded)
        setExtraArgsText(loaded.tokscale.extraArgs.join(' '))
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS)
        setExtraArgsText('')
      })
      .finally(() => setLoadingSettings(false))
  }, [open])

  if (!open) return null

  const panelBg = isDark ? 'bg-slate-900' : 'bg-white'
  const panelBorder = isDark ? 'border-slate-700/60' : 'border-slate-200'
  const fieldBg = isDark ? 'bg-slate-800/70 border-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
  const hintColor = isDark ? 'text-slate-500' : 'text-slate-400'
  const labelColor = isDark ? 'text-slate-300' : 'text-slate-700'
  const sectionTitle = isDark ? 'text-white' : 'text-slate-900'

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const nextSettings: AppSettings = {
        tokscale: {
          runner: settings.tokscale.runner.trim() || 'bunx',
          spec: settings.tokscale.spec.trim() || 'tokscale@latest',
          extraArgs: extraArgsText.split(/\s+/).map(s => s.trim()).filter(Boolean),
        },
      }
      const result = await api.saveSettings(nextSettings)
      if (result.success) {
        setSettings(result.settings)
        setExtraArgsText(result.settings.tokscale.extraArgs.join(' '))
        setStatus({ ok: true, text: 'Settings saved' })
      } else {
        setStatus({ ok: false, text: result.message ?? 'Failed to save settings' })
      }
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRefresh(target: RefreshTarget) {
    if (refreshingTarget) return
    setRefreshingTarget(target)
    setStatus(null)
    setLog('')

    try {
      await handleSave()
    } catch {
      // ignore save failure; still try refresh
    }

    try {
      const result = await api.refresh(target)
      setLog(result.log ?? '')
      if (result.success) {
        setStatus({ ok: true, text: result.message })
        onRefreshed(result)
      } else {
        setStatus({ ok: false, text: result.message })
      }
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Refresh failed' })
    } finally {
      setRefreshingTarget(null)
    }
  }

  const refreshTargets: { id: RefreshTarget; label: string; desc: string; icon: typeof Database }[] = [
    {
      id: 'all',
      label: 'Refresh Everything',
      desc: 'Token data + pricing + cost corrections',
      icon: Sparkles,
    },
    {
      id: 'graph',
      label: 'Refresh Token Data',
      desc: 'Re-collect graph.json from tokscale CLI',
      icon: Database,
    },
    {
      id: 'pricing',
      label: 'Refresh Pricing',
      desc: 'Sync LiteLLM/OpenRouter prices for all known models',
      icon: DollarSign,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border ${panelBg} ${panelBorder} shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`sticky top-0 flex items-center justify-between p-5 border-b ${panelBorder} ${panelBg}`}>
          <div className="flex items-center gap-3">
            <SettingsIcon className={`w-5 h-5 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
            <h2 className={`text-lg font-semibold ${sectionTitle}`}>Settings</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className={`text-sm font-semibold mb-3 ${sectionTitle}`}>Tokscale CLI</h3>
            <p className={`text-xs mb-4 ${hintColor}`}>
              Configure how the dashboard invokes the{' '}
              <a
                href="https://github.com/junhoyeo/tokscale"
                target="_blank"
                rel="noreferrer"
                className={isDark ? 'text-sky-400 hover:underline' : 'text-sky-600 hover:underline'}
              >
                tokscale
              </a>{' '}
              CLI to collect data.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${labelColor}`}>
                  Runner
                </label>
                <select
                  value={settings.tokscale.runner}
                  disabled={loadingSettings}
                  onChange={e => setSettings(s => ({ ...s, tokscale: { ...s.tokscale, runner: e.target.value } }))}
                  className={`w-full px-3 py-2 rounded-md border text-sm transition ${fieldBg}`}
                >
                  <option value="bunx">bunx (Bun)</option>
                  <option value="npx">npx (Node)</option>
                </select>
                <p className={`text-xs mt-1 ${hintColor}`}>Tool used to execute the CLI package.</p>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${labelColor}`}>
                  Package spec
                </label>
                <input
                  type="text"
                  value={settings.tokscale.spec}
                  disabled={loadingSettings}
                  onChange={e => setSettings(s => ({ ...s, tokscale: { ...s.tokscale, spec: e.target.value } }))}
                  placeholder="tokscale@latest"
                  className={`w-full px-3 py-2 rounded-md border text-sm transition ${fieldBg}`}
                />
                <p className={`text-xs mt-1 ${hintColor}`}>
                  Npm package spec, e.g. <code>tokscale@latest</code> or <code>tokscale@2.0.22</code>.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className={`block text-xs font-medium mb-1 ${labelColor}`}>
                Extra CLI arguments
              </label>
              <input
                type="text"
                value={extraArgsText}
                disabled={loadingSettings}
                onChange={e => setExtraArgsText(e.target.value)}
                placeholder="e.g. --config /path/to/config"
                className={`w-full px-3 py-2 rounded-md border text-sm transition font-mono ${fieldBg}`}
              />
              <p className={`text-xs mt-1 ${hintColor}`}>Space-separated flags forwarded to every tokscale invocation.</p>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSave}
                disabled={saving || loadingSettings}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 ${
                  isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </section>

          <section>
            <h3 className={`text-sm font-semibold mb-3 ${sectionTitle}`}>Data Refresh</h3>
            <p className={`text-xs mb-4 ${hintColor}`}>
              Saves the current settings before running. Pick a scope to update.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {refreshTargets.map(target => {
                const Icon = target.icon
                const busy = refreshingTarget === target.id
                return (
                  <button
                    key={target.id}
                    onClick={() => handleRefresh(target.id)}
                    disabled={!!refreshingTarget}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition disabled:opacity-50 ${
                      isDark
                        ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/80'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-md ${
                      target.id === 'all'
                        ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                        : target.id === 'pricing'
                          ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                          : isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-600'
                    }`}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${sectionTitle}`}>{target.label}</div>
                      <div className={`text-xs ${hintColor}`}>{target.desc}</div>
                    </div>
                    <RefreshCw className={`flex-shrink-0 w-4 h-4 ${busy ? 'animate-spin' : ''} ${hintColor}`} />
                  </button>
                )
              })}
            </div>
          </section>

          {status && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
              status.ok
                ? isDark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isDark ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {status.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span className="break-words">{status.text}</span>
            </div>
          )}

          {log && (
            <details className={`rounded-lg border ${panelBorder}`}>
              <summary className={`cursor-pointer px-3 py-2 text-xs font-medium ${labelColor}`}>
                Refresh log
              </summary>
              <pre className={`px-3 py-2 text-xs whitespace-pre-wrap font-mono max-h-64 overflow-auto ${
                isDark ? 'text-slate-400 bg-slate-950/50' : 'text-slate-600 bg-slate-50'
              }`}>
                {log}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
