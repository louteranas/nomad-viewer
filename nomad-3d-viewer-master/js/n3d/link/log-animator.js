/**
  * @class LogAnimator
 */
const fs = require('fs');
const THREE = require('three');

const Seconds = 1;
const MilliSeconds = 1e-3;
const MicroSeconds = 1e-6;

/**
 * The LogAnimator has to be instantiated with a log file (Check previous versions for an example of log).
 * TODO: this code is no longer working. Update with the new way of getting axis values: call Nomad3D controller and do not manage offsets.
 */
class LogAnimator {

	constructor(logPath, model) {
		this._logPath = logPath;
		this._logs = fs.readFileSync(logPath, "utf8").split("\n");
		this._model = model;
		this._timeUnit = MicroSeconds;
		this._repeat = true;

		// private
		this._clock = new THREE.Clock();
		this._started = false;
		this._start = this.readLog(0).date;
		this._currentLogIdx = 0;

		// Change the state of the components. CHECK
		model.root.traverse(component => {
			component.animation = Component.Animated;
		});
	}

	get logPath() {
		return this._logPath;
	}
	
	set logPath(path) {
		this._logPath = path;
		this._logs = fs.readFileSync(path, "utf8").split("\n");
		this._start = this.readLog(0).date;
		this._currentLogIdx = 0;
	}
	
	get logs() {
		return this._logs;
	}
	
	set logs(value) {
		console.warn("LogAnimator.logs is a read-only property.");
	}
	
	get model() {
		return this._model;
	}
	
	set model(value) {
		this._model = value;
	}
	
	get timeUnit() {
		return this._timeUnit;
	}
	
	set timeUnit(value) {
		this._timeUnit = value;
	}
	
	get repeat() {
		return this._repeat;
	}
	
	set repeat(value) {
		this._repeat = value;
	}
	
	get started() {
		return this._started;
	}
	
	set started(value) {
		this._started = value;
		this._clock.stop();
		this._clock.start();
	}

	readLog(i) {
		let props = this.logs[i].split(", ");
		return {
			date: this._timeUnit * parseInt(props[0]),
			name: props[1],
			value: parseFloat(props[2])
		};
	}


	updateComponent(component, t, log) {
                        
		if (component !== null && component.axis !== null 
				&& component.axis.isControllable()
				&& component.animation === Component.Animated
				&& component.controller.name === log.name) {
			try {
				let oldValue = component.axis.value;
				let actualPosition = log.value;
				let offsetPosition = component.controller.getOffsetPosition();
				component.axis.value = actualPosition - offsetPosition;
				let deltaValue = component.axis.value - oldValue;

				console.log(component.controller.name + " : " + deltaValue);
				component.controller.move(deltaValue);
			} catch (e) {
				console.error(e);
			}
		}

		// Children
		for (let i = 0 ; i < component.children.length ; i++) {
			updateComponent(component.children[i], t, log);
		}
	}

	update() {
		if (this.model.needsUpdate) {
			// No animation while loading
			this._currentLogIdx = -1;
			this._clock.stop();
			return;
		}
		if (this._currentLogIdx < 0) {
			this._currentLogIdx = 0;
			//this._clock.start();
		}
		if (this._currentLogIdx >= this._logs.length) {
			if (this.repeat) {
				this._currentLogIdx = 0;
				this._clock.start();
			} else {
				return;
			}
		}
        
        let t = 0;
        
        if (this._started) {
            t = this._clock.getElapsedTime() + this._start;

            let updateLogs = [];
            for ( ; this._currentLogIdx < this.logs.length ; this._currentLogIdx++) {
                    let nextLog = this.readLog(this._currentLogIdx);
                    if (nextLog.date > t) {
                            break;
                    } else {
                            updateLogs.push(nextLog);
                            //console.log('started update log ' + nextLog.date);
                    }
            }
            
            for (let i = 0; i < updateLogs.length; i++) {
                this.updateComponent(model.root, t, updateLogs[i]);
            }
        }
        else {
            
            let updateLogs = [];
            
            // We read the first 10 values to ensure to have correct positions before starting the simulation.
            for ( ; this._currentLogIdx < 10 ; this._currentLogIdx++) {
                    let nextLog = this.readLog(this._currentLogIdx);
                    updateLogs.push(nextLog);
                    //console.log('started update log ' + nextLog.date);
            }
            
            for (let i = 0; i < updateLogs.length; i++) {
                updateComponent(model.root, t, updateLogs[i]);
            }
        }
	}

	//console.log(updateLogs.length + " logs to update", t);
}

module.exports = LogAnimator;
