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
using v8::Context;
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
unique_ptr<cameo::Server> remoteServer;
unique_ptr<cameo::application::Instance> nomad3DPositions;
unique_ptr<cameo::application::Requester> requester;
Isolate * v8Isolate;

string nomadEndpoint;
std::string NOMAD3DPOSITIONS = "n3dpositions";

/**
 * Init function to initialise the Cameo Nomad addon.
 */
void Init(const FunctionCallbackInfo<Value>& args) {

	cout << "initialising nomad positions" << endl;

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
	nomadEndpoint = electronArgs.substr(pos, endPos - pos);

	cout << "nomad endpoint = " << nomadEndpoint << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string name = electronArgs.substr(pos, endPos - pos + 1);

	cout << "name = " << name << endl;

	// Init the app if it is not already done.
	if (cameo::application::This::getId() == -1) {

		// Create the params.
		string localParams = localEndpoint + ":" + name;

		// We only need the last argument that we convert to an array.
		char *argv[1] = {(char *)localParams.c_str()};

		cameo::application::This::init(1, argv);

		cout << "initialised cameo" << endl;
	}

    // Init nomad3d positions.
    server.reset(new cameo::Server(cameo::application::This::getServer().getEndpoint()));

    cout << "cameo server " << *server << endl;

    nomad3DPositions = server->connect(NOMAD3DPOSITIONS);
	if (nomad3DPositions->exists()) {
		// The application exists from a previous server session
		nomad3DPositions->kill();
		cameo::application::State state = nomad3DPositions->waitFor();
		cout << "terminated old nomad 3D positions with state " << cameo::application::toString(state) << endl;
	}

	vector<string> appArgs;
    appArgs.push_back(nomadEndpoint);

    nomad3DPositions = server->start(NOMAD3DPOSITIONS, appArgs);

	if (!nomad3DPositions->exists()) {
		cout << "no nomad 3D positions" << endl;
	}
    else {
        cout << "nomad 3D positions " << *nomad3DPositions << endl;
    }

    // Create the requester
	requester = cameo::application::Requester::create(*nomad3DPositions, "get_positions");

	if (requester.get() == 0) {
		cout << "cannot create requester" << endl;
		return;
	}

	// Create the remote server.
	remoteServer.reset(new cameo::Server(nomadEndpoint));

	args.GetReturnValue().Set(Undefined(v8Isolate));
}

/**
 * Reset function to reset the Cameo Nomad addon to a new Nomad server.
 */
void Reset(const FunctionCallbackInfo<Value>& args) {

	v8::String::Utf8Value param0(args[0]->ToString());
	std::string nomadId(*param0);

	cout << "resetting nomad positions with nomad " << nomadId << endl;

	requester.reset();

    nomad3DPositions = server->connect(NOMAD3DPOSITIONS);
	if (nomad3DPositions->exists()) {
		// The application exists from a previous server session
		nomad3DPositions->kill();
		cameo::application::State state = nomad3DPositions->waitFor();
		cout << "terminated old nomad 3D positions with state " << cameo::application::toString(state) << endl;
	}

	vector<string> appArgs;
    appArgs.push_back(nomadEndpoint + "," + nomadId);

    nomad3DPositions = server->start(NOMAD3DPOSITIONS, appArgs);

	if (!nomad3DPositions->exists()) {
		cout << "no nomad 3D positions" << endl;
	}
    else {
        cout << "nomad 3D positions " << *nomad3DPositions << endl;
    }

    // Create the requester
	requester = cameo::application::Requester::create(*nomad3DPositions, "get_positions");

	if (requester.get() == 0) {
		cout << "cannot create requester" << endl;
		return;
	}

	args.GetReturnValue().Set(Undefined(v8Isolate));
}

void GetSimulatedServerIds(const FunctionCallbackInfo<Value>& args) {

	Local<Context> context = args.GetIsolate()->GetCurrentContext();
	Local<Array> array = Array::New(args.GetIsolate(), 0);

	cameo::application::InstanceArray nomadApplications = remoteServer->connectAll("nssim");

	for (size_t i = 0; i < nomadApplications.size(); ++i) {
		array->Set(context, i, Integer::New(args.GetIsolate(), nomadApplications[i]->getId()));
	}

	args.GetReturnValue().Set(array);
}

void GetPositions(const FunctionCallbackInfo<Value>& args) {

	std::string reqPositions("POSITIONS");

	// Send the request.
	requester->send(reqPositions);

	// Wait for the response.
	string response;
	requester->receive(response);
    
    args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), response.c_str()).ToLocalChecked());
}

void Pause(const FunctionCallbackInfo<Value>& args) {

	std::string reqPause("PAUSE");

	// Send the request.
	requester->send(reqPause);

	// Wait for the response.
	string response;
	requester->receive(response);
    
    args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), response.c_str()).ToLocalChecked());
}

void Restart(const FunctionCallbackInfo<Value>& args) {

	std::string reqRestart("RESTART");

	// Send the request.
	requester->send(reqRestart);

	// Wait for the response.
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
	NODE_SET_METHOD(exports, "getPositions", GetPositions);
	NODE_SET_METHOD(exports, "pause", Pause);
	NODE_SET_METHOD(exports, "restart", Restart);
	NODE_SET_METHOD(exports, "reset", Reset);
	NODE_SET_METHOD(exports, "getSimulatedServerIds", GetSimulatedServerIds);
}

NODE_MODULE(addonnomad3dposition, init)

}
