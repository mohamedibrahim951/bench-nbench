/*
 * Bench'n'Bench - Main Application
 * Copyright (c) 2026 Mohamed
 * Licensed under Apache 2.0
 *
 * v6.1.0
 * - Three separate mode buttons (Retro / Neo / Bright)
 * - Bright mode: "Look at the bright side!" joke mode
 * - CPU-only stress test with silent adaptive level ramp
 * - Slogan rotation every 5 seconds
 * - Custom CSS-drawn neon emoji (🙃 🤔 🤖)
 * - All comments in English
 */

console.log("Bench'n'Bench v6.1.0");

// ================================================================
// CONFIG
// ================================================================

const CONFIG = {
    SLOGAN_DISPLAY_TIME: 7000,
    SLOGAN_FADE_TIME: 350,
    BRIGHT_MODE_DURATION: 600000,
    FPS_LOW_THRESHOLD: 5,
    FPS_HIGH_THRESHOLD: 30
};

// ================================================================
// THEME MODES
// ================================================================

const THEME_KEY = 'bench_n_bench_theme';

const THEME = {
    RETRO: 'retro',
    NEO: 'neo',
    BRIGHT: 'bright'
};

const Theme = {
    current: THEME.RETRO,
    _brightTimer: null,

    init() {
        let saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
        this.current = (saved === THEME.NEO) ? THEME.NEO : THEME.RETRO;
        this.apply(this.current, false);
        this.updateButtons();
    },

    apply(mode, persist) {
        this.current = mode;

        document.body.classList.remove('retro-mode', 'neo-mode', 'bright-mode');

        if (mode === THEME.RETRO) document.body.classList.add('retro-mode');
        else if (mode === THEME.NEO) document.body.classList.add('neo-mode');
        else if (mode === THEME.BRIGHT) document.body.classList.add('bright-mode');

        this.updateButtons();

        if (persist && mode !== THEME.BRIGHT) {
            try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
        }
    },

    setMode(mode) {
        if (this._brightTimer) {
            clearTimeout(this._brightTimer);
            this._brightTimer = null;
        }

        if (mode === THEME.BRIGHT) {
            this.enterBright();
        } else {
            this.apply(mode, true);
        }
    },

    enterBright() {
        const previous = (this.current === THEME.NEO) ? THEME.NEO : THEME.RETRO;
        this.apply(THEME.BRIGHT, false);
        this._brightTimer = setTimeout(() => {
            this.apply(previous, false);
            this._brightTimer = null;
        }, CONFIG.BRIGHT_MODE_DURATION);
    },

    updateButtons() {
        document.querySelectorAll('.mode-switch-btn').forEach(btn => {
            const mode = btn.dataset.mode;
            btn.classList.toggle('active', mode === this.current);
        });
    }
};

// ================================================================
// SLOGANS
// ================================================================

const SLOGANS = [
    "Bench it your way, benchmark it every day.",
    "Your hardware, our benchmarks, one tool.",
    "One tool. Every test. No limits.",
    "Because hardware deserves the truth.",
    "Don't let your hardware lie to you.",
    "Open source. Open hardware.",
    "Built for the bench.",

    "Run it like you mean it.",
    "We stress so you don't.",
    "Stop guessing, start testing.",
    "Your CPU called. It wants to run.",
    "No bottlenecks, no excuses.",
    "Don't be a bottleneck - bench it!",
    "Born as a website, forced to be a benchmark tool.",
    "fully programmed by Mohamed, or...... is it?🤖",
    "Speedrun mode: PC checked in 7 seconds flat.",
    "Beep boop. Out of ideas.🤖",
    "Run it. Bench it. Know it.",
    "Test. Analyze. Optimize.",
    "Your system. Our tools.",
    "Benched in, marked out.",
    "Benched in, marked out (again).",
    "Because numbers don't lie, hardware does.",
    "From specs to performance, we speak hardware.",
    "Your hardware deserves better than guesses.",
    "Benchmarking without limits.",
    "I didn't wash my hands before coding...",
    "It's embarrassing to show your friend your app and it shows bugs.",
    "Q&A: Where did your time on this go? Answer: 30% fixing Linux kernel + driver issues, UVD gave up, 40% stupid bugs, 25% aesthetics, 4% jokes, 1% coding.",
    "Can bench'nbench catch imposter hardware?🤔",
    "'bench'nbench' is that 'bench in bench' or 'bench and bench'?🙃"
];

// ================================================================
// SLOGAN RENDERING (CSS-drawn neon emoji)
// ================================================================

const EMOJI_CLASS_MAP = {
    '🙃': 'neon-emoji-upside',
    '🤔': 'neon-emoji-think',
    '🤖': 'neon-emoji-robot'
};

function renderSlogan(text) {
    let safe = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    for (const [emoji, cls] of Object.entries(EMOJI_CLASS_MAP)) {
        safe = safe.split(emoji).join(
            '<span class="neon-emoji ' + cls + '" aria-label="' + emoji + '" role="img"></span>'
        );
    }
    return safe;
}

// ================================================================
// STATE
// ================================================================

let PSU_PUBLIC = {};
let PSU_MODELS = {};
let CPU_DB = [];
let GPU_DB = [];

let systemData = null;
let osInfo = null;
let currentSloganIndex = 0;
let sloganInterval = null;

const compareState = {
    cpuBase: null,
    cpuTarget: null,
    gpuBase: null,
    gpuTarget: null
};

// ================================================================
// STORAGE
// ================================================================

const STORAGE_KEY = 'bench_n_bench_data';

const Storage = {
    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) { return false; }
    },
    read() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
    },
    has() {
        return this.read() !== null;
    }
};

// ================================================================
// OS DETECTION
// ================================================================

function detectOS() {
    const platform = navigator.platform.toLowerCase();
    const ua = navigator.userAgent.toLowerCase();
    const sw = window.screen.width;
    const sh = window.screen.height;

    const result = {
        os: 'Unknown',
        arch: 'Unknown',
        isWindows: false,
        isLinux: false,
        isMac: false,
        isMobile: false,
        isTablet: false,
        isDesktop: false,
        isARM: false,
        supported: false,
        isLimitedMode: false,
        displayName: 'Unknown'
    };

    const isAndroid = ua.includes('android');
    const isIOS = ua.includes('iphone') || ua.includes('ipad');
    const isMobileUA = ua.includes('mobile');

    if (isAndroid || isIOS || isMobileUA) {
        result.isMobile = true;
        result.isLimitedMode = true;
        result.isARM = true;
        if (sw >= 768 && sh >= 1024) {
            result.isTablet = true;
            result.isMobile = false;
        }
        if (isAndroid) {
            result.os = 'Android';
            result.arch = 'ARM';
            result.displayName = 'Android (Mobile)';
        } else if (isIOS) {
            if (ua.includes('ipad')) {
                result.os = 'iPadOS';
                result.isTablet = true;
                result.isMobile = false;
                result.displayName = 'iPadOS (Tablet)';
            } else {
                result.os = 'iOS';
                result.displayName = 'iOS (Mobile)';
            }
            result.arch = 'ARM';
        } else {
            result.os = 'Mobile';
            result.arch = 'ARM';
            result.displayName = 'Mobile Device';
        }
        return result;
    }

    if (platform.includes('win')) {
        let version = 'Windows';
        let arch = '32-bit';
        if (ua.includes('windows nt 10.0')) version = 'Windows 10/11';
        else if (ua.includes('windows nt 6.2') || ua.includes('windows nt 6.3')) version = 'Windows 8/8.1';
        else if (ua.includes('windows nt 6.1')) version = 'Windows 7';
        if (ua.includes('wow64') || ua.includes('win64')) arch = '64-bit';
        result.os = version;
        result.arch = arch;
        result.isWindows = true;
        result.isDesktop = true;
        result.supported = true;
        result.displayName = version + ' (' + arch + ')';
        return result;
    }

    if (platform.includes('linux')) {
        let distro = 'Linux';
        if (ua.includes('ubuntu')) distro = 'Ubuntu Linux';
        else if (ua.includes('debian')) distro = 'Debian Linux';
        else if (ua.includes('fedora')) distro = 'Fedora Linux';
        else if (ua.includes('arch')) distro = 'Arch Linux';
        const isARM = ua.includes('arm') || ua.includes('aarch64');
        result.os = distro;
        result.arch = isARM ? 'ARM' : 'x86';
        result.isLinux = true;
        result.isARM = isARM;
        result.isDesktop = !isARM;
        result.supported = !isARM;
        result.isLimitedMode = isARM;
        result.displayName = distro + (isARM ? ' (ARM - Limited)' : '');
        return result;
    }

    if (platform.includes('mac')) {
        result.os = 'macOS';
        result.arch = 'x86';
        result.isMac = true;
        result.isDesktop = true;
        result.isLimitedMode = true;
        result.displayName = 'macOS (Limited Mode)';
        return result;
    }

    result.displayName = 'Unknown OS';
    result.isLimitedMode = true;
    return result;
}

// ================================================================
// SCRIPT GENERATION
// ================================================================

function generateScript(info) {
    if (!info) return null;
    if (info.isWindows) return getWindowsScript();
    if (info.isLinux && !info.isARM) return getLinuxScript();
    return null;
}

function getWindowsScript() {
    return [
        '@echo off',
        'echo ====================',
        'for /f "tokens=2 delims==" %%A in (\'wmic cpu get NumberOfLogicalProcessors /value ^| find "="\') do echo Threads: %%A'
    ].join('\n');
}

function getLinuxScript() {
    return [
        '#!/bin/bash',
        'echo "===================="',
        'printf "Threads: %s\\n" "$(nproc)"'
    ].join('\n');
}

// ================================================================
// SYSTEM ANALYSIS
// ================================================================

function analyzeOutput(output) {
    if (!output || !output.trim()) {
        return { success: false, error: 'Please paste the CPU output.' };
    }

    const match = output.match(/(?:^|\n)\s*Threads:\s*(\d+)\s*(?:\n|$)/i);
    if (!match) {
        return { success: false, error: 'Expected a line in this format: Threads: X' };
    }

    const threads = Number(match[1]);
    if (!Number.isInteger(threads) || threads < 1 || threads > 1024) {
        return { success: false, error: 'Invalid thread count.' };
    }

    return {
        success: true,
        data: {
            cpuCores: threads,
            cpuThreads: threads,
            isLinux: osInfo?.isLinux || false,
            isWindows: osInfo?.isWindows || false
        }
    };
}

// ================================================================
// DATA FETCH
// ================================================================

async function fetchData() {
    try {
        const [psuPub, psuMod, cpus, gpus] = await Promise.all([
            fetch('data/psu_public.json').then(r => r.json()),
            fetch('data/psu_models.json').then(r => r.json()),
            fetch('data/cpus.json').then(r => r.json()),
            fetch('data/gpus.json').then(r => r.json())
        ]);
        PSU_PUBLIC = psuPub;
        PSU_MODELS = psuMod;
        CPU_DB = cpus;
        GPU_DB = gpus;
        console.log('Data ready');
        return true;
    } catch (e) {
        console.error('Failed to fetch data:', e);
        return false;
    }
}

// ================================================================
// SLOGAN ROTATION
// ================================================================

function initSlogans() {
    const el = document.getElementById('sloganDisplay');
    if (!el) return;

    currentSloganIndex = Math.floor(Math.random() * SLOGANS.length);
    el.innerHTML = renderSlogan(SLOGANS[currentSloganIndex]);
    el.style.opacity = '1';

    el.addEventListener('click', () => {
        changeSlogan();
        restartSloganInterval();
    });

    restartSloganInterval();
}

function restartSloganInterval() {
    if (sloganInterval) clearInterval(sloganInterval);
    sloganInterval = setInterval(changeSlogan, CONFIG.SLOGAN_DISPLAY_TIME);
}

function changeSlogan() {
    const el = document.getElementById('sloganDisplay');
    if (!el) return;

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * SLOGANS.length);
    } while (newIndex === currentSloganIndex && SLOGANS.length > 1);

    currentSloganIndex = newIndex;

    el.style.opacity = '0';
    setTimeout(() => {
        el.innerHTML = renderSlogan(SLOGANS[currentSloganIndex]);
        el.style.opacity = '1';
    }, CONFIG.SLOGAN_FADE_TIME);
}

// ================================================================
// PAGE NAVIGATION
// ================================================================

function showPage(pageId) {
    document.getElementById('toolsSection').classList.add('hidden');
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    changeSlogan();
}

function showTools() {
    document.getElementById('toolsSection').classList.remove('hidden');
}

// ================================================================
// PSU SEARCH
// ================================================================

function searchPSU(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const results = [];
    const ratingMap = {
        'excellent': 'A', 'good': 'B', 'average': 'C',
        'poor': 'D', 'bad': 'E', 'dangerous': 'F'
    };

    for (const [key, value] of Object.entries(PSU_PUBLIC)) {
        if (key.includes(q)) results.push({ name: key, ...value });
    }

    const tier = ratingMap[q];
    if (tier) {
        for (const [key, value] of Object.entries(PSU_PUBLIC)) {
            if (value.tier === tier && !results.some(r => r.name === key)) {
                results.push({ name: key, ...value });
            }
        }
    }

    return results;
}

function searchPSUModel(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const results = [];
    for (const [key, value] of Object.entries(PSU_MODELS)) {
        if (key.includes(q)) results.push({ name: key, ...value });
    }
    return results;
}

function renderPSUResults(query) {
    const container = document.getElementById('psuResults');
    const results = searchPSU(query);
    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted center">No results found.</p>';
        return;
    }
    let html = '';
    results.forEach(r => {
        const tierClass = 'psu-tier-' + r.tier.toLowerCase();
        html += `
            <div class="result-item">
                <div>
                    <div class="name">${r.name}</div>
                    ${r.exception ? '<div class="specs">Exception: ' + r.exception + '</div>' : ''}
                </div>
                <div>
                    <span class="rating-badge ${tierClass}">Tier ${r.tier}</span>
                    <span style="margin-left:10px;font-weight:600;">${r.rating}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderPSUModelResults(query) {
    const container = document.getElementById('psuModelResults');
    const results = searchPSUModel(query);
    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted center">No models found.</p>';
        return;
    }
    let html = '';
    results.forEach(r => {
        const tierClass = 'psu-tier-' + r.tier.toLowerCase();
        html += `
            <div class="result-item">
                <div>
                    <div class="name">${r.name}</div>
                    ${r.notes ? '<div class="specs">' + r.notes + '</div>' : ''}
                </div>
                <div>
                    <span class="rating-badge ${tierClass}">Tier ${r.tier}</span>
                    <span style="margin-left:10px;font-weight:600;">${r.rating}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ================================================================
// COMPARE
// ================================================================

function searchCompare(query, type) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const db = type === 'cpu' ? CPU_DB : GPU_DB;
    return db.filter(item => item.name.toLowerCase().includes(q));
}

function setupCompareInput(inputId, suggestionsId, type, key) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    if (!input || !suggestions) return;

    input.addEventListener('input', function () {
        const query = this.value.trim();
        if (!query) {
            suggestions.style.display = 'none';
            suggestions.innerHTML = '';
            return;
        }
        const results = searchCompare(query, type);
        if (results.length === 0) {
            suggestions.innerHTML = '<div class="suggestion-item">No results</div>';
            suggestions.style.display = 'block';
            return;
        }
        let html = '';
        results.slice(0, 10).forEach(r => {
            html += `<div class="suggestion-item" data-name="${r.name}">${r.name}</div>`;
        });
        suggestions.innerHTML = html;
        suggestions.style.display = 'block';

        suggestions.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', function () {
                const name = this.dataset.name;
                const item = results.find(r => r.name === name);
                if (item) {
                    input.value = name;
                    suggestions.style.display = 'none';
                    compareState[key] = item;
                    updateCompareResults(type);
                }
            });
        });
    });

    document.addEventListener('click', function (e) {
        if (!suggestions.contains(e.target) && e.target !== input) {
            suggestions.style.display = 'none';
        }
    });
}

function updateCompareResults(type) {
    const isCpu = type === 'cpu';
    const base = isCpu ? compareState.cpuBase : compareState.gpuBase;
    const target = isCpu ? compareState.cpuTarget : compareState.gpuTarget;
    const container = document.getElementById(isCpu ? 'cpuResults' : 'gpuResults');
    if (!container) return;

    if (!base || !target) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    const pct = Math.round((target.score / base.score) * 100);
    const barWidth = Math.min(pct, 100);

    container.innerHTML = `
        <div class="compare-header">
            <div class="compare-name">${base.name}</div>
            <div class="compare-vs">VS</div>
            <div class="compare-name">${target.name}</div>
        </div>
        <div class="compare-bar-row">
            <div class="compare-bar-wrap">
                <div class="compare-bar-label">${base.name}</div>
                <div class="compare-bar-bg">
                    <div class="compare-bar-fill" style="width:100%"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;color:#8b949e;">
                    <span>Base</span>
                    <span style="color:#3fb950;font-weight:700;">${base.score} pts · 100%</span>
                </div>
            </div>
            <div class="compare-bar-wrap">
                <div class="compare-bar-label">${target.name}</div>
                <div class="compare-bar-bg">
                    <div class="compare-bar-fill" style="width:${barWidth}%"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;color:#8b949e;">
                    <span>Target</span>
                    <span style="color:#58a6ff;font-weight:700;">${target.score} pts · ${pct}%</span>
                </div>
            </div>
        </div>
    `;
}

// ================================================================
// CPU STRESS TEST
// ================================================================

const CPUStressTest = {
    running: false,
    workers: [],
    urls: [],
    timer: 0,
    started: 0,
    duration: 0,
    operations: 0,
    fps: 0,
    lastFrame: 0,
    workerCount: 0,

    level: 1,
    maxLevel: 32,
    power: 10,

    canvas: null,
    ctx: null,
    animFrame: 0,
    spectrum: [],
    spectrumTarget: [],

    start(minutes) {
        if (this.running) return;
        if (!systemData || !Number.isInteger(systemData.cpuThreads)) {
            this.showMessage('Analyze the pasted CPU output before starting the CPU test.', 'error');
            return;
        }

        this.workerCount = systemData.cpuThreads;
        this.duration = Math.max(1, Math.min(Number(minutes) || 1, 120)) * 60;
        this.operations = 0;
        this.fps = 0;
        this.lastFrame = performance.now();
        this.started = performance.now();
        this.level = 1;
        this.power = 10;

        this.initSpectrum();

        this.running = true;
        this.startWorkers();
        this.timer = setInterval(() => this.update(), 1000);
        this.setButtons(true);

        this.frameLoop();
        this.drawSpectrum();

        this.showMessage(
            'CPU test running on ' + this.workerCount + ' analyzed threads.',
            'info'
        );
    },

    createWorker() {
        const source = `
            let running = true;
            let power = 10;
            let batch = 0;
            self.onmessage = function(e) {
                if (e.data === 'stop') { running = false; return; }
                if (e.data && Number.isFinite(e.data.power)) {
                    power = Math.max(1, Math.min(100, e.data.power));
                }
            };
            function run() {
                if (!running) return;
                const busyMs = Math.max(1, Math.round(12 * power / 100));
                const end = performance.now() + busyMs;
                let x = 0.123456789;
                while (performance.now() < end) {
                    for (let i = 0; i < 16384; i++) {
                        x = Math.sin(x * 1.6180339887 + i) * Math.cos(x + i * 0.000001)
                            + Math.sqrt((i & 1023) + 1);
                    }
                    batch += 16384;
                }
                if (batch >= 4194304) { self.postMessage(batch); batch = 0; }
                setTimeout(run, Math.max(0, 12 - busyMs));
            }
            run();
        `;
        const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
        this.urls.push(url);
        return new Worker(url);
    },

    startWorkers() {
        for (let i = 0; i < this.workerCount; i++) {
            const worker = this.createWorker();
            worker.onmessage = e => {
                if (this.running) this.operations += Number(e.data) || 0;
            };
            worker.postMessage({ power: this.power });
            this.workers.push(worker);
        }
    },

    frameLoop() {
        if (!this.running) return;
        this.fps++;
        requestAnimationFrame(() => this.frameLoop());
    },

    update() {
        if (!this.running) return;

        const now = performance.now();
        const elapsed = (now - this.started) / 1000;

        if (elapsed >= this.duration) {
            this.stop('CPU test completed successfully.');
            return;
        }

        const elapsedFrame = this.fps;
        this.fps = 0;

        if (elapsedFrame > CONFIG.FPS_LOW_THRESHOLD) {
            if (this.level < this.maxLevel) this.level++;
        } else {
            if (this.level > 1) this.level--;
        }

        const t = (this.level - 1) / (this.maxLevel - 1);
        this.power = Math.round(10 + t * 90);
        this.setPower(this.power);

        this.updateSpectrumTargets();

        const remaining = Math.max(0, this.duration - elapsed);
        this.updateStats(elapsed, remaining, elapsedFrame);
    },

    updateStats(elapsed, remaining, fps) {
        const set = (id, value) => {
            const e = document.getElementById(id);
            if (e) e.textContent = value;
        };
        set('stressFps', String(fps));
        set('stressLevel', String(this.level));
        set('stressElapsed', new Date(elapsed * 1000).toISOString().slice(14, 19));
        set('stressRemaining', new Date(remaining * 1000).toISOString().slice(14, 19));
        set('stressOps', this.operations.toLocaleString());
    },

    stopWorkers() {
        this.workers.forEach(w => {
            try { w.postMessage('stop'); w.terminate(); } catch (e) {}
        });
        this.workers = [];
        this.urls.forEach(URL.revokeObjectURL);
        this.urls = [];
    },

    stop(message) {
        if (!this.running) return;
        this.running = false;
        clearInterval(this.timer);
        this.timer = 0;
        cancelAnimationFrame(this.animFrame);
        this.animFrame = 0;
        this.stopWorkers();
        this.setButtons(false);
        this.showMessage(message || 'CPU test stopped.', 'success');
        this.spectrumTarget = this.spectrumTarget.map(() => 0);
    },

    setPower(value) {
        this.power = value;
        this.workers.forEach(worker => {
            try { worker.postMessage({ power: this.power }); } catch (e) {}
        });
    },

    setButtons(running) {
        const a = document.getElementById('startStressBtn');
        const b = document.getElementById('stopStressBtn');
        if (a) a.disabled = running;
        if (b) b.classList.toggle('hidden', !running);
    },

    showMessage(text, kind) {
        const e = document.getElementById('stressStatus');
        if (e) {
            e.className = 'status-message ' + kind;
            e.textContent = text;
        }
    },

    initSpectrum() {
        this.canvas = document.getElementById('stressCanvas');
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) this.ctx.scale(dpr, dpr);

        const bars = 48;
        this.spectrum = new Array(bars).fill(0);
        this.spectrumTarget = new Array(bars).fill(0);
    },

    updateSpectrumTargets() {
        const t = (this.level - 1) / (this.maxLevel - 1);
        const base = 0.15 + t * 0.85;
        for (let i = 0; i < this.spectrumTarget.length; i++) {
            const wobble = Math.sin(i * 1.7 + performance.now() / 300) * 0.15;
            const jitter = Math.random() * 0.08;
            this.spectrumTarget[i] = Math.min(1, Math.max(0.05, base + wobble + jitter));
        }
    },

    drawSpectrum() {
        if (!this.ctx || !this.canvas) return;
        if (!this.running && this.spectrumTarget.every(v => v === 0) &&
            this.spectrum.every(v => v === 0)) {
            this.clearCanvas();
            return;
        }

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        for (let i = 0; i < this.spectrum.length; i++) {
            this.spectrum[i] += (this.spectrumTarget[i] - this.spectrum[i]) * 0.12;
        }

        this.ctx.clearRect(0, 0, w, h);

        const styles = getComputedStyle(document.body);
        const accent = styles.getPropertyValue('--accent').trim() || '#6fa37a';
        const accentHot = styles.getPropertyValue('--accent-hot').trim() || accent;

        const barCount = this.spectrum.length;
        const gap = 2;
        const barWidth = (w - gap * (barCount - 1)) / barCount;

        for (let i = 0; i < barCount; i++) {
            const v = this.spectrum[i];
            const barH = v * (h - 6);
            const x = i * (barWidth + gap);
            const y = h - barH - 3;

            const grad = this.ctx.createLinearGradient(0, y, 0, h);
            grad.addColorStop(0, accentHot);
            grad.addColorStop(1, accent);

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(x, y, barWidth, barH);

            this.ctx.fillStyle = accentHot;
            this.ctx.fillRect(x, y, barWidth, 1);
        }

        this.animFrame = requestAnimationFrame(() => this.drawSpectrum());
    },

    clearCanvas() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        this.ctx.clearRect(0, 0, w, h);
    }
};

// ================================================================
// COMPARE INPUTS SETUP
// ================================================================

function setupCompareInputs() {
    setupCompareInput('cpuBaseInput', 'cpuBaseSuggestions', 'cpu', 'cpuBase');
    setupCompareInput('cpuTargetInput', 'cpuTargetSuggestions', 'cpu', 'cpuTarget');
    setupCompareInput('gpuBaseInput', 'gpuBaseSuggestions', 'gpu', 'gpuBase');
    setupCompareInput('gpuTargetInput', 'gpuTargetSuggestions', 'gpu', 'gpuTarget');
}

// ================================================================
// SYSTEM SUMMARY PANEL
// ================================================================

function showSystemSummary(data) {
    let panel = document.getElementById('systemSummaryPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'systemSummaryPanel';
        panel.style.cssText =
            'position:fixed;top:12px;right:12px;z-index:9999;' +
            'background:#111827;color:#e5e7eb;border:1px solid #374151;' +
            'border-radius:8px;padding:10px 12px;' +
            'font:13px/1.45 system-ui,sans-serif;' +
            'box-shadow:0 4px 18px rgba(0,0,0,.35);';
        document.body.appendChild(panel);
    }
    const os = osInfo && osInfo.displayName ? osInfo.displayName : 'Unknown OS';
    panel.textContent = os + ' | Threads: ' + (data.cpuThreads || 'Unknown');
}

// ================================================================
// EVENTS
// ================================================================

function setupEvents() {
    document.querySelectorAll('.mode-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            Theme.setMode(btn.dataset.mode);
        });
    });

    document.getElementById('quickModeBtn').addEventListener('click', () => {
        document.getElementById('modeSelection').classList.add('hidden');
        document.getElementById('quickBenchmark').classList.remove('hidden');
    });

    document.getElementById('autoModeBtn').addEventListener('click', () => {
        document.getElementById('modeSelection').classList.add('hidden');
        document.getElementById('autoBenchmark').classList.remove('hidden');
    });

    document.getElementById('autoBackBtn').addEventListener('click', () => {
        document.getElementById('modeSelection').classList.remove('hidden');
        document.getElementById('autoBenchmark').classList.add('hidden');
    });

    document.getElementById('downloadAutoBtn').addEventListener('click', () => {
        alert('Auto Benchmark download coming soon...');
    });

    document.getElementById('getScriptBtn').addEventListener('click', () => {
        const container = document.getElementById('scriptContainer');
        if (container.classList.contains('hidden')) {
            const script = generateScript(osInfo);
            if (script) {
                document.getElementById('scriptOutput').textContent = script;
                container.classList.remove('hidden');
            }
        } else {
            container.classList.add('hidden');
        }
    });

    document.getElementById('copyScriptBtn').addEventListener('click', function () {
        const text = document.getElementById('scriptOutput').textContent;
        const btn = this;
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            alert('Please copy manually.');
        });
    });

    document.getElementById('analyzeBtn').addEventListener('click', () => {
        const output = document.getElementById('outputInput').value;
        const statusDiv = document.getElementById('analysisStatus');
        const result = analyzeOutput(output);

        if (!result.success) {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = result.error;
            return;
        }

        systemData = result.data;
        Storage.save(systemData);
        showSystemSummary(systemData);

        statusDiv.className = 'status-message success';
        statusDiv.textContent = 'System analyzed successfully.';
        document.getElementById('scriptContainer').classList.add('hidden');
        document.getElementById('getScriptBtn').textContent = 'Done';
        showTools();
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.classList.contains('disabled')) return;
            const page = this.dataset.page;

            if (page === 'psurate') {
                showPage('psuratePage');
                document.getElementById('psuSearch').value = '';
                document.getElementById('psuModelSearch').value = '';
                document.getElementById('psuResults').innerHTML =
                    '<p class="text-muted center">Start typing to search...</p>';
                document.getElementById('psuModelResults').innerHTML =
                    '<p class="text-muted center">Start typing to search...</p>';
            } else if (page === 'compare') {
                showPage('comparePage');
                ['cpuBaseInput', 'cpuTargetInput', 'gpuBaseInput', 'gpuTargetInput']
                    .forEach(id => { document.getElementById(id).value = ''; });
                ['cpuResults', 'gpuResults']
                    .forEach(id => { document.getElementById(id).classList.add('hidden'); });
                compareState.cpuBase = null;
                compareState.cpuTarget = null;
                compareState.gpuBase = null;
                compareState.gpuTarget = null;
                setupCompareInputs();
            } else if (page === 'stress') {
                if (!systemData || !Number.isInteger(systemData.cpuThreads)) {
                    alert('Complete My Specs first.');
                    return;
                }
                showPage('stressPage');
                CPUStressTest.stop('CPU test stopped.');
            }
        });
    });

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            CPUStressTest.stop('CPU test stopped.');
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            showTools();
            changeSlogan();
        });
    });

    document.getElementById('psuPublicTab').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('psuModelTab').classList.remove('active');
        document.getElementById('psuPublicContent').classList.remove('hidden');
        document.getElementById('psuModelContent').classList.add('hidden');
    });
    document.getElementById('psuModelTab').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('psuPublicTab').classList.remove('active');
        document.getElementById('psuPublicContent').classList.add('hidden');
        document.getElementById('psuModelContent').classList.remove('hidden');
    });

    document.getElementById('psuSearch').addEventListener('input', function () {
        renderPSUResults(this.value);
    });
    document.getElementById('psuModelSearch').addEventListener('input', function () {
        renderPSUModelResults(this.value);
    });

    document.getElementById('compareCpuTab').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('compareGpuTab').classList.remove('active');
        document.getElementById('compareCpuContent').classList.remove('hidden');
        document.getElementById('compareGpuContent').classList.add('hidden');
    });
    document.getElementById('compareGpuTab').addEventListener('click', function () {
        this.classList.add('active');
        document.getElementById('compareCpuTab').classList.remove('active');
        document.getElementById('compareCpuContent').classList.add('hidden');
        document.getElementById('compareGpuContent').classList.remove('hidden');
    });

    document.getElementById('startStressBtn').addEventListener('click', () => {
        CPUStressTest.start(parseInt(document.getElementById('stressDuration').value, 10));
    });
    document.getElementById('stopStressBtn').addEventListener('click', () => {
        CPUStressTest.stop('CPU test stopped manually.');
    });
}

// ================================================================
// INITIALIZATION
// ================================================================

async function init() {
    Theme.init();

    osInfo = detectOS();
    document.getElementById('osDisplay').textContent = osInfo.displayName;

    const getScriptBtn = document.getElementById('getScriptBtn');
    if (!osInfo.isLimitedMode && (osInfo.isWindows || (osInfo.isLinux && !osInfo.isARM))) {
        getScriptBtn.disabled = false;
    } else {
        getScriptBtn.disabled = true;
        getScriptBtn.style.opacity = '0.25';
    }

    if (osInfo.isLimitedMode) {
        document.getElementById('analyzeSection').style.opacity = '0.25';
        document.getElementById('analyzeSection').style.pointerEvents = 'none';
        document.querySelectorAll('.tool-btn').forEach(btn => {
            if (btn.dataset.page === 'stress') {
                btn.classList.add('disabled');
            }
        });
    }

    initSlogans();

    document.querySelectorAll('.tool-btn[data-page="report"]').forEach(btn => btn.remove());

    setupEvents();

    await fetchData();

    console.log("Bench'n'Bench ready.");
}

document.addEventListener('DOMContentLoaded', init);