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

//Vars
var jwt_auth_mode = true;      //JWT Auth mode
var jwt_user = {
    "username":"",
    "name":"",
    "email":""
}

//User application authorize (pre-check for UI notification)
var user_authorize = {};

//Document load
$(document).ready(function() {
    //Set tabbed view
    $("#tabs").tabs();

    //Check auth
    auth_check()
});

/////////////////////////
// Auth Functions
/////////////////////////

//Auth check
function auth_check(response=null) {
    if(response == null) {
        log("auth_check :: send auth check")

        //Define JSON request
        let url = "api/auth";
        let json = {
            "action":"check"
        }

        //Set web_connector parameters
        let request = {
            "method":"POST",
            "url":url,
            "query":json,
            "callback":auth_check
        }

        //Call web_connector
        let auth_conn = new web_connector(request);
    }else{
        log("auth_check :: process response")

        //Process response
        if(response.state == "error") {
            web_conn_error(response); 
        }else{
            if(response.json.error != "") {
                web_conn_error(response); 
            }else{
                //Get auth init response
                let auth_init = response.json;

                //No authentication, go to init
                log(`Authentication Mode '${auth_init.mode}'`)

                //Action
                if(auth_init.mode == "none") {
                    jwt_auth_mode = false;
                    init();
                }else{
                    //Handle error
                    if(auth_init.error != "") {
                        dialog("Error",auth_init.error);
                    }else if(auth_init.authenticated == false){
                        auth_dialog();
                    }else{
                        //Handle states
                        switch(auth_init.state) {
                            case "OK": case "refresh":
                                //Set user properties
                                jwt_user.username = auth_init.username;
                                jwt_user.name = auth_init.name;
                                jwt_user.email = auth_init.email;
                                auth_user_init();

                                //Check refresh
                                if(auth_init.state == "refresh") {
                                    auth_refresh();
                                }
                            break;
                            default:
                                auth_user_reset();
                                auth_dialog();
                        }
                    }
                }
            }
        }
    }
}

//User login prompt
function auth_dialog(result=null) {
    //Cehck result passthrough (check result state)
    let message = "";
    if(result != null) {
        if(result.state != undefined) {
            switch(result.state) {
                case "unauthenticated":
                    message = "Session: <b>unauthenticated</b><br />";
                break;
                case "disabled":
                    message = "User State: <b>disabled</b><br />";
                break;
                case "locked":
                    message = "User State: <b>locked</b><br />";
                break;
                case "invalid":
                    message = "Session State: <b>invalid</b><br />";
                break;
                case "expired":
                    message = "Session State: <b>expired</b><br />";
                break;
            }
        }
    }

    //Set dialog HTML
    let html = `
        ${message}
        <form name="authentication">
            <div class="grid2 grid2_auth_user_dialog">
                <div class="grid1_col">Username</div>
                <div class="grid1_col">
                    <input id="auth_user" type="text" value="" autocomplete="off">
                </div>
                <div class="grid1_col">Password</div>
                <div class="grid1_col">
                    <input id="auth_pass" type="password" value="" autocomplete="off">
                </div>
            </div>
        </form>
        <br />
        <input id="auth_login" type="button" value="Login" onClick="auth_user()">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close')">
    `;
    dialog("User Authentication", html);

    //Set login button HTML
    html = `
        <div class="grid1">
            <div class="grid1_col">
                <input class="auth_button" type="button" value="Log On" onClick="auth_dialog();" />
            </div>
        </div>
    `;
    $("#authenticated_user").html(html);

    //Hide user drop down menu
    $("#auth_user_dropdown").css("visibility","hidden");

    //Add listener
    var auth_user = document.getElementById("auth_user");
    auth_user.addEventListener("keypress", function(event){
        if(event.key === "Enter") {
            event.preventDefault()
            document.getElementById("auth_pass").focus()
        }
    });
    var auth_pass = document.getElementById("auth_pass");
    auth_pass.addEventListener("keypress", function(event){
        if(event.key === "Enter") {
            event.preventDefault()
            document.getElementById("auth_login").click()
        }
    });
}
function auth_user(response=null) {
    if(response == null) {
        log("auth_user :: send auth")

        //Get field details
        let this_user = $("#auth_user").val();
        let this_pass = $("#auth_pass").val();

        //Check vars
        if(this_user == "") {
            alert("Username is blank, please specify a user name");
            return;
        }
        if(this_pass == "") {
            alert("Password cannot be blank");
            return;
        }
        $("#dialog").dialog("close");

        //Set username lowercase
        this_user = this_user.toLowerCase();

        //Define JSON request
        let url = "api/auth";
        let json = {
            "action":"login",
            "username":this_user,
            "password":this_pass
        }

        //Set web_connector parameters
        let request = {
            "method":"POST",
            "url":url,
            "query":json,
            "callback":auth_user
        }

        //Call web_connector
        let auth_conn = new web_connector(request);
    }else{
        log("auth_user :: response")

        if(response.error != "") {
            alert(`${response.status_code} :: ${response.state}`);
            auth_dialog(); 
        }else{
            if(response.json.error != "") {
                alert(response.json.error);
                auth_dialog(); 
            }else{
                log("auth_user :: Successful Login")
                let result = response.json;
                if(result.authenticated == true) {
                    //Set user parameters
                    jwt_user.username = response.json.username;
                    jwt_user.name = response.json.name;
                    jwt_user.email = response.json.email;
                    
                    //Initialize
                    auth_user_init();
                }else{
                    alert("Login Failed");
                    auth_dialog(result);
                }
            }
        }
    }
}

//Refresh token
function auth_refresh(response=null) {
    if(response == null) {
        log("auth_refresh :: request")

        //Define JSON request
        let url = "api/auth";
        let json = {
            "action":"refresh"
        }

        //Set web_connector parameters
        let request = {
            "method":"POST",
            "url":url,
            "query":json,
            "callback":auth_refresh
        }

        //Call web_connector
        let auth_conn = new web_connector(request);
    }else{
        log("auth_refresh :: response")

        //Check errors
        if(response.state == "error") {
            web_conn_error(response); 
        }else{
            log("auth_refresh :: Complete")

            if(response.json.authenticated == false) {
                log("auth_refresh :: No longer authenticated")
                auth_user_reset();
                auth_dialog();
            }
        }
    }
}

//User log off
function auth_logoff(response=null) {
    if(response == null) {
        log("auth_logoff :: request")

        //Define JSON request
        let url = "api/auth";
        let json = {
            "action":"logoff"
        }

        //Set web_connector parameters
        let request = {
            "method":"POST",
            "url":url,
            "query":json,
            "callback":auth_logoff
        }

        //Call web_connector
        let auth_conn = new web_connector(request);
    }else{
        log("auth_logoff :: response")

        if(response.state == "error") {
            //Reset session on page error
            web_conn_error(response); 
            auth_user_reset();
            auth_check();
        }else{
            auth_user_reset();
            auth_check();
        }
    }
}

//Handle user login or log off / reset user token
function auth_user_init() {
    log("auth_user_init")

    //Update login user
    let display_user = "";
    if(jwt_user.name != "") {
        display_user = jwt_user.name;
    }else{
        display_user = jwt_user.username;
    }

    //Set HTML (Logged in user)
    html = `
        <div class="grid2 grid2_auth_user">
            <div class="grid1_col">
                <img class="auth_user_icon" src="images/user_icon.png" alt="" />
            </div>
            <div class="grid1_col">
                <div class="auth_username">
                    ${display_user}
                </div>
            </div>
        </div>
    `;

    //Update user login box
    $("#authenticated_user").html(html);

    //Set HTML (user menu)
    html = `
        <div class="grid1 grid1_auth_user_select">
            <div class="grid1_col auth_user_menu_select" onClick="ui_admin_user_change_passwd();">Change Password &#8617;</div>
            <div class="grid1_col auth_user_menu_select" onClick="auth_logoff();">Log Off &#8617;</div>
        </div>
    `;

    //Update user drop down menu
    $("#auth_user_dropdown").css("visibility","visible");
    $("#auth_user_menu").html(html);

    //Initialize page
    init()
}
function auth_user_reset() {
    log("auth_user_reset")

    //Reset state
    jwt_user.username = "";
    jwt_user.name = "";
    jwt_user.email = "";

    //Reset user authorization
    user_authorize = {};

    //Reset HTML
    $("#authenticated_user").html("");
    $("#auth_user_menu").html("");

    //Reset panels
    $("#projects").html("");

    //Reset Vars
    server_configs = {};
    website_projects = {};
    focused_project = "";
    focused_panel = "";
    focused_site = "";

    server_paths = {};
    protected_paths = {};

    //Clear admin panel
    admin_panel = {};   
    $("#admin").html("");

    //Re-select first tab
    $("#tabs").tabs("option", "active", 0);
}

//API auth check
function auth_api_check(permission=null) {
    log("auth_api_check")

    console.log(user_authorize)

    //No auth return true
    if(jwt_init.auth == "none") {
        log("auth_api_check :: auth 'none', allow")
        return true;
    }else{
        log("auth_api_check :: check permission")

        //Permission check cannot be null
        if(permission == null) {
            log("auth_api_check :: permission is null, return default 'false'")
            alert("Permission has not been granted to this function");
            return false;
        }

        //Match permission
        let authorized = jwt_user.authorized;
        for(p in authorized) {
            if(authorized[p] == true) {
                log(`auth_api_check :: '${p}' set 'true' for user`)
                try{
                    if(permission.indexOf(p) > -1) {
                        log(`auth_api_check :: quick verify allows '${p}'`)
                        return true;
                    }
                }catch(error){
                    log(error);
                }
            }
        }

        //Catch all
        alert("Permission has not been granted to this function");
        return false;
    }
}

/////////////////////////
// Initialize Page
/////////////////////////

//Init page
function init() {
    //Init project page
    ui_projects_page_html();

    //Get configs
    get_configs();
}

// Console Log
function log(output) {
    //Enable via server settings
    if(server_configs.debug_mode_on == true) {
        mode = server_configs.debug_mode_on;
    }else{
        mode = false;
    }

    //TEMP
    mode = true;

    //Console output
    if(mode == true) { 
        let datestamp = get_datestamp();
        if(typeof output === "object") {
            console.log(output);
        }else{
            console.log(datestamp + " :: " + output); 
        }
    }
}

//Numeric datestamp
function padTo2Digits(num) {
    return num.toString().padStart(2, "0");
}
function padTo3Digits(num) {
    return num.toString().padStart(3, "0");
}
function get_datestamp() {
    let d = new Date();
    let yyyy = d.getFullYear();
    let mo   = padTo2Digits(d.getMonth() + 1);
    let dd   = padTo2Digits(d.getDate());
    let hh   = padTo2Digits(d.getHours());
    let mm   = padTo2Digits(d.getMinutes());
    let ss   = padTo2Digits(d.getSeconds());
    let ms   = padTo3Digits(d.getMilliseconds());
    let this_datestamp = yyyy + mo  + dd  + "." + hh  + mm  + ss + "." + ms;
    return this_datestamp;
}

//Web response error
function web_conn_error(response) {
    log("web_conn_error")

    let status_code = response.status_code.toString();
    let error = response.error.toString();
    let json = response.json;

    let this_html = "";
    if(status_code != "200") {
        log("web_conn_error :: status code error")
        this_html = `
            <p><b>Status Code:</b> ${status_code}</p>
            <p><b>Error:</b> ${error}</p>
        `;
    }else{
        log("web_conn_error :: general error")

        if(error != "") {
            this_html = `
                <b>Error:</b> ${error}<br />
            `;
        }else{
            this_html = `
                <b>Application Error:</b> ${json.error}<br />
            `;
        }

    }

    dialog("Error", this_html);
}

//Dialogs
function dialog(this_title="", this_html="") {
    log(`dialog(${this_title})`)
	$("#dialog").html(this_html);
	$("#dialog").dialog({
		title:this_title,
		closeText: "",
		modal: true,
		resizable: false,
		draggable: false,
		maxWidth:1250,
		maxHeight:600,
		width:"auto",
        height: "auto"
	});
    $("#dialog").dialog("open");
}

