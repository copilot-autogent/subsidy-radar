# Steps Data Verification Report

**Initial audit:** 2026-06-14 (Issue #15, PR #26 — 15/21 subsidies)  
**Follow-up audit:** 2026-06-18 (Issue #28 — remaining 6 unverified + 4 new subsidies from PR #30)  
**Method:** `verify_deploy` HTTP checks, `web_fetch` content inspection, `web_search` cross-reference against official gov.tw pages  
**Issue:** #15, #28

---

## Summary

All 21 original subsidies were audited for:
- `applicationUrl` reachability
- Step accuracy against official government pages

The 4 subsidies added in PR #30 (labor-child-education-grant, indigenous-student-scholarship, low-income-elderly-allowance, expanded-rent-subsidy) have been audited in the 2026-06-18 follow-up pass.

**Bugs fixed in initial pass (PR #26):**
| Subsidy ID | Issue | Fix Applied |
|---|---|---|
| `unemployment-benefit` | `applicationUrl` returned 404 | Updated to `https://www.bli.gov.tw/0006445.html` |
| `unemployment-benefit` | Step 1 said "14 天內" (incorrect deadline) | Corrected to 2-year statutory deadline |
| `parental-leave-allowance` | `applicationUrl` returned 404 (same broken URL) | Updated to `https://www.bli.gov.tw/0015003.html` |
| `parental-leave-allowance` | Step 2 omitted 2026 batch-application option | Updated to mention employer batch-apply (effective 2026-03-30) |
| `youth-startup-fund` | `applicationUrl` domain (`sba.gov.tw`) not found | Updated to `https://startup.sme.gov.tw/home/modules/funding/detail/index.php?sId=15` |
| `youth-startup-fund` | Agency name outdated (中小企業處 renamed 2023) | Updated to `經濟部中小及新創企業署` |

**Bugs fixed in follow-up pass (Issue #28):**
| Subsidy ID | Issue | Fix Applied |
|---|---|---|
| `youth-home-loan` | `eligibility` and `steps[0]` listed "年齡45歲以下" and "家庭年收入120萬以下" which are wrong for 新青安精進方案 | Removed age cap and income limit; updated to reflect current 新青安 1.0 criteria (official source: ey.gov.tw) |
| `youth-home-loan` | `deadlineStatus: "ongoing"` with no deadline; program expires 2026-07-31 | Changed to `deadlineStatus: "open"` + `deadlineDate: "2026-07-31"` |
| `home-renovation-loan-subsidy` | `deadlineDate: "2025-09-30"` + `deadlineStatus: "closed"` was stale (114年 window expired) | Changed to `deadlineStatus: "periodic"` (no deadlineDate until 115年 window is officially announced) |

---

## Per-Subsidy Verification Status

### ✅ youth-job-support
- **URL verified:** `https://special.taiwanjobs.gov.tw/internet/2025/YNGSRH/index.html` — live
- **Steps:** Consistent with 台灣就業通 registration flow
- **Deadline:** 115年（2026年）全年常態受理 — confirmed active

### ✅ youth-vocational-training
- **URL verified:** `https://kys.wda.gov.tw/News_Content.aspx?n=70&s=2548` — live, shows 2025 training subsidies guide
- **Steps:** Consistent with wda.gov.tw content (查詢課程→報名→出席→申請補助)
- **Age range confirmed:** 15–29 歲

### ✅ micro-phoenix-loan
- **URL verified:** `https://beboss.wda.gov.tw/Default.aspx` — live
- **Steps:** Verified — official site confirms 3-step flow (諮詢→課程→申請) with 進階班 = 18 hours
- **Loan amount confirmed:** 最高 200 萬元（小規模商業最高 50 萬元）

### ✅ rent-subsidy
- **URL verified:** `https://has.nlma.gov.tw/house300e/` — live
- **Steps:** Consistent with 內政部國土管理署 platform flow
- **Deadline:** 115年1月1日–12月31日 — confirmed by gov.tw announcement

### ✅ youth-home-loan *(fixed — 2026-06-18)*
- **URL verified:** `https://www.nta.gov.tw/htmlList/71` — HTTP 200 ✅ (NTA application landing page is live)
- **NTA program status confirmed active:** 新青安貸款精進方案 runs until **115年7月31日（2026-07-31）**. Sources: (1) EY policy page ey.gov.tw — "實施至115年7月31日"; (2) yda.gov.tw — "展延至115年7月31日止". The NTA URL (`nta.gov.tw/htmlList/71`) is the correct user-facing application entry point for the 財政部版 program.
- **Eligibility criteria corrected:** Previous `eligibility[]` and `steps[0]` listed "年齡45歲以下" and "家庭年收入120萬以下" — these are conditions from the original pre-2023 program. The 新青安精進方案 (effective 2023-08) has NO age cap and NO income limit. Confirmed from official sources: (1) EY policy page (ey.gov.tw) states "年滿18歲的成人...均可申請" with no income condition; (2) NTA FAQ page (nta.gov.tw/singlehtml/109) makes no reference to age cap or income limit in the 精進方案. Fixed to reflect 新青安 1.0 criteria.
- **Deadline updated:** Added `deadlineDate: "2026-07-31"` and `deadlineStatus: "open"` to reflect program expiry. `deadline` text references official application channel only (2.0 succession speculation removed from user-facing field).

### ✅ interest-subsidy
- **URL verified:** `https://has.nlma.gov.tw/subsidyOnline/` — live
- **Steps:** Consistent with the annual September application window
- **Deadline:** 114年9月1–30日 observed on site; 115年應循相同時程（以官網公告為準）

### ✅ parenting-home-loan
- **URL verified:** `https://www.nlma.gov.tw/` — live (國土管理署主站)
- **Steps:** Consistent with lending flow for families with children under 18

### ✅ social-housing
- **URL verified:** `https://www.socialhousing.tw/Portal/BuildingApplyLanding` — live
- **Steps:** Consistent with 國家住宅及都市更新中心 portal

### ✅ student-loan-interest-relief
- **URL verified:** `https://heloan.boe.moe.edu.tw/` — live (教育部貸款系統)
- **Steps:** Consistent with annual review cycle

### ✅ unemployment-benefit *(fixed)*
- **URL:** was `https://www.bli.gov.tw/0010097.html` (404) → fixed to `https://www.bli.gov.tw/0006445.html`
- **Step 1 corrected:** Official BLI page (`/0005072.html`, last updated 2025-12-31) states application window is **2 years** after separation, not 14 days. The 14-day figure refers to the agency's job-matching period before unemployment is confirmed.

### ✅ childcare-allowance
- **URL verified:** `https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=383` — domain live
- **Steps:** Consistent with 準公共化托育 application flow

### ✅ youth-startup-fund *(fixed)*
- **URL:** was `https://www.sba.gov.tw/` (domain not found) → fixed to `https://startup.sme.gov.tw/home/modules/funding/detail/index.php?sId=15`
- **Agency:** `經濟部中小企業處` → `經濟部中小及新創企業署` (renamed 2023)
- **Steps:** Confirmed against 新創圓夢網 funding portal; 8-hour training requirement verified

### ✅ parental-leave-allowance *(fixed)*
- **URL:** was `https://www.bli.gov.tw/0010097.html` (404) → fixed to `https://www.bli.gov.tw/0015003.html`
- **Step 2 updated:** BLI site (`/0015728.html`) confirms both personal online and employer batch-apply (批次申辦, effective 2026-03-30)
- **Max duration confirmed:** 每一子女最長6個月，夫妻可分別請領

### ✅ birth-subsidy
- **URL verified:** `https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=357` — domain live
- **Steps:** Consistent with 戶政 registration → 同步申請 flow

### ✅ vocational-training-living-allowance
- **URL verified:** `https://www.wda.gov.tw/News_Content.aspx?n=3C4C351ECDA27CA0&s=1E3B11CF1C70A3EC` — live
- **Steps:** Consistent with 就業服務站 認定 → 津貼流程

### ✅ disability-living-allowance
- **URL verified:** `https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=341` — domain live
- **Steps:** Consistent with 公所社政課 window service

### ✅ home-renovation-loan-subsidy *(updated — 2026-06-18)*
- **URL verified:** `https://pip.moi.gov.tw/v3/b/SCRB0108.aspx` — accessible (內政部不動產資訊平台)
- **Steps:** Steps reference annual September application window; consistent with 整合住宅補貼資源實施方案 cycle (114年9月1–30日 observed)
- **Deadline updated:** Previous `deadlineDate: "2025-09-30"` with `deadlineStatus: "closed"` was stale (114年 window expired). Updated to `deadlineStatus: "periodic"` with no `deadlineDate` (115年 dates not yet officially announced; speculative date removed to avoid misleading the deadline UI).
- **Note:** URL resolves to housing info portal; users should navigate to 住宅補貼 → 整合住宅補貼資源實施方案 section

### ✅ self-use-housing-tax-reduction
- **URL verified:** `https://www.etax.nat.gov.tw/etwmain/front/ETW158W1` — live (財政部電子申報繳稅服務網)
- **Steps:** Confirmed key dates: 地價稅 9月22日截止申請; 房屋稅 設籍後可申請

### ✅ sbir-sme-innovation *(re-verified 2026-06-18)*
- **URL:** `https://www.sbir.org.tw/` — HTTP check fails from verification server (WAF/CDN protection). **Authority-delegation verification accepted**: `sme.gov.tw/article-tw-2895-13878` (HTTP 200 ✅, official 中小及新創企業署 page updated 2025-12-29) explicitly lists `sbir.org.tw` as the program link — this is the government's own published authoritative pointer to the application site. Web search also shows live 2026-05-15 content on sbir.org.tw from public-client crawlers. The URL in the data is the only official application platform; WAF-restricted environments can use `https://www.sme.gov.tw/article-tw-2895-13878` as a reachable entry point.
- **Steps:** Confirmed accurate against sme.gov.tw SBIR programme page and MOEA application guidance ("隨到隨受理" rolling basis).
- **Deadline:** `deadlineStatus: "open"` ✅ — rolling basis.

### ✅ siir-service-innovation
- **URL verified:** `https://gcis.nat.gov.tw/neo-s/` — live (商業發展署 SIIR)
- **Steps:** Consistent with online application → 簡報審查 → 補助合約 flow

### ✅ nstc-research-startup
- **URL verified:** `https://www.nstc.gov.tw` — live (國科會)
- **Steps:** Consistent with institution-based application process

---

## New Subsidies Verified (PR #30, audited 2026-06-18)

### ✅ labor-child-education-grant *(new — verified 2026-06-18)*
- **URL verified:** `https://www.mol.gov.tw/topic/3075/6074/` — HTTP 200 ✅
- **Content confirmed:** MOL page updated 2026-02-03 confirms 114學年度第2學期 deadline 115年3月22日; 115年2月3日 onwards accepted online via uwes.mol.gov.tw
- **Steps:** Accurate. Step 3 references `uwes.mol.gov.tw` which is live (HTTP 200 ✅). Application windows (每年2月 and 9月) are consistent with academic semester calendar.
- **Deadline:** `deadlineStatus: "seasonal"` ✅ — two windows per year (February semester 2, September semester 1).

### ✅ indigenous-student-scholarship *(new — verified 2026-06-18)*
- **URL verified:** `https://cipgrant.fju.edu.tw/` — HTTP 200 ✅
- **Steps:** Consistent with the 原住民族委員會 scholarship application process via cipgrant.fju.edu.tw.
- **Deadline:** `deadlineStatus: "seasonal"` ✅ — per-semester applications.

### ✅ low-income-elderly-allowance *(new — verified 2026-06-18)*
- **URL verified:** `https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=386` — HTTP 200 ✅
- **Steps:** Accurate — public-office window application with annual review to maintain eligibility.
- **Deadline:** `deadlineStatus: "ongoing"` ✅ — rolling applications accepted at local district office year-round.

### ✅ expanded-rent-subsidy *(new — verified 2026-06-18)*
- **URL verified:** `https://www.nlma.gov.tw/ch/titlelist/news/15999` — HTTP 200 ✅
- **Steps:** Accurate — consistent with 國土管理署 expanded rent subsidy (擴大租金補貼) flow; "115年全年受理" confirmed.
- **Deadline:** `deadlineStatus: "open"` ✅

---

## Next Review Recommended

- **youth-home-loan**: 新青安 2.0 announcement expected ~June/August 2026 — re-verify eligibility and update data when official 2.0 notice is published (draft proposal in circulation as of 2026-06, details not yet enacted).
- **interest-subsidy**: Confirm 115年 September application window opens as expected
- **home-renovation-loan-subsidy**: Stale deadline fixed in this pass (`periodic`, no date). Confirm 115年 September window official dates when announced and add `deadlineDate` then.
