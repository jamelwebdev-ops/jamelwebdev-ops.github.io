const express = require('express');
const sharp = require('sharp');
const cheerio = require('cheerio');
const axios = require('axios');
const archiver = require('archiver');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active jobs
const jobs = new Map();

// Deep extraction using Puppeteer (handles "Load More" buttons and dynamic content)
async function extractImagesDeep(url, jobId, maxLoadMoreClicks = 20) {
    const job = jobs.get(jobId);
    let browser;

    try {
        job.statusMessage = 'Launching browser...';

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        job.statusMessage = 'Loading page...';
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for initial images to load
        await new Promise(r => setTimeout(r, 2000));

        // Collect images before clicking Load More
        let allImages = new Set();
        let previousCount = 0;
        let loadMoreClicks = 0;

        // Function to extract images from the current page state
        const extractCurrentImages = async () => {
            return await page.evaluate(() => {
                const images = new Set();

                // Get all img elements
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original;
                    if (src && !src.startsWith('data:')) {
                        images.add(src);
                    }
                    // Check srcset
                    if (img.srcset) {
                        img.srcset.split(',').forEach(s => {
                            const url = s.trim().split(' ')[0];
                            if (url && !url.startsWith('data:')) {
                                images.add(url);
                            }
                        });
                    }
                });

                // Get background images
                document.querySelectorAll('*').forEach(el => {
                    const style = window.getComputedStyle(el);
                    const bg = style.backgroundImage;
                    if (bg && bg !== 'none') {
                        const matches = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
                        if (matches) {
                            matches.forEach(match => {
                                const urlMatch = match.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                                if (urlMatch && !urlMatch[1].startsWith('data:')) {
                                    images.add(urlMatch[1]);
                                }
                            });
                        }
                    }
                });

                // Get images from anchor links (lightbox galleries often use this)
                document.querySelectorAll('a[href]').forEach(a => {
                    const href = a.href;
                    if (href && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(href)) {
                        images.add(href);
                    }
                });

                return Array.from(images);
            });
        };

        // Initial extraction
        let currentImages = await extractCurrentImages();
        currentImages.forEach(img => allImages.add(img));
        job.statusMessage = `Found ${allImages.size} images. Looking for "Load More" buttons...`;

        // Try to find and click "Load More" type buttons
        const loadMoreSelectors = [
            // Common load more button selectors
            'button[class*="load-more"]',
            'button[class*="loadmore"]',
            'a[class*="load-more"]',
            'a[class*="loadmore"]',
            'div[class*="load-more"]',
            'div[class*="loadmore"]',
            '.load-more',
            '.loadmore',
            '#load-more',
            '#loadmore',
            '[data-action="load-more"]',
            'button:contains("Load More")',
            'a:contains("Load More")',
            'button:contains("Show More")',
            'a:contains("Show More")',
            'button:contains("View More")',
            'a:contains("View More")',
            'button:contains("See More")',
            '.eg-pagination-button',
            '.esg-loadmore',
            '.gallery-load-more',
            'a.next',
            '.pagination a',
            // Essential Grid specific
            '.esg-pagination-button',
            '.esg-loadmore-wrapper a',
            '.esg-loadmore-wrapper button',
        ];

        // Keep clicking load more until no more content or max clicks reached
        while (loadMoreClicks < maxLoadMoreClicks) {
            let clicked = false;

            for (const selector of loadMoreSelectors) {
                try {
                    // Try standard selector
                    const button = await page.$(selector);
                    if (button) {
                        const isVisible = await page.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' &&
                                   style.visibility !== 'hidden' &&
                                   style.opacity !== '0' &&
                                   el.offsetParent !== null;
                        }, button);

                        if (isVisible) {
                            job.statusMessage = `Clicking "Load More" (${loadMoreClicks + 1})... Found ${allImages.size} images so far`;

                            // Scroll to button first
                            await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), button);
                            await new Promise(r => setTimeout(r, 500));

                            // Click the button
                            await button.click();
                            clicked = true;
                            loadMoreClicks++;

                            // Wait for new content to load
                            await new Promise(r => setTimeout(r, 2000));

                            // Try to wait for network to be idle
                            try {
                                await page.waitForNetworkIdle({ timeout: 5000 });
                            } catch (e) {
                                // Timeout is ok, continue
                            }

                            break;
                        }
                    }
                } catch (e) {
                    // Selector failed, try next
                }
            }

            // Also try finding buttons by text content
            if (!clicked) {
                try {
                    clicked = await page.evaluate(() => {
                        const buttonTexts = ['load more', 'show more', 'view more', 'see more', 'more images', 'next'];
                        const elements = [...document.querySelectorAll('button, a, div[role="button"], span[role="button"]')];

                        for (const el of elements) {
                            const text = el.textContent.toLowerCase().trim();
                            if (buttonTexts.some(t => text.includes(t))) {
                                const style = window.getComputedStyle(el);
                                if (style.display !== 'none' && style.visibility !== 'hidden') {
                                    el.click();
                                    return true;
                                }
                            }
                        }
                        return false;
                    });

                    if (clicked) {
                        loadMoreClicks++;
                        job.statusMessage = `Clicking "Load More" (${loadMoreClicks})... Found ${allImages.size} images so far`;
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } catch (e) {
                    // Failed to find by text
                }
            }

            // Extract new images
            currentImages = await extractCurrentImages();
            currentImages.forEach(img => allImages.add(img));

            // Check if we got new images
            if (allImages.size === previousCount && !clicked) {
                // No new images and no load more button found, we're done
                break;
            }

            if (!clicked) {
                // No load more button found, try scrolling to trigger lazy load
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await new Promise(r => setTimeout(r, 1500));

                currentImages = await extractCurrentImages();
                const countAfterScroll = allImages.size;
                currentImages.forEach(img => allImages.add(img));

                if (allImages.size === countAfterScroll) {
                    // No new images after scroll either, we're done
                    break;
                }
            }

            previousCount = allImages.size;
        }

        await browser.close();

        // Filter and clean up URLs
        const baseUrl = new URL(url);
        const cleanedImages = Array.from(allImages)
            .map(img => resolveUrl(img, baseUrl))
            .filter(img => img && isImageUrl(img));

        // Filter out thumbnails
        return filterFullSizeImages(cleanedImages);

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

// Basic extraction (fast, for pages without dynamic content)
async function extractImagesBasic(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const baseUrl = new URL(url);
        const images = new Set();

        // Extract from img src
        $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (src) {
                const imgUrl = resolveUrl(src, baseUrl);
                if (imgUrl && isImageUrl(imgUrl)) images.add(imgUrl);
            }
            const dataSrc = $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (dataSrc) {
                const imgUrl = resolveUrl(dataSrc, baseUrl);
                if (imgUrl && isImageUrl(imgUrl)) images.add(imgUrl);
            }
        });

        // Extract from srcset
        $('img[srcset], source[srcset]').each((_, el) => {
            const srcset = $(el).attr('srcset');
            if (srcset) {
                srcset.split(',').forEach(src => {
                    const imgUrl = resolveUrl(src.trim().split(' ')[0], baseUrl);
                    if (imgUrl && isImageUrl(imgUrl)) images.add(imgUrl);
                });
            }
        });

        // Extract from inline styles
        $('[style*="background"]').each((_, el) => {
            const style = $(el).attr('style');
            const matches = style.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
            if (matches) {
                matches.forEach(match => {
                    const urlMatch = match.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                    if (urlMatch) {
                        const imgUrl = resolveUrl(urlMatch[1], baseUrl);
                        if (imgUrl && isImageUrl(imgUrl)) images.add(imgUrl);
                    }
                });
            }
        });

        // Extract from anchor links (for galleries)
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(href)) {
                const imgUrl = resolveUrl(href, baseUrl);
                if (imgUrl) images.add(imgUrl);
            }
        });

        return filterFullSizeImages(Array.from(images));
    } catch (error) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
}

function resolveUrl(src, baseUrl) {
    try {
        if (!src || src.startsWith('data:')) return null;
        if (src.startsWith('//')) return `https:${src}`;
        if (src.startsWith('http')) return src;
        return new URL(src, baseUrl.origin).href;
    } catch {
        return null;
    }
}

function isImageUrl(url) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase().split('?')[0];
    return imageExtensions.some(ext => lowerUrl.endsWith(ext));
}

function filterFullSizeImages(images) {
    const imageGroups = {};

    images.forEach(url => {
        const filename = path.basename(url).split('?')[0];
        const baseName = filename.replace(/[-_]\d+x\d+(\.[^.]+)$/, '$1');

        if (!imageGroups[baseName]) {
            imageGroups[baseName] = [];
        }
        imageGroups[baseName].push(url);
    });

    const result = [];
    Object.values(imageGroups).forEach(group => {
        group.sort((a, b) => {
            const aHasSize = /[-_]\d+x\d+\.[^.]+$/.test(a);
            const bHasSize = /[-_]\d+x\d+\.[^.]+$/.test(b);
            if (aHasSize && !bHasSize) return 1;
            if (!aHasSize && bHasSize) return -1;
            return 0;
        });
        result.push(group[0]);
    });

    return result;
}

// Compress a single image
async function compressImage(imageBuffer, originalName, maxSizeKB = 200) {
    const maxSizeBytes = maxSizeKB * 1024;
    const ext = path.extname(originalName).toLowerCase();

    if (imageBuffer.length <= maxSizeBytes) {
        return { buffer: imageBuffer, name: originalName, compressed: false };
    }

    let quality = 90;
    let buffer;
    let outputName = originalName;

    while (quality >= 20) {
        try {
            if (ext === '.png') {
                buffer = await sharp(imageBuffer)
                    .png({ quality, compressionLevel: 9 })
                    .toBuffer();
            } else if (ext === '.jpg' || ext === '.jpeg') {
                buffer = await sharp(imageBuffer)
                    .jpeg({ quality })
                    .toBuffer();
            } else if (ext === '.webp') {
                buffer = await sharp(imageBuffer)
                    .webp({ quality })
                    .toBuffer();
            } else if (ext === '.gif') {
                buffer = await sharp(imageBuffer)
                    .png({ quality, compressionLevel: 9 })
                    .toBuffer();
                outputName = originalName.replace('.gif', '.png');
            } else {
                buffer = await sharp(imageBuffer)
                    .jpeg({ quality })
                    .toBuffer();
                outputName = originalName.replace(/\.[^.]+$/, '.jpg');
            }

            if (buffer.length <= maxSizeBytes) {
                return { buffer, name: outputName, compressed: true };
            }
            quality -= 10;
        } catch (err) {
            break;
        }
    }

    let scale = 0.8;
    while (scale >= 0.2) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            const newWidth = Math.floor(metadata.width * scale);

            buffer = await sharp(imageBuffer)
                .resize(newWidth)
                .jpeg({ quality: 80 })
                .toBuffer();

            outputName = originalName.replace(/\.[^.]+$/, '.jpg');

            if (buffer.length <= maxSizeBytes) {
                return { buffer, name: outputName, compressed: true };
            }
            scale -= 0.1;
        } catch (err) {
            break;
        }
    }

    try {
        const metadata = await sharp(imageBuffer).metadata();
        buffer = await sharp(imageBuffer)
            .resize(Math.floor(metadata.width * 0.3))
            .jpeg({ quality: 60 })
            .toBuffer();
        outputName = originalName.replace(/\.[^.]+$/, '.jpg');
        return { buffer, name: outputName, compressed: true };
    } catch {
        return { buffer: imageBuffer, name: originalName, compressed: false };
    }
}

// API: Start extraction job
app.post('/api/extract', async (req, res) => {
    const { url, deepScan = false } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    jobs.set(jobId, {
        status: 'extracting',
        statusMessage: deepScan ? 'Starting deep scan...' : 'Extracting images...',
        url,
        deepScan,
        images: [],
        processed: 0,
        total: 0,
        results: [],
        error: null
    });

    // Start extraction in background
    (async () => {
        try {
            let images;
            if (deepScan) {
                images = await extractImagesDeep(url, jobId);
            } else {
                images = await extractImagesBasic(url);
            }
            const job = jobs.get(jobId);
            job.images = images;
            job.total = images.length;
            job.status = 'extracted';
            job.statusMessage = `Found ${images.length} images`;
        } catch (error) {
            const job = jobs.get(jobId);
            job.status = 'error';
            job.error = error.message;
        }
    })();

    res.json({ jobId });
});

// API: Get job status
app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
        status: job.status,
        statusMessage: job.statusMessage,
        total: job.total,
        processed: job.processed,
        images: job.images,
        results: job.results,
        error: job.error
    });
});

// API: Start compression
app.post('/api/compress/:jobId', async (req, res) => {
    const job = jobs.get(req.params.jobId);
    const { maxSize = 200 } = req.body;

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'extracted') {
        return res.status(400).json({ error: 'Images not yet extracted' });
    }

    job.status = 'compressing';
    job.results = [];

    (async () => {
        for (let i = 0; i < job.images.length; i++) {
            const imageUrl = job.images[i];
            try {
                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const originalBuffer = Buffer.from(response.data);
                const originalName = path.basename(new URL(imageUrl).pathname).split('?')[0] || `image_${i}.jpg`;

                const result = await compressImage(originalBuffer, originalName, maxSize);

                job.results.push({
                    originalUrl: imageUrl,
                    originalName,
                    originalSize: originalBuffer.length,
                    compressedName: result.name,
                    compressedSize: result.buffer.length,
                    compressed: result.compressed,
                    buffer: result.buffer.toString('base64')
                });
            } catch (error) {
                job.results.push({
                    originalUrl: imageUrl,
                    error: error.message
                });
            }
            job.processed = i + 1;
        }
        job.status = 'completed';
    })();

    res.json({ message: 'Compression started' });
});

// API: Download all as ZIP
app.get('/api/download/:jobId', async (req, res) => {
    const job = jobs.get(req.params.jobId);

    if (!job || job.status !== 'completed') {
        return res.status(400).json({ error: 'Job not ready for download' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=compressed-images.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const usedNames = new Set();
    job.results.forEach((result, index) => {
        if (result.buffer) {
            const buffer = Buffer.from(result.buffer, 'base64');
            let name = result.compressedName || `image_${index}.jpg`;

            // Ensure unique filenames
            if (usedNames.has(name)) {
                const ext = path.extname(name);
                const base = path.basename(name, ext);
                name = `${base}_${index}${ext}`;
            }
            usedNames.add(name);

            archive.append(buffer, { name });
        }
    });

    archive.finalize();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Image Compressor running at http://localhost:${PORT}`);
});
