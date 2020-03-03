/**
 *
 * @class Model
 */
const THREE = require('three');
const Swal = require('sweetalert2');
const STLLoader = require('three-stl-loader')(THREE);
const config = require('../../config.js');
const Nomad3DPositions = require('../link/nomad-3d-positions');
const collision = require("../../collision.js");

class Model {

	constructor() {
		this._name = "";
		this._directoryPath = "";
		this._geometryDirectories = [];
		this._root = null;
		this._geometries = {};
		this._viewDistance = 2000000;
		this._wallOpacity = 1;
		this._wallsVisible = true;
		this._activeConfiguration = "";
		this._allGeometriesCount = 0;
		this._allLoadedGeometriesCount = 0;
		this._needsUpdate = false;
		this._sceneNode = null;
		this._sceneNodeMap = {};
		this._boundingBox = null;
		this._clock = new THREE.Clock();
		this._previousUpdateTime = 0;
		this._minDeltaTimeMs = 40;
		this._collisions = collision;
		this._minDeltaTimeMs = config.minDeltaTime;

		this._nomad3DPositions = null;
		this._currentPositions = null;

		this._collisionDetection = null;

		if (config.collisionDetection) {
			let Nomad3DCollisions = require('../link/nomad-3d-collisions');
			this._collisionDetection = new Nomad3DCollisions();
		}
	}

	get name() {
		return this._name;
	}

	set name(value) {
		console.warn("Model.name is a read-only property.");
	}

	get directoryPath() {
		return this._directoryPath;
	}

	set directoryPath(value) {
		console.warn("Model.directoryPath is a read-only property.");
	}

	get geometryDirectories() {
		return this._geometryDirectories;
	}

	set geometryDirectories(value) {
		console.warn("Model.geometryDirectories is a read-only property.");
	}

	get root() {
		return this._root;
	}

	set root(value) {
		console.warn("Model.root is a read-only property.");
	}

	get geometries() {
		return this._geometries;
	}

	set geometries(value) {
		console.warn("Model.geometries is a read-only property.");
	}

	get viewDistance() {
		return this._viewDistance;
	}

	set viewDistance(distance) {
		this._viewDistance = distance;
		this.root.updateLODDistances(this);
	}

	get wallOpacity() {
		return this._wallOpacity;
	}

	set wallOpacity(opacity) {
		this._wallOpacity = opacity;
		this.root.updateWallOpacity(this._wallOpacity);
	}

	get wallsVisible() {
		return this._wallsVisible;
	}

	set wallsVisible(visible) {
		this._wallsVisible = visible;
		this.root.updateWallVisibility(this._wallsVisible, this._activeConfiguration);
	}

	get activeConfiguration() {
		return this._activeConfiguration;
	}

	set activeConfiguration(configName) {
		this.showConfiguration(configName);
	}

	get allGeometriesCount() {
		return this._allGeometriesCount;
	}

	set allGeometriesCount(value) {
		this._allGeometriesCount = value;
	}

	get allLoadedGeometriesCount() {
		return this._allLoadedGeometriesCount;
	}

	set allLoadedGeometriesCount(value) {
		this._allLoadedGeometriesCount = value;
	}

	get needsUpdate() {
		return this._needsUpdate;
	}

	get sceneNodeMap(){
		return this._sceneNodeMap;
	}

	sceneNodeMapSetter(lod, name){
		// first lod is modefied when in collision, the second is for a rollBack for after collision
		// the last bool is to indicate if the node is in collision or not
		this._sceneNodeMap[name] = [lod, lod.clone(), false];
	}

	set needsUpdate(value) {
		this._needsUpdate = value;
	}

	get sceneNode() {
		return this._sceneNode;
	}

	set sceneNode(node) {
		console.warn("Model.sceneNode is a read-only property.");
	}

	get boundingBox() {
		return this._boundingBox;
	}

	set boundingBox(box) {
		console.warn("Model.boundingBox is a read-only property.");
	}

	distanceOfLOD(lodIndex) {
		return (this.viewDistance * lodIndex);
	}

	loadGeometries() {
		console.info("Model " + this.name + " : loading geometries...");

		this.root.loadGeometries(this, new STLLoader());
		// this.sceneNode.scale.set(0.01, 0.01, 0.01);
		// this.sceneNode.rotation.y = Math.PI;
		this.sceneNode.add(this.root.sceneNode);
		console.info("Model " + this.name + " : geometries loaded.");
	}

	init() {

		// Init the nomad 3D positions.
		this._nomad3DPositions = new Nomad3DPositions();

		// Update the positions.
		this.updatePositions();

		// Pass the positions to each controller.
		this.root.init(this._currentPositions);
		PubSub.subscribe('FOCUS', (msg, data) => {
			if(data){
				PubSub.subscribe('ALERT COLLISION', (msg, data) => {
					if(data[0] == 'COLLIDING'){
						this.focusOnCollision();
					}
					if(data == 'OK'){
						this.showAll();
					}
				});
			}
			else{
				PubSub.unsubscribe('ALERT COLLISION')
				this.showAll();
			}
		});
		
		
	}

	showAll() {
		for (let key in this._collisions.sceneNodeMap) {
			for(let subKey in this._collisions.sceneNodeMap[key]){
				if(this._collisions.sceneNodeMap[key][subKey][0]!=undefined)
					this._collisions.sceneNodeMap[key][subKey][0].visible = true;	
			}
		}
	}

	focusOnCollision() {
			for (let key in this._collisions.sceneNodeMap) {
				for(let subKey in this._collisions.sceneNodeMap[key]){
				if (this._collisions.sceneNodeMap[key][subKey][2] != undefined && this._collisions.sceneNodeMap[key][subKey][2]){
					this._collisions.sceneNodeMap[key][subKey][0].visible = true;
				}
				else 
					if(this._collisions.sceneNodeMap[key][subKey][2] != undefined)
						this._collisions.sceneNodeMap[key][subKey][0].visible = false;
			}
		}
		
	}


	updateSceneNodeMap(collisions){
		for (let i = 0; i < collisions.length; i++){
			if(!this._collisions.sceneNodeMap[collisions[i].objectIdA][collisions[i].mergedBlockA][2]){
				this._collisions.sceneNodeMap[collisions[i].objectIdA][collisions[i].mergedBlockA][2] = true;
				this._collisions.highlightObjects(collisions[i].mergedBlockA, collisions[i].objectIdA)
			}
			if(!this._collisions.sceneNodeMap[collisions[i].objectIdB][collisions[i].mergedBlockB][2]){
				this._collisions.sceneNodeMap[collisions[i].objectIdB][collisions[i].mergedBlockB][2] = true;
				this._collisions.highlightObjects(collisions[i].mergedBlockB, collisions[i].objectIdB)
			}
		}
	}

	resetSceneMap(){
		for(let key in this._collisions.sceneNodeMap){
			for(let subKey in this._collisions.sceneNodeMap[key]){
				if(this._collisions.sceneNodeMap[key][subKey]!=undefined)
					this._collisions.sceneNodeMap[key][subKey][2] = false;			
			}
		}
	}

	updatePositions() {

		// Get the positions from Nomad.
		let positions = this._nomad3DPositions.update();

		if (positions === "") {
			return;
		}

		// Get the positions from Nomad.
		if (this._collisionDetection !== null) {
			//console.log(this._sceneNode.children[0].children)
			let collisions = JSON.parse(this._collisionDetection.updatePositions(JSON.parse(positions)));
			//console.log(this._collisions.collisionStack)
			if (collisions.status == 'COLLIDING') {
				PubSub.publish('ALERT COLLISION', ['COLLIDING', collisions.collisions]);
				this.resetSceneMap();//we reset to have an updated list of object colliding in real time
				this._collisions.updateCollisionStack(collisions.collisions, this._nomad3DPositions); //collision stack is a log of collisions
				this.updateSceneNodeMap(collisions.collisions);// we update current objects in collision
			}
			if (collisions.status == 'OK') {
				this.resetSceneMap();
				PubSub.publish('ALERT COLLISION', 'OK');
				this._collisions.resetHighligthedObjects()
			}

		}

		// Parse the result.
		this._currentPositions = JSON.parse(positions);
	}

	updatePositionsAtFrequency() {

		// Update the positions following the frequency.
		let time = this._clock.getElapsedTime();
		let deltaTimeMs = (time - this._previousUpdateTime) * 1000;

		if (deltaTimeMs > this._minDeltaTimeMs) {

			this.updatePositions();
			this._previousUpdateTime = time;
		}
	}

	update(camera) {

		if (this.needsUpdate) {

			if (this.root.getConfigurationByName(this.activeConfiguration) !== null) {
				this.showConfiguration(this.activeConfiguration);
			} else {
				this.showConfiguration();
			}
		}

		// Update the positions.
		this.updatePositionsAtFrequency();

		// Always updated for LODs
		this.root.update(camera, this._currentPositions);

		if (this.needsUpdate) {

			// Bounding box.
			if (this.boundingBox === null) {
				this._boundingBox = new THREE.Box3();
			}

			this._boundingBox.setFromObject(this._sceneNode);
		}

		this.needsUpdate = false;
	}

	showConfiguration(configName, recursive) {
		this._activeConfiguration = (configName === undefined) ? this.root.configurations[0].configuration : configName;

		if (this._root.getConfigurationByName(this._activeConfiguration) === null) {
			console.error("The configuration " + configName + " does not exist in the model " + this.name);
			return;
		}
		this.root.showConfiguration(configName, recursive);
	}

	setEnvMap(envMap, intensity) {
		this.root.setEnvMap(envMap, intensity);
	}

	clear() {
		console.info("Model " + this.name + " : clearing model...");
		this._name = "";
		this._directoryPath = "";
		this._geometryDirectories = "";
		this._root = null;

		// Create a new group.
		this._sceneNode = new THREE.Group();

		// Scale the view (why? to make the model smaller?).
		this._sceneNode.scale.set(0.01, 0.01, 0.01);

		// Rotate the scene around y.
		this._sceneNode.rotation.y = Math.PI;

		console.info("Model " + this.name + " : model cleared.");
	}

	traverse(callback) {
		this._root.traverse(callback);
	}
}

module.exports = Model;
