/**
 *
 * @class Lights
 */

const THREE = require('three');
const fs = require('fs');
const Detector = require('./utils/detector.js');
const PubSub = require('pubsub-js');

const Swal = require('sweetalert2');

if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
}

const TransformControls = require('three-transformcontrols');
const config = require('./config.js');


class Lights {

	constructor() {
		this._lights = [];
		this._currentLight = -1;
		this._controllableLights = []; //keeps lights names
		this._lightSpheres = []; // keeps the textured shperes attached to the point lights
		this._lightsParam = []; // keeps color, intesity, distance and visibility og the point light
		this._lightGuiFolders = []; // keeps folders obj of each light
		this._lightsFolder = null; // parent folder of lights subfolders
		this._lightsTransforms = null;
		this._ambientLight = null;
		this._lightsImported = false;
		this._ambientLightFolder = null;
		this._effectController = {
			Intensity: 0.02,
			lightSelector: this._currentLight
		};
		this._scene = null;
		this._renderer = null;
		this._gui = null;
		PubSub.subscribe('QUITTING', ((msg, data) => {
			if (data) {
				this.lightsExport(false)
			}
		}).bind(this));
	}

	get ambientLight() {
		return this._ambientLight;
	}

	get effectController() {
		return this._effectController;
	}

	get lights() {
		return this._lights;
	}

	set ambientLight(value) {
		this._ambientLight = value;
	}

	initLights(scene, camera, renderer) {
		// Ambient light
		this._scene = scene;
		this._renderer = renderer;
		this._ambientLight = new THREE.AmbientLight();
		this._ambientLight.intensity = 0.4; //Math.max(0.0, 1.0 - dirLight.intensity);
		this._scene.add(this._ambientLight);
		this._lightsTransforms = new TransformControls(camera, this._renderer.domElement);
		this._scene.add(this._lightsTransforms)
		this._lightsTransforms.addEventListener('dragging-changed', function (event) {
			orbit.enabled = !event.value;
		});

	}

	initLightsGui(gui) {
		this._options = {
			'Add New light': () => {
				this.addLights();
			},
			'Save lights': () => { this.lightsExport(false) },
			// 'Import Lights': () => { this.importLights() }, // no need, Lights are imported automaticly
			'Reset Settings': () => { this.lightsExport(true); this.deleteLights() }
		};

		let AmbientLightParam = {
			'ambient': this._ambientLight.intensity,
		};
		this._gui = gui;

		this._lightsFolder = gui.addFolder("Lights");

		// options to control lights
		this._lightsFolder.add(this._options, "Add New light");
		// this._lightsFolder.add(this._options, 'Import lights'); // no need, lights are imported automaticly
		this._lightsFolder.add(this._options, 'Save lights');
		this._lightsFolder.add(this._options, 'Reset Settings');

		this.updateAmbientLight();
		this.viewChanger();
	}

	updateAmbientLight(lightFolder = this._ambientLightFolder) {
		// option to control ambiant lighting
		lightFolder = this._lightsFolder.addFolder("Ambient Light");
		lightFolder.add(this._effectController, "Intensity", 0, 0.5, 0.01).onChange(this.viewChanger.bind(this)).listen();
	}

	viewChanger() {
		this._ambientLight.intensity = this._effectController.Intensity;
	}
	/***
	this method is used to add a point light and all its parameters
	***/
	addLights(position = [-24, -2, -12.5], params = { Color: 0xffffff, Intensity: 1, Reach: 30, Visible: true }) {
		// preparing the sphere and it's texture
		let texture = new THREE.TextureLoader().load('../../img/lampp.jpg', this._renderer.render);
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
		let sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 18, 18), new THREE.MeshBasicMaterial({ map: texture, transparent: false }));

		// creating a point light and attaching the sphere to it
		let pointLight = new THREE.PointLight(params['Color'], params['Intensity'], params['Reach'], 2);
		pointLight.position.set(position[0], position[1], position[2]);
		this._lightSpheres.push(sphere);
		pointLight.add(sphere);
		this._scene.add(pointLight);

		//saving parameters, giving controls to the newly created point light
		this._lights.push(pointLight);
		let oldLight = this._currentLight;
		this._currentLight = this._lights.length - 1;
		this._controllableLights.push("Light N°" + this._currentLight);
		this.changeControlledLight(this._currentLight);
		this.lightSettings(this._currentLight);

		// in case of importing a none visible light
		if (!params['Visible']) { this._lights[this._currentLight].visible = false; this.findLightToControl(this._currentLight) }
		this.folderCreator(this._currentLight, oldLight);//creating a specific folder for the point light
		this.currentLightPicker();//upating the current controlled light picker

	}


	/***
	this method is used to import saved lights in the config file of the project
	***/
	importLights() {
		// case of no saved lights of uncomplete config file
		if (config['ambientLight'] == 0 || config['ambientLight'] == undefined) {
			this._ambientLight.intensity = 0
			this._effectController.Intensity = 0;
		}
		else {
			this._ambientLight.intensity = config['ambientLight'];
			this._effectController.Intensity = config['ambientLight'];
		}
		if (config.numberOfLights == undefined || config.numberOfLights == 0) {
			console.log("No saved lights found");
			return;
		}
		// case of already imported lights
		if (this._lightsImported) {
			console.log("Lights have already been imported");
			return;
		}
		// normal case use



		// we use the add light function with saved parameters
		for (let i = 0; i < config['numberOfLights']; i++) {
			this.addLights(config['lightsPos'][i], config['lightsParams'][i]);
		}

		//signal the import
		this._lightsImported = true;
		console.log("Light settings are imported")
	}

	/***
	this method is used to either:
		- export exsiting lights to config file
		- reset the config file
	***/
	lightsExport(reset) {
		// we read the file and store its content then either add lights or reset them
		fs.readFile(config.configPath, 'utf8', ((err, data) => {
			if (err) {
				console.log(err);
			} else {
				let parsedData = JSON.parse(data); //now it an object
				if (reset) {
					parsedData['numberOfLights'] = 0;
					parsedData['lightsPos'] = [];
					parsedData['lightsParams'] = [];
					parsedData['ambientLight'] = 0;
					this._ambientLight.intensity = 0;
				}
				if (!reset) {
					parsedData['numberOfLights'] = this._lights.length;
					this.saveLights(parsedData);
				}
				//reset ? parsedData['numberOfLights'] = 0 :
				//	parsedData['numberOfLights'] = this._lights.length; //add some data
				//reset ? (() => { parsedData['lightsPos'] = []; parsedData['lightsParams'] = []; parsedData['ambientLight'] = 0.0; console.log("purge") }).bind(parsedData) :
				//sthis.saveLights(parsedData);
				console.log(parsedData)
				let json = JSON.stringify(parsedData, undefined, 2); //convert it back to json
				fs.writeFileSync(config.configPath, json, 'utf8'); // write it back
			}
		}).bind(reset));
	}


	/***
	this method is used by the export function to save lights
	***/
	saveLights(data) {
		console.log(config.configPath)
		if (this._lights.length === 0) {
			if (this._ambientLight != 0) {
				data['ambientLight'] = this._ambientLight.intensity;
				console.warn("no light to save, ambient lighting is saved");
				return;

			}
			console.warn("no light to save"); return;
		}
		data['lightsPos'] = [];
		data['lightsParams'] = [];
		data['ambientLight'] = this._ambientLight.intensity;
		for (let i = 0; i < this._lights.length; i++) {
			data['lightsPos'].push([
				this._lights[i].position.x,
				this._lights[i].position.y,
				this._lights[i].position.z])
			data['lightsParams'].push({
				Color: this._lights[i].color.getHex(),
				Intensity: this._lights[i].intensity,
				Reach: this._lights[i].distance,
				Visible: this._lights[i].visible
			})
		}
		console.log("Lights state is saved");
	}

	/***
	this method saves light parameters
	***/
	lightSettings(lightIndex) {
		if (lightIndex >= this._lights.length || lightIndex < 0) {
			console.error("light index error");
			return;
		}
		this._lightsParam.push({
			Remove: (() => {
				this.removeLight(lightIndex)
			}).bind(lightIndex),
			Color: "#" + this._lights[lightIndex].color.getHex().toString(16),
			Intensity: this._lights[lightIndex].intensity,
			Reach: this._lights[lightIndex].distance,
			Visible: this._lights[lightIndex].visible
		})

	}

	removeLight(lightIndex) {
		console.log("Light To remove : " + lightIndex)
		this._scene.remove(this._lights[lightIndex])
		if (this._lights[lightIndex] != undefined) this._lights[lightIndex].visible = false;
		this._lights.splice(lightIndex, 1);
		this._currentLight = this._lights.length - 1
		this._lightsTransforms.detach()
		this.folderCreator(this._currentLight, lightIndex);
		this._lightGuiFolders.splice(lightIndex, 1);
		this._controllableLights.splice(lightIndex, 1);
		this._lightsParam.splice(lightIndex, 1);
		this._lightSpheres.splice(lightIndex, 1);
		this._lightGuiFolders.splice(lightIndex, 1);
		this._lightsFolder.remove(this._picker);
		if (this._lights.length > 0)
			this._picker = this._lightsFolder.add(this._effectController, 'lightSelector', this._controllableLights).onChange(() => {
				this.folderCreator(this._controllableLights.indexOf(this._effectController.lightSelector), this._currentLight)
				this.changeControlledLight(this._controllableLights.indexOf(this._effectController.lightSelector));
			});
		
	}

	/***
	this method creates control GUI for light parameters
	***/
	folderCreator(lightIndexToAdd, lightIndexToRemove = -1) {
		if (this._lightsFolder != null) {
			if (lightIndexToRemove != -1) {console.log(this._lights)
				console.log(this._lightsFolder)
				console.log(Object.keys(this._lightsFolder.__folders))
				console.log(Object.keys(this._lightsFolder.__folders).length > 0)
				if(Object.keys(this._lightsFolder.__folders).length > 0)
					// this._lightsFolder.removeFolder(this._lightGuiFolders[lightIndexToRemove]);
					this._lightsFolder.removeFolder(this._lightsFolder.__folders[Object.keys(this._lightsFolder.__folders)[1]])
			}
			// console.log(lightIndex)
			if(this._lights.length > 0){
				if (this._lightsFolder.__folders[this._controllableLights[lightIndexToAdd]] == undefined) {
					let lightGuiFolder = this._lightsFolder.addFolder(this._controllableLights[lightIndexToAdd]);
					// remove light 
					lightGuiFolder.add(this._lightsParam[lightIndexToAdd], 'Remove');
					lightGuiFolder.add(this._lightsParam[lightIndexToAdd], 'Color').onChange((val) => {
						// console.log(val);
						let isOk = /^#[0-9A-F]{6}$/i.test(val)
						if (isOk) {
							this._lights[lightIndexToAdd].color.set(val);
						}
						else {
							console.error("Non valid hex Color")
						}
					});
					// control light color

					// control light intensity
					lightGuiFolder.add(this._lightsParam[lightIndexToAdd], 'Intensity', 0, 10).step(0.1).onChange((val) => {
						this._lights[lightIndexToAdd].intensity = val;
					});
					//control light distance reach
					lightGuiFolder.add(this._lightsParam[lightIndexToAdd], 'Reach').min(5).step(5).onChange((val) => {
						this._lights[lightIndexToAdd].distance = val;
					});
					lightGuiFolder.add(this._lightsParam[lightIndexToAdd], 'Visible').setValue(this._lights[lightIndexToAdd].visible).onChange((val) => {
						this._lights[lightIndexToAdd].visible = val
						if (val) {
							this._lightsTransforms.attach(this.lights[lightIndexToAdd])
						}
						else {
							this._lightsTransforms.detach()
						}
					})
					//saving the the light folder
					lightGuiFolder.open();
					if (lightIndexToAdd == this._lightGuiFolders.length) {
						this._lightGuiFolders.push(lightGuiFolder);
					}
					if (lightIndexToAdd < this._lightGuiFolders.length) {
						this._lightGuiFolders[lightIndexToAdd] = lightGuiFolder;
					}
				}
			}
		}

	}

	/***
	this method finds a visible lights to control
	***/
	findLightToControl(lightIndex) {
		// in case of multiple lights
		if (this._lights.length > 1) {
			// if the chosen light is visibl we give it control
			if (this._lights[lightIndex].visible) {
				this._lightsTransforms.detach();
				this._currentLight = lightIndex;
				this._lightsTransforms.attach(this._lights[lightIndex]);

			}
			// if we hide a light and it had control we find a new visible one
			if (!this._lights[lightIndex].visible && this._lightsTransforms.object == this._lights[lightIndex])
				this.controlVisibleLight();
		}
		// in case of only one light
		else {
			// if there is no light attached
			if (this._lightsTransforms.object === undefined) {
				this._currentLight = lightIndex;
				this._lightsTransforms.attach(this._lights[lightIndex]);
			}
			// if the light is already attached
			else {
				this._lightsTransforms.detach();
			}
		}
	}

	/***
	this method helps to find a visible lights to control
	***/
	controlVisibleLight() {
		this._lightsTransforms.detach();
		for (let i = 0; i < this._lights.length; i++) {
			if (this._lights[i].visible) {
				this._currentLight = i;
				this._lightsTransforms.attach(this._lights[i]);
			}
		}
		return;
	}


	/***
	this method gives controll to a specifique light
	***/
	changeControlledLight(lightIndex) {
		//in case of a wrong index
		if (lightIndex >= this._lights.length || lightIndex < 0) {
			console.error("light index error");
			return;
		}
		// we detach the current light if it's not the only one
		if (lightIndex != 0)
			this._lightsTransforms.detach(this._lights[this._currentLight]);
		// we attach the new one
		this._currentLight = lightIndex;
		this._lightsTransforms.detach()
		if (this._lights[this._currentLight].visible) {
			this._lightsTransforms.attach(this._lights[this._currentLight]);
		}
		//this._scene.add(this._lightsTransforms);
	}


	/***
	this method gives control of the light of choice and creates a picker
	***/
	currentLightPicker() {
		if (this._lights.length == 0) {
			this._lightsFolder.remove(this._picker);
		}
		if (this._lights.length > 0) {
			if (this._picker != null && this._lightsFolder.__controllers.length>3) {
				console.log(this._lightsFolder)
				this._lightsFolder.remove(this._picker);
			}
		}
		this._picker = this._lightsFolder.add(this._effectController, 'lightSelector', this._controllableLights).onChange(() => {
			this.folderCreator(this._controllableLights.indexOf(this._effectController.lightSelector), this._currentLight)
			//this._lightsFolder.removeFolder(this._lightGuiFolders[ this._currentLight]);
			this.changeControlledLight(this._controllableLights.indexOf(this._effectController.lightSelector));
			//this._lightGuiFolders[ this._currentLight].open()


		});
		this._picker.setValue(this._controllableLights[this._currentLight])
	}


	/***
	this method checks if the light control panel and the gui panel is closed or opened in order to show or hide the sphere and keep only the lights
	***/
	updateLightSpheres(gui) {
		//console.log(this._currentLight)
		if (this._lights.length > 0) {
			let firsCondition = this._lightsFolder.closed && this._lightSpheres[0].visible === true && !gui.closed;
			let secondCondition = !this._lightsFolder.closed && this._lightSpheres[0].visible === false && !gui.closed;
			let thirdCondition = gui.closed && this._lightSpheres[0].visible === true;
			if (firsCondition || secondCondition || thirdCondition) {
				for (let i = 0; i < this._lights.length; i++) {
					this._lightSpheres[i].visible = !this._lightSpheres[i].visible;
				}

			}

			if (this._lightsFolder.closed || gui.closed) {
				this._lightsTransforms.detach()
			}
			if (!this._lightsFolder.closed && !gui.closed && this._lights[this._currentLight].visible) {
				//this.controlVisibleLight();
				if (this._lightsTransforms.object == undefined && this._lightSpheres[this._currentLight].visible)
					this._lightsTransforms.attach(this._lights[this._currentLight]);
				//this._scene.add(this._lightsTransforms);
			}
		}


	}


	/***
	this method deletes all the lights and there paramters and folders etc
	***/
	deleteLights() {
		if(Object.keys(this._lightsFolder.__folders).length > 0)
					// this._lightsFolder.removeFolder(this._lightGuiFolders[lightIndexToRemove]);
					this._lightsFolder.removeFolder(this._lightsFolder.__folders[Object.keys(this._lightsFolder.__folders)[1]])
		for (let i = this._lightGuiFolders.length - 1; i > -1; i--) {
			this._lightGuiFolders.pop();
			this._controllableLights.pop();
			this._scene.remove(this._lights[i])
			this._lights.pop();
			this._lightSpheres.pop();
			this._lightsParam.pop();
		}
		this._currentLight = -1;
		this._lightsTransforms.detach();
		this.currentLightPicker();
		console.log("Light settings are reset");
	}


}
module.exports = Lights;