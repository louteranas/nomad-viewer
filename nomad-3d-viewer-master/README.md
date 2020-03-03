# Nomad 3D Viewer

## Node.js installation

To install Node.js, use the following commands to get version 8.x:  

    $ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    $ sudo apt-get install -y nodejs
    
This will install npm which will be used to build and start the application.  
Notice that you may need to set the proxy in the _.curlrc_.

## Installation

Nomad 3D Viewer is based on Electron and is using a C++ addon to communicate with Nomad.
To install the viewer, first set the proxy:  

    $ npm config set proxy http://proxy.ill.fr:8888
    $ npm config set https-proxy http://proxy.ill.fr:8888

Install node-gyp as global (proxies must be set for sudo):  

    $ sudo npm install -g node-gyp

Install the dependencies:  

    $ npm install

## Installation with Nomad positions and collisions

The nomad-3d-positions and bullet-collision projects must be installed.
Rebuild the addons, on linux simply:  

    $ npm run rebuild
    
The script is calling *node-gyp* with special arguments and must set some additional permissions.


## Launch the viewer

Now the viewer can be launched by:

    $ npm start -- -config <viewer-config.json>
    
In that case, the nomad positions and collisions are not used. To use them (the addons must have been built):  

    $ npm start -- -config <viewer-config.json> -nomad -collisions
    
Or use the default _viewer-config.json_ file located in _${HOME}/.nomad3d_

    $ npm start
    
To debug the viewer, type Shift + Ctrl + I.
    
Be careful when using the viewer with a remote nomad server. The attribute _localEndpoint_ must contain the hostname of the local cameo server and not localhost.


## Debug the collisions

It is possible to visualize the GUI of the collision server. Start the collision server manually:

    $ cd bullet-collision/build
    $ ./nomad3dcollisionservergui <model path> <xml filename> <LOD> <margin> <cameo id>

The name of the cameo application must be *n3dcollisionsgui*.
For instance:  
    
    $ ./nomad3dcollisionservergui /users/legoc/nomad3d/SOLIDWORKS_models/Test-converted/ Test-view.xml 0 0.03 tcp://gamma15:7000:n3dcollisionsgui
    
Then the viewer can be launched:

    $ npm start -- -config <viewer-config.json> -nomad -collisions-debug
    

## Install the viewer with the package

First install the nomad-3d-positions application.  

    $ git clone https://code.ill.fr/instrument-control/protos/nomad-3d/nomad-3d-positions.git -b v1.0.0
    
Add the application in the cameo config:

```
<application name="n3dpositions" starting_time="inf" retries="0" stopping_time="20" multiple="no" restart="no" pass_info="yes" log_directory="default">
	<start executable="nomad3dpositions"/>
</application>
```

Install the viewer by getting the package. Be sure to have the model on the computer.
Launch the viewer. For instance:

```
    $ ./nomad-3d-viewer -- -config ../models/thales/viewer-mono-config.json -nomad
```



    
    

