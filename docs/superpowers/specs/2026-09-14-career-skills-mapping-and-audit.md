# Plan: Career Path & Skills Mapping + Student Profile Code Audit

## Context

Student Profile 已經上線到 fork 的 `main`（`6cfcafc`）：學生可以存職涯方向（`careers`）、已會/想學技能（`skillsHave`/`skillsWant`），但這些資料目前只有儲存和顯示，**沒有連到任何課程**。這一輪要讓它們開始發揮作用：課程上標出「對應哪些職涯、教哪些技能」，並依學生的目標推薦課程。同時對 Profile 程式碼做一次 audit，改善項目之後排進 sprint 或交給 Kausthubh + Aditya。

**已確認的決定**
- 資料模型：人工標記「課程→技能」＋「職涯→技能」，課程對應的職涯由程式推導。
- 推薦位置：搜尋頁側欄加「Match my goals」切換。
- 清單來源：我先擬約 100 門熱門課的初版，團隊審核。

**影響設計的事實（這輪查證）**
- 課程目錄共 **8,398** 門；`/courses/all` 只給 `courseID`、`name`，描述要用 `/courses?courseID=…` 批次抓。
- 搜尋是 **ScottyLabs 正式 API 在伺服器端分頁**（每頁 10 筆），我們無法修改 → 不能在前端依職涯篩選搜尋結果（只會篩到當頁）。
- 關鍵字比對不可靠：「python」只命中 22 門（15-112 這種大量用 Python 的課沒提到），「machine learning」命中 259 門且混入 Tepper 課程 → 對應資料必須人工整理，關鍵字只能當整理時的建議。
- `CourseCard` 只在 3 處渲染（`CourseSearchList`、`CourseList`、`CourseDetail`）→ 改一處就涵蓋搜尋、Saved/Schedules、課程詳細頁。
- `useFetchCourseInfosByPage` 的 queryKey 是整個 `filters` → 切換狀態不能放 filters slice，否則每次切換都重打搜尋 API。

---

# 產出 1：Career Path & Skills Mapping 實作計畫

## 資料來源與架構：靜態對應資料，不需要新 DB 或 endpoint

對應關係是**參考資料**（像 `finals.json` 與 taxonomy 清單），不是使用者資料，放在共用 package `@cmucourses/profile`，前後端都能用、進版控、團隊透過 PR 審核。

**不改 backend / DB 的理由**：課程資料來自改不了的正式 API；對應資料小（約 100 筆）可直接打包；推薦需要的 profile 資料前端已經有（react-query cache）。
**未來選項（這輪不做）**：若團隊要「不部署就能編輯對應」，再把資料搬到我們 Atlas 的 `courseSkills` collection 並加 `GET /mappings`；package 的函式介面不變，只換資料來源。

## Data model（`packages/profile/mapping/`）

```ts
// courseSkills.ts — 唯一的人工事實：這門課教哪些技能（技能 id 由 SKILLS 型別檢查）
export const COURSE_SKILLS = {
  "15-213": ["c-cpp", "systems-programming", "operating-systems"],
  "10-301": ["machine-learning", "python", "statistics"],
  // …約 100 門
} as const satisfies Record<string, readonly SkillID[]>;

// careerSkills.ts — 每個職涯需要的技能（14 個職涯都要有）
export const CAREER_SKILLS = {
  "ml-ai": { core: ["machine-learning", "deep-learning", "statistics"], supporting: ["python", "linear-algebra"] },
  "swe":   { core: ["algorithms", "systems-programming"], supporting: ["databases", "web-development"] },
} as const satisfies Record<CareerID, { core: readonly SkillID[]; supporting: readonly SkillID[] }>;
```

**推導函式**（`mapping/index.ts`，純函式、模組載入時預先建好 Map，查詢 O(1)）：
- `skillsForCourse(courseID)`：輸入先過既有的 `standardizeCourseID`。
- `careersForCourse(courseID)`：課程技能與職涯 **core** 技能有交集才算。只用 core，避免 Python 這類通用技能把一門課標到一堆職涯。
- `recommendCourses({ careers, skillsWant, skillsHave, taken })` → `{ courseID, score, reasons }[]`
  - 只計「新技能」＝課程技能 − `skillsHave`
  - score ＝ 3×命中第一職涯 core ＋ 2×命中其他職涯 core ＋ 1×命中 supporting ＋ 2×命中 `skillsWant`
  - 排除已修／在修的課（profile `courses`）和 0 分的課；依分數、courseID 排序；`reasons` 給 UI 顯示「Matches: Machine Learning, Python」

**型別**：在 taxonomy 匯出 `SkillID`、`CareerID` 字面型別，打錯 id 在 tsc 就會報錯。

## 整理工具（`packages/profile/scripts/`，手動執行、需要網路、不進 CI）
- `check-course-ids.ts`：抓 `/courses/all`，列出對應表中不存在於目錄的 courseID。
- `suggest-courses.ts <skill> <keywords…>`：用正式搜尋 API 列出「可能相關但還沒標記」的課，**只輸出建議、不寫檔**，給團隊補清單用。

## Backend 改動
無。

## Frontend 改動

1. **課程卡片 tags**（涵蓋搜尋、Saved/Schedules、課程詳細頁）
   - 新增 `components/CourseTags.tsx`，放在 `CourseCard.tsx` 系所那一行下方。
   - 兩排小 pill：Skills、Careers；最多顯示 4 個技能、3 個職涯，其餘顯示「+N」。
   - 符合使用者 profile（`skillsWant`、`careers`）的 pill 用現有的藍色 pill 樣式（`text-blue-800 bg-blue-50`），其他用灰色。
   - 課程沒有對應資料時整塊不顯示。沒有 emoji，圖示只用 heroicons，class 全部沿用現有樣式。
   - profile 用現有的 `useFetchProfile()`，共用 react-query cache，不會多打 request。
2. **搜尋頁「Match my goals」**
   - `app/ui.ts` 加 `matchGoals: boolean` 和 toggle action（ui slice 已被 persist）。
   - 新增 `components/filters/GoalsFilter.tsx`，放在 `Filter.tsx` 最上方，checkbox 樣式與其他 filter 相同。
   - 未登入，或沒有職涯目標也沒有想學技能時，checkbox 停用，並附連結「Add career goals on your Profile」。
   - `CourseSearchList.tsx`：`matchGoals` 開啟時改渲染新的 `RecommendedList.tsx`：
     - 用 `recommendCourses(profile)` 取前 50 門，以 `useMemo` 依 profile 快取。
     - 前端每頁 10 筆，重用 `Pagination`；卡片重用 `CourseCard`，課程資料走既有的 batshit 批次抓取和 1 天的 `STALE_TIME`。
     - 每張卡片附上推薦理由。
   - 頂端說明「Showing courses matched to your goals. Search and filters are paused.」，誠實告知搜尋框與其他篩選在這個模式下不生效。
3. **職涯/技能標籤查詢**：順帶修掉 Audit 的 A6（`labelOf` 線性搜尋），改用預建的 id→label Map，因為卡片 tags 會在每張卡片呼叫它。

## 實作步驟
1. taxonomy 匯出 `SkillID`/`CareerID`；建 `mapping/` 三個檔＋`mapping.test.ts`。
2. 初版 `CAREER_SKILLS`（14 職涯）＋ `COURSE_SKILLS`（約 100 門：SCS、ECE、統計/ML、Heinz）；跑 `check-course-ids.ts`。
3. **Checkpoint：請團隊審核對應清單**（可以跟實作並行）。
4. `CourseTags` ＋ `CourseCard` 接上。
5. `ui.matchGoals`、`GoalsFilter`、`RecommendedList`、`CourseSearchList` 分支。
6. tsc ＋ lint（兩個 app）、`bun test`、format；更新 ROADMAP 狀態與 CLAUDE.md；分功能 commit（commit 前先問）。

## Verification
- `bun test`（packages/profile）：每個 courseID 格式正確、14 個職涯都有設定、技能不重複；幾門已知課程的 `careersForCourse` 結果；`recommendCourses` 的排序、排除已修課、`skillsHave` 不計分。
- `check-course-ids.ts` 對正式目錄沒有回報缺漏。
- 實際瀏覽器操作（已登入、真的 Clerk ＋ Atlas）：
  - 15-213 的卡片在搜尋頁、Saved 頁、課程詳細頁都顯示 tags，符合 profile 的 pill 是藍色。
  - 開關「Match my goals」時不會觸發搜尋 API（Network 分頁確認）；推薦清單不含已修的課。
  - 改 Profile 的職涯目標後，推薦結果跟著更新。
  - 未登入時 checkbox 停用並顯示提示。
  - 淺色、深色模式都看過；手機寬度下 pill 會換行。

---

# 產出 2：Student Profile Code Audit（只列出，不修改）

範圍：這次新增的 Profile 相關程式碼。
嚴重度：**高**＝使用者看得到的錯誤或效能問題；**中**＝維護風險；**低**＝小幅改善。

## 效率不佳的迴圈

| # | 位置 | 問題 | 改善方案 | 嚴重度 |
|---|---|---|---|---|
| A1 | `CoursesSection.tsx:63-64` | `nameOf` 對 **8,398 門課**做 `find`，每一列、每次 render 都跑；draft state 在這個元件，所以每次編輯都會重跑 | 在 `api/course.ts` 提供 `useCourseNames()`，用 react-query 的 `select` 建 `Map<courseID, name>`，每份 cache 只算一次 | 高 |
| A2 | `CoursePicker.tsx:32-41` | 每次按鍵都掃完 8,398 筆；迴圈裡 `exclude.includes` 讓複雜度變成 O(N×已選數)；每次都重做 `toLowerCase`；即使前 50 筆就夠了，也會先 `filter` 完整份才 `slice` | `exclude` 改成 Set；用 `useMemo` 預建小寫索引；手寫迴圈，湊滿 50 筆就停；搭配 `useDeferredValue(query)` | 高 |
| A3 | `CoursePicker.tsx:42-43, 55-57` | `displayValue` 又用一次線性 `find` 查課名 | 共用 A1 的 Map | 中 |
| A6 | `taxonomy/types.ts:17` `labelOf` | 線性搜尋；接下來卡片 tags 會在「卡片數 × pill 數」的次數下呼叫 | 每份 taxonomy 在模組載入時預建 id→label Map（**併入 Mapping 一起做**） | 中 |
| A4 | `fields.tsx:185-190, 238` | `activeItems()` 每次 render 重算；`labelOf` 每個 pill 做一次 find；每個選項都跑一次 `value.includes`，是 O(選項×已選) | `useMemo` 預建 Map/Set。清單最長是主修的 55 筆，實際影響小 | 低 |
| A7 | `colleges.ts:105` `majorsForCollege` | 每次呼叫都 filter 全部主修；每次 render `AcademicFields`、每次 zod 驗證都會呼叫 | 模組載入時預建 `Map<college, ProgramItem[]>` | 低 |

## 層層巢狀或繞圈的條件判斷

| # | 位置 | 問題 | 改善方案 | 嚴重度 |
|---|---|---|---|---|
| B6 | `OnboardingModal.tsx:36-39, 48` | `onClose={skip}`：點背景或按 Esc 也會**永久**標記 onboarding 完成，使用者可能只是想先關掉 | `onClose` 只在這次 session 隱藏；只有按「Skip for now」才寫入 server | 高 |
| B2 | `ProfileSection.tsx:19-27` `useDraft` | 巢狀 if 加上在 render 期間 setState（衍生 state 反模式），邏輯很難推理；每個區塊每次 render 做 3 次 deep `isEqual`，7 個區塊約 21 次 | 改成 `draft: T \| null`（null 代表沒有編輯）：顯示值 = `draft ?? saved`，dirty = `draft !== null && !isEqual(draft, saved)`，存檔後 `setDraft(null)`。拿掉 `base` state 和巢狀 if | 中 |
| B5 | `api/profile.ts:21-30, 75` ＋ `ProfileSection.tsx:99` ＋ backend `profile.ts:104-105` | `applyPatch` 的巢狀三元運算，重複實作了 server 的 onboarding 規則；同一個 patch 先在 `save()` 驗證一次，`onMutate` 又驗證一次 | 把 `applyProfilePatch(profile, patch, now)` 移進 `@cmucourses/profile`，前後端共用；驗證只在 mutation 裡做一次 | 中 |
| B1 | `user.ts:15-23` `verifyUserToken` | if/else-if 鏈拋出**字串**，而且檢查的 `exp`/`nbf` 是 `jwt.verify` 本來就會檢查的；拋字串導致 `requireUser:71` 要寫 `e instanceof Error ? … : e`，`isUser:42` 則直接 `send(e)`，Error 物件會送出 `{}` | 過期、生效時間交給 `jwt.verify`；只保留 `azp` 檢查；統一拋 `AuthError` 類別 | 中 |
| B4 | `TimeSection.tsx:56, 60` | 午夜的處理拆在兩個地方：顯示時用 `% 1440`，輸入時用 `end === 0 ? 1440`，是散落各處的魔術數字 | 在 `options.ts` 提供 `endMinutesToTime` / `timeToEndMinutes` 和 `MINUTES_PER_DAY` 常數 | 低 |

## 義大利麵式程式碼、職責不清

| # | 位置 | 問題 | 改善方案 | 嚴重度 |
|---|---|---|---|---|
| C1 | `ProfileSection.tsx:41, 95` ＋ `api/profile.ts:72-90` | 每個區塊和每個公開/私人切換都建立自己的 mutation。兩個存檔同時進行時，前一個失敗會 rollback 到舊的 snapshot，把後一個區塊的樂觀更新蓋掉；比較舊的回應也可能蓋掉比較新的 cache。這是**競態問題** | react-query v5 的 `scope: { id: "profile" }` 讓 profile 的 mutation 依序執行；失敗時改用 `invalidateQueries` 重新抓取，不還原 snapshot | 高 |
| C2 | `fields.tsx`（287 行）、`options.ts`、`WorkloadSection.tsx:6` | `fields.tsx` 是大雜燴：樣式常數加上 5 個元件。`options.ts` 混了選項清單、預設值和時間運算。預設空值散在 3 處（`EMPTY_ACADEMIC`、`EMPTY_WORKLOAD`、package 的 `emptyProfile`） | 拆成 `styles.ts`、`controls/*`（一個控制項一個檔）、`time.ts`；預設值集中到 package，放在 `emptyProfile` 旁邊 | 中 |
| C3 | `CoursePicker.tsx:14-15` | 註解自己承認是從 `ScheduleSearch` 複製過來的課號正規化 regex；Combobox 的 class 字串在 TaxonomyMultiSelect、DepartmentFilter、CoursePicker 三處重複 | 在 `app/utils.tsx` 新增 `hyphenatePartialCourseId`，`ScheduleSearch` 和 `CoursePicker` 都改用它。**不要**改用既有的 `standardizeIdsInString`：它的 `courseIdRegex` 要求完整 5 位數，打到一半的「1521」不會被處理，邊打邊搜尋會壞掉。Combobox 的 class 字串抽成共用常數 | 中 |
| C5 | `user.ts:30-44` vs `52-73` | 兩個 middleware 重複「取 token → 驗證 → 回 401」的流程，而且兩者的 401 回應內容不一致 | 共用一個 `authenticate(req)`；`isUser` 和 `requireUser` 只負責各自不同的地方（和 B1 一起做） | 中 |
| C4 | backend `profile.ts:26-56` `toProfile` | 逐欄位手動轉換，重複寫了很多次 `?? null`。同一個形狀的知識分散在 4 處：Prisma schema、zod schema、`toProfile`、`emptyProfile`，每加一個欄位都要改 4 個地方 | 在 package 定義 response 的 zod schema，由它負責正規化；至少先在 CLAUDE.md 寫下「新增欄位要改哪 4 處」的清單 | 低 |
| C6 | backend `profile.ts:115` | `visibility` 的預設值有兩個來源：Prisma composite 的 `@default` 和 `DEFAULT_VISIBILITY` | 只保留一個來源，建議保留 `DEFAULT_VISIBILITY` | 低 |

**建議分工**：A6 併入這次的 Mapping（卡片 tags 直接受益）。其餘項目依優先序交給 Kausthubh + Aditya：
1. 先處理高嚴重度：**C1 → A1/A2 → B6**
2. 再處理中嚴重度：**B2、B5、B1+C5、C2、C3**
3. 低嚴重度排在最後

以上都不是阻擋 Mapping 的問題。

---

## 實作期間的調整（2026-09-14）

- **初版對應清單**：89 門課（人工整理，逐一對照 `https://course.apis.scottylabs.org/courses/all` 驗證 courseID 存在），跑過一次 `suggest-courses.ts python python "data science"` 後，從結果裡挑了 5 門高信心度的課（`90-812`/`90-819` Python Programming I/II、`11-604` Python for Data Science I、`15-388` Practical Data Science、`36-640` Probability & Statistics for Data Science）補強 python 技能的涵蓋率，最終共 **94 門課**。`check-course-ids.ts` 跑起來全數通過。
- **A6（`labelOf` 線性搜尋）依計畫併入這次改動**：改成用 `WeakMap` 對每個 taxonomy 陣列快取 id→label 的 `Map`，簽名不變，呼叫端（`schema.ts`、`CareersSection.tsx` 等）不用改。
- **發現一個既有環境限制（非本次改動造成）**：本機用「本地 backend/Clerk + 正式 course/FCE API」這種混合設定測試「已登入」畫面時，`/fces` 的請求會帶著本地 dev Clerk 簽發的 token 打到正式 API，正式 API 用的是另一個 Clerk instance 的公鑰驗證，所以一律 401。`CourseCard` 本來就會在 FCE 還在讀取時整張卡片回傳空內容，401 讓這個狀態卡住，結果變成**已登入時搜尋、Saved、Schedules、課程詳細頁的卡片全部不會渲染**（未登入不受影響）。已經記在 CLAUDE.md。這不是 Mapping 這次改動造成的，過去測 Profile 頁時沒有踩到是因為那些測試沒有在已登入狀態瀏覽這幾頁。
  - 因為這個限制，`CourseTags` 的藍色高亮和 `RecommendedList` 裡 `CourseCard` 本體，沒辦法在瀏覽器裡用視覺方式驗證。改用讀取 React Query cache（真實 profile 資料、真實 `recommendCourses` 輸出）的方式驗證：畫面上有實際渲染出「Matches: Systems Programming, C / C++, Operating Systems」這類真實的推薦理由，分頁正確顯示 5 頁（對應 `recommendCourses` 預設上限 50 筆），切換「Match my goals」也確認沒有另外打 `/courses/search`。
  - `skillsForCourse`/`careersForCourse` 對 15-213 的輸出，有在未登入狀態下用真實 DOM 驗證過（技能：C / C++、Systems Programming、Computer Architecture；職涯：Software Engineering、Systems & Infrastructure、Hardware & Embedded Systems），和預期完全一致，此時的 pill 也全部是灰色（未登入沒有 profile 目標）。

