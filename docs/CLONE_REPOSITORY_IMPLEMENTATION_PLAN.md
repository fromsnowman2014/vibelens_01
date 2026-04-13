# Clone Repository 기능 구현 계획

**작성일**: 2026-04-12
**목적**: 다른 사람의 Git Repository를 Clone하여 VibeLens로 분석을 시작하는 기능 구현

---

## 📋 현재 상태 분석 (2026-04-12 업데이트)

### ✅ 이미 구현된 부분

1. **UI 요소** ✅
   - `TitleBar.tsx` (line 60-63): Clone 버튼 완벽히 구현됨
   - `CloneRepoDialog.tsx`: Clone 모달 컴포넌트 완전히 구현됨

2. **IPC 채널** ✅
   - `repo:clone` - Git clone 실행 (Main Process) 완성
   - `repo:selectDirectory` - 클론 대상 디렉토리 선택 완성

3. **Backend Service** ✅
   - `gitService.ts`: `cloneRepo(url, destPath)` 함수 구현됨
   - `simple-git`를 사용한 clone 로직 완성

4. **App.tsx 통합** ✅
   - Clone 모달 상태 관리 완성 (line 23)
   - Clone 버튼 연결 완성 (line 128)
   - Clone 후 자동 Repository 열기 완성 (line 188-200)
   - 성공/실패 Toast 알림 완성

5. **CloneRepoDialog 기능** ✅
   - URL 입력 필드
   - 디렉토리 선택 브라우저
   - Clone 진행 중 로딩 상태
   - 에러 메시지 표시
   - 자동 레포지토리명 추출

### ✅ 2026-04-12 추가 구현 완료

1. **URL 검증** ✅
   - GitHub HTTPS/SSH URL 검증
   - GitLab HTTPS/SSH URL 검증
   - Generic Git URL 검증
   - 실시간 검증 피드백 (경고 테두리 + 에러 메시지)

2. **개선된 에러 핸들링** ✅
   - "Repository not found" 처리
   - "Permission denied" 처리
   - "Directory already exists" 처리
   - "Authentication required" 처리
   - 사용자 친화적 에러 메시지

3. **UX 개선** ✅
   - Clone 버튼은 유효한 URL과 디렉토리가 모두 선택되어야만 활성화
   - Clone 진행 중에는 모달 닫기 비활성화
   - 실시간 URL 검증 피드백

### ✅ 완전히 동작하는 기능

**Clone Repository 기능은 이미 완전히 구현되어 있으며, 다음과 같이 동작합니다:**

1. 사용자가 TitleBar의 "Clone" 버튼 클릭
2. CloneRepoDialog 모달 표시
3. Git Repository URL 입력 (실시간 검증)
4. 대상 디렉토리 선택
5. "Clone" 버튼 클릭
6. Clone 진행 (로딩 표시)
7. 성공 시:
   - 자동으로 해당 Repository 열기
   - 성공 Toast 알림 표시
8. 실패 시:
   - 사용자 친화적 에러 메시지 표시

### 🎯 추가 개선 가능 사항 (선택)

이미 핵심 기능은 완성되었으므로, 다음은 선택적 개선사항입니다:

---

## 🎯 구현 계획

### Phase 1: 기본 Clone 기능 동작 확인 및 수정 ✅

#### Task 1.1: App.tsx에서 Clone 모달 상태 확인
**파일**: `src/renderer/src/App.tsx`

**확인 사항**:
- `showCloneDialog` state가 있는지
- `onClone` callback이 올바르게 연결되어 있는지
- `CloneRepoDialog` 컴포넌트가 렌더링되는지

**예상 코드**:
```typescript
const [showCloneDialog, setShowCloneDialog] = useState(false)

<TitleBar
  onOpenSettings={() => setShowSettings(true)}
  onClone={() => setShowCloneDialog(true)}
/>

{showCloneDialog && (
  <CloneRepoDialog onClose={() => setShowCloneDialog(false)} />
)}
```

---

#### Task 1.2: CloneRepoDialog 컴포넌트 확인 및 개선
**파일**: `src/renderer/src/components/modals/CloneRepoDialog.tsx`

**확인 사항**:
1. UI 레이아웃 확인
2. URL 입력 필드
3. 대상 디렉토리 선택 버튼
4. Clone 실행 버튼
5. 에러 메시지 표시

**개선 사항**:
- URL 유효성 검증 (Git URL 형식)
- Clone 진행 중 로딩 상태
- 완료 후 자동으로 레포 열기

---

#### Task 1.3: Clone 성공 후 Repository 자동 열기
**파일**: `src/renderer/src/stores/repoStore.ts`

**추가 함수**:
```typescript
cloneAndOpen: async (url: string, destPath: string) => {
  try {
    // 1. Clone 실행
    const result = await unwrap(api.repo.clone(url, destPath))

    // 2. Clone된 레포 경로 확인
    const repoPath = result.path

    // 3. 자동으로 해당 레포 열기
    await get().openRepoByPath(repoPath)

    return { success: true, path: repoPath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

---

### Phase 2: 에러 핸들링 및 UX 개선 🚀

#### Task 2.1: URL 검증 추가
**파일**: `src/renderer/src/components/modals/CloneRepoDialog.tsx`

**구현**:
```typescript
const validateGitUrl = (url: string): boolean => {
  const patterns = [
    /^https:\/\/github\.com\/[\w-]+\/[\w-]+\.git$/,
    /^git@github\.com:[\w-]+\/[\w-]+\.git$/,
    /^https:\/\/gitlab\.com\/[\w-]+\/[\w-]+\.git$/,
    // Add more patterns as needed
  ]
  return patterns.some(pattern => pattern.test(url))
}
```

---

#### Task 2.2: 진행률 표시 (선택 사항)
**파일**: `src/main/services/gitService.ts`

**개선**:
```typescript
export async function cloneRepo(
  url: string,
  destPath: string,
  onProgress?: (progress: { phase: string; loaded: number; total: number }) => void
): Promise<{ path: string; valid: boolean }> {
  const git = simpleGit()

  await git.clone(url, destPath, {
    '--progress': null,
    // progress callback 설정
  })

  // ... rest of implementation
}
```

**Note**: `simple-git`의 progress callback 지원 확인 필요

---

#### Task 2.3: 에러 타입별 처리
**파일**: `src/renderer/src/components/modals/CloneRepoDialog.tsx`

**에러 케이스**:
1. **Invalid URL**: "Please enter a valid Git repository URL"
2. **Network Error**: "Failed to connect. Check your internet connection."
3. **Authentication Error**: "Repository requires authentication. Try using SSH or provide credentials."
4. **Permission Error**: "Permission denied. Check directory write permissions."
5. **Already Exists**: "Directory already exists. Choose a different location."

---

#### Task 2.4: Clone 완료 토스트
**파일**: `src/renderer/src/components/modals/CloneRepoDialog.tsx`

**구현**:
```typescript
import { toast } from '@renderer/components/primitives/Toast'

// Clone 성공 시
toast({
  kind: 'success',
  title: 'Repository Cloned',
  description: `Successfully cloned to ${destPath}`
})

// Clone 실패 시
toast({
  kind: 'error',
  title: 'Clone Failed',
  description: errorMessage
})
```

---

### Phase 3: 고급 기능 (선택 사항) 🎨

#### Task 3.1: Clone 히스토리
**파일**: 새로운 파일 또는 `settingsService.ts` 확장

**기능**:
- 최근 Clone한 Repository 목록
- Quick clone from history

---

#### Task 3.2: Branch 선택
**구현**:
- Clone 시 특정 브랜치만 가져오기
- `--branch` 옵션 추가

---

#### Task 3.3: Shallow Clone 옵션
**구현**:
- `--depth 1` 옵션으로 최신 커밋만 가져오기
- 대용량 레포지토리 빠른 Clone

---

## 🗂️ 파일 수정 목록

### 필수 수정

1. **`src/renderer/src/App.tsx`**
   - Clone 모달 상태 추가/확인
   - CloneRepoDialog 렌더링

2. **`src/renderer/src/components/modals/CloneRepoDialog.tsx`**
   - UI 레이아웃 개선
   - URL 검증
   - Clone 실행 로직
   - 에러 핸들링
   - 로딩 상태

3. **`src/renderer/src/stores/repoStore.ts`**
   - `cloneAndOpen()` 함수 추가

### 선택 수정

4. **`src/main/services/gitService.ts`**
   - Progress callback 추가 (선택)

5. **`src/renderer/src/components/primitives/Toast.tsx`**
   - Clone 완료 알림

---

## 🧪 테스트 시나리오

### 기본 테스트

1. **Public Repository Clone**
   - URL: `https://github.com/user/repo.git`
   - 예상: 성공적으로 Clone 및 자동 열기

2. **Invalid URL**
   - URL: `not-a-valid-url`
   - 예상: 에러 메시지 표시

3. **Network Error**
   - 인터넷 연결 끊기
   - 예상: 네트워크 에러 메시지

4. **Already Exists**
   - 같은 디렉토리에 재Clone
   - 예상: 에러 메시지 또는 덮어쓰기 확인

### 고급 테스트

5. **Large Repository**
   - 대용량 레포 Clone
   - 예상: 진행률 표시 (구현 시)

6. **Private Repository**
   - SSH URL 또는 인증 필요
   - 예상: 인증 에러 또는 SSH key 사용

---

## 📝 구현 순서

### Step 1: 기본 동작 확인 (30분)
1. `App.tsx` 확인 및 수정
2. `CloneRepoDialog` 기본 동작 테스트
3. Clone 버튼 클릭 시 모달 표시 확인

### Step 2: Clone 및 자동 열기 (1시간)
4. `repoStore.ts`에 `cloneAndOpen()` 추가
5. `CloneRepoDialog`에서 Clone 실행
6. 성공 시 자동으로 레포 열기
7. 기본 에러 핸들링

### Step 3: UX 개선 (1시간)
8. URL 검증 추가
9. 로딩 상태 표시
10. 토스트 알림
11. 에러 메시지 개선

### Step 4: 테스트 및 디버깅 (30분)
12. 다양한 Repository로 테스트
13. 에러 케이스 검증
14. UX 개선

**총 예상 시간**: 3시간

---

## 🚀 시작하기

현재 계획을 기반으로 구현을 시작하려면:

```bash
# 1. 현재 상태 확인
# App.tsx와 CloneRepoDialog.tsx 읽기

# 2. 필요한 수정사항 파악

# 3. Step by Step 구현
```

---

**다음 액션**:
1. `App.tsx` 파일 확인
2. `CloneRepoDialog.tsx` 파일 확인
3. 수정 시작
