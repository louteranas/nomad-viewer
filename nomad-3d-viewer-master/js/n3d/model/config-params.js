/**
 *
 * @class ConfigParams
 */

const THREE = require('three');

class ConfigParams {

	constructor(owner) {
		this._owner = owner;
		this._configuration = "";
		this._fixed = false;
		this._visible = true;
		this._translation = new THREE.Vector3();
		this._rotation = new THREE.Matrix3();
		this._scale = 1.0;
		this._axisValue = 0.0;
	}

	get owner() {
		return this._owner;
	}
	
	set owner(value) {
		console.warn("ConfigParams.owner is a read-only property.");
	}
	
	get configuration() {
		return this._configuration;
	}
	
	set configuration(value) {
		console.warn("ConfigParams.configuration is a read-only property.");
	}
	
	get fixed() {
		return this._fixed;
	}
	
	set fixed(value) {
		console.warn("ConfigParams.fixed is a read-only property.");
	}
	
	get visible() {
		return this._visible;
	}
	
	set visible(value) {
		console.warn("ConfigParams.visible is a read-only property.");
	}
	
	get translation() {
		return this._translation;
	}
	
	set translation(value) {
		console.warn("ConfigParams.translation is a read-only property.");
	}
	
	get rotation() {
		return this._rotation;
	}
	
	set rotation(value) {
		console.warn("ConfigParams.rotation is a read-only property.");
	}
	
	get scale() {
		return this._scale;
	}
	
	set scale(value) {
		console.warn("ConfigParams.scale is a read-only property.");
	}
	
	get axisValue() {
		return this._axisValue;
	}
	
	set axisValue(value) {
		console.warn("ConfigParams.axisValue is a read-only property.");
	}

	transformMatrix() {
		let matrixArray = [];
		let rotationArray = this.rotation.toArray();
		for (let j = 0 ; j < 3 ; j++) {
			for (let i = 0 ; i < 3 ; i++) {
				matrixArray.push(rotationArray[3*j+i]);
			}
			matrixArray.push(0);
		}
		matrixArray.push(this.translation.x);
		matrixArray.push(this.translation.y);
		matrixArray.push(this.translation.z);
		matrixArray.push(1);

		let transform = new THREE.Matrix4();
		transform.fromArray(matrixArray);
		return transform;
	}

}

module.exports = ConfigParams;