# 補助雷達 (Subsidy Radar)

Taiwan government subsidies aggregator — helping residents find subsidies they qualify for.

**Live site**: https://copilot-autogent.github.io/subsidy-radar/

## Stack

- [Astro 5](https://astro.build/) — static site generator
- GitHub Pages — hosting
- Vanilla CSS + TypeScript — no JS framework

## Development

```bash
npm install
npm run dev      # dev server at localhost:4321
npm run build    # production build to dist/
npm run preview  # preview production build
```

## Content

Subsidy data lives in `src/data/subsidies.json`. Each entry has:

- `id` — unique slug
- `title` — 補助名稱 (Traditional Chinese)
- `category` — 住宅 / 能源 / 教育 / 創業
- `agency` — 主管機關
- `summary` — 摘要
- `eligibility` — 資格條件 (array)
- `amount` — 補助金額
- `deadline` — 申請截止日期
- `applicationUrl` — official application link
- `tags` — search tags
- `updatedAt` — last verified date

## Phases

- **Phase 1** (current): Housing subsidies (住宅補助)
- **Phase 2**: Energy subsidies (能源補助)
- **Phase 3**: Education subsidies (教育補助)
- **Phase 4**: Startup subsidies (創業補助) + eligibility calculator

## Deploy Verification

Every push to `main` runs a three-stage CI pipeline:

1. **build** — `npm ci && npm run build`
2. **deploy** — publish `dist/` to GitHub Pages
3. **smoke-test** — fetches the live URL and asserts HTTP 200 + the `class="logo"` app-shell marker is present (rendered by Astro into every page; absent from GitHub's generic 404)

A failed smoke-test means the deploy did not propagate correctly and surfaces as a **red CI check** on the merge commit — "merged ≠ live" failures are no longer silent.

> Sprint agents that merge to `main` must confirm the `smoke-test` job passes (or use `verify_deploy` as an explicit post-merge gate) before closing the issue.

## Data Sources

- [內政部國土管理署](https://www.cpami.gov.tw/)
- [住宅補貼資訊系統](https://hra.cpami.gov.tw/)
- [國家住宅及都市更新中心](https://www.ura.gov.tw/)
