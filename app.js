// ==========================================================================
// Hikari Guide Designer - Core JavaScript Logic (4K Full 16:9 Screen Edition)
// ==========================================================================

// 4K 16:9 設計用のスケール定数 (3840x2160 から表示サイズ 960x540 への変換)
const SCALE = 0.25; 
const MAX_X = 3840;
const MAX_Y = 2160;

// プロジェクトデータ状態
let projectData = [];
let activeObjectId = null;
let appMode = 'edit'; // 'edit' or 'sim'
let depthControlActive = false; // 深度マップ表示中か

// 仮想PLCレジスタのキャッシュ
let plcRegisters = {};

// UIオブジェクトのデフォルト設定 (4K 3840x2160 基準のサイズ)
const OBJECT_DEFAULTS = {
    // 1. 操作(スイッチ)・入力系
    switch: { w: 480, h: 336, text: 'BIT SWITCH', depth: 10.0, deviceType: 'M', deviceAddr: 101, color: '#00f0ff', state: false },
    switch_word: { w: 480, h: 336, text: 'SET VALUE', depth: 8.0, deviceType: 'D', deviceAddr: 10, color: '#00f0ff', state: 50 },
    switch_num: { w: 480, h: 336, text: 'KEYPAD IN', depth: 8.0, deviceType: 'D', deviceAddr: 11, color: '#00f0ff', state: 128 },
    switch_str: { w: 480, h: 336, text: 'NAME IN', depth: 8.0, deviceType: 'D', deviceAddr: 12, color: '#00f0ff', state: 'LINE A' },
    switch_screen: { w: 480, h: 336, text: 'PAGE NEXT', depth: 8.0, deviceType: 'D', deviceAddr: 13, color: '#00f0ff', state: 2 },

    // 2. 表示・インジケータ系
    lamp: { w: 336, h: 336, text: 'BIT LAMP', depth: 5.0, deviceType: 'M', deviceAddr: 101, color: '#00ff66', state: false },
    lamp_word: { w: 336, h: 336, text: 'STATUS', depth: 5.0, deviceType: 'D', deviceAddr: 2, color: '#ff007f', state: 0 },
    display: { w: 576, h: 240, text: 'NUM DISPLAY', depth: -5.0, deviceType: 'D', deviceAddr: 50, color: '#00f0ff', state: 350 },
    display_str: { w: 576, h: 240, text: 'STR DISPLAY', depth: -5.0, deviceType: 'D', deviceAddr: 51, color: '#00ff66', state: 'NORMAL' },

    // 3. メーター・グラフ系
    meter_analog: { w: 480, h: 480, text: 'PRESSURE', depth: -8.0, deviceType: 'D', deviceAddr: 52, color: '#00f0ff', state: 45, maxVal: 100 },
    meter: { w: 768, h: 288, text: 'LEVEL BAR', depth: -10.0, deviceType: 'D', deviceAddr: 53, color: '#ffb300', state: 65, maxVal: 100 },
    graph_trend: { w: 960, h: 576, text: 'TREND LOG', depth: -12.0, deviceType: 'D', deviceAddr: 52, color: '#00ff66', state: 45, maxVal: 100 },
    graph_line: { w: 960, h: 576, text: 'PROFILE', depth: -12.0, deviceType: 'D', deviceAddr: 53, color: '#ffb300', state: 65, maxVal: 100 },

    // 4. データ・イベント管理系
    alarm_list: { w: 1152, h: 576, text: 'ALARM HIST', depth: -15.0, deviceType: 'M', deviceAddr: 999, color: '#ff007f', state: false },
    recipe_table: { w: 1152, h: 576, text: 'RECIPES', depth: -15.0, deviceType: 'D', deviceAddr: 60, color: '#00f0ff', state: 1 },
    logging_list: { w: 1152, h: 576, text: 'LOG HIST', depth: -15.0, deviceType: 'D', deviceAddr: 52, color: '#00ff66', state: 45 },

    text: { w: 768, h: 144, text: 'LABEL TEXT', depth: 15.0, deviceType: 'D', deviceAddr: 0, color: '#f8fafc' }
};

// Canvas 要素
const depthCanvas = document.getElementById('depth-canvas');
const depthCtx = depthCanvas.getContext('2d');
const rgbContainer = document.getElementById('rgb-canvas-container');

// 初期設定
window.addEventListener('load', () => {
    setMode('edit');
    loadSample('factory'); // デフォルトでリッチなダミーUIデータをロード
    setupDragDropContainer();
    
    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        if (appMode === 'edit' && activeObjectId && (e.key === 'Delete' || e.key === 'Backspace')) {
            const activeTag = document.activeElement.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
            deleteActiveObject();
        }
    });
});

// ==========================================================================
// ツールボックス階層化 (アコーディオン) の制御
// ==========================================================================
function toggleAccordion(btn) {
    const content = btn.nextElementSibling;
    const isActive = btn.classList.contains('active');
    
    // 全て閉じる
    document.querySelectorAll('.accordion-header').forEach(h => {
        h.classList.remove('active');
        h.nextElementSibling.style.display = 'none';
    });
    
    // トグル動作
    if (!isActive) {
        btn.classList.add('active');
        content.style.display = 'grid';
    }
}

// ==========================================================================
// モード・深度表示の切替制御
// ==========================================================================
function setMode(mode) {
    appMode = mode;
    document.body.className = `mode-${mode}`;
    
    const btnEdit = document.getElementById('btn-mode-edit');
    const btnSim = document.getElementById('btn-mode-sim');
    const statusText = document.getElementById('active-mode-status');
    const toolbox = document.getElementById('section-toolbox');

    if (mode === 'edit') {
        btnEdit.classList.add('active');
        btnSim.classList.remove('active');
        statusText.textContent = 'DESIGNING MODE';
        statusText.style.color = 'var(--color-cyan)';
        toolbox.style.opacity = '1';
        toolbox.style.pointerEvents = 'auto';
        
        resetSimStates();
    } else {
        btnSim.classList.add('active');
        btnEdit.classList.remove('active');
        statusText.textContent = 'SIMULATION RUNNING';
        statusText.style.color = 'var(--color-magenta)';
        toolbox.style.opacity = '0.5';
        toolbox.style.pointerEvents = 'none';
        
        deselectAll();
        buildPlcRegisterUI();

        if (depthControlActive) {
            toggleDepthControl();
        }
    }
    
    updateAllUIElements();
    renderDepthMap();
}

function toggleDepthControl() {
    depthControlActive = !depthControlActive;
    
    const btn = document.getElementById('btn-depth-control');
    const canvas = document.getElementById('depth-canvas');
    const viewLabel = document.getElementById('view-mode-label');
    
    if (depthControlActive) {
        btn.classList.add('active');
        canvas.classList.add('active');
        btn.innerHTML = `<i class="fa-solid fa-eye"></i> RGB Control`;
        viewLabel.textContent = "DEPTH VIEW (Grayscale)";
        viewLabel.style.color = "var(--color-magenta)";
        renderDepthMap();
    } else {
        btn.classList.remove('active');
        canvas.classList.remove('active');
        btn.innerHTML = `<i class="fa-solid fa-circle-half-stroke"></i> Depth Control`;
        viewLabel.textContent = "RGB VIEW";
        viewLabel.style.color = "rgba(255, 255, 255, 0.3)";
    }
}

// ==========================================================================
// オブジェクトの追加・削除・選択
// ==========================================================================
function addNewObject(type) {
    if (appMode !== 'edit') return;

    const id = `${type}_${Date.now()}`;
    const defaults = OBJECT_DEFAULTS[type];
    
    const x = Math.round((MAX_X - defaults.w) / 2);
    const y = Math.round((MAX_Y - defaults.h) / 2);

    const newObj = {
        id,
        type,
        x,
        y,
        ...JSON.parse(JSON.stringify(defaults)) 
    };

    projectData.push(newObj);
    createDOMElement(newObj);
    selectObject(id);
    renderDepthMap();
}

function deleteActiveObject() {
    if (!activeObjectId || appMode !== 'edit') return;
    
    const el = document.getElementById(activeObjectId);
    if (el) el.remove();
    
    projectData = projectData.filter(o => o.id !== activeObjectId);
    
    deselectAll();
    renderDepthMap();
}

function selectObject(id) {
    if (appMode !== 'edit') return;

    deselectAll();
    activeObjectId = id;
    
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
    
    const obj = projectData.find(o => o.id === id);
    if (obj) {
        document.getElementById('no-selection-msg').classList.add('hidden');
        const form = document.getElementById('property-form');
        form.classList.remove('hidden');
        
        document.getElementById('prop-id').value = obj.id;
        document.getElementById('prop-depth').value = obj.depth;
        document.getElementById('prop-depth-val').textContent = `${Number(obj.depth).toFixed(1)} mm`;
        document.getElementById('prop-device-type').value = obj.deviceType;
        document.getElementById('prop-device-addr').value = obj.deviceAddr;
        document.getElementById('prop-text').value = obj.text;
        
        document.getElementById('prop-x').value = obj.x;
        document.getElementById('prop-y').value = obj.y;
        document.getElementById('prop-w').value = obj.w;
        document.getElementById('prop-h').value = obj.h;

        const maxGroup = document.getElementById('group-prop-max');
        if (obj.type.startsWith('meter') || obj.type.startsWith('graph')) {
            maxGroup.classList.remove('hidden');
            document.getElementById('prop-max').value = obj.maxVal || 100;
        } else {
            maxGroup.classList.add('hidden');
        }

        const dots = document.querySelectorAll('.color-dot');
        dots.forEach(dot => {
            dot.classList.remove('active');
            const colorMap = {
                '#00f0ff': 'cyan',
                '#ff007f': 'magenta',
                '#00ff66': 'green',
                '#ffb300': 'amber',
                '#0066ff': 'blue'
            };
            if (colorMap[obj.color] && dot.classList.contains(colorMap[obj.color])) {
                dot.classList.add('active');
            }
        });
    }
}

function deselectAll() {
    activeObjectId = null;
    document.querySelectorAll('.ui-element').forEach(el => el.classList.remove('selected'));
    document.getElementById('no-selection-msg').classList.remove('hidden');
    document.getElementById('property-form').classList.add('hidden');
}

// ==========================================================================
// DOM要素 (UIパーツ) の生成と更新 (ラッパー・リサイズハンドル構造)
// ==========================================================================
function createDOMElement(obj) {
    const el = document.createElement('div');
    el.id = obj.id;
    el.className = 'ui-element';
    el.setAttribute('data-type', obj.type);
    
    // 1. 内容表示用のインナーラッパー
    const contentEl = document.createElement('div');
    contentEl.className = 'ui-element-content';
    contentEl.style.width = '100%';
    contentEl.style.height = '100%';
    contentEl.innerHTML = getObjectHTML(obj);
    el.appendChild(contentEl);
    
    // 2. リサイズハンドル
    const handleEl = document.createElement('div');
    handleEl.className = 'resize-handle';
    el.appendChild(handleEl);
    
    updateDOMStyle(el, obj);

    // 移動ドラッグ用
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return; // リサイズ時は移動処理をパス
        if (appMode === 'edit') {
            selectObject(obj.id);
            startDrag(e, el, obj);
        } else {
            handleSimulationClick(obj);
        }
    });

    // リサイズ用
    handleEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (appMode === 'edit') {
            startResize(e, obj, el);
        }
    });

    rgbContainer.appendChild(el);
}

function updateDOMStyle(el, obj) {
    el.style.left = `${obj.x * SCALE}px`;
    el.style.top = `${obj.y * SCALE}px`;
    el.style.width = `${obj.w * SCALE}px`;
    el.style.height = `${obj.h * SCALE}px`;
    el.style.setProperty('--theme-color', obj.color);
}

function getObjectHTML(obj) {
    const stateVal = obj.state !== undefined ? obj.state : 0;
    const themeColor = obj.color;

    switch (obj.type) {
        // 1. 操作スイッチバリエーション
        case 'switch':
            return `
                <div class="switch-bg">
                    <span class="switch-text">${obj.text}</span>
                    <div class="switch-indicator"></div>
                </div>
            `;
        case 'switch_word':
            return `
                <div class="switch-word-box">
                    <div class="switch-header"><span>${obj.text}</span><span>WORD</span></div>
                    <div class="switch-val-row"><span class="switch-val">${stateVal}</span><i class="fa-solid fa-square-plus switch-icon"></i></div>
                </div>
            `;
        case 'switch_num':
            return `
                <div class="switch-num-box">
                    <div class="switch-header"><span>${obj.text}</span><span>NUM IN</span></div>
                    <div class="switch-val-row"><span class="switch-val">${stateVal}</span><i class="fa-solid fa-calculator switch-icon"></i></div>
                </div>
            `;
        case 'switch_str':
            return `
                <div class="switch-str-box">
                    <div class="switch-header"><span>${obj.text}</span><span>STR IN</span></div>
                    <div class="switch-val-row"><span class="switch-val">${stateVal}</span><i class="fa-solid fa-keyboard switch-icon"></i></div>
                </div>
            `;
        case 'switch_screen':
            return `
                <div class="switch-screen-box">
                    <div class="switch-header"><span>${obj.text}</span><span>SCREEN</span></div>
                    <div class="switch-val-row"><span class="switch-val">PAGE ${stateVal}</span><i class="fa-solid fa-arrow-right-to-bracket switch-icon"></i></div>
                </div>
            `;

        // 2. 表示・ランプバリエーション
        case 'lamp':
            return `
                <div class="lamp-body">
                    <span class="lamp-text">${obj.text}</span>
                </div>
            `;
        case 'lamp_word':
            let lampColor = '#1e293b'; 
            if (stateVal === 1) lampColor = 'var(--color-amber)';
            if (stateVal >= 2) lampColor = 'var(--color-magenta)';
            
            return `
                <div class="lamp-hexagon" style="background: ${stateVal > 0 ? lampColor : '#1e293b'}; box-shadow: ${stateVal > 0 ? '0 0 15px ' + lampColor : 'none'}; border-color: ${stateVal > 0 ? lampColor : 'rgba(255,255,255,0.1)'}">
                    <span>${obj.text}</span>
                </div>
            `;
        case 'display':
            return `
                <div class="display-box">
                    <span class="display-label">${obj.text}</span>
                    <span class="display-val">${stateVal}</span>
                </div>
            `;
        case 'display_str':
            return `
                <div class="display-box">
                    <span class="display-label">${obj.text}</span>
                    <span class="display-val" style="font-family: var(--font-sans); font-size: 13px;">${stateVal}</span>
                </div>
            `;

        // 3. メーター・グラフバリエーション
        case 'meter_analog':
            const angle = -90 + (Math.max(0, Math.min(100, stateVal)) / 100) * 180;
            return `
                <div class="meter-analog-box">
                    <span class="meter-analog-label">${obj.text}</span>
                    <span class="meter-analog-val">${stateVal}</span>
                    <svg class="meter-svg" viewBox="0 0 100 60">
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1e293b" stroke-width="6" />
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="${themeColor}" stroke-width="6" stroke-dasharray="126" stroke-dashoffset="${126 - (stateVal / 100) * 126}" />
                        <line x1="50" y1="50" x2="${50 + 35 * Math.cos(angle * Math.PI / 180)}" y2="${50 + 35 * Math.sin(angle * Math.PI / 180)}" stroke="#f8fafc" stroke-width="3" />
                        <circle cx="50" cy="50" r="5" fill="#f8fafc" />
                    </svg>
                </div>
            `;
        case 'meter':
            const meterPct = obj.maxVal ? Math.round((stateVal / obj.maxVal) * 100) : 50;
            return `
                <div class="meter-box">
                    <div class="meter-header">
                        <span>${obj.text}</span>
                        <span class="font-mono">${stateVal}</span>
                    </div>
                    <div class="meter-bar-bg">
                        <div class="meter-bar-fill" style="width: ${meterPct}%;"></div>
                    </div>
                </div>
            `;
        case 'graph_trend':
            return `
                <div class="graph-box">
                    <span class="graph-header">${obj.text} (Trend)</span>
                    <div class="graph-plot-area">
                        <svg class="graph-svg-line" viewBox="0 0 100 50" preserveAspectRatio="none">
                            <path d="M 0 45 Q 25 ${50 - stateVal * 0.4} 50 20 T 100 ${50 - stateVal * 0.8}" fill="none" stroke="${themeColor}" stroke-width="2" />
                        </svg>
                    </div>
                </div>
            `;
        case 'graph_line':
            return `
                <div class="graph-box">
                    <span class="graph-header">${obj.text} (Profile)</span>
                    <div class="graph-plot-area">
                        <svg class="graph-svg-line" viewBox="0 0 100 50" preserveAspectRatio="none">
                            <polyline points="0,45 20,35 40,${50 - stateVal * 0.5} 60,15 80,30 100,${50 - stateVal * 0.8}" fill="none" stroke="${themeColor}" stroke-width="2" />
                        </svg>
                    </div>
                </div>
            `;

        // 4. データ・イベント管理バリエーション
        case 'alarm_list':
            const isAlarm = stateVal === true;
            return `
                <div class="table-box">
                    <span class="table-title">${obj.text}</span>
                    <table class="table-widget">
                        <thead>
                            <tr><th>TIME</th><th>MSG</th><th>ST.</th></tr>
                        </thead>
                        <tbody>
                            <tr class="${isAlarm ? 'table-row-alert' : 'table-row-normal'}">
                                <td>20:45</td><td>${isAlarm ? 'CORE TEMP OVER' : 'SYSTEM NORMAL'}</td><td>${isAlarm ? 'ALM' : 'OK'}</td>
                            </tr>
                            <tr class="table-row-normal">
                                <td>19:22</td><td>PUMP A ONLINE</td><td>OK</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        case 'recipe_table':
            return `
                <div class="table-box">
                    <span class="table-title">${obj.text} (RECIPE SELECT)</span>
                    <table class="table-widget">
                        <thead>
                            <tr><th>ID</th><th>NAME</th><th>TEMP</th></tr>
                        </thead>
                        <tbody>
                            <tr style="${stateVal === 1 ? 'background: rgba(0, 240, 255, 0.15)' : ''}">
                                <td>#01</td><td>PROD_A (Standard)</td><td>85 C</td>
                            </tr>
                            <tr style="${stateVal === 2 ? 'background: rgba(0, 240, 255, 0.15)' : ''}">
                                <td>#02</td><td>PROD_B (High-Temp)</td><td>120 C</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        case 'logging_list':
            return `
                <div class="table-box">
                    <span class="table-title">${obj.text} (LOG HISTORY)</span>
                    <table class="table-widget">
                        <thead>
                            <tr><th>TIME</th><th>TEMP</th><th>PRESS</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>20:55</td><td>${stateVal} C</td><td>350 kPa</td></tr>
                            <tr><td>20:50</td><td>${Math.max(0, stateVal - 2)} C</td><td>348 kPa</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
        case 'text':
            return `<span class="label-text" style="color: ${obj.color}">${obj.text}</span>`;
    }
    return '';
}

function updateAllUIElements() {
    projectData.forEach(obj => {
        const el = document.getElementById(obj.id);
        if (el) {
            updateDOMStyle(el, obj);
            
            // インナーコンテンツのみを更新することでハンドル要素を維持
            const contentEl = el.querySelector('.ui-element-content');
            if (contentEl) {
                contentEl.innerHTML = getObjectHTML(obj);
            }
            
            const stateVal = obj.state;
            
            if (obj.type === 'lamp_word') {
                el.className = 'ui-element';
                if (stateVal === 1) el.classList.add('active-state-1');
                else if (stateVal >= 2) el.classList.add('active-state-2');
            } else {
                if (stateVal === true || stateVal > 0) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }

            if (activeObjectId === obj.id) {
                el.classList.add('selected');
            }
        }
    });
}

// ==========================================================================
// スマートガイド（スナップ）制御
// ==========================================================================
const SNAP_THRESHOLD = 40; // 4K解像度上の閾値 (画面上10px相当)

function showSmartGuideV(x) {
    const guide = document.getElementById('smart-guide-v');
    if (guide) {
        guide.style.display = 'block';
        guide.style.left = `${x * SCALE}px`;
    }
}

function showSmartGuideH(y) {
    const guide = document.getElementById('smart-guide-h');
    if (guide) {
        guide.style.display = 'block';
        guide.style.top = `${y * SCALE}px`;
    }
}

function hideSmartGuides() {
    const v = document.getElementById('smart-guide-v');
    const h = document.getElementById('smart-guide-h');
    if (v) v.style.display = 'none';
    if (h) h.style.display = 'none';
}

function getSnapTargets(excludeId) {
    const targets = { x: [], y: [] };
    projectData.forEach(obj => {
        if (obj.id === excludeId) return;
        targets.x.push(obj.x);
        targets.x.push(Math.round(obj.x + obj.w / 2));
        targets.x.push(obj.x + obj.w);
        
        targets.y.push(obj.y);
        targets.y.push(Math.round(obj.y + obj.h / 2));
        targets.y.push(obj.y + obj.h);
    });
    return targets;
}

// ==========================================================================
// ドラッグ＆ドロップ制御 (移動用)
// ==========================================================================
function setupDragDropContainer() {
    rgbContainer.addEventListener('mousedown', (e) => {
        if (e.target === rgbContainer || e.target.classList.contains('grid-overlay')) {
            deselectAll();
        }
    });
}

function startDrag(e, el, obj) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialObjX = obj.x;
    const initialObjY = obj.y;
    
    const snapTargets = getSnapTargets(obj.id);

    function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newX = initialObjX + Math.round(deltaX / SCALE);
        let newY = initialObjY + Math.round(deltaY / SCALE);

        hideSmartGuides();

        if (moveEvent.shiftKey) {
            newX = Math.round(newX / 40) * 40;
            newY = Math.round(newY / 40) * 40;
        } else {
            let snappedX = false;
            const myX = [newX, Math.round(newX + obj.w / 2), newX + obj.w];
            for (let i = 0; i < myX.length; i++) {
                for (let t of snapTargets.x) {
                    if (Math.abs(myX[i] - t) <= SNAP_THRESHOLD) {
                        if (i === 0) newX = t;
                        else if (i === 1) newX = t - Math.round(obj.w / 2);
                        else newX = t - obj.w;
                        showSmartGuideV(t);
                        snappedX = true;
                        break;
                    }
                }
                if (snappedX) break;
            }

            let snappedY = false;
            const myY = [newY, Math.round(newY + obj.h / 2), newY + obj.h];
            for (let i = 0; i < myY.length; i++) {
                for (let t of snapTargets.y) {
                    if (Math.abs(myY[i] - t) <= SNAP_THRESHOLD) {
                        if (i === 0) newY = t;
                        else if (i === 1) newY = t - Math.round(obj.h / 2);
                        else newY = t - obj.h;
                        showSmartGuideH(t);
                        snappedY = true;
                        break;
                    }
                }
                if (snappedY) break;
            }
        }

        newX = Math.max(0, Math.min(MAX_X - obj.w, newX));
        newY = Math.max(0, Math.min(MAX_Y - obj.h, newY));

        obj.x = newX;
        obj.y = newY;

        el.style.left = `${newX * SCALE}px`;
        el.style.top = `${newY * SCALE}px`;

        if (activeObjectId === obj.id) {
            document.getElementById('prop-x').value = newX;
            document.getElementById('prop-y').value = newY;
        }

        if (depthControlActive) {
            renderDepthMap();
        }
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        hideSmartGuides();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ==========================================================================
// リサイズ制御 (四角は縦横自在、丸(Lamp)は均等サイズ変更)
// ==========================================================================
function startResize(e, obj, el) {
    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = obj.w;
    const initialH = obj.h;

    const snapTargets = getSnapTargets(obj.id);

    function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // 4K解像度に逆スケーリングしてリサイズ量を加算
        let newW = initialW + Math.round(deltaX / SCALE);
        let newH = initialH + Math.round(deltaY / SCALE);

        hideSmartGuides();

        if (moveEvent.shiftKey) {
            newW = Math.round(newW / 40) * 40;
            newH = Math.round(newH / 40) * 40;
        } else {
            let snappedX = false;
            const myRightX = obj.x + newW;
            for (let t of snapTargets.x) {
                if (Math.abs(myRightX - t) <= SNAP_THRESHOLD) {
                    newW = t - obj.x;
                    showSmartGuideV(t);
                    snappedX = true;
                    break;
                }
            }

            let snappedY = false;
            const myBottomY = obj.y + newH;
            for (let t of snapTargets.y) {
                if (Math.abs(myBottomY - t) <= SNAP_THRESHOLD) {
                    newH = t - obj.y;
                    showSmartGuideH(t);
                    snappedY = true;
                    break;
                }
            }
        }

        // 最小幅・高さの制限
        newW = Math.max(160, newW);
        newH = Math.max(160, newH);

        if (obj.type === 'lamp') {
            // 丸型 (Lamp) は縦横比1:1維持 (均等サイズ変更のみ)
            let size = Math.max(160, initialW + Math.round((deltaX + deltaY) / 2 / SCALE));
            if (moveEvent.shiftKey) {
                size = Math.round(size / 40) * 40;
            }
            obj.w = size;
            obj.h = size;
        } else {
            // 四角形オブジェクトは縦横自在にサイズ引き伸ばし可能
            obj.w = newW;
            obj.h = newH;
        }

        // 表示スタイル更新
        updateDOMStyle(el, obj);
        const contentEl = el.querySelector('.ui-element-content');
        if (contentEl) {
            contentEl.innerHTML = getObjectHTML(obj);
        }

        if (activeObjectId === obj.id) {
            document.getElementById('prop-w').value = obj.w;
            document.getElementById('prop-h').value = obj.h;
        }

        renderDepthMap();
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        hideSmartGuides();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ==========================================================================
// プロパティパネルからの更新ロジック
// ==========================================================================
function updateActiveObjectDepth(val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        obj.depth = parseFloat(val);
        document.getElementById('prop-depth-val').textContent = `${obj.depth.toFixed(1)} mm`;
        if (depthControlActive) renderDepthMap();
    }
}

function updateActiveObjectDeviceType(val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        obj.deviceType = val;
    }
}

function updateActiveObjectDeviceAddr(val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        obj.deviceAddr = parseInt(val) || 0;
    }
}

function updateActiveObjectText(val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        obj.text = val;
        updateAllUIElements();
        if (depthControlActive) renderDepthMap();
    }
}

function updateActiveObjectGeometry(prop, val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        const num = parseInt(val) || 0;
        obj[prop] = num;

        // 丸型 (Lamp) の場合はプロパティ手入力時も縦横比1:1を維持
        if (obj.type === 'lamp') {
            if (prop === 'w') {
                obj.h = num;
                const hInput = document.getElementById('prop-h');
                if (hInput) hInput.value = num;
            } else if (prop === 'h') {
                obj.w = num;
                const wInput = document.getElementById('prop-w');
                if (wInput) wInput.value = num;
            }
        }

        updateAllUIElements();
        if (depthControlActive) renderDepthMap();
    }
}

function updateActiveObjectMax(val) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj && (obj.type.startsWith('meter') || obj.type.startsWith('graph'))) {
        obj.maxVal = parseInt(val) || 100;
        updateAllUIElements();
    }
}

function updateActiveObjectColor(color) {
    if (!activeObjectId) return;
    const obj = projectData.find(o => o.id === activeObjectId);
    if (obj) {
        obj.color = color;
        
        const dots = document.querySelectorAll('.color-dot');
        dots.forEach(dot => dot.classList.remove('active'));
        if (event && event.target) {
            event.target.classList.add('active');
        }

        updateAllUIElements();
    }
}

function changeZIndex(direction) {
    if (!activeObjectId || appMode !== 'edit') return;
    
    const index = projectData.findIndex(o => o.id === activeObjectId);
    if (index === -1) return;

    const obj = projectData[index];
    
    if (direction === 'front' && index < projectData.length - 1) {
        projectData.splice(index, 1);
        projectData.push(obj);
    } else if (direction === 'back' && index > 0) {
        projectData.splice(index, 1);
        projectData.unshift(obj);
    } else {
        return;
    }

    const container = document.getElementById('rgb-canvas-container');
    projectData.forEach(o => {
        const el = document.getElementById(o.id);
        if (el) container.appendChild(el);
    });

    if (depthControlActive) renderDepthMap();
}

// ==========================================================================
// 深度マップ Canvas レンダリング (3840x2160 フルスクリーン・16種類の形状対応)
// ==========================================================================
let pendingDepthRender = false;

function renderDepthMap() {
    if (!depthControlActive && appMode !== 'sim') return; // 表示不要ならスキップ
    if (pendingDepthRender) return;
    pendingDepthRender = true;
    requestAnimationFrame(() => {
        renderDepthMapImpl();
        pendingDepthRender = false;
    });
}

function renderDepthMapImpl() {
    depthCtx.fillStyle = 'rgb(128, 128, 128)'; 
    depthCtx.fillRect(0, 0, MAX_X, MAX_Y);

    projectData.forEach(obj => {
        const gray = Math.round(128 + (obj.depth / 20.0) * 127);
        const colorStr = `rgb(${gray}, ${gray}, ${gray})`;
        
        depthCtx.fillStyle = colorStr;
        depthCtx.strokeStyle = colorStr;

        switch (obj.type) {
            // 1. スイッチ系
            case 'switch':
            case 'switch_word':
            case 'switch_num':
            case 'switch_str':
            case 'switch_screen':
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 24, true);
                
                if (appMode === 'sim' && (obj.state === true || obj.state > 0)) {
                    const activeGray = Math.min(255, Math.round(128 + ((obj.depth + 4.0) / 20.0) * 127));
                    depthCtx.fillStyle = `rgb(${activeGray}, ${activeGray}, ${activeGray})`;
                    drawRoundRect(depthCtx, obj.x + obj.w/2 - 48, obj.y + obj.h - 56, 96, 24, 12, true);
                }
                break;

            // 2. 表示ランプ系
            case 'lamp':
                depthCtx.beginPath();
                const rad = Math.min(obj.w, obj.h) / 2;
                depthCtx.arc(obj.x + rad, obj.y + rad, rad, 0, Math.PI * 2);
                depthCtx.fill();
                break;
                
            case 'lamp_word':
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 48, true);
                break;

            case 'display':
            case 'display_str':
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 16, true);
                break;

            // 3. メーター・グラフ系
            case 'meter_analog':
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 24, true);
                
                const needleGray = Math.min(255, Math.round(128 + ((obj.depth + 3.0) / 20.0) * 127));
                depthCtx.strokeStyle = `rgb(${needleGray}, ${needleGray}, ${needleGray})`;
                depthCtx.lineWidth = 12;
                depthCtx.lineCap = 'round';
                
                const val = obj.state || 0;
                const angle = -90 + (Math.max(0, Math.min(100, val)) / 100) * 180;
                const needleRad = Math.min(obj.w, obj.h) * 0.35;
                const cX = obj.x + obj.w / 2;
                const cY = obj.y + obj.h * 0.6;
                
                depthCtx.beginPath();
                depthCtx.moveTo(cX, cY);
                depthCtx.lineTo(cX + needleRad * Math.cos(angle * Math.PI / 180), cY + needleRad * Math.sin(angle * Math.PI / 180));
                depthCtx.stroke();
                break;

            case 'meter':
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 32, true);
                
                const barGray = Math.max(0, Math.round(128 + ((obj.depth - 3.0) / 20.0) * 127));
                depthCtx.fillStyle = `rgb(${barGray}, ${barGray}, ${barGray})`;
                
                const barX = obj.x + 32;
                const barY = obj.y + 88;
                const barW = obj.w - 64;
                const barH = obj.h - 120;
                drawRoundRect(depthCtx, barX, barY, barW, barH, 16, true);
                
                if (obj.state > 0) {
                    const fillGray = Math.min(255, Math.round(128 + ((obj.depth + 2.0) / 20.0) * 127));
                    depthCtx.fillStyle = `rgb(${fillGray}, ${fillGray}, ${fillGray})`;
                    const fillW = Math.round(barW * (obj.state / (obj.maxVal || 100)));
                    drawRoundRect(depthCtx, barX, barY, Math.min(barW, fillW), barH, 16, true);
                }
                break;

            case 'graph_trend':
            case 'graph_line':
                const gBgGray = Math.max(0, Math.round(128 + ((obj.depth - 2.0) / 20.0) * 127));
                depthCtx.fillStyle = `rgb(${gBgGray}, ${gBgGray}, ${gBgGray})`;
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 24, true);
                
                const lineGray = Math.min(255, Math.round(128 + ((obj.depth + 3.0) / 20.0) * 127));
                depthCtx.strokeStyle = `rgb(${lineGray}, ${lineGray}, ${lineGray})`;
                depthCtx.lineWidth = 8;
                depthCtx.beginPath();
                depthCtx.moveTo(obj.x + 40, obj.y + obj.h - 80);
                depthCtx.lineTo(obj.x + obj.w * 0.3, obj.y + obj.h * 0.5);
                depthCtx.lineTo(obj.x + obj.w * 0.6, obj.y + obj.h * 0.3);
                depthCtx.lineTo(obj.x + obj.w - 40, obj.y + obj.h - 120);
                depthCtx.stroke();
                break;

            // 4. データ管理テーブル系 (アラーム、レシピ、ロギング)
            case 'alarm_list':
            case 'recipe_table':
            case 'logging_list':
                const tBgGray = Math.max(0, Math.round(128 + ((obj.depth - 3.0) / 20.0) * 127));
                depthCtx.fillStyle = `rgb(${tBgGray}, ${tBgGray}, ${tBgGray})`;
                drawRoundRect(depthCtx, obj.x, obj.y, obj.w, obj.h, 16, true);
                
                const borderGray = Math.round(128 + ((obj.depth - 1.0) / 20.0) * 127);
                depthCtx.strokeStyle = `rgb(${borderGray}, ${borderGray}, ${borderGray})`;
                depthCtx.lineWidth = 4;
                
                depthCtx.beginPath();
                depthCtx.moveTo(obj.x + 20, obj.y + 120);
                depthCtx.lineTo(obj.x + obj.w - 20, obj.y + 120);
                depthCtx.stroke();
                break;

            case 'text':
                depthCtx.font = `bold ${Math.round(obj.h * 0.6)}px 'Outfit'`;
                depthCtx.textBaseline = 'middle';
                depthCtx.textAlign = 'center';
                depthCtx.fillText(obj.text, obj.x + obj.w/2, obj.y + obj.h/2);
                break;
        }
    });
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// ==========================================================================
// モーダルダイアログ制御
// ==========================================================================
function openPlcRegisterModal() {
    const tableBody = document.getElementById('plc-registry-table-body');
    tableBody.innerHTML = '';
    
    // 現在使用されているPLCデバイスレジスタ一覧を収集
    const devices = [];
    projectData.forEach(obj => {
        if (obj.deviceType && obj.deviceAddr !== undefined) {
            const devKey = `${obj.deviceType}${obj.deviceAddr}`;
            devices.push({
                devKey,
                objId: obj.id,
                type: obj.type,
                depth: obj.depth,
                state: obj.state,
                deviceType: obj.deviceType,
                deviceAddr: obj.deviceAddr
            });
        }
    });

    // デバイス名でソート
    devices.sort((a, b) => a.devKey.localeCompare(b.devKey));

    if (devices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">割り当てられたPLCデバイスはありません。</td></tr>';
    } else {
        devices.forEach(d => {
            const row = document.createElement('tr');
            
            let displayVal = d.state;
            if (displayVal === true) displayVal = '<span class="text-cyan">ON</span>';
            if (displayVal === false) displayVal = '<span class="text-secondary">OFF</span>';

            row.innerHTML = `
                <td>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <select onchange="updatePlcRegistry('${d.objId}', 'deviceType', this.value)" class="prop-input" style="width: 50px; padding: 2px;">
                            <option value="D" ${d.deviceType==='D'?'selected':''}>D</option>
                            <option value="M" ${d.deviceType==='M'?'selected':''}>M</option>
                            <option value="X" ${d.deviceType==='X'?'selected':''}>X</option>
                            <option value="Y" ${d.deviceType==='Y'?'selected':''}>Y</option>
                        </select>
                        <input type="number" onchange="updatePlcRegistry('${d.objId}', 'deviceAddr', this.value)" value="${d.deviceAddr}" class="prop-input" style="width: 70px; padding: 2px;">
                    </div>
                </td>
                <td>
                    <input type="text" onchange="updatePlcRegistry('${d.objId}', 'id', this.value)" value="${d.objId}" class="prop-input" style="width: 150px; padding: 2px;">
                </td>
                <td style="text-transform: uppercase; font-size: 11px;">${d.type}</td>
                <td style="color: var(--color-amber);">${d.depth.toFixed(1)} mm</td>
                <td class="${d.state === true || d.state > 0 ? 'table-row-normal' : ''}" style="font-weight: bold;">${displayVal}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    document.getElementById('modal-plc-registry').showModal();
}

function updatePlcRegistry(oldId, field, newValue) {
    const obj = projectData.find(o => o.id === oldId);
    if (!obj) return;

    if (field === 'id') {
        if (!newValue || newValue.trim() === '') return;
        if (projectData.some(o => o.id === newValue)) {
            alert('その名称(ID)は既に使われています。');
            openPlcRegisterModal(); // 表示を戻す
            return;
        }
        const el = document.getElementById(oldId);
        if (el) el.id = newValue;
        if (activeObjectId === oldId) activeObjectId = newValue;
        obj.id = newValue;
    } else if (field === 'deviceType') {
        obj.deviceType = newValue;
    } else if (field === 'deviceAddr') {
        obj.deviceAddr = parseInt(newValue, 10) || 0;
    }

    if (activeObjectId === obj.id) {
        selectObject(obj.id); 
    }
}

function closePlcRegisterModal() {
    document.getElementById('modal-plc-registry').close();
}

function openUserGuideModal() {
    document.getElementById('modal-user-guide').showModal();
}

function closeUserGuideModal() {
    document.getElementById('modal-user-guide').close();
}

// ==========================================================================
// 仮想PLCシミュレータ制御
// ==========================================================================
function resetSimStates() {
    projectData.forEach(obj => {
        const defaults = OBJECT_DEFAULTS[obj.type];
        obj.state = defaults.state;
    });
}

// ==========================================================================
// 仮想キーパッド＆キーボード制御
// ==========================================================================
let virtualInputTargetKey = null;
let virtualInputObj = null;
let virtualInputBuffer = '';

function openVirtualKeypad(deviceKey, currentVal, obj) {
    virtualInputTargetKey = deviceKey;
    virtualInputObj = obj;
    virtualInputBuffer = String(currentVal !== undefined ? currentVal : '0');
    document.getElementById('vk-display').textContent = virtualInputBuffer;
    document.getElementById('virtual-keypad-overlay').style.display = 'flex';
}

function closeVirtualKeypad() {
    document.getElementById('virtual-keypad-overlay').style.display = 'none';
    virtualInputTargetKey = null;
    virtualInputObj = null;
}

function handleKeypadInput(key) {
    if (key === 'CLR') {
        virtualInputBuffer = '0';
    } else if (key === 'DEL') {
        virtualInputBuffer = virtualInputBuffer.slice(0, -1);
        if (virtualInputBuffer === '' || virtualInputBuffer === '-') virtualInputBuffer = '0';
    } else if (key === '-') {
        if (virtualInputBuffer.startsWith('-')) {
            virtualInputBuffer = virtualInputBuffer.substring(1);
        } else {
            virtualInputBuffer = '-' + (virtualInputBuffer === '0' ? '' : virtualInputBuffer);
        }
    } else if (key === 'ENT') {
        if (virtualInputTargetKey && virtualInputObj) {
            const num = parseFloat(virtualInputBuffer) || 0;
            plcRegisters[virtualInputTargetKey] = num;
            virtualInputObj.state = num;
            updateAllUIElements();
            syncPlcPanelUI();
            if (depthControlActive) renderDepthMap();
            triggerInterlockingLogic(virtualInputObj);
        }
        closeVirtualKeypad();
        return;
    } else {
        if (virtualInputBuffer === '0' && key !== '.') {
            virtualInputBuffer = key;
        } else {
            virtualInputBuffer += key;
        }
    }
    document.getElementById('vk-display').textContent = virtualInputBuffer;
}

function openVirtualKeyboard(deviceKey, currentVal, obj) {
    virtualInputTargetKey = deviceKey;
    virtualInputObj = obj;
    virtualInputBuffer = String(currentVal || '');
    document.getElementById('vkb-display').textContent = virtualInputBuffer;
    document.getElementById('virtual-keyboard-overlay').style.display = 'flex';
}

function closeVirtualKeyboard() {
    document.getElementById('virtual-keyboard-overlay').style.display = 'none';
    virtualInputTargetKey = null;
    virtualInputObj = null;
}

function handleKeyboardInput(key) {
    if (key === 'CLR') {
        virtualInputBuffer = '';
    } else if (key === 'DEL') {
        virtualInputBuffer = virtualInputBuffer.slice(0, -1);
    } else if (key === 'ENT') {
        if (virtualInputTargetKey && virtualInputObj) {
            plcRegisters[virtualInputTargetKey] = virtualInputBuffer;
            virtualInputObj.state = virtualInputBuffer;
            updateAllUIElements();
            syncPlcPanelUI();
            if (depthControlActive) renderDepthMap();
            triggerInterlockingLogic(virtualInputObj);
        }
        closeVirtualKeyboard();
        return;
    } else {
        virtualInputBuffer += key;
    }
    document.getElementById('vkb-display').textContent = virtualInputBuffer;
}

function handleSimulationClick(obj) {
    if (appMode !== 'sim') return;

    if (obj.type === 'switch') {
        const deviceKey = `${obj.deviceType}${obj.deviceAddr}`;
        plcRegisters[deviceKey] = !plcRegisters[deviceKey];
        obj.state = plcRegisters[deviceKey];
        updateAllUIElements();
        syncPlcPanelUI();
        if (depthControlActive) renderDepthMap();
        triggerInterlockingLogic(obj);
    } else if (obj.type === 'switch_word') {
        const deviceKey = `${obj.deviceType}${obj.deviceAddr}`;
        let val = parseInt(plcRegisters[deviceKey]) || 0;
        val = (val + 10) % 110; 
        plcRegisters[deviceKey] = val;
        obj.state = val;
        updateAllUIElements();
        syncPlcPanelUI();
        if (depthControlActive) renderDepthMap();
        triggerInterlockingLogic(obj);
    } else if (obj.type === 'switch_num') {
        const deviceKey = `${obj.deviceType}${obj.deviceAddr}`;
        openVirtualKeypad(deviceKey, plcRegisters[deviceKey], obj);
    } else if (obj.type === 'switch_str') {
        const deviceKey = `${obj.deviceType}${obj.deviceAddr}`;
        openVirtualKeyboard(deviceKey, plcRegisters[deviceKey], obj);
    } else if (obj.type === 'switch_screen') {
        const deviceKey = `${obj.deviceType}${obj.deviceAddr}`;
        let page = parseInt(plcRegisters[deviceKey]) || 1;
        page = (page % 3) + 1; 
        plcRegisters[deviceKey] = page;
        obj.state = page;
        updateAllUIElements();
        syncPlcPanelUI();
        if (depthControlActive) renderDepthMap();
        alert(`ページ ${page} への画面切り替え信号を受信しました。`);
    }
}

function triggerInterlockingLogic(triggeredObj) {
    const key = `${triggeredObj.deviceType}${triggeredObj.deviceAddr}`;
    const value = plcRegisters[key];

    projectData.forEach(obj => {
        if (obj.id !== triggeredObj.id && obj.deviceType === triggeredObj.deviceType && obj.deviceAddr === triggeredObj.deviceAddr) {
            obj.state = value;
        }
    });

    updateAllUIElements();
    if (depthControlActive) renderDepthMap();
}

function buildPlcRegisterUI() {
    const listContainer = document.getElementById('plc-register-list');
    listContainer.innerHTML = '';
    
    const devices = new Set();
    projectData.forEach(obj => {
        if (obj.deviceType && obj.deviceAddr !== undefined) {
            devices.add(`${obj.deviceType}${obj.deviceAddr}`);
        }
    });

    const sortedDevices = Array.from(devices).sort();

    if (sortedDevices.length === 0) {
        listContainer.innerHTML = '<p class="no-selection" style="padding: 20px 0;">割り当てデバイスがありません。</p>';
        return;
    }

    sortedDevices.forEach(devKey => {
        const type = devKey.charAt(0);
        
        if (plcRegisters[devKey] === undefined) {
            plcRegisters[devKey] = (type === 'M') ? false : 0;
        }

        const card = document.createElement('div');
        card.className = 'plc-reg-card';

        let controlHTML = '';
        if (type === 'M') {
            controlHTML = `
                <button class="plc-btn-bit ${plcRegisters[devKey] ? 'active' : ''}" onclick="togglePlcBit('${devKey}')">
                    ${plcRegisters[devKey] ? 'ON' : 'OFF'}
                </button>
            `;
        } else {
            controlHTML = `
                <div class="plc-reg-control">
                    <input type="range" class="plc-reg-slider" min="0" max="500" value="${plcRegisters[devKey]}" oninput="changePlcWord('${devKey}', this.value)">
                    <input type="number" class="plc-reg-input-num" value="${plcRegisters[devKey]}" onchange="changePlcWord('${devKey}', this.value)">
                </div>
            `;
        }

        card.innerHTML = `
            <div class="plc-reg-header">
                <span class="plc-reg-name">${devKey}</span>
                <span class="plc-reg-type">${type === 'M' ? 'Bit Device' : 'Word Register'}</span>
            </div>
            ${controlHTML}
        `;

        listContainer.appendChild(card);
    });

    syncPlcValuesToObjects();
}

function togglePlcBit(devKey) {
    plcRegisters[devKey] = !plcRegisters[devKey];
    syncPlcPanelUI();
    syncPlcValuesToObjects();
}

function changePlcWord(devKey, val) {
    const num = parseInt(val) || 0;
    plcRegisters[devKey] = Math.max(0, Math.min(10000, num));
    syncPlcPanelUI();
    syncPlcValuesToObjects();
}

function syncPlcPanelUI() {
    const cards = document.querySelectorAll('.plc-reg-card');
    cards.forEach(card => {
        const nameEl = card.querySelector('.plc-reg-name');
        const devKey = nameEl.textContent;
        const val = plcRegisters[devKey];

        if (devKey.charAt(0) === 'M') {
            const btn = card.querySelector('.plc-btn-bit');
            if (btn) {
                btn.textContent = val ? 'ON' : 'OFF';
                if (val) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        } else {
            const slider = card.querySelector('.plc-reg-slider');
            const input = card.querySelector('.plc-reg-input-num');
            if (slider) slider.value = val;
            if (input) input.value = val;
        }
    });
}

function syncPlcValuesToObjects() {
    projectData.forEach(obj => {
        const key = `${obj.deviceType}${obj.deviceAddr}`;
        if (plcRegisters[key] !== undefined) {
            obj.state = plcRegisters[key];
        }
    });
    updateAllUIElements();
    if (depthControlActive) renderDepthMap();
}

// ==========================================================================
// プロジェクトデータの保存・読込・デモプリセット
// ==========================================================================
let currentProjectName = 'Factory Sample';

function updateProjectName(name) {
    currentProjectName = name;
    const el = document.getElementById('current-project-name');
    if (el) el.textContent = name;
}

function clearProject() {
    if (!confirm('全てのUIオブジェクトを消去してもよろしいですか？')) return;
    document.querySelectorAll('.ui-element').forEach(el => el.remove());
    projectData = [];
    plcRegisters = {};
    updateProjectName('Untitled Project');
    deselectAll();
    renderDepthMap();
    buildPlcRegisterUI();
}

function exportProject() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    
    let fileName = currentProjectName;
    if (!fileName.endsWith('.json')) fileName += '.json';
    if (fileName === 'Untitled Project.json' || fileName === 'Factory Sample.json') {
        fileName = `hikari_4k_project_${Date.now()}.json`;
    }

    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function triggerImport() {
    document.getElementById('import-file-input').click();
}

function importProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                document.querySelectorAll('.ui-element').forEach(el => el.remove());
                projectData = imported;
                
                updateProjectName(file.name);
                
                projectData.forEach(obj => createDOMElement(obj));
                deselectAll();
                setMode(appMode);
                alert('プロジェクトデータを正常にインポートしました。');
            } else {
                alert('ファイル形式が正しくありません。');
            }
        } catch (err) {
            alert('JSONファイルの解析に失敗しました。');
        }
    };
    reader.readAsText(file);
}

// サンプルデータプリセット (4K 3840x2160 全画面 16:9 レイアウト - 階層化新規パーツ対応)
const SAMPLES = {
    factory: [
        { id: 'lbl_sys_title', type: 'text', x: 960, y: 144, w: 1920, h: 144, text: 'UNIT-04 HEAVY WATER SYSTEM', depth: 12.0, deviceType: 'D', deviceAddr: 0, color: '#00f0ff', state: 0 },
        
        // 1. スイッチ＆ランプ操作系 (左)
        { id: 'sw_pump_a', type: 'switch', x: 288, y: 432, w: 576, h: 288, text: 'CIRC-PUMP A', depth: 8.0, deviceType: 'M', deviceAddr: 101, color: '#00f0ff', state: false },
        { id: 'lamp_pump_a', type: 'lamp', x: 960, y: 432, w: 288, h: 288, text: 'RUN A', depth: 15.0, deviceType: 'M', deviceAddr: 101, color: '#00ff66', state: false },
        { id: 'sw_pump_b', type: 'switch_word', x: 288, y: 768, w: 576, h: 288, text: 'FLOW RATE SET', depth: 8.0, deviceType: 'D', deviceAddr: 52, color: '#00f0ff', state: 45 },
        { id: 'lamp_multi', type: 'lamp_word', x: 960, y: 768, w: 288, h: 288, text: 'LEVEL', depth: 5.0, deviceType: 'D', deviceAddr: 2, color: '#ff007f', state: 0 },
        
        // 2. 表示・計測器系 (中央)
        { id: 'disp_pressure', type: 'display', x: 1392, y: 432, w: 576, h: 240, text: 'BOILER PRESS (kPa)', depth: -6.0, deviceType: 'D', deviceAddr: 50, color: '#ffb300', state: 350 },
        { id: 'meter_analog', type: 'meter_analog', x: 2112, y: 432, w: 480, h: 480, text: 'REACTOR PRESS', depth: -8.0, deviceType: 'D', deviceAddr: 52, color: '#00f0ff', state: 45, maxVal: 100 },
        
        // 3. グラフ系 (右)
        { id: 'graph_trend_log', type: 'graph_trend', x: 2736, y: 432, w: 816, h: 480, text: 'LOG TREND', depth: -12.0, deviceType: 'D', deviceAddr: 52, color: '#00ff66', state: 45, maxVal: 100 },
        
        // 4. データ監視テーブル系 (下部)
        { id: 'logging_table', type: 'logging_list', x: 288, y: 1248, w: 1056, h: 480, text: 'SAMPLED TEMPERATURE LOG', depth: -15.0, deviceType: 'D', deviceAddr: 52, color: '#00ff66', state: 45 },
        { id: 'alarm_table', type: 'alarm_list', x: 1392, y: 1248, w: 1056, h: 480, text: 'SYSTEM ALARM EVENTS', depth: -15.0, deviceType: 'M', deviceAddr: 999, color: '#ff007f', state: false },
        { id: 'recipe_table_select', type: 'recipe_table', x: 2496, y: 1248, w: 1056, h: 480, text: 'BATCH RECIPES', depth: -15.0, deviceType: 'D', deviceAddr: 60, color: '#00f0ff', state: 1 }
    ],
    motor: [
        { id: 'lbl_title', type: 'text', x: 960, y: 144, w: 1920, h: 144, text: 'REACTOR CORE MAIN CONSOLE', depth: 8.0, deviceType: 'D', deviceAddr: 0, color: '#f8fafc' },
        { id: 'sw_run', type: 'switch', x: 480, y: 576, w: 672, h: 336, text: 'MOTOR DRIVE', depth: 10.0, deviceType: 'M', deviceAddr: 10, color: '#00f0ff', state: false },
        { id: 'lamp_run', type: 'lamp', x: 1752, y: 576, w: 336, h: 336, text: 'RUNNING', depth: 15.0, deviceType: 'M', deviceAddr: 10, color: '#00ff66', state: false },
        { id: 'disp_speed', type: 'display', x: 2640, y: 624, w: 720, h: 240, text: 'SHAFT SPEED (RPM)', depth: -5.0, deviceType: 'D', deviceAddr: 20, color: '#ffb300', state: 0 },
        { id: 'meter_load', type: 'meter', x: 480, y: 1440, w: 2880, h: 336, text: 'CURRENT SYSTEM LOAD (%)', depth: -12.0, deviceType: 'D', deviceAddr: 21, color: '#ff007f', state: 40, maxVal: 100 }
    ],
    temperature: [
        { id: 'lbl_temp_title', type: 'text', x: 960, y: 144, w: 1920, h: 144, text: 'HEATING ELEMENT CONTROLLER', depth: 8.0, deviceType: 'D', deviceAddr: 0, color: '#ffb300' },
        { id: 'sw_heat', type: 'switch', x: 576, y: 576, w: 672, h: 336, text: 'HEATER ACTIVE', depth: 12.0, deviceType: 'M', deviceAddr: 1, color: '#ff007f', state: false },
        { id: 'lamp_heat', type: 'lamp', x: 1752, y: 576, w: 336, h: 336, text: 'ACTIVE', depth: 6.0, deviceType: 'M', deviceAddr: 1, color: '#ff007f', state: false },
        { id: 'disp_temp', type: 'display', x: 2640, y: 624, w: 624, h: 240, text: 'TEMPERATURE (deg C)', depth: -8.0, deviceType: 'D', deviceAddr: 2, color: '#00ff66', state: 25 },
        { id: 'meter_temp', type: 'meter', x: 576, y: 1392, w: 2688, h: 384, text: 'REACTOR TEMPERATURE LEVEL', depth: -15.0, deviceType: 'D', deviceAddr: 2, color: '#ffb300', state: 25, maxVal: 150 }
    ]
};

function loadSample(key) {
    if (!SAMPLES[key]) return;
    
    document.querySelectorAll('.ui-element').forEach(el => el.remove());
    projectData = JSON.parse(JSON.stringify(SAMPLES[key]));
    
    let sampleName = key === 'factory' ? 'Factory Sample' : 
                     key === 'basic' ? 'Basic Components' : 
                     key === 'temperature' ? 'Temperature Control' : key;
    updateProjectName(sampleName);
    
    plcRegisters = {};
    if (key === 'factory') {
        plcRegisters['M101'] = false;
        plcRegisters['D2'] = 0;
        plcRegisters['D50'] = 350;
        plcRegisters['D51'] = 'NORMAL';
        plcRegisters['D52'] = 45;
        plcRegisters['D53'] = 65;
        plcRegisters['M999'] = false;
        plcRegisters['D60'] = 1;
    } else if (key === 'motor') {
        plcRegisters['M10'] = false;
        plcRegisters['D20'] = 1200;
        plcRegisters['D21'] = 35;
    } else if (key === 'temperature') {
        plcRegisters['M1'] = false;
        plcRegisters['D2'] = 42;
    }

    projectData.forEach(obj => createDOMElement(obj));
    deselectAll();
    
    if (appMode === 'sim') {
        buildPlcRegisterUI();
    } else {
        resetSimStates();
        updateAllUIElements();
    }
    
    if (depthControlActive) {
        renderDepthMap();
    }
}
