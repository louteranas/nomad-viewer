class Nomad3DCollisions {

    constructor() {
		this._collisionDetection = require('../../../build/Release/addonnomad3dcollision');
    }

    updatePositions(positions) {
        return this._collisionDetection.request(JSON.stringify({type: "COLLISIONS", positions}));
    }

    addObject(path, fileName) {
        //return this._collisionDetection.request(JSON.stringify({type: "ADD_OBJECT", path, fileName}));
        let response = JSON.parse(this._collisionDetection.request(JSON.stringify({type: "ADD_OBJECT", path, fileName})));
        console.log(response.objectId);
        return response.objectId;
    }

    removeObject(objectId) {
        this._collisionDetection.request(JSON.stringify({type: "REMOVE_OBJECT", objectId}));
    }

    moveObject(objectId, xx, xy, xz, yx, yy, yz, zx, zy, zz, x, y, z) {
        this._collisionDetection.request(JSON.stringify({type: "MOVE_OBJECT", objectId, xx, xy, xz, yx, yy, yz, zx, zy, zz, x, y, z}));
    }

    filterCollisions(collisions){
        this._collisionDetection.request(JSON.stringify({type: "FILTER_COLLISIONS", collisionsList : collisions}));
    }
}

module.exports = Nomad3DCollisions;