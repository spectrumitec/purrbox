//
// Your imports
//

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

    //
    // Your code here
    //

    //Validation checks
    if(_request.method == undefined) { _error("Method undefined"); return _response;  }
    if(_request.method != "GET") {     _error("Method invalid"); return _response; }

    //Dump variables from server
    _end({
        "_env":_env,
        "_server":_server,
        "_client":_client,
        "_raw_headers":_raw_headers,
        "_request":_request,
        "_query":_query
    });

    //Return data
    return _response;

    /*
    Examples:
        Returning text value
            _end("Some text output")
            return _response;

        Using a wait function
            //Async wait function (cannot use await at this level)
            var _wait_max_count = 1000;   //
            var _wait_count = 0;          // Check server async_wait settings
            var _wait_timer = 10;         //

            //Wait function
            function _wait() {
                if(app.db_status == "complete") {
                    _end(app.get_result())
                }else if(app.db_status == "error"){
                    _error(app.get_result())
                }else{
                    //Check count
                    if(_wait_count > _wait_max_count) {
                        _error("API timeout, DB query too long");
                    }else{
                        setTimeout(() => {
                            _wait();
                        }, _wait_timer);
                        _wait_count++;
                    }
                }
            }

            //Wait for response
            _wait();

            //Return response
            return _response;

    */
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
