# Clone Repository 사용 가이드

**VibeLens Clone Repository 기능 사용법**

---

## 🚀 빠른 시작

### 1. Clone 모달 열기

TitleBar 우측의 **"Clone"** 버튼을 클릭하세요.

![Clone Button Location](타이틀바 우측에 Download 아이콘과 함께 표시됨)

---

### 2. Repository URL 입력

**지원하는 URL 형식:**

#### GitHub
```
# HTTPS
https://github.com/username/repository.git
https://github.com/username/repository

# SSH
git@github.com:username/repository.git
git@github.com:username/repository
```

#### GitLab
```
# HTTPS
https://gitlab.com/username/repository.git
https://gitlab.com/username/repository

# SSH
git@gitlab.com:username/repository.git
git@gitlab.com:username/repository
```

#### 기타 Git 호스팅 서비스
```
# HTTPS
https://your-git-server.com/username/repository.git

# SSH
git@your-git-server.com:username/repository.git
```

**참고**: URL이 유효하지 않으면 실시간으로 경고 메시지가 표시됩니다.

---

### 3. 클론 대상 디렉토리 선택

1. **"Browse"** 버튼 클릭
2. Clone할 상위 디렉토리 선택
3. Repository 이름이 자동으로 추출되어 하위 폴더로 생성됩니다

**예시:**
- URL: `https://github.com/user/vibelens.git`
- 선택한 디렉토리: `/Users/yourname/Projects`
- 최종 Clone 경로: `/Users/yourname/Projects/vibelens`

---

### 4. Clone 실행

**"Clone"** 버튼을 클릭하세요.

**진행 상황:**
- Clone 중에는 로딩 스피너와 "Cloning repository..." 메시지가 표시됩니다
- Clone이 진행되는 동안 모달을 닫을 수 없습니다

---

### 5. Clone 완료

**성공 시:**
- 자동으로 Clone된 Repository가 VibeLens에서 열립니다
- 성공 Toast 알림이 표시됩니다
- 즉시 커밋 분석을 시작할 수 있습니다

**실패 시:**
- 에러 메시지가 표시됩니다 (아래 문제 해결 참고)

---

## ❌ 일반적인 에러 및 해결 방법

### 1. "Repository not found"

**원인:**
- URL이 잘못되었습니다
- Repository가 존재하지 않습니다
- Repository가 삭제되었습니다

**해결:**
- URL을 다시 확인하세요
- 웹 브라우저에서 해당 URL을 열어 Repository가 존재하는지 확인하세요

---

### 2. "Permission denied"

**원인:**
- Private Repository에 접근 권한이 없습니다
- SSH key가 설정되지 않았습니다

**해결:**
- Public Repository인지 확인하세요
- Private Repository의 경우:
  - SSH URL을 사용하고 SSH key가 등록되어 있는지 확인
  - 또는 HTTPS + Personal Access Token 사용 (GitHub Settings → Developer settings → Personal access tokens)

---

### 3. "Directory already exists"

**원인:**
- 선택한 디렉토리에 같은 이름의 폴더가 이미 존재합니다

**해결:**
- 다른 디렉토리를 선택하세요
- 또는 기존 폴더를 삭제/이름 변경하세요

---

### 4. "Authentication required"

**원인:**
- Private Repository에 인증이 필요합니다

**해결:**
- SSH URL 사용 + SSH key 설정
- 또는 HTTPS URL 사용 시 Git Credential Manager 설정

---

### 5. "Invalid Git URL"

**원인:**
- 지원하지 않는 URL 형식입니다

**해결:**
- 위의 "지원하는 URL 형식" 참고
- `.git` 확장자 확인
- 오타 확인

---

## 💡 Tips

### SSH vs HTTPS

**HTTPS (추천 - Public Repository):**
- ✅ 간단하고 쉬움
- ✅ 방화벽 문제 없음
- ❌ Private Repository는 매번 인증 필요

**SSH (추천 - Private Repository):**
- ✅ 한 번 설정하면 인증 불필요
- ✅ Private Repository 편리하게 사용
- ❌ SSH key 설정 필요

---

### Public Repository 추천 예시

VibeLens로 분석해볼만한 Public Repository:

```
# Small projects (빠른 테스트)
https://github.com/anthropics/anthropic-sdk-typescript.git
https://github.com/vercel/next.js.git

# Medium projects
https://github.com/microsoft/vscode.git
https://github.com/facebook/react.git
```

---

## 🔧 고급 사용법

### SSH Key 설정 (Private Repository용)

#### 1. SSH Key 생성 (없는 경우)
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

#### 2. SSH Key를 Git 호스팅에 등록

**GitHub:**
1. Settings → SSH and GPG keys → New SSH key
2. `~/.ssh/id_ed25519.pub` 내용 복사해서 붙여넣기

**GitLab:**
1. Preferences → SSH Keys → Add new key
2. `~/.ssh/id_ed25519.pub` 내용 복사해서 붙여넣기

#### 3. SSH 연결 테스트
```bash
ssh -T git@github.com
# 또는
ssh -T git@gitlab.com
```

성공하면 VibeLens에서 SSH URL로 Clone 가능합니다!

---

## 📚 관련 문서

- **VibeLens 사용 가이드**: `README.md`
- **Clone 구현 상세**: `docs/CLONE_REPOSITORY_IMPLEMENTATION_PLAN.md`
- **소스 코드 맵**: `docs/SOURCE_FUNCTION_MAP.md`

---

## 🐛 문제 신고

Clone 기능에 문제가 있거나 개선 사항이 있다면 GitHub Issues에 신고해주세요.

**필요한 정보:**
- VibeLens 버전
- 운영체제 (macOS version)
- Clone하려던 URL (Public Repository인 경우)
- 에러 메시지 전체
- 스크린샷 (선택사항)

---

**마지막 업데이트**: 2026-04-12
