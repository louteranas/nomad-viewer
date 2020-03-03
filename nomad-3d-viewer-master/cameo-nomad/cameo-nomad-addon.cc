#include <node.h>
#include <iostream>
#include <unistd.h>
#include <nomadaccessor.h>
#include <uv.h>
#include <thread>
#include <sstream>
#include <functional>

using namespace std;
using namespace nomad;
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

NomadAccessor accessor;
Isolate * v8Isolate;

/**
 * Init function to initialise the Cameo Nomad addon.
 */
void Init(const FunctionCallbackInfo<Value>& args) {

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
	string nomadEndpoint = electronArgs.substr(pos, endPos - pos);

	cout << "nomad endpoint = " << nomadEndpoint << endl;

	pos = endPos + 1;
	endPos = electronArgs.find_first_of(',', pos);
	string name = electronArgs.substr(pos, endPos - pos + 1);

	cout << "name = " << name << endl;

	string localParams = localEndpoint + ":" + name;

	// We only need the last argument that we convert to an array.
	char *argv[1] = {(char *)localParams.c_str()};

	// Initialise the Nomad accessor.
	accessor.init(1, argv);
	accessor.connectNomadServer(nomadEndpoint);

	args.GetReturnValue().Set(Undefined(v8Isolate));
}

/**
 * Terminate function to terminate the Cameo Nomad addon.
 */
void Terminate(const FunctionCallbackInfo<Value>& args) {
	cout << "terminating" << endl;
	accessor.terminate();
	cout << "terminated" << endl;	
}

/**
 * Gets the property id.
 */
void GetPropertyId(const FunctionCallbackInfo<Value>& args) {

	v8::String::Utf8Value param0(args[0]->ToString());
	std::string servantName(*param0);

	v8::String::Utf8Value param1(args[1]->ToString());
	std::string propertyName(*param1);

	args.GetReturnValue().Set(Number::New(args.GetIsolate(), accessor.getPropertyId(servantName, propertyName)));
}

/**
 * Gets the float64 property value.
 */
void GetFloat64Property(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Number::New(args.GetIsolate(), accessor.getFloat64Value(Local<Integer>::Cast(args[0])->Value())));
}

/**
 * Gets the int32 property value.
 */
void GetInt32Property(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Number::New(args.GetIsolate(), accessor.getInt32Value(Local<Integer>::Cast(args[0])->Value())));
}

/**
 * Gets the boolean property value.
 */
void GetBooleanProperty(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Boolean::New(args.GetIsolate(), accessor.getBooleanValue(Local<Integer>::Cast(args[0])->Value())));
}

/**
 * Gets the string property value.
 */
void GetStringProperty(const FunctionCallbackInfo<Value>& args) {

	string value = accessor.getStringValue(Local<Integer>::Cast(args[0])->Value());
	args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), value.c_str()));
}

/**
 * Gets the int32 array property value.
 */
void GetInt32ArrayProperty(const FunctionCallbackInfo<Value>& args) {

	Local<Array> array = Array::New(args.GetIsolate(), 0);

	vector<int32_t> arrayValue = accessor.getInt32Array(Local<Integer>::Cast(args[0])->Value());

	for (int i = 0; i < arrayValue.size(); ++i) {
		array->Set(i, Integer::New(args.GetIsolate(), arrayValue[i]));
	}

	args.GetReturnValue().Set(array);
}

/**
 * Gets the float64 array property value.
 */
void GetFloat64ArrayProperty(const FunctionCallbackInfo<Value>& args) {

	Local<Array> array = Array::New(args.GetIsolate(), 0);

	vector<double> arrayValue = accessor.getFloat64Array(Local<Integer>::Cast(args[0])->Value());

	for (int i = 0; i < arrayValue.size(); ++i) {
		array->Set(i, Number::New(args.GetIsolate(), arrayValue[i]));
	}

	args.GetReturnValue().Set(array);
}

/**
 * Sets the float64 property value.
 */
void SetFloat64Property(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Boolean::New(args.GetIsolate(), accessor.setFloat64Value(Local<Integer>::Cast(args[0])->Value(), Local<Number>::Cast(args[1])->Value())));
}

/**
 * Sets the int32 property value.
 */
void SetInt32Property(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Boolean::New(args.GetIsolate(), accessor.setInt32Value(Local<Integer>::Cast(args[0])->Value(), Local<Integer>::Cast(args[1])->Value())));
}

/**
 * Sets the boolean property value.
 */
void SetBooleanProperty(const FunctionCallbackInfo<Value>& args) {
	args.GetReturnValue().Set(Boolean::New(args.GetIsolate(), accessor.setBooleanValue(Local<Integer>::Cast(args[0])->Value(), Local<Boolean>::Cast(args[1])->Value())));
}

/**
 * Sets the string property value.
 */
void SetStringProperty(const FunctionCallbackInfo<Value>& args) {
	v8::String::Utf8Value param1(args[1]->ToString());
	std::string value(*param1);
	args.GetReturnValue().Set(Boolean::New(args.GetIsolate(), accessor.setStringValue(Local<Integer>::Cast(args[0])->Value(), value)));
}

/**
 * Work structure is be used to pass the callback function and data
 * from the initiating function to the function which triggers the callback.
 */
template<typename Type>
struct Work {
	uv_work_t request;
	Persistent<Function> callback;
	Type result;
};

static void WorkAsync(uv_work_t *req) {
	// Do nothing.
}

/**
 * WorkAsyncComplete function is called once we are ready to trigger the callback
 * function in JS.
 */
template<typename Type, typename JSType>
static void WorkAsyncComplete(uv_work_t *req, int status) {

	Isolate * isolate = Isolate::GetCurrent();

	v8::HandleScope handleScope(isolate);

	Work<Type> *work = static_cast<Work<Type> *>(req->data);

	// Get the result and pass it to the JS callback.
	Local<Value> argv[1] = {JSType::New(isolate, work->result)};

	// https://stackoverflow.com/questions/13826803/calling-javascript-function-from-a-c-callback-in-v8/28554065#28554065
	Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 1, argv);

	work->callback.Reset();
	delete work;
}

/**
 * StringWorkAsyncComplete function is called once we are ready to trigger the callback
 * function in JS.
 */
static void StringWorkAsyncComplete(uv_work_t *req, int status) {

	Isolate * isolate = Isolate::GetCurrent();

	v8::HandleScope handleScope(isolate);

	Work<string> *work = static_cast<Work<string> *>(req->data);

	// Get the result and pass it to the JS callback.
	Local<Value> argv[1] = {String::NewFromUtf8(isolate, work->result.c_str())};

	// https://stackoverflow.com/questions/13826803/calling-javascript-function-from-a-c-callback-in-v8/28554065#28554065
	Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 1, argv);

	work->callback.Reset();
	delete work;
}

/**
 * Float64ArrayWorkAsyncComplete function is called once we are ready to trigger the callback
 * function in JS.
 */
static void Float64ArrayWorkAsyncComplete(uv_work_t *req, int status) {

	Isolate * isolate = Isolate::GetCurrent();

	v8::HandleScope handleScope(isolate);

	Work<vector<double> > *work = static_cast<Work<vector<double> > *>(req->data);

	// Get the result and pass it to the JS callback.
	Local<Array> array = Array::New(isolate, 0);

	const vector<double>& arrayValue = work->result;

	for (int i = 0; i < arrayValue.size(); ++i) {
		array->Set(i, Number::New(isolate, arrayValue[i]));
	}

	Local<Value> argv[1] = {array};

	// https://stackoverflow.com/questions/13826803/calling-javascript-function-from-a-c-callback-in-v8/28554065#28554065
	Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 1, argv);

	work->callback.Reset();
	delete work;
}

/**
 * Int32ArrayWorkAsyncComplete function is called once we are ready to trigger the callback
 * function in JS.
 */
static void Int32ArrayWorkAsyncComplete(uv_work_t *req, int status) {

	Isolate * isolate = Isolate::GetCurrent();

	v8::HandleScope handleScope(isolate);

	Work<vector<int32_t> > *work = static_cast<Work<vector<int32_t> > *>(req->data);

	// Get the result and pass it to the JS callback.
	Local<Array> array = Array::New(isolate, 0);

	const vector<int32_t>& arrayValue = work->result;

	for (int i = 0; i < arrayValue.size(); ++i) {
		array->Set(i, Integer::New(isolate, arrayValue[i]));
	}

	Local<Value> argv[1] = {array};

	// https://stackoverflow.com/questions/13826803/calling-javascript-function-from-a-c-callback-in-v8/28554065#28554065
	Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 1, argv);

	work->callback.Reset();
	delete work;
}

template<typename Type, typename JSType>
void PropertyChanged(Persistent<Function>* callback, Type value) {

	Work<Type> * work = new Work<Type>();

	work->request.data = work;
	work->callback.Reset(v8Isolate, *callback);
	work->result = value;

	uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete<Type, JSType>);
}

void StringPropertyChanged(Persistent<Function>* callback, const std::string& value) {

	Work<string> * work = new Work<string>();

	work->request.data = work;
	work->callback.Reset(v8Isolate, *callback);
	work->result = value;

	uv_queue_work(uv_default_loop(), &work->request, WorkAsync, StringWorkAsyncComplete);
}

void Float64ArrayPropertyChanged(Persistent<Function>* callback, const std::vector<double>& value) {

	Work<std::vector<double> > * work = new Work<std::vector<double> >();

	work->request.data = work;
	work->callback.Reset(v8Isolate, *callback);
	work->result = value;

	uv_queue_work(uv_default_loop(), &work->request, WorkAsync, Float64ArrayWorkAsyncComplete);
}

void Int32ArrayPropertyChanged(Persistent<Function>* callback, const std::vector<int32_t>& value) {

	Work<std::vector<int32_t> > * work = new Work<std::vector<int32_t> >();

	work->request.data = work;
	work->callback.Reset(v8Isolate, *callback);
	work->result = value;

	uv_queue_work(uv_default_loop(), &work->request, WorkAsync, Int32ArrayWorkAsyncComplete);
}

void RegisterFloat64PropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerFloat64PropertyChanged(propertyId, std::bind(&PropertyChanged<double, Number>, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

void RegisterInt32PropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerInt32PropertyChanged(propertyId, std::bind(&PropertyChanged<int32_t, Integer>, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

void RegisterBooleanPropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerBooleanPropertyChanged(propertyId, std::bind(&PropertyChanged<bool, Boolean>, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

void RegisterStringPropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerStringPropertyChanged(propertyId, std::bind(&StringPropertyChanged, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

void RegisterFloat64ArrayPropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerFloat64ArrayPropertyChanged(propertyId, std::bind(&Float64ArrayPropertyChanged, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

void RegisterInt32ArrayPropertyChanged(const FunctionCallbackInfo<Value>& args) {

	Isolate * isolate = args.GetIsolate();

	int propertyId = Local<Integer>::Cast(args[0])->Value();
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// The persistent function callback is allocated (should not) to allow to use it through the std function parameter.
	// That could lead to a memory leak.
	Persistent<Function>* pCallback = new Persistent<Function>();
	pCallback->Reset(isolate, callback);
	accessor.registerInt32ArrayPropertyChanged(propertyId, std::bind(&Int32ArrayPropertyChanged, pCallback, _1));

	args.GetReturnValue().Set(Undefined(isolate));
}

/**
 * The init function declares what we will make visible to node.
 */
void init(Local<Object> exports) {

	// Register the functions.
	NODE_SET_METHOD(exports, "init", Init);
	NODE_SET_METHOD(exports, "terminate", Terminate);
	NODE_SET_METHOD(exports, "getPropertyId", GetPropertyId);
	NODE_SET_METHOD(exports, "getFloat64Property", GetFloat64Property);
	NODE_SET_METHOD(exports, "getInt32Property", GetInt32Property);
	NODE_SET_METHOD(exports, "getBooleanProperty", GetBooleanProperty);
	NODE_SET_METHOD(exports, "getStringProperty", GetStringProperty);
	NODE_SET_METHOD(exports, "getInt32ArrayProperty", GetInt32ArrayProperty);
	NODE_SET_METHOD(exports, "getFloat64ArrayProperty", GetFloat64ArrayProperty);
	NODE_SET_METHOD(exports, "setFloat64Property", SetFloat64Property);
	NODE_SET_METHOD(exports, "setInt32Property", SetInt32Property);
	NODE_SET_METHOD(exports, "setStringProperty", SetStringProperty);
	NODE_SET_METHOD(exports, "setBooleanProperty", SetBooleanProperty);
	NODE_SET_METHOD(exports, "registerFloat64PropertyChanged", RegisterFloat64PropertyChanged);
	NODE_SET_METHOD(exports, "registerInt32PropertyChanged", RegisterInt32PropertyChanged);
	NODE_SET_METHOD(exports, "registerBooleanPropertyChanged", RegisterBooleanPropertyChanged);
	NODE_SET_METHOD(exports, "registerStringPropertyChanged", RegisterStringPropertyChanged);
	NODE_SET_METHOD(exports, "registerFloat64ArrayPropertyChanged", RegisterFloat64ArrayPropertyChanged);
	NODE_SET_METHOD(exports, "registerInt32ArrayPropertyChanged", RegisterInt32ArrayPropertyChanged);
}

NODE_MODULE(cameonomadAddon, init)

}
