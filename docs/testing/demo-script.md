# Demo 錄影腳本：Alex 的一學期

> 用途：錄一支約 9 分鐘、一鏡到底的影片，展示這個 fork 新增的所有功能。以 **Alex（帳號 A）** 為主角；**Jordan（帳號 B）** 的視窗全程開著，只在 Circles 那段切過去。Profile 的設定過程不拍（已事先設好，資料見附錄 1、2）。
>
> 網頁上的按鈕與欄位一律照英文原文寫，方便對照畫面。每一步的格式是：**點哪裡 → 畫面會出現什麼 → 旁白**。
>
> 下面的分數、進度、推薦課程，是用專案的 `packages/profile` 程式碼對 Alex 的資料實際算出來的（課程時段取自 2026-09 的目錄）。如果目錄更新造成分數略有差異，以畫面為準；旁白沒有依賴精確的分數。

---

## A. 錄影前準備（不入鏡）

1. **重建搜尋索引（只需做一次）**：在 repo 根目錄先跑 `bun run catalog-sync`（dry run，只印出會做什麼），確認後跑 `bun run catalog-sync -- --yes`。做完後課號（如 `36-613`）才搜得到，而且完全符合的課號會排第一。
2. 從 repo 根目錄 `bun run dev`，確認：
   - `http://localhost:3000/courses/search` 的 `totalDocs` 約 8,400。
   - 首頁搜尋 `36-613`，第一張卡就是 **36-613 Data Visualization**。
3. **視窗**：
   - Chrome 設定檔 1 登入 **Alex (Demo A)**，Chrome 設定檔 2 登入 **Jordan (Demo B)**。
   - 兩邊都縮放 125%；關閉 DevTools 與書籤列。
   - **不要在同一個視窗切換帳號**：換帳號會清空排課器的本地課表，Saved 收藏又是同一個瀏覽器共用的。
4. **Alex 的起始狀態**：
   - Profile 照附錄 1（包含 95-891 Taken），頁首是 `8 of 8 sections complete.`。
   - **Saved 只有 `10-601`**。Saved 現在存在帳號裡：要在**登入 Alex 的狀態下**加入 `10-601`；以前存在瀏覽器裡的收藏不會帶過來。
   - 首頁按 **Reset**；**Match my goals** 不勾；若有預設篩選就按 **Clear default**。
   - Schedules 左欄的本地課表全部刪除；**My saved schedules** 清空；Circles 沒有任何貼文。
   - Profile → Time & format → **Show what each busy time is for on Circles** = **Private**。
   - Academic background、Career goals 的可見度 = **Public**（讓 Jordan 在 People 看得到 Alex）。
5. **Jordan 的起始狀態**：
   - Profile 照附錄 2（Academic、Career goals、Skills、Courses 都是 Public）。
   - Schedules 本地課表、My saved schedules、Circles 貼文都是空的。
6. **兩人互不追蹤**：若測試時已經是 Connected，兩邊各到 Circles → People → 對方卡片的 **Connected** → 行內確認 **Unfollow**。
7. 幾個已知情況，不影響錄影：
   - 測試時的舊私訊無法從 UI 刪除，會留在對話紀錄裡。
   - Profile 有未存的修改時點左側導覽，頂端會問 Save and leave / Leave without saving / Stay；錄影時先確認 Profile 沒有未存的修改。
   - 若 95-796 測試時已評過分，先到 `/course/95-796` 按 **Delete my rating** 刪掉，錄影時才是第一次送出。
8. 兩個視窗都先停在首頁（Search）。

---

## B. 場景

### 場景 0｜開場（0:00–0:20）｜Alex 視窗，首頁

1. 滑鼠依序滑過左側 **Schedules、Careers、Requirements、Circles、Profile** → 每一項的文字和圖示變**紅色**；滑過 Search、Saved 等其他項目則是藍色。
2. 旁白：「紅色的是我們這次新增或大改的功能。今天用 Alex 的一學期，一次走完。」
   - EN: "Everything that turns red is what we built. Let's walk through one student's semester."

### 場景 1｜Profile 總覽（0:20–1:00）

1. 點左側 **Profile** → 頁首 `8 of 8 sections complete.`。
2. 捲到 **Career goals**：Data Science & Analytics（標 **Primary**）、Product Management、Software Engineering。
3. 捲到 **Time & format**，指三筆忙碌時間：
   - Monday 09:00–11:00 `TA shift`
   - Wednesday 14:00–16:00 `Part-time job`
   - Friday 09:00–12:00 `Research lab`
4. 指任一卡片右上角的 **Private / Public**。
5. 只說明、不修改。旁白：「Profile 只要填一次，搜尋、職涯、學位需求、排課、社群都讀它。每一區可以自己決定公開或私人。」

### 場景 2｜Search 與 Saved（1:00–2:45）

1. 點左側 **Search**，搜尋框輸入 `36-613`：
   - 第一張卡是 **36-613 Data Visualization**，右側紅色徽章 **Conflicts with TA shift**。
   - 旁白：「它只有週一早上的班，剛好撞 Alex 當助教。」
   - 按卡片右上 `+` → **Saved**（星號變黃）。先收藏，等一下排課會看到系統自動排除它。
2. 搜尋 `17-619`：
   - **17-619 Product Management Essentials I**，綠色 **Fits your availability**。
   - 藍色 pill：技能 **Product Strategy**、職涯 **Product Management**。旁白：「藍色代表跟 Alex 的目標有關。」
   - `+` → **Saved**。
3. 搜尋 `95-819`：
   - **95-819 A/B Testing, Design and Analysis**，綠色徽章；**Data Visualization** 技能 pill 是藍色。
   - `+` → **Saved**。
4. 按搜尋框右邊的 `×` 清空 → 左側勾 **Match my goals**：
   - 顯示 `50 results`；第 1 頁從 **15-388、10-301、10-601、19-351、19-433** 開始。
   - 旁白：「這是所有對 Alex 目標有幫助的課，最相關的排前面；已修過的課不會出現。」
5. 再勾 **Only courses that fit my availability** → 結果數變少，搜尋框下方出現 `Fits my availability` pill。旁白：「撞時間的也拿掉了。」
6. 按左側最上方 **Save as default** → 按鈕變 `Saved as default`。旁白：「下次打開就自動套用。」
7. 點左側 **Saved** → 4 張卡：**10-601、36-613、17-619、95-819**。

### 場景 3｜課程頁與評分（2:45–3:45）

1. 回 **Search** → 按下方 pill 列右側的 **Reset** → 搜尋 `95-891` → 點課名 **Introduction to Artificial Intelligence**：
   - 技能 pill **Machine Learning**（藍）；職涯 pill **Software Engineering**、**Data Science & Analytics**（藍）。
   - 往下捲：**Schedules** 卡（各學期的班別與時間）與先修關係圖。
2. 網址列改成 `localhost:3010/course/95-702`：
   - **Ratings** 卡顯示 `Mark this course as Taken on your profile to rate it.`
   - 旁白：「修課中還不能評，只有修完的課能評。」
3. 網址列改成 `localhost:3010/course/95-796`（Statistics for IT Managers，Alex 已修完），在 **Ratings** 卡填入：

   | 欄位 | 值 |
   |---|---|
   | 星等 | 4 |
   | Workload | 3 |
   | Grading fairness | 4 |
   | Transparency | 5 |
   | Share your experience | `Clear lectures; weekly problem sets are manageable.` |
   | What do you wish you knew… | `Brush up on Excel pivot tables first.` |

   然後按 **Submit rating**。
4. 卡片標題旁出現 `4.0 (1 rating)`，以及 Workload `3.0 / 5 (1)`、Grading fairness `4.0 / 5 (1)`、Transparency `5.0 / 5 (1)`，下方列出留言與「What students wish they knew」。
5. 旁白：「評分是匿名的，其他同學只看得到內容；自己的評分可以隨時更新，或按 **Delete my rating** 刪掉。」

### 場景 4｜Careers（3:45–4:35）

1. 點左側 **Careers** → **Your progress** 三張卡：

   | 職涯 | 進度 | Covered | Still missing（推薦課） |
   |---|---|---|---|
   | Data Science & Analytics | **1 / 3** | Machine Learning | Statistics（10-301、10-315、10-601）；Data Visualization（05-319、05-619、11-604） |
   | Product Management | **0 / 2** | — | Product Strategy（04-617、15-390、17-619）；User Research（05-410、05-610、05-833） |
   | Software Engineering | **1 / 4** | Data Structures & Algorithms | Systems Programming（15-213、15-410、15-411）；Databases（15-415、15-445、15-645）；Web Development（17-437、17-637） |

2. 旁白：「Alex 修過 95-891，系統自動把 Machine Learning 算進去，不用自己再填一次；每個缺口直接列出能補的課。」
3. 點 **10-301** 看一眼 → 按瀏覽器「上一頁」回來。**不要**加到 Saved，否則後面 Generate 的結果會不同。
4. 捲到最下面 **Alternative academic paths**：
   - Path 1：10-301、05-319、04-617、05-410、15-213、15-415、17-437
   - Path 2：10-315、05-619、15-390、05-610、15-410、15-445、17-637
   - Path 3：10-601、11-604、17-619、05-833、15-411、15-645
5. 旁白：「三種不同的修課組合，都能補齊同樣的缺口。」

### 場景 5｜Requirements（4:35–5:20）

1. 點左側 **Requirements** → **Core requirements** 進度條 `36 / 108 core units`。
2. 指各列的狀態顏色：

   | 狀態 | 課號 |
   |---|---|
   | Taken（綠） | 94-700、95-710、95-719、95-796、95-896 |
   | In progress（黃） | 95-702、95-703 |
   | Planned（藍） | 94-739、95-843、95-877、95-706 |
   | Not yet（灰） | 95-760；95-867（旁邊標 `(not in the course catalog)`） |

3. **Electives** `18 / 54 elective units`，下方列出 95-891 (12)、90-812 (6)。
4. **Elective suggestions toward your goals**：15-388、10-301、10-601、19-351、19-433。
5. 旁白：「畢業還差什麼、哪些選修同時對職涯有幫助，一頁看完。95-867 在手冊上有、目錄裡找不到，我們照實標出來。」

### 場景 6｜Schedules 自動排課（5:20–7:20）

1. 點左側 **Schedules** → 按 **Schedules** 標題旁的 `⊕` → 右上方課表名稱改成 `Alex Fall 2026`。
2. 在 **Add a Course by Course ID/Name** 依序加入：
   - 輸入 `95702`（示範不用打橫線）→ Enter
   - `95-703` → Enter
   - `95-760` → Enter
3. 左欄 **Schedule Calendar** → **Semester** 選 **Fall 2026**。
4. 左欄 **Generate**：Units 已自動帶入 `36 to 48`（來自 Profile）→ 按 **Generate Schedules**：

   | 方案 | 分數 | 班別 |
   |---|---|---|
   | Option 1 | 66 / 100 | 95-702 — C、95-760 — B1、95-703 — B |
   | Option 2 | 66 / 100 | 95-702 — C、95-760 — B1、95-703 — D |
   | Option 3 | 65 / 100 | 95-702 — C、95-760 — B1、95-703 — A |

   - 旁白：「三個方案都讓 95-702 用 C 班（週二四下午），因為 A、B 班都撞 Alex 週三的打工。Option 3 比較低，是因為 95-703 A 班 9:30 開始，比 Alex 偏好的 10:00 早。三個都只有 30 學分，所以 Workload 顯示 under。」
5. 示範鎖定與排除：
   - 在 **Option 2** 按 `95-703 — D` 旁的鎖頭（Keep this pick）。
   - 在 **Option 1** 按 `95-702 — C` 旁的禁止符號（Never pick this option）。
   - 每按一次都會**自動重排**，不用按 Regenerate。上方出現藍色 `Keep 95-703 D`、紅色 `Never 95-702 C` 兩顆 pill；方案都變成 `Time conflict: 95-702`，約 55 分，分數徽章變紅色。
   - 旁白：「把唯一不撞的班排除掉，系統會照實標出衝突，不會偷偷把課丟掉。」
   - 按兩顆 pill 的 `×` 清掉，方案自動回到原本的結果。
   - （可選）指分數條後面的 `· 35%`、`· 25%` 等：「總分是這四項依權重加總。」
6. 勾 **Also consider my Saved courses (4)** → 按 **Generate Schedules** → **Option 1** 約 93 分：
   - 班別：95-702 — C、95-760 — B1、95-703 — B、**95-819 — A2**、**17-619 — A1**
   - `Workload — 42 units (in range)`；Career/skill fit 75
   - 理由包含 `Added 17-619 from your pool`、`Added 95-819 from your pool`、`Not added from your pool: 10-601, 36-613`
   - 旁白：「系統從收藏裡挑了兩門對目標有幫助、又不撞時間的課，把學分補到範圍內；10-601 和 36-613 撞時間，自動不選。」
7. 按 Option 1 的 **Use this schedule** → 按鈕變 **In use**，上方出現 `Using Option 1 from Generate · 93/100`，右側**自動切到週曆**，顯示 5 門課。
8. 左欄往下，Generate 下方的 **My saved schedules** → 名稱欄留空 → **Save** → 清單出現 `Alex Fall 2026`。旁白：「存到帳號，換電腦也在，也才能分享到 Circles。」
9. 左欄上方課表區按 **Export .ics** → 右下角 `Exported calendar.`。旁白：「可以直接匯入 Google Calendar。」

### 場景 7｜Scotty Circles（7:20–9:30）

**7-1 Alex 發文**
1. 點左側 **Circles** → Feed 顯示 `No schedules shared yet. Be the first!`。
2. 右側 **Share a schedule** 下拉選 `Alex Fall 2026 (Fall 2026)` → **Share**。
3. 貼文出現在 Feed：Mon–Fri 週曆、Alex 的忙碌時段（**沒有標籤**）、5 門課與班別、`42 units total`。
4. 旁白：「分享的是存在帳號裡的課表；忙碌時段會顯示，但『在忙什麼』預設隱藏。」

**7-2 切到 Jordan 視窗：Jordan 發文**
1. 點 **Schedules** → `⊕` → 名稱改成 `Jordan Fall 2026`。
2. 加入 `95-703`、`95-760`、`95-891` → **Semester** 選 **Fall 2026**。
3. 在 Schedule Calendar 手動選班：
   - 95-703 **D**（TR 11:00–12:20）
   - 95-760 **B1**（TR 2:00–3:20 + F 2:00–3:20）
   - 95-891 **B**（TR 9:30–10:50 + F 3:30–4:50）
   - **不要選 95-891 A**：它和 95-760 B1 同一個時段。
4. **My saved schedules** → **Save** → 點 **Circles** → **Share a schedule** 選 `Jordan Fall 2026 (Fall 2026)` → **Share**。

**7-3 Jordan 對 Alex 的貼文互動**
1. Jordan 的 Feed 看到兩則貼文。Alex 的貼文按讚處顯示 `Follow Alex (Demo A) to react`。
2. 在 Alex 貼文標頭按 **Follow** → 變成 **Following** → 按 🔥。
3. 打開留言 → 輸入 `We're both in 95-703! Which section are you in?` → Enter。

**7-4 回到 Alex 視窗**
1. Feed 上方最多 30 秒內出現 **New posts** 按鈕 → 按下去（或直接重新整理）：Feed 最上方是 Jordan 的貼文；Alex 自己的貼文有 🔥 1 和 Jordan 的留言。
2. 打開自己貼文的留言區：沒有輸入框，顯示 `You can reply to comments on others' posts.`。旁白：「自己的貼文不能按讚或留言，但可以刪掉別人的留言。」
3. 切到 **People** 分頁 → 勾 **Study partners in my courses** → Jordan 的卡片：
   - 名字旁 `Follows you`
   - Courses you share：**95-703**
4. 按 **Follow back** → 變成 **Connected**，出現 **Message** 按鈕。旁白：「互相追蹤才能私訊。」
5. 切回 **Feed** → 在 Jordan 的貼文按 📚 → 留言 `Section B, MW 11. Want to study together?` → Enter。

**7-5 私訊**
1. **People** → Jordan 卡片按 **Message** → 輸入 `Hi Jordan! Want to pair on 95-703 homework?` → Enter。
2. 切到 **Jordan 視窗**：Circles 分頁標籤在約 15 秒內變成 `Messages (1)` → 點進去打開與 Alex 的對話 → 回覆 `Sure! Thursday after class?` → Enter。
3. 切回 **Alex 視窗**：5 秒內看到回覆。

**7-6 公開忙碌時段的用途（同時展示單一儲存）**
1. Alex → **Profile** → **Time & format** → **Show what each busy time is for on Circles** 改成 **Public**。
2. 頁面最上方出現儲存列 `Unsaved changes: Time & format` → 按 **Save all**。
3. 旁白：「Profile 所有修改都在最上方一次儲存；按 Discard 可以全部還原。」
4. 回 **Circles**：Alex 貼文上的忙碌時段顯示 `TA shift`、`Part-time job`、`Research lab`。

### 場景 8｜收尾（9:30–9:50）

旁白：「回去只要三步：一，登入把 Profile 填好；二，用 Match my goals 和 fit my availability 找課；三，到 Schedules 按 Generate，存起來分享給同學。」
- EN: "Fill in your profile once, search with 'Match my goals' and 'fits my availability', then generate, save and share your schedule."

---

## C. 錄完後復原（下次重錄用）

- **Alex**：
  - 首頁 **Clear default**。
  - Saved 恢復成只有 `10-601`。
  - Circles → **Your posts** → **Delete**（行內確認）。
  - Schedules：刪除 My saved schedules 那一筆，以及左欄的本地課表。
  - Profile → busy label 改回 **Private** → **Save all**。
- **Jordan**：刪除 Circles 貼文與 My saved schedules。
- **兩人**：互相 **Unfollow**。
- Alex：到 `/course/95-796` 按 **Delete my rating** 刪掉評分，重錄時就能再示範第一次送出。
- 私訊無法用 UI 刪除，會留在對話紀錄裡。

---

## D. 附錄

### 附錄 1：Alex 的 Profile（已設定）

| 區塊 | 值 |
|---|---|
| Public info | Display name `Alex (Demo A)`；Bio `MISM '27. Into data products and PM. Looking for 95-703 study partners.` |
| Academic background | Master's / Heinz College of Information Systems and Public Policy / Master of Information Systems Management (MISM) / Spring 2027；**Public** |
| Career goals | 1. Data Science & Analytics 2. Product Management 3. Software Engineering；**Public** |
| Skills | Have：Python、SQL；Want：Machine Learning、Data Visualization、Product Strategy |
| Course load | 36 to 48 units；50 hours per week |
| Time & format | In person；忙碌時間見場景 1；Prefer classes between 10:00 and 18:00；Preferred days Mon、Tue、Wed、Thu；busy label **Private** |
| Courses | Taken：94-700、95-710、95-719、95-896、95-796、90-812、95-891；In progress：95-702、95-703 |
| Future course plan | Fall 2026：17-619；Spring 2027：95-877、94-739、95-706、95-843 |

### 附錄 2：Jordan 的 Profile（已設定）

| 區塊 | 值 |
|---|---|
| Public info | Display name `Jordan (Demo B)`；Bio `MISM '27, ML track.` |
| Academic background | Master's / Heinz College… / MISM / Spring 2027；**Public** |
| Career goals | 1. Machine Learning / AI 2. Data Science & Analytics；**Public** |
| Skills | Have：Python、Statistics；**Public** |
| Courses | 95-703 In progress、95-760 In progress、95-796 Taken；**Public** |
| Time & format | Tuesday 18:00–20:00 `Gym` |

### 附錄 3：會用到的 Fall 2026 班別

| 課號 | 課名 | Units | 班別（時間） |
|---|---|---|---|
| 95-702 | Distributed Systems for ISM | 12 | A：MW 2:00–3:20PM；B：MW 3:30–4:50PM；C：TR 3:30–4:50PM |
| 95-703 | Database Management | 12 | A：TR 9:30–10:50AM；B：MW 11:00AM–12:20PM；C：MW 9:30–10:50AM；D：TR 11:00AM–12:20PM；E：TR 2:00–3:20PM；F：MW 2:00–3:20PM |
| 95-760 | Decision Making Under Uncertainty | 6 | A1：TR 9:30–10:50AM + F 2:00–3:20PM；B1：TR 2:00–3:20PM + F 2:00–3:20PM；C2：TR 11:00AM–12:20PM + F 11:00AM–12:20PM |
| 95-819 | A/B Testing, Design and Analysis | 6 | A2：T 6:30–9:20PM；B2：MW 9:30–10:50AM；C2：W 6:30–9:20PM |
| 17-619 | Product Management Essentials I | 6 | A1/D1：TR 11:00AM–12:20PM；B1/F1：TR 2:00–3:20PM；C1/E1：TR 3:30–4:50PM；K1：TR 5:00–6:20PM |
| 36-613 | Data Visualization | 6 | A1：MW 9:30–10:50AM（撞週一 TA shift） |
| 10-601 | Introduction to Machine Learning | 12 | A：MWF 9:30–10:50AM；B：MWF 11:00AM–12:20PM（兩班都撞） |
| 95-891 | Introduction to Artificial Intelligence | 12 | A：TR 2:00–3:20PM + F 2:00–3:20PM；B：TR 9:30–10:50AM + F 3:30–4:50PM；C：TR 5:00–6:20PM + F 3:30–4:50PM |

### 附錄 4：現場出狀況時

| 症狀 | 處理 |
|---|---|
| Profile 轉很久後顯示 `We couldn't load your profile.` | Atlas 連線被擋：到 Atlas → Network Access 加入目前 IP；在校園 Wi-Fi（常擋 27017）改用手機熱點 |
| 登入後 Profile / Circles 都 401 | `.env` 裡 `REQUIRE_CMU_EMAIL=true`，兩個帳號都必須是 CMU 信箱 |
| 課程卡沒有 FCE、hrs/week | 本地環境的已知限制（拿不到 FCE 資料），不影響展示 |
| 搜尋課號找不到課 | 重做「錄影前準備」第 1 步的 `catalog-sync` |
| 私訊沒有馬上出現 | 輪詢間隔：對話清單 15 秒、開著的對話 5 秒；分頁在背景時會暫停，切回來等幾秒 |
