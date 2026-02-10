// Chart.js Configuration
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';
Chart.defaults.font.family = "'Segoe UI', system-ui, -apple-system, sans-serif";

// Color palette
const colors = {
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    gradient1: ['rgba(37, 99, 235, 0.8)', 'rgba(124, 58, 237, 0.8)'],
    gradient2: ['rgba(6, 182, 212, 0.8)', 'rgba(16, 185, 129, 0.8)']
};

// Historical Data
const historicalYears = ['2018', '2019', '2020', '2021', '2022', '2023', '2024'];
const crudeDeathRates = [8.68, 8.70, 10.36, 10.42, 9.80, 9.20, 9.23];
const ageAdjustedRates = [723.6, 715.2, 835.4, 841.6, 798.8, 750.5, 722.0];

// Projection Data
const projectionYears = ['2023', '2024', '2025', '2026', '2027'];
const projectedRates = [9.20, 9.23, 9.10, 9.00, 8.92];

// Total Deaths Data
const totalDeaths = [2839205, 2854838, 3390000, 3464231, 3273705, 3090964, 3072039];

// 1. Historical Trend Chart
const trendCtx = document.getElementById('trendChart').getContext('2d');
const trendGradient = trendCtx.createLinearGradient(0, 0, 0, 400);
trendGradient.addColorStop(0, 'rgba(37, 99, 235, 0.5)');
trendGradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

new Chart(trendCtx, {
    type: 'line',
    data: {
        labels: historicalYears,
        datasets: [{
            label: 'Crude Death Rate (per 1,000)',
            data: crudeDeathRates,
            borderColor: colors.primary,
            backgroundColor: trendGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colors.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return `Death Rate: ${context.parsed.y} per 1,000`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 8,
                max: 11,
                grid: {
                    color: 'rgba(51, 65, 85, 0.5)'
                },
                ticks: {
                    callback: function(value) {
                        return value.toFixed(1);
                    }
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    }
});

// 2. Projection Chart
const projCtx = document.getElementById('projectionChart').getContext('2d');
const projGradient = projCtx.createLinearGradient(0, 0, 0, 400);
projGradient.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
projGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

new Chart(projCtx, {
    type: 'line',
    data: {
        labels: projectionYears,
        datasets: [{
            label: 'Actual',
            data: [9.20, 9.23, null, null, null],
            borderColor: colors.primary,
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: colors.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6
        }, {
            label: 'Projected',
            data: [null, 9.23, 9.10, 9.00, 8.92],
            borderColor: colors.accent,
            backgroundColor: projGradient,
            borderWidth: 3,
            borderDash: [5, 5],
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colors.accent,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 8.5,
                max: 9.5,
                grid: {
                    color: 'rgba(51, 65, 85, 0.5)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    }
});

// 3. Age-Adjusted Death Rate Chart
const ageCtx = document.getElementById('ageAdjustedChart').getContext('2d');

new Chart(ageCtx, {
    type: 'bar',
    data: {
        labels: historicalYears,
        datasets: [{
            label: 'Age-Adjusted Death Rate (per 100,000)',
            data: ageAdjustedRates,
            backgroundColor: historicalYears.map((year, index) => {
                if (year === '2020' || year === '2021') return 'rgba(239, 68, 68, 0.8)';
                if (year === '2024') return 'rgba(16, 185, 129, 0.8)';
                return 'rgba(37, 99, 235, 0.8)';
            }),
            borderColor: historicalYears.map((year) => {
                if (year === '2020' || year === '2021') return '#ef4444';
                if (year === '2024') return '#10b981';
                return '#2563eb';
            }),
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    label: function(context) {
                        return `Rate: ${context.parsed.y} per 100,000`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 650,
                max: 900,
                grid: {
                    color: 'rgba(51, 65, 85, 0.5)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    }
});

// 4. Leading Causes of Death Chart
const causesCtx = document.getElementById('causesChart').getContext('2d');

const causesData = {
    labels: ['Heart Disease', 'Cancer', 'Accidents', 'Stroke', 'CLRD', 'Alzheimer\'s', 'Diabetes', 'Kidney Disease', 'Liver Disease', 'COVID-19'],
    datasets: [{
        data: [680981, 613352, 222698, 162639, 145357, 114034, 95190, 55253, 52222, 49932],
        backgroundColor: [
            'rgba(239, 68, 68, 0.85)',
            'rgba(124, 58, 237, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(37, 99, 235, 0.85)',
            'rgba(6, 182, 212, 0.85)',
            'rgba(16, 185, 129, 0.85)',
            'rgba(236, 72, 153, 0.85)',
            'rgba(139, 92, 246, 0.85)',
            'rgba(20, 184, 166, 0.85)',
            'rgba(251, 146, 60, 0.85)'
        ],
        borderWidth: 0
    }]
};

new Chart(causesCtx, {
    type: 'doughnut',
    data: causesData,
    options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    label: function(context) {
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${context.label}: ${value.toLocaleString()} deaths (${percentage}%)`;
                    }
                }
            }
        }
    }
});

// 5. Year-Over-Year Comparison Chart
const compCtx = document.getElementById('comparisonChart').getContext('2d');

new Chart(compCtx, {
    type: 'bar',
    data: {
        labels: historicalYears,
        datasets: [{
            label: 'Total Deaths (Millions)',
            data: totalDeaths.map(d => d / 1000000),
            backgroundColor: 'rgba(37, 99, 235, 0.8)',
            borderColor: '#2563eb',
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: 'y'
        }, {
            label: 'Crude Death Rate',
            data: crudeDeathRates,
            type: 'line',
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            yAxisID: 'y1'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Total Deaths (Millions)'
                },
                grid: {
                    color: 'rgba(51, 65, 85, 0.5)'
                },
                min: 2.5,
                max: 3.8
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Death Rate (per 1,000)'
                },
                grid: {
                    drawOnChartArea: false
                },
                min: 8,
                max: 11
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    }
});

// Add smooth scroll behavior for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.info-card, .projection-card, .cause-item, .source-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});
