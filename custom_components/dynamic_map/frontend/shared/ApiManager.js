export class ApiManager {
    static async fetchVacuumRooms(entityId) {
        let roomsFound = [];
        let segmentMap = {};
        let originalNames = [];
        
        console.log(`[ApiManager] Fetching vacuum rooms for ${entityId}...`);
        try {
            // 1. Try to fetch segment IDs from the vacuum entity attributes
            console.log(`[ApiManager] Step 1: Checking vacuum entity attributes`);
            const res = await fetch(`/api/dynamic_map/state?entity_id=${entityId}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`[ApiManager] Vacuum entity data:`, data);
                if (data.success && data.attributes) {
                    let rAttr = data.attributes.rooms || data.attributes.room_mapping || data.attributes.room_mapping_dict;
                    console.log(`[ApiManager] Vacuum entity room attribute found:`, rAttr);
                    if (rAttr && typeof rAttr === 'object' && !Array.isArray(rAttr)) {
                        for (const [k, v] of Object.entries(rAttr)) {
                            let name = typeof v === 'object' ? v.name : v;
                            if (name) {
                                segmentMap[String(name).toLowerCase()] = parseInt(k);
                                segmentMap[String(name)] = parseInt(k);
                                if (!originalNames.includes(String(name))) originalNames.push(String(name));
                            }
                        }
                    }
                }
            }
            
            // 2. Try camera entity attributes if not found
            console.log(`[ApiManager] Step 2: Checking camera entities. Current segmentMap size: ${Object.keys(segmentMap).length}`);
            if (Object.keys(segmentMap).length === 0 && entityId.startsWith('vacuum.')) {
                const baseName = entityId.replace('vacuum.', '');
                for (const camName of [`camera.${baseName}_map`, `camera.roborock_map`, `camera.${baseName}_floormap`]) {
                    console.log(`[ApiManager] Fetching camera entity: ${camName}`);
                    const camRes = await fetch(`/api/dynamic_map/state?entity_id=${camName}`);
                    if (camRes.ok) {
                        const camData = await camRes.json();
                        console.log(`[ApiManager] Camera entity data for ${camName}:`, camData);
                        if (camData.success && camData.attributes && camData.attributes.rooms) {
                            const rAttr = camData.attributes.rooms;
                            console.log(`[ApiManager] Camera entity room attribute found:`, rAttr);
                            if (typeof rAttr === 'object' && !Array.isArray(rAttr)) {
                                for (const [k, v] of Object.entries(rAttr)) {
                                    let name = typeof v === 'object' ? v.name : v;
                                    if (name) {
                                        segmentMap[String(name).toLowerCase()] = parseInt(k);
                                        segmentMap[String(name)] = parseInt(k);
                                        if (!originalNames.includes(String(name))) originalNames.push(String(name));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // 2.5 Try to call roborock.get_maps service if still empty
            if (Object.keys(segmentMap).length === 0) {
                console.log(`[ApiManager] Step 2.5: Trying roborock.get_maps service proxy for ${entityId}`);
                const rbRes = await fetch(`/api/dynamic_map/roborock_rooms?entity_id=${entityId}`);
                if (rbRes.ok) {
                    const rbData = await rbRes.json();
                    if (rbData.success && rbData.data) {
                        console.log(`[ApiManager] roborock.get_maps response:`, rbData.data);
                        // Data usually looks like: { "vacuum.silvester": { "maps": [ { "rooms": { "16": "Kitchen" } } ] } }
                        // Or if direct: { "maps": [ ... ] }
                        const parseRoborockMaps = (obj) => {
                            if (!obj) return;
                            if (obj.rooms && typeof obj.rooms === 'object') {
                                for (const [k, v] of Object.entries(obj.rooms)) {
                                    let name = typeof v === 'object' ? v.name : v;
                                    if (name) {
                                        segmentMap[String(name).toLowerCase()] = parseInt(k);
                                        segmentMap[String(name)] = parseInt(k);
                                        if (!originalNames.includes(String(name))) originalNames.push(String(name));
                                    }
                                }
                            }
                            if (typeof obj === 'object') {
                                Object.values(obj).forEach(val => {
                                    if (typeof val === 'object') parseRoborockMaps(val);
                                });
                            }
                        };
                        parseRoborockMaps(rbData.data);
                    }
                }
            }
            
            console.log(`[ApiManager] Final Extracted Segment Map:`, segmentMap);

            // 3. Fetch tracking names from sensor options
            console.log(`[ApiManager] Step 3: Checking current_room sensor`);
            if (entityId.startsWith('vacuum.')) {
                const baseName = entityId.replace('vacuum.', '');
                const roomRes = await fetch(`/api/dynamic_map/state?entity_id=sensor.${baseName}_current_room`);
                if (roomRes.ok) {
                    const roomData = await roomRes.json();
                    console.log(`[ApiManager] Current room sensor data:`, roomData);
                    if (roomData.success && roomData.attributes && Array.isArray(roomData.attributes.options)) {
                        roomsFound = roomData.attributes.options.map(o => {
                            let segId = segmentMap[o] !== undefined ? segmentMap[o] : (segmentMap[String(o).toLowerCase()] !== undefined ? segmentMap[String(o).toLowerCase()] : "");
                            return { id: o, name: o, segId: segId };
                        });
                    }
                }
            }

            // 4. Fallback if no current_room sensor but we found segment mappings
            if (roomsFound.length === 0 && originalNames.length > 0) {
                console.log(`[ApiManager] Step 4: No sensor options found, falling back to originalNames`);
                for (const name of originalNames) {
                    roomsFound.push({ id: name, name: name, segId: segmentMap[name] });
                }
            }

        } catch (e) {
            console.error("[ApiManager] Failed to fetch vacuum rooms", e);
        }
        
        console.log(`[ApiManager] Final roomsFound returned:`, roomsFound);
        if (roomsFound.length === 0) {
            for(let i=16; i<=25; i++) roomsFound.push({ id: `Room ${i}`, name: `Room ${i}`, segId: i });
        }
        return roomsFound;
    }

    static async fetchFloorData(floorNum) {
        const t = Date.now();
        let rooms = [];
        let shortcuts = [];
        let config = { rotation_mode: 'auto', horizontal_flip: false, vertical_flip: false };
        
        try {
            const response = await fetch(`/dynamic_map_data/rooms_floor${floorNum}.json?t=${t}`);
            if(response.ok) {
                rooms = await response.json();
            }
            
            try {
                const scResponse = await fetch(`/dynamic_map_data/shortcuts_floor${floorNum}.json?t=${t}`);
                if(scResponse.ok) {
                    shortcuts = await scResponse.json();
                }
            } catch(e) {}
            
            try {
                const cfgResponse = await fetch(`/dynamic_map_data/config_floor${floorNum}.json?t=${t}`);
                if(cfgResponse.ok) {
                    config = { ...config, ...(await cfgResponse.json()) };
                }
            } catch(e) {}
        } catch (e) {
            console.error("Failed to load JSON", e);
        }
        return { rooms, shortcuts, config };
    }

    static async saveToHA(activeFloor, rooms, shortcuts, config) {
        let res1 = await fetch('/api/dynamic_map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `rooms_floor${activeFloor}.json`, content: rooms })
        });
        if (!res1.ok) throw new Error(`Rooms save failed: ${res1.statusText}`);

        let res2 = await fetch('/api/dynamic_map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `shortcuts_floor${activeFloor}.json`, content: shortcuts })
        });
        if (!res2.ok) throw new Error(`Shortcuts save failed: ${res2.statusText}`);
        
        if (config) {
            let res3 = await fetch('/api/dynamic_map/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: `config_floor${activeFloor}.json`, content: config })
            });
            if (!res3.ok) console.error(`Config save failed: ${res3.statusText}`);
        }
        return true;
    }

    static async fetchAvailableFiles() {
        const res = await fetch('/api/dynamic_map/files');
        if (!res.ok) throw new Error("Failed to load files");
        return await res.json();
    }

    static async deleteFloor(floorNum) {
        const res = await fetch('/api/dynamic_map/delete_floor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floor_num: parseInt(floorNum) })
        });
        return await res.json();
    }

    static async recomputeFloor(floorNum, svgFile, dxfFile) {
        const res = await fetch('/api/dynamic_map/recompute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                floor_num: parseInt(floorNum),
                svg_file: svgFile || null,
                dxf_file: dxfFile || null
            })
        });
        return await res.json();
    }

    static async fetchRegistry() {
        const res = await fetch('/api/dynamic_map/registry');
        return await res.json();
    }

    static async fetchEntities() {
        const res = await fetch('/api/dynamic_map/entities');
        return await res.json();
    }
}
