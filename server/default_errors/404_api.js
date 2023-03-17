//Set response data
var _response = {
    "status_code":404,
    "headers":{
        "Content-Type":"text/html"
    },
    "body":""
}

//Module request
export async function request() {
	//Output
	_response["body"] = `{"error":"404 Not Found"}`;
    return _response;
}

