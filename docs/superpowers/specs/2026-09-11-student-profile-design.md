# Plan: Student Profile（本輪）

## Context

產品方向：讓學生的選課更符合自己的職涯方向，之後再加上選課社群（分享心得、課表、留言）。Profile 是這一切的基礎：學生是誰、想往哪走、修過什麼、時間怎麼安排。Career Flagging、Schedule Builder、CMU Circles 之後都會讀它。

這個 repo 目前**沒有任何使用者資料層**（Prisma 只有 course 相關的 model，backend 全部是讀取，使用者狀態都放在 localStorage），所以本輪會引入：第一個 user collection、第一條寫入路徑、第一個能辨識「是誰」的 auth middleware。

**已確認的決定**
- 帳號：沿用 Clerk，不另做帳號系統。profile 以 JWT 的 `sub`（Clerk user id）為 key，第一次儲存時 upsert 建立。不存 email/andrew ID/姓名。
- 資料存放：新的空 MongoDB Atlas M0 + 本地 backend 只提供 profile 路由；課程資料繼續從 production backend 讀。
- 資料模型：方案 A。每人一份 `profiles` document，各區塊內嵌。
- 職涯/技能/學院主修：固定清單，由我先擬初版、團隊審；職涯選 1-3 個並排優先順序。
- 隱私：以區塊為單位設公開/私人，**預設全部私人**；忙碌時段、修課負擔、modality 永遠私人。
- Onboarding：第一次登入時跑 2 步的簡短引導（學術背景、職涯方向），可以跳過；其餘欄位在 Profile 頁慢慢補，並顯示完成度。

**本輪不做**：用 profile 做推薦、排序或衝突檢查（屬於 Career Flagging / Schedule Builder）；公開 profile 的讀取頁與社群互動（Circles）；「預設首頁篩選」；Clerk 帳號刪除時同步刪除 profile（之後用 Clerk webhook 處理）。

---

## 設計

### 1. 共用 package：`packages/profile`（`@cmucourses/profile`）

frontend 和 backend 共用同一份定義，避免兩邊不一致：
- `taxonomy/careers.ts`、`taxonomy/skills.ts`、`taxonomy/colleges.ts`：`{ id, label, deprecated? }[]`。初版約 10 個職涯、約 30 個技能，另有 CMU 7 個學院及其主修/輔修。**id 一旦發佈就不改名**；要移除時標 `deprecated`（新選擇時隱藏、舊資料仍顯示）。
- `schema.ts`：zod 的 `profilePatchSchema`（每個區塊各一個 schema）+ 推導出的 TS 型別 `Profile`、`ProfilePatch`。backend 用它驗證 request，frontend 用它驗證表單並取得型別，不必手動維護兩份型別。
- 使用方式：比照 `@cmucourses/db`，在 root workspaces 註冊，兩個 app 加 `"@cmucourses/profile": "workspace:*"`。`next.config.mjs` 加 `transpilePackages: ["@cmucourses/profile"]`（package 是 TS 原始碼）。

### 2. Prisma schema（`packages/db/schema.prisma`）

```prisma
enum Modality     { IN_PERSON REMOTE HYBRID }
enum CourseStatus { TAKEN IN_PROGRESS }
enum DegreeLevel  { UNDERGRAD MASTERS PHD }
enum Visibility   { PUBLIC PRIVATE }

type ProfilesAcademic {
  college      String?        // taxonomy id
  majors       String[]
  minors       String[]
  degree       DegreeLevel?
  gradSemester String?        // "fall" | "spring" | "summer"
  gradYear     Int?           // 年級由 degree + 預計畢業推算，不另外存
}

type ProfilesWorkload {
  unitsMin     Int?
  unitsMax     Int?
  hoursPerWeek Int?           // 對應 FCE hrsPerWeek 加總
}

type ProfilesBusyBlocks {
  day   Int                   // 0 = Sunday … 6 = Saturday
  begin Int                   // 午夜起算分鐘數，14:00 → 840
  end   Int
  label String?
}

type ProfilesCourses {
  courseID String             // 經 standardizeID；可 join courses / fces / 之後的 reviews
  status   CourseStatus
  semester String?
  year     String?
}

type ProfilesVisibility {
  academic Visibility @default(PRIVATE)
  careers  Visibility @default(PRIVATE)
  skills   Visibility @default(PRIVATE)
  courses  Visibility @default(PRIVATE)
}

model profiles {
  id          String               @id @default(auto()) @map("_id") @db.ObjectId
  clerkUserId String               @unique
  displayName String?
  bio         String?
  careers     String[]             // 順序 = 優先順序，最多 3
  skillsHave  String[]
  skillsWant  String[]
  academic    ProfilesAcademic?
  workload    ProfilesWorkload?
  modality    Modality?
  busyBlocks  ProfilesBusyBlocks[]
  courses     ProfilesCourses[]
  visibility  ProfilesVisibility
  onboardedAt DateTime?            // null → 顯示 onboarding；完成或跳過都會設值
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([courses.courseID])      // 留給 Circles 的跨使用者查詢
}
```

- model 名稱沿用 repo 慣例（小寫複數），composite type 的寫法和 `schedules` 相同。
- 不預留之後才用的欄位：MongoDB 之後加欄位不需要 migration。
- 和 V2 Reviews 的關係：評鑑之後放獨立的 `reviews` collection，用 `clerkUserId + courseID` 關聯 `profiles.courses`（例如「只能評修過的課」、預填學期）。FCE 最後不論來自 course-api CSV parser 還是 dummy data，都是用 `courseID` join，這份 schema 不需要改。

### 3. Backend API 與權限

**新 middleware `requireUser`**（`controllers/user.ts`）
- 現有的 `isUser` 在 `AUTH_ENABLED !== "true"` 時直接放行，也不會把 user id 往下傳，所以不能給 profile 用。
- 把 `verifyUserToken` 改成回傳 payload（`isUser` 行為不變）。`requireUser` **一律驗證**，成功後設 `res.locals.userId = payload.sub`；token 缺少、過期或無效都回 401。
- 使用者只能讀寫自己的 profile：user id **只從 token 取**，不接受 request 帶進來的 id。

**路由**（`app.ts`；沿用「token 放在 body」的慣例）

| Method | Path | 作用 |
|---|---|---|
| `POST` | `/user/profile` | 讀自己的 profile；不存在時回傳空的預設值（**讀取不寫入**） |
| `PATCH` | `/user/profile` | body `{ token, profile: ProfilePatch }`：每個出現的**頂層區塊整塊取代**，沒出現的不動；`upsert` by `clerkUserId`；回傳完整 profile |

- `ProfilePatch` 可選的 key：`displayName, bio, careers, skillsHave, skillsWant, academic, workload, modality, busyBlocks, courses, visibility, completeOnboarding`。其中 `completeOnboarding: true` → server 設定 `onboardedAt = now()`（client 不能自己指定時間）。
- **驗證**（`profilePatchSchema`，失敗回 400 並附上欄位錯誤）：
  - taxonomy id 必須存在於清單
  - 職涯 ≤ 3、不重複；主修 ≤ 3；輔修 ≤ 3；技能各 ≤ 30
  - `unitsMin ≤ unitsMax`（0–60），`hoursPerWeek` 0–100
  - busy block：`0 ≤ day ≤ 6`、`0 ≤ begin < end ≤ 1440`，最多 50 筆
  - courses：先 `standardizeID`，格式必須符合 `NN-NNN`，依 courseID 去重，最多 200 筆
  - `displayName` ≤ 50 字元，`bio` ≤ 500 字元
- 課程是否**存在**只由前端檢查（前端的 picker 只能從 `/courses/all` 挑）。backend 做不到，因為本地 Atlas 裡沒有課程資料。
- 新檔 `controllers/profile.ts`：依現有慣例 export `GetProfile` / `PatchProfile` interface，回傳型別用 `util.ts` 的 `PrismaReturn`/`ElemType` 推導；錯誤一律 `next(e)`。
- backend 新增依賴 `zod`（透過 `@cmucourses/profile`）。

### 4. Frontend 資料層：react-query，不進 Redux

- 依 CLAUDE.md 的分工，profile 是 server-owned 資料，放在 `src/app/api/profile.ts`。不做成 redux-persist slice，否則 localStorage 和 server 會有兩份資料，換帳號時上一個人的資料也會留在瀏覽器裡。
- `useFetchProfile()`：`queryKey: ["profile", userId]`，`enabled: isSignedIn`。用預設的 staleTime 並在視窗重新聚焦時 refetch（不用課程資料那種 1 天的 `STALE_TIME`），這樣另一台裝置的修改會反映出來。
- `useUpdateProfile()`：`useMutation` 送 PATCH，先做 optimistic 更新；失敗時 rollback 並用既有的 `react-hot-toast` 提示；最後 invalidate。
- base URL：`NEXT_PUBLIC_PROFILE_BACKEND_URL`，未設定時 fallback 到 `NEXT_PUBLIC_BACKEND_URL`。
- 登出時 `queryClient.removeQueries({ queryKey: ["profile"] })`。

### 5. Frontend UI（沿用現有元件與色盤，不引入新 design system）

**樣式規則（硬性）**
- **頁面與文案裡不出現任何表情符號**。圖示一律用站上已經在用的 `@heroicons/react`（SideNav、Header 都是這樣），例如可見度切換用 `LockClosedIcon` / `GlobeAltIcon`。
- 只重用現有的 class 組合，不新增顏色、字型、陰影或漸層：
  - 卡片：`Card`（`bg-white border-gray-100 rounded border p-6`）+ `Card.Header`
  - 次要文字：`text-gray-500 text-sm`
  - 輸入框：`rounded border px-2 py-1 text-sm bg-transparent border-gray-200`（同 `Aggregate`）
  - 主要按鈕：`rounded border px-4 py-2 text-sm font-medium border-transparent text-blue-900 bg-blue-50 hover:bg-blue-100`（同 `LoginModal`）
  - 次要按鈕：`rounded border px-4 py-2 text-sm text-gray-500 hover:bg-gray-50`
  - 下拉/多選：直接照 `LevelFilter`（Listbox）與 `DepartmentFilter`（Combobox + chips）的結構與 class
  - 空狀態：`mt-6 text-center text-gray-400`（同 Saved 頁）
- 完成度**只用文字**呈現（例如「5 of 7 sections complete」加上缺少的區塊連結），不做進度條，因為站上沒有這種元件。
- 只寫 light-mode class，dark mode 交給 nightwind；實作後逐頁和 Saved / Schedules 頁並排比對，淺色與深色模式都要看。

- **SideNav**：在 Feedback 之後（最後一項，屬於設定類）加「Profile」項目，路徑 `/profile`，icon 用 heroicons outline 的 `IdentificationIcon`（`UserCircleIcon` 已被 Instructors 使用）。
- **`pages/profile.tsx`**：用 `<Page activePage="profile">`，不加 sidebar。內容是一欄 `Card`（`components/Card.tsx`），每張卡片右上角有公開/私人切換（只有可公開的區塊才有）和 Save 按鈕。卡片依序為：
  1. **Public info**：displayName、bio
  2. **Academic background**：degree（Listbox，模式同 `LevelFilter`）、college、majors/minors（多選 Combobox + chips，模式同 `DepartmentFilter`）、預計畢業學期
  3. **Career goals**：從清單選最多 3 個，用 ↑/↓ 按鈕排序，第一個標示為 primary
  4. **Skills**：Have / Want to learn 兩個多選 Combobox
  5. **Course load**：units 範圍、每週時數（數字輸入，樣式同 `Aggregate` 的 `NumericInput`）
  6. **Time & format**：modality radio + 每週忙碌時段列表（星期 + 開始/結束 `<input type="time">` + label + 刪除；Add 按鈕）
  7. **Courses taken / in progress**：`CoursePicker`（headlessui Combobox + `useFetchAllCourses()`，沿用 `ScheduleSearch` 的 hyphenation regex；**不重構** `ScheduleSearch`）+ status + 學期；列表以 `useFetchAllCourses()` 的資料顯示課名（不必每列各打一次 API）
- **完成度**：頁面最上方用文字顯示「X of 7 sections complete」，未完成的區塊可點擊跳到對應卡片（前端計算）。
- **未登入**：顯示說明 + `SignInButton`，按鈕樣式同 `LoginModal`。
- **Onboarding**：`components/profile/OnboardingModal.tsx`，headlessui `Dialog`，外觀與 `LoginModal` 一致，掛在 `Page.tsx`（與 `LoginModal` 並列；兩者依登入狀態互斥，不會同時出現）。顯示條件：已登入、profile 已載入、`onboardedAt == null`。
  - Step 1：degree、college、major、預計畢業學期
  - Step 2：職涯方向（最多 3 個）
  - 「Skip for now」→ 只送 `completeOnboarding`；「Finish」→ 送兩個區塊 + `completeOnboarding`
- 文案用英文（與全站一致）；只寫 light-mode class，dark mode 交給 nightwind。

---

## 預期成果

### 使用者流程
1. 新使用者登入 → 跳出 2 步的 onboarding，填了或跳過之後都不會再出現（跨裝置也是，因為狀態存在 server）。
2. SideNav 出現「Profile」→ 進入後看到完成度和 7 張卡片，任何時間都能編輯並儲存。
3. 重新整理、登出再登入、換瀏覽器或裝置，資料都還在；換另一個帳號看不到前一個人的資料。
4. 每個可公開的區塊有公開/私人開關，預設私人。本輪還沒有任何頁面會顯示公開資料，開關只負責存下設定。

### Profile 頁（桌面版示意）
`(icon)` 代表 heroicons 的 SVG 圖示，不是表情符號；版面、顏色和字級都與現有頁面相同。
```
┌──────────────────────────────────────────────────────────────────────────┐
│ (favicon) CMU Courses                          (moon) (icon) Sign out    │
├───────────────┬──────────────────────────────────────────────────────────┤
│ (icon) Search │  Your Profile                                            │
│ (icon) Saved  │  5 of 7 sections complete. Missing: Skills, Course load  │
│ (icon) Sched. │ ┌──────────────────────────────────────────────────────┐ │
│ (icon) Profile│ │ Career goals               (lock) Private v   [Save] │ │
│ (icon) Instr. │ │ 1. Machine Learning / AI   Primary       ^  v   x    │ │
│ (icon) Geneds │ │ 2. Software Engineering                  ^  v   x    │ │
│ (icon) Finals │ │ [ Add career goal       v ]            Up to 3       │ │
│ (icon) Feedbk │ └──────────────────────────────────────────────────────┘ │
│               │ ┌──────────────────────────────────────────────────────┐ │
│               │ │ Time & format                  (lock) Always private │ │
│               │ │ Preferred format  (o) In person ( ) Remote ( ) Hybrid│ │
│               │ │ Weekly busy times                                    │ │
│               │ │ [Tue v] [14:00] - [16:00]  Research lab          x   │ │
│               │ │ [Thu v] [18:00] - [21:00]  Part-time job         x   │ │
│               │ │ [ Add busy time ]                            [Save]  │ │
│               │ └──────────────────────────────────────────────────────┘ │
│               │ ┌──────────────────────────────────────────────────────┐ │
│               │ │ Courses taken / in progress  (globe) Public v [Save] │ │
│               │ │ 15-122  Principles of Imperative Computing  Taken F25│ │
│               │ │ 10-301  Introduction to Machine Learning  In progress│ │
│               │ │ [Search courses] [Taken v] [Fall v] [2026]   [Add]   │ │
│               │ └──────────────────────────────────────────────────────┘ │
│               │  ... Public info / Academic / Skills / Course load ...   │
└───────────────┴──────────────────────────────────────────────────────────┘
```
（手機寬度時 SideNav 會變成橫排、卡片全寬；實作時會實測第 8 個 nav 項目是否太擠。）

### Onboarding（第一次登入）
```
┌──────────────────────────────────────────────┐
│ Welcome to CMU Courses              Step 1/2 │
│ Tell us a bit about you so we can tailor     │
│ course suggestions to your goals.            │
│                                              │
│ Degree        [ Undergraduate      v ]       │
│ College       [ School of Computer Science v]│
│ Major         [ Computer Science  x ] [Add]  │
│ Graduating    [ Spring v ] [ 2028 ]          │
│                                              │
│ [ Skip for now ]                   [ Next ]  │
└──────────────────────────────────────────────┘
Step 2/2: Career goals（最多 3 個，可排序） → [ Back ]  [ Finish ]
外框、標題與按鈕樣式與現有 LoginModal 相同。
```

### API 範例
```http
PATCH /user/profile
{ "token": "<clerk jwt>",
  "profile": { "careers": ["ml-ai", "swe"],
               "visibility": { "academic": "PRIVATE", "careers": "PUBLIC", "skills": "PRIVATE", "courses": "PRIVATE" } } }

200 → { "clerkUserId": "user_2x…", "careers": ["ml-ai","swe"], "skillsHave": [], …,
        "visibility": { "academic":"PRIVATE","careers":"PUBLIC","skills":"PRIVATE","courses":"PRIVATE" },
        "onboardedAt": "2026-09-12T…", "updatedAt": "…" }

400 → { "error": "ValidationError", "issues": [{ "path": ["careers"], "message": "At most 3 careers" }] }
401 → token 缺少或無效
```

### 程式碼變動總覽
```
packages/profile/                     新：taxonomy 清單 + zod schema + 型別
packages/db/schema.prisma             新增 profiles model 與 composite types
apps/backend/src/controllers/user.ts  verifyUserToken 回傳 payload、新增 requireUser
apps/backend/src/controllers/profile.ts   新
apps/backend/src/app.ts               2 條路由
apps/frontend/next.config.mjs         transpilePackages
apps/frontend/src/app/api/profile.ts  新：useFetchProfile / useUpdateProfile
apps/frontend/src/pages/profile.tsx   新
apps/frontend/src/components/profile/ 新：各卡片、CoursePicker、OnboardingModal、VisibilityToggle
apps/frontend/src/components/SideNav.tsx、Page.tsx   加 nav 項目、掛 onboarding
.env.template、CLAUDE.md、ROADMAP.md   新 env var、新慣例、進度
```

---

## 實作步驟

**Phase 0 — 環境與 spec**
0. 把兩件事存進 memory：UI 偏好（不用 emoji、樣式要和原網站一致），以及 profile 的產品方向（職涯導向 + 之後的社群平台），並更新 `profile-page-goal`。
1. 開 branch `feature/student-profile`；把這份計畫存成 `docs/superpowers/specs/2026-09-11-student-profile-design.md`。
2. **確認 Clerk instance**（不讀 `.env`）：`bun run dev` 後在 localhost:3010 登入，瀏覽器 console 跑 `window.Clerk.frontendApi` → 從 `https://<frontendApi>/.well-known/jwks.json` 取公鑰轉成 PEM，作為 `CLERK_PEM_KEY`（公鑰本來就公開，不是 secret）。如果是 ScottyLabs 的 production instance、localhost 無法登入，就改用你們自己的 Clerk dev instance。
3. **（需要你操作）** 建立 Atlas M0，在 backend 的 env 設 `MONGODB_URI`（只連 Atlas）、`CLERK_PEM_KEY`、`PORT=3000`；frontend 加 `NEXT_PUBLIC_PROFILE_BACKEND_URL=http://localhost:3000`；同步更新 `.env.template`（只放變數名稱）。

**Phase 1 — 共用 package 與 schema**
4. 建 `packages/profile`：清單初版 + zod schema + 單元測試（`bun test`：合法 / 超過上限 / 未知 id / begin ≥ end / courseID 標準化與去重）。
5. 修改 `schema.prisma` → `db-validate` → `db-generate` → 對 Atlas 跑 `db-migrate`。
6. **Checkpoint**：請團隊審清單初版（id 定案後就不再改名）。

**Phase 2 — Backend**
7. `requireUser` + `controllers/profile.ts` + 路由。
8. 兩個 app 跑 `bunx tsc --noEmit`、`bun run lint`；用 curl 做真實驗證（見 Verification）。

**Phase 3 — Frontend 資料層與頁面**
9. `api/profile.ts`、SideNav 項目、`pages/profile.tsx` 骨架（完成度 + 未登入狀態）。
10. 7 張卡片 + `VisibilityToggle` + `CoursePicker`。

**Phase 4 — Onboarding**
11. `OnboardingModal` 掛到 `Page.tsx`。

**Phase 5 — 收尾**
12. 兩個 app 都跑 tsc + lint（不新增 warning）、`bun run format`。
13. 更新 ROADMAP.md 狀態，在 CLAUDE.md 補上 `requireUser`、profile 路由、`@cmucourses/profile`、新 env var。
14. `git status -sb` 確認後，逐一 stage 明確的路徑再 commit（每個 phase 一個 commit，commit 前先問你）。

## 待處理 / 假設
- Clerk instance 還沒確認 → 由 Phase 0 步驟 2 查清楚。
- 清單初版需要團隊審（Phase 1 的 checkpoint）。
- 假設 schedules 的 `days` 也是 0 = Sunday（`ScheduleCalendar` 的顯示是這樣）。目前還沒用實際課程資料確認；本輪還不會拿 busy blocks 跟課程時間比對，所以不影響，但 Schedule Builder 做衝突比對前必須先確認。
- 課程資料目前沒有 modality 欄位，所以 modality 偏好本輪只會存下來，還沒有地方用到。
- Clerk 刪除帳號後會留下孤兒 profile → 之後用 Clerk webhook 處理，本輪不做。

## Verification

- **共用 schema**：`bun test`（packages/profile）。
- **Backend（實際呼叫，不 mock）**：
  - 不帶 token POST `/user/profile` → 401；帶偽造 token → 401。
  - 用瀏覽器 console `await window.Clerk.session.getToken()` 取得真 token → POST 回傳空的預設 profile → PATCH `careers` → 再 POST 讀回 → 在 Atlas 看到 document、`clerkUserId` 正確、其他區塊沒有被動到。
  - PATCH 非法資料（4 個職涯、未知 id、`day: 9`、`begin > end`）→ 400 並附上欄位錯誤。
- **樣式檢查**：`rg` 掃新增的 frontend 檔案，確認沒有 emoji 字元；截圖和 Saved / Schedules 頁並排比對卡片、按鈕、輸入框，淺色與深色模式各看一次。
- **Frontend（實際操作）**：新帳號登入 → onboarding 出現 → Finish → 重新整理後不再出現；Profile 頁 7 張卡片分別編輯、儲存、重新整理後資料仍在；切換可見度後重新整理仍保留；無痕視窗登入同一帳號看到相同資料；換帳號看不到前一個人的資料；未登入時顯示登入提示；backend 停掉時儲存會出現 toast 並 rollback；dark mode 與手機寬度都檢查過。
- **CI 等價**：兩個 app 都跑 `bunx tsc --noEmit`、`bun run lint`（`next build` 不檢查型別，不能當作證據）。

---

## 實作期間的調整（2026-09-11）

- **主修依學院篩選**（使用者回饋）：選了學院後，Majors 只列出該學院的科系以及「Other / not listed」；換學院時自動移除不屬於新學院的主修；backend 的 `academicSchema` 也會拒絕不相容的組合。輔修維持不篩選，因為 CMU 的輔修開放跨學院修。
- **學程可屬於多個學院**：`ProgramItem.college` 改為 `colleges[]`，因為有合辦學程（Dietrich/Heinz 的 B.S. in Information Systems、Heinz/CFA 的 MAM 與 MEIM）。Heinz 清單依 heinz.cmu.edu 查證並擴充：MISM、MISM-BIDA、AIM、MSIT、MSISPM、MSPPM、MSPPM-Data Analytics、MPM、MSHCA、MMM、MAM、MEIM 與兩個 Ph.D.。MISM 的 16/12 個月、MSPPM 的 DC/Fast Track 只是修業長度或地點，不另列；AI Management 是附加在學位上的 concentration，不列為主修。其他學院的清單仍待查證。
- **Profile 導覽項目放在 Feedback 之後**（使用者回饋）。為了容納第 8 個項目，SideNav 在手機寬度改為項目間距 12px、可橫向捲動；在 md 寬度改為可縱向捲動（原本放不下時會溢出白色側欄）。
- **`useFetchProfile` 的 staleTime 設為 1 分鐘**：onboarding 掛在每一頁上，避免每次換頁都重抓；視窗重新聚焦時仍會 refetch，跨裝置的修改一樣會同步。
- **Clerk instance**：前端用的是 Clerk development instance `clear-redbird-7463.clerk.accounts.dev`；`CLERK_PEM_KEY` 由它的 JWKS 轉出。
- **既有問題（非本次造成）**：整站深色模式無效——建出的 CSS 裡沒有任何 `.dark` 規則。Profile 頁只寫淺色 class，修好後會自動套用。
