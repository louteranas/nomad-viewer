/**
 * Class handling Nomad 3D models imports.
 * @class Importer
 */

const fs = require('fs');
const parser = require('fast-xml-parser');
const he = require('he');
const path = require('path');
const THREE = require('three');

const Axis = require('../model/axis.js');
const Component = require('../model/component.js');
const ConfigParams = require('../model/config-params.js');
const Model = require('../model/model.js');
const Nomad3DController = require('../link/nomad-3d-controller.js');
const config = require('../../config');

/**
 * System conversion between JavaFX and three.js
 * @type {THREE.Vector3}
 */
const System = new THREE.Vector3(1, -1, -1);

class Importer {

	/**
	 * Default constructor.
	 * @constructor
	 */
	constructor() {
		this._model = new Model();
	}

	/** @property {Model} model Model stored during the last import. Read-only. */
	get model() {
		return this._model;
	}

	set model(value) {
		console.warn("Importer.model is a read-only property.");
	}

	/**
	 * Reads a model. The model is stored in the model attribute of the importer.
	 * @param {String} xmlPath Path of the XML file
	 */
	read(xmlPath) {
		console.info("Reading file : " + xmlPath);

		let readTimer = new THREE.Clock();
		readTimer.start();

		this.clear();

		let xmlFile = fs.readFileSync(xmlPath, 'utf8');
		const options = {
			attrPrefix: "@_",
			textNodeName: "#text",
			ignoreAttributes: false,
			ignoreNonTextNodeAttr: false, // must be false
			ignoreTextNodeAttr: false, // must be false
			ignoreNameSpace: false,
			textNodeConversion: false, // must be false
			attrValueProcessor: a => he.decode(a, { isAttributeValue: true }),//default is a=>a
			tagValueProcessor: a => he.decode(a) //default is a=>a
		};
		let doc = parser.parse(xmlFile, options);

		console.info("File " + xmlPath + " read in " + readTimer.getDelta() + "s.", doc);

		let eNomad3D = doc.Nomad3DXML;
		let eRootComponent = eNomad3D.RootComponent;
		let eGeomDirs = eNomad3D.GeometriesDirectories;

		this._model._name = path.basename(xmlPath, ".xml");
		this._model._directoryPath = path.dirname(xmlPath);
		this._model._root = this.readComponent(eRootComponent);
		this._model._geometryDirectories = this.readGeometryDirectories(eGeomDirs);

		// Load geometries & scene graph
		this._model.loadGeometries();

		this._model.init();

		this._model.needsUpdate = true;
		this._model.update();

		// Show the first defined configuration.
		console.log("Importer showConfiguration");
		this._model.showConfiguration();

		console.info("Model " + this.model.name + " read in " +
			readTimer.getElapsedTime() + " s.", this._model);

	}

	/**
	 * Reads a component.
	 * @param {Object} eComponent XML element of the component
	 * @return {Component} Imported component
	 */
	readComponent(eComponent) {
		let comp = new Component();

		// Attributes
		if (eComponent["@_name"] === undefined || eComponent["@_fileName"] === undefined) {
			console.error("No name attribute for the following xml component :\n", eComponent);
			return null;
		}
		comp._name = eComponent["@_name"];
		comp._fileName = eComponent["@_fileName"];
		comp._wall = (eComponent["@_wall"] === "True");
		comp._mergeable = (eComponent["@_mergeable"] === "True");

		// Elements
		if (eComponent.ConfigParams instanceof Array) {
			for (let i = 0; i < eComponent.ConfigParams.length; i++) {
				let config = this.readConfigParams(eComponent.ConfigParams[i], comp);
				comp.addConfiguration(config);
			}
		} else {
			let config = this.readConfigParams(eComponent.ConfigParams, comp);
			comp.addConfiguration(config);
		}

		if (eComponent.ConfigParams.BoundingBox !== undefined) {
			comp._boundingBox = this.readBoundingBox(eComponent.ConfigParams.BoundingBox);
		}

		if (eComponent.Material !== undefined) {
			let material = this.readMaterial(eComponent.Material);
			comp._material = material;
		}

		let axis = this.readAxis(eComponent.Axis);
		comp._axis = axis;

		if (eComponent.Component !== undefined) {
			if (eComponent.Component instanceof Array) {
				for (let i = 0; i < eComponent.Component.length; i++) {
					let childComp = this.readComponent(eComponent.Component[i]);
					if (childComp !== null) {
						comp.addChild(childComp);
					}
				}
			} else {
				let childComp = this.readComponent(eComponent.Component);
				if (childComp !== null) {
					comp.addChild(childComp);
				}
			}
		}

		if (eComponent.Controller !== undefined) {
			let controller = this.readController(eComponent.Controller, comp);
			comp._controller = controller;
		}

		return comp;
	}

	/**
	 * Reads a configuration.
	 * @param {Object} eConfigParams XML element of the configuration
	 * @param {Component} component Owner of the configuration
	 * @return {ConfigParams} Imported configuration
	 */
	readConfigParams(eConfigParams, component) {
		let config = new ConfigParams(component);

		// Attributes
		config._configuration = eConfigParams["@_configuration"];
		config._fixed = (eConfigParams["@_fixed"] === "True");
		config._visible = (eConfigParams["@_visible"] === "True");

		// Elements
		config._axisValue = parseFloat(eConfigParams.AxisValue);
		this.readTransform(eConfigParams.Transform, config);

		return config;
	}

	/**
	 * Reads a transform.
	 * @param {Object} eTransform XML element of the transform
	 * @param {ConfigParams} config Owner of the transform
	 */
	readTransform(eTransform, config) {
		// Elements
		config._rotation.fromArray(this.floatArrayFromString(eTransform.Rotation));

		// Apply a special transform for rotations from JavaFx to Three.js.
		// This is the same transform applied in the Blender script of the converter.
		config._rotation.multiply(new THREE.Matrix3().set(
			System.x, 0, 0,
			0, System.y, 0,
			0, 0, System.z
		)
		);
		config._translation.fromArray(this.floatArrayFromString(eTransform.Translation));
		config._scale = parseFloat(eTransform.Scale);
	}

	/**
	 * Reads a bounding box.
	 * @param {Object} eBoundingBox XML element of the bounding box
	 */
	readBoundingBox(eBoundingBox) {

		let min = new THREE.Vector3();
		min.fromArray(this.floatArrayFromString(eBoundingBox.Min));

		let max = new THREE.Vector3();
		max.fromArray(this.floatArrayFromString(eBoundingBox.Max));

		return new THREE.Box3(min, max);
	}

	/**
	 * Reads a phong material and converts it to PBR.
	 * @param {Object} eMaterial XML element of the material
	 * @return {THREE.MeshStandardMaterial} Imported material
	 */
	readMaterial(eMaterial) {
		let material = new THREE.MeshStandardMaterial();
		//let material = new THREE.MeshLambertMaterial();

		const maxShininess = 250;
		let phongMaterial = this.readPhongMaterial(eMaterial);
		material.opacity = phongMaterial.opacity;
		material.transparent = phongMaterial.transparent;
		material.color.copy(phongMaterial.color);
		material.roughness = 1.0 - Math.min(Math.max(phongMaterial.shininess / maxShininess, 0), 1);
		material.metalness = Math.min(Math.max((new THREE.Vector3()).fromArray(phongMaterial.specular.toArray()).length(), 0), 1);

		return material;
	}

	/**
	 * Reads a phong material.
	 * @param {Object} eMaterial XML element of the material
	 * @return {THREE.MeshPhongMaterial} Imported material
	 */
	readPhongMaterial(eMaterial) {
		let material = new THREE.MeshPhongMaterial();
		let diffuseArray = this.floatArrayFromString(eMaterial.Diffuse);
		let specularArray = this.floatArrayFromString(eMaterial.Specular);
		
		material.color.fromArray(diffuseArray);
		material.specular.fromArray(this.floatArrayFromString(eMaterial.Specular));
		material.shininess = parseFloat(eMaterial.Shininess);
		material.opacity = Math.max(Math.min(diffuseArray[3], 1.0), 0.1);
		material.transparent = (Math.abs(material.opacity - 1.0) > Number.EPSILON);

		return material;
	}

	/**
	 * Reads an axis.
	 * @param {Object} eAxis XML element of the axis
	 * @return {Axis} Imported axis
	 */
	readAxis(eAxis) {
		let axis = new Axis();

		// Attibutes
		axis._type = axis.typeFromString(eAxis["@_type"]);

		// Elements
		axis._direction.fromArray(this.floatArrayFromString(eAxis.Direction)).normalize();
		axis._position.fromArray(this.floatArrayFromString(eAxis.Position));
		axis._minValue = parseFloat("-Infinity");
		axis._maxValue = parseFloat("Infinity");

		// Set the zero value
		axis._zeroValue = parseFloat(eAxis.ZeroValue);

		return axis;
	}

	/**
	 * Reads a controller.
	 * @param {Object} eController XML element of the controller
	 * @param {Component} component Component linked to the controller
	 * @return {Nomad3DController} Imported controller
	 */
	readController(eController, component) {

		if (!config.link) {
			return null;
		}

		let controller = new Nomad3DController();
		controller._component = component;

		// Attibutes
		controller._name = eController["@_name"];

		return controller;
	}

	/**
	 * Reads geometry directories.
	 * @param {Object} eGeomDirs XML element of the geometry directories
	 * @return {String[]} Relative paths of the directories, stored by their LOD.
	 */
	readGeometryDirectories(eGeomDirs) {
		let dirs = [];

		// Elements
		for (let i = 0; i < eGeomDirs.Directory.length; i++) {
			let dir = this.readDirectory(eGeomDirs.Directory[i]);
			dirs[dir.lod] = dir.name;
		}

		return dirs;
	}

	/**
	 * Reads a geometry directory.
	 * @param {Object} eDirectory XML element of the directory
	 * @return {Object} An object containing the name of the directory and its LOD
	 */
	readDirectory(eDirectory) {
		return {
			lod: parseFloat(eDirectory["@_lod"]),
			name: eDirectory["#text"]
		};
	}

	/**
	 * Converts a string to an array of float.
	 * @param {String} str Input string
	 * @param {String} [delimiter=" "] Delimitation between numbers
	 * @return {Float[]} The array containing the floats in the string
	 */
	floatArrayFromString(str, delimiter) {
		delimiter = (delimiter === undefined) ? " " : delimiter;

		let strArray = str.split(delimiter);
		let floatArray = [];
		for (let i = 0; i < strArray.length; i++) {
			floatArray.push(parseFloat(strArray[i]));
		}
		return floatArray;
	}

	/**
	 * Clears the importer and its model.
	 */
	clear() {
		this.model.clear();
	}
}

module.exports = Importer;
