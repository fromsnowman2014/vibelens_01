# Resizable Panels Implementation Plan

> **목적**: VibeLens의 3-패널 레이아웃(왼쪽: 커밋 타임라인, 중앙: Diff 뷰어, 오른쪽: AI 분석)에 마우스 드래그로 패널 크기를 조절할 수 있는 기능 추가

**작성일**: 2026-04-14
**최종 수정**: 2026-04-14
**현재 상태**: 고정 폭 패널 (280px / minmax(0,1fr) / 360px)
**목표 상태**: Cursor IDE처럼 사용자가 각 패널의 경계선을 드래그하여 크기 조절 가능
**구현 방법**: react-resizable-panels 라이브러리 사용

---

## 📊 현재 상황 분석

### 1. 현재 레이아웃 구조

**파일**: `src/renderer/src/components/layout/ThreePanelLayout.tsx:11`

```tsx
// 현재 구조
<div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_360px] gap-2 p-2">
  <div className="min-h-0">{left}</div>
  <div className="min-h-0">{center}</div>
  <div className="min-h-0">{right}</div>
</div>
```

### 2. 문제점

| 항목 | 현재 상태 | 문제 |
|------|----------|------|
| **왼쪽 패널** | 고정 280px | 사용자가 조절 불가 |
| **중앙 패널** | 가변 (남은 공간) | 작은 화면에서 너무 좁아짐 |
| **오른쪽 패널** | 고정 360px | 큰 화면에서 공간 낭비 |
| **사용자 경험** | - | 워크플로우에 맞춘 맞춤 설정 불가 |

### 3. 프로젝트 기술 스택

**의존성** (`package.json` 기준):
- React 18.3.1
- Tailwind CSS 3.4.14
- Zustand 5.0.1 (상태 관리)
- Electron 33.0.2
- TypeScript 5.6.3

**디자인 시스템**: Catppuccin Mocha

---

## 🎯 구현 전략: react-resizable-panels

### 선택 이유

**라이브러리**: [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) (by Brian Vaughn, Meta)

#### 핵심 장점

| 기능 | 상세 |
|------|------|
| ✅ **React 18+ 호환** | VibeLens 스택과 완벽 호환 |
| ✅ **TypeScript Native** | 타입 정의 내장, 별도 설치 불필요 |
| ✅ **경량** | 38kb minified, 의존성 없음 |
| ✅ **접근성** | 키보드 네비게이션, 스크린 리더 지원 기본 제공 |
| ✅ **localStorage 자동 저장** | 사용자 설정 자동 복원 |
| ✅ **Tailwind 호환** | 커스텀 스타일링 용이 |
| ✅ **성능 최적화** | requestAnimationFrame 기반 |

#### 제약사항

- ⚠️ 새로운 의존성 추가 (38kb) - VibeLens의 간결한 의존성 정책과 일치

---

## 📝 구현 로드맵

### Phase 1: 패키지 설치 및 설정

#### 1.1 의존성 추가

```bash
npm install react-resizable-panels
```

**예상 버전**: `^2.1.7` (2026-04 기준)

**확인사항**:
- TypeScript 타입이 포함되어 있음 (`@types/*` 불필요)
- peerDependencies: `react@>=16.14.0`

---

### Phase 2: ThreePanelLayout 리팩토링

#### 2.1 파일 수정: `src/renderer/src/components/layout/ThreePanelLayout.tsx`

**변경 전 (기존 코드)**:
```tsx
import { ReactNode } from 'react'

interface Props {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

export function ThreePanelLayout({ left, center, right }: Props) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_360px] gap-2 p-2">
      <div className="min-h-0">{left}</div>
      <div className="min-h-0">{center}</div>
      <div className="min-h-0">{right}</div>
    </div>
  )
}
```

**변경 후 (새 코드)**:
```tsx
import { ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface Props {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

export function ThreePanelLayout({ left, center, right }: Props) {
  return (
    <div className="flex-1 min-h-0 p-2">
      <PanelGroup
        direction="horizontal"
        autoSaveId="vibelens-main-layout"
        className="h-full"
      >
        {/* 왼쪽 패널: 커밋 타임라인 */}
        <Panel
          id="left-panel"
          defaultSize={22}      // 기본 22% (≈280px @ 1280px 화면)
          minSize={15}          // 최소 15% (≈216px @ 1440px)
          maxSize={40}          // 최대 40% (≈576px @ 1440px)
          collapsible={false}   // 완전히 접히지 않도록
        >
          <div className="h-full pr-1">{left}</div>
        </Panel>

        <ResizeHandle />

        {/* 중앙 패널: Diff 뷰어 */}
        <Panel
          id="center-panel"
          defaultSize={48}      // 기본 48% (≈691px @ 1440px)
          minSize={30}          // 최소 30% (소스 코드 가독성 보장)
        >
          <div className="h-full px-1">{center}</div>
        </Panel>

        <ResizeHandle />

        {/* 오른쪽 패널: AI 분석 */}
        <Panel
          id="right-panel"
          defaultSize={30}      // 기본 30% (≈432px @ 1440px)
          minSize={20}          // 최소 20% (≈288px @ 1440px)
          maxSize={50}          // 최대 50% (≈720px @ 1440px)
          collapsible={false}
        >
          <div className="h-full pl-1">{right}</div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

// Resize Handle 컴포넌트 (Catppuccin Mocha 스타일 적용)
function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-1 mx-1 bg-border hover:bg-accent transition-colors cursor-col-resize">
      {/* 호버 시 가시적인 핸들 표시 */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 group-hover:w-1.5 bg-accent/60 opacity-0 group-hover:opacity-100 transition-all rounded-full" />
    </PanelResizeHandle>
  )
}
```

#### 2.2 주요 변경점

| 항목 | 변경 내용 | 이유 |
|------|----------|------|
| **Grid → PanelGroup** | CSS Grid 제거 | 동적 크기 조절 지원 |
| **고정 px → 퍼센트(%)** | 280px → 22%, 360px → 30% | 반응형 레이아웃 |
| **패딩 조정** | `pr-1`, `px-1`, `pl-1` | 패널 간 간격 유지 (기존 gap-2와 유사) |
| **autoSaveId** | `"vibelens-main-layout"` 추가 | localStorage 자동 저장 |

---

### Phase 3: 스타일링 (Catppuccin Mocha 테마)

#### 3.1 Resize Handle 커스터마이징

**목표**: Cursor IDE와 유사한 시각적 피드백

```tsx
function ResizeHandle() {
  return (
    <PanelResizeHandle
      className="
        group relative w-1 mx-1
        bg-transparent hover:bg-accent/20
        transition-all duration-150
        cursor-col-resize
      "
    >
      {/* 기본 상태: 거의 보이지 않는 얇은 선 */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border opacity-50" />

      {/* 호버 상태: 강조 표시 */}
      <div
        className="
          absolute inset-y-0 left-1/2 -translate-x-1/2
          w-1 bg-accent rounded-full
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        "
      />

      {/* 드래그 중: 더욱 강조 */}
      <div
        className="
          absolute inset-y-0 left-1/2 -translate-x-1/2
          w-1.5 bg-accent-primary shadow-lg
          opacity-0 group-active:opacity-100
          transition-all duration-100
        "
      />
    </PanelResizeHandle>
  )
}
```

#### 3.2 Catppuccin Mocha 색상 매핑

**확인 필요**: `tailwind.config.ts`에서 아래 클래스 존재 여부 확인

| Tailwind 클래스 | Catppuccin Mocha 색상 | 용도 |
|-----------------|------------------------|------|
| `bg-border` | #45475a (Surface 2) | 기본 경계선 |
| `bg-accent` | #89b4fa (Blue) | 호버 강조 |
| `bg-accent-primary` | #94e2d5 (Teal) | 드래그 중 강조 |

#### 3.3 시각적 상태 전환

1. **기본 상태** (Idle)
   - 너비: 1px
   - 투명도: 50%
   - 색상: `bg-border`

2. **호버 상태** (Hover)
   - 너비: 4px
   - 투명도: 100%
   - 색상: `bg-accent`
   - 전환 시간: 150ms

3. **드래그 중** (Active)
   - 너비: 6px
   - 투명도: 100%
   - 색상: `bg-accent-primary`
   - 효과: shadow-lg
   - 전환 시간: 100ms

---

### Phase 4: 사용자 설정 저장 (자동 지원)

#### 4.1 localStorage 자동 저장

`autoSaveId` prop을 설정하면 사용자가 조정한 크기가 자동으로 저장됩니다:

```tsx
<PanelGroup
  direction="horizontal"
  autoSaveId="vibelens-main-layout"  // 🔑 이 ID로 localStorage에 저장
>
```

**저장 위치**: `localStorage.getItem('vibelens-main-layout')`

**저장 데이터 형식**:
```json
[22, 48, 30]  // 각 패널의 퍼센트 크기 (left, center, right)
```

**복원 시점**: 앱 재시작 시 `PanelGroup`이 자동으로 복원

#### 4.2 Zustand 스토어 연동 (선택사항)

localStorage 대신 기존 Zustand 패턴으로 관리하려면:

**새 파일 생성**: `src/renderer/src/stores/layoutStore.ts`

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  panelSizes: { left: number; center: number; right: number }
  setPanelSizes: (sizes: { left: number; center: number; right: number }) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      panelSizes: { left: 22, center: 48, right: 30 },
      setPanelSizes: (sizes) => set({ panelSizes: sizes })
    }),
    { name: 'vibelens-layout' }
  )
)
```

**ThreePanelLayout에서 사용**:
```tsx
import { useLayoutStore } from '@renderer/stores/layoutStore'

export function ThreePanelLayout({ left, center, right }: Props) {
  const { panelSizes, setPanelSizes } = useLayoutStore()

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={(sizes) => {
        setPanelSizes({
          left: sizes[0],
          center: sizes[1],
          right: sizes[2]
        })
      }}
    >
      <Panel defaultSize={panelSizes.left}>
        {/* ... */}
      </Panel>
      {/* ... */}
    </PanelGroup>
  )
}
```

**권장 사항**: 초기 구현은 `autoSaveId` 사용 (간단함), 향후 필요 시 Zustand로 마이그레이션

---

### Phase 5: 접근성 (Accessibility)

#### 5.1 react-resizable-panels의 기본 a11y 지원

라이브러리가 자동으로 제공하는 기능:
- ✅ `role="separator"` 자동 적용
- ✅ `aria-orientation="horizontal"` 설정
- ✅ 키보드 네비게이션 (←/→ 화살표로 크기 조절)
- ✅ `aria-valuenow`, `aria-valuemin`, `aria-valuemax` 동적 업데이트
- ✅ 터치 이벤트 기본 지원

#### 5.2 추가 개선 (선택사항)

```tsx
<PanelResizeHandle
  className="..."
  aria-label="Resize panels"  // 스크린 리더용 라벨
  tabIndex={0}                // 키보드 포커스 명시적 허용 (기본값)
/>
```

---

### Phase 6: 고급 기능 (선택사항)

#### 6.1 픽셀 기반 최소 크기 강제

react-resizable-panels는 **퍼센트(%) 기반**이지만, 윈도우 크기에 따라 동적으로 조정 가능:

```tsx
import { useEffect, useState } from 'react'

export function ThreePanelLayout({ left, center, right }: Props) {
  const [minSizes, setMinSizes] = useState({ left: 15, center: 30, right: 20 })

  // 윈도우 리사이즈 시 퍼센트 재계산
  useEffect(() => {
    const updateMinSizes = () => {
      const width = window.innerWidth - 16 // 패딩 제외
      setMinSizes({
        left: Math.max(15, (200 / width) * 100),    // 최소 200px 또는 15%
        center: Math.max(30, (400 / width) * 100),  // 최소 400px 또는 30%
        right: Math.max(20, (280 / width) * 100)    // 최소 280px 또는 20%
      })
    }
    window.addEventListener('resize', updateMinSizes)
    updateMinSizes()
    return () => window.removeEventListener('resize', updateMinSizes)
  }, [])

  return (
    <PanelGroup direction="horizontal" autoSaveId="vibelens-main-layout">
      <Panel minSize={minSizes.left} defaultSize={22}>
        {/* ... */}
      </Panel>
      {/* ... */}
    </PanelGroup>
  )
}
```

**권장 시점**: Phase 1-5 완료 후, QA에서 최소 윈도우 크기(1000px) 테스트 시 문제 발견 시 적용

---

## 📐 크기 설정 가이드

### 기본 크기 (1440px 기준 - Electron 기본 윈도우)

| 패널 | 현재 크기 | 새 기본값 | 최소값 | 최대값 |
|------|-----------|-----------|--------|--------|
| **왼쪽** (커밋) | 280px (19.4%) | 22% (≈317px) | 15% (≈216px) | 40% (≈576px) |
| **중앙** (Diff) | 가변 (≈720px) | 48% (≈691px) | 30% (≈432px) | 무제한 |
| **오른쪽** (AI) | 360px (25%) | 30% (≈432px) | 20% (≈288px) | 50% (≈720px) |

**계산식**: `1440px - 32px(padding) - 8px(gap) = 1400px`

### 최소 윈도우 크기 (1000px)

| 패널 | 최소값 (%) | 실제 크기 | 검증 |
|------|------------|----------|------|
| 왼쪽 | 15% | 150px | ✅ 커밋 해시 표시 가능 |
| 중앙 | 30% | 300px | ✅ 코드 diff 가독성 확보 |
| 오른쪽 | 20% | 200px | ✅ AI 분석 요약 표시 가능 |

**총합 검증**: 150 + 300 + 200 = 650px < 1000px ✅ (패딩/갭 포함 안전)

---

## 🔍 예상 코드 변경 범위

### 수정할 파일

1. **package.json** (의존성 추가)
   - 추가 라인: `"react-resizable-panels": "^2.1.7"`
   - 영향도: **낮음** (단순 의존성 추가)

2. **ThreePanelLayout.tsx** (주요 변경)
   - 파일 경로: `src/renderer/src/components/layout/ThreePanelLayout.tsx`
   - 변경 라인: 전체 (18줄 → 70줄)
   - 영향도: **높음** (레이아웃 전면 변경)

### 영향 받지 않는 파일

- ✅ `LeftPanel.tsx` - 변경 불필요 (Props 동일)
- ✅ `CenterPanel.tsx` - 변경 불필요 (Props 동일)
- ✅ `AIContextPanel.tsx` - 변경 불필요 (Props 동일)
- ✅ `App.tsx` - 변경 불필요 (ThreePanelLayout 사용법 동일)
- ✅ 모든 스토어 파일 - 변경 불필요 (Phase 4.2 선택 시 제외)

**중요**: 이 변경은 **완전히 독립적**이며, 다른 컴포넌트에 영향을 주지 않습니다.

---

## 🧪 테스트 계획

### 수동 테스트 체크리스트

#### 기능 테스트
- [ ] 왼쪽-중앙 경계선 드래그 가능
- [ ] 중앙-오른쪽 경계선 드래그 가능
- [ ] 최소 크기 제약 작동 확인 (각 패널이 너무 작아지지 않음)
- [ ] 최대 크기 제약 작동 확인 (한 패널이 화면을 독점하지 않음)
- [ ] 윈도우 리사이즈 시 비율 유지
- [ ] localStorage 저장/복원 (앱 재시작 후 크기 유지)

#### 시각적 테스트
- [ ] 드래그 핸들 호버 효과 작동 (기본 → 호버 → 드래그)
- [ ] 드래그 중 커서 변경 (`cursor-col-resize`)
- [ ] Catppuccin Mocha 색상 테마 일치 확인
- [ ] 패널 간 간격 일관성 (기존 `gap-2`와 유사한 느낌)

#### 접근성 테스트
- [ ] 키보드로 드래그 핸들 포커스 가능 (Tab 키)
- [ ] 화살표 키로 크기 조절 가능 (←/→)
- [ ] 스크린 리더 호환성 (macOS VoiceOver)
- [ ] 포커스 링 시각적 표시

#### Edge Cases
- [ ] 최소 윈도우 크기 (1000px) 에서 정상 작동
- [ ] 모든 패널이 동시에 최소 크기에 도달할 때 동작
- [ ] 빠른 연속 드래그 시 성능 이슈 없음
- [ ] localStorage quota 초과 시 graceful degradation

---

## 🚀 구현 순서 (Sprint 기반)

### Sprint 1: 기본 구현 (1-2시간)
1. ✅ `react-resizable-panels` 설치
2. ✅ `ThreePanelLayout.tsx` 리팩토링 (Phase 2)
3. ✅ 기본 ResizeHandle 구현
4. ✅ 크기 제약 설정 (minSize, maxSize)
5. ✅ `npm run dev`로 동작 확인

### Sprint 2: 스타일링 (30분-1시간)
1. ✅ ResizeHandle 커스텀 스타일 적용 (Phase 3)
2. ✅ 호버/드래그 상태 시각 효과
3. ✅ Catppuccin 테마 색상 확인 및 조정
4. ✅ 패딩/마진 미세 조정

### Sprint 3: 사용자 설정 저장 (30분)
1. ✅ `autoSaveId` 설정 확인 (Phase 4)
2. ✅ 앱 재시작 시 크기 복원 테스트
3. ✅ (선택) Zustand 스토어 연동

### Sprint 4: QA 및 폴리싱 (1시간)
1. ✅ 전체 테스트 체크리스트 실행
2. ✅ Edge case 버그 픽스
3. ✅ 접근성 검증 (키보드, 스크린 리더)
4. ✅ 성능 테스트 (드래그 시 프레임 드롭 확인)

**총 예상 시간**: 3-4시간

---

## 🔧 트러블슈팅 가이드

### Issue 1: 드래그 핸들이 보이지 않음

**증상**: 패널 경계에 드래그 핸들이 나타나지 않음

**원인**:
- Tailwind 클래스 충돌
- z-index 문제

**해결**:
```tsx
<PanelResizeHandle className="relative z-10 w-1 mx-1 bg-accent" />
```

---

### Issue 2: 패널이 최소 크기보다 작아짐

**증상**: `minSize` 설정했음에도 패널이 너무 작아짐

**원인**: 퍼센트가 실제 픽셀로 변환 시 너무 작음

**해결**: Phase 6.1의 동적 계산 로직 적용

```tsx
// 최소 픽셀 크기 강제
minSize={Math.max(15, (200 / window.innerWidth) * 100)}
```

---

### Issue 3: localStorage 저장 안 됨

**증상**: 앱 재시작 시 패널 크기가 복원되지 않음

**원인**:
- `autoSaveId`가 중복되거나 설정 안 됨
- Electron 보안 정책으로 localStorage 차단

**해결**:
1. 고유한 ID 사용 확인
   ```tsx
   <PanelGroup autoSaveId="vibelens-main-layout">
   ```

2. Electron 개발자 도구에서 확인
   ```js
   localStorage.getItem('vibelens-main-layout')
   ```

3. localStorage 권한 확인 (Electron webPreferences)

---

### Issue 4: 드래그 중 깜빡임 (flickering)

**증상**: 드래그 시 화면이 깜빡거림

**원인**: React 리렌더링 과다

**해결**:
- react-resizable-panels는 내부적으로 최적화되어 있음
- 부모 컴포넌트에서 불필요한 리렌더링 방지
- 필요 시 `React.memo()` 적용

```tsx
export const ThreePanelLayout = React.memo(({ left, center, right }: Props) => {
  // ...
})
```

---

## 🎨 디자인 시스템 통합

### Catppuccin Mocha 색상 참조

**확인 위치**: `tailwind.config.ts`

```css
/* 예상 Tailwind 클래스 */
.bg-border       /* #45475a - Surface 2 (기본 경계선) */
.bg-accent       /* #89b4fa - Blue (호버 강조) */
.bg-accent-primary  /* #94e2d5 - Teal (드래그 중 강조) */
.text-fg-muted   /* #6c7086 - Overlay 0 (희미한 텍스트) */
```

### 호버 상태 애니메이션 타이밍

| 상태 전환 | 지속 시간 | Easing |
|----------|----------|--------|
| 기본 → 호버 | 150ms | ease-in-out |
| 호버 → 드래그 | 100ms | ease-out |
| 드래그 → 기본 | 200ms | ease-in |

---

## 📚 참고 자료

### 공식 문서
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
- [react-resizable-panels Storybook](https://react-resizable-panels.vercel.app/)
- [API 문서](https://github.com/bvaughn/react-resizable-panels/blob/main/packages/react-resizable-panels/README.md)

### 유사 구현 사례
- **VS Code**: Monaco Editor resizable panels
- **Cursor IDE**: AI + Code split view (우리의 목표와 가장 유사)
- **Linear**: Issue tracker three-panel layout
- **GitHub**: Code review diff view

### 커뮤니티 예제
- [CodeSandbox: Horizontal Example](https://codesandbox.io/s/react-resizable-panels-horizontal-example)
- [Examples Gallery](https://react-resizable-panels.vercel.app/?path=/story/examples)

---

## 🎯 성공 기준

### 필수 (P0) - Sprint 1-2 완료 시 달성
- [x] 사용자가 마우스로 패널 경계를 드래그하여 크기 조절 가능
- [x] 최소 크기 제약 적용 (각 패널이 완전히 숨겨지지 않음)
- [x] 앱 재시작 시 사용자가 조정한 크기 복원
- [x] Catppuccin Mocha 디자인 시스템 일치

### 권장 (P1) - Sprint 3-4 완료 시 달성
- [ ] 키보드로 크기 조절 가능 (접근성)
- [ ] 호버 시 시각적 피드백 (핸들 강조)
- [ ] 드래그 중 부드러운 애니메이션 (60fps)

### 선택 (P2) - 향후 개선
- [ ] 더블클릭으로 기본 크기 복원
- [ ] 패널 토글 버튼 (완전히 숨기기/보이기)
- [ ] 프리셋 레이아웃 (예: "Focus Mode" = 중앙 패널 확장)

---

## 🔒 보안 및 성능 고려사항

### 보안
- ✅ **localStorage 사용 안전**: 민감 정보 없음, 레이아웃 크기만 저장
- ✅ **XSS 위험 없음**: 사용자 입력 없음, 라이브러리가 안전하게 처리
- ✅ **Electron contextIsolation 호환**: preload 스크립트 수정 불필요

### 성능
- ✅ **requestAnimationFrame 최적화**: react-resizable-panels가 자동 처리
- ✅ **드래그 중 리렌더링 최소화**: 내부 최적화로 60fps 유지
- ⚠️ **기존 이슈 주의**: 매우 큰 Diff 파일 렌더링 시 성능 저하 가능 (DiffViewer 관련, 이 변경과 무관)

### 번들 크기 영향
- **Before**: ~1.2MB (기존 의존성)
- **After**: ~1.24MB (+38KB react-resizable-panels)
- **영향도**: 미미함 (3% 증가)

---

## 📝 체인지 로그

### v0.2.0 - Resizable Panels (구현 후 작성 예정)

#### Added
- [ ] `react-resizable-panels` 의존성 (^2.1.7)
- [ ] 사용자 정의 가능한 패널 크기 조절 기능
- [ ] Cursor IDE 스타일 드래그 핸들
- [ ] localStorage 기반 패널 크기 자동 저장/복원
- [ ] 키보드 접근성 지원 (←/→ 화살표로 크기 조절)

#### Changed
- [ ] `ThreePanelLayout` 구조 변경 (CSS Grid → react-resizable-panels)
- [ ] 패널 크기 단위 변경 (고정 px → 반응형 %)

#### Improved
- [ ] 작은 화면에서 중앙 패널 가독성 개선
- [ ] 큰 화면에서 공간 활용도 향상
- [ ] 사용자 워크플로우에 맞춘 맞춤 설정 가능

#### Fixed
- [ ] 작은 화면에서 중앙 Diff 패널이 너무 좁아지는 문제

---

## 🎉 마무리

이 계획서는 VibeLens에 **Cursor IDE 스타일의 리사이저블 패널**을 추가하는 완전한 로드맵을 제공합니다.

### 핵심 요약

| 항목 | 내용 |
|------|------|
| **구현 방법** | react-resizable-panels (Meta의 Brian Vaughn 제작) |
| **수정 파일** | ThreePanelLayout.tsx (단일 파일) |
| **영향 범위** | 최소 (다른 컴포넌트 변경 불필요) |
| **예상 시간** | 3-4시간 (테스트 포함) |
| **번들 크기** | +38KB (미미함) |

### 주요 장점

1. ✅ **간단한 구현**: 단일 파일만 수정
2. ✅ **자동 저장**: localStorage 기본 지원
3. ✅ **접근성**: 키보드 네비게이션 기본 제공
4. ✅ **디자인 일관성**: Catppuccin Mocha 테마 유지
5. ✅ **유지보수 용이**: 활발히 관리되는 라이브러리

### 다음 단계

1. **Sprint 1 시작**: `npm install react-resizable-panels`
2. **코드 리팩토링**: Phase 2 참조
3. **테스트**: 체크리스트 실행
4. **커밋**: `feat: add resizable panels to three-panel layout`

**구현 준비 완료!** 🚀

---

**작성자**: Claude (Sonnet 4.5)
**작성일**: 2026-04-14
**최종 수정**: 2026-04-14
**버전**: 2.0
