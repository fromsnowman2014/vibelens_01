# VibeLens Resizable Panels Implementation Plan
> **목적**: VibeLens의 3-패널 레이아웃(왼쪽: 커밋 타임라인, 중앙: Diff 뷰어, 오른쪽: AI 분석)에 마우스 드래그로 패널 크기를 조절할 수 있는 기능 추가

**작성일**: 2026-04-18
**버전**: 3.0 (VS Code 스타일 Custom SplitView 도입)
**구현 방법**: Custom React Hooks + DOM Native Mouse Events (순수 구현)

---

## 🛑 기존 방식의 실패 원인 (`react-resizable-panels`)
이전에 시도했던 `react-resizable-panels` 방식은 다음과 같은 문제가 발생했습니다:
1. React 18 Strict Mode와의 렌더링 충돌 및 레이아웃 흔들림
2. `%` 기반 크기 조절로 인해 세밀한 픽셀 단위 렌더링 제어 불가
3. 패널 내부의 복잡한 마크다운/Diff 뷰어가 리사이즈와 충돌하며 강제 리플로우 발생

따라서 위 라이브러리 의존성을 제거하고, **VS Code에서 사용하는 Custom SplitView (Sash)** 방식으로 자체 구현하기로 결정했습니다.

---

## 🎯 새로운 구현 전략: VS Code-Style Custom SplitView

### 핵심 개념 (VS Code 방식)
- 외부 의존성 없음 (0 bytes)
- Flexbox `flex-row` 기반 레이아웃 연산
- **왼쪽(Left)**, **오른쪽(Right)** 패널은 고정된 `width(px)` 상태를 가짐
- **중앙(Center)** 패널은 `flex-1`을 통해 남는 공간을 모두 차지함
- 패널 사이의 **Resize Sash(핸들)**에서 `mousedown` 이벤트를 캡처하고, `window` 객체에 `mousemove`, `mouseup` 제어권을 위임하여 부드러운 드래그 구현.

### 기대 효과
| 항목 | 상세 | 비교 |
|------|------|------|
| **의존성** | 없음 | `react-resizable-panels` (38kb) 절약 |
| **성능** | DOM 이벤트로 상태를 직접 변경 (`requestAnimationFrame` 결합 가능) | 불필요한 React 트리 렌더링 최소화 |
| **제어력** | 정확한 `px` 단위 width 제한 가능 | 퍼센트 기반보다 가독성 높은 UI 구현 보장 |

---

## 📝 구현 로드맵

### Phase 1: Custom Hook 개발 (`usePanelResize`)

**수정 파일**: `ThreePanelLayout.tsx`의 헬퍼 함수로 작성 (이후 분리 가능)

```typescript
function usePanelResize(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
  side: 'left' | 'right'
) {
  const [width, setWidth] = useState(initialWidth)
  const isDragging = useRef(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    const startX = e.clientX
    const startWidth = width

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return
      // 'left' 패널은 마우스가 오른쪽(양수)으로 갈수록 커짐
      // 'right' 패널은 마우스가 왼쪽(음수)으로 갈수록 커짐
      const deltaX = moveEvent.clientX - startX
      const newWidth = side === 'left' 
        ? startWidth + deltaX 
        : startWidth - deltaX

      setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth))
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // TODO: localStorage 자동 저장
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [width, minWidth, maxWidth, side])

  return { width, startResize, setWidth }
}
```

---

### Phase 2: 레이아웃 구조 변경

**수정 파일**: `ThreePanelLayout.tsx`

**기존 (CSS Grid)**:
```tsx
<div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_360px] gap-2 p-2">
```

**변경 (Flexbox + Inline Style)**:
```tsx
export function ThreePanelLayout({ left, center, right }: Props) {
  const leftPanel = usePanelResize(280, 200, 600, 'left')
  const rightPanel = usePanelResize(360, 250, 800, 'right')

  return (
    <div className="flex w-full h-full p-2 overflow-hidden bg-bg-primary">
      {/* Left Panel */}
      <div 
        style={{ width: \`\${leftPanel.width}px\` }} 
        className="flex-shrink-0 min-h-0 mr-1"
      >
        {left}
      </div>

      {/* Left Sash (핸들) */}
      <ResizeHandle onMouseDown={leftPanel.startResize} />

      {/* Center Panel */}
      <div className="flex-1 min-w-0 min-h-0 px-1">
        {center}
      </div>

      {/* Right Sash (핸들) */}
      <ResizeHandle onMouseDown={rightPanel.startResize} />

      {/* Right Panel */}
      <div 
        style={{ width: \`\${rightPanel.width}px\` }} 
        className="flex-shrink-0 min-h-0 ml-1"
      >
        {right}
      </div>
    </div>
  )
}
```

---

### Phase 3: Resize Sash (핸들) 스타일링

Cursor / VS Code 스타일과 완전 일치하도록 클래스 설정:

```tsx
function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="
        group relative flex items-center justify-center
        w-2 mx-0.5 cursor-col-resize z-10
      "
    >
      {/* 기본 상태 구분선 */}
      <div className="absolute inset-y-0 w-px bg-border/50 group-hover:bg-accent transition-colors" />
      
      {/* 드래그 상태 강조선 */}
      <div className="absolute inset-y-0 w-1 bg-transparent active:bg-accent-primary transition-colors opacity-0 active:opacity-100" />
    </div>
  )
}
```

---

### Phase 4: LocalStorage 상태 저장 연동

VibeLens는 앱을 껐다 켜도 사용자가 조정한 패널 크기가 유지되어야 합니다.
React 상태 트리를 무겁게 하지 않기 위해 `mouseup` 이벤트 시점에만 localStorage에 저장합니다.

```typescript
// 초기값 로딩 로직 (App 부트스트랩 시점)
const savedLeft = localStorage.getItem('vibelens:panel:left')
const initialLeft = savedLeft ? parseInt(savedLeft, 10) : 280

// onMouseUp 내부에 저장 로직 추가
const onMouseUp = () => {
    isDragging.current = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    
    // 상태 저장
    localStorage.setItem(\`vibelens:panel:\${side}\`, newWidth.toString())
}
```

---

## 🎨 디자인 시스템 (Catppuccin Mocha)

| 요소 | Tailwind 클래스 | 적용 |
|------|-----------------|------|
| Sash 기본선 | `bg-border/50` | 희미한 경계선 |
| Sash 호버 | `bg-accent` (Blue) | 마우스 오버 시 푸른 조명 |
| Sash 드래그 | `bg-accent-primary` (Teal) | 마우스 다운/드래그 시 강조색 |

---

## 📐 패널 크기 제약 (Pixel)

- **Left (커밋 타임라인)**: 기본 `280px` / 최소 `200px` / 최대 `600px`
- **Center (Diff 뷰어)**: 가변 영역 (`flex-1`). 최소 넓이 보장을 위해 `min-w-[300px]` 스타일 고려.
- **Right (AI 패널)**: 기본 `360px` / 최소 `250px` / 최대 `800px`

## 🚀 최종 구현 순서 요약

1. `ThreePanelLayout.tsx` 기존 코드(Grid) 날리기
2. 외부 라이브러리(`react-resizable-panels`) `package.json`에서 제거
3. Custom `usePanelResize` 훅 작성 (내장)
4. Layout을 Flex 구조로 재조립
5. Sash 디자인 입히기
6. MouseEvent 로직 및 localStorage 저장 로직 테스트
7. Git commit.
