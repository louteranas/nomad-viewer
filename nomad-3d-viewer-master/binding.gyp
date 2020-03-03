{
	"variables": {
   		"nomad%": "false",
		"collisions%": "false",
   	},  

	"targets": [
		{
			"target_name": "addonnomad3dposition",
			'cflags!': [ '-fno-exceptions' ],
			'cflags_cc!': [ '-fno-exceptions' ],
			'conditions': [
        		['nomad=="true"', {
          			"sources": [
            			"nomad-positions/nomad-positions.cc",
          			],
          			"conditions": [
            			['OS=="mac"', {
              				'xcode_settings': {
                				'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
              				},
            			}]    
          			],
          			"libraries": [
            			"-lcameo -lprotobuf -lzmq"
          			]
        		}]
      		]
		},

		{
			"target_name": "addonnomad3dcollision",
			'cflags!': [ '-fno-exceptions' ],
			'cflags_cc!': [ '-fno-exceptions' ],
			'conditions': [
        		['collisions=="true"', {
					"sources": [
						"collision/collision.cc",
					],
					'conditions': [
						['OS=="mac"', {
							'xcode_settings': {
								'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
							}
						}]
					],
					"libraries": [
						"-lcameo -lprotobuf -lzmq"
					]
				}]
			]
		}
	]
}