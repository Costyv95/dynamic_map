import { getPolygonCenter, isPointInPolygon, getPolygonArea } from './editorUtils.js?v=2.63';
import { renderActionsAndStates, renderVacuumRoomMapping } from './editorUI.js?v=2.63';
import { ApiManager } from './ApiManager.js?v=2.63';
import { HistoryManager } from './HistoryManager.js?v=2.63';
import { CanvasEngine } from './CanvasEngine.js?v=2.63';

        const historyManager = new HistoryManager();
        const canvas = document.getElementById('mapCanvas');
        const ctx = canvas.getContext('2d');
        const engine = new CanvasEngine(canvas, ctx);
        const activeRoomUI = document.getElementById('activeRoomUI');
        const roomAreaSelect = document.getElementById('roomArea');
        const yamlOutput = document.getElementById('yamlOutput');

        let haAreas = [];
        let haFloors = [];
        let bgImage = new Image();
        let rooms = [];
        let selectedRooms = [];
        let shortcuts = [];
        let selectedShortcutIdx = -1;
        let isEditMode = false;
        let isSplitting = false;
        let splitStart = null;
        let splitEnd = null;
        let previewStateIdx = -1;
        let lastFetchedVacuumOptions = [];
        
        window.togglePreviewState = function(idx) {
            if (previewStateIdx === idx) {
                previewStateIdx = -1; // toggle off
            } else {
                previewStateIdx = idx; // toggle on
            }
            draw();
            return previewStateIdx;
        };
        
        let activeFloor = '2';
        
        let isPanning = false;
        let panStart = null;
        let resizeHandle = null;

        function saveState() {
            historyManager.saveState(rooms, shortcuts);
        }

        function undo() {
            const state = historyManager.undo();
            if (state) {
                rooms = state.rooms;
                shortcuts = state.shortcuts;
                selectedRooms = [];
                updateSidebarUI();
                draw();
            }
        }

        // Resizer logic
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;

        if (resizer) {
            resizer.addEventListener('pointerdown', (e) => {
                const rect = sidebar.getBoundingClientRect();
                resizeStartWidth = rect.width;
                resizeStartHeight = rect.height;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                
                resizer.setPointerCapture(e.pointerId);
                resizer.classList.add('resizing');
                document.body.style.cursor = window.innerWidth <= 768 ? 'row-resize' : 'col-resize';
                e.preventDefault();
            });

            resizer.addEventListener('pointermove', (e) => {
                if (!resizer.hasPointerCapture(e.pointerId)) return;
                
                if (window.innerWidth <= 768) {
                    const dy = e.clientY - resizeStartY;
                    const newHeight = Math.max(100, Math.min(window.innerHeight - 100, resizeStartHeight + dy));
                    sidebar.style.height = `${newHeight}px`;
                    sidebar.style.maxHeight = 'none';
                } else {
                    const dx = e.clientX - resizeStartX;
                    const newWidth = Math.max(200, Math.min(window.innerWidth - 200, resizeStartWidth + dx));
                    sidebar.style.width = `${newWidth}px`;
                }
                resizeCanvas();
                draw();
            });

            resizer.addEventListener('pointerup', (e) => {
                resizer.releasePointerCapture(e.pointerId);
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                resizeCanvas();
                draw();
            });
        }

        function redo() {
            const state = historyManager.redo();
            if (state) {
                rooms = state.rooms;
                shortcuts = state.shortcuts;
                selectedRooms = [];
                updateSidebarUI();
                draw();
            }
        }

        document.getElementById('undoBtn').addEventListener('click', undo);
        document.getElementById('redoBtn').addEventListener('click', redo);

        document.getElementById('buildModeToggle').addEventListener('change', (e) => {
            isEditMode = e.target.checked;
            
            if (!isEditMode) {
                // Clear selections
                selectedRooms = [];
                selectedShortcutIdx = -1;
            }
            updateSidebarUI();
            updateCursor();
            draw();
        });

        function updateCursor() {
            canvas.style.cursor = 'default';
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
                if (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
            }
        });

        function updateSidebarUI() {
            document.getElementById('roomInstructions').style.display = isEditMode ? 'block' : 'none';
            activeRoomUI.style.display = 'none';
            document.getElementById('mergeUI').style.display = 'none';
            document.getElementById('shortcutUI').style.display = 'none';

            if (selectedShortcutIdx !== -1 && shortcuts[selectedShortcutIdx]) {
                document.getElementById('shortcutUI').style.display = 'block';
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config.states || previewStateIdx >= sc.config.states.length) {
                    previewStateIdx = -1;
                }
                document.getElementById('scName').value = sc.name || '';
                document.getElementById('scEntity').value = sc.entity_id || '';
                document.getElementById('scType').value = sc.type || 'generic';
                
                const scParentSelect = document.getElementById('scParent');
                scParentSelect.innerHTML = `<option value="home">Home (Global)</option><option value="floor_${activeFloor}">Current Floor (Floor ${activeFloor})</option>`;
                rooms.forEach(r => {
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
                    renderVacuumRoomMapping(sc, rooms, lastFetchedVacuumOptions, () => renderActionsAndStates(sc, () => renderActionsAndStates(sc, () => {})));
                } else {
                    document.getElementById('vacuumOptions').style.display = 'none';
                }
                renderActionsAndStates(sc, () => renderActionsAndStates(sc, () => {}));
            } else if (selectedRooms.length === 1) {
                activeRoomUI.style.display = 'block';
                const room = rooms[selectedRooms[0]];
                document.getElementById('roomName').value = room.name || '';
                document.getElementById('roomArea').value = room.area_id || '';
                document.getElementById('roomEntity').value = room.entity_id || '';
                document.getElementById('roomColor').value = room.color || '#333333';
                document.getElementById('roomColor').dataset.changed = 'false';
            } else if (selectedRooms.length === 2) {
                document.getElementById('mergeUI').style.display = 'block';
            }
        }


        
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
                lastFetchedVacuumOptions = roomsFound;
                if (selectedShortcutIdx !== -1) {
                    renderVacuumRoomMapping(shortcuts[selectedShortcutIdx], rooms, lastFetchedVacuumOptions, () => renderActionsAndStates(shortcuts[selectedShortcutIdx], () => renderActionsAndStates(shortcuts[selectedShortcutIdx], () => {})));
                }
                btn.textContent = "Success!";
            } catch (e) {
                console.error(e);
                btn.textContent = "Error";
            }
            setTimeout(() => { btn.textContent = origText; }, 2000);
        });
        
        // Load Floor Data
        let isTransitioning = false;

        async function loadFloor(floorNum) {
            activeFloor = floorNum;
            isTransitioning = true;
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen immediately
            const t = Date.now();
            
            // We need to wait for BOTH image and JSON to Auto-Crop
            let imgLoaded = false;
            let dataLoaded = false;

            const checkAutoCrop = () => {
                if (imgLoaded && dataLoaded) {
                    calculateAutoCrop(true);
                    isTransitioning = false;
                    draw();
                }
            };

            bgImage.src = `/dynamic_map_data/bg_floor${floorNum}.png?t=${t}`;
            bgImage.onload = () => {
                imgLoaded = true;
                checkAutoCrop();
            };

            try {
                const data = await ApiManager.fetchFloorData(floorNum);
                rooms = data.rooms;
                shortcuts = data.shortcuts;
                
                const cfg = data.config || {};
                engine.rotationMode = cfg.rotation_mode || 'auto';
                engine.horizontalFlip = !!cfg.horizontal_flip;
                engine.verticalFlip = !!cfg.vertical_flip;
                updateRotationUI();

                // Initialize history
                historyManager.reset();
                saveState();
                
                selectedRooms = [];
                updateCursor();
                updateSidebarUI();
                
                dataLoaded = true;
                checkAutoCrop();
            } catch(e) {
                console.error("Failed to load JSON", e);
            }
        }

        function resizeCanvas() {
            engine.resizeCanvas();
        }

        function calculateAutoCrop(forceRecalculate = false) {
            engine.calculateAutoCrop(bgImage, rooms, forceRecalculate);
        }

        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                loadFloor(e.target.dataset.floor);
            });
        });
        
        function updateRotationUI() {
            document.getElementById('rotIconAuto').style.display = engine.rotationMode === 'auto' ? 'block' : 'none';
            document.getElementById('rotIconHoriz').style.display = engine.rotationMode === 'horizontal' ? 'block' : 'none';
            document.getElementById('rotIconVert').style.display = engine.rotationMode === 'vertical' ? 'block' : 'none';
            document.getElementById('rotationModeBtn').title = `Rotation Mode: ${engine.rotationMode.charAt(0).toUpperCase() + engine.rotationMode.slice(1)}`;
            
            const flipHBtn = document.getElementById('flipHorizBtn');
            const flipVBtn = document.getElementById('flipVertBtn');
            
            if (engine.rotationMode === 'auto') {
                flipHBtn.style.opacity = '0.3'; flipHBtn.style.cursor = 'not-allowed';
                flipVBtn.style.opacity = '0.3'; flipVBtn.style.cursor = 'not-allowed';
            } else {
                flipHBtn.style.opacity = engine.horizontalFlip ? '1' : '0.5';
                flipHBtn.style.cursor = 'pointer';
                flipVBtn.style.opacity = engine.verticalFlip ? '1' : '0.5';
                flipVBtn.style.cursor = 'pointer';
            }
        }

        document.getElementById('rotationModeBtn').addEventListener('click', () => {
            if (engine.rotationMode === 'auto') engine.rotationMode = 'horizontal';
            else if (engine.rotationMode === 'horizontal') engine.rotationMode = 'vertical';
            else engine.rotationMode = 'auto';
            
            updateRotationUI();
            if (bgImage.complete && rooms.length > 0) {
                calculateAutoCrop();
                saveToHA();
            }
            draw();
        });

        document.getElementById('flipHorizBtn').addEventListener('click', () => {
            if (engine.rotationMode === 'auto') return;
            engine.horizontalFlip = !engine.horizontalFlip;
            updateRotationUI();
            calculateAutoCrop();
            saveToHA();
            draw();
        });

        document.getElementById('flipVertBtn').addEventListener('click', () => {
            if (engine.rotationMode === 'auto') return;
            engine.verticalFlip = !engine.verticalFlip;
            updateRotationUI();
            calculateAutoCrop();
            saveToHA();
            draw();
        });

        loadFloor(2);

        // Drawing loop
        let animationFrameId = null;
        
        function draw() {
            engine.draw({
                bgImage, rooms, selectedRooms, isSplitting, splitStart, splitEnd,
                shortcuts, selectedShortcutIdx, previewStateIdx, isTransitioning
            });
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(draw);
        }



        // Mouse Events for Canvas
        function getMousePos(e) {
            return engine.getMousePos(e);
        }

        let isDragging = false;
        let dragStart = null;
        let interactionState = 'NONE'; // NONE, PAN, DRAG_SC, SPLIT

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        function handleZoom(clientX, clientY, deltaY) {
            engine.handleZoom(clientX, clientY, deltaY);
            draw();
        }

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            handleZoom(e.clientX, e.clientY, e.deltaY);
        }, { passive: false });

        let initialPinchDist = null;
        let initialViewTransform = null;

        const onPointerDown = (e) => {
            if (e.button === 2) { // Right Click -> Split
                if (isEditMode && selectedRooms.length === 1) {
                    interactionState = 'SPLIT';
                    splitStart = getMousePos(e);
                    isSplitting = false;
                }
                e.preventDefault();
                return;
            }

            // Left Click or Touch -> Check Handles, Pan or Drag Shortcut or Select
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            panStart = { x: clientX, y: clientY };
            dragStart = getMousePos(e);
            isDragging = false;
            resizeHandle = null;
            
            // Check Resize Handles
            if (selectedShortcutIdx !== -1 && shortcuts[selectedShortcutIdx]) {
                const sc = shortcuts[selectedShortcutIdx];
                const scX = (sc.position[0]/100)*bgImage.width;
                const scY = (sc.position[1]/100)*bgImage.height;
                const rx = 12 * (sc.scaleX || sc.scale || 1);
                const ry = 12 * (sc.scaleY || sc.scale || 1);
                const currentScale = Math.hypot(engine.viewTransform.a, engine.viewTransform.b);
                const hSize = 8 / currentScale; // Larger hit area

                const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;

                const shape = sc.config?.shape || sc.shape || 'circle';
                // Always allow corner dragging for both circles and rects
                if (hitTest(dragStart.x, dragStart.y, scX - rx, scY - ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'NW'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX + rx, scY - ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'NE'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX - rx, scY + ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'SW'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX + rx, scY + ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'SE'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX, scY - ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'N'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX, scY + ry)) { interactionState = 'RESIZE_SC'; resizeHandle = 'S'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX - rx, scY)) { interactionState = 'RESIZE_SC'; resizeHandle = 'W'; return; }
                if (hitTest(dragStart.x, dragStart.y, scX + rx, scY)) { interactionState = 'RESIZE_SC'; resizeHandle = 'E'; return; }
            }
            
            let overScIdx = -1;
            for (let i = shortcuts.length - 1; i >= 0; i--) {
                const sc = shortcuts[i];
                const scX = (sc.position[0]/100)*bgImage.width;
                const scY = (sc.position[1]/100)*bgImage.height;
                const rx = 12 * (sc.scaleX || sc.scale || 1);
                const ry = 12 * (sc.scaleY || sc.scale || 1);
                
                const shape = sc.config?.shape || sc.shape || 'circle';
                if (shape === 'rect') {
                    if (Math.abs(dragStart.x - scX) <= rx && Math.abs(dragStart.y - scY) <= ry) {
                        overScIdx = i; break;
                    }
                } else {
                    if (Math.hypot(dragStart.x - scX, dragStart.y - scY) <= Math.max(rx, ry)) {
                        overScIdx = i; break;
                    }
                }
            }

            if (overScIdx !== -1) {
                // Shortcut selected
                selectedShortcutIdx = overScIdx;
                selectedRooms = [];
                interactionState = 'DRAG_SC';
                updateSidebarUI();
                draw();
                return;
            }

            // Otherwise, check if room selected
            interactionState = 'MAYBE_PAN';
        };
        const onPointerMove = (e) => {
            // Touch pinch-to-zoom
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (!initialPinchDist) {
                    initialPinchDist = dist;
                    initialViewTransform = new DOMMatrix(engine.viewTransform);
                } else {
                    const zoomFactor = dist / initialPinchDist;
                    
                    const rect = canvas.getBoundingClientRect();
                    const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
                    const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
                    const screenX = cx - rect.left;
                    const screenY = cy - rect.top;

                    const newTransform = new DOMMatrix().translate(screenX, screenY).scale(zoomFactor).translate(-screenX, -screenY).multiply(initialViewTransform);
                    
                    const currentScale = Math.hypot(newTransform.a, newTransform.b);

                    if (currentScale <= engine.minScale * 1.02 && zoomFactor < 1) {
                        engine.viewTransform = new DOMMatrix(engine.defaultTransform);
                    } else {
                        engine.viewTransform = newTransform;
                    }
                    draw();
                }
                return;
            }

            // Pointer hover effect
            if (interactionState === 'NONE' || interactionState === 'MAYBE_PAN') {
                const worldPos = getMousePos(e);
                let cursorStyle = 'default';
                let overShortcut = false;

                if (selectedShortcutIdx !== -1) {
                    const sc = shortcuts[selectedShortcutIdx];
                    const scX = (sc.position[0]/100)*bgImage.width;
                    const scY = (sc.position[1]/100)*bgImage.height;
                    const rx = 12 * (sc.scaleX || sc.scale || 1);
                    const ry = 12 * (sc.scaleY || sc.scale || 1);
                    const currentScale = Math.hypot(engine.viewTransform.a, engine.viewTransform.b);
                    const hSize = 8 / currentScale;

                    const hitTest = (px, py, hx, hy) => Math.hypot(px - hx, py - hy) < hSize * 2;
                    const shape = sc.config?.shape || sc.shape || 'circle';
                    
                    if (hitTest(worldPos.x, worldPos.y, scX - rx, scY - ry) || hitTest(worldPos.x, worldPos.y, scX + rx, scY + ry)) {
                        cursorStyle = engine.isRotated ? 'nesw-resize' : 'nwse-resize';
                    } else if (hitTest(worldPos.x, worldPos.y, scX + rx, scY - ry) || hitTest(worldPos.x, worldPos.y, scX - rx, scY + ry)) {
                        cursorStyle = engine.isRotated ? 'nwse-resize' : 'nesw-resize';
                    } else if (hitTest(worldPos.x, worldPos.y, scX, scY - ry) || hitTest(worldPos.x, worldPos.y, scX, scY + ry)) {
                        cursorStyle = engine.isRotated ? 'ew-resize' : 'ns-resize';
                    } else if (hitTest(worldPos.x, worldPos.y, scX - rx, scY) || hitTest(worldPos.x, worldPos.y, scX + rx, scY)) {
                        cursorStyle = engine.isRotated ? 'ns-resize' : 'ew-resize';
                    }
                }

                if (cursorStyle === 'default') {
                    for (let i = shortcuts.length - 1; i >= 0; i--) {
                        const sc = shortcuts[i];
                        const scX = (sc.position[0]/100)*bgImage.width;
                        const scY = (sc.position[1]/100)*bgImage.height;
                        const rx = 12 * (sc.scaleX || sc.scale || 1);
                        const ry = 12 * (sc.scaleY || sc.scale || 1);
                        
                        const shape = sc.config?.shape || sc.shape || 'circle';
                        if (shape === 'rect') {
                            if (Math.abs(worldPos.x - scX) <= rx && Math.abs(worldPos.y - scY) <= ry) {
                                overShortcut = true; break;
                            }
                        } else {
                            if (Math.hypot(worldPos.x - scX, worldPos.y - scY) <= Math.max(rx, ry)) {
                                overShortcut = true; break;
                            }
                        }
                    }
                    if (overShortcut) {
                        cursorStyle = 'move';
                    }
                }
                canvas.style.cursor = cursorStyle;
            }

            if (interactionState === 'SPLIT') {
                isSplitting = true;
                splitEnd = getMousePos(e);
                draw();
                return;
            }

            if (interactionState === 'DRAG_SC') {
                isDragging = true;
                const worldPos = getMousePos(e);
                shortcuts[selectedShortcutIdx].position = [(worldPos.x / bgImage.width)*100, (worldPos.y / bgImage.height)*100];
                draw();
                return;
            }

            if (interactionState === 'RESIZE_SC') {
                isDragging = true;
                const worldPos = getMousePos(e);
                const sc = shortcuts[selectedShortcutIdx];
                const scX = (sc.position[0]/100)*bgImage.width;
                const scY = (sc.position[1]/100)*bgImage.height;
                let newRx = 12 * (sc.scaleX || sc.scale || 1);
                let newRy = 12 * (sc.scaleY || sc.scale || 1);

                if (resizeHandle.includes('N')) newRy = scY - worldPos.y;
                if (resizeHandle.includes('S')) newRy = worldPos.y - scY;
                if (resizeHandle.includes('W')) newRx = scX - worldPos.x;
                if (resizeHandle.includes('E')) newRx = worldPos.x - scX;

                const shape = sc.config?.shape || sc.shape || 'circle';
                if (shape !== 'rect') {
                    // circle locks aspect ratio, use the axis that was dragged
                    if (['E', 'W'].includes(resizeHandle)) {
                        newRy = Math.abs(newRx);
                    } else if (['N', 'S'].includes(resizeHandle)) {
                        newRx = Math.abs(newRy);
                    } else {
                        // Corner drag, use max of both to keep it a clean circle bounding box
                        const maxR = Math.max(Math.abs(newRx), Math.abs(newRy));
                        newRx = maxR;
                        newRy = maxR;
                    }
                    newRx = Math.max(5, Math.abs(newRx));
                    newRy = Math.max(5, Math.abs(newRy));
                } else {
                    newRx = Math.max(5, Math.abs(newRx));
                    newRy = Math.max(5, Math.abs(newRy));
                }

                sc.scaleX = newRx / 12;
                sc.scaleY = newRy / 12;
                draw();
                return;
            }

            if (interactionState === 'PAN') {
                let clientX = e.clientX;
                let clientY = e.clientY;
                if (e.touches && e.touches.length > 0) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                }
                
                const dx = clientX - panStart.x;
                const dy = clientY - panStart.y;
                
                engine.viewTransform.e += dx;
                engine.viewTransform.f += dy;
                
                panStart = { x: clientX, y: clientY };
                draw();
            } else if (interactionState === 'MAYBE_PAN') {
                let clientX = e.clientX;
                let clientY = e.clientY;
                if (e.touches && e.touches.length > 0) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                }
                const dist = Math.hypot(clientX - panStart.x, clientY - panStart.y);
                if (dist > 5) {
                    interactionState = 'PAN';
                }
            }
        };
        const onPointerUp = (e) => {
            initialPinchDist = null;

            if (interactionState === 'MAYBE_PAN') {
                // Was just a click! Handle selection.
                const worldPos = getMousePos(e);
                const pctPos = [(worldPos.x / bgImage.width)*100, (worldPos.y / bgImage.height)*100];

                let clickedIdx = -1;
                for(let i = 0; i < rooms.length; i++) {
                    // isPointInPolygon needs pctPos, not worldPos!
                    if (isPointInPolygon(pctPos, rooms[i].polygon)) {
                        clickedIdx = i; break;
                    }
                }

                if (clickedIdx !== -1) {
                    if (isEditMode && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                        if (selectedRooms.includes(clickedIdx)) {
                            selectedRooms = selectedRooms.filter(i => i !== clickedIdx);
                        } else if (selectedRooms.length < 2) {
                            selectedRooms.push(clickedIdx);
                        }
                    } else {
                        selectedRooms = [clickedIdx];
                        selectedShortcutIdx = -1;
                    }
                } else {
                    selectedRooms = [];
                    selectedShortcutIdx = -1;
                }
                updateSidebarUI();
                draw();
            } else if (interactionState === 'SPLIT' && isSplitting) {
                // Perform geometric split
                const dist = Math.hypot(splitEnd.x - splitStart.x, splitEnd.y - splitStart.y);
                if(dist > 10 && selectedRooms.length === 1) {
                    const pctStart = [(splitStart.x / bgImage.width)*100, (splitStart.y / bgImage.height)*100];
                    const pctEnd = [(splitEnd.x / bgImage.width)*100, (splitEnd.y / bgImage.height)*100];
                    
                    const pctDx = pctEnd[0] - pctStart[0];
                    const pctDy = pctEnd[1] - pctStart[1];
                    const pctLen = Math.hypot(pctDx, pctDy);
                    
                    const pNx = (-pctDy / pctLen);
                    const pNy = (pctDx / pctLen);

                    const pA = [pctStart[0] - pctDx * 1000, pctStart[1] - pctDy * 1000];
                    const pB = [pctEnd[0] + pctDx * 1000, pctEnd[1] + pctDy * 1000];
                    const pC = [pB[0] + pNx * 10000, pB[1] + pNy * 10000];
                    const pD = [pA[0] + pNx * 10000, pA[1] + pNy * 10000];

                    const halfPlane = [pA, pB, pC, pD];
                    
                    const targetRoomIdx = selectedRooms[0];
                    const targetRoom = rooms[targetRoomIdx];
                    const targetPB = { regions: [targetRoom.polygon], inverted: false };
                    const halfPlanePB = { regions: [halfPlane], inverted: false };
                    
                    try {
                        const cut1 = PolyBool.intersect(targetPB, halfPlanePB);
                        const cut2 = PolyBool.difference(targetPB, halfPlanePB);
                        
                        if(cut1.regions.length > 0 && cut2.regions.length > 0) {
                            rooms.splice(targetRoomIdx, 1);
                            cut1.regions.forEach((reg, i) => {
                                if(getPolygonArea(reg) > 2.0) {
                                    rooms.push({ id: `room_${Date.now()}_A${i}`, name: `${targetRoom.name || 'Room'} Part A`, polygon: reg });
                                }
                            });
                            cut2.regions.forEach((reg, i) => {
                                if(getPolygonArea(reg) > 2.0) {
                                    rooms.push({ id: `room_${Date.now()}_B${i}`, name: `${targetRoom.name || 'Room'} Part B`, polygon: reg });
                                }
                            });
                            selectedRooms = [];
                            saveState();
                        }
                    } catch(err) {
                        console.error("Splitting failed mathematically", err);
                    }
                }
            }

            if (isDragging) {
                saveState();
            }

            interactionState = 'NONE';
            isSplitting = false;
            splitStart = null;
            splitEnd = null;
            isDragging = false;
            updateSidebarUI();
            draw();
        };

        canvas.addEventListener('mousedown', onPointerDown);
        canvas.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp); // Use window so it catches releases outside canvas

        canvas.addEventListener('touchstart', onPointerDown, {passive: false});
        canvas.addEventListener('touchmove', onPointerMove, {passive: false});
        window.addEventListener('touchend', onPointerUp);
        window.addEventListener('touchcancel', onPointerUp);
        
        // Prevent clicks inside the sidebar from bubbling up and triggering map redraws
        const sidebarEl = document.getElementById('sidebar');
        ['mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(evt => {
            sidebarEl.addEventListener(evt, (e) => e.stopPropagation());
        });

        // Merge Logic
        document.getElementById('mergeBtn').addEventListener('click', () => {
            if(selectedRooms.length !== 2) return;
            const r1 = rooms[selectedRooms[0]];
            const r2 = rooms[selectedRooms[1]];
            
            const p1 = { regions: [r1.polygon], inverted: false };
            const p2 = { regions: [r2.polygon], inverted: false };
            try {
                const merged = PolyBool.union(p1, p2);
                if(merged.regions.length === 0) return;
                
                const newRoom = {
                    id: `room_${Date.now()}`,
                    name: r1.name || r2.name || "Merged Room",
                    polygon: merged.regions[0]
                };
                
                const sortedIndices = [...selectedRooms].sort((a,b) => b-a);
                rooms.splice(sortedIndices[0], 1);
                rooms.splice(sortedIndices[1], 1);
                
                merged.regions.forEach((reg, i) => {
                    if(i === 0) rooms.push(newRoom);
                    else rooms.push({ id: `room_${Date.now()}_${i}`, name: "Disconnected Part", polygon: reg });
                });
                
                selectedRooms = [rooms.length - 1];
                saveState();
                updateSidebarUI();
                draw();
            } catch(e) {
                console.error(e);
                alert("Could not merge polygons (invalid overlap).");
            }
        });

        // Drawing New Polygons (Shift+Click)
        let drawingPolygon = null;
        canvas.addEventListener('click', (e) => {
            if(!isEditMode) return;
            if(e.shiftKey && isEditMode) {
                const pos = getMousePos(e);
                const pctPos = [(pos.x / bgImage.width)*100, (pos.y / bgImage.height)*100];
                if(!drawingPolygon) drawingPolygon = [];
                drawingPolygon.push(pctPos);
                
                // Draw live preview
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI*2);
                ctx.fillStyle = 'red';
                ctx.fill();
            }
        });
        
        window.addEventListener('keydown', (e) => {
            if(!isEditMode) return;
            if(e.key === 'Enter' && drawingPolygon && drawingPolygon.length >= 3) {
                rooms.push({
                    id: `room_${Date.now()}`,
                    name: "New Room",
                    polygon: drawingPolygon
                });
                drawingPolygon = null;
                selectedRooms = [rooms.length - 1];
                saveState();
                updateSidebarUI();
                draw();
            } else if(e.key === 'Escape' && drawingPolygon) {
                drawingPolygon = null;
                draw();
            }
        });

        // UI Listeners
        function saveRoomName() {
            if(selectedRooms.length === 1) {
                const room = rooms[selectedRooms[0]];
                const areaId = document.getElementById('roomArea').value;
                room.area_id = areaId;
                
                const customName = document.getElementById('roomName').value.trim();
                if (customName) {
                    room.name = customName;
                } else if (areaId) {
                    const area = haAreas.find(a => a.id === areaId);
                    if (area) room.name = area.name;
                } else {
                    room.name = "Unmapped Room";
                }
                room.entity_id = document.getElementById('roomEntity').value;
                if (document.getElementById('roomColor').dataset.changed === 'true' || room.color) {
                    room.color = document.getElementById('roomColor').value;
                }
                saveState();
                draw(); // Redraw to update text on canvas
            }
        }

        document.getElementById('saveNameBtn').addEventListener('click', () => {
            saveRoomName();
            saveToHA();
        });
        document.getElementById('roomName').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveRoomName();
                saveToHA();
            }
        });

        document.getElementById('roomColor').addEventListener('input', (e) => {
            document.getElementById('roomColor').dataset.changed = 'true';
            if(selectedRooms.length === 1) {
                rooms[selectedRooms[0]].color = e.target.value;
                draw();
            }
        });

        document.getElementById('resetColorBtn').addEventListener('click', () => {
            if (selectedRooms.length === 1) {
                delete rooms[selectedRooms[0]].color;
                document.getElementById('roomColor').value = '#333333';
                document.getElementById('roomColor').dataset.changed = 'false';
                draw();
            }
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            if(selectedRooms.length === 1) {
                rooms.splice(selectedRooms[0], 1);
                selectedRooms = [];
                saveState();
                updateSidebarUI();
                draw();
                saveToHA();
            }
        });

        document.getElementById('addShortcutBtn').addEventListener('click', () => {
            const center = [50, 50]; // Default to center of screen
            
            // If a room is selected, default to its center
            if (selectedRooms.length === 1) {
                const roomCenter = getPolygonCenter(rooms[selectedRooms[0]].polygon);
                center[0] = roomCenter[0];
                center[1] = roomCenter[1];
            }
            
            const newSc = {
                id: `sc_${Date.now()}`, name: "New Object", type: "generic",
                entity_id: "", position: center, parent: "home",
                scaleX: 2, scaleY: 2,
                config: {
                    shape: "circle",
                    color: "#0ea5e9",
                    transparent: false,
                    room_mapping: {}
                }
            };
            shortcuts.push(newSc);
            selectedShortcutIdx = shortcuts.length - 1;
            selectedRooms = []; // Deselect room
            saveState();
            updateSidebarUI();
            draw();
        });

        // Shortcut Save & Delete
        document.getElementById('saveShortcutBtn').addEventListener('click', async () => {
            const btn = document.getElementById('saveShortcutBtn');
            const orig = btn.textContent;
            btn.textContent = "Saving...";
            saveState(); // Ensure last changes are serialized
            await saveToHA();
            btn.textContent = "Saved!";
            setTimeout(() => { btn.textContent = orig; }, 1500);
        });
        
        document.getElementById('addActionBtn').addEventListener('click', () => {
            if (selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                if (!sc.config.actions) sc.config.actions = [];
                sc.config.actions.push({ id: `act_${Date.now()}`, type: 'TOGGLE', trigger: 'tap', action_entity: sc.entity_id || '' });
                renderActionsAndStates(sc);
                saveState();
            }
        });

        document.getElementById('addStateBtn').addEventListener('click', () => {
            if (selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                if (!sc.config.states) sc.config.states = [];
                sc.config.states.push({ id: `st_${Date.now()}`, name: 'On', state_entity: sc.entity_id || '', operator: '==', value: 'on', color: '#10b981' });
                renderActionsAndStates(sc);
                saveState();
            }
        });

        document.getElementById('scType').addEventListener('change', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                sc.type = e.target.value;
                
                if (sc.type === 'vacuum') {
                    if (!sc.config) sc.config = {};
                    if (!sc.config.states || sc.config.states.length === 0) {
                        const baseName = (sc.entity_id || 'vacuum.roborock').replace('vacuum.', '');
                        sc.config.states = [
                            { id: `st_${Date.now()}_1`, name: 'Charging', state_entity: `sensor.${baseName}_status`, operator: '==', value: 'charging', color: '#10b981', image: '/dynamic_map_data/icons/vacuum_charging.svg' },
                            { id: `st_${Date.now()}_2`, name: 'Cleaning', state_entity: `sensor.${baseName}_status`, operator: '==', value: 'cleaning', color: '#0ea5e9', image: '/dynamic_map_data/icons/vacuum_cleaning.svg' },
                            { id: `st_${Date.now()}_3`, name: 'Error', state_entity: `sensor.${baseName}_status`, operator: '==', value: 'error', color: '#ef4444', image: '/dynamic_map_data/icons/vacuum_error.svg' }
                        ];
                    }
                    if (!sc.config.actions || sc.config.actions.length === 0) {
                        sc.config.actions = [
                            { id: `act_${Date.now()}_1`, type: 'TOGGLE', trigger: 'tap', action_entity: sc.entity_id || '', name: 'Pause/Start', icon: '⏯️' },
                            { id: `act_${Date.now()}_2`, type: 'CALL_SERVICE', trigger: 'overlay', action_entity: sc.entity_id || '', service: 'vacuum.return_to_base', name: 'Return to Dock', icon: '🏠' },
                            { id: `act_${Date.now()}_3`, type: 'CALL_SERVICE', trigger: 'overlay', action_entity: sc.entity_id || '', service: 'vacuum.start', name: 'Clean House', icon: '🧹' }
                        ];
                    }
                } else if (sc.type === 'light') {
                    if (!sc.config) sc.config = {};
                    if (!sc.config.states || sc.config.states.length === 0) {
                        sc.config.states = [
                            { id: `st_${Date.now()}_1`, name: 'On', state_entity: sc.entity_id || '', operator: '==', value: 'on', color: '#fbbf24', icon: '💡', image: '/dynamic_map_data/icons/light_on.svg' },
                            { id: `st_${Date.now()}_2`, name: 'Off', state_entity: sc.entity_id || '', operator: '==', value: 'off', color: '#475569', icon: '💡', image: '/dynamic_map_data/icons/light_off.svg' }
                        ];
                    }
                    if (!sc.config.actions || sc.config.actions.length === 0) {
                        sc.config.actions = [
                            { id: `act_${Date.now()}_1`, type: 'TOGGLE', trigger: 'tap', action_entity: sc.entity_id || '' },
                            { id: `act_${Date.now()}_2`, type: 'SLIDER', trigger: 'overlay', action_entity: sc.entity_id || '' }
                        ];
                    }
                }
                
                saveState();
                updateSidebarUI();
                draw();
            }
        });
        
        document.getElementById('scName').addEventListener('input', (e) => {
            if(selectedShortcutIdx !== -1) {
                shortcuts[selectedShortcutIdx].name = e.target.value;
            }
        });
        document.getElementById('scName').addEventListener('change', () => saveState());

        let oldEntityId = '';
        document.getElementById('scEntity').addEventListener('focus', (e) => {
            oldEntityId = e.target.value;
        });

        document.getElementById('scEntity').addEventListener('input', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
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
                    renderActionsAndStates(sc);
                }
                oldEntityId = newEntityId;
            }
        });
        document.getElementById('scEntity').addEventListener('change', () => saveState());
        
        document.getElementById('scParent').addEventListener('change', (e) => {
            if(selectedShortcutIdx !== -1) {
                shortcuts[selectedShortcutIdx].parent = e.target.value;
                saveState();
                saveToHA();
            }
        });
        
        document.getElementById('scShape').addEventListener('change', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                sc.config.shape = e.target.value;
                saveState();
                draw();
            }
        });


        document.getElementById('scColor').addEventListener('input', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                sc.config.color = e.target.value;
                draw();
            }
        });
        document.getElementById('scColor').addEventListener('change', () => { saveState(); saveToHA(); });

        document.getElementById('scHasBackground').addEventListener('change', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                sc.config.transparent = !e.target.checked;
                saveState();
                draw();
            }
        });
        
        document.getElementById('scIcon').addEventListener('input', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                sc.config.icon = e.target.value;
                saveState();
                draw();
            }
        });

        document.getElementById('scImage').addEventListener('input', (e) => {
            if(selectedShortcutIdx !== -1) {
                const sc = shortcuts[selectedShortcutIdx];
                if (!sc.config) sc.config = {};
                sc.config.image = e.target.value;
                saveState();
                draw();
            }
        });

        document.getElementById('deleteShortcutBtn').addEventListener('click', () => {
            if (selectedShortcutIdx !== -1) {
                shortcuts.splice(selectedShortcutIdx, 1);
                selectedShortcutIdx = -1;
                saveState();
                updateSidebarUI();
                draw();
                saveToHA();
            }
        });

        // SAVE TO HA
        async function saveToHA() {
            if (selectedRooms.length === 1) {
                saveRoomName(); // Flush any pending input
            }
            
            const btn = document.getElementById('exportJsonBtn');
            const originalText = btn.textContent;
            btn.textContent = "Saving to HA...";
            
            try {
                const config = {
                    rotation_mode: engine.rotationMode,
                    horizontal_flip: engine.horizontalFlip,
                    vertical_flip: engine.verticalFlip
                };
                await ApiManager.saveToHA(activeFloor, rooms, shortcuts, config);
                btn.textContent = "✅ Saved to HA Successfully!";
            } catch (err) {
                console.error("Save failed, is HA running?", err);
                btn.textContent = "❌ Save Failed";
            }
            
            setTimeout(() => { btn.textContent = "💾 Save JSON"; }, 3000);
        }

        document.getElementById('exportJsonBtn').addEventListener('click', saveToHA);

        // EXPORT YAML
        document.getElementById('exportYamlBtn').addEventListener('click', () => {
            let yaml = `type: custom:custom-svg-map\n`;
            yaml += `vacuum_entity: vacuum.roborock_s7\n`;
            yaml += `default_floor: ${activeFloor}\n`;
            yaml += `floors: [1, 2]\n`;
            yaml += `# Note: Floor rotation and flip settings are now saved automatically \n`;
            yaml += `# in dynamic_map_data/config_floorX.json.\n`;
            yaml += `# You don't need to specify them here!\n`;
            
            yamlOutput.value = yaml;
        });

        // RECOMPUTE LOGIC
        async function loadAvailableFiles() {
            try {
                const data = await ApiManager.fetchAvailableFiles();
                if (data.success && data.files) {
                    const svgSelect = document.getElementById('reconSvg');
                    const dxfSelect = document.getElementById('reconDxf');
                    svgSelect.innerHTML = '<option value="">-- Optional (Select SVG) --</option>';
                    dxfSelect.innerHTML = '<option value="">-- Optional (Select DXF) --</option>';
                    
                    data.files.forEach(f => {
                        if (f.endsWith('.svg')) svgSelect.innerHTML += `<option value="${f}">${f}</option>`;
                        if (f.endsWith('.dxf')) dxfSelect.innerHTML += `<option value="${f}">${f}</option>`;
                    });
                }
                if (data.success && data.icons) {
                    const iconList = document.getElementById('iconList');
                    if (iconList) {
                        iconList.innerHTML = '';
                        data.icons.forEach(iconPath => {
                            iconList.innerHTML += `<option value="${iconPath}"></option>`;
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to load available files", err);
            }
        }

        document.getElementById('toggleRecomputeBtn').addEventListener('click', () => {
            const panel = document.getElementById('recomputePanel');
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            sessionStorage.setItem('recomputeOpen', isHidden ? 'true' : 'false');
        });

        document.getElementById('closeRecomputeBtn').addEventListener('click', () => {
            document.getElementById('recomputePanel').style.display = 'none';
            sessionStorage.setItem('recomputeOpen', 'false');
        });
        
        document.getElementById('deleteFloorBtn').addEventListener('click', async () => {
            const floorNum = document.getElementById('reconFloor').value;
            if (!confirm(`Are you sure you want to permanently delete Floor ${floorNum} and all its rooms/shortcuts?`)) return;
            
            const status = document.getElementById('recomputeStatus');
            status.textContent = "Deleting floor files...";
            try {
                const data = await ApiManager.deleteFloor(floorNum);
                if (data.success) {
                    status.textContent = "✅ Floor deleted! Refreshing...";
                    sessionStorage.setItem('recomputeOpen', 'true');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    status.textContent = "❌ Error: " + data.error;
                }
            } catch (e) {
                status.textContent = "❌ Failed to connect to HA API.";
            }
        });

        document.getElementById('recomputeBtn').addEventListener('click', async () => {
            const btn = document.getElementById('recomputeBtn');
            const status = document.getElementById('recomputeStatus');
            const floorNum = document.getElementById('reconFloor').value;
            const svgFile = document.getElementById('reconSvg').value;
            const dxfFile = document.getElementById('reconDxf').value;
            
            btn.disabled = true;
            btn.textContent = "Processing... (This takes a few seconds)";
            status.textContent = "Running OpenCV algorithms on Home Assistant server...";
            
            try {
                const data = await ApiManager.recomputeFloor(floorNum, svgFile, dxfFile);
                if (data.success) {
                    status.textContent = "✅ Success! Refreshing Map...";
                    status.style.color = "#10b981";
                    sessionStorage.setItem('recomputeOpen', 'true');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    status.textContent = "❌ Error: " + data.error;
                    status.style.color = "#ef4444";
                    btn.disabled = false;
                    btn.textContent = "Recompute Map Geometry";
                }
            } catch (err) {
                status.textContent = "❌ Failed to connect to HA API.";
                status.style.color = "#ef4444";
                btn.disabled = false;
                btn.textContent = "Recompute Map Geometry";
            }
        });

        // Registry logic
        async function loadRegistry() {
            try {
                const data = await ApiManager.fetchRegistry();
                if (data.success) {
                    haAreas = data.areas;
                    haFloors = data.floors;
                    
                    roomAreaSelect.innerHTML = '<option value="">-- Unmapped --</option>';
                    haAreas.forEach(a => {
                        roomAreaSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
                    });
                }
            } catch (err) {
                console.error("Failed to load HA registry", err);
            }
        }

        roomAreaSelect.addEventListener('change', (e) => {
            const areaId = e.target.value;
            const area = haAreas.find(a => a.id === areaId);
            if (area && area.default_light) {
                // Only autofill if entity box is currently empty
                const entInput = document.getElementById('roomEntity');
                if (!entInput.value) {
                    entInput.value = area.default_light;
                }
            }
        });



        // Restore recompute panel state
        if (sessionStorage.getItem('recomputeOpen') === 'true') {
            document.getElementById('recomputePanel').style.display = 'block';
        }

        let allEntities = [];
        
        function setupAutocomplete(inputId) {
            const inputElement = document.getElementById(inputId);
            if (!inputElement) return;

            const dropdown = document.createElement('div');
            dropdown.style.position = 'absolute';
            dropdown.style.background = '#ffffff';
            dropdown.style.border = '1px solid #cbd5e1';
            dropdown.style.borderRadius = '4px';
            dropdown.style.maxHeight = '200px';
            dropdown.style.overflowY = 'auto';
            dropdown.style.display = 'none';
            dropdown.style.zIndex = '9999';
            dropdown.style.width = '100%';
            dropdown.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
            
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';
            inputElement.parentNode.insertBefore(wrapper, inputElement);
            wrapper.appendChild(inputElement);
            wrapper.appendChild(dropdown);

            inputElement.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                dropdown.innerHTML = '';
                
                let filtered = allEntities;
                if (val) {
                    filtered = allEntities.filter(ent => 
                        ent.id.toLowerCase().includes(val) || 
                        ent.name.toLowerCase().includes(val)
                    );
                }
                filtered = filtered.slice(0, 100);
                
                if (filtered.length === 0) {
                    dropdown.style.display = 'none';
                    return;
                }
                
                filtered.forEach(ent => {
                    const item = document.createElement('div');
                    item.textContent = ent.name !== ent.id ? `${ent.name} (${ent.id})` : ent.id;
                    item.style.padding = '8px 12px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #f1f5f9';
                    item.style.fontSize = '12px';
                    item.style.color = '#000000';
                    item.style.fontWeight = '500';
                    
                    item.addEventListener('mouseover', () => {
                        item.style.background = '#e0f2fe';
                        item.style.color = '#0284c7';
                    });
                    item.addEventListener('mouseout', () => {
                        item.style.background = '#ffffff';
                        item.style.color = '#000000';
                    });
                    item.addEventListener('click', () => {
                        inputElement.value = ent.id;
                        dropdown.style.display = 'none';
                        const event = new Event('input', { bubbles: true });
                        inputElement.dispatchEvent(event);
                    });
                    dropdown.appendChild(item);
                });
                dropdown.style.display = 'block';
            });

            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });
            
            inputElement.addEventListener('focus', () => {
                const event = new Event('input', { bubbles: false });
                inputElement.dispatchEvent(event);
            });
        }

        // Fetch all HA entities for autocomplete
        async function fetchAllEntities() {
            try {
                const data = await ApiManager.fetchEntities();
                if (data.success && data.entities) {
                    allEntities = data.entities;
                    setupAutocomplete('roomEntity');
                    setupAutocomplete('scEntity');
                }
            } catch (err) {
                console.error("Failed to fetch entities:", err);
            }
        }

        // Init
        loadRegistry();
        loadAvailableFiles();
        loadFloor(2);
        fetchAllEntities();
