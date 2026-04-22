# API Key Status UI Strategy

**Status**: 📝 Planning
**Last Updated**: 2026-04-22
**Phase**: 5 - Multi-Provider API Key Management

---

## 1. Problem Statement

### Current Issues

1. **No visibility**: Users can select any LLM model (Claude/Gemini/OpenAI) without knowing if API key is registered
2. **Silent failure**: Clicking "Analyze" with no API key shows generic error without clear call-to-action
3. **Friction**: Users must navigate to Settings → API Keys tab to register keys
4. **Inconsistency**: UI only checks Claude API key (`hasClaudeKey`), ignoring Gemini/OpenAI

### User Impact

```
❌ Current Flow (Bad UX):
1. User selects "Gemini 2.5 Pro" from dropdown
2. User clicks "Analyze commit"
3. Error toast: "API key required"
4. User confused: "Which key? Where do I add it?"
5. User manually opens Settings
6. User guesses which tab to use
7. Eventually finds API Keys tab

✅ Target Flow (Good UX):
1. User sees "Gemini 2.5 Pro" is grayed out with 🔒 icon
2. User clicks small ⚙️ button next to grayed model
3. Settings modal opens directly to API Keys tab for Gemini
4. User enters key, saves
5. Model dropdown auto-refreshes, Gemini now enabled
6. User selects Gemini and analyzes successfully
```

---

## 2. Design Strategy

### Visual States

| State | Appearance | Interaction | Icon |
|-------|-----------|-------------|------|
| **Available** | Normal text, full opacity | Selectable, clickable | ✓ (green badge) |
| **Not configured** | Gray text, reduced opacity | NOT selectable | 🔒 (lock icon) |
| **Configured but invalid** | Yellow text, warning icon | Selectable with warning | ⚠️ (warning icon) |
| **Currently selected** | Accent color, bold | N/A (already selected) | ★ (checkmark) |

### Model Dropdown Enhancement

**Before** (Lines 115-130 in AIContextPanel.tsx):
```tsx
<select>
  <optgroup label="Claude">
    <option>Claude Sonnet 4.5</option>
    <option>Claude Haiku 3.5</option>
  </optgroup>
  <optgroup label="Gemini">
    <option>Gemini 2.5 Pro</option>  ← User doesn't know if this works
  </optgroup>
</select>
```

**After** (Custom dropdown component):
```tsx
<div className="model-dropdown">
  <button>Claude Sonnet 4.5 ✓</button>  ← Shows current selection

  <div className="dropdown-menu">
    {/* Available models */}
    <button>Claude Sonnet 4.5 ✓</button>
    <button>Claude Haiku 3.5 ✓</button>

    {/* Unavailable models with quick action */}
    <button disabled>
      Gemini 2.5 Pro 🔒
      <span className="quick-action">⚙️ Setup</span>  ← Click to add key
    </button>
  </div>
</div>
```

### Color Palette (Catppuccin Mocha)

| Element | Color Variable | Hex Value | Usage |
|---------|---------------|-----------|-------|
| Available model | `text-fg-primary` | `#cdd6f4` | Normal model name |
| Disabled model | `text-fg-muted` | `#6c7086` | Grayed out, 50% opacity |
| Warning model | `text-state-warning` | `#f9e2af` | Invalid/expired key |
| Lock icon | `text-border-strong` | `#45475a` | Lock icon for disabled |
| Quick action button | `text-accent` | `#89b4fa` | "⚙️ Setup" button |
| Quick action hover | `text-accent-hover` | `#b4befe` | Hover state |

---

## 3. Technical Architecture

### 3.1 Backend Changes

#### A. keychainService.ts Extension

```typescript
// Current: Only exports hasKey(provider)
export async function hasKey(provider: ProviderId): Promise<boolean>

// NEW: Export bulk check function
export async function getAllKeyStatus(): Promise<Record<ProviderId, boolean>> {
  return {
    claude: await hasKey('claude'),
    gemini: await hasKey('gemini'),
    openai: await hasKey('openai')
  }
}
```

**File**: `src/main/services/keychainService.ts`
**Lines to modify**: Add new function after line 90

---

#### B. IPC Handler (registerIpc.ts)

```typescript
// NEW: Handler to check all provider keys at once
ipcMain.handle('keychain:status-all', async (): Promise<IpcResult<Record<ProviderId, boolean>>> => {
  try {
    const status = await getAllKeyStatus()
    return { ok: true, data: status }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
```

**File**: `src/main/ipc/registerIpc.ts`
**Lines to add**: After existing `keychain:*` handlers (~line 180)

---

### 3.2 Frontend Changes

#### A. API Client Extension

```typescript
// src/renderer/src/api/client.ts
export const api = {
  keychain: {
    save: (provider: ProviderId, key: string) =>
      invoke<void>('keychain:save', provider, key),
    get: (provider: ProviderId) =>
      invoke<string | null>('keychain:get', provider),
    delete: (provider: ProviderId) =>
      invoke<void>('keychain:delete', provider),
    has: (provider: ProviderId) =>
      invoke<{ hasKey: boolean }>('keychain:has', provider),
    test: (provider: ProviderId) =>
      invoke<{ ok: boolean; error?: string }>('keychain:test', provider),

    // NEW: Bulk status check
    getAllStatus: () =>
      invoke<Record<ProviderId, boolean>>('keychain:status-all')
  }
}
```

**File**: `src/renderer/src/api/client.ts`
**Lines to modify**: Extend `keychain` object

---

#### B. Settings Store Extension

```typescript
// src/renderer/src/stores/settingsStore.ts
interface SettingsState {
  settings: Settings | null
  hasClaudeKey: boolean  // ❌ DEPRECATED: Use providerKeyStatus instead

  // NEW: Track all provider key availability
  providerKeyStatus: Record<ProviderId, boolean>

  loaded: boolean
  load: () => Promise<void>
  refreshKeyPresence: () => Promise<void>  // Now refreshes ALL providers

  // NEW: Refresh single provider
  refreshProviderKey: (provider: ProviderId) => Promise<void>
}

// Updated implementation
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  hasClaudeKey: false,  // Keep for backward compatibility
  providerKeyStatus: { claude: false, gemini: false, openai: false },
  loaded: false,

  load: async () => {
    const settings = await unwrap(api.settings.get())
    const keyStatus = await unwrap(api.keychain.getAllStatus())
    set({
      settings,
      providerKeyStatus: keyStatus,
      hasClaudeKey: keyStatus.claude,  // Backward compat
      loaded: true
    })
  },

  refreshKeyPresence: async () => {
    const keyStatus = await unwrap(api.keychain.getAllStatus())
    set({
      providerKeyStatus: keyStatus,
      hasClaudeKey: keyStatus.claude
    })
  },

  refreshProviderKey: async (provider: ProviderId) => {
    const { hasKey } = await unwrap(api.keychain.has(provider))
    const current = get().providerKeyStatus
    set({
      providerKeyStatus: { ...current, [provider]: hasKey },
      hasClaudeKey: provider === 'claude' ? hasKey : get().hasClaudeKey
    })
  }
}))
```

**File**: `src/renderer/src/stores/settingsStore.ts`
**Lines to modify**: Lines 5-17, 19-68

---

#### C. AIContextPanel Model Dropdown (Custom Component)

**Step 1: Replace `<select>` with custom dropdown**

```tsx
// NEW: ModelSelector component
function ModelSelector({
  activeModel,
  providerKeyStatus,
  onModelChange,
  onOpenSettings
}: {
  activeModel: string
  providerKeyStatus: Record<ProviderId, boolean>
  onModelChange: (modelId: string) => void
  onOpenSettings: (provider?: ProviderId) => void
}) {
  const [open, setOpen] = useState(false)
  const allModels = Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
    models.map((m) => ({ ...m, provider: provider as ProviderId }))
  )

  const currentModel = allModels.find(m => m.id === activeModel)
  const hasKey = (provider: ProviderId) => providerKeyStatus[provider]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-bg-tertiary border border-border rounded px-1.5 py-0.5 text-[10.5px] text-fg-secondary font-mono cursor-pointer hover:border-accent transition-colors max-w-[150px] truncate flex items-center gap-1"
      >
        {currentModel?.name}
        {hasKey(currentModel!.provider) ? (
          <CheckCircle2 size={10} className="text-state-success" />
        ) : (
          <Lock size={10} className="text-state-warning" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-bg-elevated border border-border-strong rounded shadow-lg py-1 z-50 min-w-[200px]">
          {Object.entries(LLM_MODELS).map(([provider, models]) => (
            <div key={provider}>
              <div className="px-2 py-1 text-[10px] text-fg-muted uppercase font-semibold">
                {provider}
              </div>
              {models.map((m) => {
                const available = hasKey(provider as ProviderId)
                const isActive = m.id === activeModel

                return (
                  <button
                    key={m.id}
                    disabled={!available}
                    onClick={() => {
                      if (available) {
                        onModelChange(m.id)
                        setOpen(false)
                      }
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11.5px] flex items-center justify-between ${
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : available
                        ? 'text-fg-primary hover:bg-bg-tertiary'
                        : 'text-fg-muted opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {!available && <Lock size={11} />}
                      {m.name}
                    </span>

                    {!available && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenSettings(provider as ProviderId)
                          setOpen(false)
                        }}
                        className="text-accent hover:text-accent-hover text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary flex items-center gap-0.5"
                        title={`Setup ${provider} API key`}
                      >
                        <Settings size={10} /> Setup
                      </button>
                    )}

                    {isActive && <Check size={12} className="text-accent" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Update AIContextPanel to use ModelSelector**

```tsx
export function AIContextPanel({ onOpenSettings }: Props) {
  const providerKeyStatus = useSettingsStore((s) => s.providerKeyStatus)

  // ... existing code ...

  const handleOpenSettingsForProvider = (provider?: ProviderId) => {
    // TODO: Pass provider to SettingsModal to auto-open correct tab
    onOpenSettings()
  }

  const actions = (
    <>
      <ModelSelector
        activeModel={activeModel}
        providerKeyStatus={providerKeyStatus}
        onModelChange={async (modelId) => {
          const model = allModels.find(m => m.id === modelId)
          if (model) {
            const { api } = await import('@renderer/api/client')
            const { unwrap } = await import('@renderer/api/client')
            await unwrap(
              api.settings.set({
                activeProvider: model.provider,
                activeModel: model.id
              })
            )
            useSettingsStore.getState().load()
          }
        }}
        onOpenSettings={handleOpenSettingsForProvider}
      />
      {/* ... rest of actions ... */}
    </>
  )
}
```

**File**: `src/renderer/src/components/right/AIContextPanel.tsx`
**Lines to modify**:
- Add `ModelSelector` component before `AIContextPanel` (new ~80 lines)
- Replace lines 115-130 with `<ModelSelector />` usage
- Import `Lock`, `Check`, `Settings` from lucide-react

---

#### D. SettingsModal Multi-Provider Support

**Step 1: Add Gemini/OpenAI API Key Sections**

```tsx
// Current: Only shows Claude API key input
// Target: Show all 3 providers with status badges

{tab === 'keys' && (
  <div className="space-y-6">
    {/* Claude Section */}
    <ProviderKeySection
      provider="claude"
      title="Anthropic Claude"
      description="Your API key is stored in the macOS Keychain..."
      consoleUrl="https://console.anthropic.com/settings/keys"
    />

    {/* Gemini Section */}
    <ProviderKeySection
      provider="gemini"
      title="Google Gemini"
      description="Get a Gemini API key from Google AI Studio..."
      consoleUrl="https://aistudio.google.com/app/apikey"
    />

    {/* OpenAI Section */}
    <ProviderKeySection
      provider="openai"
      title="OpenAI"
      description="Manage your OpenAI API keys..."
      consoleUrl="https://platform.openai.com/api-keys"
    />
  </div>
)}
```

**Step 2: Create ProviderKeySection component**

```tsx
function ProviderKeySection({
  provider,
  title,
  description,
  consoleUrl
}: {
  provider: ProviderId
  title: string
  description: string
  consoleUrl: string
}) {
  const { providerKeyStatus, refreshProviderKey } = useSettingsStore()
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const hasKey = providerKeyStatus[provider]

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await unwrap(api.keychain.save(provider, apiKey.trim()))
      await refreshProviderKey(provider)
      setApiKey('')
      toast({ kind: 'success', title: `${title} API key saved` })
    } catch (e) {
      toast({ kind: 'error', title: 'Failed to save key', description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await unwrap(api.keychain.test(provider))
      setTestResult(r)
      toast({
        kind: r.ok ? 'success' : 'error',
        title: r.ok ? `${title} API key works` : 'API key test failed',
        description: r.error
      })
    } catch (e) {
      const msg = String(e)
      setTestResult({ ok: false, error: msg })
      toast({ kind: 'error', title: 'Test failed', description: msg })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    try {
      await unwrap(api.keychain.delete(provider))
      await refreshProviderKey(provider)
      setTestResult(null)
      toast({ kind: 'info', title: `${title} API key deleted` })
    } catch (e) {
      toast({ kind: 'error', title: 'Failed to delete', description: String(e) })
    }
  }

  return (
    <div className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="text-[13px] font-semibold text-fg-primary mb-1 flex items-center gap-2">
        <KeyRound size={14} /> {title}
      </div>
      <div className="text-[12px] text-fg-secondary mb-3">{description}</div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11.5px] text-fg-muted">Status:</span>
        {hasKey ? (
          <Badge tone="success" dot>Stored</Badge>
        ) : (
          <Badge tone="warning" dot>Not set</Badge>
        )}
        {testResult?.ok && (
          <Badge tone="success">
            <CheckCircle2 size={10} className="mr-1" />
            Verified
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="password"
          placeholder={`${provider}-...`}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="flex-1 bg-bg-tertiary border border-border rounded px-2.5 py-1.5 text-[12.5px] font-mono text-fg-primary focus:outline-none focus:border-accent"
        />
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          loading={saving}
          disabled={!apiKey.trim()}
        >
          Save
        </Button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleTest}
          disabled={!hasKey}
          loading={testing}
        >
          Test Connection
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={!hasKey}
        >
          <Trash2 size={13} /> Delete
        </Button>
      </div>

      {testResult && !testResult.ok && (
        <div className="mt-3 p-2.5 rounded bg-state-error/10 border border-state-error/30 text-[12px] text-state-error flex items-start gap-2">
          <XCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span className="selectable">{testResult.error}</span>
        </div>
      )}

      <div className="mt-4 text-[11.5px] text-fg-muted">
        Get a key at{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            api.app.openExternal(consoleUrl)
          }}
          className="text-accent hover:text-accent-hover"
        >
          {consoleUrl.replace('https://', '')}
        </a>
      </div>
    </div>
  )
}
```

**File**: `src/renderer/src/components/modals/SettingsModal.tsx`
**Lines to modify**:
- Add `ProviderKeySection` component (~120 lines)
- Replace lines 126-210 with 3x `<ProviderKeySection />` calls

---

## 4. Implementation Plan

### Phase 5A: Backend Foundation (1-2 hours)

| Task | File | Description | Estimated Time |
|------|------|-------------|----------------|
| 1. Extend keychainService | `src/main/services/keychainService.ts` | Add `getAllKeyStatus()` function | 15 min |
| 2. Add IPC handler | `src/main/ipc/registerIpc.ts` | Add `keychain:status-all` handler | 15 min |
| 3. Extend API client | `src/renderer/src/api/client.ts` | Add `getAllStatus()` method | 10 min |
| 4. Update settingsStore | `src/renderer/src/stores/settingsStore.ts` | Add `providerKeyStatus` state | 30 min |

**Total Phase 5A**: ~1 hour 10 minutes

---

### Phase 5B: Frontend UI Components (2-3 hours)

| Task | File | Description | Estimated Time |
|------|------|-------------|----------------|
| 5. Create ModelSelector | `src/renderer/src/components/right/AIContextPanel.tsx` | Custom dropdown with status | 45 min |
| 6. Update AIContextPanel | Same file | Replace `<select>` with `<ModelSelector />` | 15 min |
| 7. Create ProviderKeySection | `src/renderer/src/components/modals/SettingsModal.tsx` | Reusable provider key UI | 45 min |
| 8. Update SettingsModal | Same file | Replace hardcoded Claude-only UI | 30 min |
| 9. Add visual polish | Both files | Icons, hover states, animations | 30 min |

**Total Phase 5B**: ~2 hours 45 minutes

---

### Phase 5C: Testing & Polish (1 hour)

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 10. Type check | Run `npm run typecheck` | 5 min |
| 11. Build test | Run `npm run build` | 10 min |
| 12. Manual testing | Test all 3 providers | 30 min |
| 13. Edge case handling | No keys, partial keys, invalid keys | 15 min |

**Total Phase 5C**: ~1 hour

---

**Grand Total**: ~5 hours

---

## 5. User Flows

### Flow 1: New User (No API Keys)

```
1. User opens VibeLens
2. User sees model dropdown showing "Claude Sonnet 4.5 🔒"
3. User clicks dropdown → All models are grayed with 🔒
4. User clicks "⚙️ Setup" next to "Claude Sonnet 4.5"
5. Settings modal opens to API Keys tab
6. User enters Claude key, clicks Save
7. Toast: "Claude API key saved to Keychain"
8. Modal closes, dropdown refreshes
9. User sees "Claude Sonnet 4.5 ✓" (now enabled)
10. User selects commit, clicks Analyze → Works!
```

---

### Flow 2: Multi-Provider User

```
1. User has Claude key, wants to try Gemini
2. User clicks model dropdown
3. User sees:
   - Claude Sonnet 4.5 ✓ (available)
   - Claude Haiku 3.5 ✓ (available)
   - Gemini 2.5 Pro 🔒 ⚙️ Setup (unavailable)
4. User clicks "⚙️ Setup" next to Gemini
5. Settings opens to Gemini section
6. User enters Gemini key, clicks Save
7. Settings auto-refreshes all provider status
8. User closes settings
9. Dropdown now shows Gemini 2.5 Pro ✓
10. User switches to Gemini → Works!
```

---

### Flow 3: Invalid/Expired Key

```
1. User has expired Claude key
2. Initial load: hasKey('claude') = true (key exists)
3. User selects commit, clicks Analyze
4. Backend attempts API call → 401 Unauthorized
5. Error handler recognizes auth error
6. Toast: "Claude API key is invalid or expired"
7. Model dropdown shows Claude with ⚠️ warning icon
8. User clicks ⚙️ next to Claude
9. Settings opens, user updates key
10. User tests connection → Success
11. Dropdown shows Claude ✓ again
```

---

## 6. Edge Cases & Error Handling

| Edge Case | Behavior | Implementation |
|-----------|----------|----------------|
| **No keys at all** | All models grayed, "⚙️ Setup" on all | Check `providerKeyStatus` object |
| **Partial keys** | Only Claude ✓, others 🔒 | Individual provider status |
| **Invalid key format** | Save succeeds but test fails | `keychain:test` validates format |
| **Network error during test** | Show error, don't delete key | Catch network errors separately |
| **Key deleted externally** | Next load shows 🔒, not ✓ | `getAllKeyStatus()` always fresh |
| **Multiple tabs open** | Other tabs don't auto-refresh | Acceptable (reload to refresh) |
| **Settings opened from Chat** | Same modal, shared state | `onOpenSettings()` callback |
| **User clicks disabled model** | No action, tooltip shown | `disabled` attribute + `title` |

---

## 7. Accessibility Considerations

### Keyboard Navigation

```tsx
<button
  disabled={!available}
  aria-label={`${m.name} model ${available ? 'available' : 'requires API key setup'}`}
  aria-disabled={!available}
  tabIndex={available ? 0 : -1}
>
  {m.name}
</button>
```

### Screen Reader Announcements

```tsx
{!available && (
  <span className="sr-only">
    This model requires API key setup. Press Enter to open settings.
  </span>
)}
```

### Focus Management

```tsx
// When "⚙️ Setup" is clicked:
onOpenSettings={(provider) => {
  openSettingsModal()
  // Focus on API key input for that provider
  setTimeout(() => {
    document.querySelector(`#${provider}-api-key-input`)?.focus()
  }, 100)
}}
```

---

## 8. Performance Optimization

### Caching Strategy

```typescript
// Settings store caches provider status
// Only refresh on:
// 1. App load
// 2. Manual refresh (after saving key)
// 3. Settings modal close

// Avoid repeated IPC calls
providerKeyStatus: { claude: true, gemini: false, openai: false }
```

### Lazy Loading

```typescript
// Only load keychain status when needed
const ModelSelector = lazy(() => import('./ModelSelector'))

// Preload on hover
<button
  onMouseEnter={() => {
    // Prefetch status if stale
    if (!recentlyChecked) {
      useSettingsStore.getState().refreshKeyPresence()
    }
  }}
>
```

---

## 9. Testing Checklist

### Unit Tests (Manual)

- [ ] `getAllKeyStatus()` returns correct object
- [ ] `keychain:status-all` handler works
- [ ] `providerKeyStatus` state updates correctly
- [ ] ModelSelector renders all providers
- [ ] Disabled models are not selectable
- [ ] "⚙️ Setup" button opens settings

### Integration Tests (Manual)

- [ ] Save Claude key → Dropdown shows ✓
- [ ] Delete Gemini key → Dropdown shows 🔒
- [ ] Switch between providers → Analysis uses correct API
- [ ] Test connection → Shows success/error correctly
- [ ] Invalid key → Shows warning icon

### UI Tests (Manual)

- [ ] Hover states work on all buttons
- [ ] Icons render correctly (Lock, Check, Settings)
- [ ] Colors match Catppuccin Mocha palette
- [ ] Dropdown closes on selection
- [ ] Dropdown closes on outside click
- [ ] Keyboard navigation works

---

## 10. Migration & Backward Compatibility

### Existing Code Compatibility

```typescript
// OLD CODE (still works):
const hasKey = useSettingsStore((s) => s.hasClaudeKey)

// NEW CODE (recommended):
const providerStatus = useSettingsStore((s) => s.providerKeyStatus)
const hasClaudeKey = providerStatus.claude
```

### Settings Schema Migration

No migration needed - new fields are additive:
- `providerKeyStatus` is computed on load, not stored
- Existing `hasClaudeKey` maintained for compatibility
- No changes to settings.json structure

---

## 11. Future Enhancements

### Phase 6 (Future)

1. **Auto-refresh on key save**: Use IPC event to notify all windows
2. **Key expiration warnings**: Check API response headers for expiry
3. **Usage quotas**: Show remaining credits per provider
4. **Model capabilities**: Badge each model (fast/accurate/cheap)
5. **Favorite models**: Pin frequently used models to top
6. **Model search**: Filter dropdown by typing

---

## 12. Design Mockups

### Model Dropdown (Available)

```
┌────────────────────────────────────┐
│ Claude Sonnet 4.5 ✓           ▾    │
├────────────────────────────────────┤
│ CLAUDE                             │
│   Claude Sonnet 4.5 ✓          ★   │  ← Selected
│   Claude Haiku 3.5 ✓               │
├────────────────────────────────────┤
│ GEMINI                             │
│   Gemini 2.5 Pro ✓                 │
├────────────────────────────────────┤
│ OPENAI                             │
│   GPT-4o ✓                         │
└────────────────────────────────────┘
```

### Model Dropdown (Mixed)

```
┌────────────────────────────────────┐
│ Claude Sonnet 4.5 ✓           ▾    │
├────────────────────────────────────┤
│ CLAUDE                             │
│   Claude Sonnet 4.5 ✓          ★   │
│   Claude Haiku 3.5 ✓               │
├────────────────────────────────────┤
│ GEMINI                             │
│   🔒 Gemini 2.5 Pro    [⚙️ Setup]  │  ← Disabled with action
├────────────────────────────────────┤
│ OPENAI                             │
│   🔒 GPT-4o            [⚙️ Setup]  │
└────────────────────────────────────┘
```

### Settings Modal (Multi-Provider)

```
┌──────────────────────────────────────────────────────┐
│ Settings                                             │
├──────────┬───────────────────────────────────────────┤
│ API Keys │ 🔑 Anthropic Claude                       │
│ Analysis │ Status: ✅ Stored ✅ Verified             │
│ Cache    │ [sk-ant-***************************]      │
│ About    │ [Save] [Test Connection] [Delete]         │
│          │                                            │
│          │ Get a key at console.anthropic.com        │
│          ├───────────────────────────────────────────┤
│          │ 🔑 Google Gemini                          │
│          │ Status: ⚠️ Not set                        │
│          │ [                                    ]    │
│          │ [Save] [Test Connection] [Delete]         │
│          │                                            │
│          │ Get a key at aistudio.google.com          │
│          ├───────────────────────────────────────────┤
│          │ 🔑 OpenAI                                 │
│          │ Status: ⚠️ Not set                        │
│          │ [                                    ]    │
│          │ [Save] [Test Connection] [Delete]         │
│          │                                            │
│          │ Get a key at platform.openai.com          │
└──────────┴───────────────────────────────────────────┘
```

---

## 13. Success Metrics

### User Experience

- [ ] Reduced "API key error" support requests
- [ ] Increased multi-provider adoption (track via telemetry)
- [ ] Faster time-to-first-analysis for new users

### Technical

- [ ] Zero TypeScript errors
- [ ] No console warnings
- [ ] Build size increase < 5KB (minimal)
- [ ] No performance regression (dropdown < 16ms render)

---

## 14. Documentation Updates

After implementation, update:

1. **README.md**: Add multi-provider screenshot
2. **README_KR.md**: Korean translation
3. **SOURCE_FUNCTION_MAP.md**: Document new components
4. **DEVELOPMENT_PROTOCOL.md**: Add testing procedures

---

## 15. Rollout Plan

### Sprint 1 (Phase 5A)
- Backend changes (keychainService, IPC, store)
- Test with CLI/manual IPC calls

### Sprint 2 (Phase 5B)
- Frontend components (ModelSelector, ProviderKeySection)
- Visual polish and styling

### Sprint 3 (Phase 5C)
- End-to-end testing
- Bug fixes
- Documentation
- Commit and push

---

## Appendix A: Code Snippets

### A1. Click Outside Handler (ModelSelector)

```typescript
useEffect(() => {
  if (!open) return

  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [open])
```

### A2. Keyboard Navigation (ModelSelector)

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'Escape') {
    setOpen(false)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    // Move focus to next available model
  } else if (e.key === 'Enter') {
    // Select focused model if available
  }
}
```

---

**Document Status**: Ready for implementation
**Author**: Claude (AI Assistant)
**Reviewed By**: Pending user approval
**Version**: 1.0
