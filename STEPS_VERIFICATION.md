# Steps Data Verification Log

This document tracks the verification status of application steps for each subsidy against official government sources.

## Verification Status Legend
- ✅ **Verified** - Steps confirmed against official source within last 3 months
- 🔄 **Needs Review** - Steps authored from general knowledge, awaiting verification
- ⚠️ **Outdated** - Official process has changed, steps need update
- ❌ **Broken** - Application URL returns 404 or process discontinued

## Last Updated: 2026-06-09

| Subsidy ID | Status | Last Verified | Source URL | Notes |
|------------|--------|---------------|------------|-------|
| youth-job-support | 🔄 | Never | https://special.taiwanjobs.gov.tw/internet/2025/YNGSRH/index.html | Steps authored from general knowledge. Needs manual verification against current Taiwan Jobs site. |
| youth-vocational-training | 🔄 | Never | https://kys.wda.gov.tw/News_Content.aspx?n=70&s=2548 | Steps authored from general knowledge. Needs verification. |
| micro-phoenix-loan | 🔄 | Never | https://beboss.wda.gov.tw/Default.aspx | Steps authored from general knowledge. Verify 18-hour course requirement. |
| rent-subsidy | 🔄 | Never | https://has.nlma.gov.tw/house300e/ | Steps authored from general knowledge. Verify 115年 application flow. |
| youth-home-loan | 🔄 | Never | https://www.nta.gov.tw/htmlList/71 | Steps authored from general knowledge. Tax relief process may vary by bank. |
| interest-subsidy | 🔄 | Never | https://has.nlma.gov.tw/subsidyOnline/ | Steps authored from general knowledge. Verify September deadline window. |
| parenting-home-loan | 🔄 | Never | https://www.nlma.gov.tw/ | Steps authored from general knowledge. Eligibility criteria need verification. |
| social-housing | 🔄 | Never | https://www.socialhousing.tw/Portal/BuildingApplyLanding | Steps authored from general knowledge. Process varies by county/city. |
| student-loan-interest-relief | 🔄 | Never | https://heloan.boe.moe.edu.tw/ | Steps authored from general knowledge. Ministry of Education process. |
| unemployment-benefit | 🔄 | Never | https://www.bli.gov.tw/0000100.html | Steps authored from general knowledge. BLI 就業保險 hub; deep-link to 失業給付 申請流程 needs manual verification. |
| childcare-allowance | 🔄 | Never | https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=383 | Steps authored from general knowledge. Local gov variations exist. |
| youth-startup-fund | 🔄 | Never | https://www.sba.gov.tw/ | Steps authored from general knowledge. SBA application process. |
| parental-leave-allowance | 🔄 | Never | https://www.bli.gov.tw/0005521.html | Steps authored from general knowledge. BLI 給付業務(含育嬰津貼) hub; deep-link to 育嬰留職停薪津貼 申請流程 needs manual verification. |
| birth-subsidy | 🔄 | Never | https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=357 | Steps authored from general knowledge. Local variations exist. |
| vocational-training-living-allowance | 🔄 | Never | https://www.wda.gov.tw/News_Content.aspx?n=3C4C351ECDA27CA0&s=1E3B11CF1C70A3EC | Steps authored from general knowledge. WDA process. |
| disability-living-allowance | 🔄 | Never | https://www.sfaa.gov.tw/SFAA/Pages/List.aspx?nodeid=341 | Steps authored from general knowledge. Social welfare process. |

## Verification Guidelines

When verifying steps against official sources:

1. **Check URL is current** - Many government sites reorganize annually (e.g., `2025/YNGSRH` → `2026/YNGSRH`)
2. **Look for "申請流程" or "如何申請" sections** - Official application flow documentation
3. **Note required documents** - ID, household registration, income proof, etc.
4. **Verify deadlines** - Especially for annual programs (September intake, December deadline, etc.)
5. **Flag local variations** - County/city-specific processes (childcare, housing, birth subsidies)
6. **Check for online vs. in-person** - Some programs require in-person submission
7. **Note processing time** - "2-3 weeks" vs "next month" vs "within 30 days"

## Automated Verification Challenges

Many Taiwan government subsidy sites:
- Use JavaScript-heavy SPAs (difficult to scrape)
- Require authenticated sessions
- Hide detailed procedures behind logins
- Provide PDFs rather than HTML (need OCR)
- Reorganize URLs annually

**Recommendation**: Manual verification by a Taiwan resident familiar with these programs is most reliable. Automated scraping may violate ToS and miss nuanced local variations.

## Next Steps

1. **Priority**: Verify youth-focused subsidies first (youth-job-support, youth-vocational-training, youth-home-loan)
2. **Batch review**: Group by agency (勞動部, 內政部, 衛福部) for efficient verification
3. **Annual refresh**: Schedule verification every September (new fiscal year 115→116)
4. **User feedback**: Track user reports of "steps don't match current process"
