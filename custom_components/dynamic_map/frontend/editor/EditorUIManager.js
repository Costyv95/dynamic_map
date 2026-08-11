import { renderActionsAndStates, renderVacuumRoomMapping } from './ShortcutConfigUI.js?v=3.2.1';
import { ApiManager } from '../shared/ApiManager.js?v=3.2.1';
import { resolvePreviewTarget, getScale, setScale, getRotation, setRotation } from '../shared/OrientationProps.js?v=3.2.1';

export class EditorUIManager {
    constructor(stateManager, engine) {
        this.state = stateManager;
        this.engine = engine;
        this.activeRoomUI = document.getElementById('activeRoomUI');
        
        this.bindEvents();
    }

    handleShortcutChange(isFinalChange = true) {
        if (isFinalChange) {
            this.state.saveState();
        }
        this.state.requestDrawCallback();
    }

    bindEvents() {
        // Toggle Build Mode
        document.getElementById('buildModeToggle').addEventListener('change', (e) => {
            this.state.setEditMode(e.target.checked);
        });

        // Add Shortcut Object
        document.getElementById('addShortcutBtn').addEventListener('click', () => {
            this.state.setActiveLayer('objects');
            const defaultColor = localStorage.getItem('lastShortcutColor') || '#0ea5e9';
            this.state.shortcuts.push({
                id: `sc_${Date.now()}`,
                name: 'New Shortcut',
                type: 'generic',
                position: [50, 50],
                config: { shape: 'circle', color: defaultColor }
            });
            this.state.selectedShortcutIdx = this.state.shortcuts.length - 1;
            this.state.selectedRooms = [];
            this.state.saveState();
            this.updateSidebar();
            this.state.requestDrawCallback();
        });

        // Layer switcher: objects (interactive shortcuts) / decor scenery / walls
        document.getElementById('layerObjectsBtn').addEventListener('click', () => {
            this.state.setActiveLayer('objects');
            this.updateSidebar();
        });
        document.getElementById('layerDecorBtn').addEventListener('click', () => {
            this.state.setActiveLayer('decor');
            this.updateSidebar();
        });
        document.getElementById('layerWallsBtn').addEventListener('click', () => {
            this.state.setActiveLayer('walls');
            // Floor has no walls yet: arm the draw tool right away so the
            // first map click starts the first wall.
            if (!this.state.walls.length && !this.state.drawingWall) {
                this.state.drawingWall = [];
            }
            this.updateSidebar();
            this.state.requestDrawCallback();
        });

        // Wall tools
        document.getElementById('drawWallBtn').addEventListener('click', () => {
            this.state.setActiveLayer('walls');
            this.state.drawingWall = [];
            this.state.selectedWallIdx = -1;
            this.updateSidebar();
            this.state.requestDrawCallback();
        });
        const wallSel = () => this.state.walls[this.state.selectedWallIdx];
        const bumpThickness = (delta) => {
            const w = wallSel();
            if (!w) return;
            w.thickness = Math.max(1, Math.min(60, (Number(w.thickness) || 8) + delta));
            this.state.lastWallThickness = w.thickness;
            document.getElementById('wallThickness').value = w.thickness;
            this.state.saveState();
            this.state.requestDrawCallback();
        };
        document.getElementById('wallThinnerBtn').addEventListener('click', () => bumpThickness(-1));
        document.getElementById('wallThickerBtn').addEventListener('click', () => bumpThickness(1));
        document.getElementById('wallThickness').addEventListener('change', (e) => {
            const w = wallSel();
            if (!w) return;
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v >= 1) {
                w.thickness = Math.min(60, v);
                this.state.lastWallThickness = w.thickness;
                this.state.saveState();
                this.state.requestDrawCallback();
            }
        });
        document.getElementById('wallColor').addEventListener('change', (e) => {
            const w = wallSel();
            if (!w) return;
            w.color = e.target.value;
            this.state.lastWallColor = w.color;
            this.state.saveState();
            this.state.requestDrawCallback();
        });
        document.getElementById('deleteWallBtn').addEventListener('click', () => {
            if (this.state.selectedWallIdx === -1) return;
            this.state.walls.splice(this.state.selectedWallIdx, 1);
            this.state.selectedWallIdx = -1;
            this.state.saveState();
            this.updateSidebar();
            this.state.requestDrawCallback();
        });

        // Add a decor item: scenery-only, rect + texture, rotates with the
        // plan like real furniture, never interactive on the dashboard.
        document.getElementById('addDecorBtn').addEventListener('click', () => {
            this.state.setActiveLayer('decor');
            this.state.shortcuts.push({
                id: `sc_${Date.now()}`,
                name: 'New Decor',
                type: 'generic',
                position: [50, 50],
                scaleX: 3, scaleY: 3,
                config: {
                    shape: 'rect', color: '#94a3b8', transparent: true,
                    decor: true, autoRotate: true, proportional: false
                }
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
                this.state.requestDrawCallback();
            }
        });
        document.getElementById('scName').addEventListener('change', () => {
            this.state.saveState();
            this.state.requestDrawCallback();
        });

        document.getElementById('scDescription').addEventListener('input', (e) => {
            if(this.state.selectedShortcutIdx !== -1) {
                this.state.shortcuts[this.state.selectedShortcutIdx].description = e.target.value;
            }
        });
        document.getElementById('scDescription').addEventListener('change', () => {
            this.state.saveState();
        });

        const genBtn = document.getElementById('scGenerateTexture');
        genBtn.addEventListener('click', async () => {
            if (this.state.selectedShortcutIdx === -1) return;
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            const description = (sc.description || '').trim() || (sc.name || '').trim();
            if (!description) {
                alert('Fill the Appearance field (or at least the Name) first.');
                return;
            }
            // When a state is being previewed, generate that state's artwork
            // (prompt = shortcut appearance + state appearance).
            const previewIdx = this.state.previewStateIdx;
            const previewState = (previewIdx !== -1 && sc.config?.states) ? sc.config.states[previewIdx] : null;
            genBtn.disabled = true;
            const oldLabel = genBtn.textContent;
            genBtn.textContent = '⏳ Generating - this can take a minute…';
            try {
                const result = await ApiManager.generateTexture(description, {
                    stateDescription: previewState?.description || undefined,
                    tileable: !!(previewState?.image_tiling ?? sc.config?.image_tiling),
                    // Decor renders in the architectural plan style so it
                    // blends with the magicplan furniture on other floors.
                    style: sc.config?.decor ? 'decor' : undefined,
                });
                if (!sc.config) sc.config = {};
                if (previewState) {
                    previewState.image = result.path;
                } else {
                    sc.config.image = result.path;
                }
                document.getElementById('scImage').value = result.path;
                this.state.saveState();
                this.state.requestDrawCallback();
                this.updateSidebar();
            } catch (e) {
                alert(`Texture generation failed: ${e.message}`);
            } finally {
                genBtn.disabled = false;
                genBtn.textContent = oldLabel;
            }
        });

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
                    renderActionsAndStates(sc, (final) => this.handleShortcutChange(final));
                }
                oldEntityId = newEntityId;
                this.state.requestDrawCallback();
            }
        });
        document.getElementById('scEntity').addEventListener('change', () => {
            this.state.saveState();
            this.state.requestDrawCallback();
        });
        
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
                } else if (sc.type === 'sensor') {
                    if (!sc.config) sc.config = {};
                    sc.config.temperature_entity = sc.config.temperature_entity || sc.entity_id || 'sensor.room_temperature';
                    sc.config.humidity_entity = sc.config.humidity_entity || 'sensor.room_humidity';
                    if (!sc.config.states || sc.config.states.length === 0) {
                        sc.config.states = [
                            { id: `st_${Date.now()}_temp_cold`, name: 'Temperature Cold', state_entity: sc.config.temperature_entity, operator: '<', value: '19', color: '#3b82f6', icon: '❄️' },
                            { id: `st_${Date.now()}_temp_ok`, name: 'Temperature Comfort', state_entity: sc.config.temperature_entity, operator: 'between', value: '19-22', color: '#10b981', icon: '🌡️' },
                            { id: `st_${Date.now()}_temp_hot`, name: 'Temperature Warm', state_entity: sc.config.temperature_entity, operator: '>', value: '22', color: '#f97316', icon: '🔥' },
                            { id: `st_${Date.now()}_hum_dry`, name: 'Humidity Dry', state_entity: sc.config.humidity_entity, operator: '<', value: '40', color: '#eab308', icon: '🌵' },
                            { id: `st_${Date.now()}_hum_ok`, name: 'Humidity Normal', state_entity: sc.config.humidity_entity, operator: 'between', value: '40-60', color: '#10b981', icon: '💧' },
                            { id: `st_${Date.now()}_hum_wet`, name: 'Humidity Wet', state_entity: sc.config.humidity_entity, operator: '>', value: '60', color: '#3b82f6', icon: '🌧️' }
                        ];
                    }
                    if (!sc.config.actions || sc.config.actions.length === 0) {
                        sc.config.actions = [
                            { id: `act_${Date.now()}_1`, type: 'TOGGLE', trigger: 'tap', action_entity: sc.entity_id || '' },
                            { id: `act_${Date.now()}_2`, type: 'SENSOR_OVERLAY', trigger: 'long_press', action_entity: sc.entity_id || '' }
                        ];
                    }
                }
                this.state.saveState();
                this.updateSidebar();
                this.state.requestDrawCallback();
            }
        });

        // Shortcut properties
        const bindScProp = (id, prop, isCheckbox = false, isTrueCheckbox = false) => {
            const el = document.getElementById(id);
            if (!el) return;

            const updateVal = (e) => {
                if(this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    if (!sc.config) sc.config = {};
                    
                    let targetObj = sc.config;
                    if (this.state.previewStateIdx !== -1 && sc.config.states && sc.config.states[this.state.previewStateIdx]) {
                        targetObj = sc.config.states[this.state.previewStateIdx];
                    }
                    
                    let val;
                    if (isCheckbox) {
                        if (isTrueCheckbox) {
                            val = e.target.checked;
                        } else {
                            val = !e.target.checked;
                        }
                    } else {
                        val = e.target.value;
                        if (el.type === 'number') {
                            val = parseFloat(val);
                            if (isNaN(val)) val = undefined;
                        }
                    }
                    
                    if (val === undefined) {
                        delete targetObj[prop];
                    } else {
                        targetObj[prop] = val;
                    }
                }
            };

            el.addEventListener('input', (e) => {
                updateVal(e);
                if (id === 'scColor') {
                    localStorage.setItem('lastShortcutColor', e.target.value);
                }
                this.state.requestDrawCallback();
            });

            el.addEventListener('change', (e) => {
                updateVal(e);
                if (id === 'scColor') {
                    localStorage.setItem('lastShortcutColor', e.target.value);
                }
                this.state.saveState();
                this.state.requestDrawCallback();
            });
        };
        bindScProp('scShape', 'shape');
        const shapeSelect = document.getElementById('scShape');
        if (shapeSelect) {
            shapeSelect.addEventListener('change', (e) => {
                if (this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    if (sc.shape !== undefined) {
                        sc.shape = e.target.value;
                    }
                    this.updateSidebar();
                }
            });
        }
        // Sync scColor and scColorText
        const scColorInput = document.getElementById('scColor');
        const scColorText = document.getElementById('scColorText');
        if (scColorInput && scColorText) {
            const syncScColor = (val) => {
                scColorInput.value = val;
                scColorText.value = val;
                localStorage.setItem('lastShortcutColor', val);
                if (this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    if (!sc.config) sc.config = {};
                    sc.config.color = val;
                }
                this.state.requestDrawCallback();
            };
            scColorInput.addEventListener('input', (e) => syncScColor(e.target.value));
            scColorInput.addEventListener('change', (e) => {
                syncScColor(e.target.value);
                this.state.saveState();
            });
            scColorText.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncScColor(val);
                }
            });
            scColorText.addEventListener('change', (e) => {
                let val = e.target.value.trim();
                if (/^[0-9A-F]{6}$/i.test(val)) {
                    val = '#' + val;
                }
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncScColor(val);
                    this.state.saveState();
                } else {
                    if (this.state.selectedShortcutIdx !== -1) {
                        const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                        scColorText.value = sc.config?.color || '#0ea5e9';
                    }
                }
            });
        }
        bindScProp('scIcon', 'icon');
        bindScProp('scImage', 'image');
        document.getElementById('scImageTiling').addEventListener('change', (e) => {
            if (this.state.selectedShortcutIdx === -1) return;
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            if (!sc.config) sc.config = {};
            let targetObj = sc.config;
            if (this.state.previewStateIdx !== -1 && sc.config.states && sc.config.states[this.state.previewStateIdx]) {
                targetObj = sc.config.states[this.state.previewStateIdx];
            }
            const v = e.target.value;
            if (v === 'off') {
                delete targetObj.image_tiling;
            } else {
                // 'axis' is stored as true for back-compat with older data
                targetObj.image_tiling = v === 'both' ? 'both' : true;
            }
            this.state.saveState();
            this.state.requestDrawCallback();
        });
        bindScProp('scAutoRotate', 'autoRotate', true, true);
        bindScProp('scHasBackground', 'transparent', true);
        bindScProp('scHasBorder', 'border', true, true);
        bindScProp('scProportionalScale', 'proportional', true, true);
        
        bindScProp('scContentXInput', 'content_x');
        bindScProp('scContentYInput', 'content_y');
        bindScProp('scContentScaleXInput', 'content_scaleX');
        bindScProp('scContentScaleYInput', 'content_scaleY');
        bindScProp('scContentRotationInput', 'content_rotation');
        bindScProp('scContentMatchSize', 'content_matchSize', true, true);
        bindScProp('scContentMatchRotation', 'content_matchRotation', true, true);
        
        const propScaleIn = document.getElementById('scProportionalScale');
        if (propScaleIn) {
            propScaleIn.addEventListener('change', () => {
                this.updateSidebar();
            });
        }
        
        const matchSizeIn = document.getElementById('scContentMatchSize');
        if (matchSizeIn) {
            matchSizeIn.addEventListener('change', () => {
                this.updateSidebar();
            });
        }
        
        const matchRotIn = document.getElementById('scContentMatchRotation');
        if (matchRotIn) {
            matchRotIn.addEventListener('change', () => {
                this.updateSidebar();
            });
        }
        
        bindScProp('vacuumRoomSensor', 'room_sensor');
        bindScProp('scAvailabilityEntity', 'availability_entity');
        bindScProp('scTemperatureEntity', 'temperature_entity');
        bindScProp('scHumidityEntity', 'humidity_entity');
        bindScProp('scValueTemplate', 'value_template');

        const scaleXIn = document.getElementById('scScaleXInput');
        const scaleYIn = document.getElementById('scScaleYInput');
        const rotIn = document.getElementById('scRotationInput');

        if (scaleXIn) {
            scaleXIn.addEventListener('input', (e) => {
                if (this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    this.setShortcutScale(sc, 'scaleX', parseFloat(e.target.value) || 1.0);
                    
                    const shape = sc.config?.shape || sc.shape || 'circle';
                    if (shape === 'circle') {
                        if (scaleYIn) {
                            scaleYIn.value = e.target.value;
                        }
                    }
                    this.state.requestDrawCallback();
                }
            });
            scaleXIn.addEventListener('change', () => this.state.saveState());
        }
        if (scaleYIn) {
            scaleYIn.addEventListener('input', (e) => {
                if (this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    this.setShortcutScale(sc, 'scaleY', parseFloat(e.target.value) || 1.0);
                    this.state.requestDrawCallback();
                }
            });
            scaleYIn.addEventListener('change', () => this.state.saveState());
        }
        if (rotIn) {
            rotIn.addEventListener('input', (e) => {
                if (this.state.selectedShortcutIdx !== -1) {
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    this.setShortcutRotation(sc, parseFloat(e.target.value) || 0);
                    this.state.requestDrawCallback();
                }
            });
            rotIn.addEventListener('change', () => this.state.saveState());
        }

        const advancedPosHeader = document.getElementById('toggleAdvancedPosHeader');
        const advancedPosContent = document.getElementById('advancedPosContent');
        const advancedChevron = document.getElementById('advancedChevron');
        if (advancedPosHeader && advancedPosContent && advancedChevron) {
            advancedPosHeader.addEventListener('click', () => {
                const isOpen = advancedPosContent.style.display === 'block';
                advancedPosContent.style.display = isOpen ? 'none' : 'block';
                advancedChevron.textContent = isOpen ? '▶' : '▼';
            });
        }

        document.getElementById('saveShortcutBtn').addEventListener('click', async (e) => {
            if (this.state.selectedShortcutIdx !== -1) {
                this.state.saveState();
                const origText = e.target.textContent;
                e.target.textContent = "Saving to HA...";
                try {
                    await ApiManager.saveToHA(this.state.activeFloor, this.state.rooms, this.state.shortcuts, {
                        rotation_mode: this.engine.rotationMode, flips: this.engine.flips,
                        background_color: this.engine.backgroundColor || undefined,
                        background_mode: this.engine.backgroundMode !== 'image' ? this.engine.backgroundMode : undefined,
                        walls: this.state.walls.length ? this.state.walls : undefined
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

        document.getElementById('duplicateShortcutBtn').addEventListener('click', () => {
            const copy = this.state.duplicateSelectedShortcut();
            if (copy) this.updateSidebar();
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
                renderActionsAndStates(sc, (final) => this.handleShortcutChange(final));
            }
        });

        document.getElementById('addStateBtn').addEventListener('click', () => {
            if(this.state.selectedShortcutIdx !== -1) {
                const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                if (!sc.config.states) sc.config.states = [];
                const defaultStateColor = localStorage.getItem('lastStateColor') || '#ffffff';
                sc.config.states.push({
                    id: `st_${Date.now()}`,
                    name: 'New State',
                    state_entity: sc.entity_id || '',
                    operator: '==',
                    value: '',
                    color: defaultStateColor,
                    icon: '',
                    _expanded: true
                });
                this.state.saveState();
                renderActionsAndStates(sc, (final) => this.handleShortcutChange(final));
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
                    const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
                    
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.config && typeof parsed.config === 'object') {
                            // Full shortcut object pasted
                            sc.config = parsed.config;
                            if (parsed.type) sc.type = parsed.type;
                            if (parsed.entity_id !== undefined) sc.entity_id = parsed.entity_id;
                            if (parsed.name !== undefined) sc.name = parsed.name;
                            if (parsed.scale !== undefined) sc.scale = parsed.scale;
                            if (parsed.scaleX !== undefined) sc.scaleX = parsed.scaleX;
                            if (parsed.scaleY !== undefined) sc.scaleY = parsed.scaleY;
                            if (parsed.shape !== undefined) sc.shape = parsed.shape;
                        } else {
                            // standalone config block pasted
                            sc.config = parsed;
                            // Check if top-level properties are inline inside the pasted config block
                            if (parsed.type) {
                                sc.type = parsed.type;
                                delete sc.config.type;
                            }
                            if (parsed.entity_id !== undefined) {
                                sc.entity_id = parsed.entity_id;
                                delete sc.config.entity_id;
                            }
                            if (parsed.name !== undefined) {
                                sc.name = parsed.name;
                                delete sc.config.name;
                            }
                            if (parsed.shape !== undefined) {
                                sc.shape = parsed.shape;
                                delete sc.config.shape;
                            }
                        }
                    }
                    
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
        // Sync roomColor and roomColorText
        const roomColorInput = document.getElementById('roomColor');
        const roomColorText = document.getElementById('roomColorText');
        if (roomColorInput && roomColorText) {
            const syncRoomColor = (val) => {
                roomColorInput.value = val;
                roomColorText.value = val;
                localStorage.setItem('lastRoomColor', val);
                if (this.state.selectedRooms.length === 1) {
                    const room = this.state.rooms[this.state.selectedRooms[0]];
                    room.color = val;
                }
                this.state.requestDrawCallback();
            };
            roomColorInput.addEventListener('input', (e) => syncRoomColor(e.target.value));
            roomColorInput.addEventListener('change', (e) => {
                syncRoomColor(e.target.value);
                this.state.saveState();
            });
            roomColorText.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncRoomColor(val);
                }
            });
            roomColorText.addEventListener('change', (e) => {
                let val = e.target.value.trim();
                if (/^[0-9A-F]{6}$/i.test(val)) {
                    val = '#' + val;
                }
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncRoomColor(val);
                    this.state.saveState();
                } else {
                    if (this.state.selectedRooms.length === 1) {
                        const room = this.state.rooms[this.state.selectedRooms[0]];
                        roomColorText.value = room.color || '#333333';
                    }
                }
            });
        }

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
                    renderVacuumRoomMapping(this.state.shortcuts[this.state.selectedShortcutIdx], this.state.rooms, this.state.lastFetchedVacuumOptions, (final) => this.handleShortcutChange(final));
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

        const modeBtn = document.getElementById('rotationModeBtn');
        if (this.engine.rotationMode === 'auto') {
            document.getElementById('rotIconAuto').style.display = 'block';
            modeBtn.title = 'CARD rotation: Auto — on each screen the card picks the orientation that fits best (recommended). Click to force horizontal.';
        } else if (this.engine.rotationMode === 'horizontal') {
            document.getElementById('rotIconHoriz').style.display = 'block';
            modeBtn.title = 'CARD rotation: forced HORIZONTAL on every screen (flips become available). Click to force vertical.';
        } else {
            document.getElementById('rotIconVert').style.display = 'block';
            modeBtn.title = 'CARD rotation: forced VERTICAL on every screen (flips become available). Click for Auto.';
        }

        // A forced card rotation means one of the two layouts can never be
        // shown - dim its editing button so nobody polishes dead data.
        const hBtn = document.getElementById('toggleHorizontalBtn');
        const vBtn = document.getElementById('toggleVerticalBtn');
        const markLayout = (btn, unused, which) => {
            btn.style.opacity = unused ? '0.4' : '';
            btn.style.textDecoration = unused ? 'line-through' : '';
            if (unused) {
                btn.title = `This layout is NEVER shown right now: card rotation is forced to ${which}. Switch the rotation button to Auto to use both layouts.`;
            } else {
                btn.title = btn.id === 'toggleHorizontalBtn'
                    ? 'EDIT the horizontal-map layout — used on wide screens (TV, desktop). Only changes your editing view, never the card.'
                    : 'EDIT the vertical-map layout — used on tall screens (phone upright). Only changes your editing view, never the card.';
            }
        };
        markLayout(vBtn, this.engine.rotationMode === 'horizontal', 'horizontal');
        markLayout(hBtn, this.engine.rotationMode === 'vertical', 'vertical');

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

    /** Layer buttons + the decor list / wall panel for the active layer. */
    updateDecorUI() {
        const layer = this.state.activeLayer;
        const decorActive = layer === 'decor';
        const wallsActive = layer === 'walls';
        document.getElementById('layerObjectsBtn').classList.toggle('active', layer === 'objects');
        document.getElementById('layerDecorBtn').classList.toggle('active', decorActive);
        document.getElementById('layerWallsBtn').classList.toggle('active', wallsActive);

        this.updateWallUI(wallsActive);

        const panel = document.getElementById('decorListUI');
        panel.style.display = decorActive ? 'block' : 'none';
        if (!decorActive) return;

        const list = document.getElementById('decorItemsList');
        list.innerHTML = '';
        let any = false;
        this.state.shortcuts.forEach((sc, idx) => {
            if (!sc.config || !sc.config.decor) return;
            any = true;
            const row = document.createElement('div');
            const selected = idx === this.state.selectedShortcutIdx;
            row.textContent = `🪴 ${sc.name || 'Decor'}`;
            row.style.cssText = 'padding: 5px 8px; border-radius: 5px; cursor: pointer; font-size: 12px;'
                + (selected
                    ? 'background: var(--accent); color: white; font-weight: 600;'
                    : 'background: var(--input-bg);');
            row.addEventListener('click', () => {
                this.state.selectedShortcutIdx = idx;
                this.state.selectedRooms = [];
                this.updateSidebar();
                this.state.requestDrawCallback();
            });
            list.appendChild(row);
        });
        if (!any) {
            const empty = document.createElement('div');
            empty.textContent = 'No decor on this floor yet.';
            empty.style.cssText = 'font-size: 11px; color: var(--muted, #64748b); padding: 4px;';
            list.appendChild(empty);
        }
    }

    /** Wall panel: props for the selected wall + the named wall list. */
    updateWallUI(wallsActive) {
        const panel = document.getElementById('wallUI');
        panel.style.display = wallsActive ? 'block' : 'none';
        if (!wallsActive) return;

        const sel = this.state.walls[this.state.selectedWallIdx];
        document.getElementById('wallProps').style.display = sel ? 'block' : 'none';
        if (sel) {
            document.getElementById('wallThickness').value = Number(sel.thickness) || 8;
            document.getElementById('wallColor').value = sel.color || '#0f172a';
        }
        const drawBtn = document.getElementById('drawWallBtn');
        drawBtn.textContent = this.state.drawingWall ? '⏎ Enter to finish…' : '✏️ Draw Wall';

        const list = document.getElementById('wallsList');
        list.innerHTML = '';
        if (!this.state.walls.length) {
            const empty = document.createElement('div');
            empty.textContent = this.state.drawingWall
                ? 'Drawing… click on the map to place corners, then press Enter.'
                : 'No walls yet — click ✏️ Draw Wall, then click on the map to place corners.';
            empty.style.cssText = 'font-size: 11px; color: var(--muted, #64748b); padding: 4px;';
            list.appendChild(empty);
            return;
        }
        this.state.walls.forEach((w, idx) => {
            const row = document.createElement('div');
            const selected = idx === this.state.selectedWallIdx;
            row.textContent = `🧱 Wall ${idx + 1} — ${w.points.length} corners, ${Number(w.thickness) || 8}px`;
            row.style.cssText = 'padding: 5px 8px; border-radius: 5px; cursor: pointer; font-size: 12px;'
                + (selected
                    ? 'background: var(--accent); color: white; font-weight: 600;'
                    : 'background: var(--input-bg);');
            row.addEventListener('click', () => {
                this.state.selectedWallIdx = idx;
                this.updateSidebar();
                this.state.requestDrawCallback();
            });
            list.appendChild(row);
        });
    }

    updateSidebar() {
        // Clear all existing override indicators first
        document.querySelectorAll('.override-indicator').forEach(el => el.remove());
        document.querySelectorAll('.overridden-input').forEach(el => {
            el.classList.remove('overridden-input');
            el.style.border = '';
        });

        document.getElementById('roomInstructions').style.display = this.state.isEditMode ? 'block' : 'none';
        this.activeRoomUI.style.display = 'none';
        document.getElementById('mergeUI').style.display = 'none';
        document.getElementById('shortcutUI').style.display = 'none';

        this.updateDecorUI();

        if (this.state.selectedShortcutIdx !== -1 && this.state.shortcuts[this.state.selectedShortcutIdx]) {
            document.getElementById('shortcutUI').style.display = 'block';
            const sc = this.state.shortcuts[this.state.selectedShortcutIdx];
            // Decor is scenery: entities, actions and states don't apply.
            const decorSel = !!(sc.config && sc.config.decor);
            document.getElementById('scActionsPanel').style.display = decorSel ? 'none' : 'block';
            document.getElementById('scStatesPanel').style.display = decorSel ? 'none' : 'block';
            if (!sc.config.states || this.state.previewStateIdx >= sc.config.states.length) {
                this.state.previewStateIdx = -1;
            }
            window.previewStateIdx = this.state.previewStateIdx;
            document.getElementById('scName').value = sc.name || '';
            document.getElementById('scEntity').value = sc.entity_id || '';
            document.getElementById('scDescription').value = sc.description || '';
            document.getElementById('scAvailabilityEntity').value = sc.config?.availability_entity || '';
            document.getElementById('scType').value = sc.type || 'generic';
            
            const scParentSelect = document.getElementById('scParent');
            scParentSelect.innerHTML = `<option value="home">Home (Global)</option><option value="floor_${this.state.activeFloor}">Current Floor (Floor ${this.state.activeFloor})</option>`;
            this.state.rooms.forEach(r => {
                scParentSelect.innerHTML += `<option value="${r.id}">Room: ${r.name || 'Unnamed'}</option>`;
            });
            scParentSelect.value = sc.parent || 'home';

            let targetObj = sc.config || {};
            let isPreview = false;
            if (this.state.previewStateIdx !== -1 && sc.config?.states && sc.config.states[this.state.previewStateIdx]) {
                targetObj = sc.config.states[this.state.previewStateIdx];
                isPreview = true;
            }

            document.getElementById('scShape').value = targetObj.shape || sc.config?.shape || sc.shape || 'circle';
            const scColorVal = targetObj.color || sc.config?.color || '#0ea5e9';
            document.getElementById('scColor').value = scColorVal;
            document.getElementById('scColorText').value = targetObj.color || '';
            document.getElementById('scColorText').placeholder = isPreview ? (sc.config?.color || '#0ea5e9') : '#0ea5e9';
            
            document.getElementById('scIcon').value = targetObj.icon || '';
            document.getElementById('scIcon').placeholder = isPreview ? (sc.config?.icon || '💡 or url — empty = no icon') : '💡 or url — empty = no icon';
            
            document.getElementById('scImage').value = targetObj.image || '';
            document.getElementById('scImage').placeholder = isPreview ? (sc.config?.image || 'e.g. /local/img.png') : 'e.g. /local/img.png';
            const tilingVal = targetObj.image_tiling !== undefined ? targetObj.image_tiling : sc.config?.image_tiling;
            document.getElementById('scImageTiling').value = tilingVal === 'both' ? 'both' : (tilingVal ? 'axis' : 'off');
            
            document.getElementById('scAutoRotate').checked = targetObj.autoRotate !== undefined ? !!targetObj.autoRotate : !!sc.config?.autoRotate;
            document.getElementById('scHasBackground').checked = !(targetObj.transparent !== undefined ? targetObj.transparent : sc.config?.transparent);
            document.getElementById('scHasBorder').checked = (targetObj.border !== undefined ? targetObj.border : sc.config?.border) !== false;
            
            const scScale = this.getShortcutScale(sc);
            const scRot = this.getShortcutRotation(sc);
            document.getElementById('scScaleXInput').value = scScale.scaleX;
            document.getElementById('scScaleYInput').value = scScale.scaleY;
            document.getElementById('scRotationInput').value = scRot;

            const shape = sc.config?.shape || sc.shape || 'circle';
            const propDefault = (shape === 'circle');
            const isProportional = sc.config?.proportional !== undefined ? sc.config.proportional : propDefault;
            
            const propScaleCheckbox = document.getElementById('scProportionalScale');
            if (propScaleCheckbox) {
                propScaleCheckbox.checked = isProportional;
            }

            const scaleYInput = document.getElementById('scScaleYInput');
            if (scaleYInput) {
                scaleYInput.disabled = isProportional;
                scaleYInput.style.opacity = isProportional ? '0.5' : '1.0';
            }

            // Populate child content offsets & rotation
            const contentXVal = targetObj.content_x !== undefined ? targetObj.content_x : '';
            const contentYVal = targetObj.content_y !== undefined ? targetObj.content_y : '';
            const contentScaleXVal = targetObj.content_scaleX !== undefined ? targetObj.content_scaleX : '';
            const contentScaleYVal = targetObj.content_scaleY !== undefined ? targetObj.content_scaleY : '';
            const contentRotVal = targetObj.content_rotation !== undefined ? targetObj.content_rotation : '';
            const contentMatchSizeVal = targetObj.content_matchSize !== undefined ? !!targetObj.content_matchSize : (sc.config?.content_matchSize !== undefined ? !!sc.config.content_matchSize : true);
            const contentMatchRotVal = targetObj.content_matchRotation !== undefined ? !!targetObj.content_matchRotation : (sc.config?.content_matchRotation !== undefined ? !!sc.config.content_matchRotation : true);

            document.getElementById('scContentXInput').value = contentXVal;
            document.getElementById('scContentYInput').value = contentYVal;
            document.getElementById('scContentScaleXInput').value = contentScaleXVal;
            document.getElementById('scContentScaleYInput').value = contentScaleYVal;
            document.getElementById('scContentRotationInput').value = contentRotVal;
            document.getElementById('scContentMatchSize').checked = contentMatchSizeVal;
            document.getElementById('scContentMatchRotation').checked = contentMatchRotVal;

            document.getElementById('scContentXInput').placeholder = isPreview ? (sc.config?.content_x !== undefined ? sc.config.content_x : '0') : '0';
            document.getElementById('scContentYInput').placeholder = isPreview ? (sc.config?.content_y !== undefined ? sc.config.content_y : '0') : '0';
            document.getElementById('scContentScaleXInput').placeholder = isPreview ? (sc.config?.content_scaleX !== undefined ? sc.config.content_scaleX : '1.0') : '1.0';
            document.getElementById('scContentScaleYInput').placeholder = isPreview ? (sc.config?.content_scaleY !== undefined ? sc.config.content_scaleY : '1.0') : '1.0';
            document.getElementById('scContentRotationInput').placeholder = isPreview ? (sc.config?.content_rotation !== undefined ? sc.config.content_rotation : '0') : '0';

            // Disable/enable based on matching checkboxes
            const scaleXInContent = document.getElementById('scContentScaleXInput');
            const scaleYInContent = document.getElementById('scContentScaleYInput');
            if (scaleXInContent && scaleYInContent) {
                scaleXInContent.disabled = contentMatchSizeVal;
                scaleXInContent.style.opacity = contentMatchSizeVal ? '0.5' : '1.0';
                scaleYInContent.disabled = contentMatchSizeVal;
                scaleYInContent.style.opacity = contentMatchSizeVal ? '0.5' : '1.0';
            }

            const rotInContent = document.getElementById('scContentRotationInput');
            if (rotInContent) {
                rotInContent.disabled = contentMatchRotVal;
                rotInContent.style.opacity = contentMatchRotVal ? '0.5' : '1.0';
            }
            
            if (sc.type === 'vacuum') {
                document.getElementById('vacuumOptions').style.display = 'block';
                document.getElementById('vacuumRoomSensor').value = sc.config?.room_sensor || '';
                renderVacuumRoomMapping(sc, this.state.rooms, this.state.lastFetchedVacuumOptions, (final) => this.handleShortcutChange(final));
            } else {
                document.getElementById('vacuumOptions').style.display = 'none';
            }

            if (sc.type === 'sensor') {
                document.getElementById('sensorOptions').style.display = 'block';
                document.getElementById('scTemperatureEntity').value = targetObj.temperature_entity || sc.config?.temperature_entity || '';
                document.getElementById('scHumidityEntity').value = targetObj.humidity_entity || sc.config?.humidity_entity || '';
                document.getElementById('scValueTemplate').value = targetObj.value_template || '';
                document.getElementById('scValueTemplate').placeholder = isPreview ? (sc.config?.value_template || "{states('sensor.entity')}°C") : "{states('sensor.entity')}°C";
            } else {
                document.getElementById('sensorOptions').style.display = 'none';
            }
            renderActionsAndStates(sc, (final) => this.handleShortcutChange(final));
            this.updateOverrideBadges(sc);
        } else if (this.state.selectedRooms.length === 1) {
            this.activeRoomUI.style.display = 'block';
            const room = this.state.rooms[this.state.selectedRooms[0]];
            document.getElementById('roomName').value = room.name || '';
            document.getElementById('roomArea').value = room.area_id || '';
            document.getElementById('roomEntity').value = room.entity_id || '';
            const roomColorVal = room.color || '#333333';
            document.getElementById('roomColor').value = roomColorVal;
            document.getElementById('roomColorText').value = roomColorVal;
        } else if (this.state.selectedRooms.length === 2) {
            document.getElementById('mergeUI').style.display = 'block';
        }
    }

    getShortcutScale(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        return getScale(sc, targetObj, activeMode);
    }

    /** 'both' unless orientation linking was explicitly turned off in the toolbar. */
    writeMode() {
        if (this.engine.linkOrientations === false) {
            return this.engine.activeMode || 'horizontal';
        }
        return 'both';
    }

    setShortcutScale(sc, prop, value) {
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        setScale(sc, targetObj, prop, this.writeMode(), value);
    }

    getShortcutRotation(sc) {
        const activeMode = this.engine.activeMode || 'horizontal';
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        return getRotation(sc, targetObj, activeMode);
    }

    setShortcutRotation(sc, value) {
        const targetObj = resolvePreviewTarget(sc, this.state.previewStateIdx);
        setRotation(targetObj, this.writeMode(), value);
    }

    updateOverrideBadges(sc) {
        // Clear all existing override indicators first
        document.querySelectorAll('.override-indicator').forEach(el => el.remove());
        document.querySelectorAll('.overridden-input').forEach(el => {
            el.classList.remove('overridden-input');
            el.style.border = '';
        });

        if (this.state.previewStateIdx === -1 || !sc.config?.states?.[this.state.previewStateIdx]) {
            return;
        }

        const activeState = sc.config.states[this.state.previewStateIdx];

        // Maps HTML input element IDs to their target override config property keys
        const propBindings = {
            'scShape': 'shape',
            'scColorText': 'color',
            'scHasBackground': 'transparent',
            'scHasBorder': 'border',
            'scScaleXInput': 'scaleX',
            'scScaleYInput': 'scaleY',
            'scRotationInput': 'rotation',
            'scAutoRotate': 'autoRotate',
            'scProportionalScale': 'proportional',
            'scImageTiling': 'image_tiling',
            'scContentXInput': 'content_x',
            'scContentYInput': 'content_y',
            'scContentScaleXInput': 'content_scaleX',
            'scContentScaleYInput': 'content_scaleY',
            'scContentRotationInput': 'content_rotation',
            'scContentMatchSize': 'content_matchSize',
            'scContentMatchRotation': 'content_matchRotation',
            'scTemperatureEntity': 'temperature_entity',
            'scHumidityEntity': 'humidity_entity',
            'scValueTemplate': 'value_template'
        };

        Object.entries(propBindings).forEach(([id, prop]) => {
            const el = document.getElementById(id);
            if (!el) return;

            // Find label associated with this input
            let label = el.previousElementSibling;
            if (label && label.tagName !== 'LABEL') {
                label = el.parentElement.querySelector('label') || el.parentElement.previousElementSibling;
            }
            if (!label || label.tagName !== 'LABEL') {
                // If it's wrapped in a label (checkboxes)
                label = el.closest('label');
            }
            if (!label) return;

            const isOverridden = activeState[prop] !== undefined;

            const badge = document.createElement('span');
            badge.className = 'override-indicator';
            badge.style.fontSize = '9px';
            badge.style.marginLeft = '6px';
            badge.style.display = 'inline-block';

            if (isOverridden) {
                badge.style.color = '#0ea5e9';
                badge.style.fontWeight = 'bold';
                
                const revertLink = document.createElement('span');
                revertLink.style.textDecoration = 'underline';
                revertLink.style.color = '#ef4444';
                revertLink.style.cursor = 'pointer';
                revertLink.style.marginLeft = '4px';
                revertLink.textContent = '× Revert';
                
                revertLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    delete activeState[prop];
                    this.state.saveState();
                    this.updateSidebar();
                    this.state.requestDrawCallback();
                });

                badge.textContent = '(Overridden)';
                badge.appendChild(revertLink);

                el.classList.add('overridden-input');
                el.style.border = '1px solid #0ea5e9';
            } else {
                badge.style.color = '#888';
                badge.style.fontStyle = 'italic';
                badge.textContent = '(Inherited)';
            }

            label.appendChild(badge);
        });
    }
}
