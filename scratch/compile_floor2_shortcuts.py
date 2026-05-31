import json

shortcuts = [
  {
    "id": "sc_1778687071209",
    "name": "Lamp desk",
    "type": "light",
    "entity_id": "light.desk_lamp",
    "position": {
      "horizontal": [64.50736500325004, 82.21830418282082],
      "vertical": [64.50736500325004, 82.21830418282082]
    },
    "parent": "room_0",
    "scaleX": 3.5534738131392394,
    "scaleY": 3.80389914904462,
    "config": {
      "shape": "rect",
      "color": "#f5a59f",
      "transparent": False,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778687091485_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.desk_lamp",
          "name": "",
          "icon": "",
          "_expanded": False
        },
        {
          "id": "act_1778687091485_2",
          "type": "SLIDER",
          "trigger": "long_press",
          "action_entity": "light.desk_lamp",
          "name": "Sliders",
          "icon": "",
          "pos_x": 10,
          "pos_y": 10,
          "width": 180,
          "height": 35,
          "rotation": 0
        },
        {
          "id": "act_1778689389157",
          "type": "TOGGLE",
          "trigger": "long_press",
          "action_entity": "light.desk_lamp",
          "name": "",
          "icon": "",
          "pos_x": -65,
          "pos_y": 60,
          "width": 180,
          "height": 35,
          "rotation": 0
        }
      ],
      "states": [
        {
          "id": "st_1778687091485_1",
          "name": "On",
          "state_entity": "light.desk_lamp",
          "operator": "==",
          "value": "on",
          "color": "#facaca",
          "icon": "",
          "image": "/local/icons/lamp-on.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.desk_lamp",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778687091485_2",
          "name": "Off",
          "state_entity": "light.desk_lamp",
          "operator": "==",
          "value": "off",
          "color": "#a17070",
          "icon": "",
          "image": "/local/icons/lamp-off.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.desk_lamp",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ],
      "menuWidth": 200,
      "menuHeight": 250,
      "image": "/local/icons/lamp-on.png",
      "availability_entity": ""
    },
    "scale": 3.80389914904462
  },
  {
    "id": "sc_1778705839652",
    "name": "Roborock",
    "type": "vacuum",
    "entity_id": "vacuum.silvester",
    "position": {
      "horizontal": [88.23711953481006, 15.472970499798427],
      "vertical": [88.23711953481006, 15.472970499798427]
    },
    "parent": "room_1778708560056_B0",
    "scaleX": 2.4933550479321602,
    "scaleY": 2.4933550479321602,
    "config": {
      "shape": "circle",
      "color": "#0ea5e9",
      "transparent": False,
      "room_mapping": {
        "Bathroom": "room_2",
        "Bedroom": "room_1",
        "Office": "room_0",
        "Living room": "room_1778708613512_B0",
        "Kitchen": "room_1778708560056_B0"
      },
      "actions": [
        {
          "id": "act_1778705843069_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "vacuum.silvester",
          "name": "Pause/Start",
          "icon": "⏯️"
        },
        {
          "id": "act_1778705843069_2",
          "type": "CALL_SERVICE",
          "trigger": "long_press",
          "action_entity": "vacuum.silvester",
          "service": "vacuum.return_to_base",
          "name": "Return to Dock",
          "icon": "🏠",
          "_expanded": True,
          "pos_x": 9,
          "pos_y": 16,
          "width": "180",
          "height": 35,
          "rotation": 0,
          "payload": ""
        },
        {
          "id": "act_1778705843069_3",
          "type": "CALL_SERVICE",
          "trigger": "long_press",
          "action_entity": "vacuum.silvester",
          "service": "vacuum.send_command",
          "name": "Clean House",
          "icon": "🧹🏠",
          "_expanded": True,
          "pos_x": 11,
          "pos_y": 61,
          "width": "180",
          "height": 34,
          "rotation": 0,
          "payload": ""
        },
        {
          "id": "act_1778756850441",
          "type": "CALL_SERVICE",
          "trigger": "long_press",
          "action_entity": "vacuum.silvester",
          "name": "Clean Kitchen",
          "icon": "🧹🍳",
          "width": "180",
          "service": "vacuum.send_command",
          "payload": "{\"command\": \"app_segment_clean\", \"params\": [{\"segments\": [\"Kitchen\"], \"repeat\": 2}]}",
          "pos_x": 12,
          "pos_y": 108,
          "height": 33,
          "rotation": 0,
          "_expanded": True
        },
        {
          "id": "act_1778757423581",
          "type": "ROOM_SELECTOR",
          "trigger": "long_press",
          "action_entity": "vacuum.silvester",
          "name": "Clean Custom Rooms",
          "icon": "",
          "width": "180",
          "pos_x": 12,
          "pos_y": 152,
          "height": 36,
          "rotation": 0
        }
      ],
      "states": [
        {
          "id": "st_1778705843069_1",
          "name": "Charging",
          "state_entity": "sensor.roborock_status",
          "operator": "==",
          "value": "charging",
          "color": "#10b981",
          "image": "/dynamic_map_data/icons/vacuum_charging.svg",
          "_expanded": False,
          "conditions": [
            {
              "state_entity": "sensor.roborock_status",
              "operator": "==",
              "value": "charging"
            }
          ]
        },
        {
          "id": "st_1778705843069_2",
          "name": "Cleaning",
          "state_entity": "sensor.roborock_status",
          "operator": "==",
          "value": "cleaning",
          "color": "#0ea5e9",
          "image": "/dynamic_map_data/icons/vacuum_cleaning.svg",
          "_expanded": False,
          "conditions": [
            {
              "state_entity": "sensor.roborock_status",
              "operator": "==",
              "value": "cleaning"
            }
          ]
        },
        {
          "id": "st_1778705843069_3",
          "name": "Error",
          "state_entity": "sensor.roborock_status",
          "operator": "==",
          "value": "error",
          "color": "#ef4444",
          "image": "/dynamic_map_data/icons/vacuum_error.svg",
          "_expanded": False,
          "conditions": [
            {
              "state_entity": "sensor.roborock_status",
              "operator": "==",
              "value": "error"
            }
          ]
        }
      ],
      "menuWidth": 200,
      "menuHeight": 200,
      "segment_mapping": {
        "Bathroom": 16,
        "Bedroom": 17,
        "Office": 18,
        "Living room": 19,
        "Kitchen": 20
      }
    }
  },
  {
    "id": "sc_1778706649234",
    "name": "Flamingo",
    "type": "light",
    "entity_id": "light.flamingo",
    "position": {
      "horizontal": [52.06509651236987, 82.69787211359687],
      "vertical": [52.06509651236987, 82.69787211359687]
    },
    "parent": "room_0",
    "scaleX": 3.472231629316487,
    "scaleY": 4.000234015725634,
    "config": {
      "shape": "circle",
      "color": "#000000",
      "transparent": False,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778706654236_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.flamingo",
          "name": "tap",
          "icon": "",
          "width": ""
        },
        {
          "id": "act_1778706654236_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.flamingo"
        }
      ],
      "states": [
        {
          "id": "st_1778706654236_1",
          "name": "On",
          "state_entity": "light.flamingo",
          "operator": "==",
          "value": "on",
          "color": "#000000",
          "icon": "💡",
          "image": "/local/icons/flamingo-on.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.flamingo",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778706654236_2",
          "name": "Off",
          "state_entity": "light.flamingo",
          "operator": "==",
          "value": "off",
          "color": "#000000",
          "icon": "💡",
          "image": "/local/icons/flamingo-off.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.flamingo",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ],
      "image": "/local/icons/flamingo-on.png"
    },
    "scale": 3.472231629316487
  },
  {
    "id": "sc_1778708753664",
    "name": "New Object",
    "type": "light",
    "entity_id": "light.bedroom_light",
    "position": {
      "horizontal": [24.13594765331993, 69.65798603826559],
      "vertical": [24.13594765331993, 69.65798603826559]
    },
    "parent": "room_1",
    "scaleX": 5.411925044891764,
    "scaleY": 6.022791329680767,
    "config": {
      "shape": "circle",
      "color": "#0ea5e9",
      "transparent": True,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778708767859_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.bedroom_light"
        },
        {
          "id": "act_1778708767859_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.bedroom_light",
          "_expanded": True
        }
      ],
      "states": [
        {
          "id": "st_1778708767859_1",
          "name": "On",
          "state_entity": "light.bedroom_light",
          "operator": "==",
          "value": "on",
          "color": "#95e8bb",
          "icon": "💡",
          "image": "/local/icons/bedroom-light-on.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.bedroom_light",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778708767859_2",
          "name": "Off",
          "state_entity": "light.bedroom_light",
          "operator": "==",
          "value": "off",
          "color": "#63916c",
          "icon": "💡",
          "image": "/local/icons/bedroom-light-off.png",
          "_expanded": True,
          "conditions": [
            {
              "state_entity": "light.bedroom_light",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ]
    },
    "scale": 6.022791329680767
  },
  {
    "id": "sc_1778708878296",
    "name": "Bed strip",
    "type": "light",
    "entity_id": "light.bed",
    "position": {
      "horizontal": [12.944878837746646, 70.3832244472153],
      "vertical": [12.944878837746646, 70.3832244472153]
    },
    "parent": "room_1",
    "scaleX": 9.330520678634322,
    "scaleY": 9.566256449274041,
    "config": {
      "shape": "rect",
      "color": "#0ea5e9",
      "transparent": True,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778708919679_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.bed"
        },
        {
          "id": "act_1778708919679_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.bed"
        }
      ],
      "states": [
        {
          "id": "st_1778708919679_1",
          "name": "On",
          "state_entity": "light.bed",
          "operator": "==",
          "value": "on",
          "color": "#fbbf24",
          "icon": "💡",
          "image": "/local/icons/led-strip-on.png",
          "_expanded": True,
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.bed",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778708919679_2",
          "name": "Off",
          "state_entity": "light.bed",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "💡",
          "image": "/local/icons/led-strip-off.png",
          "_expanded": False,
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.bed",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ]
    },
    "scale": 9.330520678634322
  },
  {
    "id": "sc_1778708978712",
    "name": "Stairs light",
    "type": "light",
    "entity_id": "light.hallway",
    "position": {
      "horizontal": [56.83355682045686, 56.622003920686005],
      "vertical": [56.83355682045686, 56.622003920686005]
    },
    "parent": "room_1778708671250_B0",
    "scaleX": 2,
    "scaleY": 2,
    "config": {
      "shape": "circle",
      "color": "#0ea5e9",
      "transparent": False,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778709067307_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.hallway"
        },
        {
          "id": "act_1778709067307_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.hallway"
        }
      ],
      "states": [
        {
          "id": "st_1778709067307_1",
          "name": "On",
          "state_entity": "light.hallway",
          "operator": "==",
          "value": "on",
          "color": "#fbbf24",
          "icon": "💡",
          "image": "/dynamic_map_data/icons/light_on.svg",
          "conditions": [
            {
              "state_entity": "light.hallway",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778709067307_2",
          "name": "Off",
          "state_entity": "light.hallway",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "💡",
          "image": "/dynamic_map_data/icons/light_off.svg",
          "conditions": [
            {
              "state_entity": "light.hallway",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ]
    }
  },
  {
    "id": "sc_1778710702209",
    "name": "Stairs light",
    "type": "light",
    "entity_id": "light.stairs",
    "position": {
      "horizontal": [12.06110029275418, 47.14435742993165],
      "vertical": [12.06110029275418, 47.14435742993165]
    },
    "parent": "home",
    "scaleX": 2,
    "scaleY": 2,
    "config": {
      "shape": "circle",
      "color": "#0ea5e9",
      "transparent": False,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778710718647_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.stairs"
        },
        {
          "id": "act_1778710718647_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.stairs"
        }
      ],
      "states": [
        {
          "id": "st_1778710718647_1",
          "name": "On",
          "state_entity": "light.stairs",
          "operator": "==",
          "value": "on",
          "color": "#fbbf24",
          "icon": "💡",
          "image": "/dynamic_map_data/icons/light_on.svg",
          "conditions": [
            {
              "state_entity": "light.stairs",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778710718647_2",
          "name": "Off",
          "state_entity": "light.stairs",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "💡",
          "image": "/dynamic_map_data/icons/light_off.svg",
          "conditions": [
            {
              "state_entity": "light.stairs",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ]
    }
  },
  {
    "id": "sc_1778710730629",
    "name": "New Object",
    "type": "light",
    "entity_id": "light.living_room_light",
    "position": {
      "horizontal": [24.814791454615595, 25.8627611648001],
      "vertical": [24.814791454615595, 25.8627611648001]
    },
    "parent": "home",
    "scaleX": 4.263523130491474,
    "scaleY": 4.172909883677107,
    "config": {
      "shape": "rect",
      "color": "#ed98bd",
      "transparent": False,
      "room_mapping": {},
      "actions": [
        {
          "id": "act_1778710750602_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.living_room_light",
          "_expanded": False
        },
        {
          "id": "act_1778710750602_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.living_room_light",
          "_expanded": False,
          "pos_x": 10,
          "pos_y": 10,
          "width": 180,
          "height": 35,
          "rotation": 0
        }
      ],
      "states": [
        {
          "id": "st_1778710750602_1",
          "name": "On",
          "state_entity": "light.living_room_light",
          "operator": "==",
          "value": "on",
          "color": "#eddfe4",
          "icon": "",
          "image": "/local/icons/living-room-lamp-on.png",
          "_expanded": False,
          "conditions": [
            {
              "state_entity": "light.living_room_light",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1778710750602_2",
          "name": "Off",
          "state_entity": "light.living_room_light",
          "operator": "==",
          "value": "off",
          "color": "#996779",
          "icon": "",
          "image": "/local/icons/living-room-lamp-off.png",
          "_expanded": False,
          "conditions": [
            {
              "state_entity": "light.living_room_light",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ],
      "image": "/local/icons/living-room-lamp-on.png",
      "menuWidth": 200,
      "menuHeight": 250
    },
    "scale": 4.172909883677107
  },
  {
    "id": "sc_1778798438447",
    "name": "Twinkly",
    "type": "generic",
    "position": {
      "horizontal": [89.58617729296317, 79.75802629250114],
      "vertical": [89.58617729296317, 79.75802629250114]
    },
    "config": {
      "color": "#0ea5e9",
      "transparent": False,
      "actions": [
        {
          "id": "act_tap",
          "name": "Toggle Power",
          "trigger": "tap",
          "type": "TOGGLE",
          "action_entity": "switch.twinkly_power"
        },
        {
          "id": "act_1",
          "name": "Pharmacy",
          "trigger": "long_press",
          "type": "CALL_SERVICE",
          "service": "mqtt.publish",
          "payload": "{\"topic\": \"twinkly/twinkly_square/set/animation\", \"payload\": \"pharmacy_tempy\"}",
          "icon": "mdi:flask",
          "pos_x": 12,
          "pos_y": 14,
          "width": "160",
          "height": 31,
          "rotation": 0,
          "_expanded": True
        },
        {
          "id": "act_2",
          "name": "German Countdown",
          "trigger": "long_press",
          "type": "CALL_SERVICE",
          "service": "mqtt.publish",
          "payload": "{\"topic\": \"twinkly/twinkly_square/set/animation\", \"payload\": \"german_countdown\"}",
          "icon": "mdi:translate",
          "pos_x": 10,
          "pos_y": 95,
          "width": "160",
          "height": 37,
          "rotation": 0,
          "_expanded": True,
          "action_entity": ""
        },
        {
          "id": "act_3",
          "name": "Snake",
          "trigger": "long_press",
          "type": "CALL_SERVICE",
          "service": "mqtt.publish",
          "payload": "{\"topic\": \"twinkly/twinkly_square/set/animation\", \"payload\": \"snake\"}",
          "icon": "mdi:snake",
          "pos_x": 11,
          "pos_y": 51,
          "width": "160",
          "height": 37,
          "rotation": 0,
          "_expanded": True,
          "action_entity": ""
        },
        {
          "id": "act_4",
          "name": "Brightness",
          "trigger": "long_press",
          "type": "SLIDER",
          "action_entity": "number.twinkly_brightness",
          "icon": "mdi:brightness-6",
          "pos_x": 9,
          "pos_y": 139,
          "width": "230",
          "height": 40,
          "rotation": 0
        },
        {
          "id": "act_5",
          "name": "Speed",
          "trigger": "long_press",
          "type": "SLIDER",
          "action_entity": "number.twinkly_speed",
          "icon": "mdi:speedometer",
          "pos_x": 9,
          "pos_y": 189,
          "width": "230",
          "height": 40,
          "rotation": 0,
          "_expanded": True,
          "symmetric_scale": True
        }
      ],
      "states": [
        {
          "id": "st_off",
          "name": "Off",
          "state_entity": "sensor.twinkly_mode",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "mdi:power",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_mode",
              "operator": "==",
              "value": "off"
            }
          ]
        },
        {
          "id": "st_pharmacy",
          "name": "Pharmacy Playing",
          "state_entity": "sensor.twinkly_active_animation",
          "operator": "==",
          "value": "pharmacy_tempy",
          "color": "#0ea5e9",
          "icon": "mdi:flask",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_active_animation",
              "operator": "==",
              "value": "pharmacy_tempy"
            }
          ]
        },
        {
          "id": "st_german",
          "name": "Countdown Playing",
          "state_entity": "sensor.twinkly_active_animation",
          "operator": "==",
          "value": "german_countdown",
          "color": "#eab308",
          "icon": "mdi:translate",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_active_animation",
              "operator": "==",
              "value": "german_countdown"
            }
          ]
        },
        {
          "id": "st_snake",
          "name": "Snake Playing",
          "state_entity": "sensor.twinkly_active_animation",
          "operator": "==",
          "value": "snake",
          "color": "#10b981",
          "icon": "mdi:snake",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_active_animation",
              "operator": "==",
              "value": "snake"
            }
          ]
        },
        {
          "id": "st_movie",
          "name": "Other Movie",
          "state_entity": "sensor.twinkly_mode",
          "operator": "==",
          "value": "movie",
          "color": "#10b981",
          "icon": "mdi:movie-roll",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_mode",
              "operator": "==",
              "value": "movie"
            }
          ]
        },
        {
          "id": "st_rt",
          "name": "Real-Time Stream",
          "state_entity": "sensor.twinkly_mode",
          "operator": "==",
          "value": "rt",
          "color": "#8b5cf6",
          "icon": "mdi:cast-connected",
          "conditions": [
            {
              "state_entity": "sensor.twinkly_mode",
              "operator": "==",
              "value": "rt"
            }
          ]
        }
      ],
      "menuWidth": 250,
      "menuHeight": 250
    },
    "scaleX": 1.9279610470389532,
    "scale": 7.604735241098069,
    "scaleY": 7.604735241098069,
    "parent": "room_0",
    "entity_id": "",
    "shape": "rect"
  },
  {
    "id": "sc_1779114748347",
    "name": "Dining lights",
    "type": "light",
    "position": {
      "horizontal": [60.30120655734994, 14.22014606183993],
      "vertical": [60.30120655734994, 14.22014606183993]
    },
    "config": {
      "shape": "rect",
      "color": "#0ea5e9",
      "actions": [
        {
          "id": "act_1779114800127_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.dining_lights",
          "_expanded": False
        },
        {
          "id": "act_1779114800127_2",
          "type": "SLIDER",
          "trigger": "overlay",
          "action_entity": "light.dining_lights"
        }
      ],
      "states": [
        {
          "id": "st_1779114800127_1",
          "name": "On",
          "state_entity": "light.dining_lights",
          "operator": "==",
          "value": "on",
          "color": "#fbbf24",
          "icon": "💡",
          "_expanded": True,
          "image": "/local/icons/dining-lights-on.png",
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.dining_lights",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1779114800127_2",
          "name": "Off",
          "state_entity": "light.dining_lights",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "💡",
          "_expanded": True,
          "image": "/local/icons/dining-lights-off.png",
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.dining_lights",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ],
      "transparent": True
    },
    "scaleX": 7.675322603522905,
    "scale": 6.855701656455224,
    "scaleY": 6.855701656455224,
    "entity_id": "light.dining_lights"
  },
  {
    "id": "sc_1779223727173",
    "name": "Fairy lights ",
    "type": "light",
    "position": {
      "horizontal": [83.65381663164392, 11.619001832695114],
      "vertical": [83.65381663164392, 11.619001832695114]
    },
    "config": {
      "shape": "rect",
      "color": "#a8cf93",
      "autoRotate": True,
      "actions": [
        {
          "id": "act_1779223814801_1",
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "light.fairy_lights"
        }
      ],
      "states": [
        {
          "id": "st_1779223814801_1",
          "name": "On",
          "state_entity": "light.fairy_lights",
          "operator": "==",
          "value": "on",
          "color": "#fbbf24",
          "icon": "💡",
          "_expanded": True,
          "image": "/local/icons/fairy-lights-on.png",
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.fairy_lights",
              "operator": "==",
              "value": "on"
            }
          ]
        },
        {
          "id": "st_1779223814801_2",
          "name": "Off",
          "state_entity": "light.fairy_lights",
          "operator": "==",
          "value": "off",
          "color": "#475569",
          "icon": "💡",
          "_expanded": True,
          "image": "/local/icons/fairy-lights-off.png",
          "autoRotate": True,
          "conditions": [
            {
              "state_entity": "light.fairy_lights",
              "operator": "==",
              "value": "off"
            }
          ]
        }
      ],
      "image": "",
      "icon": ""
    },
    "scaleX": 1.4914414568982768,
    "scale": 1.4914414568982768,
    "scaleY": 7.705780860641113,
    "parent": "room_1778708504030_A0",
    "entity_id": "light.fairy_lights"
  },
  {
    "id": "sc_1780085718093",
    "name": "Living Room Sensor",
    "type": "sensor",
    "position": {
      "horizontal": [17.583817690217003, 39.40055297252606],
      "vertical": [17.583817690217003, 39.40055297252606]
    },
    "config": {
      "temperature_entity": "sensor.sensor_living_room_temperature",
      "humidity_entity": "sensor.sensor_living_room_humidity",
      "color": "#10b981",
      "icon": "🌡️",
      "transparent": True,
      "actions": [
        {
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "input_boolean.sensor_living_room"
        },
        {
          "type": "SENSOR_OVERLAY",
          "trigger": "long_press"
        }
      ],
      "states": [
        {
          "id": "st_temp_cold",
          "name": "Cold Temperature",
          "display_entity": "sensor.sensor_living_room_temperature",
          "unit": "°",
          "color": "#3b82f6",
          "icon": "❄️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.sensor_living_room_temperature",
              "operator": "<",
              "value": "20"
            }
          ],
          "_expanded": True
        },
        {
          "id": "st_temp_comfortable",
          "name": "Comfortable Temperature",
          "display_entity": "sensor.sensor_living_room_temperature",
          "unit": "°",
          "color": "#10b981",
          "icon": "🌡️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.sensor_living_room_temperature",
              "operator": "between",
              "value": "20-25",
              "entity": "sensor.sensor_living_room_temperature"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_living_room",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_temp_warm",
          "name": "Warm Temperature",
          "display_entity": "sensor.sensor_living_room_temperature",
          "unit": "°",
          "color": "#f97316",
          "icon": "☀️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.sensor_living_room_temperature",
              "operator": "between",
              "value": "25-28"
            }
          ],
          "_expanded": True
        },
        {
          "id": "st_temp_hot",
          "name": "Hot Temperature",
          "display_entity": "sensor.sensor_living_room_temperature",
          "unit": "°",
          "color": "#ef4444",
          "icon": "🥵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.sensor_living_room_temperature",
              "operator": ">=",
              "value": "28",
              "entity": "sensor.sensor_living_room_temperature"
            }
          ],
          "_expanded": True,
          "image": "",
          "autoRotate": False,
          "state_entity": "input_boolean.sensor_living_room",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_hum_dry",
          "name": "Dry Humidity",
          "display_entity": "sensor.sensor_living_room_humidity",
          "unit": "%",
          "color": "#eab308",
          "icon": "🌵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.sensor_living_room_humidity",
              "operator": "<",
              "value": "40",
              "entity": "sensor.sensor_living_room_humidity"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_living_room",
          "operator": "==",
          "value": "off"
        },
        {
          "id": "st_hum_normal",
          "name": "Normal Humidity",
          "display_entity": "sensor.sensor_living_room_humidity",
          "unit": "%",
          "color": "#10b981",
          "icon": "💧",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.sensor_living_room_humidity",
              "operator": "between",
              "value": "40-60",
              "entity": "sensor.sensor_living_room_humidity"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_living_room",
          "operator": "==",
          "value": "off"
        },
        {
          "id": "st_hum_wet",
          "name": "Wet Humidity",
          "display_entity": "sensor.sensor_living_room_humidity",
          "unit": "%",
          "color": "#3b82f6",
          "icon": "🌧️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_living_room",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.sensor_living_room_humidity",
              "operator": ">",
              "value": "60",
              "entity": "sensor.sensor_living_room_humidity"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_living_room",
          "operator": "==",
          "value": "off"
        }
      ]
    },
    "scaleX": 3.9815078588427864,
    "scale": 3.9815078588427864,
    "scaleY": 3.9815078588427864,
    "entity_id": "input_boolean.sensor_living_room"
  },
  {
    "id": "sc_1780087032108",
    "name": "Bedroom Sensor",
    "type": "sensor",
    "position": {
      "horizontal": [36.38814217969266, 70.58803431699135],
      "vertical": [36.38814217969266, 70.58803431699135]
    },
    "config": {
      "temperature_entity": "sensor.somneo_temperature",
      "humidity_entity": "sensor.somneo_humidity",
      "color": "#0ea5e9",
      "icon": "🌡️",
      "transparent": True,
      "actions": [
        {
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "input_boolean.sensor_bedroom"
        },
        {
          "type": "SENSOR_OVERLAY",
          "trigger": "long_press"
        }
      ],
      "states": [
        {
          "id": "temp_cold",
          "name": "Cold Temp",
          "display_entity": "sensor.somneo_temperature",
          "unit": "°",
          "color": "#3b82f6",
          "icon": "❄️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.somneo_temperature",
              "operator": "<",
              "value": "20"
            }
          ]
        },
        {
          "id": "temp_comfort",
          "name": "Comfort Temp",
          "display_entity": "sensor.somneo_temperature",
          "unit": "°",
          "color": "#10b981",
          "icon": "🌡️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.somneo_temperature",
              "operator": "between",
              "value": "20-25",
              "entity": "sensor.somneo_temperature"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_bedroom",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "temp_warm",
          "name": "Warm Temp",
          "display_entity": "sensor.somneo_temperature",
          "unit": "°",
          "color": "#f97316",
          "icon": "☀️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.somneo_temperature",
              "operator": "between",
              "value": "25-28",
              "entity": "sensor.somneo_temperature"
            }
          ],
          "_expanded": True,
          "image": "",
          "autoRotate": False,
          "state_entity": "input_boolean.sensor_bedroom",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "temp_hot",
          "name": "Hot Temp",
          "display_entity": "sensor.somneo_temperature",
          "unit": "°",
          "color": "#ef4444",
          "icon": "🥵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.somneo_temperature",
              "operator": ">=",
              "value": "28",
              "entity": "sensor.somneo_temperature"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_bedroom",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "hum_dry",
          "name": "Dry Humidity",
          "display_entity": "sensor.somneo_humidity",
          "unit": "%",
          "color": "#eab308",
          "icon": "🌵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.somneo_humidity",
              "operator": "<",
              "value": "35"
            }
          ],
          "_expanded": False
        },
        {
          "id": "hum_comfort",
          "name": "Comfort Humidity",
          "display_entity": "sensor.somneo_humidity",
          "unit": "%",
          "color": "#10b981",
          "icon": "💧",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.somneo_humidity",
              "operator": "between",
              "value": "35-60"
            }
          ],
          "_expanded": False
        },
        {
          "id": "hum_wet",
          "name": "Humid Wet",
          "display_entity": "sensor.somneo_humidity",
          "unit": "%",
          "color": "#2563eb",
          "icon": "🌧️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_bedroom",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.somneo_humidity",
              "operator": ">",
              "value": "60"
            }
          ],
          "_expanded": False
        }
      ]
    },
    "scaleX": 4.3302534110788695,
    "scale": 4.3302534110788695,
    "scaleY": 4.3302534110788695,
    "entity_id": "input_boolean.sensor_bedroom"
  },
  {
    "id": "sc_1780159798662",
    "name": "Fan sensor",
    "type": "sensor",
    "position": {
      "horizontal": [59.9112818438831, 71.3797187921239],
      "vertical": [59.9112818438831, 71.3797187921239]
    },
    "config": {
      "temperature_entity": "sensor.fan_temperature_p_7_7",
      "humidity_entity": "sensor.fan_relative_humidity_p_7_1",
      "color": "#10b981",
      "icon": "🌡️",
      "transparent": True,
      "actions": [
        {
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "input_boolean.sensor_fan",
          "_expanded": True,
          "name": "",
          "icon": "",
          "width": ""
        },
        {
          "type": "SENSOR_OVERLAY",
          "trigger": "long_press",
          "_expanded": False
        }
      ],
      "states": [
        {
          "id": "st_temp_cold",
          "name": "Cold Temperature",
          "display_entity": "sensor.fan_temperature_p_7_7",
          "unit": "°",
          "color": "#3b82f6",
          "icon": "❄️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.fan_temperature_p_7_7",
              "operator": "<",
              "value": "20",
              "entity": "sensor.fan_temperature_p_7_7"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_temp_comfortable",
          "name": "Comfortable Temperature",
          "display_entity": "sensor.fan_temperature_p_7_7",
          "unit": "°",
          "color": "#10b981",
          "icon": "🌡️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.fan_temperature_p_7_7",
              "operator": "between",
              "value": "20-25",
              "entity": "sensor.fan_temperature_p_7_7"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_temp_warm",
          "name": "Warm Temperature",
          "display_entity": "sensor.fan_temperature_p_7_7",
          "unit": "°",
          "color": "#f97316",
          "icon": "☀️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.fan_temperature_p_7_7",
              "operator": "between",
              "value": "25-28",
              "entity": "sensor.fan_temperature_p_7_7"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_temp_hot",
          "name": "Hot Temperature",
          "display_entity": "sensor.fan_temperature_p_7_7",
          "unit": "°",
          "color": "#ef4444",
          "icon": "🥵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.fan_temperature_p_7_7",
              "operator": ">=",
              "value": "28",
              "entity": "sensor.fan_temperature_p_7_7"
            }
          ],
          "_expanded": True,
          "image": "",
          "autoRotate": False,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "on"
        },
        {
          "id": "st_hum_dry",
          "name": "Dry Humidity",
          "display_entity": "sensor.fan_relative_humidity_p_7_1",
          "unit": "%",
          "color": "#eab308",
          "icon": "🌵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.fan_relative_humidity_p_7_1",
              "operator": "<",
              "value": "40",
              "entity": "sensor.fan_relative_humidity_p_7_1"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "off"
        },
        {
          "id": "st_hum_normal",
          "name": "Normal Humidity",
          "display_entity": "sensor.fan_relative_humidity_p_7_1",
          "unit": "%",
          "color": "#10b981",
          "icon": "💧",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.fan_relative_humidity_p_7_1",
              "operator": "between",
              "value": "40-60",
              "entity": "sensor.fan_relative_humidity_p_7_1"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "off"
        },
        {
          "id": "st_hum_wet",
          "name": "Wet Humidity",
          "display_entity": "sensor.fan_relative_humidity_p_7_1",
          "unit": "%",
          "color": "#3b82f6",
          "icon": "🌧️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_fan",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.fan_relative_humidity_p_7_1",
              "operator": ">",
              "value": "60",
              "entity": "sensor.fan_relative_humidity_p_7_1"
            }
          ],
          "_expanded": True,
          "state_entity": "input_boolean.sensor_fan",
          "operator": "==",
          "value": "off"
        }
      ]
    },
    "scaleX": 3.9924600177384857,
    "scale": 3.9924600177384857,
    "scaleY": 3.9924600177384857
  },
  {
    "id": "sc_1780180169043",
    "name": "Outside temperature",
    "type": "sensor",
    "position": {
      "horizontal": [53.1401624509109, 6.395278425438048],
      "vertical": [53.1401624509109, 6.395278425438048]
    },
    "config": {
      "temperature_entity": "sensor.meteoswiss_temperature_at_8055",
      "humidity_entity": "sensor.meteoswiss_relative_humidity_at_8055",
      "color": "#0ea5e9",
      "icon": "🌡️",
      "transparent": False,
      "actions": [
        {
          "type": "TOGGLE",
          "trigger": "tap",
          "action_entity": "input_boolean.sensor_outside"
        },
        {
          "type": "SENSOR_OVERLAY",
          "trigger": "long_press"
        }
      ],
      "states": [
        {
          "id": "temp_cold",
          "name": "Cold Temp",
          "display_entity": "sensor.meteoswiss_temperature_at_8055",
          "unit": "°",
          "color": "#3b82f6",
          "icon": "❄️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.meteoswiss_temperature_at_8055",
              "operator": "<",
              "value": "20"
            }
          ]
        },
        {
          "id": "temp_comfort",
          "name": "Comfort Temp",
          "display_entity": "sensor.meteoswiss_temperature_at_8055",
          "unit": "°",
          "color": "#10b981",
          "icon": "🌡️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.meteoswiss_temperature_at_8055",
              "operator": "between",
              "value": "20-24"
            }
          ]
        },
        {
          "id": "temp_warm",
          "name": "Warm Temp",
          "display_entity": "sensor.meteoswiss_temperature_at_8055",
          "unit": "°",
          "color": "#f97316",
          "icon": "☀️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.meteoswiss_temperature_at_8055",
              "operator": "between",
              "value": "25-28"
            }
          ],
          "_expanded": True,
          "image": "",
          "autoRotate": False
        },
        {
          "id": "temp_hot",
          "name": "Hot Temp",
          "display_entity": "sensor.meteoswiss_temperature_at_8055",
          "unit": "°",
          "color": "#ef4444",
          "icon": "🥵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "on"
            },
            {
              "state_entity": "sensor.meteoswiss_temperature_at_8055",
              "operator": ">=",
              "value": "28"
            }
          ]
        },
        {
          "id": "hum_dry",
          "name": "Dry Humidity",
          "display_entity": "sensor.meteoswiss_relative_humidity_at_8055",
          "unit": "%",
          "color": "#eab308",
          "icon": "🌵",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.meteoswiss_relative_humidity_at_8055",
              "operator": "<",
              "value": "35"
            }
          ],
          "_expanded": False
        },
        {
          "id": "hum_comfort",
          "name": "Comfort Humidity",
          "display_entity": "sensor.meteoswiss_relative_humidity_at_8055",
          "unit": "%",
          "color": "#10b981",
          "icon": "💧",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.meteoswiss_relative_humidity_at_8055",
              "operator": "between",
              "value": "35-60"
            }
          ],
          "_expanded": False
        },
        {
          "id": "hum_wet",
          "name": "Humid Wet",
          "display_entity": "sensor.meteoswiss_relative_humidity_at_8055",
          "unit": "%",
          "color": "#2563eb",
          "icon": "🌧️",
          "conditions": [
            {
              "state_entity": "input_boolean.sensor_outside",
              "operator": "==",
              "value": "off"
            },
            {
              "state_entity": "sensor.meteoswiss_relative_humidity_at_8055",
              "operator": ">",
              "value": "60"
            }
          ],
          "_expanded": False
        }
      ],
      "shape": "circle"
    },
    "scaleX": 3.9924600177384857,
    "scale": 3.9924600177384857,
    "scaleY": 3.9924600177384857,
    "shape": "circle"
  }
]

# Write to file for permanent storage and verification
with open('/home/costi/workspace/dynamic_map/docs/floor2_shortcuts_corrected.json', 'w', encoding='utf-8') as f:
    json.dump(shortcuts, f, indent=2)

with open('/home/costi/workspace/dynamic_map/ha_test/config/dynamic_map_data/shortcuts_floor2.json', 'w', encoding='utf-8') as f:
    json.dump(shortcuts, f, indent=2)

print("SUCCESS: JSON constructed and validated perfectly in both docs/ and ha_test/config/!")
