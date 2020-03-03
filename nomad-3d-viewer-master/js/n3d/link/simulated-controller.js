/**
 *
 * @class SimulatedController
 */
class SimulatedController {

	constructor() {
		Nomad3DController.call(this);
		this._movement = function(t, min, max) {
			let f = 1;
			let a = 0.5 * Math.abs(max - min);
			let m = 0.5 * (max + min);
			return m + a * Math.sin(f * t);
		}
	}


	get movement() {
		return this._movement;
	}
	set movement(movementFunction) {
		this._movement = movementFunction;
	}

	update() {
		if (this.component === null || this.component.axis === null 
				|| !this.component.axis.isControllable() 
				|| this.component.animation !== Component.Simulated) {
			return;
		}

		let t = this._clock.getElapsedTime();
		let oldValue = this.component.axis.value;
		this.component.axis.value = this.movement(t, this.component.axis.minValue, this.component.axis.maxValue);
		let deltaValue = this.component.axis.value - oldValue;

		this.move(deltaValue);
	}

}

module.exports = SimulatedController;

