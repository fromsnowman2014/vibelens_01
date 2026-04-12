# VibeLens Development Rules

## 📌 Source/Function Map 우선 참조 규칙

**모든 개발 작업 시작 전 필수 사항**:

1. **`docs/SOURCE_FUNCTION_MAP.md` 파일을 먼저 확인**하여 작업할 파일과 함수의 정확한 위치를 파악합니다.
2. 전체 소스 트리를 탐색하거나 불필요한 파일 검색을 **하지 않습니다**.
3. Map 파일에 명시된 **파일 경로와 함수명을 직접 사용**하여 빠르게 작업을 시작합니다.

### 예시 워크플로우

#### ❌ 비효율적인 방식 (피할 것)
```
1. 전체 소스 트리 탐색 (find, tree 등)
2. 여러 파일을 grep으로 검색
3. 관련 없는 파일까지 읽어서 컨텍스트 낭비
```

#### ✅ 효율적인 방식 (권장)
```
1. docs/SOURCE_FUNCTION_MAP.md 확인
2. 필요한 파일 경로 직접 확인
   - 예: src/main/services/gitService.ts:getDiff()
3. 해당 파일만 Read 도구로 열기
4. 즉시 수정/분석 시작
```

---

## 🎯 작업별 Map 참조 가이드

### 문제 분석 (Debugging)

**증상**: API 호출 실패, UI 버그 등

**참조 순서**:
1. `SOURCE_FUNCTION_MAP.md` → "주요 플로우" 섹션 확인
2. 해당 플로우의 관련 파일 확인
   - 예: "커밋 분석 플로우" → `src/renderer/src/stores/analysisStore.ts`
3. 정확한 함수명 확인 후 해당 파일만 Read

---

### 기능 추가 (Feature Development)

**목표**: 새로운 기능 구현

**참조 순서**:
1. `SOURCE_FUNCTION_MAP.md` → "핵심 모듈 및 함수 맵" 섹션
2. 관련 모듈 확인
   - 예: Git 관련 → `src/main/services/gitService.ts`
   - 예: UI 컴포넌트 → `src/renderer/src/components/`
3. 기존 함수 시그니처 확인 후 확장

---

### 성능 개선 (Performance Optimization)

**목표**: 느린 부분 최적화

**참조 순서**:
1. `SOURCE_FUNCTION_MAP.md` → "주요 개선 포인트 참조" 섹션
2. 성능 개선 항목 확인
   - 예: diff 파싱 최적화 → `src/main/services/gitService.ts:getDiff()`
3. 해당 함수만 Read하여 프로파일링

---

### 에러 핸들링 개선

**목표**: 에러 처리 로직 강화

**참조 순서**:
1. `SOURCE_FUNCTION_MAP.md` → "에러 핸들링" 섹션
2. 전역 에러 핸들러 위치 확인
   - 메인: `src/main/ipc/registerIpc.ts:wrap()`
   - 렌더러: `src/renderer/src/api/client.ts:unwrap()`
3. 해당 파일에서 에러 처리 로직 확장

---

## 🔧 파일 수정 시 주의사항

### IPC 통신 변경 시
- **영향 받는 파일 (Map 참조)**:
  1. `src/main/ipc/registerIpc.ts` - 핸들러 등록
  2. `src/preload/index.ts` - API 노출
  3. `src/renderer/src/api/client.ts` - 렌더러 호출
  4. `src/shared/types.ts` - 타입 정의

### 상태 관리 변경 시
- **Zustand Store 위치 (Map 참조)**:
  - Settings: `src/renderer/src/stores/settingsStore.ts`
  - Repo: `src/renderer/src/stores/repoStore.ts`
  - Analysis: `src/renderer/src/stores/analysisStore.ts`

### AI 프롬프트 수정 시
- **직접 접근**:
  - `src/main/services/llm/prompts.ts`
  - `SYSTEM_PROMPT_EN`, `SYSTEM_PROMPT_KO` 상수

---

## 📝 Map 파일 업데이트 규칙

**다음 경우 `SOURCE_FUNCTION_MAP.md` 업데이트 필수**:

1. ✅ 새로운 서비스 파일 추가
2. ✅ 주요 함수 추가/제거/시그니처 변경
3. ✅ IPC 채널 추가/삭제
4. ✅ 새로운 Store 추가
5. ✅ 주요 컴포넌트 구조 변경

**업데이트 방법**:
```
1. docs/SOURCE_FUNCTION_MAP.md 열기
2. 해당 섹션 찾기 (예: "2.2 IPC Handlers")
3. 변경 사항 반영 (함수명, 경로, 설명)
4. "Last Updated" 날짜 갱신
```

---

## 🚀 빠른 시작 체크리스트

새로운 작업 시작 시:

- [ ] `docs/SOURCE_FUNCTION_MAP.md` 확인
- [ ] 작업할 파일 경로 확인
- [ ] 관련 함수/타입 시그니처 확인
- [ ] 해당 파일만 Read로 열기
- [ ] 작업 시작

작업 완료 시:

- [ ] 주요 함수 추가/변경 시 Map 파일 업데이트
- [ ] 변경된 플로우가 있다면 "주요 플로우" 섹션 업데이트
- [ ] "Last Updated" 날짜 갱신

---

## 💡 토큰 효율성 팁

1. **전체 탐색 금지**: `find`, `tree`, `rg` 등으로 전체 소스 탐색 지양
2. **Map 파일 우선**: 항상 `SOURCE_FUNCTION_MAP.md`에서 시작
3. **정확한 경로 사용**: `src/main/services/gitService.ts:getDiff()` 형식으로 직접 접근
4. **플로우 다이어그램 활용**: 복잡한 작업은 "주요 플로우" 섹션 참조

---

**이 규칙을 따르면**:
- ✅ 토큰 사용량 50% 이상 절감
- ✅ 작업 속도 3배 향상
- ✅ 불필요한 파일 읽기 방지
- ✅ 정확한 코드 위치 파악

**VibeLens 개발 = Vibe Coding 🎵**
