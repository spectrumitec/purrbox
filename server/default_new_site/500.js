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
                <title>Your Site Title</title>
                <meta name="description" content="Website Description">
                <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
                <link rel="stylesheet" href="/css/common.css">
            </head>
            <body>
                <div class="header">
                    <div class="header_logo"></div>
                    <div class="header_title">Site Title</div>
                </div>
                <div class="body">
                    <div class="page">
                        <h3>500 Internal Server Error</h3>
                    </div>
                </div>
            </body>
        </html>
        `;

    //Return
    return _response;
}
