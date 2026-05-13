import { MapShortcut } from './MapShortcut.js';

export class VacuumShortcut extends MapShortcut {
    render() {
        const shapeType = this.config.shape === 'rect' ? 'rect' : 'circle';
        const maxR = shapeType === 'rect' ? Math.min(this.rx, this.ry) : this.rx;
        
        this.inner1 = document.createElementNS(this.svgNS, 'circle');
        this.inner1.setAttribute('r', maxR * 0.8);
        this.inner1.setAttribute('fill', '#334155');
        
        this.inner2 = document.createElementNS(this.svgNS, 'circle');
        this.inner2.setAttribute('r', maxR * 0.4);
        this.inner2.setAttribute('fill', '#0ea5e9');
        
        this.inner3 = document.createElementNS(this.svgNS, 'circle');
        this.inner3.setAttribute('cx', maxR * 0.5);
        this.inner3.setAttribute('r', maxR * 0.15);
        this.inner3.setAttribute('fill', '#10b981');
        
        this.group.appendChild(this.inner1);
        this.group.appendChild(this.inner2);
        this.group.appendChild(this.inner3);
        
        super.render();
        return this.group;
    }
    
    updateState(hass) {
        super.updateState(hass);
        const entityId = this.sc.entity_id;
        if (!entityId) return;
        
        const baseName = entityId.replace('vacuum.', '');
        const statusState = hass.states[`sensor.${baseName}_status`] || hass.states[entityId];
        const roomState = hass.states[`sensor.${baseName}_current_room`];
        const chargingState = hass.states[`binary_sensor.${baseName}_charging`];

        this.mapContext.vacuumState.status = statusState ? statusState.state : 'unknown';
        this.mapContext.vacuumState.room = roomState ? roomState.state : 'unknown';
        this.mapContext.vacuumState.isCharging = chargingState ? (chargingState.state === 'on') : ['charging', 'docked', 'charging_complete'].includes(this.mapContext.vacuumState.status);

        if (this.activeState && this.activeState.icon) {
            this.stateBadge.textContent = this.activeState.icon;
        } else {
            this.stateBadge.textContent = '';
        }
        
        this.mapContext.updateVacuumLogic(this.sc);
    }
    
    animate(deltaTime) {
        const isOffline = ['unknown', 'device_offline'].includes((this.mapContext.vacuumState.status || '').toLowerCase());
        const isTrackingRoom = !this.mapContext.vacuumState.isCharging && !isOffline;

        if (isTrackingRoom && this.mapContext.vacuumState.activePolygon) {
            const distToTarget = Math.hypot(this.mapContext.vacuumState.targetX - this.mapContext.vacuumState.x, this.mapContext.vacuumState.targetY - this.mapContext.vacuumState.y);
            if (distToTarget < (this.imgW * 0.01)) {
                const newTarget = this.mapContext.getRandomPointInPolygon(this.mapContext.vacuumState.activePolygon);
                this.mapContext.vacuumState.targetX = (newTarget[0] / 100) * this.imgW;
                this.mapContext.vacuumState.targetY = (newTarget[1] / 100) * this.imgH;
            }
        }

        const dx = this.mapContext.vacuumState.targetX - this.mapContext.vacuumState.x;
        const dy = this.mapContext.vacuumState.targetY - this.mapContext.vacuumState.y;
        const dist = Math.hypot(dx, dy);

        const baseSpeed = (this.imgW + this.imgH) / 2;
        const speed = (isTrackingRoom) ? baseSpeed * 0.03 : baseSpeed * 0.15;

        if (dist > (this.imgW * 0.001)) {
            const moveAmt = Math.min(dist, speed * deltaTime);
            this.mapContext.vacuumState.x += (dx / dist) * moveAmt;
            this.mapContext.vacuumState.y += (dy / dist) * moveAmt;

            if (isNaN(this.mapContext.vacuumState.x) || isNaN(this.mapContext.vacuumState.y)) {
                this.mapContext.vacuumState.x = this.px;
                this.mapContext.vacuumState.y = this.py;
            }

            this.group.setAttribute('transform', `translate(${this.mapContext.vacuumState.x}, ${this.mapContext.vacuumState.y})`);
        }
    }
}
