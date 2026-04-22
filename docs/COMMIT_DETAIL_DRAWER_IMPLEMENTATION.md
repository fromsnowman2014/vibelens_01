# Commit Detail Drawer Implementation Plan

## 📋 Overview

Transform the commit timeline from truncated text to a rich detail view using a bottom drawer pattern. Users can click any commit to view the full title, complete message body, metadata, and quick actions.

---

## 🎯 Goals

### Primary
1. **Show full commit titles** - No truncation for long subjects
2. **Display complete commit messages** - Access to full message body/changelog
3. **Natural UX** - Modern bottom drawer pattern (VS Code/Linear/GitHub style)
4. **Catppuccin Mocha consistency** - Match existing design system

### Secondary
1. **Keyboard accessibility** - ESC to close, focus management
2. **Copy actions** - Quick copy hash/message
3. **Smooth animations** - Spring-based slide-up motion

---

## 🏗️ Architecture

### UI Pattern: **Bottom Drawer**
```
┌─────────────────────────────────────────┐
│  Commit Timeline (always visible)       │
│  ┌───────────────────────────────────┐  │
│  │ • abc1234  2 hours ago            │  │ ← Click triggers drawer
│  │   Fix authentication bug          │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
              ↓ Click
┌─────────────────────────────────────────┐
│  Commit Timeline (dimmed)               │
├─────────────────────────────────────────┤
│ ╔═══════════════════════════════════╗  │ ← Drawer slides up
│ ║ [×] Commit Details                ║  │
│ ║───────────────────────────────────║  │
│ ║ 📝 Title                          ║  │
│ ║ Fix authentication bug in login   ║  │
│ ║                                   ║  │
│ ║ ℹ️  Metadata                      ║  │
│ ║ Hash: abc1234567890               ║  │
│ ║ Author: John Doe                  ║  │
│ ║ Date: 2026-04-21 14:30            ║  │
│ ║                                   ║  │
│ ║ 📄 Message                        ║  │
│ ║ This commit fixes the OAuth flow  ║  │
│ ║ by properly validating tokens...  ║  │
│ ║                                   ║  │
│ ║ [Copy Hash] [Copy Message]        ║  │
│ ╚═══════════════════════════════════╝  │
└─────────────────────────────────────────┘
```

### Why Bottom Drawer?

| Pattern | Pros | Cons | Score |
|---------|------|------|-------|
| Modal | High focus | Too heavy, blocks flow | ❌ |
| Tooltip | Lightweight | No interaction, limited space | ❌ |
| Popover | Balanced | Position constraints | ⚠️ |
| **Bottom Drawer** | **Natural, spacious, familiar** | **Requires library** | ✅ |

---

## 🛠️ Technical Stack

### Dependencies
```bash
npm install @radix-ui/react-dialog
```

**Why Radix Dialog?**
- ✅ Headless UI (full Catppuccin styling control)
- ✅ Accessibility built-in (ARIA, focus trap, ESC handling)
- ✅ Lightweight (~15KB gzipped)
- ✅ Already using Radix ecosystem (if any)

### File Structure
```
src/renderer/src/
  components/
    left/
      CommitTimeline.tsx           # Modified: Add drawer trigger
      CommitDetailDrawer.tsx       # New: Drawer content
    primitives/
      Drawer.tsx                   # New: Reusable drawer wrapper
  stores/
    uiStore.ts                     # New: Drawer state management
  lib/
    parseCommitMessage.ts          # New: Message parsing utility
```

---

## 📦 Data Handling

### Problem: No "Change Log" Field
Current `Commit` type only has:
```typescript
interface Commit {
  message: string    // Full message (title + body)
  subject: string    // First line only
  // No separate body field
}
```

### Solution: Parse on Demand
```typescript
// lib/parseCommitMessage.ts
export function parseCommitMessage(message: string) {
  const lines = message.split('\n')
  const subject = lines[0]
  const body = lines.slice(1).join('\n').trim()

  return {
    subject,
    body,
    hasBody: body.length > 0
  }
}
```

**Usage**:
```typescript
const { subject, body, hasBody } = parseCommitMessage(commit.message)
```

---

## 🎨 Component Design

### 1. Drawer Primitive (`primitives/Drawer.tsx`)

**Purpose**: Reusable bottom drawer wrapper around Radix Dialog

**Props**:
```typescript
interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
}
```

**Features**:
- Backdrop with Catppuccin overlay
- Slide-up animation (spring physics)
- ESC key handling
- Click-outside-to-close
- Max-height: 85vh (prevents full-screen takeover)

**Styling** (Catppuccin Mocha):
```css
Backdrop: rgba(30, 30, 46, 0.8)    /* Base */
Surface: var(--bg-elevated)         /* #313244 */
Border: var(--border-strong)        /* #585b70 */
```

---

### 2. UI Store (`stores/uiStore.ts`)

**Purpose**: Manage drawer open/close state

**State**:
```typescript
interface UIState {
  commitDetailDrawer: {
    isOpen: boolean
    commitHash: string | null
  }
  openCommitDetail: (hash: string) => void
  closeCommitDetail: () => void
}
```

**Why separate store?**
- Avoid prop drilling
- Centralized UI state
- Easy to add more UI states later (e.g., settings modal)

---

### 3. Commit Detail Drawer (`CommitDetailDrawer.tsx`)

**Purpose**: Display full commit information

**Layout Sections**:

#### A. Header (Sticky)
```tsx
<header className="flex items-center justify-between">
  <h2 className="text-accent">Commit Details</h2>
  <button onClick={close}>×</button>
</header>
```

#### B. Title Section
```tsx
<section>
  <h3 className="text-fg-muted text-xs">📝 Title</h3>
  <p className="text-fg-primary text-sm">
    {commit.subject}  {/* No truncate! */}
  </p>
</section>
```

#### C. Metadata Section
```tsx
<section>
  <h3 className="text-fg-muted text-xs">ℹ️ Metadata</h3>
  <dl>
    <dt>Hash</dt>
    <dd><code>{commit.hash}</code></dd>
    <dt>Author</dt>
    <dd>{commit.author} ({commit.email})</dd>
    <dt>Date</dt>
    <dd>{commit.date}</dd>
  </dl>
</section>
```

#### D. Message Body Section
```tsx
<section>
  <h3 className="text-fg-muted text-xs">📄 Message</h3>
  <pre className="whitespace-pre-wrap text-sm">
    {body || '(No additional message)'}
  </pre>
</section>
```

#### E. Actions Section
```tsx
<section className="flex gap-2">
  <Button onClick={copyHash}>Copy Hash</Button>
  <Button onClick={copyMessage}>Copy Message</Button>
</section>
```

---

### 4. Integration (`CommitTimeline.tsx`)

**Changes**:

#### Before:
```tsx
<CommitRow
  onClick={() => selectCommit(c.hash)}
/>
```

#### After:
```tsx
const openCommitDetail = useUIStore(s => s.openCommitDetail)

<CommitRow
  onClick={() => {
    selectCommit(c.hash)
    openCommitDetail(c.hash)  // New!
  }}
/>

{/* Add drawer at bottom */}
<CommitDetailDrawer />
```

---

## 🎬 Animation Specifications

### Slide-Up Motion
```typescript
const variants = {
  hidden: {
    y: '100%',
    opacity: 0
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 30,
      stiffness: 300
    }
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
}
```

**Timing**:
- Enter: ~300ms (spring physics)
- Exit: ~200ms (linear ease-out)

### Backdrop Fade
```css
transition: opacity 200ms ease-in-out;
```

---

## ♿ Accessibility

### Keyboard Navigation
- **ESC**: Close drawer (Radix handles automatically)
- **Tab**: Focus trap within drawer
- **Enter**: Trigger actions (copy buttons)

### ARIA Labels
```tsx
<Dialog.Content aria-labelledby="drawer-title">
  <Dialog.Title id="drawer-title">
    Commit Details
  </Dialog.Title>
</Dialog.Content>
```

### Focus Management
1. Open drawer → Focus on close button
2. Close drawer → Return focus to commit row

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure (30 min)
1. ✅ Install `@radix-ui/react-dialog`
2. ✅ Create `primitives/Drawer.tsx`
   - Radix Dialog wrapper
   - Catppuccin styling
   - Animation setup
3. ✅ Create `stores/uiStore.ts`
   - State: `commitDetailDrawer`
   - Actions: `open`, `close`

### Phase 2: Utilities (15 min)
4. ✅ Create `lib/parseCommitMessage.ts`
   - Parse subject vs body
   - Handle edge cases (empty body, etc.)

### Phase 3: Drawer Component (1.5 hours)
5. ✅ Create `CommitDetailDrawer.tsx`
   - Title section
   - Metadata section
   - Message body section
   - Copy actions
6. ✅ Catppuccin Mocha styling
   - Colors, spacing, typography
7. ✅ Wire up to `uiStore`

### Phase 4: Integration (30 min)
8. ✅ Modify `CommitTimeline.tsx`
   - Add `openCommitDetail` call on click
   - Import and render `<CommitDetailDrawer />`
9. ✅ Test interactions
   - Click → Drawer opens
   - ESC → Drawer closes
   - Backdrop click → Drawer closes

### Phase 5: Polish (30 min)
10. ✅ Copy button implementations
11. ✅ Loading states (if needed)
12. ✅ Edge case handling (very long messages)

### Phase 6: QA (30 min)
13. ✅ TypeScript type check
14. ✅ Build verification
15. ✅ Manual testing checklist

**Total Time**: ~4 hours

---

## ✅ Testing Checklist

### Functional Tests
- [ ] Click commit → Drawer opens
- [ ] ESC key → Drawer closes
- [ ] Backdrop click → Drawer closes
- [ ] Close button → Drawer closes
- [ ] Copy hash → Clipboard updated
- [ ] Copy message → Clipboard updated
- [ ] Long title → No truncation in drawer
- [ ] Empty message body → Shows placeholder

### Visual Tests
- [ ] Catppuccin colors correct
- [ ] Animation smooth (no jank)
- [ ] Responsive layout (different window sizes)
- [ ] Text wrapping works
- [ ] No layout shift on open/close

### Accessibility Tests
- [ ] Screen reader announces dialog
- [ ] Focus trapped in drawer
- [ ] Tab navigation works
- [ ] Close button has proper label

### Edge Cases
- [ ] Commit with 1000+ line message
- [ ] Commit with only subject (no body)
- [ ] Unicode/emoji in message
- [ ] Switching commits while drawer open

---

## 🎨 Catppuccin Mocha Color Reference

```css
/* Drawer Styles */
--drawer-backdrop: rgba(30, 30, 46, 0.8);  /* Base with alpha */
--drawer-surface: #313244;                  /* Surface0 */
--drawer-border: #585b70;                   /* Surface2 */

/* Typography */
--drawer-title: #89b4fa;                    /* Blue (accent) */
--drawer-label: #7f849c;                    /* Overlay2 (muted) */
--drawer-text: #cdd6f4;                     /* Text (primary) */

/* Interactive Elements */
--button-bg: #45475a;                       /* Surface1 */
--button-hover: #585b70;                    /* Surface2 */
--button-text: #cdd6f4;                     /* Text */
```

---

## 🚨 Potential Issues & Solutions

### Issue 1: Very Long Messages (>500 lines)
**Problem**: Drawer becomes slow to render
**Solution**:
```typescript
const MAX_LINES = 500
const truncatedBody = body.split('\n').slice(0, MAX_LINES).join('\n')
const isTruncated = body.split('\n').length > MAX_LINES
```

### Issue 2: Drawer Overlaps Center Panel
**Problem**: Drawer covers diff viewer
**Solution**:
- Max-height: 85vh (leaves 15% visible)
- Or: Add backdrop dim to center panel

### Issue 3: Performance on Drawer Open
**Problem**: Re-render entire timeline
**Solution**:
```typescript
const commitData = useMemo(
  () => commits.find(c => c.hash === drawerCommitHash),
  [commits, drawerCommitHash]
)
```

### Issue 4: Copy to Clipboard Permissions
**Problem**: `navigator.clipboard` may not work in all contexts
**Solution**: Fallback to legacy method
```typescript
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}
```

---

## 📊 Success Metrics

### Must Have (P0)
- ✅ User can view full commit title (no truncation)
- ✅ User can view full commit message body
- ✅ Drawer opens/closes smoothly
- ✅ ESC key works
- ✅ Catppuccin design system compliance

### Should Have (P1)
- ✅ Copy hash/message actions
- ✅ Keyboard accessibility
- ✅ Smooth animations (60fps)

### Nice to Have (P2)
- ⏸️ Drag-to-dismiss gesture
- ⏸️ Markdown rendering in message body
- ⏸️ Link to view commit in external tool (GitHub, etc.)

---

## 🔄 Future Enhancements

### Phase 2 Ideas
1. **Rich Markdown Rendering**
   ```tsx
   import ReactMarkdown from 'react-markdown'
   <ReactMarkdown>{body}</ReactMarkdown>
   ```

2. **Diff Preview in Drawer**
   - Show file change stats
   - Link to scroll to file in center panel

3. **Quick Actions Menu**
   - "View on GitHub"
   - "Revert this commit"
   - "Cherry-pick"

4. **Keyboard Shortcut**
   - `Cmd+I` to toggle drawer for selected commit

---

## 📝 Implementation Notes

### File: `primitives/Drawer.tsx`
- Exports: `Drawer`, `DrawerTrigger`, `DrawerContent`
- Uses: Radix Dialog primitives
- Styling: Catppuccin Mocha tokens

### File: `stores/uiStore.ts`
- Pattern: Zustand store (matching existing `repoStore`, `analysisStore`)
- Exports: `useUIStore`

### File: `lib/parseCommitMessage.ts`
- Pure function (no side effects)
- Handles edge cases:
  - Empty message
  - Message with only subject
  - Multi-paragraph body

### File: `CommitDetailDrawer.tsx`
- Connects: `useUIStore`, `useRepoStore`
- Dependencies: `Drawer` primitive, `parseCommitMessage` util

---

## 🎯 Acceptance Criteria

### Definition of Done
1. ✅ TypeScript compiles without errors
2. ✅ Production build succeeds
3. ✅ Manual testing checklist complete
4. ✅ No visual regressions
5. ✅ Accessibility features work (ESC, focus trap)
6. ✅ Code follows existing patterns (Zustand stores, Catppuccin theming)

### Review Checklist
- [ ] Drawer opens on commit click
- [ ] Full title visible (no truncate)
- [ ] Full message body visible
- [ ] Copy actions work
- [ ] ESC closes drawer
- [ ] Backdrop click closes drawer
- [ ] Animations smooth
- [ ] Catppuccin colors correct

---

## 📚 References

### Radix UI Dialog
- Docs: https://www.radix-ui.com/primitives/docs/components/dialog
- API: https://www.radix-ui.com/primitives/docs/components/dialog#api-reference

### Design Inspiration
- VS Code Command Palette (Cmd+P)
- Linear Quick Search (Cmd+K)
- GitHub Mobile bottom sheets

### Similar Patterns in VibeLens
- (None yet - this is the first drawer/modal)

---

## 🏁 Completion Checklist

- [ ] All files created
- [ ] npm install successful
- [ ] TypeScript types correct
- [ ] Components render without errors
- [ ] Drawer opens/closes correctly
- [ ] Copy actions work
- [ ] Accessibility verified
- [ ] Code committed with proper message
- [ ] Pushed to repository

---

**Document Version**: 1.0
**Created**: 2026-04-21
**Author**: Claude Code
**Status**: Ready for Implementation
