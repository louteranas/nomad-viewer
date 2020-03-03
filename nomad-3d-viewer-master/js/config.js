const fs = require('fs');
const path = require('path');
const {remote} = require('electron');
const homeDirectory = require('os').homedir();

let configPath = path.join(homeDirectory, '.nomad3d', 'viewer-config.json');


let i = 0;
let link = false;
let collisionDetection = false;
let collisionGUI = false;
let stats = false;
let numberOfLights = 0;

while (i < remote.process.argv.length) {

    if (remote.process.argv[i] === '-config') {
        i++;
        configPath = remote.process.argv[i];
    }
    else if (remote.process.argv[i] === '-nomad') {
        link = true;
    }
    else if (remote.process.argv[i] === '-collisions') {
        collisionDetection = true;
        collisionGUI = false;
    }
    else if (remote.process.argv[i] === '-collisions-debug') {
        collisionDetection = true;
        collisionGUI = true;
    }
    else if (remote.process.argv[i] === '-stats') {
        stats = true;
    }
    i++;
}

console.log('Reading config file : ' + configPath);

// Read the file
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Stores the absolute path for objects
config.objectAbsolutePath = [];
// Set the absolute path for the model.
config.absoluteModelPath = path.resolve(path.dirname(configPath), config.modelPath);


var objectsDir = config.absoluteModelPath.substring(0, config.absoluteModelPath.lastIndexOf('/'));
if(config.objects != undefined){
    for(let i = 0; i<config.objects.length; i++){
        console.log(config.objects[i].modPath +"exists " +fs.existsSync(config.objects[i].modPath))
        //if(fs.existsSync(config.objects[i].modPath))
            config.objectAbsolutePath.push(path.join(config.objects[i].dirPath, config.objects[i].modelName))
    }
}
if(fs.existsSync(path.join(objectsDir, 'Floor-view.xml'))) config.objectAbsolutePath.push(path.join(objectsDir, 'Floor-view.xml'));

//if(fs.existsSync(path.join(objectsDir, 'Monochromator Stage-view.xml'))) config.objectAbsolutePath.push(path.join(objectsDir, 'Monochromator Stage-view.xml'));
//if(fs.existsSync(path.join(objectsDir, 'Casemate Shielding-view.xml'))) config.objectAbsolutePath.push(path.join(objectsDir, 'Casemate Shielding-view.xml'));

// Set the absolute path for the model.
config.absoluteModelPath = path.resolve(path.dirname(configPath), config.modelPath);

console.log('Absolute model path : ' + config.absoluteModelPath);

// For the collision detection.
config.modelDirectoryPath = path.dirname(config.absoluteModelPath);
config.modelFileName = path.basename(config.absoluteModelPath);

// Set the link ans stats attributes.
config.link = link;
config.collisionDetection = collisionDetection;
config.collisionGUI = collisionGUI;
config.stats = stats;
config.configPath = configPath;


// Set default value to frameTimeOut if it is not defined in the config file.
if (!("frameTimeOut" in config)) {
    config.frameTimeOut = 0;
}

// Set default value to collisionMargin if it is not defined in the config file.
if (!("collisionMargin" in config)) {
    config.collisionMargin = 0.04;
}

console.log('Link : ' + link);
console.log('Stats : ' + stats);
console.log('Collision margin : ' + config.collisionMargin);
console.log(config.objectAbsolutePath)

module.exports = config;
