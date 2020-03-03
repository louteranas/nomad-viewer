/**
 *
 * @class Nomad3DController
 */
const THREE = require('three');

const Component = require('../model/component.js');
const Axis = require('../model/axis.js');
const config = require('../../config');

class Nomad3DController {

	constructor() {
		this._name = "";
		this._component = null;
		this._actualPosition = 0;
	}

	get name() {
		return this._name;
	}
	
	set name(value) {
		console.warn("Nomad3DController.name is a read-only property.");
	}
	
	get component() {
		return this._component;
	}
	
	set component(value) {
		console.warn("Nomad3DController.component is a read-only property.");
	}

	init(position) {

		if (this.component === null || this.component.axis === null 
				|| !this.component.axis.isControllable()
				|| this.component.animation !== Component.Controlled) {
			return;
		}

		try {
			this._actualPosition = position;
			this.component.axis.value = this._actualPosition;
						
		} catch (e) {
			console.error(e);
		}

		console.info("Controller " + this.name + " initialised with position " + position);
	}


	update(position) {
		if (this.component === null || this.component.axis === null 
				|| !this.component.axis.isControllable()
				|| this.component.animation !== Component.Controlled) {
			return;
		}

		//console.info("Updating controller " + this.name + " with position " + position);

		try {
			this._actualPosition = position;

			let oldValue = this.component.axis.value;

			this.component.axis.value = this._actualPosition;
			let deltaValue = this.component.axis.value - oldValue;

			this.move(deltaValue);
		} catch (e) {
			console.error(e);
		}

		//console.info("Controller " + this.name + " updated.");
	}

	move(deltaValue) {
		let position = new THREE.Vector3().copy(this.component.axis.position);
		
		switch (this.component.axis.type) {
			case Axis.Translation:

				// Define the movement transform.
				let deltaTranslation = new THREE.Matrix4().makeTranslation(
						deltaValue * this.component.axis.direction.x,
						deltaValue * this.component.axis.direction.y,
						deltaValue * this.component.axis.direction.z
				);

				// Recalculate the local scene node transform.
				this.component.calculateSceneNodeTransform(deltaTranslation);
				break;

			case Axis.Rotation:
				
				// Define the movement transforms.
				let localToPivot = new THREE.Matrix4().makeTranslation(
						- position.x,
						- position.y,
						- position.z
					);

				let axisRotation = new THREE.Matrix4().makeRotationAxis(
						this.component.axis.direction,
						THREE.Math.degToRad(deltaValue)
					);

				let pivotToLocal = new THREE.Matrix4().makeTranslation(
						position.x,
						position.y,
						position.z
					);

				let deltaRotation = new THREE.Matrix4();

				// The multiplication order must be respected.
				deltaRotation.copy(pivotToLocal);
				deltaRotation.multiply(axisRotation);
				deltaRotation.multiply(localToPivot);

				// Recalculate the local scene node transform.
				this.component.calculateSceneNodeTransform(deltaRotation);
				break;

			default:
				break;
		}

	}

	// Not used anymore. Move special code for special controllers in the Nomad3D module.
	// getActualPosition() {

	// 	switch (this.name) {
	// 		case "DAN":
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("actual_angle"));
	// 		case "DH":
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("actual_height"));
	// 		default:
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("actual_position"));
	// 	}
	// }

	// getWantedPosition() {
		
	// 	switch (this.name) {
	// 		case "DAN":
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("wanted_angle"));
	// 		case "DH":
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("wanted_height"));
	// 		default:
	// 			return NomadAccessor.getFloat64Property(this.getPropertyId("wanted_position"));
	// 	}
	// }

}

module.exports = Nomad3DController;

