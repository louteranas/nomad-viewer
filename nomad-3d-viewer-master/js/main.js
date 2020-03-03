const {app, BrowserWindow} = require('electron');
const path = require('path');
const PubSub = require('pubsub-js');
const Swal = require('sweetalert2');
const url = require('url');
const electronLocalshortcut = require('electron-localshortcut');



// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let htmlFile = "./view/index.html";

function createWindow () {

	let width = 900;
    let height = 600;
	
	let i = 0;
	while (i < process.argv.length) {
	  if (process.argv[i] === '-width') {
		width = process.argv[i+1];
		i++;
	  } else if (process.argv[i] === '-height') {
		height = process.argv[i+1];
		i++;
	  }
	  i++;
	}  
  
	win = new BrowserWindow({
		"width": parseInt(width), 
		"height": parseInt(height),
		webPreferences: {
			// Does not work if set to true.
			//contextIsolation: true,
			webSecurity: true,
			// Added to have 'require' keyword.
			nodeIntegration: true
		}
	});

	// and load the index.html of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, htmlFile),
		protocol: 'file:',
		slashes: true
	}));

	// Open the development tools.
	electronLocalshortcut.register(win, 'Shift+Ctrl+I', () => {
		win.webContents.openDevTools();
	});
	//win.webContents.openDevTools();
	// Disable the menu bar
	win.setMenu(null);

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		
				win = null;
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
