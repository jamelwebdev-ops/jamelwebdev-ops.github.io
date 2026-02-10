document.addEventListener('DOMContentLoaded', () => {
    const urlsTextarea = document.getElementById('urls');
    const strategySelect = document.getElementById('strategy');
    const apiKeyInput = document.getElementById('apiKey');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsGrid = document.getElementById('resultsGrid');
    const exportBtn = document.getElementById('exportBtn');

    let results = [];

    analyzeBtn.addEventListener('click', startAnalysis);
    exportBtn.addEventListener('click', exportToCSV);

    async function startAnalysis() {
        const urls = urlsTextarea.value
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
            alert('Please enter at least one URL');
            return;
        }

        const strategy = strategySelect.value;
        const apiKey = apiKeyInput.value.trim();

        // Reset UI
        results = [];
        resultsGrid.innerHTML = '';
        resultsHeader.classList.add('hidden');
        progressSection.classList.remove('hidden');
        progressFill.style.width = '0%';

        // Disable button
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';
        analyzeBtn.querySelector('.btn-loader').classList.remove('hidden');

        // Process URLs sequentially to avoid rate limiting
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            progressText.textContent = `Analyzing ${i + 1} of ${urls.length} URLs...`;
            progressFill.style.width = `${((i + 1) / urls.length) * 100}%`;

            try {
                const result = await analyzeUrl(url, strategy, apiKey);
                results.push(result);
                displayResult(result);
            } catch (error) {
                const errorResult = {
                    url,
                    error: error.message || 'Failed to analyze URL'
                };
                results.push(errorResult);
                displayResult(errorResult);
            }

            // Small delay between requests to avoid rate limiting
            if (i < urls.length - 1) {
                await delay(1000);
            }
        }

        // Show results header and reset button
        resultsHeader.classList.remove('hidden');
        progressSection.classList.add('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyze URLs';
        analyzeBtn.querySelector('.btn-loader').classList.add('hidden');
    }

    async function analyzeUrl(url, strategy, apiKey) {
        const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        apiUrl.searchParams.set('url', url);
        apiUrl.searchParams.set('strategy', strategy);
        apiUrl.searchParams.set('category', 'performance');

        if (apiKey) {
            apiUrl.searchParams.set('key', apiKey);
        }

        const response = await fetch(apiUrl.toString());

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        const lighthouse = data.lighthouseResult;
        const categories = lighthouse.categories;
        const audits = lighthouse.audits;

        return {
            url,
            score: Math.round(categories.performance.score * 100),
            metrics: {
                fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
                lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
                tbt: audits['total-blocking-time']?.displayValue || 'N/A',
                cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
                si: audits['speed-index']?.displayValue || 'N/A',
                tti: audits['interactive']?.displayValue || 'N/A'
            },
            metricScores: {
                fcp: audits['first-contentful-paint']?.score || 0,
                lcp: audits['largest-contentful-paint']?.score || 0,
                tbt: audits['total-blocking-time']?.score || 0,
                cls: audits['cumulative-layout-shift']?.score || 0,
                si: audits['speed-index']?.score || 0,
                tti: audits['interactive']?.score || 0
            }
        };
    }

    function displayResult(result) {
        const card = document.createElement('div');
        card.className = 'result-card' + (result.error ? ' error' : '');

        if (result.error) {
            card.innerHTML = `
                <div class="card-header">
                    <h3><a href="${escapeHtml(result.url)}" target="_blank">${escapeHtml(result.url)}</a></h3>
                </div>
                <div class="card-body">
                    <div class="error-message">
                        <p>Error: ${escapeHtml(result.error)}</p>
                    </div>
                </div>
            `;
        } else {
            const scoreClass = getScoreClass(result.score);
            const scoreColor = getScoreColor(result.score);
            const circumference = 2 * Math.PI * 42;
            const offset = circumference - (result.score / 100) * circumference;

            card.innerHTML = `
                <div class="card-header">
                    <h3><a href="${escapeHtml(result.url)}" target="_blank">${escapeHtml(result.url)}</a></h3>
                </div>
                <div class="card-body">
                    <div class="score-circle">
                        <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle class="bg" cx="50" cy="50" r="42"/>
                            <circle class="progress" cx="50" cy="50" r="42"
                                stroke="${scoreColor}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"/>
                        </svg>
                        <span class="score-text" style="color: ${scoreColor}">${result.score}</span>
                    </div>
                    <div class="score-label ${scoreClass}">
                        ${getScoreLabel(result.score)}
                    </div>
                    <div class="metrics">
                        <div class="metric">
                            <div class="metric-label">First Contentful Paint</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.fcp * 100)}">${result.metrics.fcp}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Largest Contentful Paint</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.lcp * 100)}">${result.metrics.lcp}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Total Blocking Time</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.tbt * 100)}">${result.metrics.tbt}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Cumulative Layout Shift</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.cls * 100)}">${result.metrics.cls}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Speed Index</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.si * 100)}">${result.metrics.si}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Time to Interactive</div>
                            <div class="metric-value ${getScoreClass(result.metricScores.tti * 100)}">${result.metrics.tti}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        resultsGrid.appendChild(card);
    }

    function getScoreClass(score) {
        if (score >= 90) return 'good';
        if (score >= 50) return 'average';
        return 'poor';
    }

    function getScoreColor(score) {
        if (score >= 90) return '#0cce6b';
        if (score >= 50) return '#ffa400';
        return '#ff4e42';
    }

    function getScoreLabel(score) {
        if (score >= 90) return 'Good';
        if (score >= 50) return 'Needs Improvement';
        return 'Poor';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function exportToCSV() {
        if (results.length === 0) return;

        const headers = ['URL', 'Score', 'Status', 'FCP', 'LCP', 'TBT', 'CLS', 'Speed Index', 'TTI'];
        const rows = results.map(r => {
            if (r.error) {
                return [r.url, '', 'Error: ' + r.error, '', '', '', '', '', ''];
            }
            return [
                r.url,
                r.score,
                getScoreLabel(r.score),
                r.metrics.fcp,
                r.metrics.lcp,
                r.metrics.tbt,
                r.metrics.cls,
                r.metrics.si,
                r.metrics.tti
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pagespeed-results-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
});
