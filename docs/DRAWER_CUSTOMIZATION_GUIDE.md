# Drawer Customization Guide

## 📋 Overview

This guide explains how to customize the Commit Detail Drawer's size, position, and appearance in VibeLens. All customization is done by modifying CSS classes in the `Drawer.tsx` component.

---

## 📂 File Location

```
src/renderer/src/components/primitives/Drawer.tsx
```

This is the **only file** you need to modify to customize the drawer's appearance.

---

## 🎨 Customization Options

### 1. Drawer Width

**Current Setting**: Centered with max-width of 768px (Tailwind's `max-w-3xl`)

**Location**: Line 31
```tsx
'w-full max-w-3xl', // Centered with max-width 768px
```

**Available Options**:

| Class | Width | Use Case |
|-------|-------|----------|
| `max-w-sm` | 384px | Very compact, minimal info |
| `max-w-md` | 448px | Compact |
| `max-w-lg` | 512px | Small |
| `max-w-xl` | 576px | Medium-small |
| `max-w-2xl` | 672px | Medium |
| **`max-w-3xl`** | **768px** | **Default (recommended)** |
| `max-w-4xl` | 896px | Large |
| `max-w-5xl` | 1024px | Very large |
| `max-w-6xl` | 1152px | Extra large |
| `max-w-7xl` | 1280px | Maximum |
| `max-w-full` | 100% | Full width (not recommended) |

**Example**: To make drawer wider (1024px):
```tsx
'w-full max-w-5xl', // Changed from max-w-3xl to max-w-5xl
```

**Example**: To make drawer narrower (512px):
```tsx
'w-full max-w-lg', // Changed from max-w-3xl to max-w-lg
```

---

### 2. Drawer Height

**Current Setting**: Maximum 70% of viewport height

**Location**: Line 32
```tsx
'max-h-[70vh] overflow-y-auto', // Reduced from 85vh to 70vh
```

**Available Options**:

| Value | Height | Visibility of Background Panels |
|-------|--------|--------------------------------|
| `max-h-[50vh]` | 50% | ✅ Excellent (half screen) |
| `max-h-[60vh]` | 60% | ✅ Good |
| **`max-h-[70vh]`** | **70%** | **✅ Default (balanced)** |
| `max-h-[80vh]` | 80% | ⚠️ Less background visible |
| `max-h-[85vh]` | 85% | ⚠️ Minimal background (old default) |
| `max-h-[90vh]` | 90% | ❌ Almost full screen |

**Example**: To make drawer shorter (60%):
```tsx
'max-h-[60vh] overflow-y-auto',
```

**Example**: To make drawer taller (80%):
```tsx
'max-h-[80vh] overflow-y-auto',
```

**⚠️ Note**: Keep `overflow-y-auto` to enable scrolling for long commit messages.

---

### 3. Drawer Position

**Current Setting**: Centered horizontally at bottom

**Location**: Line 30
```tsx
'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
```

**Breakdown**:
- `fixed`: Fixed positioning (stays in place when scrolling)
- `bottom-0`: Aligned to bottom of screen
- `left-1/2`: Start at 50% from left
- `-translate-x-1/2`: Shift back by 50% of own width (centers it)
- `z-50`: Stack order (above backdrop which is z-40)

**Alternative Positions**:

#### Option A: Left-aligned (like VS Code sidebar)
```tsx
'fixed bottom-0 left-0 z-50',
'w-96', // Fixed width instead of max-w-3xl
```

#### Option B: Right-aligned
```tsx
'fixed bottom-0 right-0 z-50',
'w-96', // Fixed width
```

#### Option C: Offset from center (slightly left)
```tsx
'fixed bottom-0 left-[40%] -translate-x-1/2 z-50',
```

#### Option D: Add margin from edges (inset)
```tsx
'fixed bottom-4 left-1/2 -translate-x-1/2 z-50', // bottom-4 = 16px margin
'rounded-xl', // Add this to round bottom corners too
```

---

### 4. Backdrop Opacity

**Current Setting**: 40% dark overlay (lighter to show background panels)

**Location**: Line 21
```tsx
'bg-[rgba(30,30,46,0.4)]', // Reduced opacity from 0.8 to 0.4
```

**Available Options**:

| Value | Opacity | Background Visibility |
|-------|---------|----------------------|
| `bg-[rgba(30,30,46,0.2)]` | 20% | ✅ Very transparent |
| `bg-[rgba(30,30,46,0.3)]` | 30% | ✅ Transparent |
| **`bg-[rgba(30,30,46,0.4)]`** | **40%** | **✅ Default (balanced)** |
| `bg-[rgba(30,30,46,0.5)]` | 50% | ⚠️ Medium |
| `bg-[rgba(30,30,46,0.6)]` | 60% | ⚠️ Dark |
| `bg-[rgba(30,30,46,0.8)]` | 80% | ❌ Very dark (old default) |

**Example**: To make backdrop more transparent (30%):
```tsx
'bg-[rgba(30,30,46,0.3)]',
```

**Example**: To remove backdrop completely:
```tsx
'bg-transparent', // No darkening at all
```

---

### 5. Border Styling

**Current Setting**: Full border on all sides

**Location**: Line 33
```tsx
'bg-bg-elevated border border-border-strong',
```

**Options**:

#### Option A: Top border only (current before this change)
```tsx
'bg-bg-elevated border-t border-border-strong',
```

#### Option B: Top and sides (no bottom)
```tsx
'bg-bg-elevated border-t border-x border-border-strong',
```

#### Option C: Thicker border
```tsx
'bg-bg-elevated border-2 border-border-strong',
```

#### Option D: No border
```tsx
'bg-bg-elevated',
```

---

### 6. Corner Rounding

**Current Setting**: Rounded top corners only

**Location**: Line 34
```tsx
'rounded-t-xl shadow-2xl',
```

**Options**:

| Class | Corners | Use Case |
|-------|---------|----------|
| `rounded-t-sm` | Small (4px) | Subtle |
| `rounded-t-md` | Medium (6px) | Standard |
| `rounded-t-lg` | Large (8px) | Modern |
| **`rounded-t-xl`** | **Extra large (12px)** | **Default** |
| `rounded-t-2xl` | 2X large (16px) | Very round |
| `rounded-t-3xl` | 3X large (24px) | Extremely round |
| `rounded-xl` | All corners | Floating card style |

**Example**: To round all corners (floating card):
```tsx
'rounded-xl shadow-2xl',
// Also add margin: 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
```

---

### 7. Shadow Intensity

**Current Setting**: Extra large shadow for depth

**Location**: Line 34
```tsx
'rounded-t-xl shadow-2xl',
```

**Options**:

| Class | Shadow | Depth |
|-------|--------|-------|
| `shadow-sm` | Small | Subtle |
| `shadow` | Default | Standard |
| `shadow-md` | Medium | Moderate |
| `shadow-lg` | Large | Strong |
| `shadow-xl` | Extra large | Very strong |
| **`shadow-2xl`** | **2X large** | **Default** |
| `shadow-none` | None | Flat |

---

### 8. Animation Duration

**Current Setting**: 300ms for slide up/down

**Location**: Line 36
```tsx
'duration-300'
```

**Options**:

| Class | Duration | Feel |
|-------|----------|------|
| `duration-150` | 150ms | Very fast |
| `duration-200` | 200ms | Fast |
| **`duration-300`** | **300ms** | **Default (smooth)** |
| `duration-500` | 500ms | Slow |
| `duration-700` | 700ms | Very slow |

---

## 🎯 Common Customization Scenarios

### Scenario 1: "I want a smaller, more compact drawer"

**Modify**: Width + Height
```tsx
// Line 30-32
'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
'w-full max-w-2xl',           // Changed from max-w-3xl (smaller)
'max-h-[60vh] overflow-y-auto', // Changed from 70vh (shorter)
```

---

### Scenario 2: "I want to see more of the background panels"

**Modify**: Height + Backdrop opacity
```tsx
// Line 21
'bg-[rgba(30,30,46,0.2)]',    // Changed from 0.4 (more transparent)

// Line 32
'max-h-[50vh] overflow-y-auto', // Changed from 70vh (much shorter)
```

---

### Scenario 3: "I want a wider drawer for long commit messages"

**Modify**: Width
```tsx
// Line 31
'w-full max-w-5xl',           // Changed from max-w-3xl (wider: 1024px)
```

---

### Scenario 4: "I want a floating card style instead of bottom drawer"

**Modify**: Position + Rounding + Margin
```tsx
// Line 30
'fixed bottom-8 left-1/2 -translate-x-1/2 z-50', // Added margin (bottom-8)

// Line 34
'rounded-xl shadow-2xl',      // Changed from rounded-t-xl (all corners)
```

---

### Scenario 5: "I want it aligned to the right side"

**Modify**: Position + Width
```tsx
// Line 30-31
'fixed bottom-0 right-0 z-50', // Changed from left-1/2 -translate-x-1/2
'w-[600px]',                   // Fixed width instead of max-w-3xl
```

---

## 📐 Size Reference Table

### Width Sizes (Tailwind max-w-* classes)

| Class | Pixels | Percentage | Best For |
|-------|--------|------------|----------|
| `max-w-md` | 448px | ~23% (1920px) | Quick info |
| `max-w-lg` | 512px | ~27% | Short messages |
| `max-w-xl` | 576px | ~30% | Standard messages |
| `max-w-2xl` | 672px | ~35% | Medium messages |
| **`max-w-3xl`** | **768px** | **40%** | **Default** |
| `max-w-4xl` | 896px | ~47% | Long messages |
| `max-w-5xl` | 1024px | ~53% | Very long messages |
| `max-w-6xl` | 1152px | 60% | Extra long |

### Height Sizes (vh units)

| Value | Pixels (1080p) | Visibility |
|-------|----------------|------------|
| `50vh` | 540px | ✅ Half screen |
| `60vh` | 648px | ✅ Balanced |
| **`70vh`** | **756px** | **✅ Default** |
| `80vh` | 864px | ⚠️ Covers most |
| `85vh` | 918px | ⚠️ Nearly full |

---

## 🔧 Step-by-Step: How to Customize

### Step 1: Open the file
```bash
open src/renderer/src/components/primitives/Drawer.tsx
```

### Step 2: Find the Dialog.Content section (around line 28-38)
```tsx
<Dialog.Content
  className={cx(
    'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
    'w-full max-w-3xl',              // ← WIDTH HERE
    'max-h-[70vh] overflow-y-auto',  // ← HEIGHT HERE
    'bg-bg-elevated border border-border-strong',
    'rounded-t-xl shadow-2xl',       // ← CORNERS/SHADOW HERE
    ...
  )}
>
```

### Step 3: Find the Overlay section (around line 18-25)
```tsx
<Dialog.Overlay
  className={cx(
    'fixed inset-0 z-40',
    'bg-[rgba(30,30,46,0.4)]',       // ← BACKDROP OPACITY HERE
    ...
  )}
/>
```

### Step 4: Make your changes
Replace the values with your preferred options from the tables above.

### Step 5: Test
```bash
npm run dev
```

### Step 6: If satisfied, rebuild
```bash
npm run build
```

---

## 💡 Pro Tips

1. **Start with small changes**: Adjust one parameter at a time to see the effect

2. **Test on different screen sizes**: What looks good on a large monitor might not work on a laptop

3. **Consider your workflow**:
   - Need to reference diff while reading commit? → Smaller height (50vh)
   - Long commit messages common? → Wider drawer (max-w-5xl)
   - Prefer minimal distraction? → More transparent backdrop (0.2)

4. **Preserve readability**: Don't make the drawer too wide (max-w-6xl+ can be hard to read)

5. **Keep animations smooth**: Stick with 200-300ms duration for best UX

---

## 🎨 Recommended Presets

### Preset 1: Minimal (Maximum background visibility)
```tsx
// Backdrop
'bg-[rgba(30,30,46,0.2)]',

// Content
'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
'w-full max-w-2xl',
'max-h-[50vh] overflow-y-auto',
```

### Preset 2: Balanced (Current default)
```tsx
// Backdrop
'bg-[rgba(30,30,46,0.4)]',

// Content
'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
'w-full max-w-3xl',
'max-h-[70vh] overflow-y-auto',
```

### Preset 3: Spacious (For long messages)
```tsx
// Backdrop
'bg-[rgba(30,30,46,0.5)]',

// Content
'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
'w-full max-w-5xl',
'max-h-[80vh] overflow-y-auto',
```

### Preset 4: Floating Card (Modern style)
```tsx
// Backdrop
'bg-[rgba(30,30,46,0.3)]',

// Content
'fixed bottom-8 left-1/2 -translate-x-1/2 z-50',
'w-full max-w-3xl',
'max-h-[65vh] overflow-y-auto',
'bg-bg-elevated border border-border-strong',
'rounded-xl shadow-2xl',  // All corners rounded
```

---

## 🚨 Things to Avoid

❌ **Don't remove `overflow-y-auto`**: Long commit messages won't scroll
❌ **Don't use `max-h-[100vh]`**: Drawer will cover entire screen
❌ **Don't use `left-0 right-0` with `max-w-*`**: Centering won't work
❌ **Don't set `z-50` below `z-40`**: Drawer will appear behind backdrop
❌ **Don't remove `-translate-x-1/2` without removing `left-1/2`**: Drawer will be off-center

---

## 📝 Summary: Quick Reference

| What to Change | Where to Look | Line Number (approx) |
|----------------|---------------|---------------------|
| Width | `max-w-*` class | Line 31 |
| Height | `max-h-[*vh]` class | Line 32 |
| Position | `left-*` classes | Line 30 |
| Backdrop darkness | `bg-[rgba(...)]` | Line 21 |
| Corner rounding | `rounded-*` class | Line 34 |
| Shadow | `shadow-*` class | Line 34 |
| Border | `border*` classes | Line 33 |
| Animation speed | `duration-*` class | Line 36 |

---

## 🔄 Reverting to Original (Full-width, 85vh)

If you want to go back to the original full-width drawer:

```tsx
// Line 21 (Backdrop)
'bg-[rgba(30,30,46,0.8)]',

// Line 30-32 (Content positioning)
'fixed bottom-0 left-0 right-0 z-50',  // Remove centering
// Remove: 'w-full max-w-3xl',
'max-h-[85vh] overflow-y-auto',

// Line 33 (Border)
'bg-bg-elevated border-t border-border-strong',  // Top border only
```

---

**Document Version**: 1.0
**Last Updated**: 2026-04-22
**Related Files**:
- `src/renderer/src/components/primitives/Drawer.tsx`
- `docs/COMMIT_DETAIL_DRAWER_IMPLEMENTATION.md`
