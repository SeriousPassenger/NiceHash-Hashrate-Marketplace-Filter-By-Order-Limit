// ==UserScript==
// @name         NiceHash Hashrate Marketplace Filter By Order Limit
// @namespace    https://github.com/SeriousPassenger
// @version      1.0.0
// @description  Hide NiceHash marketplace rows whose Limit is at or below a per-marketplace threshold.
// @author       SeriousPassenger
// @license      GPL-3.0-only
// @match        https://www.nicehash.com/*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/SeriousPassenger/NiceHash-Hashrate-Marketplace-Filter-By-Order-Limit
// @supportURL   https://github.com/SeriousPassenger/NiceHash-Hashrate-Marketplace-Filter-By-Order-Limit/issues
// @updateURL    https://raw.githubusercontent.com/SeriousPassenger/NiceHash-Hashrate-Marketplace-Filter-By-Order-Limit/main/nicehash-marketplace-limit-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/SeriousPassenger/NiceHash-Hashrate-Marketplace-Filter-By-Order-Limit/main/nicehash-marketplace-limit-filter.user.js
// ==/UserScript==

/*
 * NiceHash Hashrate Marketplace Filter By Order Limit
 * Copyright (C) 2026 SeriousPassenger
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

(function () {
    'use strict';

    const STORAGE_PREFIX = 'nh_limit_filter_v3';

    const KEY_PANEL_POS = `${STORAGE_PREFIX}:panel_position`;

    // Legacy keys from older versions. Used as fallback only.
    const LEGACY_KEY_THRESHOLD = 'nh_limit_filter_threshold';
    const LEGACY_KEY_ENABLED = 'nh_limit_filter_enabled';

    const DEFAULT_THRESHOLD = 0.0001;
    const PANEL_ID = 'nh-limit-filter-panel';

    let debounceTimer = null;
    let lastUrl = location.href;
    let activeMarketplaceId = null;

    function getMarketplaceId() {
        const match = location.pathname.match(/^\/my\/marketplace(?:\/([^/?#]+))?/i);
        if (!match) return null;

        const raw = match[1];

        if (!raw) return 'ALL';

        try {
            return decodeURIComponent(raw).trim().toUpperCase() || 'ALL';
        } catch (_) {
            return raw.trim().toUpperCase() || 'ALL';
        }
    }

    function formatMarketplaceName(marketplaceId) {
        if (!marketplaceId || marketplaceId === 'ALL') return 'All marketplaces';
        return marketplaceId;
    }

    function scopedKey(marketplaceId, settingName) {
        return `${STORAGE_PREFIX}:${marketplaceId}:${settingName}`;
    }

    function getThreshold(marketplaceId = getMarketplaceId() || 'ALL') {
        const raw = window.localStorage.getItem(scopedKey(marketplaceId, 'threshold'));

        if (raw !== null) {
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : DEFAULT_THRESHOLD;
        }

        const legacyRaw = window.localStorage.getItem(LEGACY_KEY_THRESHOLD);
        const legacyValue = parseFloat(legacyRaw);

        return Number.isFinite(legacyValue) ? legacyValue : DEFAULT_THRESHOLD;
    }

    function setThreshold(value, marketplaceId = getMarketplaceId() || 'ALL') {
        window.localStorage.setItem(scopedKey(marketplaceId, 'threshold'), String(value));
    }

    function isEnabled(marketplaceId = getMarketplaceId() || 'ALL') {
        const raw = window.localStorage.getItem(scopedKey(marketplaceId, 'enabled'));

        if (raw !== null) {
            return raw !== '0';
        }

        return window.localStorage.getItem(LEGACY_KEY_ENABLED) !== '0';
    }

    function setEnabled(value, marketplaceId = getMarketplaceId() || 'ALL') {
        window.localStorage.setItem(scopedKey(marketplaceId, 'enabled'), value ? '1' : '0');
    }

    function getPanelPosition() {
        const raw = window.localStorage.getItem(KEY_PANEL_POS);
        if (!raw) return null;

        try {
            const pos = JSON.parse(raw);
            const left = Number(pos.left);
            const top = Number(pos.top);

            if (Number.isFinite(left) && Number.isFinite(top)) {
                return { left, top };
            }
        } catch (_) {
            // Ignore invalid saved position.
        }

        return null;
    }

    function setPanelPosition(left, top) {
        window.localStorage.setItem(
            KEY_PANEL_POS,
            JSON.stringify({
                left: Math.round(left),
                top: Math.round(top)
            })
        );
    }

    function clearPanelPosition() {
        window.localStorage.removeItem(KEY_PANEL_POS);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function movePanel(panel, left, top) {
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

        const nextLeft = clamp(left, 0, maxLeft);
        const nextTop = clamp(top, 0, maxTop);

        panel.style.left = `${nextLeft}px`;
        panel.style.top = `${nextTop}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        return { left: nextLeft, top: nextTop };
    }

    function restorePanelPosition(panel) {
        const saved = getPanelPosition();
        if (!saved) return;

        requestAnimationFrame(() => {
            const pos = movePanel(panel, saved.left, saved.top);
            setPanelPosition(pos.left, pos.top);
        });
    }

    function initDraggablePanel(panel) {
        if (panel.dataset.nhDraggable === '1') return;
        panel.dataset.nhDraggable = '1';

        const handle = panel.querySelector('#nh-limit-filter-drag-handle');
        if (!handle) return;

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let previousUserSelect = '';

        handle.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            const rect = panel.getBoundingClientRect();

            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            previousUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = 'none';

            if (handle.setPointerCapture) {
                handle.setPointerCapture(e.pointerId);
            }

            e.preventDefault();
        });

        handle.addEventListener('pointermove', (e) => {
            if (!dragging) return;

            movePanel(
                panel,
                startLeft + e.clientX - startX,
                startTop + e.clientY - startY
            );
        });

        function stopDrag(e) {
            if (!dragging) return;

            dragging = false;
            document.body.style.userSelect = previousUserSelect;

            if (handle.releasePointerCapture) {
                try {
                    handle.releasePointerCapture(e.pointerId);
                } catch (_) {
                    // Pointer may already be released.
                }
            }

            const rect = panel.getBoundingClientRect();
            setPanelPosition(rect.left, rect.top);
        }

        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);

        handle.addEventListener('dblclick', () => {
            clearPanelPosition();

            panel.style.left = '';
            panel.style.top = '12px';
            panel.style.right = '12px';
            panel.style.bottom = 'auto';
        });

        window.addEventListener('resize', () => {
            const saved = getPanelPosition();
            if (!saved) return;

            const pos = movePanel(panel, saved.left, saved.top);
            setPanelPosition(pos.left, pos.top);
        });

        restorePanelPosition(panel);
    }

    function parseNumber(text) {
        if (!text) return NaN;

        const cleaned = text.replace(/,/g, '');
        const match = cleaned.match(/-?\d*\.?\d+/);

        return match ? parseFloat(match[0]) : NaN;
    }

    function findLimitColumnIndex(table) {
        const headers = Array.from(table.querySelectorAll('thead th'));
        let idx = headers.findIndex(th => /limit/i.test(th.textContent || ''));

        // Fallback for the current NiceHash layout if header lookup fails.
        if (idx === -1 && headers.length >= 3) idx = 2;

        return idx;
    }

    function getPanel() {
        return document.getElementById(PANEL_ID);
    }

    function hidePanel() {
        const panel = getPanel();
        if (panel) panel.style.display = 'none';
    }

    function showPanel(panel) {
        panel.style.display = 'block';
    }

    function syncPanelToMarketplace(panel, marketplaceId) {
        if (!panel || !marketplaceId) return;

        const marketLabel = panel.querySelector('#nh-limit-marketplace');
        const enabledInput = panel.querySelector('#nh-limit-enabled');
        const thresholdInput = panel.querySelector('#nh-limit-threshold');

        if (marketLabel) {
            marketLabel.textContent = formatMarketplaceName(marketplaceId);
        }

        if (enabledInput) {
            enabledInput.checked = isEnabled(marketplaceId);
        }

        if (thresholdInput) {
            thresholdInput.value = String(getThreshold(marketplaceId));
        }

        activeMarketplaceId = marketplaceId;
    }

    function ensurePanel() {
        const marketplaceId = getMarketplaceId();

        if (!marketplaceId) {
            hidePanel();
            return null;
        }

        let panel = getPanel();

        if (panel) {
            showPanel(panel);

            if (activeMarketplaceId !== marketplaceId) {
                syncPanelToMarketplace(panel, marketplaceId);
            }

            return panel;
        }

        panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = [
            'position:fixed',
            'top:12px',
            'right:12px',
            'z-index:2147483647',
            'background:#111',
            'color:#eee',
            'border:1px solid #555',
            'border-radius:10px',
            'padding:10px 12px',
            'font:13px/1.35 Arial,sans-serif',
            'box-shadow:0 4px 18px rgba(0,0,0,.45)',
            'min-width:280px',
            'box-sizing:border-box'
        ].join(';');

        panel.innerHTML = `
            <div id="nh-limit-filter-drag-handle"
                 title="Drag to move. Double-click to reset position."
                 style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;margin:-2px -4px 8px;padding:2px 4px;cursor:move;user-select:none;touch-action:none;">
                <span>Order limit filter</span>
                <span style="font-size:11px;color:#999;font-weight:400;">drag</span>
            </div>

            <div style="font-size:12px;color:#bbb;margin-bottom:8px;">
                Marketplace:
                <strong id="nh-limit-marketplace" style="color:#fff;"></strong>
            </div>

            <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
                <input id="nh-limit-enabled" type="checkbox">
                <span>Enable filter for this marketplace</span>
            </label>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span>Hide rows with Limit ≤</span>
                <input id="nh-limit-threshold" type="number" min="0" step="0.0001"
                       style="width:90px;padding:3px 5px;background:#1b1b1b;color:#fff;border:1px solid #666;border-radius:4px;">
                <span>GH/s</span>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <button id="nh-limit-apply" style="padding:4px 8px;background:#2b2b2b;color:#fff;border:1px solid #666;border-radius:4px;cursor:pointer;">Apply</button>
                <button id="nh-limit-reset" style="padding:4px 8px;background:#2b2b2b;color:#fff;border:1px solid #666;border-radius:4px;cursor:pointer;">Reset this market</button>
            </div>

            <div id="nh-limit-status" style="font-size:12px;color:#bbb;">Waiting for marketplace table…</div>
        `;

        document.body.appendChild(panel);

        initDraggablePanel(panel);
        syncPanelToMarketplace(panel, marketplaceId);

        const enabledInput = panel.querySelector('#nh-limit-enabled');
        const thresholdInput = panel.querySelector('#nh-limit-threshold');
        const applyBtn = panel.querySelector('#nh-limit-apply');
        const resetBtn = panel.querySelector('#nh-limit-reset');

        enabledInput.addEventListener('change', () => {
            const currentMarketplaceId = getMarketplaceId();
            if (!currentMarketplaceId) return;

            setEnabled(enabledInput.checked, currentMarketplaceId);
            scheduleApply();
        });

        applyBtn.addEventListener('click', () => {
            const currentMarketplaceId = getMarketplaceId();
            if (!currentMarketplaceId) return;

            const value = parseFloat(thresholdInput.value);
            if (!Number.isFinite(value) || value < 0) return;

            setThreshold(value, currentMarketplaceId);
            scheduleApply();
        });

        resetBtn.addEventListener('click', () => {
            const currentMarketplaceId = getMarketplaceId();
            if (!currentMarketplaceId) return;

            thresholdInput.value = String(DEFAULT_THRESHOLD);
            enabledInput.checked = true;

            setThreshold(DEFAULT_THRESHOLD, currentMarketplaceId);
            setEnabled(true, currentMarketplaceId);

            scheduleApply();
        });

        thresholdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applyBtn.click();
        });

        return panel;
    }

    function updateStatus(text) {
        const panel = ensurePanel();
        if (!panel) return;

        const status = panel.querySelector('#nh-limit-status');
        if (status) status.textContent = text;
    }

    function applyFilter() {
        try {
            const marketplaceId = getMarketplaceId();

            if (!marketplaceId) {
                hidePanel();
                return;
            }

            const panel = ensurePanel();
            if (!panel) return;

            if (activeMarketplaceId !== marketplaceId) {
                syncPanelToMarketplace(panel, marketplaceId);
            }

            const tables = Array.from(document.querySelectorAll('table.nh-new'));

            if (!tables.length) {
                updateStatus('Marketplace table not found yet.');
                return;
            }

            const threshold = getThreshold(marketplaceId);
            const enabled = isEnabled(marketplaceId);

            let hidden = 0;
            let scanned = 0;

            for (const table of tables) {
                const limitIndex = findLimitColumnIndex(table);
                if (limitIndex < 0) continue;

                const rows = Array.from(table.querySelectorAll('tbody tr'));

                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (!cells.length || cells.length <= limitIndex) continue;

                    const limitValue = parseNumber(cells[limitIndex].textContent);
                    if (!Number.isFinite(limitValue)) continue;

                    scanned++;

                    if (enabled && limitValue <= threshold) {
                        row.style.display = 'none';
                        hidden++;
                    } else {
                        row.style.display = '';
                    }
                }
            }

            updateStatus(
                enabled
                    ? `Scanned ${scanned} rows. Hidden ${hidden} rows at threshold ≤ ${threshold} GH/s.`
                    : `Filter disabled for ${formatMarketplaceName(marketplaceId)}. Scanned ${scanned} rows.`
            );
        } catch (err) {
            console.error('NiceHash Hashrate Marketplace Filter By Order Limit error:', err);
            updateStatus('Script error. Open browser console for details.');
        }
    }

    function scheduleApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilter, 120);
    }

    function handleRouteChange() {
        const currentUrl = location.href;

        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;

            const marketplaceId = getMarketplaceId();

            if (!marketplaceId) {
                activeMarketplaceId = null;
                hidePanel();
                return;
            }

            const panel = ensurePanel();
            if (panel) {
                syncPanelToMarketplace(panel, marketplaceId);
            }
        }

        scheduleApply();
    }

    const observer = new MutationObserver(() => {
        handleRouteChange();
    });

    observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
    });

    setInterval(() => {
        handleRouteChange();
    }, 1000);

    scheduleApply();
})();
