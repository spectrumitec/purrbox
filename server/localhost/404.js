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
	_response["body"] = `
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>Wonderbox</title>
                <meta name="description" content="Node.js Wonderbox">
                <meta name="author" content="Cliff Sandford">
                <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
        
                <link rel="stylesheet" href="/css/common.css">
        
            </head>
            <body>
                <!-- Page Header -->
                <div class="header" id="header">
                    <div class="header_logo"></div>
                    <div class="header_title">Node.js Wonderbox</div>
                </div>
                
                <!-- Page Content -->
                <div class="content" id="content">
                    <p>404 Page Not Found</p>
                </div>
        
            </body>
        </html>
    `;

    //Return
    return _response;
}

