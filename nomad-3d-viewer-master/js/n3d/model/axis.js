/**
 *
 * @class Axis
 */

const THREE = require('three');

class Axis {

	constructor() {
		this._type = Axis.Fixed;
		this._direction = new THREE.Vector3(0, 1, 0);
		this._position = new THREE.Vector3(0, 0, 0);
		this._value = 0.0;
		this._minValue = 0.0;
		this._maxValue = 0.0;
		this._zeroValue = 0.0;		
		this._visualGroup = new THREE.Group();
	}

	static get Translation() {
		return "Translation";
	}

	static get Rotation() {
		return "Rotation";
	}

	static get Fixed() {
		return "Fixed";
	}

	static get None() {
		return "None";
	}

	get type()  {
		return this._type;
	}

	set type(value) {
		console.warn("Axis.type is a read-only property.");
	}

	get direction() {
		return this._direction;
	}
	
	set direction(value) {
		console.warn("Axis.direction is a read-only property.");
	}
	
	get position() {
		return this._position;
	}
	
	set position(value) {
		console.warn("Axis.position is a read-only property.");
	}
	
	get value() {
		return this._value;
	}
	
	set value(aValue) {
		this._value = THREE.Math.clamp(aValue, this._minValue, this._maxValue);
	}

	get minValue() {
		return this._minValue;
	}

	set minValue(value) {
		console.warn("Axis.minValue is a read-only property.");
	}
	
	get zeroValue() {
		return this._zeroValue;
	}
	
	set zeroValue(value) {
		this._zeroValue = value;
	}
	
	get maxValue() {
		return this._maxValue;
	}
	
	set maxValue(value) {
		console.warn("Axis.maxValue is a read-only property.");
	}
	
	get visualGroup() {
		return this._visualGroup;
	}
	
	set visualGroup(value) {
		console.warn("Axis.visualGroup is a read-only property.");
	}

	typeFromString(str) {

		if (str === Axis.Translation) {
			return Axis.Translation;
		} else if (str === Axis.Rotation) {
			return Axis.Rotation;
		} else if (str === Axis.Fixed) {
			return Axis.Fixed;
		} else if (str === Axis.None) {
			return Axis.None;
		} else {
			console.error("Axis.typeFromString : unknown type " + str);
			return null;
		}
	}
	

	isControllable() {
		return (this.type === Axis.Translation || this.type === Axis.Rotation);
	}
}

module.exports = Axis;
