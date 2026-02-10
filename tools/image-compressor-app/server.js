const express = require('express');
const sharp = require('sharp');
const cheerio = require('cheerio');
const axios = require('axios');
const archiver = require('archiver');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active jobs
const jobs = new Map();

// Extract images from a webpage
async function extractImages(url) {
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
            // Also check data-src for lazy loaded images
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

        // Extract from inline styles (background-image)
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

        // Extract from CSS in style tags
        $('style').each((_, el) => {
            const css = $(el).html();
            const matches = css.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
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

        // Filter out thumbnail versions (keep only full-size)
        const fullSizeImages = filterFullSizeImages(Array.from(images));

        return fullSizeImages;
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
    // Group images by base name (without size suffix)
    const imageGroups = {};

    images.forEach(url => {
        const filename = path.basename(url).split('?')[0];
        // Remove size suffix like -300x200, _300x200, etc.
        const baseName = filename.replace(/[-_]\d+x\d+(\.[^.]+)$/, '$1');

        if (!imageGroups[baseName]) {
            imageGroups[baseName] = [];
        }
        imageGroups[baseName].push(url);
    });

    // For each group, prefer the URL without size suffix
    const result = [];
    Object.values(imageGroups).forEach(group => {
        // Sort to prefer URLs without size suffix
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

    // If already small enough, return as-is
    if (imageBuffer.length <= maxSizeBytes) {
        return { buffer: imageBuffer, name: originalName, compressed: false };
    }

    let quality = 90;
    let buffer;
    let outputName = originalName;

    // Try compression with decreasing quality
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
                // GIFs are tricky, convert to PNG
                buffer = await sharp(imageBuffer)
                    .png({ quality, compressionLevel: 9 })
                    .toBuffer();
                outputName = originalName.replace('.gif', '.png');
            } else {
                // Convert to JPEG for other formats
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

    // If still too large, resize
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

    // Last resort
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
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        new URL(url); // Validate URL
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    jobs.set(jobId, {
        status: 'extracting',
        url,
        images: [],
        processed: 0,
        total: 0,
        results: [],
        error: null
    });

    // Start extraction in background
    (async () => {
        try {
            const images = await extractImages(url);
            const job = jobs.get(jobId);
            job.images = images;
            job.total = images.length;
            job.status = 'extracted';
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

    // Process images in background
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

    job.results.forEach((result, index) => {
        if (result.buffer) {
            const buffer = Buffer.from(result.buffer, 'base64');
            // Ensure unique filenames
            const name = result.compressedName || `image_${index}.jpg`;
            archive.append(buffer, { name });
        }
    });

    archive.finalize();
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Image Compressor running at http://localhost:${PORT}`);
});
