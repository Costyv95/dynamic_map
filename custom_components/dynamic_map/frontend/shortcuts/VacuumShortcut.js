import { GenericShortcut } from './GenericShortcut.js';

export class VacuumShortcut extends GenericShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        super(scData, svgNS, imgW, imgH, mapContext);
        this.vacuumState = { status: 'unknown', room: 'unknown', isCharging: false, x: this.px, y: this.py, targetX: this.px, targetY: this.py, activePolygon: null };
        this._initialized = false;
    }

    updateState(hass) {
        super.updateState(hass);
        const entityId = this.sc.entity_id;
        if (!entityId) return false;
        
        const baseName = entityId.replace('vacuum.', '');
        const statusState = hass.states[`sensor.${baseName}_status`] || hass.states[entityId];
        const roomState = hass.states[`sensor.${baseName}_current_room`];
        const chargingState = hass.states[`binary_sensor.${baseName}_charging`];

        const newStatus = statusState ? statusState.state : 'unknown';
        const newRoom = roomState ? roomState.state : 'unknown';
        const newCharging = chargingState ? (chargingState.state === 'on') : ['charging', 'docked', 'charging_complete'].includes(newStatus);

        let changed = false;
        
        if (this.vacuumState.status !== newStatus) { this.vacuumState.status = newStatus; changed = true; }
        if (this.vacuumState.room !== newRoom) { this.vacuumState.room = newRoom; changed = true; }
        if (this.vacuumState.isCharging !== newCharging) { this.vacuumState.isCharging = newCharging; changed = true; }

        if (this.activeState && this.activeState.icon) {
            this.iconText.textContent = this.activeState.icon;
        } else {
            this.iconText.textContent = this.config.icon || '🧹';
        }
        
        if (changed || !this._initialized) {
            this.updateVacuumLogic();
            this._initialized = true;
        }
        
        return changed;
    }
    
    updateVacuumLogic() {
        const sc = this.sc;
        const imgW = this.mapContext.imgW;
        const imgH = this.mapContext.imgH;
        
        const isOffline = ['unknown', 'device_offline'].includes((this.vacuumState.status || '').toLowerCase());
        const isTrackingRoom = !this.vacuumState.isCharging && !isOffline;
        
        if (!isTrackingRoom) {
            this.vacuumState.targetX = (sc.position[0] / 100) * imgW;
            this.vacuumState.targetY = (sc.position[1] / 100) * imgH;
            this.vacuumState.activePolygon = null;
        } else {
            let targetSvgRoomId = null;
            for (const [roboRoomName, svgRoomId] of Object.entries(sc.room_mapping || {})) {
                if (roboRoomName.toLowerCase() === (this.vacuumState.room || '').toLowerCase()) {
                    targetSvgRoomId = svgRoomId;
                    break;
                }
            }

            if (targetSvgRoomId) {
                const targetRoom = this.mapContext.rooms.find(r => r.id === targetSvgRoomId);
                if (targetRoom) {
                    if (this.vacuumState.status === 'error') {
                        this.vacuumState.activePolygon = targetRoom.polygon;
                        const center = this.mapContext.getPolygonCenter(targetRoom.polygon);
                        this.vacuumState.targetX = (center[0] / 100) * imgW;
                        this.vacuumState.targetY = (center[1] / 100) * imgH;
                    } else if (isTrackingRoom) {
                        if (this.vacuumState.activePolygon !== targetRoom.polygon) {
                            this.vacuumState.activePolygon = targetRoom.polygon;
                            const center = this.mapContext.getPolygonCenter(targetRoom.polygon);
                            this.vacuumState.targetX = (center[0] / 100) * imgW;
                            this.vacuumState.targetY = (center[1] / 100) * imgH;
                            // Teleport instantly to avoid flying through walls!
                            this.vacuumState.x = this.vacuumState.targetX;
                            this.vacuumState.y = this.vacuumState.targetY;
                        }
                    }
                }
            } else {
                this.vacuumState.targetX = (sc.position[0] / 100) * imgW;
                this.vacuumState.targetY = (sc.position[1] / 100) * imgH;
                this.vacuumState.activePolygon = null;
            }
        }
    }
    
    animate(deltaTime) {
        if (!this.vacuumState) return;
        const imgW = this.mapContext.imgW;
        const imgH = this.mapContext.imgH;
        
        const isOffline = ['unknown', 'device_offline'].includes((this.vacuumState.status || '').toLowerCase());
        const isTrackingRoom = !this.vacuumState.isCharging && !isOffline;

        if (isTrackingRoom && this.vacuumState.activePolygon) {
            const distToTarget = Math.hypot(this.vacuumState.targetX - this.vacuumState.x, this.vacuumState.targetY - this.vacuumState.y);
            if (distToTarget < (imgW * 0.01)) {
                const newTarget = this.mapContext.getRandomPointInPolygon(this.vacuumState.activePolygon);
                this.vacuumState.targetX = (newTarget[0] / 100) * imgW;
                this.vacuumState.targetY = (newTarget[1] / 100) * imgH;
            }
        }

        const dx = this.vacuumState.targetX - this.vacuumState.x;
        const dy = this.vacuumState.targetY - this.vacuumState.y;
        const dist = Math.hypot(dx, dy);

        const baseSpeed = (imgW + imgH) / 2;
        const speed = (isTrackingRoom) ? baseSpeed * 0.03 : baseSpeed * 0.15;

        if (dist > (imgW * 0.001)) {
            const moveAmt = Math.min(dist, speed * deltaTime);
            this.vacuumState.x += (dx / dist) * moveAmt;
            this.vacuumState.y += (dy / dist) * moveAmt;

            if (isNaN(this.vacuumState.x) || isNaN(this.vacuumState.y)) {
                this.vacuumState.x = this.px;
                this.vacuumState.y = this.py;
            }

            this.group.setAttribute('transform', `translate(${this.vacuumState.x}, ${this.vacuumState.y})`);
        }
    }
}
