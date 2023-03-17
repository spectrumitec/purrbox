'use strict';

/*

MIT License

Copyright (c) 2023 Cliff Sandford [cliffsandford1@gmail.com]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

//Import modules
import * as url from "node:url"
import * as path from "node:path";

//Set const
const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

//Define server
const vhost = await import(path.join(path.dirname(path.dirname(__dirname)),"class","manage.js"));

//Set response data
var _response = {
    "status_code":200,
    "headers":{
        "Content-Type":"application/json"
    },
    "body":null
}

//Module request
export async function request(params={}) {
    //Set const
    const _env = params._server.environment;
    const _server = params._server;
    const _client = params._client;
    const _raw_headers = params._raw_headers;
    const _request = {
        "method":params.method,
        "http_version":params.http_version,
        "protocol":params.protocol,
        "hostname":params.hostname,
        "path":params.path,
        "query":params.query
    }
    const _query = params.query;

    //Get query string
    if(_request.method == undefined) { _error("Method undefined"); return _response; }
    if(_request.method != "GET") {     _error("Method invalid"); return _response; }
	if(_query.action == undefined) {   _error("Missing API request"); return _response; }

    //Get properties
	let user_cookie = _client.cookie;
    let user_agent = _client.user_agent;
	let user_ip = _client.remote_ip;
	if(_client.remote_ip_xff) {
		user_ip = _client.remote_ip_xff;
	}
	
    //Create Class Object
	var mgmt = new vhost.manage_server(user_cookie, user_agent, user_ip);

	//Response
	let api_response = null;
	let response = {
		"error":"",
		"state":"unauthenticated",
		"authenticated":false,
		"data":{}
	}

	//Do action
	switch(_query.action) {
		//Get configs
		case "get_configs":
			api_response = mgmt.get_configs();
			if(api_response.data != undefined) {
				response.data = api_response.data;
			}
		break;

		//Projects
		case "project_new":
			api_response = mgmt.project_new(_query);
		break;
		case "project_delete":
			api_response = mgmt.project_delete(_query);
		break;
		case "project_set_property":
			api_response = mgmt.project_set_property(_query)
		break;

		//Templates
		case "templates_list":
			api_response = mgmt.template_list();
			if(api_response.data != undefined) {
				response.data = api_response.data;
			}
		break;
		case "template_create":
			api_response = mgmt.template_create(_query);
		break;
		case "template_delete":
			api_response = mgmt.template_delete(_query);
		break;

		//Websites manage
		case "website_new":
			api_response = mgmt.website_new(_query);
		break;
		case "website_rename":
			api_response = mgmt.website_rename_clone(_query);
		break;
		case "website_clone":
			api_response = mgmt.website_rename_clone(_query);
		break;
		case "website_delete":
			api_response = mgmt.website_delete(_query);
		break;

		//Websites settings
		case "website_set_property":
			api_response = mgmt.website_set_property(_query);
		break;
		case "website_map_new":
			api_response = mgmt.website_path_mapping_add(_query);
		break;
		case "website_map_delete":
			api_response = mgmt.website_path_mapping_delete(_query);
		break;

		//File Management
		case "files_get":
			api_response = mgmt.files_get(_query);
			if(api_response.data != undefined) {
				response.data = api_response.data;
			}
		break;
		case "files_view":
			api_response = mgmt.files_view(_query);
			if(api_response.data != undefined) {
				response.data = api_response.data;
			}
		break;
		case "files_add_folder":
			api_response = mgmt.files_add_folder(_query);
		break;
		case "files_add_file":
			api_response = mgmt.files_add_file(_query);
		break;
		case "files_delete":
			api_response = mgmt.files_delete(_query);
		break;

		//DNS Manage
		case "dns_add":
			api_response = mgmt.dns_add(_query);
		break;
		case "dns_delete":
			api_response = mgmt.dns_delete(_query);
		break;
		case "dns_update":
			api_response = mgmt.dns_update(_query);
		break;

		//Default mismatch action
		default:
			response.error = `Invalid request action [${_query.action}]`
	}

	//Handle API response
	if(api_response != null) {
		if(response.error != undefined) {
			if(api_response.error != "") {
				response.error = api_response.error;
			}
		}
		if(response.state != undefined) {
			response.state = api_response.state;
		}
		if(response.authenticated != undefined) {
			response.authenticated = api_response.authenticated;
		}
	}

	//Return response
	_end(response);

	//Return data
	return _response;
}

///////////////////////////////////////////
//Default function
///////////////////////////////////////////

function _error(out, status_code=200) {
    //Default content type
    if(status_code != 200) {
        _response["status_code"] = status_code;
    }
    _response["body"] = JSON.stringify({"error":out});
}
function _end(out) {
    //Default content type
    let content_type = "application/json";
    let content = {}
    
    //Test JSON
    try {
        content = JSON.stringify(out);
    }catch{
        content_type = "text/html";
        content = out;
    }

    //Set response
    _response["headers"]["Content-Type"] = content_type;
    _response["body"] = content;
}
