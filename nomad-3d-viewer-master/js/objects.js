const THREE = require('three');
const fs = require('fs');

const path = require('path');
const Detector = require('./utils/detector.js');
const collision = require("./collision.js");

const System = new THREE.Vector3(1, -1, -1);

if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
}

const Swal = require('sweetalert2');
const OrbitControls = require('three-orbitcontrols');
const TransformControls = require('three-transformcontrols');;
const dat = require('dat.gui');
const Importer = require('./n3d/io/importer.js');
const config = require('./config.js');
const Lights = require('./lights.js');

class Objects {
	constructor() {
		this._model = null;
		this._currentObject = -1;
		this._objects = []; //keeps the objects
		this._controllableObjects = []; //keeps objects names
		this._objectsFolders = []; // keeps object folders to remove or add gui componants into the folder
		this._objectsParams = []; 
		this._options = {};
		this._objectsCenter = [];
		this._objectsTransforms = null;
		this._objectDropOptions = [];
		this._positioning = [];
		this._objectsFallDirection= [];
		this._directions = ['Rx+', 'Rx-', 'Gy+', 'Gy-', 'Bz+', 'Bz-'];
		this._objectsGui = null;
		this._objectsFolder = null;
		this._objectsSceneNodeMap = {};
		this._directionIndex = 0;
		this._sceneCenter = null;
		this.renderer = null;
		this._tempId = null;
		config.positioningCorrection == undefined ?  
			this._positioningCorrection = false : 
			this._positioningCorrection = config.positioningCorrection;
		this._movingObjectIndex = null;
		this._collisions = collision;
		this._objectIdGenerator = 0;
		this._lastTransformation = null;
		this._transformationFolders = {};
		this._effectController = {
			objectSelector: this._currentObject,
			"Direction" : this._directionIndex,
			Movement: ["Rotate", "Translate"]
		};
		if (config.collisionDetection) {
			let Nomad3DCollisions = require('./n3d/link/nomad-3d-collisions');
			this._collisionDetection = new Nomad3DCollisions();
		}
	}

	get model() {
		return this._model;
	}

	get objects() {
		return this._objects;
	}

	get positioning() {
		return this._positioning;
	}

	get objectsCenter() {
		return this._objectsCenter;
	}

	get objectsFallDirection(){
		return this._objectsFallDirection;
	}

	get moveObjectIndex(){
		return this._movingObjectIndex;
	}

	/**
	 * this method initialises the main object of the scene;
		the main object can not be moved nor removed 
	 * @param {ThreeJS center} sceneCenter 
	 * @return {ThreeJs renderer} The configuration by name.
	 */
	initModel(sceneCenter, renderer, camera) {
		// all objects including the main model will be  attached to the scene center
		this._sceneCenter = sceneCenter;
		this._renderer = renderer;
		// Model
		this._objectsTransforms = new TransformControls(camera, this._renderer.domElement); // one control unit will be used for all objects 
		this._objectsTransforms.addEventListener('dragging-changed', function (event) {
			orbit.enabled = !event.value;
		});
		let importer = new Importer();
		importer.read(config.absoluteModelPath);
		this._model = importer.model;
		this._model.setEnvMap(this._textureCube);
		// Initial position to center the instrument.
		
		this.updateObjectsSceneNodeMap(this._model.sceneNodeMap, this._objectIdGenerator);
		this._collisions.setSceneNodeMap(this._objectsSceneNodeMap);
		this._objectIdGenerator += 1; // main model has 0 as an ID, we increase it for up comming objects 
		
		sceneCenter.add(this._model.sceneNode);
	}

	/******
	 *  this function is used to init all objects to be added with the main model
	 ******/
	initObjects(gui) {
		this._objectsGui = gui;
		for (let i = 0; i < config.objects.length; i++) {
			this.addObject(config.objects[i].dirPath, config.objects[i].modelName, config.objects[i].name, i);
		}
	}


	/***
		this method is used to add a point light and all its parameters
	***/
	addObject(dirPath, modelName, name, index) {
		let importer = new Importer();
		let center = new THREE.Group(); // adding a center makes it easier to move the object arround
		let objectPath = path.join(dirPath, modelName)
		let objectID = null;

		importer.read(objectPath); // reading object and loading it 
		importer.model.setEnvMap(this._textureCube); 
		center.add(importer.model.sceneNode); // attaching model to center 
		this._objectsCenter.push(center); // we save the center by index to get access to it later 
		this._objectsCenter[index].visible = config.objects[index].visible; // configuring object visibility
		// checking if object is visible
		if (config.objects[index].visible) {
			this._sceneCenter.add(this._objectsCenter[index]); // we add it to the scene
			if (this._collisionDetection != undefined) {
				objectID = this._collisionDetection.addObject(dirPath, modelName); // if we have collision we add it to bullet
			}
		}
		//this._scene.add(this._objectsCenter[index]); // we do not add objects to the scene but they are still imported and attached to their centers
		// keeps track of object's visibility
		this._objectsParams.push({
			Visible: this._objectsCenter[index].visible,
		})

		// startMatrix will helps up define the transormation applied to the object after adding it to the scnene
		let startMatrix = new THREE.Matrix4()
		startMatrix.set(1, 0, 0, center.position.x, 0, 1, 0, center.position.y, 0, 0, 1, center.position.z, 0, 0, 0, 1) // object's transform matrice from scene center (0, 0, 0)
		// we keep all objeccts important details 
		this._objects.push({
			"model": importer.model,
			"id": objectID,
			"visible": config.objects[index].visible,
			"position": config.objects[index].position,
			"rotation": config.objects[index].rotation,
			"dirPath": dirPath,
			"modelName": modelName,
			"name" : name,
			matrixHistory: [startMatrix]
		});
		this.loadSavedSettings(index); // this loads trasformation applieded previously to the objects and had been saved
		if (objectID == null)
			this.updateObjectsSceneNodeMap(importer.model.sceneNodeMap, this._objectIdGenerator); // we update the scene node map to keep track of components 
		else
			this.updateObjectsSceneNodeMap(importer.model.sceneNodeMap, objectID); // in case  the object alredy had an ID
		this._controllableObjects.push((index + 1) + ": " + this._objects[index].name); // this keeps name of folders
		this._currentObject = index; // VERY IMPORTANT INDEX, this keeps the index of the current CONTROLLED object
		this._movingObjectIndex = index; // keeps track (by index) of moving objects
		this.changeControlledObject(this._currentObject); // gives control to current object if possible
		this._collisions.setSceneNodeMap(this._objectsSceneNodeMap); // w set the scene node map of collisions (very usefull to store LOD and highlight colliding objects)
		this._objectIdGenerator += 1;//increasing ID
		this._objectsFallDirection.push('Gy-');
		this._positioning.push(false) // will keep a boolean to indicate if object is falling or not
		/***** DEBUG *****/
		//console.log(importer.model)

	}

	/****
	 *  this function will load object'sconfiguration and transformation and applie it to it
	 ****/
	loadSavedSettings(index) {
		if (config.objects[index]['transformationElements'] == [] || config.objects[index]['transformationElements'] == undefined) {
			console.log("No saved positions found")
			config.objects[index]['transformationElements'] = [];
			return;
		}
		let transformationMatrix = this.createMatrixFromElements(config.objects[index]['transformationElements'], index); // creating transformation matrix
		this._objectsCenter[index].applyMatrix(transformationMatrix); // applying it to object
	}

	/**
	 *  this fucntion creats a transformation matrix from an array containing all coefficients of a matrix 4*4 
	 */
	createMatrixFromElements(elements) {
		let matrix = new THREE.Matrix4();

		// Create the matrix using fromArray to load the elements in a column-major format.
		matrix.fromArray(elements);

		return matrix;
	}

	/***
	this method is used to :
		- export exsiting objects positions to config file
	***/
	objectsExport() {
		// we read the file and store its content
		fs.readFile(config.configPath, 'utf8', ((err, data) => {
			if (err) {
				console.log(err);
			} else {
				let parsedData = JSON.parse(data); //now it an object

				for (let i = 0; i < parsedData['objects'].length; i++) {
					parsedData['objects'][i]['visible'] = this._objects[i]["visible"]; // save visibility 

					// Us toArray to save the elements in a column-major format.
					parsedData['objects'][i]['transformationElements'] = this._objects[i].matrixHistory[1].toArray();
				}
				console.log(parsedData)
				let json = JSON.stringify(parsedData, undefined, 2); //convert it back to json
				fs.writeFileSync(config.configPath, json, 'utf8'); // write it back
				console.log("objects state is saved");
			}
		}).bind(this));
	}

	/**
	 * This object updates/copies the scene node Map of an object
	 */
	updateObjectsSceneNodeMap(sceneNodeMap, objectId) {

		this._objectsSceneNodeMap[objectId] = {}
		for (let key in sceneNodeMap) {
			this._objectsSceneNodeMap[objectId][key] = sceneNodeMap[key]
		}

	}
	/***
	this method finds a visible object to control
	***/
	findObjectToControl(objectIndex) {
		// in case of multiple objects
		if (this.visibleObjectsCount() > 1) {
			// if the chosen object is visibl we give it control
			if (this._objectsCenter[objectIndex].visible) {
				this._currentObject = objectIndex; // make it current object
				this._movingObjectIndex = objectIndex; // making a possible moving object
				this._objectsTransforms.detach(); // we detach axis from previous object
				this._objectsTransforms.attach(this._objectsCenter[objectIndex]); //attach it to our new object
				this._sceneCenter.add(this._objectsTransforms); // we add the axis to the scene
			}
			// if we hide an object  and it had control we find a new visible one
			if (!this._objectsCenter[objectIndex].visible && this._objectsTransforms.object == this._objectsCenter[objectIndex]) {
				this.controlVisibleObject(); // looks for an other object to control
			}
		}
		// in case of only one object or no object
		else {
			if (this.visibleObjectsCount() == 0) {
				this._objectsTransforms.detach(); // in case there is no objects
			}

			else {
				this.controlVisibleObject(); // in case of one object
			}

		}
	}



	/***
	this method helps to find a visible objec to control
	***/
	controlVisibleObject() {
		for (let i = 0; i < this._objectsCenter.length; i++) { // we go through all objects
			if (this._objectsCenter[i].visible) { // check there visibility, if a parents is not visible then all it's leafs aren't too
				this._currentObject = i;
				this._movingObjectIndex = i;
				this._objectsTransforms.detach();
				this._objectsTransforms.attach(this._objectsCenter[i]);
				return;
			}
		}
		this._sceneCenter.remove(this._objectsTransforms); // if we don't find an object to control we remove the axis from the scene
		return;
	}

	/***
		this method gives controll to a specifique object
	***/
	changeControlledObject(objectIndex) {
		//in case of a wrong index
		if (objectIndex >= this._objectsCenter.length || objectIndex < 0) {
			console.error("light index error");
			return;
		}
		// we detach the current object if it's not the only one
		if (objectIndex != 0)
			this._objectsTransforms.detach(this._objectsCenter[this._currentObject]);
		this._currentObject = objectIndex;
		this._movingObjectIndex = objectIndex;
		if(this._objectsCenter[this._currentObject].visible)
		   this._objectsTransforms.attach(this._objectsCenter[this._currentObject]);
		this._sceneCenter.add(this._objectsTransforms);
	}

/********** UNUSED 
 * 
	/// this method gives control of the object of choice and creates a picker

	currentObjectpicker(folder) {
		if (this._objects.length > 0) {
			if (this._objectPicker != null) {
				folder.remove(this._objectPicker);
			}
		}
		this._objectPicker = folder.add(this._effectController, 'objectSelector', this._controllableObjects).setValue(this._controllableObjects[this._currentObject]).onChange(() => {
			if (this._objectsCenter[this._controllableObjects.indexOf(this._effectController.objectSelector)].visible) {
				//this.updatePosition(this._currentObject);
				console.log("changed object to control")
				this.changeControlledObject(this._controllableObjects.indexOf(this._effectController.objectSelector));
			}
		});
		if (this._objects.length == 0) {
			folder.remove(this._objectPicker);
		}

	}
********************/

	/**
	 * this function is used to update all objects transformation
	 */
	updateObjects() {
		for (let i = 0; i < this._objectsCenter.length; i++) {
			this.updateObject(i);
		}
	}

	eulerToDegree(euler){
		return euler *180/Math.PI;
	}

	degreeToEuler(degree){
		return degree*Math.PI/180;
	}

	/**
	 * this functuion is used to store object's transformation  
	 */
	updateObject(index) {
		// the first matrice is the one used to place the onbject at frst in the scene, from there we strore a second 
		// matrix that keeps further transformations (we keeps ONLY two matrix, and update the second one while the first one remains untouched)
		if (this._objects[index].matrixHistory.length >= 2) {
			this._lastTransformation = this._objects[index].matrixHistory[1]
			this._objects[index].matrixHistory.pop();
		}
		this._objects[index].matrixHistory.push(this.objectsCenter[index].matrix);
		// we store transformation values
		this._objectDropOptions[index].rotationX = this.eulerToDegree(this._objectsCenter[index].rotation.x);
		this._objectDropOptions[index].rotationY = this.eulerToDegree(this._objectsCenter[index].rotation.y);
		this._objectDropOptions[index].rotationZ = this.eulerToDegree(this._objectsCenter[index].rotation.z);

		this._objectDropOptions[index].translationX = this._objectsCenter[index].position.x;
		this._objectDropOptions[index].translationY = this._objectsCenter[index].position.y;
		this._objectDropOptions[index].translationZ = this._objectsCenter[index].position.z;

		// Move the object. First get the transform matrix.
		let M = this._objects[index].matrixHistory[1].elements;
		
		// We need to apply a correction to the matrix.
		// We need to scale the position (a 0.01 scale is applied to the model root scene node).
		// Moreover the x and z coordinates have to be inverted, as well as the x and z angles in the rotation matrix.
		// The -1 product do that. Why do we need to do it ? That should mean that the node from which we took the matrix is "reverted".
		// That remains a mystery.
		if(this._collisionDetection != undefined)
			this._collisionDetection.moveObject(this._objects[index].id,
				M[0], -M[1], M[2],
				-M[4], M[5], -M[6],
				M[8], -M[9], M[10],
				-M[12] * 100, M[13] * 100, -M[14] * 100)
	}

	// counting visible objects and used to find object to control
	visibleObjectsCount() {
		let count = 0;
		for (let i = 0; i < this._objectsCenter.length; i++) {
			if (this._objectsCenter[i].visible)
				count++
		}
		return count;
	}


	/***
	this method checks if the object control panel and the gui panel is closed or opened in order to show or hide axes for objects
	***/
	updateObjectsControls() {
		if (this._objectsCenter.length > 0) {
			let firsCondition = this._objectsFolder.closed;
			let secondCondition = this._objectsGui.closed;
			if (firsCondition || secondCondition) {
				this._objectsTransforms.detach()
				this._sceneCenter.remove(this._objectsTransforms);
			}
			else {
				if (this.visibleObjectsCount() > 0) {
					this._objectsTransforms.attach(this._objectsCenter[this._currentObject])
					this._sceneCenter.add(this._objectsTransforms);
				}
			}

		}

	}

	/**
	 * strop all objects frm free positioning
	 */
	resetPositioning(exceptionIndex = -1){
		for(let i = 0; i< this._positioning.length; i++){
			if(i != exceptionIndex)	
				this._positioning[i] = false;
		}
	}

	// checks if an object is being freely moved
	isObjectFalling(commands, objectIndex) {
		let exists = false;
		for (let i = 0; i < commands.length; i++) {
			commands[i].index == objectIndex ? exists = true : null;
		}
		return exists;
	}

	

	/// wreating a positioning folder to keep track of each object's positions hile moving them 
	createTransformationFolder(index) {
		// creating the folder 
		if(this._transformationFolders[index] == undefined){
			this._transformationFolders[index] = {};
			this._transformationFolders[index].folder = this._objectsFolders[index].addFolder("Positioning");
		}
		// adding a direction selector
		this._transformationFolders[index].folder.add(this._effectController, 'Direction', this._directions).setValue("Gy-").onChange((val) => {
			console.log(val);
			this._objectsFallDirection[index] = val;
			console.log(this._objectsFallDirection)
		});
		// start stop positioning button
		this._transformationFolders[index].folder.add(this._objectDropOptions[index], "Start/Stop");
		// reset button
		this._transformationFolders[index].folder.add(this._objectDropOptions[index], "Reset");
		
		let transformationParams = []
		
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], "rotationX").step(0.1).onChange((value) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].rotation.x = this.degreeToEuler(value)}).listen());
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], 'rotationY').step(0.1).onChange((value) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].rotation.y = this.degreeToEuler(value)}).listen());
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], 'rotationZ').step(0.1).onChange((value) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].rotation.z = this.degreeToEuler(value)}).listen());
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], 'translationX').step(0.01).onChange((valX) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].position.x = valX}).listen());
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], 'translationY').step(0.01).onChange((valY) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].position.y = valY}).listen());
		transformationParams.push(this._transformationFolders[index].folder.add(this._objectDropOptions[index], 'translationZ').step(0.01).onChange((valZ) => { this.resetPositioning(); this._movingObjectIndex = index;  this._objectsCenter[index].position.z	= valZ}).listen());
		
		this._transformationFolders[index].transformationParams = transformationParams;

	}

	/**
	 * moves object in the opposite current direction until it's clear from collision
	 */
	clearObjectFromCollision(index){
		let resetDirection = this._objectsFallDirection[index][0];
		if(this._objectsFallDirection[index][1] == "-"){
			this._objectsCenter[index].position[resetDirection] += 0.005
		}
		else{
			this._objectsCenter[index].position[resetDirection] -= 0.001
		}	
	}
	
	// checks by ID if an object is in collision
	isObjectInCollision(collisions){

		if (this._movingObjectIndex === null) {
			return false;
		}

		//console.log(collisions)
		for(let i = 0; i<collisions.length; i++){
			if (this._objects[this._movingObjectIndex].id == collisions[i].objectIdA || this._objects[this._movingObjectIndex].id == collisions[i].objectIdB){
				
				return true;
			}
		}

		return false;
	}
	
	// updates positioning status 
	updatePositioning(collisions){
		if(this.isObjectInCollision(collisions)){ /// as soon as an object is in collsion
			this._positioning[this.moveObjectIndex] = false; // we no longer can free position it 
			if(this._positioningCorrection) // if position correction is enabled 
				this.clearObjectFromCollision(this.moveObjectIndex) // positioning correction is applied
		}
	}
	
	/**
	 * this function opens a folder and closes all others
	 */
	controlFolders(indexFolderToOpen){
		for(let i = 0; i < this._objectsFolders.length; i++){
			this._objectsFolders[i].close()
		}
		this._objectsFolders[indexFolderToOpen].open()
		this._currentObject = indexFolderToOpen;
	}

	/**
	 * this function gives control to object with newly opened folder
	 */
	checkFolders(){
		for(let i = 0; i < this._objectsFolders.length; i++){
			if(!this._objectsFolders[i].closed && this._currentObject != i){ // if a new folde ris opened 
				this.controlFolders(i); // we give control to it's object
			}
			
		}
	}

	/*
	* this creats the objects GUI
	*/
	initObjectsGui() {
		//  creating an objects folder
		this._objectsFolder = this._objectsGui.addFolder("Objects");
		// save function
		let saveFunction = {
			"Save": (() => { this.objectsExport() }).bind(this)
		}
		// correction toggle 
		let toggleCorrection = {
			"Correction" : this._positioningCorrection
		}
		// adding save button 
		this._objectsFolder.add(saveFunction, "Save");
		// adding correction ticker
		this._objectsFolder.add(toggleCorrection, "Correction").setValue(this._positioningCorrection).onChange((val)=>{
			this._positioningCorrection = val;
			console.log(this._positioningCorrection)
		});
		// creating a folder per object
		for (let i = 0; i < this._objects.length; i++) {
			this._objectDropOptions.push({
				// free positioning button function
				'Start/Stop': () => {
					if(this._objectsCenter[i].visible){
						this.resetPositioning(i)
						this._movingObjectIndex = i;
						this._positioning[i] = !this._positioning[i];
					}
				},
				// reset button function
				'Reset': () => {
					this._positioning[i] = false;
					this._objectsCenter[i].position.x = config.objects[i].position.x;
					this._objectsCenter[i].position.y = config.objects[i].position.y;
					this._objectsCenter[i].position.z = config.objects[i].position.z;
					this._objectsCenter[i].rotation.x = 0;
					this._objectsCenter[i].rotation.y = 0;
					this._objectsCenter[i].rotation.z = 0;
				},
				// transformation value
				'rotationX': 0,
				'rotationY': 0,
				'rotationZ': 0,
				'translationX': 0,
				'translationY': 0,
				'translationZ': 0

			})
			// creating the folder by name and adding it
			this._objectsFolders.push(this._objectsFolder.addFolder((i + 1) + ": " + this._objects[i].name));
			
			// if(this._objectsFolders[0].__folders.Positioning != undefined)
			// this._objectsFolders[0].__folders.Positioning.open()
			//adding visibility
			this._objectsFolders[i].add(this._objectsParams[i], 'Visible').setValue(this._objectsCenter[i].visible).onChange((() => {
				//this._objectsCenter[i].visible ? this._scene.remove(this._objectsCenter[i]) : this._scene.add(this._objectsCenter[i]);
				if (this._objectsCenter[i].visible) {
					this._sceneCenter.remove(this._objectsCenter[i]);
					this._objectsTransforms.detach()
					this._sceneCenter.remove(this._objectsTransforms);
					if (this._collisionDetection != undefined)
						this._collisionDetection.removeObject(this._objects[i].id);
				}
				else {
					this._sceneCenter.add(this._objectsCenter[i]);
					if (this._collisionDetection != undefined)
						this._objects[i].id = this._collisionDetection.addObject(this._objects[i].dirPath, this._objects[i].modelName);
				}
				this._objectsCenter[i].visible = !this._objectsCenter[i].visible;
				this.findObjectToControl(i);
			}).bind(i));
			this.createTransformationFolder(i);
		}
		// adding type of movement control
		this._objectsFolder.add(this._effectController, 'Movement', this._effectController.Movement).setValue("Translate").onChange(() => {
			if(this._effectController.Movement == "Translate") // tansform control doesn't understand Translate with uppercase
				this._objectsTransforms.setMode("translate");
			if(this._effectController.Movement == "Rotate")
				this._objectsTransforms.setMode("rotate");
		});

		// Open last object.
		if (this._objectsFolders.length > 0) {
			this._objectsFolders[this._objectsFolders.length - 1].open()
			this.changeControlledObject(this._objectsFolders.length - 1) // we give control to latest object added
		}

		// this.currentObjectpicker(this._objectsFolder);
	}

	






}

module.exports = Objects;

