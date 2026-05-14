export class ApiManager {
    static async fetchVacuumRooms(entityId) {
        let roomsFound = [];
        try {
            if (entityId.startsWith('vacuum.')) {
                const baseName = entityId.replace('vacuum.', '');
                const roomRes = await fetch(`/api/dynamic_map/state?entity_id=sensor.${baseName}_current_room`);
                if (roomRes.ok) {
                    const roomData = await roomRes.json();
                    if (roomData.success && roomData.attributes && Array.isArray(roomData.attributes.options)) {
                        roomsFound = roomData.attributes.options.map(o => ({ id: o, name: o }));
                    }
                }
            }

            if (roomsFound.length === 0) {
                const res = await fetch(`/api/dynamic_map/state?entity_id=${entityId}`);
                const data = await res.json();
                
                if (data.success && data.attributes) {
                    if (data.attributes.rooms) {
                        const rAttr = data.attributes.rooms;
                        if (Array.isArray(rAttr)) roomsFound = rAttr.map((v,i) => ({ id: v, name: String(v) }));
                        else if (typeof rAttr === 'object') {
                            for (const [k, v] of Object.entries(rAttr)) roomsFound.push({ id: k, name: v });
                        }
                    } else if (data.attributes.room_mapping) {
                        const rAttr = data.attributes.room_mapping;
                        if (typeof rAttr === 'object') {
                            for (const [k, v] of Object.entries(rAttr)) roomsFound.push({ id: v, name: k });
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch vacuum rooms", e);
        }
        
        if (roomsFound.length === 0) {
            for(let i=16; i<=25; i++) roomsFound.push({ id: i, name: `Room ${i}`});
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
