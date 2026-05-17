import { renderActionsAndStates, renderVacuumRoomMapping } from './ShortcutConfigUI.js?v=2.68';
import { ApiManager } from '../shared/ApiManager.js?v=2.68';

export class EditorUIManager {
    constructor(stateManager, engine) {
        this.state = stateManager;
        this.engine = engine;
        this.activeRoomUI = document.getElementById('activeRoomUI');
        
        this.bindEvents();
    }

    bindEvents() {
        // Toggle Build Mode
        document.getElementById('buildModeToggle').addEventListener('change', (e) => {
            this.state.setEditMode(e.target.checked);
        });

        // Add Shortcut Object
        document.getElementById('addShortcutBtn').addEventListener('click', () => {
            this.state.shortcuts.push({
                id: `sc_${Date.now()}`,
                name: 'New Shortcut',
                type: 'generic',
                position: [50, 50],
                config: { shape: 'circle', color: '#0ea5e9' }
            });
            this.state.selectedShortcutIdx = this.state.shortcuts.length - 1;
            this.state.selectedRooms = [];
            this.state.saveState();
            this.updateSidebar();
            this.state.requestDrawCallback();
        });

        // Rotation Mode Toggles
        document.getElementById('rotationModeBtn').addEventListener('click', () => {
            if (this.engine.rotationMode === 'auto') this.engine.rotationMode = 'horizontal';
            else if (this.engine.rotationMode === 'horizontal') this.engine.rotationMode = 'vertical';
            else this.engine.rotationMode = 'auto';
            
            if (this.state.bgImage.complete && this.state.rooms.length > 0) {
                this.engine.calculateAutoCrop(this.state.bgImage, this.state.rooms);
                this.updateRotationUI();
            } else {
                this.updateRotationUI();
            }
            this.state.requestDrawCallback();
        });

        document.getElementById('flipHorizBtn').addEventListener('click', () => {
            if (this.engine.rotationMode === 'auto') return;
            const activeMode = this.engine.getActiveMode();
            this.engine.flips[activeMode].h = !this.engine.flips[activeMode].h;
            this.engine.calculateAutoCrop(this.state.bgImage, this.state.rooms);
            this.updateRotationUI();
            this.state.requestDrawCallback();
        });

        document.getElementById('flipVertBtn').addEventListener('click', () => {
            if (this.engine.rotationMode === 'auto') return;
            const activeMode = this.engine.getActiveMode();
            this.engine.flips[activeMode].v = !this.engine.flips[activeMode].v;
            this.engine.calculateAutoCrop(this.state.bgImage, this.state.rooms);
            this.updateRotationUI();
            this.state.requestDrawCallback();
        });

        // Shortcut inputs
        document.getElementById('scName').addEventListener('input', (e) => {
            if(this.state.selectedShortcutIdx !== -1) {
                this.state.shortcuts[this.state.selectedShortcutIdx].name = e.target.value;
            }
        });
        document.getElementById('scName').addEventListener('change', () => this.state.saveState());

        let oldEntityId = '';
        document.getElementById('scEntity').addEventListener('focus', (e) => {
            oldEntityId = e.target.value;
        });

        document.getElementById('scEntity').addEventListener('input', (e) => {
            if(this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                const newEntityId = e.target.value;
                sc.entity_id = newEntityId;
                
                if (sc.config) {
                    if (sc.config.states) {
                        sc.config.states.forEach(st => {
                            if (!st.state_entity || st.state_entity === oldEntityId) {
                                st.state_entity = newEntityId;
                            }
                        });
                    }
                    if (sc.config.actions) {
                        sc.config.actions.forEach(act => {
                            if (!act.action_entity || act.action_entity === oldEntityId) {
                                act.action_entity = newEntityId;
                            }
                        });
                    }
                    renderActionsAndStates(sc, () => renderActionsAndStates(sc, () => {}));
                }
                oldEntityId = newEntityId;
            }
        });
        document.getElementById('scEntity').addEventListener('change', () => this.state.saveState());
        
        document.getElementById('scParent').addEventListener('change', (e) => {
            if(this.state.selectedShortcutIdx !== -1) {
                this.state.shortcuts[this.state.selectedShortcutIdx].parent = e.target.value;
                this.state.saveState();
            }
        });
        
        document.getElementById('scType').addEventListener('change', (e) => {
            if(this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                sc.type = e.target.value;
                if (sc.type === 'vacuum') {
                    if (!sc.config) sc.config = {};
                    if (!sc.config.states || sc.config.states.length === 0) {
                        sc.config.states = [
                            { id: `st_${Date.now()}_1`, name: 'Docked', state_entity: sc.entity_id || '', operator: '==', value: 'docked', color: '#10b981', icon: '🔋', image: '/dynamic_map_data/icons/dock.svg' },
                            { id: `st_${Date.now()}_2`, name: 'Cleaning', state_entity: sc.entity_id || '', operator: '==', value: 'cleaning', color: '#3b82f6', icon: '🧹', image: '/dynamic_map_data/icons/vacuum.svg' },
                            { id: `st_${Date.now()}_3`, name: 'Returning', state_entity: sc.entity_id || '', operator: '==', value: 'returning', color: '#f59e0b', icon: '🏠', image: '/dynamic_map_data/icons/vacuum_return.svg' },
                            { id: `st_${Date.now()}_4`, name: 'Error', state_entity: sc.entity_id || '', operator: '==', value: 'error', color: '#ef4444', icon: '⚠️', image: '/dynamic_map_data/icons/vacuum_error.svg' }
                        ];
                    }
                    if (!sc.config.actions || sc.config.actions.length === 0) {
                        sc.config.actions = [
                            { id: `act_${Date.now()}_1`, type: 'VACUUM_ROOMS', trigger: 'overlay', action_entity: sc.entity_id || '' },
                            { id: `act_${Date.now()}_2`, type: 'CALL_SERVICE', trigger: 'overlay', action_entity: sc.entity_id || '', service: 'vacuum.return_to_base', name: 'Return to Dock', icon: '🏠' },
                            { id: `act_${Date.now()}_3`, type: 'CALL_SERVICE', trigger: 'overlay', action_entity: sc.entity_id || '', service: 'vacuum.start', name: 'Clean House', icon: '🧹' }
                        ];
                    }
                } else if (sc.type === 'light') {
                    if (!sc.config) sc.config = {};
                    if (!sc.config.states || sc.config.states.length === 0) {
                        sc.config.states = [
                            { id: `st_${Date.now()}_1`, name: 'On', state_entity: sc.entity_id || '', operator: '==', value: 'on', color: '#fbbf24', icon: '💡' },
                            { id: `st_${Date.now()}_2`, name: 'Off', state_entity: sc.entity_id || '', operator: '==', value: 'off', color: '#475569', icon: '💡' }
                        ];
                    }
                    if (!sc.config.actions || sc.config.actions.length === 0) {
                        sc.config.actions = [
                            { id: `act_${Date.now()}_1`, type: 'TOGGLE', trigger: 'tap', action_entity: sc.entity_id || '' },
                            { id: `act_${Date.now()}_2`, type: 'SLIDER', trigger: 'overlay', action_entity: sc.entity_id || '' }
                        ];
                    }
                }
                this.state.saveState();
                this.updateSidebar();
                this.state.requestDrawCallback();
            }
        });

        // Shortcut properties
        const bindScProp = (id, prop, isCheckbox = false) => {
            document.getElementById(id).addEventListener('change', (e) => {
                if(this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    if (!sc.config) sc.config = {};
                    if (isCheckbox) sc.config[prop] = !e.target.checked;
                    else sc.config[prop] = e.target.value;
                    this.state.saveState();
                    this.state.requestDrawCallback();
                }
            });
        };
        bindScProp('scShape', 'shape');
        bindScProp('scColor', 'color');
        bindScProp('scIcon', 'icon');
        bindScProp('scImage', 'image');
        bindScProp('scHasBackground', 'transparent', true);
        bindScProp('vacuumRoomSensor', 'room_sensor');

        document.getElementById('saveShortcutBtn').addEventListener('click', async (e) => {
            if (this.state.selectedShortcutIdx !== -1) {
                this.state.saveState();
                const origText = e.target.textContent;
                e.target.textContent = "Saving to HA...";
                try {
                    await ApiManager.saveToHA(this.state.activeFloor, this.state.rooms, this.state.shortcuts, {
                        rotation_mode: this.engine.rotationMode, flips: this.engine.flips
                    });
                    e.target.textContent = "Saved to HA!";
                    e.target.style.background = '#10b981';
                } catch (err) {
                    e.target.textContent = "Save Failed";
                    e.target.style.background = '#ef4444';
                }
                setTimeout(() => {
                    e.target.textContent = origText;
                    e.target.style.background = 'var(--accent)';
                }, 2000);
            }
        });

        document.getElementById('deleteShortcutBtn').addEventListener('click', () => {
            if (this.state.selectedShortcutIdx !== -1) {
                this.state.shortcuts.splice(this.state.selectedShortcutIdx, 1);
                this.state.selectedShortcutIdx = -1;
                this.state.saveState();
                this.updateSidebar();
                this.state.requestDrawCallback();
            }
        });

        document.getElementById('addActionBtn').addEventListener('click', () => {
            if(this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                if (!sc.config.actions) sc.config.actions = [];
                sc.config.actions.push({
                    id: `act_${Date.now()}`,
                    name: 'New Action',
                    trigger: 'tap',
                    type: 'CALL_SERVICE',
                    action_entity: sc.entity_id || '',
                    _expanded: true
                });
                this.state.saveState();
                renderActionsAndStates(sc, () => {});
            }
        });

        document.getElementById('addStateBtn').addEventListener('click', () => {
            if(this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                if (!sc.config.states) sc.config.states = [];
                sc.config.states.push({
                    id: `st_${Date.now()}`,
                    name: 'New State',
                    state_entity: sc.entity_id || '',
                    operator: '==',
                    value: '',
                    color: '#ffffff',
                    icon: '',
                    _expanded: true
                });
                this.state.saveState();
                renderActionsAndStates(sc, () => {});
            }
        });

        const jsonModal = document.getElementById('jsonEditorModal');
        const jsonTextarea = document.getElementById('jsonEditorTextarea');
        
        document.getElementById('rawJsonBtn').addEventListener('click', () => {
            if (this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                jsonTextarea.value = JSON.stringify(sc.config, null, 4);
                jsonModal.style.display = 'flex';
            }
        });

        const closeJsonModal = () => { jsonModal.style.display = 'none'; };
        document.getElementById('closeJsonEditorBtn').addEventListener('click', closeJsonModal);
        document.getElementById('cancelJsonEditorBtn').addEventListener('click', closeJsonModal);

        document.getElementById('saveJsonEditorBtn').addEventListener('click', () => {
            if (this.state.selectedShortcutIdx !== -1) {
                try {
                    const parsed = JSON.parse(jsonTextarea.value);
                    this.state.shortcuts[this.state.selectedShortcutIdx].config = parsed;
                    this.state.saveState();
                    this.updateSidebar();
                    this.state.requestDrawCallback();
                    closeJsonModal();
                } catch (e) {
                    alert('Invalid JSON! Please check your syntax.\n\nError: ' + e.message);
                }
            }
        });

        // Room edits
        document.getElementById('saveNameBtn').addEventListener('click', () => this.saveRoomName());
        document.getElementById('deleteBtn').addEventListener('click', () => {
            if(this.state.selectedRooms.length === 1) {
                this.state.rooms.splice(this.state.selectedRooms[0], 1);
                this.state.selectedRooms = [];
                this.state.saveState();
                this.updateSidebar();
                this.state.requestDrawCallback();
            }
        });

        document.getElementById('mergeBtn').addEventListener('click', () => {
            if(this.state.selectedRooms.length === 2 && window.PolyBool) {
                const r1 = this.state.rooms[this.state.selectedRooms[0]];
                const r2 = this.state.rooms[this.state.selectedRooms[1]];
                const p1 = { regions: [r1.polygon], inverted: false };
                const p2 = { regions: [r2.polygon], inverted: false };
                const comb = window.PolyBool.union(p1, p2);
                if(comb.regions.length > 0) {
                    r1.polygon = comb.regions[0];
                    r1.name = r1.name || r2.name;
                    this.state.rooms.splice(this.state.selectedRooms[1], 1);
                    this.state.selectedRooms = [this.state.selectedRooms[0]];
                    this.state.saveState();
                    this.updateSidebar();
                    this.state.requestDrawCallback();
                }
            }
        });
        
        // Vacuum HA Fetching
        document.getElementById('fetchHABtn').addEventListener('click', async () => {
            const entityId = document.getElementById('scEntity').value;
            const btn = document.getElementById('fetchHABtn');
            if (!entityId) {
                alert("Please enter a valid Vacuum Entity ID first!");
                return;
            }
            
            const origText = btn.textContent;
            btn.textContent = "Fetching...";
            try {
                let roomsFound = await ApiManager.fetchVacuumRooms(entityId);
                this.state.lastFetchedVacuumOptions = roomsFound;
                if (this.state.selectedShortcutIdx !== -1) {
                    renderVacuumRoomMapping(this.state.shortcuts[this.state.selectedShortcutIdx], this.state.rooms, this.state.lastFetchedVacuumOptions, () => renderActionsAndStates(this.state.shortcuts[this.state.selectedShortcutIdx], () => {}));
                }
                btn.textContent = "Success!";
            } catch (e) {
                console.error(e);
                btn.textContent = "Error";
            }
            setTimeout(() => { btn.textContent = origText; }, 2000);
        });

    }

    saveRoomName() {
        if(this.state.selectedRooms.length === 1) {
            const room = this.state.rooms[this.state.selectedRooms[0]];
            room.name = document.getElementById('roomName').value;
            room.area_id = document.getElementById('roomArea').value;
            room.entity_id = document.getElementById('roomEntity').value;
            
            const colorInput = document.getElementById('roomColor');
            room.color = colorInput.value;
            
            this.state.saveState();
            this.state.requestDrawCallback();
        }
    }

    updateRotationUI() {
        document.getElementById('rotIconAuto').style.display = 'none';
        document.getElementById('rotIconHoriz').style.display = 'none';
        document.getElementById('rotIconVert').style.display = 'none';
        
        if (this.engine.rotationMode === 'auto') document.getElementById('rotIconAuto').style.display = 'block';
        else if (this.engine.rotationMode === 'horizontal') document.getElementById('rotIconHoriz').style.display = 'block';
        else document.getElementById('rotIconVert').style.display = 'block';

        const flipHBtn = document.getElementById('flipHorizBtn');
        const flipVBtn = document.getElementById('flipVertBtn');
        
        const setBtnStyle = (btn, active, disabled) => {
            if (disabled) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.style.background = active ? '#e0f2fe' : 'rgba(255, 255, 255, 0.9)';
            } else {
                btn.style.opacity = active ? '1' : '0.8';
                btn.style.cursor = 'pointer';
                btn.style.background = active ? '#e0f2fe' : 'rgba(255, 255, 255, 0.9)';
            }
        };
        
        const activeMode = this.engine.getActiveMode ? this.engine.getActiveMode() : 'horizontal';
        const currentFlips = this.engine.flips[activeMode] || {h: false, v: false};
        
        if (this.engine.rotationMode === 'auto') {
            setBtnStyle(flipHBtn, currentFlips.h, true);
            setBtnStyle(flipVBtn, currentFlips.v, true);
        } else {
            setBtnStyle(flipHBtn, currentFlips.h, false);
            setBtnStyle(flipVBtn, currentFlips.v, false);
        }
    }

    updateSidebar() {
        document.getElementById('roomInstructions').style.display = this.state.isEditMode ? 'block' : 'none';
        this.activeRoomUI.style.display = 'none';
        document.getElementById('mergeUI').style.display = 'none';
        document.getElementById('shortcutUI').style.display = 'none';

        if (this.state.selectedShortcutIdx !== -1 && this.state.shortcuts[this.state.selectedShortcutIdx]) {
            document.getElementById('shortcutUI').style.display = 'block';
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            if (!sc.config.states || this.state.previewStateIdx >= sc.config.states.length) {
                this.state.previewStateIdx = -1;
            }
            document.getElementById('scName').value = sc.name || '';
            document.getElementById('scEntity').value = sc.entity_id || '';
            document.getElementById('scType').value = sc.type || 'generic';
            
            const scParentSelect = document.getElementById('scParent');
            scParentSelect.innerHTML = `<option value="home">Home (Global)</option><option value="floor_${this.state.activeFloor}">Current Floor (Floor ${this.state.activeFloor})</option>`;
            this.state.rooms.forEach(r => {
                scParentSelect.innerHTML += `<option value="${r.id}">Room: ${r.name || 'Unnamed'}</option>`;
            });
            scParentSelect.value = sc.parent || 'home';

            document.getElementById('scShape').value = sc.config?.shape || 'circle';
            document.getElementById('scColor').value = sc.config?.color || '#0ea5e9';
            document.getElementById('scIcon').value = sc.config?.icon || '';
            document.getElementById('scImage').value = sc.config?.image || '';
            document.getElementById('scHasBackground').checked = !(sc.config?.transparent);
            
            if (sc.type === 'vacuum') {
                document.getElementById('vacuumOptions').style.display = 'block';
                document.getElementById('vacuumRoomSensor').value = sc.config?.room_sensor || '';
                renderVacuumRoomMapping(sc, this.state.rooms, this.state.lastFetchedVacuumOptions, () => renderActionsAndStates(sc, () => {}));
            } else {
                document.getElementById('vacuumOptions').style.display = 'none';
            }
            renderActionsAndStates(sc, () => {});
        } else if (this.state.selectedRooms.length === 1) {
            this.activeRoomUI.style.display = 'block';
            const room = this.state.rooms[this.state.selectedRooms[0]];
            document.getElementById('roomName').value = room.name || '';
            document.getElementById('roomArea').value = room.area_id || '';
            document.getElementById('roomEntity').value = room.entity_id || '';
            document.getElementById('roomColor').value = room.color || '#333333';
        } else if (this.state.selectedRooms.length === 2) {
            document.getElementById('mergeUI').style.display = 'block';
        }
    }
}
