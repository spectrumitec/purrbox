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
	_response["body"] = `
		<!doctype html>
		<html lang='en'>
			<head>
				<meta charset='utf-8'>
				<title>Status 404</title>
				<meta name='description' content='404 Not Found'>
				<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
				<link rel='stylesheet' href='default_errors/css/common.css'>
			</head>
			<body>
				<!-- Page Content --> 
				<div class='content'>
					<div class='error_image'></div>
					<div class='error_message'>
						<p><b>404 Not Found</b></p>
						<p>
							Uh. Hmm, well, uh, I don't know where the page is not. It wouldn't be inaccurate to assume that I couldn't exactly not say that it is or isn't almost partially incorrect.
							On the contrary, I'm possibly more or less not definitely rejecting the idea that in no way with any amount of uncertainty that I undeniably do or do not know where 
							the page shouldn't probably be, if that indeed wasn't where it isn't. Even if the page wasn't at where I knew it was, that'd mean I'd really have to know where it wasn't.
						</p>
					</div>
				</div>
			</body>
		</html>
		`;

	//Return
	return _response;
}

