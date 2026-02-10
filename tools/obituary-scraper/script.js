// Month names for display
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Get current month and 3 previous months
function getTargetMonths() {
    const now = new Date();
    const months = [];

    for (let i = 0; i < 4; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: date.getMonth(),
            year: date.getFullYear(),
            key: `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
        });
    }

    return months;
}

// Keywords that indicate obituary content
const OBITUARY_KEYWORDS = [
    /obituar/gi,
    /passed\s*away/gi,
    /in\s*loving\s*memory/gi,
    /survived\s*by/gi,
    /preceded\s*in\s*death/gi,
];

// Store results globally for export
let scanResults = [];

// ScrapingBee API key (same as link checker)
const SCRAPINGBEE_API_KEY = 'QU0X0P0UVJBA1CWVT02SNJU58KEIX1VD22GCINS2W6T2F4GTOIHPH57LZRA4E8V6L9BZDIO72IXOX7SW';

async function fetchWithProxy(url, useProxy) {
    if (!useProxy) {
        const response = await fetch(url);
        return await response.text();
    }

    // Use ScrapingBee with JS rendering to get dynamically loaded content
    const apiUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(url)}&render_js=true&wait=3000`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ScrapingBee error ${response.status}: ${errorText}`);
    }

    return await response.text();
}

function parseMonth(monthStr) {
    const months = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
    };
    return months[monthStr.toLowerCase().replace('.', '')];
}

function extractDate(text) {
    // Try pattern: January 15, 2024
    let match = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+(\d{4})\b/i);
    if (match) {
        const month = parseMonth(match[1]);
        const year = parseInt(match[2]);
        if (month !== undefined && year >= 2000 && year <= 2030) {
            return { month, year };
        }
    }

    // Try pattern: 15 January 2024
    match = text.match(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+(\d{4})\b/i);
    if (match) {
        const month = parseMonth(match[1]);
        const year = parseInt(match[2]);
        if (month !== undefined && year >= 2000 && year <= 2030) {
            return { month, year };
        }
    }

    // Try pattern: MM/DD/YYYY
    match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (match) {
        const month = parseInt(match[1]) - 1;
        const year = parseInt(match[3]);
        if (month >= 0 && month <= 11 && year >= 2000 && year <= 2030) {
            return { month, year };
        }
    }

    // Try pattern: YYYY-MM-DD
    match = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        if (month >= 0 && month <= 11 && year >= 2000 && year <= 2030) {
            return { month, year };
        }
    }

    return null;
}

function isLikelyObituary(text) {
    let matchCount = 0;
    for (const pattern of OBITUARY_KEYWORDS) {
        if (pattern.test(text)) {
            matchCount++;
        }
        pattern.lastIndex = 0;
    }
    return matchCount >= 1;
}

// Find the next page URL from a rendered page — tries every method on every page
function findNextPageUrl(doc, currentUrl, currentPageNum, visitedUrls) {
    const baseUrl = new URL(currentUrl);
    const allLinks = doc.querySelectorAll('a[href]');

    // Helper: resolve and validate a candidate URL
    function validCandidate(href) {
        if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) return null;
        const full = resolveUrl(href, baseUrl);
        if (!full) return null;
        try {
            if (new URL(full).hostname !== baseUrl.hostname) return null;
        } catch { return null; }
        if (visitedUrls.has(full)) return null;
        return full;
    }

    // ── METHOD 1: Explicit "Next" link/button (most reliable) ──
    // CSS selectors for next buttons
    const nextSelectors = [
        'a.next', 'a.next-page', 'a[rel="next"]',
        '.pagination a.next', '.pagination .next a',
        '.pager a.next', '.pager .next a',
        'a[aria-label="Next"]', 'a[aria-label="Next page"]',
        '.nav-links a.next', '.page-numbers.next',
        'li.next a', 'li.pagination-next a',
        'a[title="Next"]', 'a[title="Next Page"]',
        '.pagination-next a', 'a.pagination__next',
        'a[class*="next-page"]', 'a[class*="nextpage"]',
        // Essential Grid
        '.esg-pagination .esg-next a', '[class*="esg"] a[class*="next"]',
        // WordPress
        '.nav-previous a', '.nav-links .next a',
        // Generic
        'a[class*="next"]',
    ];

    for (const selector of nextSelectors) {
        try {
            const el = doc.querySelector(selector);
            if (el) {
                const url = validCandidate(el.getAttribute('href'));
                if (url) return { nextUrl: url, method: 'next-selector' };
            }
        } catch {}
    }

    // Text-based next link detection
    const nextTextPatterns = [
        'next', 'next page', '»', '>', '>>', '›',
        'next →', 'next >', 'older', 'older entries',
        'load more', 'show more', 'view more',
    ];

    for (const link of allLinks) {
        const text = (link.textContent || '').trim().toLowerCase();
        const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
        const title = (link.getAttribute('title') || '').toLowerCase();

        const isNext = nextTextPatterns.includes(text) ||
            ariaLabel.includes('next') || title.includes('next') ||
            ariaLabel.includes('older') || title.includes('older');

        if (isNext) {
            const url = validCandidate(link.getAttribute('href'));
            if (url) return { nextUrl: url, method: 'next-text' };
        }
    }

    // ── METHOD 2: Numbered page links — find (currentPageNum + 1) ──
    const nextPageNum = currentPageNum + 1;
    for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        if (text === String(nextPageNum)) {
            const url = validCandidate(link.getAttribute('href'));
            if (url) return { nextUrl: url, method: 'page-number' };
        }
    }

    // ── METHOD 3: URL pattern detection from page links ──
    const patternChecks = [
        /([?&]page=)(\d+)/, /([?&]paged=)(\d+)/, /([?&]p=)(\d+)/,
        /([?&]pg=)(\d+)/, /([?&]pagenum=)(\d+)/, /([?&]offset=)(\d+)/,
        /(\/page\/)(\d+)/, /(\/p\/)(\d+)/, /(\/pg\/)(\d+)/,
        /(\/pages\/)(\d+)/, /(-page-)(\d+)/, /(_page_)(\d+)/,
        /(\/page)(\d+)/, /(page-)(\d+)/,
    ];

    for (const link of allLinks) {
        const href = link.getAttribute('href');
        const full = resolveUrl(href, baseUrl);
        if (!full) continue;

        for (const regex of patternChecks) {
            const match = full.match(regex);
            if (match) {
                const foundNum = parseInt(match[2]);
                if (foundNum === nextPageNum) {
                    const url = validCandidate(href);
                    if (url) return { nextUrl: url, method: 'pattern-match' };
                }
            }
        }
    }

    // ── METHOD 4: "Load More" buttons with data attributes ──
    const loadMoreSelectors = [
        'button[class*="load-more"]', 'a[class*="load-more"]',
        'button[class*="loadmore"]', 'a[class*="loadmore"]',
        '[data-next-page]', '[data-page]', '[data-load-more]',
        '.load-more a', '.loadmore a',
        // Essential Grid load more
        '.esg-loadmore', '.esg-pagination a',
    ];

    for (const selector of loadMoreSelectors) {
        try {
            const el = doc.querySelector(selector);
            if (el) {
                // Check href first
                const href = el.getAttribute('href');
                const url = validCandidate(href);
                if (url) return { nextUrl: url, method: 'load-more' };

                // Check data attributes for URL
                const dataUrl = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-next-page');
                if (dataUrl) {
                    const url2 = validCandidate(dataUrl);
                    if (url2) return { nextUrl: url2, method: 'load-more-data' };
                }
            }
        } catch {}
    }

    // ── METHOD 5: Brute-force common WordPress/CMS patterns ──
    const cleanUrl = currentUrl.replace(/\/+$/, ''); // strip trailing slash
    const bruteForceUrls = [
        // WordPress /page/N/
        cleanUrl.replace(/\/page\/\d+\/?$/, '') + `/page/${nextPageNum}/`,
        cleanUrl + `/page/${nextPageNum}/`,
        // ?paged=N (WordPress)
        (() => {
            const u = new URL(currentUrl);
            u.searchParams.set('paged', nextPageNum);
            return u.href;
        })(),
        // ?page=N
        (() => {
            const u = new URL(currentUrl);
            u.searchParams.set('page', nextPageNum);
            return u.href;
        })(),
    ];

    // Deduplicate and filter visited
    const seen = new Set();
    for (const url of bruteForceUrls) {
        if (seen.has(url) || visitedUrls.has(url)) continue;
        seen.add(url);
        // Only return brute force if it's different from the current URL
        if (url !== currentUrl) {
            return { nextUrl: url, method: 'brute-force' };
        }
    }

    return null;
}

function resolveUrl(href, baseUrl) {
    try {
        if (!href) return null;
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return href;
        }
        if (href.startsWith('//')) {
            return baseUrl.protocol + href;
        }
        if (href.startsWith('/')) {
            return baseUrl.origin + href;
        }
        return new URL(href, baseUrl.href).href;
    } catch (e) {
        return null;
    }
}

// Analyze a single page for obituaries
function analyzePageObituaries(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let obituaryElements = [];

    // Tier 1: Explicit obituary selectors
    const tier1Selectors = [
        '.obituary-item', '.obit-item', '.obituary-card', '.obit-card',
        '.obituary-entry', '.obit-entry', '.obituary-listing', '.obit-listing',
        '[data-obituary]', '.tribute-item', '.tribute-card',
        '.obituary', '.obit', '.death-notice', '.memorial', '.tribute',
        '[class*="obituary"]', '[class*="obit"]', '[class*="memorial"]',
        '[id*="obituary"]', '[id*="obit"]',
    ];

    // Tier 2: Common funeral home platform selectors
    const tier2Selectors = [
        // Essential Grid (WordPress plugin - common on funeral sites)
        '.esg-entry', '.esg-media-cover-wrapper', '[class*="esg-entry"]',
        '.eg-post-entries .esg-overflowtrick',
        // FrontRunner Professional
        '.fr-obit', '.fr-tribute', '[class*="fr-obit"]',
        '.obituary-list-item', '.obit-list-item',
        // Tukios
        '.tukios-obit', '[class*="tukios"]',
        // FuneralOne / Batesville
        '.tribute-listing', '.tribute_item', '[class*="tribute"]',
        // Frazer Consultants
        '.frazer-obit', '[class*="frazer"]',
        // Common CMS patterns
        '.post-item', '.entry-item', '.listing-item',
        '.person-card', '.person-item', '.people-item',
        // WordPress blog-style
        'article.post', 'article[class*="post"]',
    ];

    const allMatches = new Set();

    // Try tier 1 first
    for (const selector of tier1Selectors) {
        try {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => allMatches.add(el));
        } catch (e) {}
    }

    // If tier 1 found nothing, try tier 2
    if (allMatches.size === 0) {
        for (const selector of tier2Selectors) {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(el => allMatches.add(el));
            } catch (e) {}
        }
    }

    obituaryElements = Array.from(allMatches);

    // Tier 3: Fallback — look for repeating card/item patterns with person names and dates
    if (obituaryElements.length === 0) {
        // First try: items containing obituary keywords
        const containers = doc.querySelectorAll('article, li, .card, .item, div');
        containers.forEach(el => {
            const text = el.textContent || '';
            if (isLikelyObituary(text) && text.length > 50 && text.length < 5000) {
                allMatches.add(el);
            }
        });

        // Second try: items with person name + date patterns (listing pages)
        if (allMatches.size === 0) {
            const DATE_PATTERN = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i;
            const NAME_PATTERN = /^[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+/;

            // Find repeating sibling elements that share a common parent
            const candidateParents = doc.querySelectorAll('ul, ol, .grid, .list, .entries, .results, [class*="grid"], [class*="list"], [class*="entries"], [class*="results"], main, .content, #content');

            candidateParents.forEach(parent => {
                const children = Array.from(parent.children);
                if (children.length < 2) return;

                // Check if multiple children have dates and look like person entries
                let matchCount = 0;
                const matchingChildren = [];

                children.forEach(child => {
                    const text = child.textContent || '';
                    if (text.length > 10 && text.length < 3000 && DATE_PATTERN.test(text)) {
                        matchCount++;
                        matchingChildren.push(child);
                    }
                });

                // If at least 2 siblings have dates, treat them as obituary entries
                if (matchCount >= 2) {
                    matchingChildren.forEach(el => allMatches.add(el));
                }
            });
        }

        obituaryElements = Array.from(allMatches);
    }

    obituaryElements = obituaryElements.filter(el => {
        for (const other of obituaryElements) {
            if (other !== el && el.contains(other)) {
                return false;
            }
        }
        return true;
    });

    const obituaries = [];
    obituaryElements.forEach(el => {
        const text = el.textContent || '';
        const date = extractDate(text);
        obituaries.push({ date });
    });

    return { doc, obituaries, count: obituaryElements.length };
}

// Main scanning function — re-detects pagination on every page
async function scanUrlWithDynamicPagination(url, maxPages, useProxy, updateCallback) {
    const monthlyData = {};
    const visitedUrls = new Set();
    let totalElements = 0;
    let pageCount = 0;
    let consecutiveEmpty = 0;
    let currentPageNum = 1;
    let lastMethod = '';

    const targetMonths = getTargetMonths();
    const oldestTargetMonth = targetMonths[targetMonths.length - 1];
    const oldestDate = new Date(oldestTargetMonth.year, oldestTargetMonth.month, 1);

    let currentUrl = url;

    while (currentUrl && pageCount < maxPages) {
        if (visitedUrls.has(currentUrl)) {
            break;
        }
        visitedUrls.add(currentUrl);
        pageCount++;

        try {
            if (updateCallback) {
                const methodNote = lastMethod ? ` (via ${lastMethod})` : '';
                updateCallback(`Scanning page ${pageCount}${methodNote}...`);
            }

            const html = await fetchWithProxy(currentUrl, useProxy);
            const { doc, obituaries, count } = analyzePageObituaries(html);
            totalElements += count;

            if (count === 0) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= 2) {
                    break; // Stop after 2 consecutive empty pages
                }
            } else {
                consecutiveEmpty = 0;
            }

            // Process obituaries into monthly buckets
            let oldDataCount = 0;
            obituaries.forEach(obit => {
                if (obit.date) {
                    const key = `${obit.date.year}-${String(obit.date.month).padStart(2, '0')}`;
                    const obituaryDate = new Date(obit.date.year, obit.date.month, 1);

                    if (obituaryDate < oldestDate) {
                        oldDataCount++;
                    }

                    if (!monthlyData[key]) {
                        monthlyData[key] = {
                            year: obit.date.year,
                            month: obit.date.month,
                            count: 0
                        };
                    }
                    monthlyData[key].count++;
                }
            });

            // Stop if most data is older than our target range
            if (count > 0 && oldDataCount > count * 0.8) {
                break;
            }

            // ── Find next page — re-detect on EVERY page ──
            const result = findNextPageUrl(doc, currentUrl, currentPageNum, visitedUrls);

            if (result) {
                currentUrl = result.nextUrl;
                lastMethod = result.method;
                currentPageNum++;
                await sleep(500);
            } else {
                currentUrl = null;
            }

        } catch (error) {
            console.error(`Error on page ${pageCount}:`, error);
            consecutiveEmpty++;
            if (consecutiveEmpty >= 2) {
                break;
            }
            // Try brute-force next page on error
            currentPageNum++;
            const cleanUrl = url.replace(/\/+$/, '');
            const tryUrl = cleanUrl + `/page/${currentPageNum}/`;
            if (!visitedUrls.has(tryUrl)) {
                currentUrl = tryUrl;
                lastMethod = 'error-recovery';
                await sleep(500);
            } else {
                break;
            }
        }
    }

    const filteredMonths = targetMonths.map(target => {
        const existing = monthlyData[target.key];
        return existing || { year: target.year, month: target.month, count: 0 };
    });

    return {
        totalCount: filteredMonths.reduce((sum, m) => sum + m.count, 0),
        monthlyBreakdown: filteredMonths,
        elementsFound: totalElements,
        pagesScanned: pageCount
    };
}

async function scanUrl(urlInput, maxPages, useProxy, updateCallback) {
    try {
        new URL(urlInput);
        const analysis = await scanUrlWithDynamicPagination(urlInput, maxPages, useProxy, updateCallback);

        return {
            url: urlInput,
            status: 'success',
            totalCount: analysis.totalCount,
            monthlyBreakdown: analysis.monthlyBreakdown,
            elementsFound: analysis.elementsFound,
            pagesScanned: analysis.pagesScanned
        };
    } catch (error) {
        return {
            url: urlInput,
            status: 'error',
            error: error.message,
            totalCount: 0,
            monthlyBreakdown: [],
            pagesScanned: 0
        };
    }
}

function renderWebsiteCard(result) {
    const card = document.createElement('div');
    card.className = 'website-card';

    const maxCount = result.monthlyBreakdown.length > 0
        ? Math.max(...result.monthlyBreakdown.map(m => m.count))
        : 0;

    let content = `
        <div class="website-header">
            <span class="website-url">${escapeHtml(result.url)}</span>
            <span class="website-status ${result.status === 'success' ? 'status-success' : 'status-error'}">
                ${result.status === 'success' ? '✓ Success' : '✗ Error'}
            </span>
        </div>
    `;

    if (result.status === 'error') {
        content += `<div class="error-message">Error: ${escapeHtml(result.error)}</div>`;
    } else {
        const monthsWithData = result.monthlyBreakdown.filter(m => m.count > 0).length;

        content += `
            <div class="website-summary">
                <div class="summary-stat">
                    <div class="number">${result.totalCount}</div>
                    <div class="label">Total (4 Months)</div>
                </div>
                <div class="summary-stat">
                    <div class="number">${result.pagesScanned || 1}</div>
                    <div class="label">Pages Scanned</div>
                </div>
                <div class="summary-stat">
                    <div class="number">${result.elementsFound}</div>
                    <div class="label">Obituaries Found</div>
                </div>
                <div class="summary-stat">
                    <div class="number">${monthsWithData}</div>
                    <div class="label">Months with Data</div>
                </div>
            </div>
            <div class="monthly-table-container">
                <table class="monthly-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Year</th>
                            <th>Obituary Count</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const month of result.monthlyBreakdown) {
            const barWidth = maxCount > 0 ? (month.count / maxCount) * 100 : 0;
            const monthName = MONTH_NAMES[month.month];
            const isCurrentMonth = month.month === new Date().getMonth() && month.year === new Date().getFullYear();

            content += `
                <tr class="${isCurrentMonth ? 'current-month' : ''}">
                    <td>${monthName}${isCurrentMonth ? ' <span class="current-tag">Current</span>' : ''}</td>
                    <td>${month.year}</td>
                    <td class="count-cell">
                        ${month.count}
                        <span class="count-bar" style="width: ${barWidth}px;"></span>
                    </td>
                </tr>
            `;
        }

        content += `
                    </tbody>
                </table>
            </div>
        `;
    }

    card.innerHTML = content;
    return card;
}

function renderPlaceholderCard(url) {
    const card = document.createElement('div');
    card.className = 'website-card';

    card.innerHTML = `
        <div class="website-header">
            <span class="website-url">${escapeHtml(url)}</span>
            <span class="website-status status-pending">
                ⏳ Scanning...
            </span>
        </div>
        <div class="scanning-message">
            <span class="scan-status">Starting scan...</span>
        </div>
    `;
    return card;
}

async function startScan() {
    const urlsInput = document.getElementById('urls').value.trim();
    const useProxy = document.getElementById('useProxy').checked;
    const maxPages = parseInt(document.getElementById('maxPages').value) || 50;

    if (!urlsInput) {
        alert('Please enter at least one URL');
        return;
    }

    const urls = urlsInput
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0)
        .map(url => {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return 'https://' + url;
            }
            return url;
        });

    if (urls.length === 0) {
        alert('No valid URLs found');
        return;
    }

    const scanBtn = document.getElementById('scanBtn');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const results = document.getElementById('results');
    const websiteResults = document.getElementById('websiteResults');

    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    progress.classList.remove('hidden');
    results.classList.remove('hidden');
    websiteResults.innerHTML = '';
    scanResults = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        progressText.textContent = `Website ${i + 1} / ${urls.length}`;
        progressFill.style.width = `${((i + 1) / urls.length) * 100}%`;

        const placeholder = renderPlaceholderCard(url);
        websiteResults.appendChild(placeholder);

        const updateCallback = (message) => {
            const statusEl = placeholder.querySelector('.scan-status');
            if (statusEl) {
                statusEl.textContent = message;
            }
        };

        const result = await scanUrl(url, maxPages, useProxy, updateCallback);
        scanResults.push(result);

        const resultCard = renderWebsiteCard(result);
        placeholder.replaceWith(resultCard);

        if (i < urls.length - 1) {
            await sleep(500);
        }
    }

    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan URLs';
}

function exportResults() {
    if (scanResults.length === 0) {
        alert('No results to export');
        return;
    }

    const rows = [['Website', 'Status', 'Pages Scanned', 'Month', 'Year', 'Obituary Count']];

    for (const result of scanResults) {
        if (result.status === 'error') {
            rows.push([result.url, 'Error: ' + result.error, '0', '', '', '0']);
        } else if (result.monthlyBreakdown.length === 0) {
            rows.push([result.url, 'Success', result.pagesScanned || 1, 'No data', '', '0']);
        } else {
            for (const month of result.monthlyBreakdown) {
                const monthName = MONTH_NAMES[month.month];
                rows.push([result.url, 'Success', result.pagesScanned || 1, monthName, month.year, month.count]);
            }
        }
    }

    const csvContent = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `obituary-monthly-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
