# Roadmap

團隊目前的 feature 規劃，來源為 Mural feature decomposition board。

## Vision

Course directory navigator：幫助學生根據自己的 profile 排出最合適的課表。

## V1

### Class Selection Filter — 已完成（透過 clone ScottyLabs 現有網站達成）

- Department dropdown
- Course Level dropdown（undergrad/grad）
- Unit slider（0-24）
- Offered in（mini/semester）dropdown
- 限定早上/下午/晚上時段
- 尚未在 Scotty 分類中的 modality 篩選（實體/線上），會覆蓋 profile 預設值
- 依儲存的 availability 排序或標示最適合的結果

### Student Profile & Persistent Memory — 進行中

> 實作於 branch `feature/student-profile`，設計見 `docs/superpowers/specs/2026-09-11-student-profile-design.md`。帳號沿用 Clerk 登入，不另建帳號系統；除下列項目外，另加入職涯方向、學術背景、技能、修課負擔、區塊公開/私人設定與首次登入引導。尚待：正式資料庫（Atlas）、職涯/技能/主修清單審核、（可選）預設篩選首頁。

- 建立帳號（email/andrew ID，需確認跟現有 Clerk 登入的關係）
- 設定預設 modality 偏好
- 設定每週固定忙碌時段
- 任何時間可編輯 availability
- 任何時間可編輯 profile/preferences
- 偏好設定跨 session 保留
- 記錄已修/在修課程
- （可選）存預設篩選當首頁

### Career Path/Skills Flagging — 尚未開始

- 課程對應職涯路徑
- 依職涯目標推薦選修課
- 依所選領域顯示對應技能子區塊
- 課程對應到哪些能力

### Schedule Builder — 尚未開始

- 依篩選 + profile + career tag 產生 1-3 個候選課表
- 排除跟已存 availability 衝突的時段
- reconcile 每門課各自的 modality override
- 存檔/匯出選定課表
- （可選）使用者不滿意時重新產生候選

## V2

### Course & Professor Reviews

- 課程評分（1-5 星）+ 留言
- 教授評分（1-5 星）+ 留言
- 資料來源：優先嘗試 ScottyLabs course-api 的 CSV-based FCE parser，不行則用 dummy data
- 顯示 workload、給分公平性/透明度等統計

## 目前不在範圍內

### CMU Circles

- 排課分享、社交連結、互動功能（follow、schedule reactions 等）
