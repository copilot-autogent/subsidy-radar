    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const filterBtns = document.querySelectorAll<HTMLButtonElement>('.filter-btn:not([data-difficulty]):not([data-urgency])');
    const difficultyBtns = document.querySelectorAll<HTMLButtonElement>('.filter-btn[data-difficulty]');
    const urgencyBtns = document.querySelectorAll<HTMLButtonElement>('.filter-btn[data-urgency]');
    const cards = document.querySelectorAll<HTMLElement>('.subsidy-card');
    const resultsCount = document.getElementById('resultsCount')!;
    const noResults = document.getElementById('noResults')!;
    const fuzzyHint = document.getElementById('fuzzyHint') as HTMLElement;
    const countySelect = document.getElementById('countySelect') as HTMLSelectElement | null;
    const agencyChips = document.querySelectorAll<HTMLButtonElement>('.agency-chip');
    const agencyToggleBtn = document.getElementById('agencyToggle') as HTMLButtonElement | null;
    const agencyChipsContainer = document.getElementById('agencyChips') as HTMLElement | null;
    const eligibilityBanner = document.getElementById('eligibilityBanner')!;
    const bannerText = document.getElementById('bannerText')!;
    const eligibleTotalBanner = document.getElementById('eligibleTotalBanner')!;
    const totalBannerText = document.getElementById('totalBannerText')!;
    const matchModeBanner = document.getElementById('matchModeBanner')!;
    const matchModeCount = document.getElementById('matchModeCount')!;
    const matchModeBannerMatch = document.getElementById('matchModeBannerMatch')!;
    const matchModeBannerNoMatch = document.getElementById('matchModeBannerNoMatch')!;
    const matchModeExitBtn = document.getElementById('matchModeExitBtn') as HTMLButtonElement;
    const sortBtn = document.getElementById('sortDifficulty') as HTMLButtonElement;
    const sortAmountBtn = document.getElementById('sortAmount') as HTMLButtonElement;
    const trackerFilterBtn = document.getElementById('trackerFilter') as HTMLButtonElement;
    const showClosedBtn = document.getElementById('showClosedBtn') as HTMLButtonElement;

    // Normalize county names: 臺→台 so data variants match the dropdown values
    const normalizeCounty = (c: string) => c.replace(/臺/g, '台');

    let activeCategory = '全部';
    let activeSituation = '';
    let activeDifficulty = '';
    let searchQuery = '';
    let sortByDifficulty = false;
    /** 0 = off, 1 = high→low, 2 = low→high */
    let sortAmountState: 0 | 1 | 2 = 0;
    let showTrackedOnly = false;
    let showClosedSubsidies = false;
    let isQuizActive = false;
    let activeCounty = '';
    let activeAgency = '';
    let activeUrgency = 0;

    // ── Fuzzy search utilities ────────────────────────────────────────────────
    /** Minimum Jaccard bigram similarity to include a card in fuzzy results */
    const FUZZY_THRESHOLD = 0.15;
    /** Minimum score to surface a "Did you mean?" hint when no exact matches exist */
    const HINT_THRESHOLD = 0.08;

    function getBigrams(str: string): Set<string> {
      const set = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        set.add(str.slice(i, i + 2));
      }
      return set;
    }

    function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
      if (a.size === 0 || b.size === 0) return 0;
      let inter = 0;
      for (const g of a) { if (b.has(g)) inter++; }
      return inter / (a.size + b.size - inter);
    }

    /**
     * Returns { exact: true } when the text contains the query as a substring,
     * or { exact: false, score } with the bigram Jaccard similarity otherwise.
     */
    function fuzzyMatchText(query: string, text: string): { exact: boolean; score: number } {
      if (text.includes(query)) return { exact: true, score: 1 };
      if (query.length < 2) return { exact: false, score: 0 };
      const score = jaccardSimilarity(getBigrams(query), getBigrams(text));
      return { exact: false, score };
    }

    // Per-card fuzzy scores — populated by updateDisplay(), consumed by applySort()
    const fuzzyScores = new Map<Element, { exact: boolean; score: number }>();

    // ── Search autocomplete ───────────────────────────────────────────────────
    const searchBox = document.getElementById('searchBox') as HTMLElement;
    const suggestionList = document.getElementById('searchSuggestions') as HTMLUListElement;
    let acActiveIdx = -1;
    let acBlurTimer: ReturnType<typeof setTimeout> | undefined;

    /** Build suggestion data from card DOM (title, category, id) once per render */
    interface SuggestionEntry { title: string; category: string; id: string; score: number }

    function getSuggestions(query: string): SuggestionEntry[] {
      if (query.length < 1) return [];
      const results: SuggestionEntry[] = [];
      cards.forEach(card => {
        const title = card.querySelector<HTMLElement>('h3, h2, .subsidy-title')?.textContent?.trim() ?? '';
        const category = card.dataset.category ?? '';
        const id = card.dataset.id ?? '';
        const search = (card.dataset.search ?? '').toLowerCase();
        const fm = fuzzyMatchText(query, search);
        if (fm.exact || fm.score >= FUZZY_THRESHOLD) {
          results.push({ title, category, id, score: fm.exact ? 1 : fm.score });
        }
      });
      return results.sort((a, b) => b.score - a.score).slice(0, 6);
    }

    function showSuggestionList(): void {
      suggestionList.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
    }

    function hideSuggestionList(): void {
      suggestionList.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
      acActiveIdx = -1;
    }

    function updateAcActiveItem(items: NodeListOf<HTMLLIElement>): void {
      items.forEach((item, i) => {
        if (i === acActiveIdx) {
          item.classList.add('suggestion-item--active');
          item.setAttribute('aria-selected', 'true');
          searchInput.setAttribute('aria-activedescendant', item.id);
        } else {
          item.classList.remove('suggestion-item--active');
          item.setAttribute('aria-selected', 'false');
        }
      });
    }

    function selectSuggestion(title: string, id: string): void {
      debouncedSearch.cancel();
      searchInput.value = title;
      searchQuery = title.toLowerCase();
      // Reset category filter so the selected card is always visible
      if (activeCategory !== '全部') {
        activeCategory = '全部';
        filterBtns.forEach(b => {
          const isAll = b.dataset.category === '全部';
          b.classList.toggle('active', isAll);
          b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
          b.setAttribute('tabindex', isAll ? '0' : '-1');
        });
      }
      hideSuggestionList();
      updateDisplay();
      applySort();
      const targetCard = document.getElementById(id);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('subsidy-card--highlight');
        setTimeout(() => targetCard.classList.remove('subsidy-card--highlight'), 1500);
      }
    }

    function renderSuggestions(query: string): void {
      const suggestions = getSuggestions(query);
      suggestionList.innerHTML = '';
      acActiveIdx = -1;
      searchInput.removeAttribute('aria-activedescendant'); // clear stale reference
      if (suggestions.length === 0) {
        hideSuggestionList();
        return;
      }
      suggestions.forEach((s, i) => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.id = `suggestion-item-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.id = s.id;
        li.dataset.title = s.title;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'suggestion-title';
        titleSpan.textContent = s.title;

        const catTag = document.createElement('span');
        catTag.className = 'suggestion-cat-tag';
        catTag.textContent = s.category;

        li.append(titleSpan, catTag);
        li.addEventListener('pointerdown', (e: PointerEvent) => {
          e.preventDefault(); // prevent blur from firing before click
          selectSuggestion(s.title, s.id);
        });
        suggestionList.appendChild(li);
      });
      showSuggestionList();
    }

    searchInput.addEventListener('focus', () => {
      clearTimeout(acBlurTimer); // cancel any pending hide from blur
      const q = searchInput.value.trim().toLowerCase();
      if (q.length >= 1) renderSuggestions(q);
    });

    searchInput.addEventListener('blur', () => {
      acBlurTimer = setTimeout(() => hideSuggestionList(), 150);
    });

    searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.isComposing) return; // don't intercept IME composition
      if (suggestionList.hidden) return;
      const items = suggestionList.querySelectorAll<HTMLLIElement>('.suggestion-item');
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acActiveIdx = (acActiveIdx + 1) % items.length;
        updateAcActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acActiveIdx = (acActiveIdx - 1 + items.length) % items.length;
        updateAcActiveItem(items);
      } else if (e.key === 'Enter' && acActiveIdx >= 0) {
        e.preventDefault();
        const item = items[acActiveIdx];
        selectSuggestion(item.dataset.title ?? '', item.dataset.id ?? '');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideSuggestionList();
      }
    });

    // Close on outside click
    document.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!searchBox.contains(e.target as Node)) {
        hideSuggestionList();
      }
    });
    // ─────────────────────────────────────────────────────────────────────────
    function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number): ((...args: T) => void) & { cancel: () => void } {
      let timer: ReturnType<typeof setTimeout> | undefined = undefined;
      const call = (...args: T) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
      call.cancel = () => clearTimeout(timer);
      return call;
    }

    const _recencyBtn = document.getElementById('recencyFilterBtn') as HTMLElement | null;
    const RECENCY_FILTER_LABEL = _recencyBtn?.dataset.category ?? '🆕 最新';
    const RECENCY_DAYS_CLIENT = Number(_recencyBtn?.dataset.recencyDays ?? 90);
    const SENIOR_FILTER_LABEL = (document.getElementById('seniorFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 長者照護';
    const DISABILITY_FILTER_LABEL = (document.getElementById('disabilityFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 身障';
    const NEW_IMMIGRANT_FILTER_LABEL = (document.getElementById('newImmigrantFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 新住民';
    const INDIGENOUS_FILTER_LABEL = (document.getElementById('indigenousFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 原住民';
    const LOW_INCOME_FILTER_LABEL = (document.getElementById('lowIncomeFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 低/中低收入戶';
    const SINGLE_PARENT_FILTER_LABEL = (document.getElementById('singleParentFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 單親';
    const YOUNG_CHILD_FILTER_LABEL = (document.getElementById('youngChildFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 育兒';
    const STUDENT_FILTER_LABEL = (document.getElementById('studentFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 學生補助';
    const WORKER_FILTER_LABEL = (document.getElementById('workerFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 勞工補助';
    const MIDDLE_AGED_FILTER_LABEL = (document.getElementById('middleAgedFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 中高齡補助';
    const VETERAN_FILTER_LABEL = (document.getElementById('veteranFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 榮民補助';
    const FARMER_FILTER_LABEL = (document.getElementById('farmerFilterBtn') as HTMLElement | null)?.dataset.category ?? '⭐ 農業補助';

    const difficultyOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

    // ── Quiz ─────────────────────────────────────────────────────────────────
    const quizQuestions = document.querySelectorAll<HTMLElement>('.quiz-question');
    const quizOptions = document.querySelectorAll<HTMLButtonElement>('.quiz-option');
    const quizResetContainer = document.querySelector<HTMLElement>('.quiz-reset')!;
    const quizResetBtn = document.getElementById('quizReset')!;

    let quizAnswers: Record<string, string> = {};
    let currentQuestionIndex = 0;

    const quizShareContainer = document.getElementById('quizShareContainer')!;
    const quizShareBtn = document.getElementById('quizShareBtn') as HTMLButtonElement;

    const quizTop3Panel = document.getElementById('quiz-top3-panel') as HTMLElement;
    const top3CardsContainer = document.getElementById('top3CardsContainer') as HTMLElement;
    const top3NoMatch = document.getElementById('top3NoMatch') as HTMLElement;
    const top3DismissBtn = document.getElementById('top3DismissBtn') as HTMLButtonElement;

    const quizSummaryBanner = document.getElementById('quiz-summary-banner') as HTMLElement;
    const quizSummaryAmountEl = document.getElementById('quizSummaryAmount') as HTMLElement;
    const quizSummaryCountsEl = document.getElementById('quizSummaryCounts') as HTMLElement;
    const quizSummaryLabelEl = document.getElementById('quizSummaryLabel') as HTMLElement;
    const quizSummaryNoteEl = document.getElementById('quizSummaryNote') as HTMLElement;

    // Valid answer sets for each question key
    const VALID_QUIZ_VALUES: Record<string, Set<string>> = {
      age:           new Set(['youth', 'adult', 'senior']),
      employment:    new Set(['fresh-grad', 'unemployed', 'employed', 'entrepreneur']),
      housing:       new Set(['renter', 'homebuyer', 'parent', 'other']),
      disability:    new Set(['yes', 'no']),
      'single-parent': new Set(['yes', 'no']),
      'young-child':   new Set(['yes', 'no']),
      'student':       new Set(['yes', 'no']),
      'worker':        new Set(['yes', 'no']),
      'middle-aged':   new Set(['yes', 'no']),
      'veteran':       new Set(['yes', 'no']),
      'farmer':        new Set(['yes', 'no']),
      'county':        new Set(['台北市', '新北市', '桃園市', '台中市', '高雄市', 'other']),
    };

    function updateQuizUrl() {
      const params = new URLSearchParams(window.location.search);
      params.set('q1', quizAnswers.age ?? '');
      params.set('q2', quizAnswers.employment ?? '');
      params.set('q3', quizAnswers.housing ?? '');
      params.set('q4', quizAnswers.disability ?? '');
      params.set('q5', quizAnswers['single-parent'] ?? '');
      params.set('q6', quizAnswers['young-child'] ?? '');
      params.set('q7', quizAnswers['student'] ?? '');
      params.set('q8', quizAnswers['county'] ?? '');
      params.set('q9', quizAnswers['worker'] ?? '');
      params.set('q10', quizAnswers['middle-aged'] ?? '');
      params.set('q11', quizAnswers['veteran'] ?? '');
      params.set('q12', quizAnswers['farmer'] ?? '');
      history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    }

    function clearQuizUrl() {
      const params = new URLSearchParams(window.location.search);
      params.delete('q1');
      params.delete('q2');
      params.delete('q3');
      params.delete('q4');
      params.delete('q5');
      params.delete('q6');
      params.delete('q7');
      params.delete('q8');
      params.delete('q9');
      params.delete('q10');
      params.delete('q11');
      params.delete('q12');
      const qs = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    }

    function updateCountyUrl() {
      const params = new URLSearchParams(window.location.search);
      if (activeCounty) {
        params.set('county', activeCounty);
      } else {
        params.delete('county');
      }
      const qs = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    }

    function updateFilterUrl() {
      const params = new URLSearchParams(window.location.search);
      if (activeCategory && activeCategory !== '全部') {
        params.set('cat', activeCategory);
      } else {
        params.delete('cat');
      }
      if (activeSituation) {
        params.set('sit', activeSituation);
      } else {
        params.delete('sit');
      }
      if (sortByDifficulty) {
        params.set('sort', 'difficulty');
      } else if (sortAmountState === 1) {
        params.set('sort', 'amount-desc');
      } else if (sortAmountState === 2) {
        params.set('sort', 'amount-asc');
      } else {
        params.delete('sort');
      }
      if (searchQuery) {
        params.set('q', searchQuery);
      } else {
        params.delete('q');
      }
      if (activeAgency) {
        params.set('agency', activeAgency);
      } else {
        params.delete('agency');
      }
      const qs = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);

      // Keep calendar view link in sync with active filters
      const calViewLink = document.getElementById('calendarViewLink') as HTMLAnchorElement | null;
      const navCalLink = document.querySelector<HTMLAnchorElement>('.nav-calendar-link');
      const calBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
      function updateCalendarLinks() {
        const calParams = new URLSearchParams();
        if (activeCategory && activeCategory !== '全部') calParams.set('cat', activeCategory);
        if (activeSituation) calParams.set('sit', activeSituation);
        if (activeCounty) calParams.set('county', activeCounty);
        if (searchQuery) calParams.set('q', searchQuery);
        const calQs = calParams.toString();
        const calHref = `${calBase}calendar${calQs ? '?' + calQs : ''}`;
        if (calViewLink) calViewLink.href = calHref;
        if (navCalLink) navCalLink.href = calHref;
      }
      updateCalendarLinks();
    }

    function showQuizQuestion(index: number) {
      quizQuestions.forEach((q, i) => {
        q.style.display = i === index ? 'block' : 'none';
      });
      quizResetContainer.style.display = index > 0 ? 'block' : 'none';
    }

    /**
     * Computes a 0–100 match score between the user's quiz situations and a subsidy's
     * situation tags. Score = (matching unique tags / total unique tags on the subsidy) * 100.
     * Returns 0 if the subsidy has no situation tags. Guarantees score ≥ 1 when at least
     * one tag matches (avoids rounding to 0 for sparsely-tagged subsidies).
     */
    function computeMatchScore(quizSituations: string[], cardSituations: string[]): number {
      if (cardSituations.length === 0 || quizSituations.length === 0) return 0;
      const quizSet = new Set(quizSituations);
      const uniqueCardSituations = Array.from(new Set(cardSituations));
      const matches = uniqueCardSituations.filter(s => quizSet.has(s)).length;
      if (matches === 0) return 0;
      return Math.max(1, Math.round((matches / uniqueCardSituations.length) * 100));
    }

    /**
     * Maps a 0–100 score to a display tier label and CSS class.
     * ≥70 → 高符合, 40–69 → 可能符合, 1–39 → 低符合, 0 → null (hidden)
     */
    function getScoreTier(score: number): { label: string; cls: string } | null {
      if (score >= 70) return { label: '🌟 高符合', cls: 'score-high' };
      if (score >= 40) return { label: '✨ 可能符合', cls: 'score-medium' };
      if (score >= 1)  return { label: '· 低符合', cls: 'score-low' };
      return null;
    }

    function matchQuizToSituations(): string[] {
      const situations: string[] = [];
      const { age, employment, housing, disability } = quizAnswers;
      const singleParent = quizAnswers['single-parent'];
      const youngChild = quizAnswers['young-child'];
      const student = quizAnswers['student'];
      const worker = quizAnswers['worker'];
      const middleAged = quizAnswers['middle-aged'];
      const veteran = quizAnswers['veteran'];
      const farmer = quizAnswers['farmer'];

      // Map quiz answers to situations
      if (age === 'senior') situations.push('senior');
      if (employment === 'fresh-grad') situations.push('fresh-grad');
      if (employment === 'unemployed') situations.push('unemployed');
      if (employment === 'employed') situations.push('employed');
      if (housing === 'renter') situations.push('renter');
      if (housing === 'homebuyer') situations.push('homebuyer');
      if (employment === 'entrepreneur' || housing === 'entrepreneur') situations.push('entrepreneur');
      if (housing === 'parent') situations.push('parent');
      if (disability === 'yes') situations.push('disabled');
      if (singleParent === 'yes') {
        situations.push('single-parent');
        // Single parents also qualify for parent-tagged subsidies
        if (!situations.includes('parent')) situations.push('parent');
      }
      if (youngChild === 'yes') {
        situations.push('young-child');
        // 0–6 parents also qualify for broad parent-tagged subsidies
        if (!situations.includes('parent')) situations.push('parent');
      }
      if (student === 'yes') {
        situations.push('student');
      }
      if (worker === 'yes') {
        situations.push('worker');
      }
      if (middleAged === 'yes') {
        situations.push('middle-aged');
      }
      if (veteran === 'yes') {
        situations.push('veteran');
      }
      if (farmer === 'yes') {
        situations.push('farmer');
      }

      return situations;
    }

    const MIN_TOP3_SCORE = 30; // minimum match score % to appear in top panel
    const TOP3_MAX_RESULTS = 5; // show up to 5 (issue #156: "Top 3–5")

    function showTop3Panel() {
      // Collect all visible cards with their quiz scores (set by applyQuizFilter)
      const scored: Array<{ score: number; title: string; amount: string; deadline: string; deadlineStatus: string; url: string; id: string }> = [];
      cards.forEach(card => {
        if (card.style.display === 'none') return;
        const rawScore = parseInt(card.dataset.quizScore ?? '0', 10);
        const score = isNaN(rawScore) ? 0 : rawScore;
        if (score < MIN_TOP3_SCORE) return;
        const title = card.querySelector<HTMLElement>('.card-title')?.textContent?.trim() ?? '';
        const amount = card.querySelector<HTMLElement>('.amount-text')?.textContent?.trim() ?? '';
        const deadline = card.dataset.deadline ?? '';
        const deadlineStatus = card.dataset.deadlineStatus ?? '';
        const url = card.dataset.url ?? '';
        const id = card.dataset.id ?? '';
        scored.push({ score, title, amount, deadline, deadlineStatus, url, id });
      });

      // Sort by score descending, take top 3–5
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, TOP3_MAX_RESULTS);

      top3CardsContainer.innerHTML = '';

      if (top.length === 0) {
        top3NoMatch.style.display = '';
      } else {
        top3NoMatch.style.display = 'none';
        top.forEach(({ score, title, amount, deadline, deadlineStatus, url, id }) => {
          const cardEl = document.createElement('div');
          cardEl.className = 'top3-result-card';

          // Score badge
          let scoreCls = 'score-low';
          if (score >= 70) scoreCls = 'score-high';
          else if (score >= 40) scoreCls = 'score-medium';

          // Header: score badge + title
          const header = document.createElement('div');
          header.className = 'top3-card-header';

          const badge = document.createElement('span');
          badge.className = `top3-score-badge match-score-pill ${scoreCls}`;
          badge.textContent = `${score}% 符合`;

          const titleEl = document.createElement('h3');
          titleEl.className = 'top3-card-title';
          titleEl.textContent = title;

          header.appendChild(badge);
          header.appendChild(titleEl);

          // Amount
          const amountEl = document.createElement('div');
          amountEl.className = 'top3-card-amount';
          amountEl.textContent = `💰 ${amount}`;

          // Footer: deadline + apply link
          const footer = document.createElement('div');
          footer.className = 'top3-card-footer';

          if (deadline) {
            const isClosed = deadlineStatus === 'closed';
            const deadlineEl = document.createElement('span');
            deadlineEl.className = `top3-deadline${isClosed ? ' top3-deadline-closed' : ''}`;
            deadlineEl.textContent = isClosed ? '⚠️ 申請已截止' : `🗓️ ${deadline}`;
            footer.appendChild(deadlineEl);
          }

          const applyLink = document.createElement('a');
          const isHttp = /^https?:\/\//i.test(url);
          const useApplyLink = url && isHttp;
          applyLink.className = useApplyLink ? 'top3-apply-btn' : 'top3-apply-btn top3-apply-btn-detail';
          applyLink.setAttribute('aria-label', useApplyLink ? `前往申請 ${title}（新視窗開啟）` : `查看 ${title} 詳情`);
          if (useApplyLink) {
            applyLink.href = url;
            applyLink.textContent = '立即申請 →';
            applyLink.target = '_blank';
            applyLink.rel = 'noopener noreferrer';
          } else {
            applyLink.href = `#${encodeURIComponent(id)}`;
            applyLink.textContent = '查看詳情 →';
          }
          footer.appendChild(applyLink);

          cardEl.appendChild(header);
          cardEl.appendChild(amountEl);
          cardEl.appendChild(footer);
          top3CardsContainer.appendChild(cardEl);
        });
      }

      quizTop3Panel.style.display = '';
      showQuizSummaryBanner();
      // Scroll to summary banner (above Top-3) so user sees the full result block
      const scrollTarget = (quizSummaryBanner.style.display !== 'none' ? quizSummaryBanner : quizTop3Panel);
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hideTop3Panel() {
      quizTop3Panel.style.display = 'none';
      top3CardsContainer.innerHTML = '';
      top3NoMatch.style.display = 'none';
      hideQuizSummaryBanner();
    }

    // ── Quiz Summary Banner (issue #171) ─────────────────────────────────────

    /** Parse the best numeric amount from a subsidy card for the quiz summary.
     *  Priority: data-max-amount → regex on .amount-text → 0 (→ "依條件核定"). */
    function parseQuizAmountFromCard(card: HTMLElement): number {
      const maxAttr = card.dataset.maxAmount ?? '';
      if (maxAttr !== '') {
        const val = Number(maxAttr);
        if (Number.isFinite(val) && val > 0) return val;
      }
      const amountText = card.querySelector<HTMLElement>('.amount-text')?.textContent ?? '';
      const m = /最高\s*([\d,]+)\s*元/.exec(amountText);
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val > 0) return val;
      }
      return 0;
    }

    function showQuizSummaryBanner(): void {
      const ntdFmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
      let totalAmount = 0;
      let countWithAmount = 0;
      let countWithoutAmount = 0;
      let totalMatched = 0;

      cards.forEach(card => {
        if (card.style.display === 'none') return;
        if (card.dataset.deadlineStatus === 'closed') return;
        const rawScore = parseInt(card.dataset.quizScore ?? '0', 10);
        if (isNaN(rawScore) || rawScore < MIN_TOP3_SCORE) return;
        totalMatched++;
        const val = parseQuizAmountFromCard(card);
        if (val > 0) {
          totalAmount += val;
          countWithAmount++;
        } else {
          countWithoutAmount++;
        }
      });

      // Issue spec: hide if < 2 matched subsidies
      if (totalMatched < 2) {
        quizSummaryBanner.style.display = 'none';
        return;
      }

      if (countWithAmount > 0) {
        // Show amount + breakdown labels
        quizSummaryLabelEl.style.display = '';
        quizSummaryNoteEl.style.display = '';
        quizSummaryAmountEl.style.cssText = ''; // reset any prior conditional-mode overrides
        quizSummaryAmountEl.textContent = ntdFmt.format(totalAmount);
        const countParts: string[] = [`共 ${totalMatched} 項符合資格`];
        if (countWithoutAmount > 0) countParts.push(`另有 ${countWithoutAmount} 項依條件核定`);
        quizSummaryCountsEl.textContent = countParts.join('，');
      } else {
        // All amounts conditional — hide the "最高可領 / 預估上限" labels to avoid misleading display
        quizSummaryLabelEl.style.display = 'none';
        quizSummaryNoteEl.style.display = 'none';
        quizSummaryAmountEl.style.cssText = 'font-size: 1.15rem; color: #fff; font-weight: 700;';
        quizSummaryAmountEl.textContent = '符合資格補助';
        quizSummaryCountsEl.textContent = `共 ${totalMatched} 項（金額依個別條件核定）`;
      }
      quizSummaryBanner.style.display = '';
    }

    function hideQuizSummaryBanner(): void {
      quizSummaryBanner.style.display = 'none';
    }

    function applyQuizFilter() {
      const situations = matchQuizToSituations();

      // Apply county answer from quiz: pre-fill the county dropdown filter
      const countyAnswer = quizAnswers['county'];
      if (countyAnswer && countyAnswer !== 'other') {
        activeCounty = countyAnswer;
        if (countySelect) countySelect.value = countyAnswer;
      } else {
        // 'other' or unanswered → clear county filter so all entries (including city-specific
        // ones) remain visible. Users in non-listed counties get the full set, which is more
        // useful than hiding potentially relevant city-specific subsidies.
        activeCounty = '';
        if (countySelect) countySelect.value = '';
      }
      
      // Reset category filter
      activeCategory = '全部';
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('tabindex', '-1');
      });
      const allBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-category="全部"]');
      if (allBtn) {
        allBtn.classList.add('active');
        allBtn.setAttribute('aria-pressed', 'true');
        allBtn.setAttribute('tabindex', '0');
      } else if (filterBtns[0]) {
        filterBtns[0].classList.add('active');
        filterBtns[0].setAttribute('aria-pressed', 'true');
        filterBtns[0].setAttribute('tabindex', '0');
      }
      activeDifficulty = '';
      difficultyBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      activeUrgency = 0;
      urgencyBtns.forEach(b => { b.classList.remove('active'); if (!b.disabled) b.setAttribute('aria-pressed', 'false'); });
      const isYouth = quizAnswers.age === 'youth';
      let visible = 0;

      const activeCountyNorm = normalizeCounty(activeCounty);
      
      cards.forEach(card => {
        const cardSituations: string[] = JSON.parse(card.dataset.situations ?? '[]');
        const cardIsYouth = card.dataset.youth === 'true';
        
        // Match if: (youth-eligible OR situation-match) AND county-match
        // (Note: category, search, and tracker filters do not apply in quiz mode)
        const matchSituation = situations.length === 0 
          || situations.some(s => cardSituations.includes(s));
        const matchYouth = !isYouth || cardIsYouth;

        // County filter: national entries (empty counties) always match; city-specific entries
        // only match when the selected county is in their counties list.
        const cardCounties: string[] = card.dataset.counties ? JSON.parse(card.dataset.counties) : [];
        const matchCounty = activeCounty === ''
          || cardCounties.length === 0
          || cardCounties.some(c => normalizeCounty(c) === activeCountyNorm);

        const matchOverall = matchSituation && matchYouth && matchCounty && (showClosedSubsidies || card.dataset.deadlineStatus !== 'closed');
        
        card.style.display = matchOverall ? '' : 'none';
        if (matchOverall) visible++;
      });

      // Compute and display match scores for visible cards
      cards.forEach(card => {
        if (card.style.display === 'none') {
          card.dataset.quizScore = '0';
          const pill = card.querySelector<HTMLElement>('[data-match-score-pill]');
          if (pill) pill.style.display = 'none';
          return;
        }
        let cardSituations: string[] = [];
        try {
          const parsed: unknown = JSON.parse(card.dataset.situations ?? '[]');
          if (Array.isArray(parsed)) cardSituations = parsed.filter((s): s is string => typeof s === 'string');
        } catch { /* malformed data-situations — treat as no tags */ }
        const score = computeMatchScore(situations, cardSituations);
        card.dataset.quizScore = String(score);
        const pill = card.querySelector<HTMLElement>('[data-match-score-pill]');
        if (pill) {
          const tier = getScoreTier(score);
          if (tier) {
            pill.textContent = tier.label;
            pill.className = `match-score-pill ${tier.cls}`;
            pill.style.display = '';
          } else {
            pill.style.display = 'none';
          }
        }
      });
      
      resultsCount.textContent = `共 ${visible} 項補助符合你的情況`;
      noResults.hidden = visible !== 0;
      eligibilityBanner.style.display = 'none';
      isQuizActive = true;
      // Show match-mode banner: always visible so user can exit; text differs on zero results
      matchModeCount.textContent = String(visible);
      matchModeBannerMatch.style.display = visible > 0 ? '' : 'none';
      matchModeBannerNoMatch.style.display = visible === 0 ? '' : 'none';
      matchModeBanner.style.display = '';
      applySort();
      updateEligibleTotalBanner();
    }

    quizOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.closest<HTMLElement>('.quiz-question')!;
        const questionType = question.dataset.question!;
        const value = btn.dataset.value!;
        
        // Save answer
        quizAnswers[questionType] = value;
        
        // Visual feedback + ARIA state + roving tabindex
        question.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(opt => {
          opt.classList.remove('selected');
          opt.setAttribute('aria-checked', 'false');
          opt.setAttribute('tabindex', '-1');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        btn.setAttribute('tabindex', '0');
        
        // Advance to next question
        currentQuestionIndex++;
        if (currentQuestionIndex < quizQuestions.length) {
          setTimeout(() => showQuizQuestion(currentQuestionIndex), 300);
        } else {
          // Quiz complete — apply filter, encode results in URL, show share button
          setTimeout(() => {
            applyQuizFilter();
            updateQuizUrl();
            quizShareContainer.style.display = 'block';
            showTop3Panel();
          }, 300);
        }
      });
    });

    // Radiogroup arrow-key navigation within each quiz question (manual-selection variant:
    // arrow keys move focus + update tabindex only; selection fires on click/Enter/Space)
    document.querySelectorAll<HTMLElement>('.quiz-options[role="radiogroup"]').forEach(group => {
      // Initialise: first option is the single tab stop
      group.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach((btn, i) => {
        btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
      });
      group.addEventListener('keydown', (e: KeyboardEvent) => {
        const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('.quiz-option'));
        const idx = radios.indexOf(e.target as HTMLButtonElement);
        if (idx === -1) return;
        let nextIdx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          nextIdx = (idx + 1) % radios.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          nextIdx = (idx - 1 + radios.length) % radios.length;
        }
        if (nextIdx !== -1) {
          radios[idx].setAttribute('tabindex', '-1');
          radios[nextIdx].setAttribute('tabindex', '0');
          radios[nextIdx].focus();
        }
      });
    });

    top3DismissBtn.addEventListener('click', () => {
      quizResetBtn.click();
    });

    // Exit match mode: reset quiz and return to the full subsidy list
    matchModeExitBtn.addEventListener('click', () => {
      quizResetBtn.click();
    });

    quizResetBtn.addEventListener('click', () => {
      quizAnswers = {};
      currentQuestionIndex = 0;
      quizOptions.forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-checked', 'false');
      });
      // Reinitialise roving tabindex for each radiogroup
      document.querySelectorAll<HTMLElement>('.quiz-options[role="radiogroup"]').forEach(group => {
        group.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach((btn, i) => {
          btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
        });
      });
      showQuizQuestion(0);
      quizShareContainer.style.display = 'none';
      hideTop3Panel();
      clearQuizUrl();
      
      // Reset filters
      activeCategory = '全部';
      activeSituation = '';
      activeDifficulty = '';
      searchQuery = '';
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('tabindex', '-1');
      });
      const allBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-category="全部"]');
      if (allBtn) {
        allBtn.classList.add('active');
        allBtn.setAttribute('aria-pressed', 'true');
        allBtn.setAttribute('tabindex', '0');
      } else if (filterBtns[0]) {
        filterBtns[0].classList.add('active');
        filterBtns[0].setAttribute('aria-pressed', 'true');
        filterBtns[0].setAttribute('tabindex', '0');
      }
      difficultyBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      activeUrgency = 0;
      urgencyBtns.forEach(b => { b.classList.remove('active'); if (!b.disabled) b.setAttribute('aria-pressed', 'false'); });
      personaBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      activeAgency = '';
      agencyChips.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      cards.forEach(card => { card.style.display = ''; card.style.order = ''; delete card.dataset.quizScore; });
      // Hide all score pills
      document.querySelectorAll<HTMLElement>('[data-match-score-pill]').forEach(pill => {
        pill.style.display = 'none';
        pill.textContent = '';
        pill.className = 'match-score-pill';
      });
      resultsCount.textContent = `共 ${cards.length} 項補助`;
      eligibilityBanner.style.display = 'none';
      matchModeBanner.style.display = 'none';
      isQuizActive = false;
      updateFilterUrl();
      updateEligibleTotalBanner();
    });

    // ── Tracker ──────────────────────────────────────────────────────────────
    const TRACKER_KEY = 'subsidy-tracker-v1';
    const STATUS_CYCLE = ['未申請', '申請中', '已核准', '已領取', '不符資格'] as const;
    type TrackerStatus = typeof STATUS_CYCLE[number];
    const STATUS_CLASS: Record<TrackerStatus, string> = {
      '未申請':   'ts-none',
      '申請中':   'ts-applying',
      '已核准':   'ts-approved',
      '已領取':   'ts-received',
      '不符資格': 'ts-ineligible',
    };

    function loadTracker(): Record<string, TrackerStatus> {
      try {
        const raw = JSON.parse(localStorage.getItem(TRACKER_KEY) ?? '{}') as Record<string, unknown>;
        const validSet = new Set<string>(STATUS_CYCLE);
        // Migration map: legacy values → closest new status (preserves user intent)
        const LEGACY_MIGRATION: Record<string, TrackerStatus> = {
          '已申請': '申請中',
          '進行中': '申請中',
          '已完成': '已領取',
        };
        const result: Record<string, TrackerStatus> = {};
        for (const [id, val] of Object.entries(raw)) {
          if (typeof val !== 'string') continue;  // drop corrupt/non-string entries
          if (validSet.has(val)) { result[id] = val as TrackerStatus; }
          else if (val in LEGACY_MIGRATION) { result[id] = LEGACY_MIGRATION[val]; }
          // completely unknown strings are silently dropped (no phantom tracker entries)
        }
        return result;
      }
      catch { return {}; }
    }

    function saveTracker(tracker: Record<string, TrackerStatus>) {
      localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
    }

    function applyTrackerToSelect(sel: HTMLSelectElement, status: TrackerStatus) {
      sel.value = status;
      sel.className = `tracker-select ${STATUS_CLASS[status]}`;
      // Update aria-label with current status for screen readers
      const card = sel.closest<HTMLElement>('.subsidy-card');
      const cardTitle = card?.querySelector<HTMLElement>('.card-title')?.textContent?.trim() ?? '';
      sel.setAttribute('aria-label', `申請狀態：${status}${cardTitle ? ` — ${cardTitle}` : ''}`);
      const printBadge = sel.parentElement?.querySelector<HTMLElement>('.tracker-print-badge');
      if (printBadge) {
        printBadge.textContent = status;
        printBadge.className = `tracker-print-badge ${STATUS_CLASS[status]}`;
      }
    }

    function initTracker() {
      const tracker = loadTracker();
      document.querySelectorAll<HTMLSelectElement>('.tracker-select').forEach(sel => {
        const id = sel.dataset.id!;
        const status: TrackerStatus = tracker[id] ?? '未申請';
        applyTrackerToSelect(sel, status);
        sel.addEventListener('change', () => {
          const t = loadTracker();
          const next = sel.value as TrackerStatus;
          t[id] = next;
          saveTracker(t);
          applyTrackerToSelect(sel, next);
          updateTrackerFilterLabel();
          // Clear session dismissal if this item is now newly at-risk (未申請 or 申請中 with deadline ≤ 30d)
          if (next === '未申請' || next === '申請中') {
            const deadline = (sel.closest('[data-deadline]') as HTMLElement | null)?.dataset.deadline ?? '';
            const days = daysUntilDate(deadline);
            if (days !== null && days >= 0 && days <= 30) {
              try { sessionStorage.removeItem(TRACKER_BANNER_DISMISSED_KEY); } catch { /* blocked */ }
            }
          }
          renderTrackerDeadlineBanner();
          renderTrackerClosedBanner();
          updateTrackerSummaryBanner();
          if (showTrackedOnly) updateDisplay();
        });
      });
    }

    function countTracked(): number {
      const tracker = loadTracker();
      return Object.values(tracker).filter(s => s !== '未申請').length;
    }

    function updateTrackerSummaryBanner() {
      const tracker = loadTracker();
      const trackedValues = Object.values(tracker).filter(s => s !== '未申請');
      const n = trackedValues.length;
      const banner = document.getElementById('trackerSummaryBanner');
      const countEl = document.getElementById('trackerSummaryCount');
      const breakdownEl = document.getElementById('trackerStatusBreakdown');
      if (!banner) return;
      if (countEl) countEl.textContent = String(n);
      banner.style.display = n > 0 ? '' : 'none';
      // Build breakdown: 申請中 2 / 已核准 1
      if (breakdownEl) {
        const counts: Partial<Record<TrackerStatus, number>> = {};
        for (const s of trackedValues) { counts[s] = (counts[s] ?? 0) + 1; }
        const parts = (['申請中', '已核准', '已領取', '不符資格'] as TrackerStatus[])
          .filter(s => counts[s])
          .map(s => `${s} ${counts[s]}`);
        breakdownEl.textContent = parts.length > 0 ? `（${parts.join(' / ')}）` : '';
      }
      // Sync tracker-state-tracked class on all cards for @media print targeting
      cards.forEach(card => {
        const id = card.dataset.id ?? '';
        if (!id) return;
        const isTracked = tracker[id] !== undefined && tracker[id] !== '未申請';
        card.classList.toggle('tracker-state-tracked', isTracked);
      });
      updateIcalExportBtn();
      updateCsvExportBtn();
    }

    function updateTrackerFilterLabel() {
      const n = countTracked();
      trackerFilterBtn.textContent = showTrackedOnly
        ? `✓ 📌 追蹤中 (${n})`
        : `📌 只看追蹤中${n > 0 ? ` (${n})` : ''}`;
      trackerFilterBtn.classList.toggle('active', showTrackedOnly);
      trackerFilterBtn.setAttribute('aria-pressed', String(showTrackedOnly));
    }

    // ── Tracker Deadline Banner ───────────────────────────────────────────────
    const TRACKER_BANNER_DISMISSED_KEY = 'tracker-deadline-banner-dismissed';

    function renderTrackerDeadlineBanner() {
      const banner = document.getElementById('trackerDeadlineBanner');
      const list = document.getElementById('trackerDeadlineList');
      const dismissBtn = document.getElementById('trackerDeadlineDismiss') as HTMLButtonElement | null;
      if (!banner || !list) return;

      // Respect session dismissal (guard against storage exceptions in privacy mode)
      try {
        if (sessionStorage.getItem(TRACKER_BANNER_DISMISSED_KEY)) {
          banner.style.display = 'none';
          return;
        }
      } catch { /* sessionStorage blocked; proceed without dismissal */ }

      const tracker = loadTracker();
      const atRisk: { title: string; days: number }[] = [];

      cards.forEach(card => {
        const id = card.dataset.id ?? '';
        const deadline = card.dataset.deadline ?? '';
        if (!deadline || !id) return;
        // Only include items explicitly present in the tracker (user has interacted)
        if (!(id in tracker)) return;
        const status = tracker[id];
        // Only show for 未申請, 申請中, or 已核准 (still potentially actionable before deadline)
        if (status !== '未申請' && status !== '申請中' && status !== '已核准') return;
        const days = daysUntilDate(deadline);
        if (days === null || days < 0 || days > 30) return;
        const title = card.querySelector('.card-title')?.textContent?.trim() ?? id;
        atRisk.push({ title, days });
      });

      if (atRisk.length === 0) {
        banner.style.display = 'none';
        return;
      }

      // Sort soonest first
      atRisk.sort((a, b) => a.days - b.days);

      list.innerHTML = '';
      atRisk.forEach(({ title, days }) => {
        const li = document.createElement('li');
        li.className = 'tracker-deadline-item';
        const dot = days <= 7 ? '🔴' : '🟡';
        const label = days === 0 ? '今天截止' : days === 1 ? '明天截止' : `還有 ${days} 天`;
        li.textContent = `${dot} ${title} — ${label}`;
        list.appendChild(li);
      });

      banner.style.display = '';

      if (dismissBtn) {
        dismissBtn.onclick = () => {
          try { sessionStorage.setItem(TRACKER_BANNER_DISMISSED_KEY, '1'); } catch { /* blocked */ }
          banner.style.display = 'none';
        };
      }
    }

    // ── Tracker closed-subsidy warning banner ────────────────────────────────
    const TRACKER_CLOSED_BANNER_DISMISSED_KEY = 'tracker-closed-banner-dismissed';

    function renderTrackerClosedBanner() {
      const banner = document.getElementById('trackerClosedBanner');
      const list = document.getElementById('trackerClosedList');
      const dismissBtn = document.getElementById('trackerClosedDismiss') as HTMLButtonElement | null;
      if (!banner || !list) return;

      try {
        if (sessionStorage.getItem(TRACKER_CLOSED_BANNER_DISMISSED_KEY)) {
          banner.style.display = 'none';
          return;
        }
      } catch { /* sessionStorage blocked */ }

      const tracker = loadTracker();
      const closedTracked: string[] = [];

      cards.forEach(card => {
        const id = card.dataset.id ?? '';
        if (!Object.prototype.hasOwnProperty.call(tracker, id)) return;
        if (card.dataset.deadlineStatus !== 'closed') return;
        const status = tracker[id];
        if (status === '不符資格') return;
        const title = card.querySelector('.card-title')?.textContent?.trim() ?? id;
        closedTracked.push(title);
      });

      if (closedTracked.length === 0) {
        banner.style.display = 'none';
        return;
      }

      list.innerHTML = '';
      closedTracked.forEach(title => {
        const li = document.createElement('li');
        li.className = 'tracker-deadline-item';
        li.textContent = `🔴 ${title} — 此計畫申請期限已結束`;
        list.appendChild(li);
      });

      banner.style.display = '';

      if (dismissBtn) {
        dismissBtn.onclick = () => {
          try { sessionStorage.setItem(TRACKER_CLOSED_BANNER_DISMISSED_KEY, '1'); } catch { /* blocked */ }
          banner.style.display = 'none';
        };
      }
    }

    // ── Share Link ───────────────────────────────────────────────────────────
    const shareToast = document.getElementById('share-toast') as HTMLElement | null;
    let shareToastTimer: number | undefined;

    function showShareToast() {
      if (!shareToast) return;
      // Cancel any existing hide-timer before the rAF gap to avoid race
      if (shareToastTimer !== undefined) {
        clearTimeout(shareToastTimer);
        shareToastTimer = undefined;
      }
      shareToast.textContent = '';
      shareToast.classList.remove('visible');
      // Defer to next frame so the cleared state is committed before new content
      // lands, ensuring aria-live regions re-announce on repeated triggers
      window.requestAnimationFrame(() => {
        shareToast.textContent = '已複製連結';
        shareToast.classList.add('visible');
        shareToastTimer = window.setTimeout(() => {
          shareToast.classList.remove('visible');
          shareToastTimer = undefined;
        }, 2500);
      });
    }

    const shareResetTimers = new WeakMap<HTMLButtonElement, number>();
    const shareOriginalText = new WeakMap<HTMLButtonElement, string>();

    function showCopied(btn: HTMLButtonElement, label: HTMLElement) {
      // Capture original text only on first invocation per button (before any "✓ 已複製" swap).
      if (!shareOriginalText.has(btn)) {
        shareOriginalText.set(btn, label.textContent ?? '分享');
      }
      const originalText = shareOriginalText.get(btn)!;
      label.textContent = '✓ 已複製';
      btn.classList.add('copied');
      const existing = shareResetTimers.get(btn);
      if (existing !== undefined) clearTimeout(existing);
      const id = window.setTimeout(() => {
        label.textContent = originalText;
        btn.classList.remove('copied');
        shareResetTimers.delete(btn);
        // Restore focus only if the user hasn't moved to a meaningful element.
        const active = document.activeElement;
        if (active === btn || active == null) {
          btn.focus();
        }
      }, 2000);
      shareResetTimers.set(btn, id);
    }

    function fallbackCopy(url: string): boolean {
      const prevFocus = document.activeElement as HTMLElement | null;
      const textArea = document.createElement('textarea');
      textArea.value = url;
      // Position in-viewport (not off-screen) — iOS Safari requires the element
      // to be visible and focusable; opacity:0 alone can block clipboard access.
      textArea.style.cssText =
        'position:fixed;top:0;left:0;width:2em;height:2em;' +
        'padding:0;border:none;outline:none;box-shadow:none;background:transparent;';
      document.body.appendChild(textArea);
      textArea.focus();
      // select() for cross-browser desktop; setSelectionRange for iOS Safari.
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      } finally {
        document.body.removeChild(textArea);
        // Restore focus to the element that had it before the copy (a11y).
        if (prevFocus && typeof prevFocus.focus === 'function') {
          prevFocus.focus();
        }
      }
      return ok;
    }

    function initShareLinks() {
      document.querySelectorAll<HTMLButtonElement>('.share-link-btn').forEach(btn => {
        if (btn.dataset.shareBound === '1') return;
        btn.dataset.shareBound = '1';
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.dataset.id!;
          const url = `${window.location.origin}${window.location.pathname}#${id}`;
          const label = btn.querySelector<HTMLElement>('.share-text');
          if (!label) return;

          // Web Share API — native share sheet on mobile (iOS Safari 15+, Android Chrome)
          if (typeof navigator.share === 'function') {
            const cardTitle = btn.dataset.title ?? '';
            const cardAmount = btn.dataset.amount ?? '';
            const cardAgency = btn.dataset.agency ?? '';
            const textParts = [cardTitle, cardAmount, cardAgency].filter(Boolean);
            try {
              await navigator.share({
                title: cardTitle,
                text: textParts.join('｜'),
                url,
              });
              return; // native share sheet handled it; no further feedback needed
            } catch (err) {
              // Only AbortError reliably means user dismissed the share sheet.
              // NotAllowedError/TypeError/DataError should fall through to clipboard.
              if (err instanceof DOMException && err.name === 'AbortError') return;
            }
          }

          // Clipboard fallback (desktop / browsers without Share API)
          let copied = false;
          if (navigator.clipboard && window.isSecureContext) {
            try {
              await navigator.clipboard.writeText(url);
              copied = true;
            } catch {
              copied = false;
            }
          }
          if (!copied) {
            copied = fallbackCopy(url);
          }
          if (copied) {
            showShareToast();
            showCopied(btn, label);
          } else {
            alert('無法複製連結，請手動複製網址列');
          }
        });
      });
    }

    // ── LINE share: update href just before navigation ────────────────────────
    // Covers left-click, middle-click, touch tap, and keyboard activation.
    function updateLineShareHref(link: HTMLAnchorElement) {
      const id = link.dataset.id;
      if (!id) return;
      const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;
      link.href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(currentUrl)}`;
    }
    function getLineShareLink(target: EventTarget | null): HTMLAnchorElement | null {
      return target instanceof Element ? target.closest<HTMLAnchorElement>('a.line-share-btn') : null;
    }
    // pointerdown covers mouse, touch, and stylus before navigation resolves.
    document.addEventListener('pointerdown', (e) => {
      const link = getLineShareLink(e.target);
      if (link) updateLineShareHref(link);
    }, true);
    // focusin handles keyboard users (Tab to focus, then Enter/Space).
    document.addEventListener('focusin', (e) => {
      const link = getLineShareLink(e.target);
      if (link) updateLineShareHref(link);
    });
    // keydown Enter ensures fresh href if filters changed after initial focus.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const link = getLineShareLink(e.target);
      if (link) updateLineShareHref(link);
    }, true);

    // ── Sort ─────────────────────────────────────────────────────────────────
    function applySort() {
      if (sortByDifficulty) {
        cards.forEach(card => {
          const diff = card.dataset.difficulty ?? 'medium';
          card.style.order = String(difficultyOrder[diff] ?? 2);
        });
      } else if (sortAmountState !== 0) {
        // Collect [card, amountValue] pairs for ranking
        const pairs = Array.from(cards).map(card => ({
          card,
          val: Number(card.dataset.amountValue ?? 0),
        }));
        // Sort: unparseable (val=0) always last; among parsed values, desc (state 1) or asc (state 2)
        pairs.sort((a, b) => {
          if (a.val === 0 && b.val === 0) return 0;
          if (a.val === 0) return 1;
          if (b.val === 0) return -1;
          return sortAmountState === 1 ? b.val - a.val : a.val - b.val;
        });
        pairs.forEach(({ card }, i) => { card.style.order = String(i + 1); });
      } else if (searchQuery !== '' && fuzzyScores.size > 0) {
        // Fuzzy search ranking: exact matches first, then by score descending
        const ranked = Array.from(cards).map(card => {
          const fm = fuzzyScores.get(card) ?? { exact: false, score: 0 };
          return { card, exact: fm.exact, score: fm.score };
        });
        ranked.sort((a, b) => {
          if (a.exact !== b.exact) return a.exact ? -1 : 1;
          return b.score - a.score;
        });
        ranked.forEach(({ card }, i) => { card.style.order = String(i + 1); });
      } else if (isQuizActive) {
        // Default sort in quiz mode: descending match score
        const ranked = Array.from(cards).map(card => ({
          card,
          score: Number(card.dataset.quizScore || 0),
        }));
        ranked.sort((a, b) => b.score - a.score);
        ranked.forEach(({ card }, i) => { card.style.order = String(i + 1); });
      } else {
        cards.forEach(card => { card.style.order = ''; });
      }
    }

    // ── Eligible-Total Banner ─────────────────────────────────────────────────
    const _ntdFmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

    function updateEligibleTotalBanner() {
      const filterActive = isQuizActive || activeCategory !== '全部' || activeDifficulty !== '' || searchQuery !== '' || activeSituation !== '' || showTrackedOnly || activeUrgency !== 0;
      if (!filterActive) {
        eligibleTotalBanner.style.display = 'none';
        return;
      }
      let total = 0;
      let hasAmount = false;
      cards.forEach(card => {
        if (card.style.display === 'none') return;
        const raw = card.dataset.maxAmount ?? '';
        if (raw === '') return;
        const val = Number(raw);
        if (Number.isFinite(val) && val > 0) {
          total += val;
          hasAmount = true;
        }
      });
      if (!hasAmount) {
        eligibleTotalBanner.style.display = 'none';
        return;
      }
      totalBannerText.textContent = `估計最高可領取 ${_ntdFmt.format(total)}`;
      eligibleTotalBanner.style.display = 'flex';
    }

    // ── Display ──────────────────────────────────────────────────────────────
    function countEligible(situation: string): number {
      return Array.from(cards).filter(card => {
        const situations: string[] = JSON.parse(card.dataset.situations ?? '[]');
        return situations.includes(situation);
      }).length;
    }

    function updateDisplay() {
      const tracker = loadTracker();
      let visible = 0;
      let exactSearchHits = 0;
      let fuzzyOnlyHits = 0;
      let topFuzzyName = '';
      let topFuzzyScore = 0;
      fuzzyScores.clear();

      cards.forEach(card => {
        const cat = card.dataset.category ?? '';
        const isYouth = card.dataset.youth === 'true';
        const situations: string[] = JSON.parse(card.dataset.situations ?? '[]');
        const search = (card.dataset.search ?? '').toLowerCase();
        const cardId = card.dataset.id ?? '';

        const matchCat = activeCategory === '全部'
          ? true
          : activeCategory === '⭐ 青年必看'
          ? isYouth
          : activeCategory === SENIOR_FILTER_LABEL
          ? (situations.includes('senior') || cat === '長者')
          // Disability entries span multiple categories (生活, 就業) — tag-only matching is intentional.
          // All disability subsidies carry the 'disabled' situation tag; there is no dedicated 身障 category.
          : activeCategory === DISABILITY_FILTER_LABEL
          ? situations.includes('disabled')
          // New-immigrant entries span multiple categories — tag-only matching is intentional.
          : activeCategory === NEW_IMMIGRANT_FILTER_LABEL
          ? situations.includes('new-immigrant')
          // Indigenous entries span multiple categories — tag-only matching is intentional.
          : activeCategory === INDIGENOUS_FILTER_LABEL
          ? situations.includes('indigenous')
          // Low-income entries span multiple categories — tag-only matching is intentional.
          : activeCategory === LOW_INCOME_FILTER_LABEL
          ? situations.includes('low-income')
          // Single-parent entries span multiple categories — tag-only matching is intentional.
          : activeCategory === SINGLE_PARENT_FILTER_LABEL
          ? situations.includes('single-parent')
          // Young-child entries: match by situation tag OR 育兒 category (same as 長者照護 pattern).
          : activeCategory === YOUNG_CHILD_FILTER_LABEL
          ? (situations.includes('young-child') || cat === '育兒')
          // Student entries span multiple categories — tag-only matching is intentional.
          : activeCategory === STUDENT_FILTER_LABEL
          ? situations.includes('student')
          // Worker entries span multiple categories — tag-only matching is intentional.
          : activeCategory === WORKER_FILTER_LABEL
          ? situations.includes('worker')
          // Middle-aged entries span multiple categories — tag-only matching is intentional.
          : activeCategory === MIDDLE_AGED_FILTER_LABEL
          ? situations.includes('middle-aged')
          // Veteran entries span multiple categories — tag-only matching is intentional.
          : activeCategory === VETERAN_FILTER_LABEL
          ? situations.includes('veteran')
          // Farmer entries span multiple categories — tag-only matching is intentional.
          : activeCategory === FARMER_FILTER_LABEL
          ? situations.includes('farmer')
          : activeCategory === RECENCY_FILTER_LABEL
          ? isRecentlyAdded(card)
          : cat === activeCategory;

        const matchSituation = activeSituation === '' || situations.includes(activeSituation);

        // Fuzzy search: exact substring match or bigram Jaccard above threshold
        let matchSearch: boolean;
        if (searchQuery === '') {
          matchSearch = true;
        } else {
          const fm = fuzzyMatchText(searchQuery, search);
          fuzzyScores.set(card, fm);
          matchSearch = fm.exact || fm.score >= FUZZY_THRESHOLD;
        }
        const matchTracked = !showTrackedOnly || (tracker[cardId] && tracker[cardId] !== '未申請');
        const matchDifficulty = activeDifficulty === '' || (card.dataset.difficulty || 'medium').trim().toLowerCase() === activeDifficulty;

        // County filter: if no county selected, show all. If county selected, hide cards
        // that have a counties list which does NOT include the selected county.
        const cardCounties: string[] = card.dataset.counties ? JSON.parse(card.dataset.counties) : [];
        const activeCountyNorm = normalizeCounty(activeCounty);
        const matchCounty = activeCounty === ''
          || cardCounties.length === 0
          || cardCounties.some(c => normalizeCounty(c) === activeCountyNorm);

        // Urgency filter: only match subsidies with a non-periodic deadlineDate within threshold
        let matchUrgency = true;
        if (activeUrgency !== 0) {
          const deadlineDate = card.dataset.deadline ?? '';
          const deadlineStatus = card.dataset.deadlineStatus ?? '';
          if (!deadlineDate || deadlineStatus === 'periodic') {
            matchUrgency = false;
          } else {
            const days = daysUntilDate(deadlineDate);
            matchUrgency = days !== null && days >= 0 && days <= activeUrgency;
          }
        }

        // Agency filter: if no agency selected, show all; otherwise match card's normalized agency.
        const matchAgency = activeAgency === '' || card.dataset.agency === activeAgency;

        const matchClosed = showClosedSubsidies || (card.dataset.deadlineStatus !== 'closed');
        const show = matchCat && matchSituation && matchSearch && matchTracked && matchDifficulty && matchCounty && matchUrgency && matchAgency && matchClosed;
        card.style.display = show ? '' : 'none';
        if (show) {
          visible++;
          if (searchQuery !== '') {
            const fm = fuzzyScores.get(card);
            // Check exact first to avoid mis-routing exact matches into fuzzy counters
            if (fm?.exact) {
              exactSearchHits++;
            } else if (fm && !fm.exact) {
              fuzzyOnlyHits++;
              if (fm.score > topFuzzyScore) {
                topFuzzyScore = fm.score;
                // Read title from server-rendered DOM (trusted content)
                topFuzzyName = card.querySelector('h3, h2, .subsidy-title')?.textContent?.trim() ?? '';
              }
            }
          }
        }
      });

      // When visible===0 and no other filters active, scan fuzzyScores for near-miss
      // candidates (HINT_THRESHOLD ≤ score < FUZZY_THRESHOLD) to surface a suggestion.
      // Restrict to "no other active filters" to avoid suggesting items the user cannot
      // reach without changing their filter state.
      const noOtherFilters = activeCategory === '全部' && activeSituation === '' &&
        activeDifficulty === '' && activeCounty === '' && activeUrgency === 0 && activeAgency === '' &&
        !showTrackedOnly && !isQuizActive;
      if (searchQuery !== '' && visible === 0 && noOtherFilters) {
        fuzzyScores.forEach((fm, card) => {
          if (!fm.exact && fm.score >= HINT_THRESHOLD && fm.score < FUZZY_THRESHOLD) {
            if (fm.score > topFuzzyScore) {
              topFuzzyScore = fm.score;
              topFuzzyName = card.querySelector('h3, h2, .subsidy-title')?.textContent?.trim() ?? '';
            }
          }
        });
      }

      resultsCount.textContent = `共 ${visible} 項補助`;
      noResults.hidden = visible !== 0;
      // Keep match-mode banner count in sync if user applies additional filters on top of quiz
      if (isQuizActive) {
        matchModeCount.textContent = String(visible);
        matchModeBannerMatch.style.display = visible > 0 ? '' : 'none';
        matchModeBannerNoMatch.style.display = visible === 0 ? '' : 'none';
        matchModeBanner.style.display = '';
      }

      // Fuzzy hint: show only when search is active, results are found via fuzzy (not exact)
      fuzzyHint.textContent = '';
      if (searchQuery !== '' && exactSearchHits === 0 && (fuzzyOnlyHits > 0 || (visible === 0 && topFuzzyName !== ''))) {
        const hintName = topFuzzyName || searchQuery;
        if (visible > 0) {
          // "Showing fuzzy results for X" — build safely with DOM API
          const icon = document.createTextNode('🔍 顯示「');
          const strong = document.createElement('strong');
          strong.textContent = hintName;
          const tail = document.createTextNode('」的相關結果（模糊比對）');
          fuzzyHint.append(icon, strong, tail);
        } else if (topFuzzyName !== '') {
          // "Did you mean: X?" — clickable suggestion
          const prefix = document.createTextNode('你是否想搜尋：');
          const strong = document.createElement('strong');
          strong.textContent = topFuzzyName;
          strong.style.cursor = 'pointer';
          strong.setAttribute('role', 'button');
          strong.setAttribute('tabindex', '0');
          const suffix = document.createTextNode('？');
          const handleSuggestion = () => {
            const suggestion = topFuzzyName.trim();
            debouncedSearch.cancel(); // prevent stale debounce from overwriting
            searchInput.value = suggestion;
            searchQuery = suggestion.toLowerCase();
            updateDisplay();
            applySort();
          };
          strong.addEventListener('click', handleSuggestion, { once: true });
          strong.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSuggestion(); }
          }, { once: true });
          fuzzyHint.append(prefix, strong, suffix);
        }
        fuzzyHint.hidden = fuzzyHint.childNodes.length === 0;
      } else {
        fuzzyHint.hidden = true;
      }

      // Hide eligibility banner when tracker filter is active (BUG-A fix)
      if (showTrackedOnly) {
        eligibilityBanner.style.display = 'none';
      } else if (activeSituation) {
        const totalEligible = countEligible(activeSituation);
        bannerText.textContent = `你可能有 ${totalEligible} 項補助符合你的情況！`;
        eligibilityBanner.style.display = 'flex';
      } else {
        eligibilityBanner.style.display = 'none';
      }
      updateEligibleTotalBanner();
      updateCsvExportBtn();
    }

    // ── Event listeners ──────────────────────────────────────────────────────
    const debouncedSearch = debounce((value: string) => {
      searchQuery = value;
      updateDisplay();
      applySort();
      updateFilterUrl();
    }, 200);

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      debouncedSearch(q);
      if (q.length >= 1) {
        renderSuggestions(q);
      } else {
        hideSuggestionList();
      }
    });

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
          b.setAttribute('tabindex', '-1');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('tabindex', '0');
        activeCategory = btn.dataset.category ?? '全部';
        activeSituation = '';
        personaBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        updateDisplay();
        updateFilterUrl();
      });
    });

    // Roving tabindex — arrow keys navigate within .category-filters
    const categoryFilterGroup = document.querySelector<HTMLElement>('.category-filters');
    categoryFilterGroup?.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLButtonElement;
      if (!target.classList.contains('filter-btn')) return;
      const allFilterBtns = Array.from(filterBtns);
      const idx = allFilterBtns.indexOf(target);
      if (idx === -1) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = allFilterBtns[(idx + 1) % allFilterBtns.length];
        next.setAttribute('tabindex', '0');
        target.setAttribute('tabindex', '-1');
        next.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = allFilterBtns[(idx - 1 + allFilterBtns.length) % allFilterBtns.length];
        prev.setAttribute('tabindex', '0');
        target.setAttribute('tabindex', '-1');
        prev.focus();
      }
    });

    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.difficulty ?? '';
        if (activeDifficulty === key) {
          // toggle off
          activeDifficulty = '';
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          difficultyBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
          activeDifficulty = key;
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
        updateDisplay();
        updateFilterUrl();
      });
    });

    // ── Persona Strip ─────────────────────────────────────────────────────────
    const personaBtns = document.querySelectorAll<HTMLButtonElement>('.persona-btn');
    const PERSONA_SITUATION_MAP: Record<string, string> = {
      'fresh-grad':   'fresh-grad',
      'student':      'student',
      'worker':       'worker',
      'renter':       'renter',
      'homebuyer':    'homebuyer',
      'entrepreneur': 'entrepreneur',
      'parent':       'parent',
      'young-child':  'young-child',
      'senior':       'senior',
      'indigenous':   'indigenous',
      'disabled':     'disabled',
      'low-income':   'low-income',
      'middle-aged':  'middle-aged',
      'veteran':      'veteran',
      'farmer':       'farmer',
    };

    personaBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.persona ?? '';
        const sit = PERSONA_SITUATION_MAP[key] ?? key;
        if (activeSituation === sit) {
          // Toggle off
          activeSituation = '';
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          personaBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
          activeSituation = sit;
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
        // Clear quiz & category filters
        isQuizActive = false;
        activeCategory = '全部';
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
          b.setAttribute('tabindex', '-1');
        });
        const allBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-category="全部"]');
        if (allBtn) { allBtn.classList.add('active'); allBtn.setAttribute('aria-pressed', 'true'); allBtn.setAttribute('tabindex', '0'); }
        updateDisplay();
        updateFilterUrl();
      });
    });

    // ── Urgency chips ─────────────────────────────────────────────────────────
    function initUrgencyCounts() {
      urgencyBtns.forEach(btn => {
        const threshold = Number(btn.dataset.urgency ?? '0');
        let count = 0;
        cards.forEach(card => {
          const deadlineDate = card.dataset.deadline ?? '';
          const deadlineStatus = card.dataset.deadlineStatus ?? '';
          if (!deadlineDate || deadlineStatus === 'periodic') return;
          const days = daysUntilDate(deadlineDate);
          if (days !== null && days >= 0 && days <= threshold) count++;
        });
        const badge = btn.querySelector<HTMLElement>('.count-badge');
        if (badge) badge.textContent = String(count);
        if (count === 0) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
          btn.removeAttribute('aria-pressed');
          btn.classList.add('urgency-disabled');
        }
      });
    }

    urgencyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const threshold = Number(btn.dataset.urgency ?? '0');
        if (activeUrgency === threshold) {
          // toggle off
          activeUrgency = 0;
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          urgencyBtns.forEach(b => { b.classList.remove('active'); if (!b.disabled) b.setAttribute('aria-pressed', 'false'); });
          activeUrgency = threshold;
          btn.setAttribute('aria-pressed', 'true');
        }
        updateDisplay();
      });
    });

    sortBtn.addEventListener('click', () => {
      sortByDifficulty = !sortByDifficulty;
      // Reset amount sort when difficulty sort activates
      if (sortByDifficulty) {
        sortAmountState = 0;
        sortAmountBtn.classList.remove('active');
        sortAmountBtn.setAttribute('aria-pressed', 'false');
        sortAmountBtn.textContent = '依金額高低';
      }
      sortBtn.classList.toggle('active', sortByDifficulty);
      sortBtn.setAttribute('aria-pressed', String(sortByDifficulty));
      sortBtn.textContent = sortByDifficulty ? '✓ 🟢 簡單優先' : '依申請難度排序';
      applySort();
      updateFilterUrl();
    });

    sortAmountBtn.addEventListener('click', () => {
      // Cycle: 0 → 1 (high→low) → 2 (low→high) → 0 (reset)
      sortAmountState = ((sortAmountState + 1) % 3) as 0 | 1 | 2;
      const labels = ['依金額高低', '✓ 💰 金額高→低', '✓ 💰 金額低→高'] as const;
      sortAmountBtn.textContent = labels[sortAmountState];
      const isActive = sortAmountState !== 0;
      sortAmountBtn.classList.toggle('active', isActive);
      sortAmountBtn.setAttribute('aria-pressed', String(isActive));
      // Reset difficulty sort when amount sort activates
      if (isActive && sortByDifficulty) {
        sortByDifficulty = false;
        sortBtn.classList.remove('active');
        sortBtn.setAttribute('aria-pressed', 'false');
        sortBtn.textContent = '依申請難度排序';
      }
      applySort();
      updateFilterUrl();
    });

    trackerFilterBtn.addEventListener('click', () => {
      showTrackedOnly = !showTrackedOnly;
      updateTrackerFilterLabel();
      updateDisplay();
    });

    // ── Show closed subsidies toggle ─────────────────────────────────────────
    showClosedBtn?.addEventListener('click', () => {
      showClosedSubsidies = !showClosedSubsidies;
      showClosedBtn.classList.toggle('active', showClosedSubsidies);
      showClosedBtn.setAttribute('aria-pressed', String(showClosedSubsidies));
      showClosedBtn.textContent = showClosedSubsidies ? '⏸ 隱藏已截止補助' : '⏸ 顯示已截止補助';
      if (isQuizActive) {
        applyQuizFilter();
      } else {
        updateDisplay();
      }
    });

    // ── County filter ────────────────────────────────────────────────────────
    countySelect?.addEventListener('change', () => {
      activeCounty = countySelect.value;
      updateCountyUrl();
      updateDisplay();
    });

    // ── Agency filter chips ───────────────────────────────────────────────────
    agencyChips.forEach(btn => {
      btn.addEventListener('click', () => {
        const agency = btn.dataset.agency!;
        if (activeAgency === agency) {
          activeAgency = '';
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          agencyChips.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
          activeAgency = agency;
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
        updateFilterUrl();
        updateDisplay();
      });
    });

    // Toggle chip strip visibility (collapsible on mobile)
    agencyToggleBtn?.addEventListener('click', () => {
      const expanded = agencyToggleBtn.getAttribute('aria-expanded') === 'true';
      agencyToggleBtn.setAttribute('aria-expanded', String(!expanded));
      if (agencyChipsContainer) {
        agencyChipsContainer.style.display = expanded ? 'none' : '';
      }
      const arrow = agencyToggleBtn.querySelector<HTMLElement>('.agency-toggle-arrow');
      if (arrow) arrow.textContent = expanded ? '▶' : '▼';
    });

    // ── Empty-state CTA buttons ────────────────────────────────────────────────
    const clearFiltersBtn = document.getElementById('clearFiltersBtn') as HTMLButtonElement | null;
    const startQuizBtn = document.getElementById('startQuizBtn') as HTMLButtonElement | null;

    clearFiltersBtn?.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      activeCategory = '全部';
      activeSituation = '';
      activeDifficulty = '';
      activeCounty = '';
      if (countySelect) countySelect.value = '';
      activeAgency = '';
      agencyChips.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      showTrackedOnly = false;
      isQuizActive = false;
      sortByDifficulty = false;
      sortAmountState = 0;
      sortBtn.classList.remove('active');
      sortBtn.setAttribute('aria-pressed', 'false');
      sortBtn.textContent = '依申請難度排序';
      sortAmountBtn.classList.remove('active');
      sortAmountBtn.setAttribute('aria-pressed', 'false');
      sortAmountBtn.textContent = '依金額高低';
      applySort();
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('tabindex', '-1');
      });
      const allFilterBtn = document.querySelector<HTMLButtonElement>('.filter-btn[data-category="全部"]');
      if (allFilterBtn) {
        allFilterBtn.classList.add('active');
        allFilterBtn.setAttribute('aria-pressed', 'true');
        allFilterBtn.setAttribute('tabindex', '0');
      }
      difficultyBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      activeUrgency = 0;
      urgencyBtns.forEach(b => { b.classList.remove('active'); if (!b.disabled) b.setAttribute('aria-pressed', 'false'); });
      personaBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      updateTrackerFilterLabel();
      updateCountyUrl();
      updateFilterUrl();
      updateDisplay();
    });

    startQuizBtn?.addEventListener('click', () => {
      const quizSection = document.querySelector<HTMLElement>('.quiz-section');
      if (!quizSection) {
        console.warn('[startQuizBtn] .quiz-section not found');
        return;
      }
      quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ── iCal Export ───────────────────────────────────────────────────────────
    const icalExportBtn = document.getElementById('icalExportBtn') as HTMLButtonElement | null;

    function escapeIcalText(text: string): string {
      return String(text ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
    }

    function foldIcalLine(line: string): string {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const bytes = enc.encode(line);
      if (bytes.length <= 75) return line;
      const CRLF = '\r\n';
      const parts: string[] = [];
      let offset = 0;
      let limit = 75;
      while (offset < bytes.length) {
        let end = Math.min(offset + limit, bytes.length);
        while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
        if (end <= offset) end = Math.min(offset + limit, bytes.length);
        parts.push(dec.decode(bytes.slice(offset, end)));
        offset = end;
        limit = 74;
      }
      return parts.join(CRLF + ' ');
    }

    function generateTrackedIcal(): string {
      const CRLF = '\r\n';
      const tracker = loadTracker();
      const now = new Date();
      const dtstamp = [
        now.getUTCFullYear(),
        String(now.getUTCMonth() + 1).padStart(2, '0'),
        String(now.getUTCDate()).padStart(2, '0'),
        'T',
        String(now.getUTCHours()).padStart(2, '0'),
        String(now.getUTCMinutes()).padStart(2, '0'),
        String(now.getUTCSeconds()).padStart(2, '0'),
        'Z',
      ].join('');

      const eventLines: string[] = [];
      cards.forEach(card => {
        const id = card.dataset.id ?? '';
        if (!id) return;
        if (!tracker[id] || tracker[id] === '未申請') return;
        const deadlineDate = card.dataset.deadline ?? '';
        if (!deadlineDate || !/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) return;
        const startDate = deadlineDate.replace(/-/g, '');
        // DTEND is exclusive — next day so the all-day event covers the deadline
        const [y, m, d] = deadlineDate.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + 1);
        const endDate = `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
        const title = card.querySelector<HTMLElement>('.card-title')?.textContent?.trim() ?? id;
        const agency = card.querySelector<HTMLElement>('.card-agency')?.textContent?.trim() ?? '';
        const url = (card as HTMLElement).dataset.url ?? '';
        const summary = escapeIcalText(`📅 ${title} - 申請截止`);
        const uid = escapeIcalText(`subsidy-${id}@subsidy-radar.copilot-autogent.github.io`);
        const lines = [
          'BEGIN:VEVENT',
          foldIcalLine(`UID:${uid}`),
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          foldIcalLine(`SUMMARY:${summary}`),
          foldIcalLine(`LOCATION:${escapeIcalText(agency)}`),
        ];
        // RFC 5545 §3.8.4.6: URL value is a URI, not TEXT — only strip CR/LF
        // to prevent property injection; do not backslash-escape ; or , which
        // are valid sub-delimiters in URIs (RFC 3986).
        if (url) lines.push(foldIcalLine(`URL:${url.replace(/[\r\n]/g, '')}`));
        lines.push('STATUS:CONFIRMED');
        lines.push('BEGIN:VALARM');
        lines.push('TRIGGER:-P7D');
        lines.push('ACTION:DISPLAY');
        lines.push(foldIcalLine(`DESCRIPTION:${escapeIcalText(`${title} 申請即將截止（還有 7 天）`)}`));
        lines.push('END:VALARM');
        lines.push('END:VEVENT');
        eventLines.push(...lines);
      });

      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        foldIcalLine('PRODID:-//補助雷達//Subsidy Deadlines//ZH'),
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        foldIcalLine('X-WR-CALNAME:補助雷達 - 追蹤中截止日曆'),
        'X-WR-TIMEZONE:Asia/Taipei',
        ...eventLines,
        'END:VCALENDAR',
        '',
      ].join(CRLF);
    }

    function updateIcalExportBtn() {
      if (!icalExportBtn) return;
      const tracker = loadTracker();
      const hasTrackedWithDeadline = Array.from(cards).some(card => {
        const id = card.dataset.id ?? '';
        if (!id || !tracker[id] || tracker[id] === '未申請') return false;
        const dd = card.dataset.deadline ?? '';
        return dd !== '' && /^\d{4}-\d{2}-\d{2}$/.test(dd);
      });
      icalExportBtn.style.display = hasTrackedWithDeadline ? '' : 'none';
    }

    if (icalExportBtn) {
      icalExportBtn.addEventListener('click', () => {
        const ical = generateTrackedIcal();
        const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subsidy-deadlines.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revoke so the browser has time to initiate the download
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    }

    // ── CSV Export ────────────────────────────────────────────────────────────
    function escapeCsvField(value: string): string {
      const s = String(value ?? '');
      // Force quoting for fields that start with formula-trigger chars (=, +, @, tab).
      // Inside double-quoted CSV cells, Excel does not interpret these as formulas.
      // Note: '-' is intentionally excluded to avoid corrupting ISO dates and URLs.
      const forceQuote = /^[=+@\t]/.test(s);
      if (forceQuote || s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    function generateTrackedCsv(): string {
      const tracker = loadTracker();
      const headers = ['補助名稱', '類別', '申請狀態', '截止日期', '官方說明連結'];
      const rows: string[][] = [];

      cards.forEach(card => {
        // Only include visible tracked cards (respects active filters)
        // Use getComputedStyle to catch both inline-style and class-based hiding
        if (getComputedStyle(card).display === 'none') return;
        const id = card.dataset.id ?? '';
        if (!id || !tracker[id] || tracker[id] === '未申請') return;

        const title = card.querySelector<HTMLElement>('.card-title')?.textContent?.trim() ?? id;
        const category = card.dataset.category ?? '';
        const status = tracker[id];
        const deadline = card.dataset.deadline ?? '';
        const url = card.dataset.url ?? '';
        rows.push([title, category, status, deadline, url]);
      });

      const csvLines = [
        headers.map(escapeCsvField).join(','),
        ...rows.map(row => row.map(escapeCsvField).join(',')),
      ];
      // BOM prefix for correct zh-TW display in Excel / Numbers
      return '\uFEFF' + csvLines.join('\r\n');
    }

    function updateCsvExportBtn() {
      // Resolve lazily to avoid temporal dead zone — this function may be invoked
      // from updateTrackerSummaryBanner() before the script reaches the const binding.
      const btn = document.getElementById('csvExportBtn') as HTMLButtonElement | null;
      if (!btn) return;
      const tracker = loadTracker();
      const hasVisibleTracked = Array.from(cards).some(card => {
        if (getComputedStyle(card).display === 'none') return false;
        const id = card.dataset.id ?? '';
        return id !== '' && tracker[id] && tracker[id] !== '未申請';
      });
      btn.style.display = hasVisibleTracked ? '' : 'none';
    }

    const csvExportBtn = document.getElementById('csvExportBtn') as HTMLButtonElement | null;
    if (csvExportBtn) {
      csvExportBtn.addEventListener('click', () => {
        const csv = generateTrackedCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subsidy-tracker.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    }

    // ── Print Tracker ─────────────────────────────────────────────────────────
    const printTrackerBtn = document.getElementById('printTrackerBtn') as HTMLButtonElement | null;

    function setCurrentPrintDate() {
      const dateEl = document.getElementById('printDate');
      if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('zh-Hant-TW', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
      }
    }

    if (printTrackerBtn) {
      printTrackerBtn.addEventListener('click', () => {
        setCurrentPrintDate();
        window.print();
      });
    }

    // ── Print Filtered List ───────────────────────────────────────────────────
    const printListBtn = document.getElementById('printListBtn') as HTMLButtonElement | null;

    if (printListBtn) {
      printListBtn.addEventListener('click', () => {
        // Clear any stale state from a previous aborted print (re-entrancy guard)
        document.querySelectorAll<HTMLElement>('.print-filtered-hidden').forEach(el => {
          el.classList.remove('print-filtered-hidden');
        });
        document.body.classList.remove('print-filtered');
        // Close any previously force-opened eligibility details
        document.querySelectorAll<HTMLDetailsElement>('details.card-eligibility[data-print-opened]').forEach(el => {
          el.removeAttribute('open');
          el.removeAttribute('data-print-opened');
        });

        // Mark currently hidden cards (use computed style to catch class-based hiding)
        const allCards = document.querySelectorAll<HTMLElement>('.subsidy-card');
        allCards.forEach(card => {
          if (getComputedStyle(card).display === 'none') {
            card.classList.add('print-filtered-hidden');
          }
        });

        // Open eligibility <details> on visible cards so content is reliably printed.
        // Track which ones we opened so we can close them in cleanup.
        document.querySelectorAll<HTMLDetailsElement>('details.card-eligibility').forEach(el => {
          const card = el.closest<HTMLElement>('.subsidy-card');
          if (card && !card.classList.contains('print-filtered-hidden') && !el.open) {
            el.setAttribute('open', '');
            el.setAttribute('data-print-opened', '');
          }
        });

        // Set the print date and URL in the filtered header/footer
        const filteredDateEl = document.getElementById('printFilteredDate');
        if (filteredDateEl) {
          const today = new Date();
          filteredDateEl.textContent = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
        }
        const filteredUrlEl = document.getElementById('printFilteredUrl');
        if (filteredUrlEl) {
          filteredUrlEl.textContent = window.location.href;
        }

        document.body.classList.add('print-filtered');
        try {
          window.print();
        } finally {
          // If afterprint does not fire (some browsers), ensure state is cleaned up after a short delay
          setTimeout(() => {
            if (document.body.classList.contains('print-filtered')) {
              document.body.classList.remove('print-filtered');
              document.querySelectorAll<HTMLElement>('.print-filtered-hidden').forEach(el => {
                el.classList.remove('print-filtered-hidden');
              });
              document.querySelectorAll<HTMLDetailsElement>('details.card-eligibility[data-print-opened]').forEach(el => {
                el.removeAttribute('open');
                el.removeAttribute('data-print-opened');
              });
            }
          }, 3000);
        }
      });

      // Gate cleanup on print-filtered being set to avoid interfering with tracker prints
      window.addEventListener('afterprint', () => {
        if (!document.body.classList.contains('print-filtered')) return;
        document.body.classList.remove('print-filtered');
        document.querySelectorAll<HTMLElement>('.print-filtered-hidden').forEach(el => {
          el.classList.remove('print-filtered-hidden');
        });
        document.querySelectorAll<HTMLDetailsElement>('details.card-eligibility[data-print-opened]').forEach(el => {
          el.removeAttribute('open');
          el.removeAttribute('data-print-opened');
        });
      });
    }

    // Also populate date for native Ctrl+P / browser print menu
    window.addEventListener('beforeprint', setCurrentPrintDate);

    // ── Hero youth link ───────────────────────────────────────────────────────
    const heroYouthLink = document.getElementById('heroYouthLink');
    heroYouthLink?.addEventListener('click', () => {
      const youthBtn = [...filterBtns].find(b => b.dataset.category === '⭐ 青年必看');
      if (!youthBtn) {
        console.warn('[heroYouthLink] Could not find ⭐ 青年必看 filter button');
        return;
      }
      // Delegate to the filter button's own click handler to avoid state drift
      youthBtn.click();
      // Additional UX: clear quiz chip visuals (activeSituation was reset by the click)
      quizOptions.forEach(opt => opt.classList.remove('selected'));
      youthBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // ── Quiz share button ─────────────────────────────────────────────────────
    quizShareBtn.addEventListener('click', async () => {
      const url = window.location.href;
      const label = quizShareBtn.querySelector<HTMLElement>('.share-text');
      if (!label) return;
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(url); copied = true; } catch { copied = false; }
      }
      if (!copied) copied = fallbackCopy(url);
      if (copied) {
        showCopied(quizShareBtn, label);
      } else {
        alert('無法複製連結，請手動複製網址列');
      }
    });

    // ── Init from query params ────────────────────────────────────────────────
    function initFromQueryParams() {
      const params = new URLSearchParams(window.location.search);
      const q1 = params.get('q1') ?? '';
      const q2 = params.get('q2') ?? '';
      const q3 = params.get('q3') ?? '';
      const q4 = params.get('q4') ?? '';
      const q5 = params.get('q5') ?? '';
      const q6 = params.get('q6') ?? '';
      const q7 = params.get('q7') ?? '';
      const q8 = params.get('q8') ?? '';
      const q9 = params.get('q9') ?? '';
      const q10 = params.get('q10') ?? '';
      const q11 = params.get('q11') ?? '';
      const q12 = params.get('q12') ?? '';

      const q123Valid =
        VALID_QUIZ_VALUES.age.has(q1) &&
        VALID_QUIZ_VALUES.employment.has(q2) &&
        VALID_QUIZ_VALUES.housing.has(q3);
      const q4Valid = VALID_QUIZ_VALUES.disability.has(q4);
      const q5Valid = VALID_QUIZ_VALUES['single-parent'].has(q5);
      // q6 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the young-child question was added in #106).
      const q6Valid = q6 === '' || VALID_QUIZ_VALUES['young-child'].has(q6);
      // q7 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the student question was added in #114).
      const q7Valid = q7 === '' || VALID_QUIZ_VALUES['student'].has(q7);
      // q8 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the county question was added in #125).
      const q8Valid = q8 === '' || VALID_QUIZ_VALUES['county'].has(q8);
      // q9 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the worker question was added in #144).
      const q9Valid = q9 === '' || VALID_QUIZ_VALUES['worker'].has(q9);
      // q10 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the middle-aged question was added in #145).
      const q10Valid = q10 === '' || VALID_QUIZ_VALUES['middle-aged'].has(q10);
      // q11 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the veteran question was added in #117).
      const q11Valid = q11 === '' || VALID_QUIZ_VALUES['veteran'].has(q11);
      // q12 is optional: empty string means user hadn't reached this question yet (backward-compat
      // with URLs shared before the farmer question was added in #164).
      const q12Valid = q12 === '' || VALID_QUIZ_VALUES['farmer'].has(q12);

      if (q123Valid && q4Valid && q5Valid && q6Valid && q7Valid && q8Valid && q9Valid && q10Valid && q11Valid && q12Valid) {
        // All answers present and valid — restore full quiz state
        quizAnswers = { age: q1, employment: q2, housing: q3, disability: q4, 'single-parent': q5, ...(q6 ? { 'young-child': q6 } : {}), ...(q7 ? { 'student': q7 } : {}), ...(q8 ? { 'county': q8 } : {}), ...(q9 ? { 'worker': q9 } : {}), ...(q10 ? { 'middle-aged': q10 } : {}), ...(q11 ? { 'veteran': q11 } : {}), ...(q12 ? { 'farmer': q12 } : {}) };
        // Mark each answer as selected in the UI; sync roving tabindex per group
        quizQuestions.forEach(q => { q.style.display = 'none'; });
        quizResetContainer.style.display = 'block';
        // Update aria-checked and roving tabindex per radiogroup
        document.querySelectorAll<HTMLElement>('.quiz-options[role="radiogroup"]').forEach(group => {
          const question = group.closest<HTMLElement>('.quiz-question')!;
          const questionType = question.dataset.question!;
          const selectedValue = quizAnswers[questionType];
          let hasSelected = false;
          group.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(opt => {
            if (opt.dataset.value === selectedValue) {
              opt.classList.add('selected');
              opt.setAttribute('aria-checked', 'true');
              opt.setAttribute('tabindex', '0');
              hasSelected = true;
            } else {
              opt.classList.remove('selected');
              opt.setAttribute('aria-checked', 'false');
              opt.setAttribute('tabindex', '-1');
            }
          });
          // If no answer for this group (shouldn't happen given validation), reset to first
          if (!hasSelected) {
            const first = group.querySelector<HTMLButtonElement>('.quiz-option');
            if (first) first.setAttribute('tabindex', '0');
          }
        });
        currentQuestionIndex = quizQuestions.length;
        applyQuizFilter();
        quizShareContainer.style.display = 'block';
        showTop3Panel();
      } else if (q123Valid && q4Valid && q5 === '') {
        // Old 4-answer share URL (pre-Q5): restore q1–q4 and advance to Q5 so user answers it
        quizAnswers = { age: q1, employment: q2, housing: q3, disability: q4 };
        // Mark q1–q4 answers as selected; leave Q5 unselected
        document.querySelectorAll<HTMLElement>('.quiz-options[role="radiogroup"]').forEach(group => {
          const question = group.closest<HTMLElement>('.quiz-question')!;
          const questionType = question.dataset.question!;
          const selectedValue = quizAnswers[questionType];
          if (!selectedValue) return; // Q5 — leave as-is
          let hasSelected = false;
          group.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(opt => {
            if (opt.dataset.value === selectedValue) {
              opt.classList.add('selected');
              opt.setAttribute('aria-checked', 'true');
              opt.setAttribute('tabindex', '0');
              hasSelected = true;
            } else {
              opt.classList.remove('selected');
              opt.setAttribute('aria-checked', 'false');
              opt.setAttribute('tabindex', '-1');
            }
          });
          if (!hasSelected) {
            const first = group.querySelector<HTMLButtonElement>('.quiz-option');
            if (first) first.setAttribute('tabindex', '0');
          }
        });
        // Show Q5 (single-parent) so the user completes the quiz; apply q1–q4 filter immediately
        currentQuestionIndex = Array.from(quizQuestions).findIndex(q => q.dataset.question === 'single-parent');
        if (currentQuestionIndex < 0) currentQuestionIndex = 4; // fallback
        showQuizQuestion(currentQuestionIndex);
        applyQuizFilter();
        quizResetContainer.style.display = 'block';
      } else if (q123Valid && q4 === '' && q5 === '') {
        // Old 3-answer share URL (pre-Q4): restore q1–q3 and advance to Q4 so user answers it
        quizAnswers = { age: q1, employment: q2, housing: q3 };
        // Mark q1–q3 answers as selected; leave Q4/Q5 unselected
        document.querySelectorAll<HTMLElement>('.quiz-options[role="radiogroup"]').forEach(group => {
          const question = group.closest<HTMLElement>('.quiz-question')!;
          const questionType = question.dataset.question!;
          const selectedValue = quizAnswers[questionType];
          if (!selectedValue) return; // Q4/Q5 — leave as-is
          let hasSelected = false;
          group.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(opt => {
            if (opt.dataset.value === selectedValue) {
              opt.classList.add('selected');
              opt.setAttribute('aria-checked', 'true');
              opt.setAttribute('tabindex', '0');
              hasSelected = true;
            } else {
              opt.classList.remove('selected');
              opt.setAttribute('aria-checked', 'false');
              opt.setAttribute('tabindex', '-1');
            }
          });
          if (!hasSelected) {
            const first = group.querySelector<HTMLButtonElement>('.quiz-option');
            if (first) first.setAttribute('tabindex', '0');
          }
        });
        // Show Q4 (index 3) so the user completes the quiz; apply q1–q3 filter immediately
        currentQuestionIndex = 3;
        showQuizQuestion(currentQuestionIndex);
        applyQuizFilter();
        quizResetContainer.style.display = 'block';
      } else if (params.has('q1') || params.has('q2') || params.has('q3') || params.has('q4') || params.has('q5') || params.has('q6') || params.has('q7') || params.has('q8') || params.has('q9') || params.has('q10') || params.has('q11')) {
        // Stale/partial/invalid params — clear them so the URL matches UI state
        clearQuizUrl();
      }

      // Restore county filter from URL
      const countyParam = params.get('county') ?? '';
      if (countyParam) {
        if (countySelect) {
          const opt = Array.from(countySelect.options).find(o => o.value === countyParam);
          if (opt) {
            countySelect.value = countyParam;
            activeCounty = countyParam;
            updateDisplay();
          } else {
            // Stale/invalid county param — clear it so URL matches UI state
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('county');
            const qs = cleanParams.toString();
            history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
          }
        }
      }

      // Restore category filter from URL (only when quiz was not applied)
      if (!isQuizActive) {
        const catParam = params.get('cat') ?? '';
        if (catParam && catParam !== '全部') {
          const catBtn = Array.from(filterBtns).find(b => b.dataset.category === catParam);
          if (catBtn) {
            filterBtns.forEach(b => {
              b.classList.remove('active');
              b.setAttribute('aria-pressed', 'false');
              b.setAttribute('tabindex', '-1');
            });
            catBtn.classList.add('active');
            catBtn.setAttribute('aria-pressed', 'true');
            catBtn.setAttribute('tabindex', '0');
            activeCategory = catParam;
          }
          // Silently ignore unknown cat values (acceptance criterion: invalid params ignored)
        }

        // Restore situation filter from URL (validate against known situation values)
        const VALID_SITUATIONS = new Set([
          'renter', 'homebuyer', 'entrepreneur', 'parent', 'fresh-grad',
          'unemployed', 'employed', 'senior', 'disabled', 'new-immigrant', 'indigenous', 'low-income',
          'single-parent', 'young-child', 'student', 'worker', 'middle-aged', 'veteran', 'farmer',
        ]);
        const sitParam = params.get('sit') ?? '';
        if (sitParam && VALID_SITUATIONS.has(sitParam)) {
          activeSituation = sitParam;
          // Sync persona chip visual
          const matchingPersonaBtn = Array.from(personaBtns).find(b => b.dataset.persona === sitParam);
          if (matchingPersonaBtn) {
            matchingPersonaBtn.classList.add('active');
            matchingPersonaBtn.setAttribute('aria-pressed', 'true');
          }
        }
        // Silently ignore unknown sit values

        if (activeCategory !== '全部' || activeSituation) {
          updateDisplay();
        }
      }

      // Restore sort from URL
      const sortParam = params.get('sort') ?? '';
      if (sortParam === 'difficulty') {
        sortByDifficulty = true;
        sortBtn.classList.add('active');
        sortBtn.setAttribute('aria-pressed', 'true');
        sortBtn.textContent = '✓ 🟢 簡單優先';
        applySort();
      } else if (sortParam === 'amount-desc') {
        sortAmountState = 1;
        sortAmountBtn.textContent = '✓ 💰 金額高→低';
        sortAmountBtn.classList.add('active');
        sortAmountBtn.setAttribute('aria-pressed', 'true');
        applySort();
      } else if (sortParam === 'amount-asc') {
        sortAmountState = 2;
        sortAmountBtn.textContent = '✓ 💰 金額低→高';
        sortAmountBtn.classList.add('active');
        sortAmountBtn.setAttribute('aria-pressed', 'true');
        applySort();
      }
      // Silently ignore unknown sort values

      // Restore search query from URL
      const qParam = params.get('q') ?? '';
      if (qParam) {
        searchInput.value = qParam;
        searchQuery = qParam.toLowerCase();
        updateDisplay();
        applySort();
      }

      // Restore agency filter from URL — validate against actually-rendered chips
      const renderedAgencies = new Set(Array.from(agencyChips).map(b => b.dataset.agency!).filter(Boolean));
      const agencyParam = params.get('agency') ?? '';
      if (agencyParam && renderedAgencies.has(agencyParam)) {
        activeAgency = agencyParam;
        const matchingChip = Array.from(agencyChips).find(b => b.dataset.agency === agencyParam);
        if (matchingChip) {
          matchingChip.classList.add('active');
          matchingChip.setAttribute('aria-pressed', 'true');
        }
        updateDisplay();
      }
    }

    // ── popstate: sync filter state on browser back/forward ──────────────────
    window.addEventListener('popstate', () => {
      // Reset all filter state to defaults
      activeCategory = '全部';
      activeSituation = '';
      activeDifficulty = '';
      searchQuery = '';
      sortByDifficulty = false;
      sortAmountState = 0;
      isQuizActive = false;
      activeCounty = '';
      activeAgency = '';
      activeUrgency = 0;
      // Reset UI
      searchInput.value = '';
      if (countySelect) countySelect.value = '';
      agencyChips.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('tabindex', '-1');
      });
      const allBtn2 = document.querySelector<HTMLButtonElement>('.filter-btn[data-category="全部"]');
      if (allBtn2) {
        allBtn2.classList.add('active');
        allBtn2.setAttribute('aria-pressed', 'true');
        allBtn2.setAttribute('tabindex', '0');
      }
      difficultyBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      urgencyBtns.forEach(b => { b.classList.remove('active'); if (!b.disabled) b.setAttribute('aria-pressed', 'false'); });
      personaBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      sortBtn.classList.remove('active');
      sortBtn.setAttribute('aria-pressed', 'false');
      sortBtn.textContent = '依申請難度排序';
      sortAmountBtn.classList.remove('active');
      sortAmountBtn.setAttribute('aria-pressed', 'false');
      sortAmountBtn.textContent = '依金額高低';
      showTrackedOnly = false;
      updateTrackerFilterLabel();
      // Re-apply state from current URL
      initFromQueryParams();
      updateDisplay();
      applySort();
    });

    // ── Init ─────────────────────────────────────────────────────────────────
    initTracker();
    updateTrackerFilterLabel();
    updateTrackerSummaryBanner();
    renderCountdownBadges();
    renderRecencyBadges();
    renderTrackerDeadlineBanner();
    renderTrackerClosedBanner();
    initShareLinks();
    initFromQueryParams();
    initUrgencyCounts();

    // ── Sync calendar view link with initial filter state from URL ────────────
    // updateFilterUrl() keeps it in sync on subsequent changes; this handles the
    // first-paint case where URL params are present but no filter was clicked yet.
    {
      const calViewLink = document.getElementById('calendarViewLink') as HTMLAnchorElement | null;
      if (calViewLink) {
        const initParams = new URLSearchParams(window.location.search);
        const initCat = initParams.get('cat') ?? '';
        const initSit = initParams.get('sit') ?? '';
        const initCounty = initParams.get('county') ?? '';
        const initQ = initParams.get('q') ?? '';
        if (initCat || initSit || initCounty || initQ) {
          const calParams = new URLSearchParams();
          if (initCat) calParams.set('cat', initCat);
          if (initSit) calParams.set('sit', initSit);
          if (initCounty) calParams.set('county', initCounty);
          if (initQ) calParams.set('q', initQ);
          const calBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
          const calHref = `${calBase}calendar?${calParams.toString()}`;
          calViewLink.href = calHref;
          const navCalLinkInit = document.querySelector<HTMLAnchorElement>('.nav-calendar-link');
          if (navCalLinkInit) navCalLinkInit.href = calHref;
        }
      }
    }

    // ── Calendar Subscribe Link ───────────────────────────────────────────────
    // Rewrite to webcal:// so the user's calendar app prompts to subscribe
    // (live updates) instead of downloading a one-shot snapshot.
    // calLink.href (DOM property) is already the fully resolved absolute URL.
    const calLink = document.getElementById('calendarSubscribeLink') as HTMLAnchorElement | null;
    if (calLink) {
      calLink.href = calLink.href.replace(/^https?:\/\//, 'webcal://');
    }

    // ── Push Notifications ────────────────────────────────────────────────────
    const VAPID_PUBLIC_KEY = 'BDitVaTjSdzeqqxDnuXXeL2alIaj_WeYnXd-dc1BiZGYfpWIXws2aVPXCZnBw6wiJ2X-1ccptDe6Fqv3rukxj7E';
    const PUSH_SUB_KEY = 'push-subscription-v1';
    const PUSH_NOTIFIED_KEY = 'push-notified-date';

    function urlBase64ToUint8Array(base64String: string): Uint8Array {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from(rawData, c => c.charCodeAt(0));
    }

    function daysUntilDate(dateStr: string): number | null {
      if (!dateStr) return null;
      // Parse as local date (YYYY-MM-DD) to avoid UTC-midnight vs local-midnight off-by-one
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts.map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const deadline = new Date(y, m - 1, d); // local midnight
      const diff = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
      return Number.isFinite(diff) && diff >= 0 ? diff : null;
    }

    function daysSinceDate(dateStr: string): number | null {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts.map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const added = new Date(y, m - 1, d);
      // Reject calendar-overflow dates (e.g. 2026-02-31 → normalises to March 3)
      if (added.getFullYear() !== y || added.getMonth() !== m - 1 || added.getDate() !== d) return null;
      const diff = Math.floor((today.getTime() - added.getTime()) / 86400000);
      return Number.isFinite(diff) && diff >= 0 ? diff : null;
    }

    function isRecentlyAdded(card: HTMLElement): boolean {
      const addedDate = card.dataset.addedDate ?? '';
      const days = daysSinceDate(addedDate);
      return days !== null && days <= RECENCY_DAYS_CLIENT;
    }

    function renderRecencyBadges() {
      let recencyLiveCount = 0;
      cards.forEach(card => {
        const badge = card.querySelector<HTMLElement>('[data-recency-badge]');
        if (!badge) return;
        const recent = isRecentlyAdded(card);
        badge.style.display = recent ? '' : 'none';
        if (recent) recencyLiveCount++;
      });
      // Keep filter button count badge in sync with client-side live count
      const countSpan = _recencyBtn?.querySelector<HTMLElement>('.count-badge');
      if (countSpan) countSpan.textContent = String(recencyLiveCount);
    }

    function isDeadlinePast(dateStr: string): boolean {
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return false;
      const [y, m, d] = parts.map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
      if (m < 1 || m > 12 || d < 1 || d > 31) return false;
      const parsed = new Date(y, m - 1, d);
      // Reject overflowed dates (e.g. 2026-02-31 → March 3)
      if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return false;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      return parsed < now;
    }

    function isCardExpired(card: HTMLElement): boolean {
      // Explicit closed status always dims the card, regardless of deadlineDate
      if (card.dataset.deadlineStatus === 'closed') return true;
      return isDeadlinePast(card.dataset.deadline ?? '');
    }

    function renderCountdownBadges() {
      cards.forEach(card => {
        // Apply/remove card-expired class regardless of badge presence
        const expired = isCardExpired(card);
        card.classList.toggle('card-expired', expired);

        const badge = card.querySelector<HTMLElement>('[data-deadline-badge]');
        if (!badge) return;
        const deadline = card.dataset.deadline ?? '';

        if (expired) {
          badge.style.display = '';
          badge.className = 'countdown-badge countdown-expired';
          badge.textContent = '已截止';
          return;
        }

        const days = daysUntilDate(deadline);
        if (days === null) { badge.style.display = 'none'; return; }
        let text: string; let cls: string;
        if (days === 0)      { text = '⏰ 今天截止'; cls = 'countdown-urgent'; }
        else if (days === 1) { text = '⏰ 明天截止'; cls = 'countdown-urgent'; }
        else if (days <= 7)  { text = `🔥 剩 ${days} 天`; cls = 'countdown-urgent'; }
        else if (days <= 30) { text = `⏰ 剩 ${days} 天`; cls = 'countdown-soon'; }
        else                 { text = `📅 剩 ${days} 天`; cls = 'countdown-ok'; }
        badge.style.display = '';
        badge.className = `countdown-badge ${cls}`;
        badge.textContent = text;
      });
    }

    // Check tracked subsidies with upcoming deadlines and show browser notification
    function checkDeadlineNotifications() {
      if (Notification.permission !== 'granted') return;
      const { getFullYear: fy, getMonth: fm, getDate: fd } = Date.prototype;
      const ld = new Date();
      const today = `${fy.call(ld)}-${String(fm.call(ld)+1).padStart(2,'0')}-${String(fd.call(ld)).padStart(2,'0')}`;
      if (localStorage.getItem(PUSH_NOTIFIED_KEY) === today) return; // already notified today

      const tracker = loadTracker();
      const urgent: string[] = [];
      cards.forEach(card => {
        const id = card.dataset.id ?? '';
        const deadline = card.dataset.deadline ?? '';
        const status = tracker[id];
        if (!status || status === '未申請' || status === '已領取' || status === '不符資格') return;
        const days = daysUntilDate(deadline);
        if (days !== null && days <= 7) {
          const title = card.querySelector('.card-title')?.textContent ?? id;
          urgent.push(`${title}（剩 ${days === 0 ? '今天' : days + ' 天'}）`);
        }
      });

      if (urgent.length > 0) {
        const body = urgent.length === 1
          ? `${urgent[0]} 即將截止，快去申請！`
          : `${urgent.length} 項追蹤中的補助即將截止：${urgent.slice(0, 2).join('、')}${urgent.length > 2 ? '…' : ''}`;
        new Notification('⏰ 補助雷達截止提醒', { body, icon: '/subsidy-radar/favicon.svg', tag: 'subsidy-deadline-local' });
        localStorage.setItem(PUSH_NOTIFIED_KEY, today);
      }
    }

    async function setupPushNotifications() {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

      const container = document.getElementById('pushNotifContainer')!;
      const subscribeBtn = document.getElementById('subscribeBtn') as HTMLButtonElement;
      const pushStatus = document.getElementById('pushStatus')!;
      container.style.display = 'flex';

      const updateBtnState = (subscribed: boolean) => {
        subscribeBtn.textContent = subscribed ? '🔕 關閉截止提醒' : '🔔 開啟截止提醒';
        subscribeBtn.classList.toggle('subscribed', subscribed);
        pushStatus.textContent = subscribed ? '✅ 截止提醒已開啟（瀏覽器本地通知，7 天前提醒）' : '';
      };

      // Reflect current permission state
      if (Notification.permission === 'granted') {
        updateBtnState(!!localStorage.getItem(PUSH_SUB_KEY));
        checkDeadlineNotifications();
      } else if (Notification.permission === 'denied') {
        pushStatus.textContent = '瀏覽器已封鎖通知，請在網址列設定中允許。';
        subscribeBtn.disabled = true;
      }

      subscribeBtn.addEventListener('click', async () => {
        if (subscribeBtn.classList.contains('subscribed')) {
          // Unsubscribe
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch {}
          localStorage.removeItem(PUSH_SUB_KEY);
          updateBtnState(false);
          return;
        }

        // Request permission and subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          pushStatus.textContent = permission === 'denied'
            ? '通知已被封鎖，請在瀏覽器設定中允許。'
            : '未授予通知權限。';
          return;
        }

        try {
          const reg = await navigator.serviceWorker.ready;
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
          localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subscription));
          updateBtnState(true);
          checkDeadlineNotifications();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          pushStatus.textContent = `無法訂閱推播：${msg}`;
        }
      });
    }

    setupPushNotifications();

    // ── Per-subsidy Deadline Reminders ────────────────────────────────────────
    const REMINDERS_KEY = 'subsidyReminders';
    const REMINDER_DAYS_DEFAULT = 7;
    const REMINDER_MIN_DAYS = 3;

    type ReminderEntry = {
      id: string;
      title: string;
      deadlineDate: string;
      daysBeforeToFire: number;
      scheduledAt: string;
    };

    function loadReminders(): ReminderEntry[] {
      try {
        const raw = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? '[]') as unknown[];
        if (!Array.isArray(raw)) return [];
        return raw.filter(
          (e): e is ReminderEntry =>
            e !== null &&
            typeof e === 'object' &&
            typeof (e as ReminderEntry).id === 'string' &&
            typeof (e as ReminderEntry).deadlineDate === 'string' &&
            typeof (e as ReminderEntry).daysBeforeToFire === 'number' &&
            Number.isFinite((e as ReminderEntry).daysBeforeToFire) &&
            (e as ReminderEntry).daysBeforeToFire > 0,
        );
      } catch { return []; }
    }

    function saveReminders(reminders: ReminderEntry[]): boolean {
      try {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
        return true;
      } catch { return false; /* storage blocked or quota exceeded */ }
    }

    function reminderHasEntry(id: string): boolean {
      return loadReminders().some(e => e.id === id);
    }

    function applyReminderBtnState(btn: HTMLButtonElement, active: boolean) {
      btn.classList.toggle('reminder-active', active);
      btn.setAttribute('aria-pressed', String(active));
      const title = btn.dataset.title ?? '';
      btn.setAttribute(
        'aria-label',
        active ? `取消截止提醒：${title}` : `設定截止提醒：${title}`,
      );
      btn.title = active ? '點擊取消提醒' : '設定截止提醒（瀏覽器通知）';
    }

    function showReminderMsg(btn: HTMLButtonElement, message: string) {
      // Remove any stale inline messages near this button
      btn.closest('.tracker-control')?.querySelectorAll('.reminder-denied-msg').forEach(el => el.remove());
      const msgEl = document.createElement('span');
      msgEl.className = 'reminder-denied-msg';
      msgEl.textContent = message;
      msgEl.setAttribute('role', 'alert');
      btn.insertAdjacentElement('afterend', msgEl);
      const dismiss = () => msgEl.remove();
      const timer = window.setTimeout(dismiss, 5000);
      msgEl.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
    }

    // Fire browser notifications for any due reminders; clear fired entries.
    function checkDeadlineReminders() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const reminders = loadReminders();
      if (reminders.length === 0) return;
      const toFire: ReminderEntry[] = [];
      const remaining: ReminderEntry[] = [];
      for (const entry of reminders) {
        const days = daysUntilDate(entry.deadlineDate);
        if (days === null) continue; // past deadline — discard (not added to remaining)
        if (days <= entry.daysBeforeToFire) {
          toFire.push(entry);
        } else {
          remaining.push(entry);
        }
      }
      // Always persist remaining (clears expired/fired entries from storage)
      if (remaining.length !== reminders.length) {
        saveReminders(remaining);
      }
      if (toFire.length > 0) {
        const items = toFire.map(e => {
          const d = daysUntilDate(e.deadlineDate);
          const when = d === 0 ? '今天截止' : d === 1 ? '明天截止' : `還有 ${d} 天`;
          return `${e.title}（${when}）`;
        });
        const body = items.length === 1
          ? `${items[0]} 申請截止日即將到來`
          : `${items.length} 項補助申請截止即將到來：${items.slice(0, 2).join('、')}${items.length > 2 ? '…' : ''}`;
        try {
          new Notification('⏰ 補助雷達截止提醒', {
            body,
            icon: '/subsidy-radar/favicon.svg',
            tag: 'subsidy-reminder-local',
          });
        } catch { /* Notification constructor can throw on some mobile browsers */ }
      }
    }

    function initReminderBtns() {
      document.querySelectorAll<HTMLButtonElement>('[data-reminder-btn]').forEach(btn => {
        const id = btn.dataset.id!;
        const deadline = btn.dataset.deadline!;

        // Grace period: disable new reminders if deadline < REMINDER_MIN_DAYS away or past,
        // but still allow cancelling an already-set reminder in that window.
        const daysLeft = daysUntilDate(deadline);
        const alreadySet = reminderHasEntry(id);
        // daysLeft === null means deadline has passed
        const isNearOrPast = daysLeft === null || daysLeft < REMINDER_MIN_DAYS;
        if (isNearOrPast && !alreadySet) {
          btn.disabled = true;
          btn.title = daysLeft === null
            ? '申請截止日已過，無法設定提醒'
            : '截止日過近（不足 3 天），無法設定提醒';
          return;
        }
        if (isNearOrPast && alreadySet) {
          // Near-deadline/past with existing reminder: show active state, allow cancel only
          applyReminderBtnState(btn, true);
          btn.addEventListener('click', () => {
            const updated = loadReminders().filter(e => e.id !== id);
            if (saveReminders(updated)) {
              applyReminderBtnState(btn, false);
              btn.disabled = true;
              btn.title = daysLeft === null
                ? '申請截止日已過，無法設定提醒'
                : '截止日過近（不足 3 天），無法設定提醒';
            } else {
              showReminderMsg(btn, '無法取消提醒（儲存失敗），請重新整理頁面後再試。');
            }
          });
          return;
        }

        applyReminderBtnState(btn, reminderHasEntry(id));

        btn.addEventListener('click', async () => {
          if (reminderHasEntry(id)) {
            const updated = loadReminders().filter(e => e.id !== id);
            if (saveReminders(updated)) {
              applyReminderBtnState(btn, false);
            } else {
              showReminderMsg(btn, '無法取消提醒（儲存失敗），請重新整理頁面後再試。');
            }
            return;
          }

          if (!('Notification' in window)) {
            showReminderMsg(btn, '此瀏覽器不支援通知功能。');
            return;
          }

          if (Notification.permission === 'denied') {
            showReminderMsg(btn, '通知已被封鎖，請在瀏覽器設定（網址列🔒）中允許通知後再試。');
            return;
          }

          let perm = Notification.permission as NotificationPermission;
          if (perm !== 'granted') {
            perm = await Notification.requestPermission();
          }

          if (perm !== 'granted') {
            showReminderMsg(
              btn,
              perm === 'denied'
                ? '通知已被封鎖，請在瀏覽器設定中允許通知。'
                : '未授予通知權限，無法設定提醒。',
            );
            return;
          }

          const title = btn.dataset.title ?? id;
          const existing = loadReminders();
          existing.push({
            id,
            title,
            deadlineDate: deadline,
            daysBeforeToFire: REMINDER_DAYS_DEFAULT,
            scheduledAt: new Date().toISOString(),
          });
          if (!saveReminders(existing)) {
            showReminderMsg(btn, '無法儲存提醒（瀏覽器儲存空間不足或已封鎖）。');
            return;
          }
          applyReminderBtnState(btn, true);
          // Check immediately in case the deadline is already within threshold
          checkDeadlineReminders();
        });
      });
    }

    initReminderBtns();
    // Also fire any pending reminders on page load if permission already granted
    checkDeadlineReminders();

    // ── Deadline Timeline Panel ───────────────────────────────────────────────
    (function initDeadlinePanel() {
      const COLLAPSE_LIMIT = 5;
      const panelSection = document.getElementById('deadlinePanelSection');
      const panelToggle  = document.getElementById('deadlinePanelToggle') as HTMLButtonElement | null;
      const panelBody    = document.getElementById('deadlinePanelBody');
      const timeline     = document.getElementById('deadlineTimeline');
      const showAllBtn   = document.getElementById('deadlineShowAll') as HTMLButtonElement | null;
      if (!panelSection || !panelToggle || !panelBody || !timeline || !showAllBtn) return;

      // Gather data from cards; exclude periodic via data-deadline-status attribute.
      type TimelineItem = { id: string; title: string; deadlineDate: string; days: number };
      const items: TimelineItem[] = [];

      cards.forEach(card => {
        const deadlineDate = card.dataset.deadline ?? '';
        if (!deadlineDate) return;
        if (card.dataset.deadlineStatus === 'periodic') return;
        const days = daysUntilDate(deadlineDate);
        if (days === null) return; // past or invalid
        const id    = card.dataset.id ?? '';
        if (!id) return;
        const title = card.querySelector('.card-title')?.textContent?.trim() ?? id;
        items.push({ id, title, deadlineDate, days });
      });

      // Sort ascending by days (soonest first)
      items.sort((a, b) => a.days - b.days);

      if (items.length === 0) return; // auto-hide
      panelSection.style.display = '';

      function colourClass(days: number): string {
        if (days <= 7)  return 'countdown-urgent';
        if (days <= 30) return 'countdown-soon';
        return 'countdown-ok';
      }
      function colourDot(days: number): string {
        if (days <= 7)  return '🔴';
        if (days <= 30) return '🟡';
        return '🟢';
      }
      function dayLabel(days: number): string {
        if (days === 0) return '今天截止';
        if (days === 1) return '明天截止';
        return `剩 ${days} 天`;
      }

      function renderItems(limit: number) {
        timeline.innerHTML = '';
        items.slice(0, limit).forEach(item => {
          const li   = document.createElement('li');
          li.className = 'deadline-timeline-item';

          const dot  = document.createElement('span');
          dot.className = 'dl-dot';
          dot.textContent = colourDot(item.days);

          const link = document.createElement('a');
          link.className = 'dl-title';
          link.setAttribute('href', `#${encodeURIComponent(item.id)}`);
          link.textContent = item.title;

          const badge = document.createElement('span');
          badge.className = `dl-badge countdown-badge ${colourClass(item.days)}`;
          badge.textContent = dayLabel(item.days);

          const date = document.createElement('span');
          date.className = 'dl-date';
          date.textContent = item.deadlineDate;
          date.setAttribute('aria-hidden', 'true'); // visually hidden on mobile; badge conveys same info

          li.append(dot, link, badge, date);
          timeline.appendChild(li);
        });
      }

      renderItems(COLLAPSE_LIMIT);
      showAllBtn.style.display = items.length > COLLAPSE_LIMIT ? '' : 'none';
      showAllBtn.textContent = `查看全部（${items.length} 項）`;

      showAllBtn.addEventListener('click', () => {
        renderItems(items.length);
        showAllBtn.style.display = 'none';
      });

      // Toggle visibility of panel body
      panelToggle.addEventListener('click', () => {
        const isOpen = panelBody.style.display !== 'none';
        panelBody.style.display = isOpen ? 'none' : '';
        panelToggle.textContent = isOpen ? '顯示' : '隱藏';
        panelToggle.setAttribute('aria-expanded', String(!isOpen));
      });
    })();

    // ── Keyboard navigation for subsidy cards ────────────────────────────────
    (function initCardKeyboardNav() {
      function getVisibleCards(): HTMLElement[] {
        // offsetParent === null for any element with display:none (inline or from CSS)
        return Array.from(
          document.querySelectorAll<HTMLElement>('.subsidy-card')
        ).filter(c => c.offsetParent !== null);
      }

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      document.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isCard = target.classList.contains('subsidy-card');

        // Arrow key navigation: only fire when focus is already on a card
        if (isCard && (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
          e.preventDefault();
          const visible = getVisibleCards();
          const idx = visible.indexOf(target);
          if (idx === -1) return;
          const next = (e.key === 'ArrowDown' || e.key === 'ArrowRight')
            ? visible[(idx + 1) % visible.length]
            : visible[(idx - 1 + visible.length) % visible.length];
          next.focus();
          next.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
          return;
        }

        // Enter / Space: activate the CTA link of the focused card
        if (isCard && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          const link = target.querySelector<HTMLAnchorElement>('a.card-link');
          if (link) link.click();
          return;
        }

        // Escape: blur the focused card and return focus to the grid container
        if (isCard && e.key === 'Escape') {
          e.preventDefault();
          target.blur();
          const grid = document.getElementById('subsidyGrid');
          if (grid) (grid as HTMLElement).focus();
          return;
        }
      });
    })();
    // ─────────────────────────────────────────────────────────────────────────

    // ── Comparison Panel ─────────────────────────────────────────────────────
    (function initComparisonPanel() {
      const COMPARE_KEY = 'subsidy-compare-selection';
      const MAX_COMPARE = 3;

      const bar        = document.getElementById('compareBar')!;
      const barLabel   = document.getElementById('compareCount')!;
      const openBtn    = document.getElementById('compareOpenBtn') as HTMLButtonElement;
      const clearBtn   = document.getElementById('compareClearBtn') as HTMLButtonElement;
      const overlay    = document.getElementById('compareOverlay')!;
      const closeBtn   = document.getElementById('compareCloseBtn') as HTMLButtonElement;
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.compare-checkbox');

      type CompareItem = {
        id: string;
        title: string;
        amount: string;
        difficulty: string;
        deadline: string;
        url: string;
        steps: string;
      };

      function loadSelection(): CompareItem[] {
        try {
          const raw = sessionStorage.getItem(COMPARE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return [];
          const seenIds = new Set<string>();
          const valid = parsed.filter((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const i = item as Record<string, unknown>;
            if (typeof i.id !== 'string' || !i.id) return false;
            if (seenIds.has(i.id)) return false;
            seenIds.add(i.id);
            return (
              typeof i.title === 'string' &&
              typeof i.amount === 'string' &&
              typeof i.difficulty === 'string' &&
              typeof i.deadline === 'string' &&
              typeof i.url === 'string' &&
              typeof i.steps === 'string'
            );
          }) as CompareItem[];
          return valid.slice(0, MAX_COMPARE);
        } catch { return []; }
      }

      function saveSelection(items: CompareItem[]) {
        try { sessionStorage.setItem(COMPARE_KEY, JSON.stringify(items)); } catch { /* blocked */ }
      }

      const difficultyText: Record<string, string> = {
        easy:   '🟢 簡單',
        medium: '🟡 中等',
        hard:   '🔴 困難',
      };

      function syncCheckboxes(selection: CompareItem[]) {
        const ids = new Set(selection.map(i => i.id));
        checkboxes.forEach(cb => {
          cb.checked = ids.has(cb.dataset.id ?? '');
        });
      }

      function updateBar(selection: CompareItem[]) {
        const n = selection.length;
        barLabel.textContent = String(n);
        bar.hidden = n < 2;
        openBtn.textContent = `比較已選補助（${n}）`;
      }

      let compareToastTimer: ReturnType<typeof setTimeout> | undefined;
      function showToast(msg: string) {
        const toast = document.getElementById('share-toast')!;
        if (compareToastTimer !== undefined) clearTimeout(compareToastTimer);
        toast.textContent = msg;
        toast.classList.add('visible');
        compareToastTimer = setTimeout(() => {
          toast.classList.remove('visible');
          compareToastTimer = undefined;
        }, 2500);
      }

      function renderPanel(selection: CompareItem[]) {
        for (let col = 0; col < MAX_COMPARE; col++) {
          const item = selection[col];
          const nameCell       = document.getElementById(`compare-name-${col}`)!;
          const amountCell     = document.getElementById(`compare-amount-${col}`)!;
          const difficultyCell = document.getElementById(`compare-difficulty-${col}`)!;
          const deadlineCell   = document.getElementById(`compare-deadline-${col}`)!;
          const stepsCell      = document.getElementById(`compare-steps-${col}`)!;
          const ctaCell        = document.getElementById(`compare-cta-${col}`)!;

          if (item) {
            nameCell.textContent       = item.title;
            amountCell.textContent     = item.amount;
            difficultyCell.textContent = difficultyText[item.difficulty] ?? item.difficulty;
            deadlineCell.textContent   = item.deadline;
            stepsCell.textContent      = Number(item.steps) > 0 ? `${item.steps} 步驟` : '—';
            ctaCell.textContent = '';
            if (item.url && /^https?:\/\//.test(item.url)) {
              const link = document.createElement('a');
              link.href = item.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.className = 'compare-cta-link';
              link.textContent = '立即申請 →';
              ctaCell.appendChild(link);
            } else {
              ctaCell.textContent = '—';
            }
          } else {
            nameCell.textContent       = '';
            amountCell.textContent     = '';
            difficultyCell.textContent = '';
            deadlineCell.textContent   = '';
            stepsCell.textContent      = '';
            ctaCell.innerHTML          = '';
          }
        }
      }

      let overflowLocked = false;

      function openPanel() {
        const selection = loadSelection();
        renderPanel(selection);
        overlay.hidden = false;
        if (!overflowLocked) {
          document.body.style.overflow = 'hidden';
          overflowLocked = true;
        }
        closeBtn.focus();
      }

      function closePanel() {
        overlay.hidden = true;
        if (overflowLocked) {
          document.body.style.overflow = '';
          overflowLocked = false;
        }
        // Only focus openBtn if it's visible (bar is shown)
        if (!bar.hidden) {
          openBtn.focus();
        }
      }

      function getFocusable(): HTMLElement[] {
        return Array.from(
          overlay.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.closest('[hidden]') && el.offsetParent !== null);
      }

      overlay.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const focusable = getFocusable();
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      });

      // Initialise from sessionStorage on page load, filtering out stale IDs
      function reconcileSelection(raw: CompareItem[]): CompareItem[] {
        const validIds = new Set(Array.from(checkboxes).map(cb => cb.dataset.id ?? '').filter(Boolean));
        return raw.filter(item => validIds.has(item.id));
      }

      let selection = reconcileSelection(loadSelection());
      syncCheckboxes(selection);
      updateBar(selection);

      // Checkbox change handler
      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          selection = loadSelection();
          const id    = cb.dataset.id ?? '';
          const idx   = selection.findIndex(i => i.id === id);

          if (cb.checked) {
            if (selection.length >= MAX_COMPARE) {
              cb.checked = false;
              showToast('最多比較 3 項');
              return;
            }
            selection.push({
              id,
              title:      cb.dataset.title    ?? '',
              amount:     cb.dataset.amount   ?? '',
              difficulty: cb.dataset.difficulty ?? 'medium',
              deadline:   cb.dataset.deadline ?? '',
              url:        cb.dataset.url      ?? '',
              steps:      cb.dataset.steps    ?? '0',
            });
          } else {
            if (idx !== -1) selection.splice(idx, 1);
          }

          saveSelection(selection);
          updateBar(selection);
        });
      });

      openBtn.addEventListener('click', openPanel);

      clearBtn.addEventListener('click', () => {
        if (!overlay.hidden) closePanel();
        selection = [];
        saveSelection(selection);
        syncCheckboxes(selection);
        updateBar(selection);
      });

      closeBtn.addEventListener('click', closePanel);

      // Close on backdrop click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePanel();
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) closePanel();
      });
    })();
    // ─────────────────────────────────────────────────────────────────────────

    // Expose scoring utilities for browser-level E2E tests (dev builds only)
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__subsidyRadar = { computeMatchScore, getScoreTier };
    }
 
export {};
