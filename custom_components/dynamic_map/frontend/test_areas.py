import json
with open('/home/costi/workspace/water/homeassistant/rooms_floor2.json') as f:
    rooms = json.load(f)
for r in rooms:
    print(r['name'], r['polygon'])
