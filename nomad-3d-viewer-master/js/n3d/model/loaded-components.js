
const path = require('path');
class LoadedComponents {

    constructor(component, model) {

        this._component = component;

        // we keep paths here to reduce the variable on component.js, factorized code is always better ;)
        //model's folder path
        this._geomFolderCachePath = [path.join(path.join(path.join(model.directoryPath, "cache "+model.name), model.geometryDirectories[0]), component.name),
        path.join(path.join(path.join(model.directoryPath, "cache "+model.name), model.geometryDirectories[1]), component.name),
        path.join(path.join(path.join(model.directoryPath, "cache "+model.name), model.geometryDirectories[2]), component.name)
        ];
        //merged model's sub_geometries path
        this._geomCachePath = [path.join(this._geomFolderCachePath[0], component.name + '.STL'),
        path.join(this._geomFolderCachePath[1], component.name + '.STL'),
        path.join(this._geomFolderCachePath[2], component.name + '.STL')
        ];
        //group material mapping params path
        this._geomParamsPath = [path.join(this._geomFolderCachePath[0], component.name + 'Params.Json'),
        path.join(this._geomFolderCachePath[1], component.name + 'Params.Json'),
        path.join(this._geomFolderCachePath[2], component.name + 'Params.Json')
        ];
        //model's materials path
        this._geomMaterialsPath = path.join(path.join(model.directoryPath, "cache " +model.name +"/materials"), component.name + '.json');
        this._materialsMapPath = path.join(path.join(model.directoryPath, "cache " +model.name +"/materials"), component.name +'materialsMap.json');

        this._loaded = [];

        for (let i = 0; i < model.geometryDirectories.length; i++) {

            this._loaded.push({
                geometriesCount: 0,
                loadedGeometriesCount: 0,
                geometries: [],
                materials: [],
                index: []
            });
        }
    }

    get component() {
        return this._component;
    }

    geomFolderCachePath(index){
        return this._geomFolderCachePath[index];
    }

    geomCachePath(index) {
        return this._geomCachePath[index];
    }

    geomParamsPath(index) {
        return this._geomParamsPath[index];
    }

    get geomMaterialsPath() {
        return this._geomMaterialsPath;
    }

    get materialsMapPath() {
        return this._materialsMapPath;
    }

    get loaded() {
        return this._loaded;
    }

    

}

module.exports = LoadedComponents;