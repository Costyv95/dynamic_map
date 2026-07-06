/**
 * Shared helpers for resolving and writing per-orientation ("dual orientation")
 * shortcut properties.
 *
 * A property value may be stored either as a plain value (applied to both
 * orientations) or as an object keyed by orientation mode:
 *     { horizontal: <val>, vertical: <val> }
 *
 * Three read flavors exist, matching the exact fallback semantics used across
 * the codebase (do not merge them — `??`/`!== undefined` vs `||` differ for
 * falsy values like 0):
 *  - resolveOriented:       mode checked with `!== undefined`, horizontal leg
 *                           with `||`, plain values with `!== undefined`.
 *  - resolveOrientedLoose:  everything checked with `||` (used for positions).
 *  - resolveOrientedStrict: no fallback value at all; missing mode falls back
 *                           to `horizontal` via `!== undefined`.
 */

/** True when value is an orientation object ({horizontal, vertical}) rather than a plain value or array. */
export function isOrientationObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Resolve an orientation-aware value.
 * Orientation object: value[mode] if defined, else (value.horizontal || fallback).
 * Plain value: value if defined, else fallback.
 */
export function resolveOriented(value, mode, fallback) {
    if (isOrientationObject(value)) {
        return value[mode] !== undefined ? value[mode] : (value.horizontal || fallback);
    }
    return value !== undefined ? value : fallback;
}

/**
 * Loose (truthy) resolution, used for position arrays.
 * Orientation object: value[mode] || value.horizontal || fallback.
 * Plain value: value || fallback.
 */
export function resolveOrientedLoose(value, mode, fallback) {
    if (isOrientationObject(value)) {
        return value[mode] || value.horizontal || fallback;
    }
    return value || fallback;
}

/**
 * Strict resolution without a fallback default.
 * Orientation object: value[mode] if defined, else value.horizontal (even if falsy).
 * Plain value: returned as-is (including undefined).
 */
export function resolveOrientedStrict(value, mode) {
    if (isOrientationObject(value)) {
        return value[mode] !== undefined ? value[mode] : value.horizontal;
    }
    return value;
}

/**
 * Write a value for one orientation mode, converting a plain stored value into
 * an orientation object first (seeding both modes with the old/default value).
 */
export function writeOriented(targetObj, prop, mode, value, defaultVal) {
    if (targetObj[prop] === undefined || typeof targetObj[prop] !== 'object' || Array.isArray(targetObj[prop])) {
        const oldVal = targetObj[prop] !== undefined ? targetObj[prop] : defaultVal;
        targetObj[prop] = {
            horizontal: oldVal,
            vertical: oldVal
        };
    }
    targetObj[prop][mode] = value;
}

/**
 * Returns the object edits/reads should target: the previewed state override
 * (sc.config.states[previewStateIdx]) when one is active, otherwise the
 * shortcut itself. If requiredProp is given, the state is only targeted when
 * it defines that property (used by position reads).
 */
export function resolvePreviewTarget(sc, previewStateIdx, requiredProp) {
    if (previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
        const st = sc.config.states[previewStateIdx];
        if (requiredProp === undefined || st[requiredProp] !== undefined) {
            return st;
        }
    }
    return sc;
}

/** Proportional scaling flag: explicit config.proportional wins, else defaults to true for circles. */
export function isProportional(sc) {
    const shape = sc.config?.shape || sc.shape || 'circle';
    const propDefault = (shape === 'circle');
    return sc.config?.proportional !== undefined ? sc.config.proportional : propDefault;
}

/** Resolve prop on targetObj, falling back to the base shortcut when targetObj is a state override. */
function resolveWithBaseFallback(targetObj, sc, prop, mode, fallback) {
    if (targetObj[prop] !== undefined) {
        return resolveOriented(targetObj[prop], mode, fallback);
    }
    if (targetObj !== sc && sc[prop] !== undefined) {
        return resolveOriented(sc[prop], mode, fallback);
    }
    return fallback;
}

/** Read a position ([x%, y%]) from targetObj for the given mode (default [50, 50]). */
export function getPosition(targetObj, mode) {
    return resolveOrientedLoose(targetObj.position, mode, [50, 50]);
}

/** Write a position for the given mode, converting plain arrays to orientation objects. */
export function setPosition(targetObj, mode, pctX, pctY) {
    if (isOrientationObject(targetObj.position)) {
        targetObj.position[mode] = [pctX, pctY];
    } else {
        const oldPos = targetObj.position || [50, 50];
        targetObj.position = {
            horizontal: [...oldPos],
            vertical: [...oldPos]
        };
        targetObj.position[mode] = [pctX, pctY];
    }
}

/**
 * Read the effective {scale, scaleX, scaleY} of a shortcut for the given mode.
 * targetObj is the read target (a state override or sc itself, see
 * resolvePreviewTarget); state overrides fall back to the base shortcut.
 * Proportional shortcuts report scaleX uniformly for all three values.
 */
export function getScale(sc, targetObj, mode) {
    const scScale = resolveWithBaseFallback(targetObj, sc, 'scale', mode, 1.0);
    const scaleX = resolveWithBaseFallback(targetObj, sc, 'scaleX', mode, scScale);
    const scaleY = resolveWithBaseFallback(targetObj, sc, 'scaleY', mode, scScale);

    if (isProportional(sc)) {
        const uniformScale = scaleX;
        return { scale: uniformScale, scaleX: uniformScale, scaleY: uniformScale };
    }

    return { scale: scScale, scaleX, scaleY };
}

/**
 * Write one scale prop ('scale' | 'scaleX' | 'scaleY') for the given mode on
 * targetObj. Proportional shortcuts write all three props uniformly.
 */
export function setScale(sc, targetObj, prop, mode, value) {
    if (isProportional(sc)) {
        ['scale', 'scaleX', 'scaleY'].forEach(p => writeOriented(targetObj, p, mode, value, 1.0));
        return;
    }
    writeOriented(targetObj, prop, mode, value, 1.0);
}

/** Read the effective rotation (degrees) for the given mode (default 0), with state->base fallback. */
export function getRotation(sc, targetObj, mode) {
    return resolveWithBaseFallback(targetObj, sc, 'rotation', mode, 0);
}

/** Write the rotation for the given mode on targetObj. */
export function setRotation(targetObj, mode, value) {
    writeOriented(targetObj, 'rotation', mode, value, 0);
}
