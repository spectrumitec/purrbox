
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

//Set response data
var _response = {
    "status_code":200,
    "headers":{
        "Content-Type":"application/json"
    },
    "body":null
}

//Module request
exports.request = async function(params={}) {
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
    if(_request.protocol != "https") { _error("Authentication requests must be over SSL (HTTPS), node js server should be enabled for HTTPS"); return _response; }
    if(_request.method == undefined) { _error("Method Undefined"); return _response; }
    if(_request.method != "POST") {    _error("Request Method Invalid"); return _response; }

    //Get properties
	let user_cookie = _client.cookie;
    let user_agent = _client.user_agent;
	let user_ip = _client.remote_ip;
	if(_client.remote_ip_xff) {
		user_ip = _client.remote_ip_xff;
	}

    //Imports
    const path = require("path");
	const class_manage = path.join(path.dirname(path.dirname(__dirname)),"class","manage_server.js");

    //Create Class Object
    var manage_server = require(class_manage);
	var mgmt = new manage_server(user_cookie, user_agent, user_ip);

    //API response
    let api_response = {};

    //Return output
    switch(_query.action) {
        case "check":
            api_response = mgmt.jwt_auth_check();
            if(api_response.authenticated == false) {
                _response["headers"] = {
                    "Set-Cookie":`${user_cookie}; Expires=Tue, 1 Jan 1980 00:00:00 GMT;`,
                };
            }
        break;
        case "login":
            //Login 
            api_response = mgmt.jwt_user_auth(_query.username, _query.password);
            if(api_response.authenticated == true) {
                if(api_response.cookie != undefined) {
                    _response["headers"] = {
                        "Set-Cookie":`${api_response.cookie}; Secure; HttpOnly`,
                    };
                }
            }
            delete api_response.cookie;
        break;
        case "validate":
            api_response = mgmt.jwt_auth_validate();
        break;
        case "refresh":
            //Refresh
            api_response = mgmt.jwt_auth_refresh();
            if(api_response.authenticated == true) {
                if(api_response.cookie != undefined) {
                    _response["headers"] = {
                        "Set-Cookie":`${api_response.cookie}; Secure; HttpOnly`,
                    };
                }
            }
            delete api_response.cookie;
        break;
        case "logoff":
            api_response = mgmt.jwt_auth_logoff();
            //Expire cookie
            if(api_response.cookie != undefined) {
                _response["headers"] = {
                    "Set-Cookie":`${api_response.cookie}; Expires=Tue, 1 Jan 1980 00:00:00 GMT;`,
                };
            }
            delete api_response.cookie;
        break;
        case "change_password":
            api_response = mgmt.jwt_auth_user_reset_passwd(_query.passwd_old, _query.passwd_new);
        break;
        default:
            error_output(`Invalid Login Function [${_query.action}]`)
    }

    //Return response
    _end(api_response);
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
