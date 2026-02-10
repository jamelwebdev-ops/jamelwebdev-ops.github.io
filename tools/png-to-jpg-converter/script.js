class ImageToWebPConverter {
    constructor() {
        this.files = [];
        this.convertedFiles = [];
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.actions = document.getElementById('actions');
        this.convertBtn = document.getElementById('convertBtn');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.qualitySlider = document.getElementById('quality');
        this.qualityValue = document.getElementById('qualityValue');
        this.bgColor = document.getElementById('bgColor');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
    }

    bindEvents() {
        // Upload area click
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f =>
                f.type === 'image/png' || f.type === 'image/jpeg'
            );
            this.handleFiles(files);
        });

        // Quality slider
        this.qualitySlider.addEventListener('input', (e) => {
            this.qualityValue.textContent = e.target.value;
        });

        // Buttons
        this.convertBtn.addEventListener('click', () => this.convertAll());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllAsZip());
        this.clearBtn.addEventListener('click', () => this.clearAll());
    }

    handleFiles(fileList) {
        const newFiles = Array.from(fileList).filter(f =>
            f.type === 'image/png' || f.type === 'image/jpeg'
        );

        if (newFiles.length === 0) {
            alert('Please select PNG or JPG files only.');
            return;
        }

        newFiles.forEach(file => {
            const id = Date.now() + Math.random().toString(36).substr(2, 9);
            this.files.push({
                id,
                file,
                status: 'pending',
                convertedBlob: null
            });
        });

        this.renderFileList();
        this.updateActions();
        this.fileInput.value = '';
    }

    renderFileList() {
        this.fileList.innerHTML = this.files.map(item => {
            const preview = URL.createObjectURL(item.file);
            const size = this.formatFileSize(item.file.size);
            const statusClass = item.status;
            const statusText = this.getStatusText(item.status);

            return `
                <div class="file-item" data-id="${item.id}">
                    <img src="${preview}" alt="${item.file.name}">
                    <div class="file-info">
                        <div class="file-name">${item.file.name}</div>
                        <div class="file-size">${size}</div>
                    </div>
                    <span class="file-status ${statusClass}">${statusText}</span>
                    <div class="file-actions">
                        ${item.status === 'done' ? `<button class="download-btn" onclick="converter.downloadSingle('${item.id}')">Download</button>` : ''}
                        <button class="remove-btn" onclick="converter.removeFile('${item.id}')">Remove</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusText(status) {
        const texts = {
            pending: 'Pending',
            converting: 'Converting...',
            done: 'Converted',
            error: 'Error'
        };
        return texts[status] || status;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateActions() {
        this.actions.style.display = this.files.length > 0 ? 'flex' : 'none';

        const hasConverted = this.files.some(f => f.status === 'done');
        this.downloadAllBtn.style.display = hasConverted ? 'inline-flex' : 'none';

        const hasPending = this.files.some(f => f.status === 'pending');
        this.convertBtn.disabled = !hasPending;
    }

    async convertAll() {
        const pendingFiles = this.files.filter(f => f.status === 'pending');

        if (pendingFiles.length === 0) return;

        this.progressContainer.style.display = 'block';
        this.convertBtn.disabled = true;

        let completed = 0;
        const total = pendingFiles.length;

        for (const item of pendingFiles) {
            item.status = 'converting';
            this.renderFileList();

            try {
                const webpBlob = await this.convertToWebP(item.file);
                item.convertedBlob = webpBlob;
                item.status = 'done';
            } catch (error) {
                console.error('Conversion error:', error);
                item.status = 'error';
            }

            completed++;
            const progress = Math.round((completed / total) * 100);
            this.progressFill.style.width = `${progress}%`;
            this.progressText.textContent = `Converting... ${completed}/${total}`;

            this.renderFileList();
        }

        this.progressText.textContent = `Completed! ${completed} files converted.`;
        setTimeout(() => {
            this.progressContainer.style.display = 'none';
            this.progressFill.style.width = '0%';
        }, 2000);

        this.updateActions();
    }

    convertToWebP(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const quality = this.qualitySlider.value / 100;
            const bgColor = this.bgColor.value;
            const isPNG = file.type === 'image/png';

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // Fill background color (for PNG with transparency)
                if (isPNG) {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // Draw image
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to convert image'));
                        }
                    },
                    'image/webp',
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    downloadSingle(id) {
        const item = this.files.find(f => f.id === id);
        if (!item || !item.convertedBlob) return;

        const fileName = item.file.name.replace(/\.(png|jpe?g)$/i, '.webp');
        this.downloadBlob(item.convertedBlob, fileName);
    }

    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async downloadAllAsZip() {
        const convertedFiles = this.files.filter(f => f.status === 'done' && f.convertedBlob);

        if (convertedFiles.length === 0) return;

        this.downloadAllBtn.disabled = true;
        this.downloadAllBtn.querySelector('span').textContent = 'Creating ZIP...';

        try {
            const zip = new JSZip();

            convertedFiles.forEach(item => {
                const fileName = item.file.name.replace(/\.(png|jpe?g)$/i, '.webp');
                zip.file(fileName, item.convertedBlob);
            });

            const content = await zip.generateAsync({ type: 'blob' });
            this.downloadBlob(content, 'converted-images.zip');
        } catch (error) {
            console.error('ZIP creation error:', error);
            alert('Failed to create ZIP file.');
        }

        this.downloadAllBtn.disabled = false;
        this.downloadAllBtn.querySelector('span').textContent = 'Download All as ZIP';
    }

    removeFile(id) {
        this.files = this.files.filter(f => f.id !== id);
        this.renderFileList();
        this.updateActions();
    }

    clearAll() {
        this.files = [];
        this.renderFileList();
        this.updateActions();
        this.progressContainer.style.display = 'none';
        this.progressFill.style.width = '0%';
    }
}

// Initialize converter
const converter = new ImageToWebPConverter();
