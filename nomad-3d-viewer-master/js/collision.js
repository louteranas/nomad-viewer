/**
 *
 * @class Collision
 */
const THREE = require('three');
const config = require('./config.js');
const PubSub = require('pubsub-js');

const Swal = require('sweetalert2');

let collisionMaterial = new THREE.MeshStandardMaterial();
collisionMaterial.opacity = 0.5;
collisionMaterial.color = new THREE.Color(1, 0, 0);
collisionMaterial.transparent = true;

class Collision {

	constructor() {
		this._dismissAlert = false;
		this._collisionStack = {};
		this._collisonsCount = 0;
		this._minDeltaTimeMs = config.minDeltaTime;
		this._nomad3DPositions = null;
		this._currentPositions = null;
		this._highlighted = false;
		this._collisionsFolder = null;
		this._sceneNodeMap = null;
		this._collisionFocus = false;
		this._pauseOnCollision = false;
		this._counterController = null;
		this._collisionDetection = null;

		if (config.collisionDetection) {
			let Nomad3DCollisions = require('./n3d/link/nomad-3d-collisions');
			this._collisionDetection = new Nomad3DCollisions();
		}
		this._controller = {
			"Count": this._collisonsCount,
			"Focus": this._collisionFocus,
			"Pause": this._pauseOnCollision,
			"Show history": () => {
				console.log(this.giveCollisionHistory())
				Swal.mixin({
					input: 'Collision history',
					confirmButtonText: 'Next &rarr;',
					showCancelButton: true,
					progressSteps: Object.keys(this._collisionStack).concat([Object.keys(this._collisionStack).length])
				}).queue(this.giveCollisionHistory()).then(() => {
				})
			},
			"Clear history": () => {
				if (Object.keys(this._collisionStack).length == 0) {
					Swal.fire({
						title: 'Clear collisions',
						text: "No collisions were found",
						type: 'warning'
					})
				}
				else {
					Swal.fire({
						title: 'Are you sure?',
						text: "You won't be able to revert this!",
						type: 'warning',
						showCancelButton: true,
						confirmButtonColor: '#3085d6',
						cancelButtonColor: '#d33',
						confirmButtonText: 'Yes, delete it!'
					}).then(((result) => {
						if (result.value) {
							this._collisionStack = {};
							this._collisonsCount = 0;
							if (this._counterController != null)
								this._collisionsFolder.remove(this._counterController)
							this._controller["Count"] = this._collisonsCount;
							if (this._collisionsFolder != null)
								this._counterController = this._collisionsFolder.add(this._controller, "Count").min(0).onChange(() => { })
							Swal.fire(
								'Deleted!',
								'Your file has been deleted.',
								'success'
							)
						}
					}).bind(this))
				}
			},
			"Filter collisons": () => {
				if (Object.keys(this._collisionStack).length == 0) {
					Swal.fire({
						title: 'Filter collisions',
						text: "No collisions were found",
						type: 'warning'
					})
				}
				else {
					Swal.fire({
						title: 'Are you sure you want to declare these collisions as false collisions?',
						text: "You won't be able to revert this!",
						type: 'warning',
						showCancelButton: true,
						confirmButtonColor: '#3085d6',
						cancelButtonColor: '#d33',
						confirmButtonText: 'Yes, delete it!'
					}).then(((result) => {
						if (result.value) {
							this._collisionDetection.filterCollisions(this._collisionStack);
							Swal.fire(
								'Done!',
								'These collisions will no longer be detected.',
								'success'
							)
						}
					}).bind(this))
				}
			}

		}

	}

	get collisionStack() {
		return this._collisionStack;
	}

	get sceneNodeMap() {
		return this._sceneNodeMap;
	}

	setSceneNodeMap(sceneNodeMap) {
		this._sceneNodeMap = sceneNodeMap;
	}

	get pauseOnCollision() {
		return this._pauseOnCollision;
	}

	highlightObjects(objectName, objectId) {
		for (let i = 0; i < this._sceneNodeMap[objectId][objectName][0].children.length; i++) {
			this._sceneNodeMap[objectId][objectName][0].children[i].material = collisionMaterial;
			if (this._highlighted) {
				collisionMaterial.opacity -= 0.005;
				if (collisionMaterial.opacity < 0.4) this._highlighted = !this._highlighted;
			}
			else {
				collisionMaterial.opacity += 0.005;
				if (collisionMaterial.opacity > 0.8) this._highlighted = !this._highlighted;
			}
		}
	}

	giveCollisionHistory() {
		let output = [];
		if (Object.keys(this._collisionStack).length == 0) {
			output.push({
				title: 'Sorry',
				text: 'No collisions were found'
			})
		}
		else {
			output.push({
				title: 'Collisions were found !',
				text: Object.keys(this._collisionStack).length + ' collisions occured'
			})
			for (let key in this._collisionStack) {
				output.push({
					title: 'Collision N°' + (key),
					text: this._collisionStack[key][0] + ' collided with ' + this._collisionStack[key][1]
				})
			}
		}
		return output
	}

	resetHighligthedObjects() {
		for (let key in this._collisionStack) {
			for (let i = 0; i < this._sceneNodeMap[this._collisionStack[key][2]][this._collisionStack[key][0]][0].children.length; i++) {
				this._sceneNodeMap[this._collisionStack[key][2]][this._collisionStack[key][0]][0].children[i].material = this._sceneNodeMap[this._collisionStack[key][2]][this._collisionStack[key][0]][1].children[i].material;
			}
			for (let i = 0; i < this._sceneNodeMap[this._collisionStack[key][3]][this._collisionStack[key][1]][0].children.length; i++) {
				this._sceneNodeMap[this._collisionStack[key][3]][this._collisionStack[key][1]][0].children[i].material = this._sceneNodeMap[this._collisionStack[key][3]][this._collisionStack[key][1]][1].children[i].material;
			}
		}
	}



	updateCollisionStack(collisions, nomad3DPositions) {
		// console.log(collisions)
		for (let i = 0; i < collisions.length; i++) {
			let newCollision = true;
			for (let key in this._collisionStack) {
				let partCondition = this._collisionStack[key].includes(collisions[i].mergedBlockA) && this._collisionStack[key].includes(collisions[i].mergedBlockB);
				let idCondition = this._collisionStack[key].includes(collisions[i].objectIdA) && this._collisionStack[key].includes(collisions[i].objectIdB);
				if (partCondition && idCondition) {
					newCollision = false;
				}
			}

			//console.log('new collision ' + newCollision);

			if (newCollision) {
				if (this._pauseOnCollision) {
					console.log("new collision, please stop")
					nomad3DPositions.pause();
					// setTimeout(console.log(nomad3DPositions) /*.restart()*/, 80000000);
				}

				this._collisionStack[this._collisonsCount] = [collisions[i].mergedBlockA, collisions[i].mergedBlockB, collisions[i].objectIdA, collisions[i].objectIdB];
				this._collisonsCount++;
				if (this._counterController != null)
					this._collisionsFolder.remove(this._counterController)
				this._controller["Count"] = this._collisonsCount;
				if (this._collisionsFolder != null)
					this._counterController = this._collisionsFolder.add(this._controller, "Count").min(0).onChange(() => { })

			}
		}
	}

	resetCollisionStack() {
		this._collisionStack = {};
	}



	initGui(gui) {
		this._collisionsFolder = gui.addFolder("Collisions")
		this._collisionsFolder.add(this._controller, "Focus").onChange((() => {
			this._collisionFocus = !this._collisionFocus;
			PubSub.publish('FOCUS', this._collisionFocus);
		}).bind(this));
		this._collisionsFolder.add(this._controller, "Pause").onChange((() => {
			this._pauseOnCollision = !this._pauseOnCollision;
			console.log('pause ' + this._pauseOnCollision);
		}).bind(this));
		this._collisionsFolder.add(this._controller, "Show history")
		this._collisionsFolder.add(this._controller, "Clear history")
		this._collisionsFolder.add(this._controller, "Filter collisons")

		this._counterController = this._collisionsFolder.add(this._controller, "Count").min(0).onChange(() => { })

	}
}

module.exports = new Collision();
