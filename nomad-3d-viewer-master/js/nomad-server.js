/**
 *
 * @class NomadServer
 */
const config = require('./config.js');

let NomadPositions = null;
if (config.link) {
	NomadPositions = require('../build/Release/addonnomad3dposition');
}

class NomadServer {

	constructor() {
		
		this._controller = {
			Server: []
		}

	}

	resetServerIdMap() {

		this._serverIdMap = {
			"real" : 0
		};

		// Retrieve the list of simulated servers from the Cameo server.
		let simulatedServerIds = NomadPositions.getSimulatedServerIds();

		// Init the Server property.
		this._controller.Server = ["real"];

		// Iterate the simulated server ids.
		for (let i = 0; i < simulatedServerIds.length; i++) {
			let id = simulatedServerIds[i];
			let simId = "sim " + id.toString();
			this._serverIdMap[simId] = id;
			this._controller.Server.push(simId);
		}
	}

	init() {

		// Init the addon.
		if (NomadPositions !== null) {
			NomadPositions.init([config.localEndpoint, config.nomadEndpoint, config.name]);
		
			// Get the current simulated server list.
			this.resetServerIdMap([]);
			this._currentServerId = this._controller.Server[0];
		}
	}

	reset(nomadServerId) {

		// Reset the addon.
		if (NomadPositions !== null) {
			NomadPositions.reset(nomadServerId);
		}
	}

	addCombo() {

		// Create the combo with the last selected value.
		this._serversController = this._nomadFolder.add(this._controller, 'Server', this._controller.Server).setValue(this._currentServerId).onChange(((nomadServerId) => {

			this.reset(this._serverIdMap[nomadServerId]);
			this._currentServerId = nomadServerId;

		}).bind(this));
	}

	initGui(gui) {

		// Create the GUI.
		if (NomadPositions !== null) {
			this._nomadFolder = gui.addFolder("Nomad")

			let refreshFunction = {
				"Refresh": (() => {
					this.resetServerIdMap();
					this._nomadFolder.remove(this._serversController);
					this.addCombo();

				}).bind(this)
			}
			
			// Add refresh button.
			this._nomadFolder.add(refreshFunction, "Refresh");

			// Add the combo.
			this.addCombo();
		}
	}
}

module.exports = new NomadServer();
