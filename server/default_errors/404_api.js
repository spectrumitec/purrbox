//Set response data
var _response = {
    "status_code":404,
    "headers":{
        "Content-Type":"text/html"
    },
    "body":""
}

//Module request
exports.request = async function() {
	//Output
	_response["body"] = `{"error":"404 Not Found"}`;
    return _response;
}

