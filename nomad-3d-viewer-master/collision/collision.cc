#include <node.h>
#include <iostream>
#include <unistd.h>
#include <uv.h>
#include <thread>
#include <sstream>
#include <functional>
#include <string>
#include <cameo/cameo.h>

using namespace std;
using namespace std::placeholders;

namespace nomad {

using v8::Function;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;
using v8::Number;
using v8::Integer;
using v8::Boolean;
using v8::Array;
using v8::Persistent;

unique_ptr<cameo::Server> server;
unique_ptr<cameo::application::Instance> collisionServer;
unique_ptr<cameo::application::Requester> requester;
Isolate * v8Isolate;

std::string COLLISION_SERVER = "n3dcollisions";
std::string COLLISION_SERVER_GUI = "n3dcollisionsgui";

/**
 * Init function to initialise the Cameo Nomad addon.
 */
void Init(const FunctionCallbackInfo<Value>& args) {

    cout << "initialising collision detection" << endl; 

	// Get the V8 isolate.
	v8Isolate = args.GetIsolate();

	// Get the args.
	v8::String::Utf8Value param1(args[0]->ToString());
	string electronArgs(*param1);

	cout << "electron args = " << electronArgs << endl;

	size_t pos = 0;

    // Parse the args.
	size_t endPos = electronArgs.find_first_of(',', pos);
	string localEndpoint = electronArgs.substr(pos, endPos - pos);

	cout << "local endpoint = " << localEndpoint << endl;

    pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string name = electronArgs.substr(pos, endPos - pos + 1);

	cout << "name = " << name << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string modelDirectory = electronArgs.substr(pos, endPos - pos);
    modelDirectory += "/";

	cout << "model directory = " << modelDirectory << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string fileName = electronArgs.substr(pos, endPos - pos);

	cout << "model file name = " << fileName << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string lod = electronArgs.substr(pos, endPos - pos + 1);

	cout << "lod = " << lod << endl;

    pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string collisionMargin = electronArgs.substr(pos, endPos - pos + 1);

	cout << "collision margin = " << collisionMargin << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string collisionGUI = electronArgs.substr(pos, endPos - pos + 1);

	cout << "collision gui = " << collisionGUI << endl;


    // Init the app if it is not already done.
	if (cameo::application::This::getId() == -1) {

		// Create the params.
		string localParams = localEndpoint + ":" + name;

		// We only need the last argument that we convert to an array.
		char *argv[1] = {(char *)localParams.c_str()};

		cameo::application::This::init(1, argv);

        cout << "initialised cameo" << endl;
	}

	// Init nomad 3D collision.
	server.reset(new cameo::Server(cameo::application::This::getServer().getEndpoint()));

	if (collisionGUI == "false") {

		cout << "cameo server " << *server << endl;

		collisionServer = server->connect(COLLISION_SERVER);
		if (collisionServer->exists()) {
			// The application exists from a previous server session
			collisionServer->kill();
			cameo::application::State state = collisionServer->waitFor();
			cout << "terminated old collision server with state " << cameo::application::toString(state) << endl;
		}

		vector<string> appArgs;
		appArgs.push_back(modelDirectory);
		appArgs.push_back(fileName);
		appArgs.push_back(lod);
		appArgs.push_back(collisionMargin);

		collisionServer = server->start(COLLISION_SERVER, appArgs);
	}
	else {
		collisionServer = server->connect(COLLISION_SERVER_GUI);
	}

	if (!collisionServer->exists()) {
		cout << "no collision server" << endl;
	}
    else {
        cout << "collision server " << *collisionServer << endl;
    }

    // Create the requester
	requester = cameo::application::Requester::create(*collisionServer, "update_positions");

	if (requester.get() == 0) {
		cout << "cannot create requester" << endl;
		return;
	}

	args.GetReturnValue().Set(Undefined(v8Isolate));
}

void UpdatePositions(const FunctionCallbackInfo<Value>& args) {

	v8::String::Utf8Value param0(args[0]->ToString());
	std::string jsonPositions(*param0);

	// Send the file content to the server.
	requester->send(jsonPositions);

	// Wait for the response from the server.
	string response;
	requester->receive(response);
    
    args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), response.c_str()).ToLocalChecked());
}

void Request(const FunctionCallbackInfo<Value>& args) {

	v8::String::Utf8Value param0(args[0]->ToString());
	std::string jsonRequest(*param0);

	// Send the file content to the server.
	requester->send(jsonRequest);

	// Wait for the response from the server.
	string response;
	requester->receive(response);
    
    args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), response.c_str()).ToLocalChecked());
}

/**
 * The init function declares what we will make visible to node.
 */
void init(Local<Object> exports) {

	// Register the functions.
	NODE_SET_METHOD(exports, "init", Init);
	NODE_SET_METHOD(exports, "request", Request);
}

NODE_MODULE(addonnomad3dcollision, init)

}
