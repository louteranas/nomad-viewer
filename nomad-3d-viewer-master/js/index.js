const Viewer = require('./viewer.js');

$(function() {

    // Initialise with the file.
    let viewer = new Viewer();
    viewer.init();
	viewer.animate();
});