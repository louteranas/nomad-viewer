/**
 *
 * @class Component
 */
const THREE = require('three');
const path = require('path');
const LoadedComponents = require('./loaded-components');
const exportSTL = require('threejs-export-stl');
const fs = require('fs');
let Buffer = require('buffer/').Buffer
const bufferToArrayBuffer = require('buffer-to-arraybuffer');
let STLLoader = require('three-stl-loader')(THREE)
/**
 * Default material of a component : gray metal.
 */
let DefaultMaterial = new THREE.MeshStandardMaterial();
DefaultMaterial.color = new THREE.Color(0.8, 0.8, 0.8);
DefaultMaterial.roughness = 0.6;
DefaultMaterial.metalness = 1.0;

class Component {

	constructor() {
		this._name = "";
		this._fileName = "";
		this._sceneNode = null;
		this._children = [];
		this._parent = null;
		this._axis = null;
		this._configurations = [];
		this._wall = false;
		this._mergeable = false;
		this._controller = null;
		this._animation = Component.Controlled;
		this._material = DefaultMaterial;
		this._boundingBox = null;
		this._sceneNodeMap = {}

		// New members to test transforms
		this._invParentTransform = null;
		this._movementTransform = null;
		this._transform = new THREE.Matrix4();
	}

	// Animation methods
	static get Controlled() {
		return 0;
	}

	static get Simulated() {
		return 1;
	}

	static get Animated() {
		return 2;
	}

	get name() {
		return this._name;
	}

	set name(value) {
		this._name = value;
	}

	get fileName() {
		return this._fileName;
	}

	set fileName(name) {
		this._fileName = name;
	}

	get sceneNode() {
		return this._sceneNode;
	}

	set sceneNode(node) {
		this._sceneNode = node;
	}

	get children() {
		return this._children;
	}

	set children(value) {
		console.warn("Component.children is a read-only property.");
	}

	get parent() {
		return this._parent;
	}

	set parent(value) {
		console.warn("Component.parent is a read-only property.");
	}

	get axis() {
		return this._axis;
	}

	set axis(axis) {
		console.warn("Component.axis is a read-only property.");
	}

	get configurations() {
		return this._configurations;
	}

	set configurations(value) {
		console.warn("Component.configurations is a read-only property.");
	}

	get wall() {
		return this._wall;
	}

	set wall(value) {
		console.warn("Component.wall is a read-only property.");
	}

	set mergeable(value) {
		console.warn("Component.mergeable is a read-only property.");
	}

	get controller() {
		return this._controller;
	}

	set controller(value) {
		console.warn("Component.controller is a read-only property.");
	}

	get animation() {
		return this._animation;
	}

	set animation(value) {
		this._animation = value;
	}

	get material() {
		return this._material;
	}

	set material(value) {
		console.warn("Component.material is a read-only property.");
	}

	get boundingBox() {
		return this._boundingBox;
	}

	set boundingBox(box) {
		console.warn("Component.boundingBox is a read-only property.");
	}

	addChild(object) {
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) {
				this.addChild(arguments[i]);
			}
			return;
		}
		if (object === this) {
			console.error("Component.addChild: object can't be added as a child of itself.", object);
			return;
		}
		if (object.parent !== null) {
			object.parent.remove(object);
		}
		object._parent = this;
		this._children.push(object);
	}

	removeChild(object) {
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) {
				this.removeChild(arguments[i]);
			}
			return;
		}
		let index = this.children.indexOf(object);
		if (index !== -1) {
			object._parent = null;
			this._children.splice(index, 1);
		}
	}

	addConfiguration(object) {
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) {
				this.addConfiguration(arguments[i]);
			}
			return;
		}
		this._configurations.push(object);
	}

	/**
	 * Gets the configuration by name.
	 * @param {String} configName The configuration name
	 * @return {ConfigParams} The configuration by name.
	 */
	getConfigurationByName(configName) {
		for (let i = 0; i < this.configurations.length; i++) {
			if (this.configurations[i].configuration === configName) {
				return this.configurations[i];
			}
		}
		return null;
	}

	calculateSceneNodeTransform(deltaMovementTransform) {

		// Accumulate the delta movements.
		this._movementTransform.premultiply(deltaMovementTransform);
		// Note that multiply or premultiply provide same results because they are either only rotations around the same axis or only translations on the same axis.

		// Recalculate the scene node transform matrix.
		let localTransform = new THREE.Matrix4();
		localTransform.copy(this._invParentTransform);
		localTransform.multiply(this._movementTransform);
		localTransform.multiply(this._transform);

		// Reset the matrix of the scene node to identity.
		this.sceneNode.matrix.identity();

		// It is necessary to have matrixAutoUpdate of the scene node to false, otherwise calling applyMatrix leads to undefined behaviour.
		this.sceneNode.applyMatrix(localTransform);
	}

	showConfiguration(configName, recursive, parentTransform) {
		configName = (configName === undefined) ? this.configurations[0].configuration : configName;
		recursive = (recursive === undefined) ? true : recursive;
		parentTransform = (parentTransform === undefined) ? new THREE.Matrix4() : parentTransform;

		// Get the first configuration.
		let config = this.configurations[0];

		if (!this.isMergeable()) {
			this._transform = config.transformMatrix();
		}

		this._invParentTransform = new THREE.Matrix4();
		this._invParentTransform.getInverse(parentTransform, true);

		this._movementTransform = new THREE.Matrix4();
		this._movementTransform.identity();

		let deltaMovementTransform = new THREE.Matrix4();
		deltaMovementTransform.identity();

		this.calculateSceneNodeTransform(deltaMovementTransform);

		this.sceneNode.visible = config.visible;

		// Set the initial zero value.
		this.axis.value = -this.axis.zeroValue;

		this.receiveShadow(true, false);
		this.castShadow(true, false);

		// Iterate the children if the component is not mergeable.
		// If the component is mergeable, it means that there it is a leaf scene node.
		if (!this.isMergeable()) {

			if (recursive) {
				for (let i = 0; i < this.children.length; i++) {
					this.children[i].showConfiguration(configName, recursive, this._transform);
				}
			}
		}
	}

	castShadow(onOff, recursive) {
		recursive = (recursive === undefined) ? true : recursive;

		this.sceneNode.castShadow = onOff;
		if (this.isMergeable()) {
			for (let i = 0; i < this.sceneNode.levels.length; i++) {
				this.sceneNode.levels[i].object.castShadow = onOff;
			}
		}
		else {
			if (recursive) {
				for (let i = 0; i < this.children.length; i++) {
					this.children[i].castShadow(onOff, recursive);
				}
			}
		}
	}

	receiveShadow(onOff, recursive) {
		recursive = (recursive === undefined) ? true : recursive;

		this.sceneNode.receiveShadow = onOff;
		if (this.isMergeable()) {
			for (let i = 0; i < this.sceneNode.levels.length; i++) {
				this.sceneNode.levels[i].object.receiveShadow = onOff;
			}
		}
		else {
			if (recursive) {
				for (let i = 0; i < this.children.length; i++) {
					this.children[i].receiveShadow(onOff, recursive);
				}
			}
		}
	}

	isLeaf() {
		return (this.children.length === 0);
	}

	isRoot() {
		return (this.parent === null);
	}

	isMergeable() {
		return this._mergeable;
	}

	/**
	 * loads the objects on the scene and calls merge function to optimize performance
	 * @param {Model} model  
	 * @param {Loader} loadee 
	 */
	loadGeometries(model, loader) {

		// Check if the component is mergeable.
		if (this.isMergeable()) {

			// Create a new scene node.
			this.sceneNode = new THREE.LOD();

			// It is necessary to set matrixAutoUpdate to false, otherwise when calling applyMatrix after resetting the matrix to identity leads to undefined behaviour.
			this.sceneNode.matrixAutoUpdate = false;

			// Start the recursion for merging component geometries.
			let loadedComponents = new LoadedComponents(this, model);

			//loading géometries
			//case 1 : cache exists
			if (this.geomCacheExists(model, loadedComponents)) {
				let promise = new Promise((resolve) => {
					// we make sure that all materials are loaded in order to proceed
					let map = this.materialsCacheLoader(this, model, loadedComponents);
					resolve(map);
				});
				promise.then((map) => {
					// once materials are loaded we can now load cached geometries and affect
					// the loaded materials
					this.cacheLoader(model, loadedComponents);
				});
			}
			// case 2: cache does not exist 
			else {
				let promise = new Promise((resolve) => {
					// we merge geometries first to get all materials ready
					this.mergeGeometries(model, loader, loadedComponents);
					resolve();
				});
				promise.then(() => {
					// once the objects are optimized and merge we export only the necessary
					// materials to avoid redundancy of equals materials
					this.materialsCacheExport(this, model, loadedComponents);
				});
			}
			

		}
		else {
			// Create a simple group.
			this.sceneNode = new THREE.Group();

			// It is necessary to set matrixAutoUpdate to false, otherwise when calling applyMatrix after resetting the matrix to identity leads to undefined behaviour.
			this.sceneNode.matrixAutoUpdate = false;

			// Iterate the children.
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].loadGeometries(model, loader);
				this.sceneNode.add(this.children[i].sceneNode);
			}
		}

		// Set the name of the scene node.
		this.sceneNode.name = this.name;
	}

	/**
	 * compares the equality between two material objects
	 * @param {Material 1} material1  
	 * @param {Material 2} material2
	 */
	isMaterialsEqual(material1, material2) {
		let equal = true;
		equal = equal && material1.opacity == material2.opacity;
		equal = equal && material1.transparent == material2.transparent;
		equal = equal && material1.color.equals(material2.color);
		equal = equal && material1.metalness == material2.metalness;
		return equal;
	}

	/**
	 * filters materials into equivalence classes to avoid redundancies
	 * @param {Materials} materials
	 */
	materialsMapping(materials) {
		let materialsMap = { 0: [0] }; //initialze in case materials.length == 1
		let keyCount = 1; // count of equivalence classes
		for (let i = 1; i < materials.length; i++) {
			let added = false; // checks if material has it's class or not
			for (let key in materialsMap) {
				// if we found a class for the current material
				if (this.isMaterialsEqual(materials[materialsMap[key][0]], materials[i])) {
					materialsMap[key].push(i); // we add it to the definition 
					added = true; // declare adding it
				}
				if (added) {
					break;
				}
			}
			// in case e don't find a class of  equivalence of the material we 
			// create a new one 
			if (!added) {
				materialsMap[keyCount] = [i];
				keyCount++
			}
		}
		return materialsMap;
	}

	/**
	 * Asynchronous function to create files if if they do not exist
	 * @param {Path} path 
	 */
	createPath(path) {
		fs.existsSync(path) ? null : fs.mkdirSync(path);
	}

	/**
	 * Asynchronous function to create cache files if if they do not exist
	 * @param {Model} model 
	 */
	createCacheDirectories(model) {
		let cacheDir = path.join(model.directoryPath, "cache " + model.name);
		this.createPath(cacheDir);
		let matsCacheDir = path.join(cacheDir, "materials");
		this.createPath(matsCacheDir);
		for (let i = 0; i < model.geometryDirectories.length; i++) {
			let cacheLodDir = path.join(cacheDir, model.geometryDirectories[i]);
			this.createPath(cacheLodDir);
		}
	}

	/**
	 * checks if caches exists for a component
	 * @param {Model} model  
	 * @param {LoadedComponents} loadedComponents 
	 */
	geomCacheExists(model, loadedComponents) {
		let exists = true;
		for (let i = 0; i < model.geometryDirectories.length; i++) {
			exists = exists && fs.existsSync(loadedComponents.geomCachePath(i)) &&
				fs.existsSync(loadedComponents.geomCachePath(i)) &&
				fs.existsSync(loadedComponents.geomMaterialsPath);
		}
		return exists;
	}

	/**
	 * load the cache of merged geometries of all the sub-hierarchy.
	 * @param {Model} model 
	 * @param {STLLoader} loader 
	 * @param {LoadedComponents} loadedComponents 
	 */
	cacheLoader(model, loadedComponents) {
		let loader = new STLLoader();
		for (let i = 0; i < model.geometryDirectories.length; i++) {
			// load geometries and their params
			let bufferedData = fs.readFileSync(loadedComponents.geomCachePath(i)); 
			let jsonGeomParams = fs.readFileSync(loadedComponents.geomParamsPath(i));
			
			let promise = new Promise((resolve) => {
				let arrayBuffer = bufferToArrayBuffer(bufferedData); // from binary to array buffer
				let bufferGeometry = loader.parse(arrayBuffer); //we parse the arrayBuffer to get a geometry object
				let geomParams = JSON.parse(jsonGeomParams); // we parse the parametres 
				let geom = { "bufferGeom": bufferGeometry, "params": geomParams };
				resolve(geom);
			});

			promise.then((geom) => {
				// Set the buffer geometry to the scene node once everything is loaded
				geom.bufferGeom.clearGroups();
				for (let g = 0; g < Object.keys(geom.params).length; g++) {
					(geom.bufferGeom).addGroup(geom.params[g].startIndex, geom.params[g].faceCount, geom.params[g].loadedComponent);
				}
				let distance = model.distanceOfLOD(i);
				loadedComponents.component.sceneNode.getObjectForDistance(distance).geometry = geom.bufferGeom;
			})

		}
	}





	/**
	 * load the cache of materials .
	 *  @param {Component} component
	 * @param {Model} model  
	 * @param {LoadedComponents} loadedComponents 
	 */
	materialsCacheLoader(component, model, loadedComponents) {
		console.log("cache found, and is being loaded ...");
		
		let jsonMaterials = fs.readFileSync(loadedComponents.geomMaterialsPath);//load and parse
		let materials = JSON.parse(jsonMaterials);
		
		// create a materials with information parsed
		for (let i = 0; i < Object.keys(materials).length; i++) {
			let material = new THREE.MeshStandardMaterial();
			material.opacity = materials[i].opacity;
			material.transparent = false;
			material.color = new THREE.Color(materials[i].color.r, materials[i].color.g, materials[i].color.b);
			material.roughness = 0.35;   //materials[i].roughness/4; // looks better
			material.metalness = materials[i].metalness / 1.05;
			// adding te material
			for (let j = 0; j < model.geometryDirectories.length; j++) {
				loadedComponents.loaded[j].materials.push(material);
			}
		}

		// Create the mesh.
		for (let i = 0; i < model.geometryDirectories.length; i++) {
			//let mesh = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(), this.material); /*component.material); // */ 
			let mesh = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(), loadedComponents.loaded[i].materials);
			component.sceneNode.addLevel(mesh, model.distanceOfLOD(i));
		}
		// this helps heep track of collisions highlighting and collision state
		model.sceneNodeMapSetter(component.sceneNode, component.name)
	}

	/**
	 * we use the equivalence classes to reduce the materials created/cached and used.
	 *  @param {MaterialsMap} materialsMap  
	 * @param {LoadedComponents} loadedComponents 
	 */
	factorizeMaterials(loadedComponents, materialsMap) {
		let factorizedMaterials = [];
		for (let key in materialsMap) {
			factorizedMaterials.push(loadedComponents.loaded[0].materials[materialsMap[key][0]])
		}
		return factorizedMaterials;
	}

	/**
	 * load calculated materials and export them to cache
	 *  @param {Component} component
	 * @param {Model} model  
	 * @param {LoadedComponents} loadedComponents 
	 */
	materialsCacheExport(component, model, loadedComponents) {
		console.log("No cache found, one will be created. Model loading ...");
		
		// materials are the same for all LODs
		let materialsMap = this.materialsMapping(loadedComponents.loaded[0].materials); // creating equivalence classes
		let factorizedMaterials = this.factorizeMaterials(loadedComponents, materialsMap); // take out redundancy
		let jsonMaterialsMap = JSON.stringify(materialsMap, undefined, 2); 
		fs.writeFileSync(loadedComponents.materialsMapPath, jsonMaterialsMap);
		let materials = {};

		// we can't store materials as object to json, plus it would take too much unnecessary information
		// we only store important informations about the material
		for (let i = 0; i < factorizedMaterials.length; i++) {
			materials[i] = {
				"opacity": factorizedMaterials[i].opacity,
				"transparent": factorizedMaterials[i].opacity,
				"color": {
					"r": factorizedMaterials[i].color.r,
					"g": factorizedMaterials[i].color.g,
					"b": factorizedMaterials[i].color.b
				},
				"roughness": factorizedMaterials[i].roughness,
				"metalness": factorizedMaterials[i].metalness
			}
		}

		// we store the materials
		let jsonMaterials = JSON.stringify(materials, undefined, 2);
		fs.writeFileSync(loadedComponents.geomMaterialsPath, jsonMaterials);
		
		// Create the mesh.
		for (let i = 0; i < model.geometryDirectories.length; i++) {
			//let mesh = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(), this.material) // uses same material for all objects of the scene
			let mesh = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(), factorizedMaterials);
			component.sceneNode.addLevel(mesh, model.distanceOfLOD(i));
		}
	}

	/**
	 * Recursive function for merging the geometries of all the sub-hierarchy.
	 * @param {Model} model 
	 * @param {STLLoader} loader 
	 * @param {LoadedComponents} loadedComponents 
	 */
	mergeGeometries(model, loader, loadedComponents) {

		this.createCacheDirectories(model)
		// Compute the geometries with LODs.
		if (this.isLeaf()) {

			// Iterate the LODs.
			for (let i = 0; i < model.geometryDirectories.length; i++) {

				// Get the index of the geometry that is the current geometries count.
				let index = loadedComponents.loaded[i].geometriesCount;

				// Increase the count for the asynchronous calls.
				loadedComponents.loaded[i].geometriesCount++;
				model.allGeometriesCount++;

				// Get the STL path.
				let dir = path.join(model.directoryPath, model.geometryDirectories[i]);
				let stlPath = path.join(dir, this.fileName + ".STL");

				//console.log(this.name + " loading " + i + " " + loadedComponents.loaded[i].geometriesCount);

				// Asynchronous call.
				loader.load(stlPath, (bufferGeometry) => {
					// Apply the config transform to the buffer geometry.
					let transform = this.configurations[0].transformMatrix();

					// Transform the geometry coordinates into the root frame so that all the geometries can be merged.
					bufferGeometry.applyMatrix(transform);

					//console.log(this.name + " loaded " + i + " " + loadedComponents.loaded[i].loadedGeometriesCount);

					// Store the index.
					loadedComponents.loaded[i].index.push(index)

					// Increase the loaded geometries count.
					loadedComponents.loaded[i].loadedGeometriesCount++;
					model.allLoadedGeometriesCount++;

					// Store the geometry.
					loadedComponents.loaded[i].geometries.push(bufferGeometry);

					// Check if all the component geometries are loaded.
					if (loadedComponents.loaded[i].loadedGeometriesCount === loadedComponents.loaded[i].geometriesCount) {

						// once all materials are loaded we are in the last callback and all materials are already loaded
						let materialsMap = this.materialsMapping(loadedComponents.loaded[i].materials);
						let geometries = []; // reOrgnised geometries by material equality criteria
						let facesCount = []; // faceCount for merged groups with same material
						let groupMatsIndexs = []; //index in material array for each group 
						for (let key in materialsMap) {
							facesCount.push(0);
							groupMatsIndexs.push(materialsMap[key][0]) // we keep the the first material index each time
							for (let j = 0; j < materialsMap[key].length; j++) {
								geometries.push(loadedComponents.loaded[i].geometries[loadedComponents.loaded[i].index.indexOf(materialsMap[key][j])]); // re organizing materials
								let temporaryGeometry = new THREE.Geometry().fromBufferGeometry(geometries[geometries.length - 1]); // this temporaryGeometry is used to coiunt faces for each geometry
								facesCount[facesCount.length - 1] += temporaryGeometry.faces.length;
							}
						}

						// Create a temporary Geometry object to merge the geometries.
						// The BufferGeometry merge function does not support indexed geometries, so we need to use a temporary Geometry object for merge is working.
						// https://stackoverflow.com/questions/36450612/how-to-merge-two-buffergeometries-in-one-buffergeometry-in-three-js
						let geometry = new THREE.Geometry().fromBufferGeometry(geometries[0]);						
						for (let g = 1; g < geometries.length; g++) {
							// Create the Geometry and merge it to the first geometry.
							let geometryToMerge = new THREE.Geometry().fromBufferGeometry(geometries[g]);
							geometry.merge(geometryToMerge);
						}
						geometry.mergeVertices();
						//geometry.computeVertexNormals();

						// Start index for the geometry groups.
						let startIndex = 0;

						// Recreate the BufferGeometry from the merged Geometry objects.
						bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry);

						// Associate the materials. First clear the groups.
						bufferGeometry.clearGroups();

						// Iterate the geometries.
						let groupParams = {}; //keeps group parameters for cache use
						for (let g = 0; g < facesCount.length; g++) {
							// Add a group. Faces count is multiplied by 3 because we must pass the number of indexes (3 per triangle).
							// We find the material index thanks to the calculated map.
							bufferGeometry.addGroup(startIndex, facesCount[g] * 3, g);
							groupParams[g] = {
								"startIndex": startIndex,
								"faceCount": facesCount[g] * 3, // we keep all face count (NB: we keep vertecies and not face its why we have the factor 3)
								"loadedComponent": g

							}
							// Increase the start index.
							startIndex += facesCount[g] * 3;
						}

						// creating cache stl files
						this.createPath(loadedComponents.geomFolderCachePath(i));
						// we create the json to store 
						let jsongroupParams = JSON.stringify(groupParams, undefined, 2);
						fs.writeFileSync(loadedComponents.geomParamsPath(i), jsongroupParams);
						// we export the bufferGeometry to STL(binary format) in order to use the least space possible
						let buffer = exportSTL.fromGeometry(bufferGeometry);
						const geomBuf = Buffer(buffer, 'binary'); // make a writable binary buffer
						fs.writeFileSync(loadedComponents.geomCachePath(i), geomBuf, function (err) { console.error(err) });// write buffer in file



						// Set the buffer geometry to the scene node.
						let distance = model.distanceOfLOD(i);
						loadedComponents.component.sceneNode.getObjectForDistance(distance).geometry = bufferGeometry;
						//console.log(loadedComponents.component.name + " merged " + i);
					}

					// Force the update of the model when all the geometries have been loaded and merged.
					if (model.allLoadedGeometriesCount === model.allGeometriesCount) {
						model.needsUpdate = true;

						console.log("Geometries loaded and merged");
					}

				}, undefined, () => {
					console.error("Unable to load file " + stlPath);
				});



				// Store the material.
				loadedComponents.loaded[i].materials.push(this.material);

			}
		}
		else {
			// Iterate the children.
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].mergeGeometries(model, loader, loadedComponents);
			}
		}
	}

	setEnvMap(envMap, intensity) {
		intensity = (intensity === undefined) ? 0.5 : intensity;

		this.material.envMap = envMap;
		this.material.envMapIntensity = intensity;
		this.material.needsUpdate = true;

		// Children
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].setEnvMap(envMap, intensity);
		}
	}

	setMap(map, recursive) {
		recursive = (recursive === undefined) ? false : recursive;

		this.material.map = map;
		this.material.needsUpdate = true;

		if (recursive) {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].setMap(map, recursive);
			}
		}
	}

	setNormalMap(normalMap, recursive) {
		recursive = (recursive === undefined) ? false : recursive;

		this.material.normalMap = normalMap;
		this.material.needsUpdate = true;

		if (recursive) {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].setNormalMap(normalMap, recursive);
			}
		}
	}

	updateLODDistances(model) {
		if (this.isMergeable()) {
			for (let i = 0; i < this._sceneNode.levels.length; i++) {
				this._sceneNode.levels[i].distance = model.distanceOfLOD(i);
			}
		} else {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].updateLODDistances(model);
			}
		}
	}

	updateWallOpacity(opacity) {
		if (this.wall) {
			this.material.opacity = opacity;
			this.material.transparent = (Math.abs(this.material.opacity - 1.0) > Number.EPSILON);

			let shadowsOff = (Math.abs(this.material.opacity) < Number.EPSILON);
			this.castShadow(!shadowsOff, false);
		}

		// Iterate the children if the component is not mergeable.
		if (!this.isMergeable()) {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].updateWallOpacity(opacity);
			}
		}
	}

	updateWallVisibility(visible, configName) {
		let config = this.getConfigurationByName(configName);
		// console.info(this.name, configName, config);
		if (this.wall) {
			this.sceneNode.visible = visible && config.visible;
		}

		// Iterate the children if the component is not mergeable.
		if (!this.isMergeable()) {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].updateWallVisibility(visible, configName);
			}
		}
	}

	init(positions) {

		if (this.controller !== null) {
			if (positions !== null) {
				this.controller.init(positions[this.controller.name]);
			}
			else {
				this.controller.init(0);
			}
		}

		// Children
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].init(positions);
		}
	}

	update(camera, positions) {

		// Levels of detail
		if (this.isMergeable() && camera !== undefined) {
			this._sceneNode.update(camera);
		}

		// Controller.
		if (this.controller !== null && positions !== null) {
			this.controller.update(positions[this.controller.name]);
		}

		// Iterate the children if the component is not mergeable.
		if (!this.isMergeable()) {
			for (let i = 0; i < this.children.length; i++) {
				this.children[i].update(camera, positions);
			}
		}
	}

	traverse(callback) {
		callback(this);
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].traverse(callback);
		}
	}
}

module.exports = Component;
