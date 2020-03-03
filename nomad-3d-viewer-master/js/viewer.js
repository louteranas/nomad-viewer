/**
 *
 */

const THREE = require('three');
const Swal = require('sweetalert2');
const fs = require('fs');
const Detector = require('./utils/detector.js');
const PubSub = require('pubsub-js');
const collision = require("./collision.js");
const nomad = require("./nomad-server.js");


const ToastCollision = Swal.mixin({
	toast: true,
	position: 'bottom-end',
	showConfirmButton: false,
	timer: 1000000,
	background: "#F35151"
})
const ToastNoCollision = Swal.mixin({
	toast: true,
	position: 'bottom-end',
	showConfirmButton: false,
	timer: 1000000,
	background: "#31DB04"
});

const ToastPos = Swal.mixin({
	toast: true,
	position: 'bottom-start',
	showConfirmButton: false,
	timer: 1000000,
	background: "#D99F1C"
});


if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
}

const OrbitControls = require('three-orbitcontrols');
const TransformControls = require('three-transformcontrols');;
const dat = require('dat.gui');
const Importer = require('./n3d/io/importer.js');
const config = require('./config.js');
const Lights = require('./lights.js');
const Objects = require('./objects.js')

let collisionDetection = null;
if (config.collisionDetection) {
	collisionDetection = require('../build/Release/addonnomad3dcollision');
}


class Viewer {

	constructor() {
		//scene Attributes
		this._statsEnabled = config.stats;
		this._container = null;
		this._stats = null;
		this._camera = null;
		this._scene = null;
		this._sceneCenter = null;
		this._renderer = null;
		this._controls = null;
		this._effectController = null;
		this._model = null;
		this._animator = null;
		this._textureCube = null;
		this._ground = null;
		this._gui = new dat.GUI();
		this._lights = new Lights();
		this._objects = new Objects();
		this._collisions = collision;
		this._nomad = nomad;
		this._frameTimeOut = config.frameTimeOut;
		this._play = true;
		this._alertType = null;
		this._alertPOS = null;
	}

	init() {
		this._container = document.createElement('div');
		document.body.appendChild(this._container);

		// Init Nomad server for positions.
		this._nomad.init();

		if (collisionDetection !== null) {
			collisionDetection.init([config.localEndpoint, config.name, config.modelDirectoryPath, config.modelFileName, 0, config.collisionMargin, config.collisionGUI]);
		}

		this.initRenderer();
		this.initCamera();
		this.initScene();
		this._objects.initModel(this._sceneCenter, this._renderer, this._camera);
		this._model = this._objects.model;
		this._lights.initLights(this._scene, this._camera, this._renderer);
		this.initGround();
		this._lights.initLightsGui(this._gui);
		this.initGUI(this._lights);
		this._lights.importLights()
		this._objects.initObjects(this._gui);
		this._objects.initObjectsGui();
		this._collisions.initGui(this._gui);
		PubSub.subscribe('ALERT COLLISION', (msg, data) => {
			if(data[0] == 'COLLIDING'){
				this.alertCollision();
				// console.log(data[1]);
				this._objects.updatePositioning(data[1])
			}
			if(data == 'OK'){
				this.alertOk();
			}
		});

		this._nomad.initGui(this._gui);
		
		window.addEventListener('resize', this.onWindowResize.bind(this), false);
		window.addEventListener('keydown', this.onDocumentKeyDown.bind(this), false);
	}

	printComponent(component) {
		console.log('component ' + component.name);
		if (component.sceneNode !== null && component.sceneNode.matrix !== null) {
			console.log('  matrix elements ' + component.sceneNode.matrix.elements);
		}
	}

	animate() {

		if (!this._play) {
			setTimeout(() => {
				requestAnimationFrame(this.animate.bind(this));
			}, 2000);
		}
		else {
			if (this._frameTimeOut == 0) {
				requestAnimationFrame(this.animate.bind(this));
			}
			else {
				setTimeout(() => {
					requestAnimationFrame(this.animate.bind(this));
				}, this._frameTimeOut);
			}
		}


		this._controls.update();
		this._lights.updateLightSpheres(this._gui);
		this._objects.updateObjectsControls();
		this._objects.updateObjects()
		if (this._model !== null) {
			if (this._animator !== null) {
				this._animator.update();
			}
			this._model.update(this._camera);
		}
		if (this._objects.objects !== []) {
			if (this._animator !== null) {
				this._animator.update();
			}
			for (let i = 0; i < this._objects.objects.length; i++) {
				this._objects.objects[i].model.update(this._camera);
			}

		}

		this._objects.checkFolders();
		for(let j = 0; j < this._objects.positioning.length; j++){
			if (this._objects.positioning[j] && collisionDetection != null) {
				if(this._objects.objectsFallDirection[j] == 'Rx+')
						this._objects.objectsCenter[j].position.x += 0.05;

				if(this._objects.objectsFallDirection[j] == 'Rx-')
						this._objects.objectsCenter[j].position.x -= 0.05;

				if(this._objects.objectsFallDirection[j] == 'Gy+')
						this._objects.objectsCenter[j].position.y += 0.05;
				if(this._objects.objectsFallDirection[j] == 'Gy-')
						this._objects.objectsCenter[j].position.y -= 0.05;

				if(this._objects.objectsFallDirection[j] == 'Bz+')
						this._objects.objectsCenter[j].position.z += 0.05;
				if(this._objects.objectsFallDirection[j] == 'Bz-')
						this._objects.objectsCenter[j].position.z -= 0.05;
				let condition1 = this._objects.objectsCenter[j].position.x > 400
				let condition2 = this._objects.objectsCenter[j].position.x < -400
				let condition3 = this._objects.objectsCenter[j].position.y > 150
				let condition4 = this._objects.objectsCenter[j].position.y < -30
				let condition5 = this._objects.objectsCenter[j].position.z > 600
				let condition6 = this._objects.objectsCenter[j].position.z < -400
				if(condition1 || condition2 || condition3 || condition4 || condition5 || condition6){
					this._objects.positioning[j] = false;
				}
				
			}
			else{
				PubSub.unsubscribe('POSITION')
			}
		}

		this._renderer.render(this._scene, this._camera);


		if (this._statsEnabled) {
			this._stats.update();
		}

	}

	onWindowResize(event) {
		let screenWidth = window.innerWidth;
		let screenHeight = window.innerHeight;
		this._renderer.setSize(screenWidth, screenHeight);
		this._camera.aspect = screenWidth / screenHeight;
		this._camera.updateProjectionMatrix();
	}

	onDocumentKeyDown(event) {

		event = event || window.event;
		let keycode = event.keyCode;

		switch (keycode) {
			case 83:
				this._animator.started = true;
				break;
		}
	}

	initCamera() {

		// Camera.
		this._camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
		this._camera.position.x = 0;
		this._camera.position.y = 0;
		this._camera.position.z = 80;

		this._controls = new OrbitControls(this._camera, this._renderer.domElement);
		//this._controls.addEventListener('change', this._renderer.render);
		// Seems to provoke some pause on slower computers.
		//TODO : transform to button
		this._controls.enableDamping = true;
		this._controls.dampingFactor = 0.25;
		this._controls.minDistance = 1;
		this._controls.maxDistance = 500;
		this._controls.maxPolarAngle = Math.PI / 1.85;

		// Enable the panning.
		// Important : Do not set this._controls.screenSpacePAnning to true,
		// When I set the screenSpacePanning property of OrbitControls to true,
		// Zooming in to a certain level, zooming and panning become very, very slow
		this._controls.screenSpacePanning = false;
	}

	initRenderer() {
		// Renderer
		// renderer = new THREE.WebGLDeferredRenderer( { antialias: true } );
		this._renderer = new THREE.WebGLRenderer({ antialias: true });
		this._renderer.setClearColor(0xdddddd);
		this._renderer.setPixelRatio(window.devicePixelRatio);
		this._renderer.setSize(window.innerWidth, window.innerHeight);
		this._container.appendChild(this._renderer.domElement);
		this._renderer.shadowMap.enabled = true;
		// this._renderer.shadowMap.autoUpdate = false;
		this._renderer.gammaInput = true;
		this._renderer.gammaOutput = true;
		this._renderer.gammaFactor = 1.4;
		this._renderer.toneMapping = THREE.ReinhardToneMapping;
		this._renderer.toneMappingExposure = 4;
		this._renderer.alpha = true;
		this._renderer.setClearAlpha(0.9)
	}

	genCubeUrls(prefix, postfix) {
		return [
			prefix + 'px' + postfix, prefix + 'nx' + postfix,
			prefix + 'py' + postfix, prefix + 'ny' + postfix,
			prefix + 'pz' + postfix, prefix + 'nz' + postfix
		];
	}

	initScene() {
		this._scene = new THREE.Scene();
		
		// Scene background
		this._textureCube = new THREE.CubeTextureLoader().setPath("../../img/").load(this.genCubeUrls("Env/", ".png"));
		this._scene.background = this._textureCube;


		this._sceneCenter = new THREE.Group();

		// Set the position from the config.
		this._sceneCenter.position.x = -config.instrumentPosition.x;
		this._sceneCenter.position.y = -config.instrumentPosition.y;
		this._sceneCenter.position.z = -config.instrumentPosition.z;

		this._scene.add(this._sceneCenter);
	}


	initGround() {
		// Define the ground geometry and material.
		let groundGeometry = new THREE.BoxBufferGeometry(1, 1, 1);
		let groundMaterial = new THREE.MeshStandardMaterial();
		let groundSize = 10000;
		groundMaterial.color.setRGB(1, 1, 1);
		groundMaterial.roughness = 1;
		groundMaterial.metalness = 0;
		groundMaterial.map = new THREE.TextureLoader().load("../../img/Citadella2/ground.jpg");
		groundMaterial.map.repeat.multiplyScalar(groundSize / 20);
		groundMaterial.map.wrapS = THREE.RepeatWrapping;
		groundMaterial.map.wrapT = THREE.RepeatWrapping;
		// Do not set groundMaterial.depthWrite to false because the ground is not rendered.
		groundMaterial.needsUpdate = true;

		// Change the dimensions of the box.
		this._ground = new THREE.Mesh(groundGeometry, groundMaterial);
		this._ground.scale.x = groundSize;
		this._ground.scale.y = 1 - 1.0 / groundSize;
		this._ground.scale.z = groundSize;
		this._ground.position.y = -20; // TODO read this from model

		this._scene.add(this._ground);
		this._ground.receiveShadow = false;
		this._ground.castShadow = false;
		this._ground.renderOrder = 1;
	}

	viewChanger() {
		if (this._model !== null) {
			this._model.wallOpacity = this._effectController.WallOpacity;
			this._model.wallsVisible = this._effectController.WallsVisible;
		}
	}


	qualityChanger() {
		//this._objectModel.viewDistance = this._effectController.ViewDistance;
		if (this._model !== null) {
			this._model.viewDistance = this._effectController.ViewDistance;

		}

		if (!this._effectController.Environment) {
			this._effectController.Reflection = false;
		}

		// Environment
		this._ground.visible = this._effectController.Environment;
		if (this._effectController.Environment) {
			this._scene.background = this._textureCube;
		} else {
			this._scene.background = null;
		}

		// Reflection
		if (this._model !== null) {
			if (this._effectController.Reflection) {
				this._model.setEnvMap(this._textureCube);
			} else {
				this._model.setEnvMap(null);
			}
		}

		// Dynamic shadows
		this._renderer.shadowMap.enabled = this._effectController.DynamicShadows;
		this._ground.castShadow = this._effectController.DynamicShadows;
		this._ground.receiveShadow = this._effectController.DynamicShadows;
		this._ground.material.needsUpdate = true;
		if (this._model !== null) {
			this._model.root.castShadow(this._effectController.DynamicShadows);
			this._model.root.receiveShadow(this._effectController.DynamicShadows);
		}
	}

	initGUI() {
		var mySubscriber = function (msg, data) {
			console.log( msg, data );
		};
		// FPS counter
		if (this._statsEnabled) {
			this._stats = new Stats();
			this._container.appendChild(this._stats.dom);
		}

		this._effectController = {
			WallsVisible: true,
			WallOpacity: 1.0,
			ViewDistance: 500,
			Environment: true,
			Reflection: false,
			DynamicShadows: false,
			"FrameTimeOut": this._frameTimeOut,
			"Play / Pause": () => { this._play = !this._play}
		};

		const view = this._gui.addFolder("View");
		view.add(this._effectController, "WallsVisible").onChange(this.viewChanger.bind(this)).listen();
		view.add(this._effectController, "WallOpacity", 0, 1, 0.01).onChange(this.viewChanger.bind(this)).listen();
		const graphics = this._gui.addFolder("Graphics");
		graphics.add(this._effectController, "Play / Pause");
		graphics.add(this._effectController, "ViewDistance", 1, 500, 1).onChange(this.qualityChanger.bind(this)).listen();
		graphics.add(this._effectController, "Environment").onChange(this.qualityChanger.bind(this)).listen();
		graphics.add(this._effectController, "Reflection").onChange(this.qualityChanger.bind(this)).listen();
		graphics.add(this._effectController, "DynamicShadows").onChange(this.qualityChanger.bind(this)).listen();
		graphics.add(this._effectController, "FrameTimeOut").min(0).max(100).step(0.5).onChange((val) => {
			this._frameTimeOut = val;
		});


		this.qualityChanger();
	}

	
	alertCollision() {
		if (this._alertType != "newCollision") {
			ToastCollision.fire({
				type: 'error',
				title: 'New collision detected'
			})
			this._alertType = "newCollision"
		}
	}

	alertOk() {
		if (this._alertType != "OK") {
			ToastNoCollision.fire({
				type: 'success',
				title: 'No collisions'
			});
			this._alertType = "OK";
			this._alertPOS = null;
		}
	}

}

module.exports = Viewer;
