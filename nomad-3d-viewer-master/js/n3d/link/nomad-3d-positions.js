const config = require('../../config');

let NomadPositions = null;

try {
	if (config.link) {
		NomadPositions = require('../../../build/Release/addonnomad3dposition');
	}

} catch (e) {
	console.error(e);
}

class Nomad3DPositions {

    constructor() {
    }

    update() {
        // Get the positions from Nomad.
        if (NomadPositions !== null) {
            let positions = NomadPositions.getPositions();
            return positions;
        }
        return null;
    }

    pause() {
        // Pause Nomad.
        if (NomadPositions !== null) {
            NomadPositions.pause();
        }
    }

    restart() {
        // Pause Nomad.
        if (NomadPositions !== null) {
            NomadPositions.restart();
        }
    }
}

module.exports = Nomad3DPositions;