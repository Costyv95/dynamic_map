import { placeVisual, iconHtml, onServiceError } from './common.js?v=3.2.1';
import { executeAction, buildRoomNameToSegmentMap } from '../../shared/ActionRunner.js?v=3.2.1';
import { computeProgressBar } from '../../shared/ProgressBar.js?v=3.2.1';

/** Read-only INFO_DISPLAY box and the PROGRESS_BAR readout. */

export function formatInfoValue(act, st) {
    const raw = st ? (act.attribute ? st.attributes[act.attribute] : st.state) : null;
    let unit = act.unit;
    if (unit === undefined) unit = (st && !act.attribute) ? (st.attributes.unit_of_measurement || '') : '';
    const num = parseFloat(raw);
    if (raw !== null && raw !== undefined && raw !== '' && !isNaN(num) && String(raw).trim() !== '') {
        const dec = act.decimals !== undefined ? act.decimals : (Number.isInteger(num) ? 0 : 1);
        return `${num.toFixed(dec)}${unit ? ' ' + unit : ''}`;
    }
    if (raw === null || raw === undefined || raw === '' || raw === 'unknown' || raw === 'unavailable') return '--';
    return `${raw}${unit ? ' ' + unit : ''}`;
}

export function buildInfoDisplay(mapContext, target, act, isVisual) {
    const st = mapContext._hass ? mapContext._hass.states[target] : null;
    const box = document.createElement('div');
    box.style.cssText = 'display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 6px 10px;'
        + 'border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); box-sizing: border-box;';
    const displayName = act.name !== undefined ? act.name : 'Value';
    if (displayName) {
        const cap = document.createElement('span');
        cap.textContent = displayName;
        cap.style.cssText = 'font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8;';
        box.appendChild(cap);
    }
    const val = document.createElement('div');
    val.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    val.innerHTML = `${iconHtml(act.icon, 18)}<span style="font-size:18px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">${formatInfoValue(act, st)}</span>`;
    box.appendChild(val);
    placeVisual(box, act, isVisual);
    return box;
}

/**
 * Generic horizontal bar for any numeric entity/attribute. Optional tap
 * action (act.service) is confirm-then-run: a bar is a readout and a
 * stray tap must not fire a service that resets a counter.
 */
export function buildProgressBar(mapContext, target, act, isVisual) {
    const bar = computeProgressBar({ act, hass: mapContext._hass, target });
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display: flex; flex-direction: column; justify-content: center; gap: 3px; box-sizing: border-box; padding: 2px 0;';
    const showValue = act.show_value !== false;
    let capText = null;
    if (bar.label || showValue) {
        const head = document.createElement('div');
        head.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 11px; line-height: 1.1;';
        const cap = document.createElement('span');
        cap.style.cssText = 'display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #cbd5e1;';
        cap.innerHTML = iconHtml(act.icon, 14, 'font-size:12px;');
        capText = document.createElement('span');
        capText.textContent = bar.label || '';
        cap.appendChild(capText);
        head.appendChild(cap);
        if (showValue) {
            const valEl = document.createElement('span');
            valEl.textContent = bar.valueStr;
            valEl.style.cssText = 'font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; white-space: nowrap;';
            head.appendChild(valEl);
        }
        wrap.appendChild(head);
    }
    const track = document.createElement('div');
    track.style.cssText = `width: 100%; height: ${act.bar_height || 8}px; border-radius: 999px; background: rgba(255,255,255,0.12); overflow: hidden;`;
    const fill = document.createElement('div');
    fill.style.cssText = `height: 100%; width: 0%; border-radius: 999px; background: ${bar.color}; transition: width 0.4s ease, background 0.3s;`;
    track.appendChild(fill);
    wrap.appendChild(track);
    setTimeout(() => { fill.style.width = bar.pct + '%'; }, 50);

    if (act.service) {
        const needsConfirm = act.confirm !== false;
        let armed = false;
        let armedTimer = null;
        const originalLabel = capText ? capText.textContent : '';
        wrap.style.cursor = 'pointer';
        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!mapContext._hass) return;
            if (needsConfirm && !armed) {
                armed = true;
                if (capText) capText.textContent = act.confirm_text || 'Tap again to confirm';
                wrap.style.outline = '1px solid rgba(239,68,68,0.6)';
                wrap.style.borderRadius = '6px';
                armedTimer = setTimeout(() => {
                    armed = false;
                    if (capText) capText.textContent = originalLabel;
                    wrap.style.outline = 'none';
                }, 4000);
                return;
            }
            if (armedTimer) clearTimeout(armedTimer);
            armed = false;
            wrap.style.outline = 'none';
            if (capText) capText.textContent = originalLabel;
            executeAction(mapContext._hass, { ...act, type: 'CALL_SERVICE' }, target, {
                nameToSegmentId: buildRoomNameToSegmentMap(target, mapContext.shortcutElements, mapContext.rooms),
                onServiceError
            });
        });
    }
    placeVisual(wrap, act, isVisual);
    return wrap;
}
