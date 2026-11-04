'use strict';
/**
 * iDrive Circuit - a parked-only wiring puzzle for the iDrive controller and touchscreen.
 *
 * On the GPU/full-screen path every tile is a page target: turn the controller to move through
 * them, push it towards a neighbouring tile, and press to rotate.  Touch rotates a tile directly.
 * The HMI buttons remain as a complete fallback for the software/standard layout.
 */
const fs = require('fs');
const path = require('path');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');
const Parked = require('./kit/parked');
const { t: translate } = require('./kit/i18n');
const Puzzle = require('./puzzle');
const levels = require('./levels');

const W = 1600, H = 520;
const STATE_VERSION = 1;

mgu.run({
    async start(ctx) {
        const { ui, settings, log } = ctx;
        const parked = Parked.watch(ctx, log);
        const driving = () => settings.get('parkedOnly') !== false && parked.moving();

        /* ---------- progress and crash-safe persistence ---------- */
        const FILE = path.join(ctx.dataDir, 'circuit_state.json');
        let progress = { version: STATE_VERSION, current: 0, unlocked: 1, stars: {}, best: {}, sessions: {} };
        try {
            const got = JSON.parse(fs.readFileSync(FILE, 'utf8'));
            if (got && got.version === STATE_VERSION) progress = Object.assign(progress, got);
        } catch (e) { /* first start */ }
        progress.current = Math.max(0, Math.min(levels.length - 1, Number(progress.current) || 0));
        progress.unlocked = Math.max(1, Math.min(levels.length, Number(progress.unlocked) || 1));
        progress.stars = progress.stars || {};
        progress.best = progress.best || {};
        progress.sessions = progress.sessions || {};

        let game = new Puzzle.Game(levels, progress.current, progress.sessions[levels[progress.current].id]);
        let fallbackCursor = game.rotatableIndices()[0] || 0;
        let completeAt = game.analysis.complete ? Date.now() : 0;

        function snapshot() {
            progress.current = game.levelIndex;
            progress.sessions[game.level.id] = game.state();
        }
        function save() {
            snapshot();
            const tmp = FILE + '.tmp';
            try {
                fs.writeFileSync(tmp, JSON.stringify(progress));
                fs.renameSync(tmp, FILE);
            } catch (e) {
                try { fs.writeFileSync(FILE, JSON.stringify(progress)); } catch (e2) { log.warn('save: ' + e2); }
                try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e3) { /* best effort */ }
            }
        }
        process.on('exit', save);

        function recordCompletion() {
            if (!game.analysis.complete) { completeAt = 0; return; }
            if (!completeAt) completeAt = Date.now();
            const id = game.level.id, stars = game.stars(), old = Number(progress.stars[id]) || 0;
            if (stars > old) progress.stars[id] = stars;
            const best = progress.best[id];
            if (!best || game.moves < best.moves || (game.moves === best.moves && game.hintsUsed < best.hintsUsed)) {
                progress.best[id] = { moves: game.moves, hintsUsed: game.hintsUsed };
            }
            progress.unlocked = Math.max(progress.unlocked, Math.min(levels.length, game.levelIndex + 2));
            labels();
        }

        function changed(ok) {
            if (!ok) return false;
            recordCompletion(); save(); return true;
        }
        function act(fn) { return driving() ? false : changed(fn()); }
        function rotate(index) { return act(() => game.rotate(index)); }
        function undo() { return act(() => game.undo()); }
        function hint() { return act(() => game.hint()); }
        function restart() { return act(() => game.restart()); }

        function openLevel(index) {
            const n = Math.max(0, Math.min(progress.unlocked - 1, index));
            if (n === game.levelIndex) return false;
            snapshot();
            game.setLevel(n, progress.sessions[levels[n].id]);
            fallbackCursor = game.rotatableIndices()[0] || 0;
            completeAt = game.analysis.complete ? Date.now() : 0;
            save(); labels(); return true;
        }
        function previous() { return !driving() && openLevel(game.levelIndex - 1); }
        function next() { return !driving() && openLevel(game.levelIndex + 1); }

        function cursorNext() {
            if (driving()) return false;
            const a = game.rotatableIndices(), at = a.indexOf(fallbackCursor);
            if (!a.length) return false;
            fallbackCursor = a[(at + 1 + a.length) % a.length];
            return true;
        }
        function rotateCursor() { return rotate(fallbackCursor); }

        /* ---------- HMI fallback controls ---------- */
        ui.onClick('BTN_CURSOR', cursorNext);
        ui.onClick('BTN_ROTATE', rotateCursor);
        ui.onClick('BTN_UNDO', undo);
        ui.onClick('BTN_HINT', hint);
        ui.onClick('BTN_RESTART', restart);
        ui.onClick('BTN_PREV', previous);
        ui.onClick('BTN_NEXT', next);
        function labels() {
            ui.text('BTN_NEXT', game.levelIndex + 1 < progress.unlocked ? 'Next level' : 'Next level (locked)');
            ui.text('BTN_PREV', game.levelIndex ? 'Previous level' : 'Previous level (none)');
        }
        labels();
        // Full-screen renderer: equivalent controls live in the right panel and the grid itself.
        ['BTN_CURSOR', 'BTN_ROTATE', 'BTN_UNDO', 'BTN_HINT', 'BTN_RESTART', 'BTN_PREV', 'BTN_NEXT'].forEach((id) => ctx.hideButton(id));

        /* ---------- drawing helpers ---------- */
        const dirVec = {
            1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0],
        };
        function edgePowered(index, bit) {
            if (!game.analysis.powered.has(index)) return false;
            const row = Math.floor(index / game.level.cols), col = index % game.level.cols;
            const d = bit === 1 ? [-1, 0, 4] : bit === 2 ? [0, 1, 8] : bit === 4 ? [1, 0, 1] : [0, -1, 2];
            const r = row + d[0], c = col + d[1];
            if (r < 0 || c < 0 || r >= game.level.rows || c >= game.level.cols) return false;
            const j = r * game.level.cols + c, other = game.level.cells[j];
            return !!(other && game.analysis.powered.has(j) && (Puzzle.maskFor(other, game.rotations[j]) & d[2]));
        }

        function drawDevice(cv, t, cell, cx, cy, on, size) {
            const color = on ? t.accent2 : t.dim, glow = on ? G.withAlpha(t.accent2, 0.22) : G.withAlpha(t.dim, 0.08);
            if (cell.role === 'source') {
                const w = size * 0.40, h = size * 0.28;
                cv.roundRect(cx - w / 2, cy - h / 2, w, h, 6, t.panelTop);
                cv.strokeRoundRect(cx - w / 2, cy - h / 2, w, h, 6, 3, color);
                cv.fillRect(cx + w / 2, cy - h * 0.18, 6, h * 0.36, color);
                cv.quad([[cx - 4, cy - h * 0.36], [cx + 7, cy - 3], [cx + 1, cy - 3], [cx + 5, cy + h * 0.34]], color);
                return;
            }
            if (cell.device === 'headlight') {
                const r = size * 0.15;
                cv.arc(cx, cy, r - 3, r, -135, 135, color);
                for (let i = -1; i <= 1; i++) cv.line(cx + r * 0.75, cy + i * 7, cx + r * 1.35, cy + i * 10, 2, color);
            } else if (cell.device === 'motor') {
                const r = size * 0.18;
                cv.circle(cx, cy, r + 5, glow); cv.arc(cx, cy, r - 2, r, 0, 360, color);
                cv.text('M', cx, cy + size * 0.085, size * 0.24, color, { align: 'center', font: 'bold' });
            } else {
                cv.circle(cx, cy, size * 0.045, color);
                cv.arc(cx, cy, size * 0.10, size * 0.125, -55, 55, color);
                cv.arc(cx, cy, size * 0.17, size * 0.19, -55, 55, color);
            }
        }

        function drawTile(cv, t, index, x, y, size, now, interactive) {
            const cell = game.level.cells[index];
            if (!cell) return;
            const powered = game.analysis.powered.has(index), flow = t.accent2, base = powered ? G.withAlpha(flow, 0.08) : G.withAlpha('#ffffff', 0.035);
            cv.roundRect(x, y, size, size, Math.max(7, size * 0.08), base);
            cv.strokeRoundRect(x + 1, y + 1, size - 2, size - 2, Math.max(7, size * 0.08), 1.5,
                powered ? G.withAlpha(flow, 0.38) : G.withAlpha('#ffffff', 0.12));
            const cx = x + size / 2, cy = y + size / 2, mask = Puzzle.maskFor(cell, game.rotations[index]);
            [1, 2, 4, 8].forEach((bit) => {
                if (!(mask & bit)) return;
                const v = dirVec[bit], ex = cx + v[0] * size * 0.50, ey = cy + v[1] * size * 0.50, on = edgePowered(index, bit);
                if (on) cv.line(cx, cy, ex, ey, Math.max(14, size * 0.18), G.withAlpha(flow, 0.16));
                cv.line(cx, cy, ex, ey, Math.max(5, size * 0.075), on ? flow : G.withAlpha(t.dim, 0.55));
                if (on) {
                    const phase = ((now / 650 + index * 0.19 + bit * 0.07) % 1), px = cx + (ex - cx) * phase, py = cy + (ey - cy) * phase;
                    cv.circle(px, py, Math.max(2.5, size * 0.035), t.text);
                }
            });
            if (cell.role === 'wire') cv.circle(cx, cy, Math.max(6, size * 0.085), powered ? flow : G.withAlpha(t.dim, 0.75));
            else drawDevice(cv, t, cell, cx, cy, powered, size);
            if (game.lastChanged === index && now % 900 < 420) cv.strokeRoundRect(x + 4, y + 4, size - 8, size - 8, Math.max(6, size * 0.07), 3, G.withAlpha(flow, 0.75));
            if (!cv.own && fallbackCursor === index) cv.strokeRoundRect(x + 3, y + 3, size - 6, size - 6, Math.max(7, size * 0.08), 3, t.sel || flow);
            if (interactive && game.isRotatable(index)) cv.target(x + 3, y + 3, size - 6, size - 6, () => rotate(index), 'tile:' + index, Math.max(7, size * 0.08));
        }

        function boardLayout(panel) {
            const gap = 7, roomX = panel.x + 18, roomY = panel.y + 58, roomW = panel.w - 36, roomH = panel.h - 76;
            const size = Math.floor(Math.min((roomW - gap * (game.level.cols - 1)) / game.level.cols,
                (roomH - gap * (game.level.rows - 1)) / game.level.rows));
            const w = size * game.level.cols + gap * (game.level.cols - 1), h = size * game.level.rows + gap * (game.level.rows - 1);
            return { x: Math.round(roomX + (roomW - w) / 2), y: Math.round(roomY + (roomH - h) / 2), size, gap };
        }

        function overlay(cv, t, panel, title, subtitle, color) {
            const w = Math.min(650, panel.w - 90), h = 164, x = panel.x + (panel.w - w) / 2, y = panel.y + (panel.h - h) / 2;
            cv.roundRect(x, y, w, h, 18, G.withAlpha('#000000', 0.88));
            cv.strokeRoundRect(x, y, w, h, 18, 3, color);
            cv.text(title, x + w / 2, y + 70, 40, color, { align: 'center', font: 'bold', spacing: 2 });
            cv.text(subtitle, x + w / 2, y + 114, 24, t.text, { align: 'center', font: 'label' });
        }

        function drawStatus(cv, t, panel, stopped) {
            const a = game.analysis, pct = a.activeCount ? Math.round(a.poweredCount * 100 / a.activeCount) : 0;
            const x = panel.x + 22, right = panel.x + panel.w - 22;
            cv.text('POWERED', x, panel.y + 82, 22, t.dim, { font: 'bold', spacing: 2 });
            cv.text(pct + '%', right, panel.y + 90, 58, a.complete ? t.ok : t.accent2, { align: 'right', font: 'num' });
            const by = panel.y + 110, bw = panel.w - 44;
            cv.roundRect(x, by, bw, 12, 6, G.withAlpha('#ffffff', 0.10));
            cv.roundRect(x, by, bw * pct / 100, 12, 6, a.complete ? t.ok : t.accent2);
            cv.text('ROTATIONS', x, panel.y + 158, 19, t.dim, { font: 'bold', spacing: 1.5 });
            cv.text(String(game.moves), x, panel.y + 193, 40, t.text, { font: 'num' });
            cv.text('PAR  ' + game.level.par, x + 110, panel.y + 190, 22, t.dim, { font: 'bold' });
            cv.text('DEVICES  ' + a.poweredSinks + ' / ' + a.sinks, right, panel.y + 190, 22, a.poweredSinks === a.sinks ? t.ok : t.dim, { align: 'right', font: 'bold' });

            const busy = stopped, buttonX = x, buttonW = panel.w - 44, bh = 48, gap = 12;
            let y = panel.y + 218;
            G.button(cv, t, buttonX, y, buttonW, bh, 'Undo', undo, { key: 'undo', busy: busy || !game.history.length }); y += bh + gap;
            G.button(cv, t, buttonX, y, buttonW, bh, 'Hint', hint, { key: 'hint', color: t.warn, busy: busy || a.complete }); y += bh + gap;
            G.button(cv, t, buttonX, y, buttonW, bh, a.complete ? 'Replay' : 'Restart', restart, { key: 'restart', busy }); y += bh + gap;
            const half = (buttonW - gap) / 2;
            G.button(cv, t, buttonX, y, half, bh, 'Previous', previous, { key: 'previous', busy: busy || game.levelIndex === 0 });
            G.button(cv, t, buttonX + half + gap, y, half, bh, a.complete ? 'Next level' : 'Next', next,
                { key: 'next', primary: a.complete, busy: busy || game.levelIndex + 1 >= progress.unlocked });
            if (!cv.own) cv.text('Use Next tile and Rotate in the button bar', panel.x + panel.w / 2, panel.y + panel.h - 18, 18, t.dim, { align: 'center' });
        }

        async function render() {
            const t = ctx.theme(), cv = ctx.canvas(W, H).clear(t.bg), now = Date.now(), stopped = driving();
            // G.panel stretches a page-bottom panel by cv.extra itself on the full-screen path.
            const ph = G.BOTTOM - G.TOP - 8;
            const board = G.panel(cv, t, 24, G.TOP, 1012, ph, 'LEVEL ' + (game.levelIndex + 1) + '  ·  ' + translate(game.level.name));
            const status = G.panel(cv, t, 1052, G.TOP, 524, ph, 'SYSTEM STATUS');
            const pos = boardLayout(board);
            for (let i = 0; i < game.level.cells.length; i++) {
                if (!game.level.cells[i]) continue;
                const r = Math.floor(i / game.level.cols), c = i % game.level.cols;
                drawTile(cv, t, i, pos.x + c * (pos.size + pos.gap), pos.y + r * (pos.size + pos.gap), pos.size, now, !stopped && !game.analysis.complete);
            }
            drawStatus(cv, t, status, stopped);
            if (stopped) overlay(cv, t, board, 'PARK TO PLAY', 'The circuit is paused while the vehicle is moving', t.warn);
            else if (game.analysis.complete) overlay(cv, t, board, 'CIRCUIT ONLINE', game.stars() + ' STARS  ·  ' + game.moves + ' ROTATIONS', t.ok);
            else if (game.levelIndex < 3 && game.moves === 0) {
                cv.text(translate(game.level.note), board.x + board.w / 2, board.y + board.h - 14, 19, t.dim, { align: 'center', font: 'label' });
            }
            G.frame(cv, t, [], -1, [
                stopped && { text: 'PARKED ONLY', color: 'warn' },
                game.analysis.complete && { text: 'ONLINE', color: 'ok' },
                game.hintsUsed > 0 && { text: 'HINT ' + game.hintsUsed, color: 'warn' },
            ]);
            await ui.image('MAIN_GFX', cv);
        }

        ctx.loop('MAIN', 10, render);
        render().then(() => log.info('iDrive Circuit: 30 levels ready')).catch((e) => log.warn('first render: ' + e));
    },
});

