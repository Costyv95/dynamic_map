import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';
import { OverlayManager } from './OverlayManager.js?v=3.2.1';
import { buildRoomPlate, buildWalls, applyShortcutTransforms } from '../core/MapScene.js?v=3.2.1';
import { updateRoomStyles } from '../core/RoomStyles.js?v=3.2.1';
import { buildAmbientTint, updateAmbientTint } from './AmbientTint.js?v=3.2.1';
import { buildPresenceLayer, updatePresence } from './PresenceLayer.js?v=3.2.1';
import { buildOutsideBar, updateOutsideBar } from './OutsideBar.js?v=3.2.1';
import { syncFocusPill, onRoomTap, zoomToRoom, zoomOutToDefault, animateViewBox } from './RoomFocus.js?v=3.2.1';
import { roomTint } from './RoomTemperature.js?v=3.2.1';
import { MapBuilder } from './MapBuilder.js?v=3.2.1';
import { updateRoomPanel } from './RoomPanel.js?v=3.2.1';
import { updateQuickActions } from './QuickActions.js?v=3.2.1';
import { updateRoomAlerts } from './RoomAlerts.js?v=3.2.1';

/**
 * Card methods that simply forward to the scene/feature modules with the
 * card as host. Mixed into CustomSvgMap.prototype so tests and modules can
 * keep calling (and mocking) them on the element.
 */
export const cardDelegates = {
    buildRoomPlate() { return buildRoomPlate(this); },
    buildWalls() { buildWalls(this); },
    buildAmbientTint() { buildAmbientTint(this); },
    updateAmbientTint(hass) { updateAmbientTint(this, hass); },
    buildPresenceLayer() { buildPresenceLayer(this); },
    updatePresence(hass) { updatePresence(this, hass); },
    buildOutsideBar() { buildOutsideBar(this); },
    updateOutsideBar(hass) { updateOutsideBar(this, hass); },
    onRoomTap(room) { onRoomTap(this, room); },
    zoomToRoom(room) { zoomToRoom(this, room); },
    zoomOutToDefault() { zoomOutToDefault(this); },
    animateViewBox(target, duration) { animateViewBox(this, target, duration); },
    syncFocusPill() { syncFocusPill(this); },
    updateRoomStyles() { updateRoomStyles(this); },
    applyShortcutTransforms(sx, sy) { applyShortcutTransforms(this, sx, sy); },
    getPolygonCenter(polygon) { return MapGeometry.getPolygonCenter(polygon); },
    isPointInPolygon(point, vs) { return MapGeometry.isPointInPolygon(point, vs); },
    getRandomPointInPolygon(polygon) { return MapGeometry.getRandomPointInPolygon(polygon); },
    showOverlay(shortcut, actions, event) { OverlayManager.showActionMenu(this, shortcut, actions, event); },
    showRoomSelectionUI() { OverlayManager.showRoomSelectionUI(this); },
    getCardSize() { return 3; },
    /** Temperature tint for a room (null unless room_temperature is on). */
    roomTint(room) { return roomTint(this, this._hass, room); },
    loadFloorNames(hass) { return MapBuilder.loadFloorNames(this, hass); },
    /** Everything that follows hass besides the badges and room fills. */
    updateLiveFeatures(hass) {
        updateOutsideBar(this, hass);
        updateAmbientTint(this, hass);
        updatePresence(this, hass);
        updateRoomPanel(this, hass);
        updateQuickActions(this, hass);
        updateRoomAlerts(this, hass);
    },
    /** Paint the letterbox around the map in the floor colour ('fit' keeps the card surface). */
    applyFloorBackground() {
        const paint = this.floorBgMode === 'fit' ? null : this.floorBgColor;
        if (this.renderRoot) this.renderRoot.style.background = paint || '';
    }
};
