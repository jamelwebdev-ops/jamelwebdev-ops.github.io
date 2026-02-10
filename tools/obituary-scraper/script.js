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

// CORS proxies
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

async function fetchWithProxy(url, useProxy) {
    if (!useProxy) {
        const response = await fetch(url);
        return await response.text();
    }

    for (const proxy of CORS_PROXIES) {
        try {
            const response = await fetch(proxy + encodeURIComponent(url));
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            continue;
        }
    }
    throw new Error('All proxies failed');
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

// Dynamically detect pagination pattern from the page
function detectPaginationPattern(doc, currentUrl) {
    const baseUrl = new URL(currentUrl);
    const patterns = [];

    // 1. Look for pagination containers and analyze links
    const paginationContainers = doc.querySelectorAll(
        '.pagination, .pager, .paging, [class*="pagination"], [class*="pager"], ' +
        '[class*="paging"], nav[aria-label*="pagination"], .page-numbers, .pages, ' +
        '[class*="page-nav"], [class*="pagenav"]'
    );

    // 2. Find all links that look like page numbers
    const pageLinks = new Set();
    const allLinks = doc.querySelectorAll('a[href]');

    allLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();

        // Skip non-pagination links
        if (href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            return;
        }

        // Check if link text is a number (page number)
        if (/^\d+$/.test(text)) {
            const pageNum = parseInt(text);
            if (pageNum >= 1 && pageNum <= 500) {
                pageLinks.add({ href, pageNum, element: link });
            }
        }
    });

    // 3. Analyze the page links to find the URL pattern
    const linkArray = Array.from(pageLinks);
    if (linkArray.length >= 2) {
        // Sort by page number
        linkArray.sort((a, b) => a.pageNum - b.pageNum);

        // Find the pattern by comparing URLs
        for (const linkInfo of linkArray) {
            const href = linkInfo.href;
            const pageNum = linkInfo.pageNum;

            // Try to extract the pattern
            const fullUrl = resolveUrl(href, baseUrl);
            if (fullUrl) {
                // Check various patterns
                const patternChecks = [
                    { regex: /([?&]page=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /([?&]p=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /([?&]pg=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /([?&]pagenum=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /([?&]paged=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /([?&]offset=)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(\/page\/)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(\/p\/)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(\/pg\/)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(\/pages\/)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(-page-)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(_page_)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(\/page)(\d+)/, replacement: '$1{PAGE}' },
                    { regex: /(page-)(\d+)/, replacement: '$1{PAGE}' },
                ];

                for (const check of patternChecks) {
                    if (check.regex.test(fullUrl)) {
                        const pattern = fullUrl.replace(check.regex, check.replacement);
                        // Verify this pattern makes sense
                        const testUrl = pattern.replace('{PAGE}', pageNum.toString());
                        if (testUrl === fullUrl) {
                            patterns.push({
                                pattern: pattern,
                                foundPages: linkArray.map(l => l.pageNum),
                                maxPage: Math.max(...linkArray.map(l => l.pageNum)),
                                confidence: 'high'
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    // 4. Look for "Next" button/link with href
    const nextSelectors = [
        'a.next', 'a.next-page', 'a[rel="next"]',
        '.pagination a.next', '.pagination .next a',
        '.pager a.next', '.pager .next a',
        'a[aria-label="Next"]', 'a[aria-label="Next page"]',
        '.nav-links a.next', '.page-numbers.next',
        'li.next a', 'li.pagination-next a',
        'a[title="Next"]', 'a[title="Next Page"]',
        '.pagination-next a', 'a.pagination__next',
        '[class*="next"] a', 'a[class*="next"]',
    ];

    for (const selector of nextSelectors) {
        try {
            const nextLink = doc.querySelector(selector);
            if (nextLink) {
                const href = nextLink.getAttribute('href');
                if (href && href !== '#' && !href.startsWith('javascript:')) {
                    const fullUrl = resolveUrl(href, baseUrl);
                    if (fullUrl) {
                        patterns.push({
                            type: 'next-link',
                            nextUrl: fullUrl,
                            confidence: 'medium'
                        });
                    }
                }
            }
        } catch (e) {
            continue;
        }
    }

    // 5. Look for links with "next" text
    allLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
        const title = (link.getAttribute('title') || '').toLowerCase();

        if (
            text === 'next' || text === 'next page' || text === '»' ||
            text === '>' || text === '>>' || text === '›' ||
            text === 'next →' || text === 'next >' || text === 'older' ||
            ariaLabel.includes('next') || title.includes('next')
        ) {
            const href = link.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('javascript:')) {
                const fullUrl = resolveUrl(href, baseUrl);
                if (fullUrl) {
                    patterns.push({
                        type: 'next-link',
                        nextUrl: fullUrl,
                        confidence: 'medium'
                    });
                }
            }
        }
    });

    // 6. Try to detect pattern from current URL if it has page number
    const urlPatternChecks = [
        { regex: /([?&]page=)(\d+)/i, replacement: '$1{PAGE}' },
        { regex: /([?&]p=)(\d+)/i, replacement: '$1{PAGE}' },
        { regex: /(\/page\/)(\d+)/i, replacement: '$1{PAGE}' },
        { regex: /(\/page)(\d+)/i, replacement: '$1{PAGE}' },
    ];

    for (const check of urlPatternChecks) {
        if (check.regex.test(currentUrl)) {
            const pattern = currentUrl.replace(check.regex, check.replacement);
            const match = currentUrl.match(check.regex);
            if (match) {
                const currentPage = parseInt(match[2]);
                patterns.push({
                    pattern: pattern,
                    currentPage: currentPage,
                    confidence: 'high'
                });
            }
        }
    }

    return patterns;
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

// Generate URL for a specific page number
function generatePageUrl(pattern, pageNum) {
    return pattern.replace('{PAGE}', pageNum.toString());
}

// Analyze a single page for obituaries
function analyzePageObituaries(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let obituaryElements = [];

    const allSelectors = [
        '.obituary-item', '.obit-item', '.obituary-card', '.obit-card',
        '.obituary-entry', '.obit-entry', '.obituary-listing', '.obit-listing',
        '[data-obituary]', '.tribute-item',
        '.obituary', '.obit', '.death-notice', '.memorial', '.tribute',
        '[class*="obituary"]', '[class*="obit"]', '[class*="memorial"]',
        '[id*="obituary"]', '[id*="obit"]',
    ];

    const allMatches = new Set();
    for (const selector of allSelectors) {
        try {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => allMatches.add(el));
        } catch (e) {}
    }

    obituaryElements = Array.from(allMatches);

    if (obituaryElements.length === 0) {
        const containers = doc.querySelectorAll('article, li, .card, .item, div');
        containers.forEach(el => {
            const text = el.textContent || '';
            if (isLikelyObituary(text) && text.length > 50 && text.length < 5000) {
                allMatches.add(el);
            }
        });
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

// Main scanning function with dynamic pagination detection
async function scanUrlWithDynamicPagination(url, maxPages, useProxy, updateCallback) {
    const monthlyData = {};
    const visitedUrls = new Set();
    let totalElements = 0;
    let pageCount = 0;
    let consecutiveEmpty = 0;
    let detectedPattern = null;
    let currentPage = 1;

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
                updateCallback(`Scanning page ${pageCount}...`);
            }

            const html = await fetchWithProxy(currentUrl, useProxy);
            const { doc, obituaries, count } = analyzePageObituaries(html);
            totalElements += count;

            // On first page, detect pagination pattern
            if (pageCount === 1) {
                const patterns = detectPaginationPattern(doc, currentUrl);
                if (patterns.length > 0) {
                    // Prefer pattern-based pagination over next-link
                    const patternBased = patterns.find(p => p.pattern);
                    const nextLinkBased = patterns.find(p => p.type === 'next-link');

                    if (patternBased) {
                        detectedPattern = patternBased;
                        currentPage = patternBased.currentPage || 1;
                    } else if (nextLinkBased) {
                        detectedPattern = nextLinkBased;
                    }
                }
            }

            if (count === 0) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= 3) {
                    break;
                }
            } else {
                consecutiveEmpty = 0;
            }

            // Process obituaries
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

            // Stop if most data is older than target
            if (count > 0 && oldDataCount > count * 0.8) {
                break;
            }

            // Determine next URL
            let nextUrl = null;

            // Re-detect pagination on each page for next-link type
            const currentPatterns = detectPaginationPattern(doc, currentUrl);

            // Method 1: Use detected pattern to generate next page URL
            if (detectedPattern && detectedPattern.pattern) {
                currentPage++;
                nextUrl = generatePageUrl(detectedPattern.pattern, currentPage);

                // Check if we've exceeded known max page
                if (detectedPattern.maxPage && currentPage > detectedPattern.maxPage + 5) {
                    // Allow a few extra pages beyond detected max
                    nextUrl = null;
                }
            }
            // Method 2: Use next-link from current page
            else {
                const nextLinkPattern = currentPatterns.find(p => p.type === 'next-link');
                if (nextLinkPattern) {
                    nextUrl = nextLinkPattern.nextUrl;
                }
            }

            // Validate next URL
            if (nextUrl) {
                try {
                    const currentDomain = new URL(currentUrl).hostname;
                    const nextDomain = new URL(nextUrl).hostname;
                    if (currentDomain === nextDomain && !visitedUrls.has(nextUrl)) {
                        currentUrl = nextUrl;
                    } else {
                        currentUrl = null;
                    }
                } catch (e) {
                    currentUrl = null;
                }
            } else {
                currentUrl = null;
            }

            if (currentUrl) {
                await sleep(400);
            }
        } catch (error) {
            console.error(`Error on page ${pageCount}:`, error);
            consecutiveEmpty++;
            if (consecutiveEmpty >= 3) {
                break;
            }
            // Try next page if using pattern
            if (detectedPattern && detectedPattern.pattern) {
                currentPage++;
                currentUrl = generatePageUrl(detectedPattern.pattern, currentPage);
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
