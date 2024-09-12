/////////////////////////////////////////////////
// Your Imports Here
//

//Imports
const fs = require("fs");
const path = require("path");

/////////////////////////////////////////////////

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
    const _headers = params._headers;
    const _request = params._request;
    const _query = params._query;

    //Validation checks
    if(_request.method == undefined) { _error("Method undefined"); return _response;  }
    if(_request.method != "GET") {     _error("Method invalid"); return _response; }

	/////////////////////////////////////////////////
	// Your Code Here
	//
	
	//Message file
	let message_file = path.join(path.dirname(__dirname), "message.txt");

    //Get file
	let message = "";
	if(fs.existsSync(message_file)) {
		try{
			message = (fs.readFileSync(message_file)).toString();
		}catch(err) {
			message = "Failed to retreive user message";
		}
	}

	/////////////////////////////////////////////////

    //Dump variables from server
    _return(message);

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
function _return(out) {
    //Default content type
    let content_type = "application/json";
    let content = {}
	
	//Set response type
	switch(typeof(out)) {
		case "object":
			content_type = "application/json";
			try {
				content = JSON.stringify(out);
			}catch{
				content_type = "text/html";
				content = out;
			}
		break;
        default:
			content_type = "text/html";
			content = out;
	}

    //Set response
    _response["headers"]["Content-Type"] = content_type;
    _response["body"] = content;
}

/////////////////////////////////////////////////
// Your Functions Here
//

