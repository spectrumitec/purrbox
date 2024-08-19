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
var server_configs = {};
var website_projects = {};
var focused_project = "";
var focused_panel = "";
var focused_site = "";

var server_paths = {};
var protected_paths = {};

//Project files (caller)
var project_files_folder_open = [];
var project_files_selected_object = "";

//Admin panel temp store
var admin_panel = {};

//////////////////////////////////////
// Common methods
//////////////////////////////////////

var _web_calls = {};
function web_calls() {
    //Handle function call
    if(arguments[0] != undefined) {
        if(arguments[0].id != "web_connector") {
            //Set request
            let req = arguments[0];

            //Initialize web connection
            log(`web_calls :: id = ${req.id}`)

            //Get vars
            let uuid = get_uuid();

            //Set web_connector parameters
            let request = {
                "id":req.id,
                "uuid":uuid,
                "method":req.method,
                "url":req.url,
                "query":req.query,
                "callback":web_calls
            }

            //Store args
            _web_calls[uuid] = req;
            _web_calls[uuid]["web_conn"] = new web_connector(request);
        }else{
            //Handle web response
            log(`web_calls :: web_connector response`)

            //web_connector response -- get _web_call UUID
            let res = arguments[0];         //web_connector response
            let uuid = res.request.uuid;    //Get UUID from original request
            let req = _web_calls[uuid];     //Retrieve original request parameters

            //Delete web connector
            delete _web_calls[uuid];        //Delete web call data

            //Check web connector error
            if(res.error != "") {
                //Web connector error
                web_conn_error(res);
            }else{
                //Check JSON errors
                if(res.json == undefined) {
                    dialog("Error","Missing data response"); 
                }else{
                    //Check authenticated
                    let result = res.json;

                    //Check JSON error
                    if(result.error == undefined) {
                        dialog("Error","Malformed response from server");
                    }else if(result.error != "") {
                        dialog("Error",result.error);
                    }else{
                        //Auth state check
                        if(jwt_auth_mode == true) {
                            if(result.authenticated == false) {
                                auth_user_reset();
                                auth_dialog(result);
                                return;
                            }
                            if(result.state == "refresh") {
                                auth_refresh();
                            }
                        }

                        //Error state OK, auth OK, call functions
                        if(req.func_call != null) {
                            let func_call = req.func_call;
                            func_call(result.data);
                        }
                    }
                }
            }
        }
    }
}
//UUID tracking
function get_uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

//API pre-checks
function api_check_global(permissions=[]) {
    log("api_check_global")

    //No auth return true
    if(jwt_auth_mode == false) {
        log("api_check_global :: auth 'none', allow")
        return true;
    }else{
        log("api_check_global :: check permission")

        //Set vars
        let global = {}

        //Get user permission state
        if(user_authorize.global_authorize != undefined) {
            global = user_authorize.global_authorize;
        }

        //Check administrators
        if(global["admins"] != undefined) {
            log("api_check_global :: User is an admin")
            return true;
        }

        //Check project permission level
        if(permissions.length > 0) {
            for(let i in permissions) {
                let permission = permissions[i];
                if(global[permission] == true) {
                    log(`api_check_global :: User permission[${permission}]`)
                    return true;
                }
            }
        }

        //Catch all
        log("api_check_global :: User is not permitted")
        return false;
    }
}
function api_check_project(permissions=[]) {
    log("api_check_project")

    //No auth return true
    if(jwt_auth_mode == false) {
        log("api_check_project :: auth 'none', allow")
        return true;
    }else{
        log("api_check_project :: check permission")

        //Set vars
        let global = {}
        let admins = []
        let authorized = {}

        //Get user permission state
        if(user_authorize.global_authorize != undefined) {
            global = user_authorize.global_authorize;
        }
        if(user_authorize.project_admin != undefined) {
            admins = user_authorize.project_admin;
        }
        if(user_authorize.project_authorize != undefined) {
            if(user_authorize.project_authorize[focused_project] != undefined) {
                authorized = user_authorize.project_authorize[focused_project];
            }
        }

        //Check administrators
        if(global["admins"] != undefined) {
            log("api_check_project :: User is an admin")
            return true;
        }

        //Check project admin level
        if(admins.indexOf(focused_project) > -1) {
            log(`api_check_project :: User is an admin of project[${focused_project}]`)
            return true;
        }

        //Check project permission level
        if(permissions.length > 0) {
            for(let i in permissions) {
                let permission = permissions[i];
                if(authorized[permission] == true) {
                    log(`api_check_project :: Project[${focused_project}] - Permission granted for [${permission}]`)
                    return true;
                }
            }
        }

        //Catch all
        log("api_check_project :: User is not permitted")
        return false;
    }
}

//////////////////////////////////////
// API functions
//////////////////////////////////////

//Get configs
function get_configs() {
    log("get_configs")
    
    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"get_configs"
    }

    //Set call parameters
    let params = {
        "id":"get_configs",
        "func_call":ui_build_page_content,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Validate project configuration
function project_config_validate() {
    log("project_config_validate");

    //
    // Valid flag
    //   valid = 0      Good
    //   valid = 1      Warning
    //   valid = 2      Error
    //

    //Loop project structure
    for(project in website_projects) {
        //Default
        website_projects[project]["valid"] = 0;
        website_projects[project]["valid_notes"] = "";

        //Check project description
        if(website_projects[project]["project_desc"] == undefined) { 
            website_projects[project]["valid"] = 2;
            website_projects[project]["valid_notes"] += "Missing [project_desc] field<br />";
            website_projects[project]["project_desc"] = "";
        }

        //Check project enabled setting
        if(website_projects[project]["enabled"] == undefined) { 
            website_projects[project]["valid"] = 2;
            website_projects[project]["valid_notes"] += "Missing [enabled] field<br />";
            website_projects[project]["enabled"] = false;
        }else if(typeof(website_projects[project]["enabled"]) != "boolean") { 
            website_projects[project]["valid"] = 2;
            website_projects[project]["valid_notes"] += "field [enabled] is not a boolean type<br />";
            website_projects[project]["enabled"] = false;
        }

        //Proxy map check
        if(website_projects[project]["proxy_map"] == undefined || typeof(website_projects[project]["proxy_map"]) != "object") { 
            website_projects[project]["valid"] = 2;
            website_projects[project]["valid_notes"] += "Missing or Invalid [proxy_map] configuration section<br />";
            website_projects[project]["proxy_map"] = {
                "dev": {},
                "qa": {},
                "stage": {},
                "prod": {}
            }
        }else{ 
            if(website_projects[project]["proxy_map"]["dev"] == undefined || typeof(website_projects[project]["proxy_map"]["dev"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [proxy_map][dev] configuration section<br />";
                website_projects[project]["proxy_map"]["dev"] = {}
            }else{
                for(let proxy in website_projects[project]["proxy_map"]["dev"]) {
                    if(website_projects[project]["proxy_map"]["dev"][proxy] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `Proxy Map [proxy_map][dev][${proxy}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["proxy_map"]["qa"] == undefined || typeof(website_projects[project]["proxy_map"]["qa"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [proxy_map][qa] configuration section<br />";
                website_projects[project]["proxy_map"]["qa"] = {}
            }else{
                for(let proxy in website_projects[project]["proxy_map"]["qa"]) {
                    if(website_projects[project]["proxy_map"]["qa"][proxy] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `Proxy Map [proxy_map][qa][${proxy}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["proxy_map"]["stage"] == undefined || typeof(website_projects[project]["proxy_map"]["stage"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [proxy_map][stage] configuration section<br />";
                website_projects[project]["proxy_map"]["stage"] = {}
            }else{
                for(let proxy in website_projects[project]["proxy_map"]["stage"]) {
                    if(website_projects[project]["proxy_map"]["stage"][proxy] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `Proxy Map [proxy_map][stage][${proxy}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["proxy_map"]["prod"] == undefined || typeof(website_projects[project]["proxy_map"]["prod"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [proxy_map][prod] configuration section<br />";
                website_projects[project]["proxy_map"]["prod"] = {}
            }else{
                for(let proxy in website_projects[project]["proxy_map"]["prod"]) {
                    if(website_projects[project]["proxy_map"]["prod"][proxy] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `Proxy Map [proxy_map][prod][${proxy}] is not linked to a website<br />`;
                    }
                }
            }
        }

        //DNS map check
        if(website_projects[project]["dns_names"] == undefined || typeof(website_projects[project]["dns_names"]) != "object") { 
            website_projects[project]["valid"] = 2;
            website_projects[project]["valid_notes"] += "Missing or Invalid [dns_names] configuration section<br />";
            website_projects[project]["dns_names"] = {
                "dev": {},
                "qa": {},
                "stage": {},
                "prod": {}
            }
        }else{ 
            if(website_projects[project]["dns_names"]["dev"] == undefined || typeof(website_projects[project]["dns_names"]["dev"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [dns_names][dev] configuration section<br />";
                website_projects[project]["dns_names"]["dev"] = {}
            }else{
                for(let dns_name in website_projects[project]["dns_names"]["dev"]) {
                    if(website_projects[project]["dns_names"]["dev"][dns_name] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `DNS Name [dns_names][dev][${dns_name}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["dns_names"]["qa"] == undefined || typeof(website_projects[project]["dns_names"]["qa"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [dns_names][qa] configuration section<br />";
                website_projects[project]["dns_names"]["qa"] = {}
            }else{
                for(let dns_name in website_projects[project]["dns_names"]["qa"]) {
                    if(website_projects[project]["dns_names"]["qa"][dns_name] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `DNS Name [dns_names][qa][${dns_name}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["dns_names"]["stage"] == undefined || typeof(website_projects[project]["dns_names"]["stage"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [dns_names][stage] configuration section<br />";
                website_projects[project]["dns_names"]["stage"] = {}
            }else{
                for(let dns_name in website_projects[project]["dns_names"]["stage"]) {
                    if(website_projects[project]["dns_names"]["stage"][dns_name] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `DNS Name [dns_names][stage][${dns_name}] is not linked to a website<br />`;
                    }
                }
            }
            if(website_projects[project]["dns_names"]["prod"] == undefined || typeof(website_projects[project]["dns_names"]["prod"]) != "object") {
                website_projects[project]["valid"] = 2;
                website_projects[project]["valid_notes"] += "Missing or Invalid [dns_names][prod] configuration section<br />";
                website_projects[project]["dns_names"]["prod"] = {}
            }else{
                for(let dns_name in website_projects[project]["dns_names"]["prod"]) {
                    if(website_projects[project]["dns_names"]["prod"][dns_name] == "") {
                        if(website_projects[project]["valid"] == 0) {
                            website_projects[project]["valid"] = 1;
                        }
                        website_projects[project]["valid_notes"] += `DNS Name [dns_names][prod][${dns_name}] is not linked to a website<br />`;
                    }
                }
            }
        }

        //Check project websites structure
        if(website_projects[project]["websites"] != undefined) { 
            for(website in website_projects[project]["websites"]) {
                //Check website config structure
                if(website_projects[project]["websites"][website]["ssl_redirect"] == undefined) {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["websites"][website]["ssl_redirect"] = true;
                }

                //Check if maintenance mode is an object (dev, qa, stage and prod)
                if(website_projects[project]["websites"][website]["maintenance"] == undefined || typeof(website_projects[project]["websites"][website]["maintenance"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][maintenance] configuration section<br />`;
                    website_projects[project]["websites"][website]["maintenance"] = {
                        "dev": false,
                        "qa": false,
                        "stage": false,
                        "prod": false
                    }
                }else{
                    if(website_projects[project]["websites"][website]["maintenance"]["dev"] == undefined || typeof(website_projects[project]["websites"][website]["maintenance"]["dev"]) != "boolean") {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][maintenance][dev] configuration section<br />`;
                        website_projects[project]["websites"][website]["maintenance"]["dev"] = false;
                    }
                    if(website_projects[project]["websites"][website]["maintenance"]["qa"] == undefined || typeof(website_projects[project]["websites"][website]["maintenance"]["dev"]) != "boolean") {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][maintenance][qa] configuration section<br />`;
                        website_projects[project]["websites"][website]["maintenance"]["qa"] = false;
                    }
                    if(website_projects[project]["websites"][website]["maintenance"]["stage"] == undefined || typeof(website_projects[project]["websites"][website]["maintenance"]["dev"]) != "boolean") {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][maintenance][stage] configuration section<br />`;
                        website_projects[project]["websites"][website]["maintenance"]["stage"] = false;
                    }
                    if(website_projects[project]["websites"][website]["maintenance"]["prod"] == undefined || typeof(website_projects[project]["websites"][website]["maintenance"]["dev"]) != "boolean") {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][maintenance][prod] configuration section<br />`;
                        website_projects[project]["websites"][website]["maintenance"]["prod"] = false;
                    }
                }

                //Check default maintenance page
                if(website_projects[project]["websites"][website]["maintenance_page"] == undefined) {   
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Missing [${website}][maintenance_page] field<br />`;
                    website_projects[project]["websites"][website]["maintenance_page"] = "";
                }

                //Check default document
                if(website_projects[project]["websites"][website]["default_doc"] == undefined) {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Missing [${website}][default_doc] field<br />`;
                    website_projects[project]["websites"][website]["default_doc"] = "";
                }

                //Check error pages
                if(website_projects[project]["websites"][website]["default_errors"] == undefined || typeof(website_projects[project]["websites"][website]["default_errors"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Missing or Invalid [${website}][default_errors] configuration section<br />`;
                    website_projects[project]["websites"][website]["default_errors"] = {
                        //"401": "",      // Unauthorized
                        //"403": "",      // Forbidden
                        "404": "",      // Not Found
                        //"405": "",      // Method not allowed
                        //"408": "",      // Request Timeout
                        //"414": "",      // URI Too Long
                        "500": ""       // Internal Server Error
                    }
                }else{
                    /*
                    if(website_projects[project]["websites"][website]["default_errors"]["401"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][401] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["401"] = "";
                    }
                    if(website_projects[project]["websites"][website]["default_errors"]["403"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][403] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["403"] = "";
                    }
                    */
                    if(website_projects[project]["websites"][website]["default_errors"]["404"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][404] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["404"] = "";
                    }
                    /*
                    if(website_projects[project]["websites"][website]["default_errors"]["405"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][405] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["405"] = "";
                    }
                    if(website_projects[project]["websites"][website]["default_errors"]["408"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][408] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["408"] = "";
                    }
                    if(website_projects[project]["websites"][website]["default_errors"]["414"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][414] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["414"] = "";
                    }
                    */
                    if(website_projects[project]["websites"][website]["default_errors"]["500"] == undefined) {
                        website_projects[project]["valid"] = 2;
                        website_projects[project]["valid_notes"] += `Missing [${website}][default_errors][500] field<br />`;
                        website_projects[project]["websites"][website]["default_errors"]["500"] = "";
                    }
                }

                //Check apis_fixed_path
                if(website_projects[project]["websites"][website]["apis_fixed_path"] == undefined || typeof(website_projects[project]["websites"][website]["apis_fixed_path"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Invalid [${website}][apis_fixed_path] configuration section<br />`;
                    website_projects[project]["websites"][website]["apis_fixed_path"] = {}
                }
                if(website_projects[project]["websites"][website]["apis_dynamic_path"] == undefined || typeof(website_projects[project]["websites"][website]["apis_dynamic_path"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Invalid [${website}][apis_dynamic_path] configuration section<br />`;
                    website_projects[project]["websites"][website]["apis_dynamic_path"] = {}
                }
                if(website_projects[project]["websites"][website]["path_static"] == undefined || typeof(website_projects[project]["websites"][website]["path_static"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Invalid [${website}][path_static] configuration section<br />`;
                    website_projects[project]["websites"][website]["path_static"] = {}
                }
                if(website_projects[project]["websites"][website]["path_static_server_exec"] == undefined || typeof(website_projects[project]["websites"][website]["path_static_server_exec"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Invalid [${website}][path_static_server_exec] configuration section<br />`;
                    website_projects[project]["websites"][website]["path_static_server_exec"] = {}
                }
                if(website_projects[project]["websites"][website]["sub_map"] == undefined || typeof(website_projects[project]["websites"][website]["sub_map"]) != "object") {
                    website_projects[project]["valid"] = 2;
                    website_projects[project]["valid_notes"] += `Invalid [${website}][sub_map] configuration section<br />`;
                    website_projects[project]["websites"][website]["sub_map"] = {}
                }
            }
        }

        //Log invalid
        let log_msg = "good";
        if(website_projects[project]["valid"] > 0) {
            if(website_projects[project]["valid"] == 1) {
                log_msg = "warning";
            }else if(website_projects[project]["valid"] == 2) {
                log_msg = "error";
            }

            log(`project_config_validate :: invalid config for project[${project}] state[${log_msg}]`);
        }

    }
}

//Manage projects
function project_new() {
    log("project_new");

    //Get fields
    let this_project = $("#project_new_name").val();
    let this_desc = $("#project_new_desc").val();
    $("#dialog").dialog("close");

    //Validate field
    if(this_project == "") {
        dialog("Error","Project Name cannot be blank")
        return;
    }

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"project_new",
        "project":this_project,
        "desc":this_desc
    }

    //Set call parameters
    let params = {
        "id":"project_new",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function project_delete() {
    log("project_delete");

    //Close dialog
    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"project_delete",
        "project":focused_project
    }

    //Set call parameters
    let params = {
        "id":"project_delete",
        "func_call":project_delete_reset,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function project_delete_reset() {
    //Clear management page
    $("#project_title").html("");
    $("#project_panel").html("");

    //Reset focus
    focused_project = "";
    focused_panel = "";
    focused_site = "";
    get_configs();
}
function project_set_property(property, value) {
    log("project_set_property")

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"project_set_property",
        "project":focused_project,
        "property":property,
        "value":value
    }

    //Set call parameters
    let params = {
        "id":"project_set_property",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function project_fix_config() {
    log("project_fix_config");

    //Validate project focus
    if(focused_project == "") {
        dialog("Error", "Project is not selected");
        return;
    }

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"project_config_fix",
        "project":focused_project
    }

    //Set call parameters
    let params = {
        "id":"project_config_fix",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Notice
    dialog_title = "Notice";
    dialog_message = `
        The server will check configuration structure and will<br />
        replace missing fields. This will not erase existing<br />
        configuration settings.`;
    dialog(dialog_title,dialog_message);

    //Execute call
    web_calls(params)
}

//Templates tab
function templates_list() {
    log("templates_list")

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"templates_list"
    }

    //Set call parameters
    let params = {
        "id":"templates_list",
        "func_call":ui_templates_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Templates management
function template_create() {
    log("template_create");

    //API check done at UI dialog

    //Get fields
    let this_name = $("#template_name").val();
    let this_desc = $("#template_desc").val();

    //Loop all checkboxes
    let this_sites = []
    $("input:checkbox").each(function(){
        if($(this).attr('id') == "template_site") {
            if(this.checked == true) {
                let this_value = $(this).attr('value'); 
                this_sites.push(this_value)
            }
        }
    });

    //Close dialog
    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"template_create",
        "project":focused_project,
        "template": this_name,
        "desc": this_desc,
        "sites": this_sites
    }

    //Set call parameters
    let params = {
        "id":"template_create",
        "func_call":null,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function template_delete() {
    log("template_delete");
    
    //API check done at UI dialog

    //Get tempalte name
    let this_template = $("#template_name").val();

    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"template_delete",
        "template":this_template
    }

    //Set call parameters
    let params = {
        "id":"template_delete",
        "func_call":templates_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Manage project websites
function website_new_blank() {
    log("website_new_blank");
    
    //Get fields
    let this_type = $("#new_site_type").val();
    let this_site = $("#new_site_name").val();

    //Close dialog
    $("#dialog").dialog("close");

    //Validate
    if(this_site == "") {
        dialog("Error","Site name cannot be blank")
        return;
    }

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_new",
        "type":this_type,
        "project":focused_project,
        "site":this_site
    }

    //Set call parameters
    let params = {
        "id":"website_new_blank",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function website_new_from_template() {
    log("website_new_from_template");
    
    //Get fields
    let this_template = "";

    //Get radio button settings
    $("input:radio").each(function(){
        if($(this).attr('id') == "new_site_template") {
            if(this.checked == true) {
                this_template = $(this).attr('value');
            }
        }
    });            

    $("#dialog").dialog("close");

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_new",
        "type":"template",
        "project":focused_project,
        "template":this_template
    }

    //Set call parameters
    let params = {
        "id":"website_new_from_template",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function website_new_templates_list() {
    log("templates_list_dialog")

    //API check not needed, called from template create dialog

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"templates_list"
    }

    //Set call parameters
    let params = {
        "id":"templates_get",
        "func_call":ui_website_new_templates_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function website_delete(site_name) {
    log("website_delete");

    //Get fields
    $("#dialog").dialog("close");

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_delete",
        "project":focused_project,
        "site":site_name
    }

    //Set call parameters
    let params = {
        "id":"website_delete",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function website_rename_clone(action) {
    log("website_rename_clone");
    
    //Get fields
    let curr_site = $("#current_site_name").val();
    let new_site = $("#new_site_name").val();
    $("#dialog").dialog("close");

    //Validate
    if(new_site == "") {
        dialog("Error","Site name cannot be blank")
        return;
    }

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":`website_${action}`,
        "project":focused_project,
        "curr_site":curr_site,
        "new_site":new_site
    }

    //Set call parameters
    let params = {
        "id":"website_rename_clone",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Manage project website settings
function website_set_property(property, value, env=null) {
    log("website_set_property")

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_set_property",
        "project":focused_project,
        "site":focused_site,
        "property":property,
        "value":value
    }

    //Maintenance mode use property
    if(property == "maintenance_enabled") {
        json["env"] = env
    }

    //Set call parameters
    let params = {
        "id":"website_property",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    console.log(json)

    //Execute call
    web_calls(params)
}

//Manage project website mapping
function website_path_mapping_add() {
    log("website_path_mapping_add");
    
    //Get fields
    let this_web_path = $("#website_web_path").val();
    let this_map_path = $("#website_map_path").val();
    let this_type = $("#website_map_type").val();
    $("#dialog").dialog("close");

    //Check form fields
    if(this_web_path == "" || this_web_path == null) {
        dialog("Error", "Web path is blank, cancel change");
        return;
    }
    if(this_map_path == "" || this_map_path == null) {
        dialog("Error", "Map path is blank, cancel change");
        return;
    }
    if(this_type == "" || this_type == null) {
        dialog("Error", "Undefined set type, cancel change");
        return;
    }

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_map_new",
        "project":focused_project,
        "site":focused_site,
        "type":this_type,
        "web_path":encodeURIComponent(this_web_path),
        "map_path":encodeURIComponent(this_map_path)
    }

    //Set call parameters
    let params = {
        "id":"website_path_mapping_add",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function website_path_mapping_delete() {
    log("website_path_mapping_delete");
            
    //Get fields
    let this_type = $("#delete_map_type").val();
    let this_path = $("#delete_map_path").val();
    $("#dialog").dialog("close");

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"website_map_delete",
        "project":focused_project,
        "site":focused_site,
        "type":this_type,
        "web_path":encodeURIComponent(this_path)
    }

    //Set call parameters
    let params = {
        "id":"website_path_mapping_delete",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Get project files list
function files_get(callback) {
    log("files_get")

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"files_get",
        "project":focused_project
    }

    //Set call parameters
    let params = {
        "id":"files_get",
        "func_call":callback,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function files_view(file_path) {
    log("files_view")

    //API pre-check
    if(api_check_project(["files_adm", "files_read"]) == false) { return }

    //Get path
    selected_path = escape(file_path.id);

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"files_view",
        "project":focused_project,
        "target_file":encodeURIComponent(selected_path)
    }

    //Set call parameters
    let params = {
        "id":"files_view",
        "func_call":ui_project_files_viewer,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function files_add() {
    log("files_add");

    //Get fields
    let this_files_type = $("#files_add_type").val();

    //Set URL path
    let url = "api/ui_manage";
    let json = {}

    //Set request
    if(this_files_type == "file") {

        log("files_add :: type[file]");

        //Get fields
        let this_path = escape(project_files_selected_object.id);
        let this_file_type = $('input[name="file_type"]:checked').val();
        let this_file_name = $("#new_file_name").val();
        $("#dialog").dialog("close");

        //Check blank fields
        if(this_file_type == undefined) {
            dialog("Error", "File type not selected");
            return;
        }
        if(this_file_name == "") {
            dialog("Error", "File name not defined");
            return;
        }

        //Set URL
        json = {
            "action":"files_add_file",
            "project":focused_project,
            "path":encodeURIComponent(this_path),
            "file_type":this_file_type,
            "file_name":this_file_name
        }
    }else{

        log("files_add :: type[folder]");

        //Get fields
        let this_path = escape(project_files_selected_object.id);
        let this_folder = $("#new_folder_name").val();
        $("#dialog").dialog("close");

        if(this_folder == "") {
            dialog("Error", "File name not defined");
            return;
        }

        //Set URL
        json = {
            "action":"files_add_folder",
            "project":focused_project,
            "path":encodeURIComponent(this_path),
            "folder":this_folder
        }
    }

    //Set call parameters
    let params = {
        "id":"files_add",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function files_delete() {
    log("files_delete");
    
    //Get fields
    let this_path = escape(project_files_selected_object.id);
    $("#dialog").dialog("close");

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"files_delete",
        "project":focused_project,
        "path":encodeURIComponent(this_path)
    }

    //Set call parameters
    let params = {
        "id":"files_delete",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Manage Porject DNS
function dns_add() {
    log("dns_add");

    //Get fields
    let this_env = $("#dns_env").val();
    let this_dns = $("#dns_name").val();
    let this_site = $("#site_name").val();
    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"dns_add",
        "project":focused_project,
        "env": this_env,
        "dns": this_dns,
        "site": this_site
    }

    //Set call parameters
    let params = {
        "id":"dns_add",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function dns_delete() {
    log("dns_delete");

    //Get fields
    let this_env = $("#dns_env").val();
    let this_dns = $("#dns_name").val();
    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"dns_delete",
        "project":focused_project,
        "env": this_env,
        "dns": this_dns
    }

    //Set call parameters
    let params = {
        "id":"dns_delete",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function dns_update(env, dns_site) {
    log("dns_update");

    //API pre-check
    if(api_check_project(["dns_adm"]) == false) { return }

    //Parse dns_site
    let this_change = dns_site.split(":");
    let this_dns = this_change[0];
    let this_site = this_change[1];
    
    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"dns_update",
        "project":focused_project,
        "env": env,
        "dns": this_dns,
        "site": this_site
    }

    //Set call parameters
    let params = {
        "id":"dns_update",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//////////////////////////////////////
// Projects UI Functions
//////////////////////////////////////

//Tooltip
$(function() {
    $(document).tooltip();
});

function ui_panel_read_only() {
    log("ui_panel_read_only")
    
    //Read only banner
    let html_read_only_banner = `
        <div class="grid2_inner">
            <div class="grid1_inner_col">
                <div class="panel_read_access_image"></div>
            </div>
            <div class="grid1_inner_col">
                <div class="panel_read_access_text">Read Only Access</div>    
            </div>
        </div><br />
    `;

    return html_read_only_banner;
}

//Build initial page layout
function ui_projects_page_html() {
    log("ui_projects_page_html")

    //Set HTML
    let html = `
        <div class="project_list">
            <div class="project_menu">
                <div id="project_new" class="project_menu_btn project_menu_btn_new" onClick="ui_project_new();" title="New Project"></div>
                <div id="template_new" class="project_menu_btn project_menu_btn_template" onClick="ui_template_create();" title="New Template"></div>
                <div id="project_refresh" class="project_menu_btn project_menu_btn_refresh" onClick="get_configs();" title="Refresh Projects"></div>
                <div id="project_delete" class="project_menu_btn project_menu_btn_trash" onClick="ui_project_delete();" title="Delete Project"></div>
            </div>
            <div class="project_tree" id="project_tree"></div>
        </div>
        <div class="project_manage" id="project_manage">
            <div class="project_title" id="project_title"></div>
            <div class="project_panel" id="project_panel"></div>
        </div>
    `;

    //Update panel
    $("#projects").html(html);
}

//Build page content
function ui_build_page_content(data) {
    log("ui_build_page_content")

    //Store configs
    server_configs = data.server;
    website_projects = data.projects;

    //Paths
    server_paths = data.paths;
    protected_paths = data.protected_paths;

    //Validate project configuration files
    project_config_validate()

    //Get user settings
    if(data.user_authorize != undefined) {
        user_authorize = data.user_authorize;
    }

    //Check user is admin
    if(jwt_auth_mode == true) {
        $("#tabs .ui-tabs-nav a").each(function(index, element){
            //Hide Admin for non-admin
            if($(this).html() == "Admin") { 
                if(user_authorize.admin == false) {
                    $(this).hide();
                }else{
                    $(this).show();
                }
            }
        });
    }

    //Build Website Projects Page
    ui_build_tree_nav();

    //Build panel window
    ui_build_content_panel();

    //Re-select first tab
    $("#tabs").tabs("option", "active", 0);
}

//Format directory list for jsTree output
// files='no_files' removes the file type from directory
//
function ui_dir_jstree_format(dir, files="") {
    //Loop directory and define icons
    for(let i in dir) {
        //Remove file from list (for use with folder select)
        if(files == "no_files") {
            if(dir[i].type == "file") {
                delete dir[i];
                continue;
            }
        }

        //Determine if locked (delete protected)
        let locked = "";
        if(protected_paths[dir[i].id] != undefined) {
            locked = "locked_";
        }

        //Define icons
        if(dir[i].type == "file") {
            //Set icon
            switch(dir[i].ext) {
                case ".html":   dir[i]["icon"] = `images/file_html_${locked}icon.png`; break;
                case ".js":     dir[i]["icon"] = `images/file_js_${locked}icon.png`; break;
                case ".css":    dir[i]["icon"] = `images/file_json_css_${locked}icons.png`; break;
                case ".json":   dir[i]["icon"] = `images/file_json_css_${locked}icons.png`; break;
                case ".txt":    dir[i]["icon"] = `images/file_txt_${locked}icon.png`; break;
                default:        dir[i]["icon"] = `images/file_${locked}icon.png`; break;
            }
        }else{
            //Set icon
            dir[i]["icon"] = `images/closed_folder_${locked}icon.png`;
        }

        //Define state for item
        dir[i]["state"] = {
            "opened":false,
            "disabled":false,
            "selected":false
        }

        //Set text
        dir[i]["text"] = dir[i]["name"];

        //Run against sub tree
        if(dir[i].children.length > 0) {
            ui_dir_jstree_format(dir[i].children, files);
        }
    }

    //Return dir
    return dir;
}
function ui_dir_jstree_state(dir) {
    //Loop directory and define icons
    for(let i in dir) {

        //Check selected
        if(dir[i].id == project_files_selected_object.id) {
            dir[i]["state"]["selected"] = true;
        }

        //Determine if locked (delete protected)
        let locked = "";
        if(protected_paths[dir[i].id] != undefined) {
            locked = "locked_";
        }

        //Define icons
        if(dir[i].type == "dir") {
            //Check if opened
            let opened = false;
            if(project_files_folder_open.indexOf(dir[i].id) > -1) {
                opened = true;
            }

            //Define state for item
            dir[i]["state"]["opened"] = opened;
            dir[i]["icon"] = `images/open_folder_${locked}icon.png`;
        }

        //Run against sub tree
        if(dir[i].children.length > 0) {
            ui_dir_jstree_state(dir[i].children);
        }
    }

    //Return dir
    return dir;
}

//Project tree list
function ui_build_tree_nav() {
    log("ui_build_tree_nav");

    //Build tree view base
    let project_all = [];

    //Loop projects
    for(project in website_projects) {
        log(`ui_build_tree_nav :: project[${project}]`)

        let this_project = null;
        if(website_projects[project]["state"] == "disabled") {
            //Create 
            this_project = {
                "id" : `project::${project}`,
                "text" : project,
                "icon" : "images/box_disabled_icon.png",
                "state" : {
                    "opened" : false,
                    "selected" : false,
                    "disabled" : true
                },
                "children": []
            }            
        }else{
            //Check focused project
            let this_opened = false;
            if(focused_project == project) {
                this_opened = true;
            }

            //Create 
            this_project = {
                "id" : `project::${project}`,
                "text" : project,
                "icon" : "images/box_icon.png",
                "state" : {
                    "opened" : this_opened,
                    "selected" : false
                },
                "children": ui_build_project_tree(project, website_projects[project])
            }
        }
        
        //Add to all projects
        project_all.push(this_project);
    }

    //Build tree array
    let nav_structure = { "core":{ 
        //"data": project_all
        "data": [
            {
                "id" : "project",
                "text" : "Projects",
                "icon" : "images/box_icon.png",
                "state" : {
                    "opened" : true,
                    "selected" : false
                },
                "children": project_all
            },
            {
                "id" : "mapping",
                "text" : "Mapping",
                "icon" : "images/mapping_icon.png",
                "state" : {
                    "opened" : true,
                    "selected" : false
                },
                "children": [
                    {
                        "id" : "mapping_proxy",
                        "text" : "Proxy Map (future)",
                        "icon" : "images/world_icon.png",
                        "state" : {
                            "opened" : true,
                            "selected" : false
                        },
                        "children": [
                            
                        ]
                    },
                    {
                        "id" : "mapping_dns",
                        "text" : "DNS FQDN",
                        "icon" : "images/world_icon.png",
                        "state" : {
                            "opened" : true,
                            "selected" : false
                        },
                        "children": [
                            
                        ]
                    }
                ]
            }
        ]
    }};

    //Populate or update jsTree
    if($("#project_tree").html() == "") {
        $("#project_tree").jstree(nav_structure);
    }else{
        //Reset tree
        $("#project_tree").jstree("destroy").empty();
        $("#project_tree").jstree(nav_structure);
    }

    //Set listener
    $("#project_tree").on("changed.jstree", function (e, data) {
        project_files_selected_object = "";
        ui_project_tree_click(data);
    });
    $("#project_tree").on("open_node.jstree", function (e, data) {
        project_files_selected_object = "";
        ui_project_tree_click(data);
    });
    $("#project_tree").on("close_node.jstree", function () {
        project_files_selected_object = "";
        $("#project_title").html("");
        $("#project_panel").html("");
    });
}
function ui_build_project_tree(project_name, project_data) {
    log(`ui_build_project_tree :: ${project_name}`);

    //Build tree view base
    let project_tree = [
        {
            "id" : `project_mapping::${project_name}`,
            "text" : "Sites and Settings",
            "icon" : "images/mapping_icon.png",
            "state" : {
                "opened" : true,
                "selected" : false
            },
            "children": []
        },
        {
            "id" : `project_files::${project_name}`,
            "text" : "Project Files",
            "icon" : "images/folder_icon.png"
        },
        {
            "id" : `project_dns::${project_name}`,
            "text" : "DNS Resolution",
            "icon" : "images/world_icon.png"
        }
    ];

    //Get sites
    for(let site in project_data.websites) {
        let this_site = {
                "id":`project_site::${project_name}::${site}`,
                "parent":"project_websites",
                "text":`${site}`,
                "icon" : "images/gear_icon.png"
            };
        
        //Add to tree
        project_tree[0]["children"].push(this_site);
    }

    //Return tree
    return project_tree;
}
function ui_project_tree_click(data) {
    //Get ID string from tree view
    let tree_id = data.node.id;

    log(`ui_project_tree_click :: ${tree_id}`);

    //Tree selection
    if(tree_id.startsWith("project::")) {
        log("ui_project_tree_click :: select project");

        //Selected project
        let this_project = tree_id.replace("project::", "");

        //Check project focus change
        if(this_project != focused_project) {
            focused_project = this_project;
        }

        //Expand and collapse tree focus
        let all_nodes = $("#project_tree").jstree(true).get_json();
        for(n in all_nodes[0]["children"]) {
            if(all_nodes[0]["children"][n].id == tree_id) {
                $("#project_tree").jstree("open_node", all_nodes[0]["children"][n].id);
            }else{
                $("#project_tree").jstree("close_node", all_nodes[0]["children"][n].id);
            }
        }

        //Set focus panel
        focused_panel = "project_panel_main";
        focused_site = "";
    }else{
        //parse tree_id
        let parse_tree_id = tree_id.split("::")

        //Set focus panel
        if(parse_tree_id[0] != undefined) {
            switch(parse_tree_id[0]) {
                case "project":
                    focused_panel = "project_panel";
                    focused_project = "";
                    focused_site = "";
                    break;
                case "project_mapping":
                    focused_panel = "project_panel_mapping";
                    focused_site = "";
                    break;
                case "project_site":
                    focused_panel = "project_panel_website";
                    focused_project = parse_tree_id[1];
                    focused_site = parse_tree_id[2];
                    break;
                case "project_files":
                    focused_panel = "project_panel_files";
                    focused_site = "";
                    break;
                case "project_dns":
                    focused_panel = "project_panel_dns";
                    focused_site = "";
                    break;

                case "mapping":
                    focused_panel = "mapping_panel";
                    focused_project = "";
                    focused_site = "";
                    break;
                case "mapping_proxy":
                    focused_panel = "mapping_panel_proxy";
                    focused_project = "";
                    focused_site = "";
                    break;
                case "mapping_dns":
                    focused_panel = "mapping_panel_dns";
                    focused_project = "";
                    focused_site = "";
                    break;
            }

            //Collapst project navigation
            if(focused_project == "") {
                let all_nodes = $("#project_tree").jstree(true).get_json();
                for(n in all_nodes[0]["children"]) {
                    $("#project_tree").jstree("close_node", all_nodes[0]["children"][n].id);
                }
            }
        }
    }

    //Clear panel on new tree selection
    $("#project_panel").html("");

    //Determine panel load
    ui_build_content_panel();
}

//Project dialogs
function ui_project_new() {
    log("ui_project_new");

    //API pre-check
    if(api_check_global(["project_adm"]) == false) { return }

    //Create dialog HTML
    html = `
        <div class="grid2">
            <div class="grid1_col">Project Name:</div>
            <div class="grid1_col">
                <input type="text" id="project_new_name" value="" autocomplete="off">
            </div>
            <div class="grid1_col">Project Description:</div>
            <div class="grid1_col">
                <input type="text" id="project_new_desc" value="" autocomplete="off">
            </div>
        </div>
        
        <br /><br />
        <input type="button" value="Create" onClick="project_new();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog("New Project", html);
}
function ui_project_delete() {
    log("ui_project_delete");

    //API pre-check
    if(api_check_project() == false) { return }

    //Check if project selected
    if(focused_project == "") {
        dialog("Error", "A project is not selected. Please select a project to delete.");
        return;
    }

    //Prompt user
    let html_dialog = `
        <div>Are you sure you want to delete project [<b>${focused_project}</b>] ?</div><br />
        <input type="button" value="Yes" onClick="project_delete(null, 'yes');">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
        `;

    //Call dialog function
    dialog("Delete Project Confirm", html_dialog);
}

//Load panel UIs
function ui_build_content_panel() {

    //
    // focused_project defined @ ui_project_tree_click
    // focused_panel defined @ ui_project_tree_click
    //

    log(`ui_build_content_panel :: Panel   : ${focused_panel}`)
    log(`ui_build_content_panel :: Project : ${focused_project}`)
    log(`ui_build_content_panel :: Website : ${focused_site}`)

    //Check if projects is empty
    if(Object.keys(website_projects).length == 0) {
        let help_tip = ui_helptip_start_project();
        $("#project_title").html(`<img src="images/arrow_left_icon.png" alt="" />`)
        $("#project_panel").html(help_tip)
    }else{
        //Set default panel focus
        if(focused_panel == "") {
            focused_panel = "project_panel";
        }

        //Load panel
        switch(focused_panel) {
            case "project_panel":           ui_project_index(); break;
            
            case "project_panel_main":      ui_project_main(); break;
            case "project_panel_mapping":   ui_project_sites_and_settings(); break;
            case "project_panel_website":   ui_project_site(); break;
            case "project_panel_files":     ui_project_files(); break;
            case "project_panel_dns":       ui_project_dns(); break;

            case "mapping_panel":           ui_mapping_index(); break;
            case "mapping_panel_proxy":     ui_mapping_proxy(); break;
            case "mapping_panel_dns":       ui_mapping_dns(); break;
        }
    }
}

//Help tips
function ui_helptip_start_project() {
    log(`ui_helptip_start_project`)

    let html_nav_buttons = ui_helptip_nav_buttons();
    let html = `
        <h2>Don't have a project yet?</h2><br />
        <p>To start a new project, click the <img src="images/box_icon.png" alt="" /> in in navigation menu to create one.</p><br />
        <br />
        ${html_nav_buttons}
    `;
    return html;
}
function ui_helptip_select_project() {
    log(`ui_helptip_select_project`)

    let html_nav_buttons = ui_helptip_nav_buttons();
    let html = `
        <h2>Unslected project help tip</h2><br />
        <p>TBD</p><br />
        <br />
        ${html_nav_buttons}
    `;
    return html;
}
function ui_helptip_nav_buttons() {
    log(`ui_helptip_nav_buttons`)

    let html = `
        <div class="grid2_inner">
            <div class="grid1_col"><img src="images/box_icon.png" alt="" /></div>
            <div class="grid1_col">Create a project</div>
            <div class="grid1_col"><img src="images/template_icon.png" alt="" /></div>
            <div class="grid1_col">Select a project and turn it into a re-usable template</div>
            <div class="grid1_col"><img src="images/reload_icon.png" alt="" /></div>
            <div class="grid1_col">Refresh configurations from server</div>
            <div class="grid1_col"><img src="images/trash_icon.png" alt="" /></div>
            <div class="grid1_col">Select project in the projects tree and delete it</div>
        </div>
    `;
    return html;
}

//To level nav menu
function ui_project_index() {
    log(`ui_project_index :: UI projects top level`)

    //Create projects list
    let html_projects = "";
    let html_projects_rows = "";
    for(project in website_projects) {
        let config_valid = "";
        let project_enabled = website_projects[project]["enabled"];
        let project_desc = website_projects[project]["project_desc"];
        let site_count = Object.keys(website_projects[project]["websites"]).length;
        let proxy_maps = "-";
        let dns_maps_prod = "-";

        try{
            proxy_maps =    Object.keys(website_projects[project]["proxy_map"]["dev"]).length + 
                            Object.keys(website_projects[project]["proxy_map"]["qa"]).length +
                            Object.keys(website_projects[project]["proxy_map"]["stage"]).length +
                            Object.keys(website_projects[project]["proxy_map"]["prod"]).length

            dns_maps_prod = Object.keys(website_projects[project]["dns_names"]["dev"]).length + 
                            Object.keys(website_projects[project]["dns_names"]["qa"]).length +
                            Object.keys(website_projects[project]["dns_names"]["stage"]).length +
                            Object.keys(website_projects[project]["dns_names"]["prod"]).length
        }catch(err) {
            log(`ui_project_index :: Error counting Proxy and DNS maps`)
        }

        //Format enabled and disables
        switch(website_projects[project]["valid"]) {
            case 0:
                config_valid = `<div class="project_config_state project_config_state_good"></div>`;
            break;
            case 1:
                config_valid = `<div class="project_config_state project_config_state_warning"></div>`;
            break;
            case 2:
                config_valid = `<div class="project_config_state project_config_state_error"></div>`;
            break;
        }
        
        //Format enabled and disables
        if(project_enabled == true) {
            project_enabled = `<span class="font_green">Yes</span>`;
        }else{
            project_enabled = `<span class="font_red">No</span>`;
        }

        //Format project description
        project_desc = project_desc.replaceAll("\n", "<br />")

        //Add to index
        html_projects_rows += `
            <div class="grid1_col">${config_valid}</div>
            <div class="grid1_col">${project_enabled}</div>
            <div class="grid1_col">${project}</div>
            <div class="grid1_col">${project_desc}</div>
            <div class="grid1_col">${site_count}</div>
            <div class="grid1_col">${proxy_maps}</div>
            <div class="grid1_col">${dns_maps_prod}</div>
        `;
    }

    //Check projects
    if(Object.keys(website_projects) == 0) {
        html_projects_rows = `<div class="grid7_col"> ** No projects are created ** </div>`;
    }

    //List projects
    html_projects = `
        <div class="grid7 grid7_project_index">
            <div class="grid5_head">Projects</div>
            <div class="grid2_head">Mapping</div>
            <div class="grid1_sub_head">Valid Config</div>
            <div class="grid1_sub_head">Enabled</div>
            <div class="grid1_sub_head">Name</div>
            <div class="grid1_sub_head">Description</div>
            <div class="grid1_sub_head">Websites</div>
            <div class="grid1_sub_head">Proxy Maps</div>
            <div class="grid1_sub_head">DNS Maps</div>
            ${html_projects_rows}
        </div>
    `;

    //HTML Content
    $("#project_title").html("Projects");
    $("#project_panel").html(html_projects);
}
function ui_mapping_index() {
    log(`ui_mapping_index :: UI mapping top level`)

    //Define HTML
    let html = ui_mapping_vhost_summary() +
               "<br />" +
               ui_mapping_fqdn_summary()

    //HTML Content
    $("#project_title").html("Mapping");
    $("#project_panel").html(html);
}
function ui_mapping_proxy() {
    log(`ui_project :: UI mapping proxy`)

    $("#project_title").html("Proxy Mapping");
}
function ui_mapping_dns() {
    log(`ui_project :: UI mapping dns`)

    $("#project_title").html("DNS (FQDN) Mapping");
}

//Project management UI
function ui_project_main() {
    log(`ui_project_main :: focused project[${focused_project}]`)

    //Make balnk panel if focused project is blank
    if(focused_project == "") {
        $("#project_title").html("");
        $("#project_panel").html("Project not selected");
        return;
    }

    //Get project data
    let project_data = website_projects[focused_project];

    //Determine panel access
    let panel_write_access = api_check_project(["project_set"])

    //Panel Read Access note
    let read_access = ""
    if(panel_write_access == false) {
        read_access = ui_panel_read_only();
    }

    //Project config valid (property added from project_config_validate() on load)
    let project_valid_state = "";
    let project_valie_err = "";
    switch(project_data.valid) {
        case 0:
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="project_config_state project_config_state_good"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Good</div>
                    </div>
                </div>
            `;
        break;
        case 1:
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="project_config_state project_config_state_warning"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Warning</div>
                    </div>
                </div>
            `;
        break;
        case 2:
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="project_config_state project_config_state_error"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Error</div>
                    </div>
                </div>
            `;
        break;
    }
    let project_fix_button = "";
    if(project_data.valid == 2) {
        project_fix_button = `<input id="project_config_fix" type="button" value="Fix Config File Errors" />`;
    }
    if(panel_write_access == true) {
        project_valid = `
            <div class="grid1_col">
                ${project_valid_state}
            </div>
            <div class="grid1_col">
                ${project_fix_button}
            </div>
            <div class="grid2_col">
                <br />
                <b>Error Notes:</b><br />
                ${project_data.valid_notes}
            </div>
        `;
    }else{
        project_valid = `
            <div class="grid1_col">
                ${project_valid_state}
            </div>
            <div class="grid1_col">
                <span class="font_red">Contact Admin or Project Admin to resolve issues</span>
            </div>
            <div class="grid2_col">
                <br />
                <b>Error Notes:</b><br />
                ${project_data.valid_notes}
            </div>
        `;
    }

    //Default
    let html_panel = read_access;

    //Set textarea or text only
    let project_desc_html = "";
    if(panel_write_access == false) {
        let project_desc_text = project_data.project_desc.replaceAll("\n","<br />");
        project_desc_html = project_desc_text
    }else{
        project_desc_html = `<textarea id="project_desc">${project_data.project_desc}</textarea>`;
    }

    //Project enabled
    let this_enabled = "";
    if(project_data.enabled == true) {
        this_enabled = " checked"
    }

    //Set HTML page
    html_panel += `
        <div class="grid2 grid2_project_settings">
            <div class="grid2_head">Project Settings</div>
            <div class="grid1_col">Description</div>
            <div class="grid1_col">${project_desc_html}</div>
            <div class="grid1_col">Enabled</div>
            <div class="grid1_col">
                <input id="project_enabled" type="checkbox"${this_enabled}>
            </div>
            ${project_valid}
        </div>
    `;

    //Update panel
    $("#project_title").html(`Project: ${focused_project}`);
    $("#project_panel").html(html_panel);

    //API pre-check
    if(panel_write_access == true) {  
        //Add listener
        var lis_project_desc = document.getElementById("project_desc");
        var lis_project_enabled = document.getElementById("project_enabled");
        lis_project_desc.addEventListener("change", function(event){
            let this_project_desc = $("#project_desc").val()
            project_set_property("project_desc", this_project_desc)
        });
        lis_project_enabled.addEventListener("change", function(event){
            let this_project_enabled = document.getElementById("project_enabled").checked
            project_set_property("project_enabled", this_project_enabled)
        });

        //Add listener for fix button
        if(document.getElementById("project_config_fix") != undefined) {
            var lis_project_config_fix = document.getElementById("project_config_fix");
            lis_project_config_fix.addEventListener("click", function(event){
                project_fix_config()
            }); 
        }
    }else{
        document.getElementById("project_enabled").disabled = true;
    }
}
function ui_project_sites_and_settings() {
    log("ui_project_sites_and_settings");

    //Focused site
    let project_data = website_projects[focused_project];
    let websites = project_data.websites;

    //Set default HTML
    let html = "";

    //Check sites and settings permissions
    let panel_write_access = api_check_project(["project_adm", "website_adm"]);
    let website_settings_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);
    let html_read_only_banner = "";
    let html_create_site = "";
    if(panel_write_access == true) {
        //Create site buttons
        html_create_site = `
            <div class="grid3">
                <div class="grid3_head">Create Website</div>
                <div class="grid1_col">
                    <input id="project_new_site_empty" class="project_site_new_btn" type="button" value="Create Site as Empty Folder (blank)"><br />
                    <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
                </div>
                <div class="grid1_col">
                    <input id="project_new_site_default" class="project_site_new_btn" type="button" value="Create Site From Default Template"><br />
                    <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
                </div>
                <div class="grid1_col">
                    <input id="project_new_site_template" class="project_site_new_btn" type="button" value="Create Site From User Template"><br />
                    <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
                </div>
            </div>
            <br />
        `;
    }else{
        //Read only banner
        html_read_only_banner = ui_panel_read_only();
    }

    //Generate list of websites
    let html_website_table = "";
    let html_website_rows = "";
    for(site in websites) {
        //Get site states
        let ssl_redirect = websites[site]["ssl_redirect"];
        let html_ssl_redirect = "";

        //Disabled if not admin
        let ssl_disabled = "";
        if(website_settings_write_access != true) {
            ssl_disabled = " disabled";
        }

        //SSL checked
        let ssl_checked = "";
        if(ssl_redirect == true) {
            ssl_checked = " checked";
        }

        //Set HTML
        html_ssl_redirect = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        global
                    </div>
                    <div class="grid1_inner_col">
                        <input id="chk_ssl_redirect::${site}" type="checkbox"${ssl_checked}${ssl_disabled} /> 
                    </div>
                </div>
            `;

        //Process maintenance mode
        let maint_state = websites[site]["maintenance"];
        let maint_setting = false;
        let html_maint = "";
        let html_maint_env = "";
        for(let env in maint_state) {
            maint_setting = maint_state[env];

            //Disabled if not admin
            let maint_disabled = "";
            if(website_settings_write_access != true) {
                maint_disabled = " disabled";
            }

            //Determine chkbox
            let maint_checked = "";
            if(maint_setting == true) {
                maint_checked = " checked"
            }

            //Add to env column (inner grid)
            html_maint_env += `
                <div class="grid1_inner_col">${env}</div>
                <div class="grid1_inner_col">
                    <input id="chk_maint_mode::${site}::${env}" type="checkbox"${maint_checked}${maint_disabled} />&nbsp;&nbsp;&nbsp;&nbsp;
                </div>
            `;
        }
        html_maint = `
            <div class="grid8_inner">
                ${html_maint_env}
            </div>
        `;

        //Create VHost preview link
        let vhost_preview = `/vhost/${focused_project}::${site}/`;
        let html_vhost_link = `<a href="${vhost_preview}" target="_blank">${vhost_preview}</a>`;

        //Build site index
        if(panel_write_access == true) {
            html_website_rows += `
                <div class="grid1_col">
                    <div class="grid4_inner grid4_site_name_edit">
                        <div class="grid1_inner_col">${site}</div>
                        <div class="grid1_inner_col">
                            <img class="icon project_site_rename" src="images/write_icon.png" alt="" onClick="ui_website_rename_clone('${site}', 'rename');" title="Rename Site" />
                        </div>
                        <div class="grid1_inner_col">
                            <img class="icon project_site_clone" src="images/world_clone_icon.png" alt="" onClick="ui_website_rename_clone('${site}', 'clone');" title="Clone Site" />
                        </div>
                        <div class="grid1_inner_col">
                            <img class="icon project_site_trash" src="images/trash_icon.png" alt="" onClick="ui_website_delete('${site}');" title="Delete Site" />
                        </div>
                    </div>
                </div>
                <div class="grid1_col">${html_ssl_redirect}</div>
                <div class="grid1_col">${html_maint}</div>
                <div class="grid1_col">${html_vhost_link}</div>
            `;
        }else{
            html_website_rows += `
                <div class="grid1_col">${site}</div>
                <div class="grid1_col">${html_ssl_redirect}</div>
                <div class="grid1_col">${html_maint}</div>
                <div class="grid1_col">${html_vhost_link}</div>
            `;
        }
    }

        if(html_website_rows == "") {
            html_website_rows = `<div class="grid4_col">** No existing sites **</div>`;
        }
        html_website_table = `
            <div class="grid4">
                <div class="grid4_head">Websites</div>
                <div class="grid1_sub_head">Site Name</div>
                <div class="grid1_sub_head">SSL Redirect</div>
                <div class="grid1_sub_head">Maintenance Mode (per Environment)</div>
                <div class="grid1_sub_head">Website Preview</div>
                ${html_website_rows}
            </div>
        `;

    //Get VHOST and FQDN mapping
    let html_fqdn_table = ui_project_fqdn_summary(project_data);

    //Add VHOST and DNS mapping
    html = html_read_only_banner +
           html_create_site + 
           html_website_table +
           html_fqdn_table;

    //Output project panel
    $("#project_panel").html(html);

    //API pre-check
    if(panel_write_access == true) {  
        //Add listener to all check boxes
        let chk_listeners = {}
        for(let site in websites) {
            //Checkbox types
            let ssl_redirect_key =      `${site}_ssl_redirect`;
            let maint_mode_key_dev =    `${site}_maint_mode_dev`;
            let maint_mode_key_qa =     `${site}_maint_mode_qa`;
            let maint_mode_key_stage =  `${site}_maint_mode_stage`;
            let maint_mode_key_prod =   `${site}_maint_mode_prod`;

            //Create listener
            chk_listeners[ssl_redirect_key] = document.getElementById(`chk_ssl_redirect::${site}`);
            chk_listeners[maint_mode_key_dev] = document.getElementById(`chk_maint_mode::${site}::dev`);
            chk_listeners[maint_mode_key_qa] = document.getElementById(`chk_maint_mode::${site}::qa`);
            chk_listeners[maint_mode_key_stage] = document.getElementById(`chk_maint_mode::${site}::stage`);
            chk_listeners[maint_mode_key_prod] = document.getElementById(`chk_maint_mode::${site}::prod`);

            chk_listeners[ssl_redirect_key].addEventListener("click", function(event){
                //Get site
                let parse_id = this.id.split("::");

                //Focus Site
                focused_site = parse_id[1]

                //Update property value
                website_set_property("ssl_redirect", this.checked)

                //Un-focus Site
                focused_site = "";
            });
            chk_listeners[maint_mode_key_dev].addEventListener("click", function(event){
                //Get site
                let parse_id = this.id.split("::");

                //Focus Site
                focused_site = parse_id[1]
                this_env = parse_id[2]

                //Update property value
                website_set_property("maintenance_enabled", this.checked, this_env)

                //Un-focus Site
                focused_site = "";
            });
            chk_listeners[maint_mode_key_qa].addEventListener("click", function(event){
                //Get site
                let parse_id = this.id.split("::");

                //Focus Site
                focused_site = parse_id[1]
                this_env = parse_id[2]

                //Update property value
                website_set_property("maintenance_enabled", this.checked, this_env)

                //Un-focus Site
                focused_site = "";
            });
            chk_listeners[maint_mode_key_stage].addEventListener("click", function(event){
                //Get site
                let parse_id = this.id.split("::");

                //Focus Site
                focused_site = parse_id[1]
                this_env = parse_id[2]

                //Update property value
                website_set_property("maintenance_enabled", this.checked, this_env)

                //Un-focus Site
                focused_site = "";
            });
            chk_listeners[maint_mode_key_prod].addEventListener("click", function(event){
                //Get site
                let parse_id = this.id.split("::");

                //Focus Site
                focused_site = parse_id[1]
                this_env = parse_id[2]

                //Update property value
                website_set_property("maintenance_enabled", this.checked, this_env)

                //Un-focus Site
                focused_site = "";
            });
        }

        //Add listener - project site create
        var lis_project_new_site_empty = document.getElementById("project_new_site_empty");
        var lis_project_new_site_default = document.getElementById("project_new_site_default");
        var lis_project_new_site_template = document.getElementById("project_new_site_template");

        lis_project_new_site_empty.addEventListener("click", function(event){
            ui_website_new_default('empty');
        });
        lis_project_new_site_default.addEventListener("click", function(event){
            ui_website_new_default('default');
        });
        lis_project_new_site_template.addEventListener("click", function(event){
            ui_website_new_template();
        });
    }

}
function ui_project_site() {
    log("ui_project_site");

    //Check sites and settings permissions
    let panel_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);

    //Panel Read Access note
    let read_access = ""
    if(panel_write_access == false) {
        //Set top of page read only
        read_access = ui_panel_read_only();
    }

    //Focused site
    let setting_data = website_projects[focused_project]["websites"][focused_site];

    //Set SSL redirect checkbox
    let ssl_redirect = "";
    if(setting_data.ssl_redirect == true) {
        ssl_redirect = `<input id="ssl_redirect" type="checkbox" checked>`;
    }else{
        ssl_redirect = `<input id="ssl_redirect" type="checkbox">`;
    }

    //Set Maintenance Mode
    let maint_state_env = "";
    for(let env in setting_data.maintenance) {
        let maint_checked = ""
        if(setting_data.maintenance[env] == true) {
            maint_checked = " checked";
        }
        maint_state_env += `
                <div class="grid1_inner_col">${env}</div>
                <div class="grid1_inner_col">
                    <input id="maintenance_${env}_enabled" type="checkbox"${maint_checked}>&nbsp;&nbsp;&nbsp;&nbsp;
                </div>
        `;
    }
    maint_state_env = `
        <div class="grid8_inner">
            ${maint_state_env}
        </div>
    `;


    //Set default docs text boxes (maintenance page and index)
    let maint_page = `<input id="maintenance_page_text" type="text" value="${setting_data.maintenance_page}">`;
    let default_doc = `<input id="default_doc_text" type="text" value="${setting_data.default_doc}">`;

    //General settings
    let vhost_href = `<a href="/vhost/${focused_project}::${focused_site}/" target="_blank">/vhost/${focused_project}::${focused_site}/</a>`;
    let general = `
        <div class="grid2 grid2_site_mapping">
            <div class="grid2_head">Website</div>
            <div class="grid1_col">Name</div>
            <div class="grid1_col">${focused_site}</div>
            <div class="grid1_col">Preview</div>
            <div class="grid1_col">${vhost_href}</div>
            
            <div class="grid2_head">General Settings</div>
            <div class="grid1_col">Redirect to SSL</div>
            <div class="grid1_col">global ${ssl_redirect}</div>
            <div class="grid1_col">Maintenance Mode (environments)</div>
            <div class="grid1_col">${maint_state_env}</div>
            <div class="grid1_col">Maintenance Page</div>
            <div class="grid1_col">${maint_page}</div>
            <div class="grid1_col">Default Document</div>
            <div class="grid1_col">${default_doc}</div>
            <div class="grid1_col">Error Pages</div>
            <div class="grid1_col">TBD</div>
        </div>
    `;

    //Mapping sections
    let html_mapping = "";
    let map_sections = [
        "apis_fixed_path",
        "apis_dynamic_path",
        "path_static",
        "path_static_server_exec",
        "sub_map"
    ]
    for(let i in map_sections) {
        let this_section = map_sections[i];

        //Heading label
        let heading_label = "";
        let function_map_add = "";
        switch(this_section) {
            case "apis_fixed_path":
                heading_label = "API Fixed Path Mapping";
                function_map_add = "ui_website_map_new"
                function_args = `'${this_section}'`;
                break;
            case "apis_dynamic_path":
                heading_label = "API Dynamic Path Mapping";
                function_map_add = "ui_website_map_new"
                function_args = `'${this_section}'`;
                break;
            case "path_static":
                heading_label = "Static Content Mapping";
                function_map_add = "ui_website_map_new"
                function_args = `'${this_section}'`;
                break;
            case "path_static_server_exec":
                heading_label = "Static Content Server Execute Override";
                function_map_add = "ui_website_map_new"
                function_args = `'${this_section}'`;
                break;
            case "sub_map":
                heading_label = "Project Website Sub Mapping";
                function_map_add = "ui_website_sub_map_new"
                function_args = "";
                break;
        }

        //Check panel access
        let html_add_button = "";
        if(panel_write_access == true) {
            html_add_button = `<img class="icon project_site_map_add" src="images/add_icon.png" alt="" onClick="${function_map_add}(${function_args});" title="Add ${heading_label}" />`;
        }
        html_mapping += `
            <div class="grid3_sub_head">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">${heading_label}&nbsp;&nbsp;&nbsp;&nbsp;</div>
                    <div class="grid1_inner_col">${html_add_button}</div>
                </div>
            </div>
        `;

        //Loop section
        let html_mapping_rows = "";
        for(let web_path in setting_data[this_section]) {
            let map_target = setting_data[this_section][web_path];
            if(panel_write_access == true) {
                html_mapping_rows += `
                    <div class="grid1_sub_head">
                        <img class="icon project_site_map_delete" src="images/trash_icon.png" alt="" onClick="ui_website_map_delete('${this_section}', '${web_path}');" title="Delete map: ${web_path}" />
                    </div>
                    <div class="grid1_col">${web_path}</div>
                    <div class="grid1_col">${map_target}</div>
                `;
            }else{
                html_mapping_rows += `
                    <div class="grid1_sub_head"></div>
                    <div class="grid1_col">${web_path}</div>
                    <div class="grid1_col">${map_target}</div>
                `;
            }
        }

        //Check if section blank
        if(html_mapping_rows == "") {
            html_mapping_rows = `
                <div class="grid1_sub_head"></div>
                <div class="grid2_col font_gray">No mapping setting for this type</div>
            `;
        }

        //Add mapping rows
        html_mapping += html_mapping_rows; 
    }

    //Mapping section
    let html_website_mapping = `
        <div class="grid3 grid3_site_mapping">
            <div class="grid3_head">Website Mapping</div>
            <div class="grid2_head">Web Path</div>
            <div class="grid1_head">Target</div>
            ${html_mapping}
        </div>
    `;

    //Create setting panel
    let html = `
        ${read_access}
        ${general}
        <br />
        ${html_website_mapping}
    `;

    //Update panel
    $("#project_panel").html(html);

    //API pre-check
    if(panel_write_access == true) {
        //Add listener
        var lis_ssl_redirect = document.getElementById("ssl_redirect");
        var lis_maintenance_dev_enabled = document.getElementById("maintenance_dev_enabled");
        var lis_maintenance_qa_enabled = document.getElementById("maintenance_qa_enabled");
        var lis_maintenance_stage_enabled = document.getElementById("maintenance_stage_enabled");
        var lis_maintenance_prod_enabled = document.getElementById("maintenance_prod_enabled");
        var lis_maintenance_page_text = document.getElementById("maintenance_page_text");
        var lis_default_doc_text = document.getElementById("default_doc_text");

        //Listener action
        lis_ssl_redirect.addEventListener("change", function(event){
            let this_ssl_redirect = document.getElementById("ssl_redirect").checked;
            website_set_property("ssl_redirect", this_ssl_redirect);
        });

        lis_maintenance_dev_enabled.addEventListener("change", function(event){
            let this_maintenance_enabled = document.getElementById("maintenance_dev_enabled").checked;
            website_set_property("maintenance_enabled", this_maintenance_enabled, "dev");
        });
        lis_maintenance_qa_enabled.addEventListener("change", function(event){
            let this_maintenance_enabled = document.getElementById("maintenance_qa_enabled").checked;
            website_set_property("maintenance_enabled", this_maintenance_enabled, "qa");
        });
        lis_maintenance_stage_enabled.addEventListener("change", function(event){
            let this_maintenance_enabled = document.getElementById("maintenance_stage_enabled").checked;
            website_set_property("maintenance_enabled", this_maintenance_enabled, "stage");
        });
        lis_maintenance_prod_enabled.addEventListener("change", function(event){
            let this_maintenance_enabled = document.getElementById("maintenance_prod_enabled").checked;
            website_set_property("maintenance_enabled", this_maintenance_enabled, "prod");
        });

        lis_maintenance_page_text.addEventListener("change", function(event){
            let this_maintenance_page_text = $("#maintenance_page_text").val();
            website_set_property("maintenance_page", this_maintenance_page_text);
        });
        lis_default_doc_text.addEventListener("change", function(event){
            let this_default_doc_text = $("#default_doc_text").val();
            website_set_property("default_doc", this_default_doc_text);
        });
    }else{
        document.getElementById("ssl_redirect").disabled = true;
        document.getElementById("maintenance_dev_enabled").disabled = true;
        document.getElementById("maintenance_qa_enabled").disabled = true;
        document.getElementById("maintenance_stage_enabled").disabled = true;
        document.getElementById("maintenance_prod_enabled").disabled = true;
        document.getElementById("maintenance_page_text").disabled = true;
        document.getElementById("default_doc_text").disabled = true;
    }
}
function ui_project_vhost_summary(project_data) {
    log("ui_project_vhost_summary");

    //Generate VHOST summary
    let html_vhost_table = "";
    let html_vhost_rows = "";
    for(let website in project_data["websites"]) {
        //Set vhost
        let this_path = `/vhost/${focused_project}::${website}/`;
        html_vhost_rows += `
            <div class="grid1_col">${website}</a></div>
            <div class="grid1_col"><a href="${this_path}" target="_blank">${this_path}</a></div>
        `;
    }
    html_vhost_table = `
        <br />
        <div class="grid2">
            <div class="grid2_head">Website Preview</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">VHost URL</div>
            ${html_vhost_rows}
        </div>
    `;

    //Return data
    return html_vhost_table;
}
function ui_project_fqdn_summary(project_data) {
    log("ui_project_fqdn_summary");

    //Get server conf
    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Create FQDN list
    let html_fqdn_table = "";
    let html_fqdn_rows = "";

    //Loop through environments
    for(let env in project_data.dns_names) {
        //Process server modes DNS config
        for(let this_dns in project_data.dns_names[env]) {
            this_row = "";

            this_http_url = "";
            this_https_url = "";
            this_http_a = "";
            this_https_a = "";

            //Check site not mapped
            this_site = project_data.dns_names[env][this_dns];
            if(this_site == "") {
                this_site = `<span class="font_red">(unmapped)</span>`;
            }

            //Get URL for HTTP
            if(http_on == true) {
                if(http_port == "80") {
                    this_http_url = `http://${this_dns}/`;
                }else{
                    this_http_url = `http://${this_dns}:${http_port}/`;
                }
                this_http_a = `<a href="${this_http_url}" target="_blank">HTTP</a>`;
            }else{
                this_http_a = `-`;
            }

            //Get URL for HTTPS
            if(https_on == true) {
                if(https_port == "443") {
                    this_https_url = `https://${this_dns}/`;
                }else{
                    this_https_url = `https://${this_dns}:${https_port}/`;
                }
                this_https_a = `<a href="${this_https_url}" target="_blank">HTTPS</a>`;
            }else{
                this_https_a = `-`;
            }

            //Check disabled
            let project_enabled = `<span class="font_green">Yes</span>`;
            if(project_data.enabled == false) {
                project_enabled = `<span class="font_red">No</span>`;
                this_http_a = `-`;
                this_https_a = `-`;
            }

            //Append server mode config
            html_fqdn_rows += `
                <div class="grid1_col">${project_enabled}</div>
                <div class="grid1_col">${env}</div>
                <div class="grid1_col">${this_site}</div>
                <div class="grid1_col">${this_dns}</div>
                <div class="grid1_col">${this_http_a}</div>
                <div class="grid1_col">${this_https_a}</div>
            `;
        }
    }

    //Check is any mapping exists
    if(html_fqdn_rows == "") {
        html_fqdn_rows = `<div class="grid6_col">** No DNS FQDN Mapping Configured **</div>`;
    }

    //Define table
    html_fqdn_table = `
        <br />
        <div class="grid6">
            <div class="grid6_head">Project DNS FQDN Mapping</div>
            <div class="grid1_sub_head">Project Enabled</div>            
            <div class="grid1_sub_head">Environment</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">URL</div>
            <div class="grid1_sub_head">HTTP (port:${http_port})</div>
            <div class="grid1_sub_head">HTTPS (port:${https_port})</div>
            ${html_fqdn_rows}
        </div>
    `;
    
    //Return HTML
    return html_fqdn_table;
}

//Project website management UI
function ui_website_new_default(type="empty") {
    log("ui_website_new_default");

    //Create dialog HTML
    html = `
        <input id="new_site_type" type="hidden" value="${type}">

        <div class="grid2_inner">
            <div class="grid1_col">Site Name:</div>
            <div class="grid1_col">
                <input type="text" id="new_site_name" value="" autocomplete="off">
            </div>
        </div>
        
        <br /><br />
        <input type="button" value="Create" onClick="website_new_blank();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Set title
    let title = "Empty Folder";
    if(type == "default") {
        title = "Default Template";
    }

    //Call dialog function
    dialog(`New Site (${title})`, html);
}
function ui_website_new_template() {
    log("ui_website_new_template");

    //API pre-check
    if(api_check_project(["website_adm"]) == false) { return }

    //Create dialog HTML
    html = `
        <div class="grid2_inner">
            <div class="grid1_col">Select Template:</div>
            <div class="grid1_col" id="new_site_select_template">
                [LOADING]
            </div>
        </div>
        
        <br /><br />
        <input type="hidden" value="Create" onClick="website_new_from_template(null,'create');" id="new_site_ok">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog("New Site(s) From Template", html);

    //Call function to get templates list
    website_new_templates_list();
}
function ui_website_new_templates_list(templates) {
    log("ui_website_new_templates_list");

    //Get templates rows
    let html_rows = "";
    let tab = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    for(let template in templates) {
        //Get site list
        let site_list = "";
        for(let site in templates[template]["websites"]) {
            site_list += `${tab}${tab}${site}<br />`;
        }
        if(site_list != "") {
            site_list = `
                ${tab}${tab}<b>Site List:</b><br />
                ${site_list}
            `;
        }

        let this_desc = templates[template]["description"];
        html_rows += `
            <input type="radio" id="new_site_template" name="template_selector" value="${template}">
            <label for="template_selector"><b>${template}</b> [${this_desc}]</label><br>
            ${site_list}
        `;
    }

    //Set the template selection
    $("#new_site_select_template").html(html_rows);
    $("#new_site_ok").attr("type","button");
}
function ui_website_rename_clone(site_name, action) {
    log("ui_website_rename_clone");

    //API pre-check
    if(api_check_project(["website_adm"]) == false) { return }

    //Set label
    let btn_label = "Reanme";
    if(action == "clone") {
        btn_label = "Clone";
    }

    //Rename dialog HTML
    html = `
        <input type="hidden" id="current_site_name" value="${site_name}">

        <div class="grid2_inner">
            <div class="grid2_col">Current Site Name: ${site_name}</div>
            <div class="grid1_col">New Site Name:</div>
            <div class="grid1_col">
                <input type="text" id="new_site_name" value="" autocomplete="off">
            </div>
        </div>
        
        <br /><br />
        <input type="button" value="${btn_label}" onClick="website_rename_clone('${action}');">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    if(action == "rename") {
        dialog("Rename Site", html);
    }else{
        dialog("Clone Site", html);
    }
}
function ui_website_delete(site_name) {
    log("ui_website_new_default");

    //API pre-check
    if(api_check_project(["website_adm"]) == false) { return }

    //Create dialog HTML
    html = `
        <p>Are you sure you want to delete site '${site_name}'?
        
        <br /><br />
        <input type="button" value="Yes" onClick="website_delete('${site_name}');">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog("Delete Site", html);
}

//Project website settings UI
function ui_website_map_new(map_type) {
    log("ui_website_map_new");

    //Set label
    let dialog_label = "";
    let map_path_label = "";
    switch(map_type) {
        case "apis_fixed_path":
            dialog_label = "Map Fixed API";
            map_path_label = "Map to API File:";
        break;
        case "apis_dynamic_path":
            dialog_label = "Map Dynamic API";
            map_path_label = "Map to API Folder:";
        break;
        case "path_static":
            dialog_label = "Map Static Path";
            map_path_label = "Map to Static Folder:";
        break;
        case "path_static_server_exec":
            dialog_label = "Map Static Path Override (Server Execute)"; 
            map_path_label = "Map to Static File:";
        break;
    }

    //Generate HTML
    let html = `

        <input id="website_map_type" class="hidden_field" type="hidden" value="${map_type}">

        <div class="grid2">
            <div class="grid1_col">Web URL Sub Path:</div>
            <div class="grid1_col">
                <input type="text" id="website_web_path" value="" autocomplete="off">
            </div>
            <div class="grid1_col">${map_path_label}</div>
            <div class="grid1_col">
                <input type="text" id="website_map_path" value="" disabled>
            </div>
            <div class="grid2_col">
                <div class="project_site_map_select" id="website_folder"></div>
            </div>
        </div>
        <br />
        <input type="button" value="Map Path" onClick="website_path_mapping_add();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog(dialog_label, html);

    //Get files
    files_get(ui_website_map_new_files);
}
function ui_website_map_new_files(dir) {
    //Get focused site folder structure
    let project_file = dir[0].children;
    let target_folder = [];
    for(i in project_file) {            
        if(project_file[i].name == focused_site) {
            target_folder.push(project_file[i]);
            break;
        }
    }

    //Get map type from dialog hidden field
    let map_type = $("#website_map_type").val();

    //Convert tree to jsTree format
    let jstree_dir = null;
    if(map_type == "apis_dynamic_path" || map_type == "path_static") {
        jstree_dir = ui_dir_jstree_format(target_folder, "no_files");
    }else{
        jstree_dir = ui_dir_jstree_format(target_folder);
    }

    //Expand first node
    if(jstree_dir[0] != undefined) {
        jstree_dir[0].state.opened = true;
    }

    //Build tree array
    jstree_dir = { "core":{ 
        "data": jstree_dir
    }};

    //Populate file tree
    $("#website_folder").jstree(jstree_dir);

    //Set listener
    $("#website_folder").on("changed.jstree", function (e, data) {
        log(`website_folder :: Select: ${data.node.original.map_path}`);
        if(map_type == "apis_fixed_path" || map_type == "path_static_server_exec") {
            if(data.node.original.type == "file") {
                $("#website_map_path").val(data.node.original.map_path);
            }else{
                $("#website_map_path").val("");
            }
        }else if(map_type == "apis_dynamic_path" || map_type == "path_static") {
            if(data.node.original.type == "dir") {
                $("#website_map_path").val(data.node.original.map_path);
            }else{
                $("#website_map_path").val("");
            }
        }
    });        
}
function ui_website_sub_map_new() {
    log("ui_website_sub_map_new");

    //Set label
    let dialog_label = "Map Sub Path to Project Website";

    //Get project files list from server
    let project_data = website_projects[focused_project];

    //Loop project websites
    let website_select = "";
    for(site in project_data.websites) {
        website_select += `<option value="${site}">${site}</option>`;
    }
        
    //Build select drop down (change DNS target selector)
    website_select = `
        <select id="website_map_path" onChange="">
            <option value="" selected></option>
            ${website_select}
        </select>
    `;

    //Generate HTML
    let html = `

        <input id="website_map_type" class="hidden_field" type="hidden" value="sub_map">

        <p><i>Map a URI path to a website under the same project.</i></p>

        <div class="grid2">
            <div class="grid1_col">Web URL Sub Path:</div>
            <div class="grid1_col">
                <input type="text" id="website_web_path" value="" autocomplete="off">
            </div>
            <div class="grid1_col">Project Site</div>
            <div class="grid1_col">
                ${website_select}
            </div>
        </div>
        <br />
        <input type="button" value="Map Path" onClick="website_path_mapping_add();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog(dialog_label, html);
}

function ui_website_map_delete(map_type, path) {
    log("ui_website_map_delete");

    //Create dialog HTML
    html = `
        <input type="hidden" id="delete_map_type" value="${map_type}">
        <input type="hidden" id="delete_map_path" value="${path}">
    
        <p>Are you sure you want to delete path '${path}'?
        
        <br /><br />
        <input type="button" value="Yes" onClick="website_path_mapping_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    let dialog_label = "";
    switch(map_type) {
        case "apis_fixed_path":         dialog_label = "Map Fixed API"; break;
        case "apis_dynamic_path":       dialog_label = "Map Dynamic API"; break;
        case "path_static":             dialog_label = "Map Static Path"; break;
        case "path_static_server_exec": dialog_label = "Map Static Path Override (Server Execute)"; break;
        case "sub_map":                 dialog_label = "Website Sub Mapping"; break;
    }
    dialog(dialog_label, html);
}

//Project files management UI
function ui_project_files() {
    log("ui_project_files");

    //Check sites and settings permissions
    let panel_write_access = api_check_project(["project_adm", "files_adm"]);

    //Panel Read Access note
    let read_access = ""
    if(panel_write_access == false) {
        //Set top of page read only
        read_access = ui_panel_read_only();
    }

    //Define buttons
    let html_buttons = "";
    if(panel_write_access == true) {
        html_buttons = `
            <div id="files_add_folder" class="project_files_menu_btn project_files_menu_add_folder" title="Add Folder"></div>
            <div id="files_add_file" class="project_files_menu_btn project_files_menu_add_file" title="Add File"></div>
            <div id="files_delete" class="project_files_menu_btn project_files_menu_delete" title="Delete Folder or File"></div>
        `;
    }else{
        html_buttons = `
            <div class="project_files_menu_btn project_files_menu_add_folder_disabled"></div>
            <div class="project_files_menu_btn project_files_menu_add_file_disabled"></div>
            <div class="project_files_menu_btn project_files_menu_delete_disabled"></div>
        `;
    }

    //Define HTML
    let html = `
        <div class="project_file_title">Project Files:</div>
        <div class="project_file_menu">
            ${html_buttons}
            <div class="project_file_read_access">
                ${read_access}
            </div>
        </div>
        <div class="project_file_data_title">File Viewer:</div>
        <div class="project_file_list" id="project_file_list"></div>
        <div class="project_file_data">
            <div class="project_file_window" id="project_file_window"></div>
        </div>
    `;

    //Populate panel
    $("#project_panel").html(html);

    //Get files
    files_get(ui_project_files_tree);

    //API pre-check
    if(panel_write_access == true) {  
        //Add listener
        var lis_add_folder = document.getElementById("files_add_folder");
        var lis_add_file = document.getElementById("files_add_file");
        var lis_delete = document.getElementById("files_delete");
        lis_add_folder.addEventListener("click", function(event){
            ui_project_files_add('folder');
        });
        lis_add_file.addEventListener("click", function(event){
            ui_project_files_add('file');
        });
        lis_delete.addEventListener("click", function(event){
            ui_project_files_delete_check();
        });
    }

}
function ui_project_files_tree(dir) {
    log("ui_project_files_tree");

    //Convert tree to jsTree format
    let jstree_dir = ui_dir_jstree_format(dir)
    jstree_dir = ui_dir_jstree_state(dir)

    //Expand first node
    if(jstree_dir[0] != undefined) {
        jstree_dir[0].state.opened = true;
    }

    //Build tree array
    jstree_dir = { "core":{ 
        "data": jstree_dir
    }};

    //Populate file tree
    if($("#project_file_list").html() == "") {
        $("#project_file_list").jstree(jstree_dir);
    }else{
        $("#project_file_list").jstree(true).settings.core.data = jstree_dir.core.data;
        $("#project_file_list").jstree(true).refresh(true, true);
    }

    //Set listener
    $("#project_file_list").on("select_node.jstree", function (e, data) {
        log(`ui_project_files_tree :: Select: ${data.node.id}`);

        //Store selected file object
        project_files_selected_object = data.node;

        //Check if selected file
        if(data.node.original.type == "file") {
            let match_ext = [
                ".html",
                ".htm",
                ".css",
                ".js",
                ".txt",
                ".json",
                ".conf",
                ".php",
                ".java",
                ".class",
                ".cgi",
                ".cpp",
                ".cs",
                ".h",
                ""
            ]
            if(match_ext.indexOf(data.node.original.ext) > -1) {
                files_view(data.node);
            }else{
                $("#project_file_window").html("Binary File");
            }
        }else{
            $("#project_file_window").html("");
        }
    });
    $("#project_file_list").on("open_node.jstree", function (e, data) {
        log(`ui_project_files_tree :: Open: ${data.node.id}`);
        project_files_folder_open.push(data.node.id);
    });
    $("#project_file_list").on("close_node.jstree", function (e, data) {
        log(`ui_project_files_tree :: Close: ${data.node.id}`);
        project_files_folder_open.splice(project_files_folder_open.indexOf(data.node.id));
    });
}
function ui_project_files_viewer(content) {
    log("ui_project_files_viewer");

    //Convert elements to HTML code to prevent execute HTML elements
    content = content.replace(new RegExp("<", "g"), "&lt;")
    content = content.replace(new RegExp(">", "g"), "&gt;")
    content = content.replace(new RegExp("\"", "g"), "&quot;")
    content = content.replace(new RegExp("\'", "g"), "&apos;")

    //Formatting replace
    content = content.replace(new RegExp("\t", "g"), "&nbsp;&nbsp;&nbsp;&nbsp;")
    content = content.replace(new RegExp("\n", "g"), "<br />")
    content = content.replace(new RegExp("\ \ ", "g"), "&nbsp;&nbsp;")

    //View content
    $("#project_file_window").html(content);
}
function ui_project_files_add(type=null) {
    log(`ui_project_files_add :: type[${type}]`);

    //API pre-check
    if(api_check_project(["files_adm"]) == false) { return }

    //Verify select
    if(project_files_selected_object == "" || project_files_selected_object.original.type == "file") {
        dialog("Error", `Please select a folder where you want to add a ${type}`);
        return;
    }
    let select_path = project_files_selected_object.id;

    //Create dialog HTML
    let html = `<input type="hidden" id="files_add_type" value="${type}">`;
    if(type == "folder") {
        html += `
            <div class="grid2">
                <div class="grid2_col">Selected Folder: <b>${select_path}</b></div>
                <div class="grid1_col">New Folder Name:</div>
                <div class="grid1_col">
                    <input type="text" id="new_folder_name" value="">
                </div>
            </div>
            
            <br /><br />
            <input type="button" value="Create" onClick="files_add();">
            <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
        `;
    }else{
        //Create dialog HTML
        html += `
            <div class="grid2">
                <div class="grid2_col">Selected Folder: <b>${select_path}</b></div>
                <div class="grid1_col">File Type:</div>
                <div class="grid1_col">
                    <input type="radio" name="file_type" id="file_type_blank" value="blank">Blank File<br />
                    <input type="radio" name="file_type" id="file_type_html" value="html">HTML File (bare bones)<br />
                    <input type="radio" name="file_type" id="file_type_css" value="css">CSS File (bare bones)<br />
                    <input type="radio" name="file_type" id="file_type_api" value="api">API File (Server side execute template)<br />
                </div>
                <div class="grid1_col">File Name:</div>
                <div class="grid1_col">
                    <input type="text" id="new_file_name" value="">
                </div>
            </div>
            
            <br /><br />
            <input type="button" value="Create" onClick="files_add();">
            <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
        `;
    }

    //Set dialog title
    let dialog_title = "";
    if(type == "folder") {
        dialog_title = "Add Folder";
    }else{
        dialog_title = "Add File";
    }

    //Call dialog function
    dialog(dialog_title, html);
}
function ui_project_files_delete_check() {
    log("ui_project_files_delete_check");

    //Get path
    let select_path = project_files_selected_object.id;

    //Get seelcted
    if(protected_paths[select_path] != undefined) {
        let error_message = `
            <p>This path is bound to configuration and cannot be deleted</p>
            <div class="grid2">
                <div class="grid1_col">Path:</div>
                <div class="grid1_col"><b>${select_path}</b></div>
                <div class="grid1_col">Reason:</div>
                <div class="grid1_col"><b>${protected_paths[select_path]}</b></div>
            </div>
        `;
        dialog("Error",error_message); 
    }else{
        ui_project_files_delete();
    }
}
function ui_project_files_delete() {
    log("ui_project_files_delete :: User form");

    //Verify select
    if(project_files_selected_object == "") {
        dialog("Error", "Please select a file or folder");
        return;
    }

    //Get path
    let select_path = project_files_selected_object.id;

    //Create dialog HTML
    html = `
        <input type="hidden" id="delete_project_files_path" value="${select_path}">
    
        <p>Are you sure you want to delete site '<b>${select_path}</b>'?</p>
        
        <br /><br />
        <input type="button" value="Yes" onClick="files_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog("Delete Selected", html);
}

//Project DNS management UI
function ui_project_dns() {
    log("ui_project_dns");

    //Check sites and settings permissions
    let panel_write_access = api_check_project(["project_adm", "dns_adm"]);

    //Panel Read Access note
    let read_access = ""
    if(panel_write_access == false) {
        //Set top of page read only
        read_access = ui_panel_read_only();
    }

    //Get project files list from server
    let project_data = website_projects[focused_project];

    //Generate DNS list
    let html_dns_rows = "";
    for(let env in project_data.dns_names) {
        let dns_row = "";

        //Loop DNS names
        dns_target = project_data.dns_names[env];
        for(let dns in dns_target) {
            //Create DNS row
            if(panel_write_access == true) {
                //DNS target
                let dns_resolve = dns_target[dns];

                //Loop sites
                let dns_select = "";
                for(site in project_data.websites) {
                    if(site == dns_resolve) {
                        dns_select += `<option value="${dns}:${site}" selected>${site}</option>`;
                    }else{
                        dns_select += `<option value="${dns}:${site}">${site}</option>`;
                    }
                }
                    
                //Build select drop down (change DNS target selector)
                dns_select = `
                    <select id="${dns}" onChange="dns_update('${env}', this.value);">
                        <option value="${dns}:"></option>
                        ${dns_select}
                    </select>
                `;
    
                //DNS row
                dns_row += `
                    <div class="grid1_col">${env}</div>
                    <div class="grid1_col">${dns}</div>
                    <div class="grid1_col">${dns_select}</div>
                    <div class="grid1_col">
                        <img class="icon project_dns_delete" src="images/trash_icon.png" alt="" onClick="ui_project_dns_delete('${env}', '${dns}');" title="Delete DNS mapping: ${dns}" />
                    </div>
                `;
            }else{
                dns_row += `
                    <div class="grid1_col">${env}</div>
                    <div class="grid1_col">${dns}</div>
                    <div class="grid1_col">${dns_target[dns]}</div>
                `;
            }
        }

        html_dns_rows += dns_row;
    }

    //Build DNS resolve table
    let html_dns = "";
    let html_fqdn_table = "";
    if(panel_write_access == true) {
        html_dns = `
            <div class="grid4">
                <div class="grid3_head">DNS Resolution</div>
                <div class="grid1_head">
                    <img class="icon project_dns_add" src="images/add_icon.png" alt="" onClick="ui_project_dns_add();" title="Add DNS mapping for site" />
                </div>
                <div class="grid1_col"><b>Environment</b></div>
                <div class="grid1_col"><b>DNS Name</b></div>
                <div class="grid1_col"><b>Site Mapping</b></div>
                <div class="grid1_col"></div>
                ${html_dns_rows}
            </div>
        `;

        //Get all FQDN mapping (reference table)
        let all_dns = ui_mapping_fqdn_summary()
        html_fqdn_table = `
            <br /><br /><br />
            <p><b>* Reference to all DNS mappings (all projects)</b></p>
            ${all_dns}
        `;
    }else{
        html_dns = `
            <div class="grid3">
                <div class="grid3_head">DNS Resolution</div>
                <div class="grid1_col"><b>Environment</b></div>
                <div class="grid1_col"><b>DNS Name</b></div>
                <div class="grid1_col"><b>Site Mapping</b></div>
                ${html_dns_rows}
            </div>
        `;
    }

    //DNS Prod Table
    let html = `
        ${read_access}
        <p class="project_setting_title">DNS Mapping Settings</p>
        <p>DNS resolution settings defines the mapping when the web services are in 'dev' or 'prod' mode</p>
        ${html_dns}
        ${html_fqdn_table}
    `;

    //Output project panel
    $("#project_panel").html(html);
}
function ui_project_dns_add() {
    log("ui_project_dns_add");

    //Get project data
    let project_data = website_projects[focused_project];


    //Prompt use if websites do not exist when creating a DNS record
    if(Object.keys(project_data.websites).length == 0) {
        dialog("Notice",`
            There are no websites to assign DNS names.<br />
            Please create a website before assigning a<br />
            DNS name.
        `)
        return;
    }

    //Generate site list
    let site_select = "";
    for(site in project_data.websites) {
        site_select += `<option value="${site}">${site}</option>`;
    }
    site_select = `
        <select id="site_name">
            <option value=""></option>
            ${site_select}
        </select>
    `;

    //Create dialog HTML
    html = `
        <div class="grid2">
            <div class="grid1_col">Environment:</div>
            <div class="grid1_col">
                <select id="dns_env">
                    <option value="dev">dev</option>
                    <option value="qa">qa</option>
                    <option value="stage">stage</option>
                    <option value="prod">prod</option>
                </select>
            </div>
            <div class="grid1_col">DNS FQDN Name:</div>
            <div class="grid1_col">
                <input type="text" id="dns_name" value=""><br />
                format: <i>www.domain.com</i>
            </div>
            <div class="grid1_col">Site Name:</div>
            <div class="grid1_col">${site_select}</div>
        </div>
        
        <br /><br />
        <input type="button" value="Create" onClick="dns_add();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog(`Add DNS Resolution`, html);    
}
function ui_project_dns_delete(env, dns) {
    log("ui_project_dns_delete");
    
    //Create dialog HTML
    html = `
        <input type="hidden" id="dns_env" value="${env}">
        <input type="hidden" id="dns_name" value="${dns}">

        <p>Are you sure you want to delete DNS "${dns}"?</p>
        
        <br /><br />
        <input type="button" value="Yes" onClick="dns_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;
    
    //Call dialog function
    dialog(`Delete DNS Resolution (${env})`, html);    
}

//Project Mapping UI
function ui_mapping_vhost_summary() {
    log("ui_mapping_vhost_summary");
    
    //Create VHOST list
    let html_vhost_table = "";
    let html_vhost_rows = "";
    for(let project in website_projects) {
        //Set divider line
        let grid_divider = " grid1_col_divider";

        //Loop sites
        for(let website in website_projects[project]["websites"]) {
            //Set vhost
            let this_path = `/vhost/${project}::${website}/`;
            html_vhost_rows += `
                <div class="grid1_col${grid_divider}">${project}</a></div>
                <div class="grid1_col${grid_divider}">${website}</a></div>
                <div class="grid1_col${grid_divider}"><a href="${this_path}" target="_blank">${this_path}</a></div>
            `;

            //Normal divider after first row
            grid_divider = "";
        }
    }

    //Check is any mapping exists
    if(html_vhost_rows == "") {
        if(Object.keys(website_projects) == 0) {
            html_vhost_rows = `<div class="grid3_col">** No projects are created **</div>`;
        }else{
            html_vhost_rows = `<div class="grid3_col">** No websites are created **</div>`;
        }
    }

    //Build table
    html_vhost_table = `
        <div class="grid3">
            <div class="grid3_head">All Porject Website Preview</div>
            <div class="grid1_sub_head">Project Name</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">Path (VHost URL)</div>
            ${html_vhost_rows}
        </div>
    `;

    //Return HTML
    return html_vhost_table;
}
function ui_mapping_proxy_summary() {
    // Future state
}
function ui_mapping_fqdn_summary() {
    log("ui_mapping_fqdn_summary");

    //Get server conf
    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Create FQDN list
    let html_fqdn_table = "";
    let html_fqdn_rows = "";

    for(let project in website_projects) {
        let project_data = website_projects[project]

        //Set divider line
        let grid_divider = " grid1_col_divider";

        //Loop through environments
        for(let env in project_data.dns_names) {
            //Process server modes DNS config
            for(let this_dns in project_data.dns_names[env]) {
                this_row = "";

                this_http_url = "";
                this_https_url = "";
                this_http_a = "";
                this_https_a = "";

                //Check site not mapped
                this_site = project_data.dns_names[env][this_dns];
                if(this_site == "") {
                    this_site = `<span class="font_red">(unmapped)</span>`;
                }

                //Get URL for HTTP
                if(http_on == true) {
                    if(http_port == "80") {
                        this_http_url = `http://${this_dns}/`;
                    }else{
                        this_http_url = `http://${this_dns}:${http_port}/`;
                    }
                    this_http_a = `<a href="${this_http_url}" target="_blank">HTTP</a>`;
                }else{
                    this_http_a = `-`;
                }

                //Get URL for HTTPS
                if(https_on == true) {
                    if(https_port == "443") {
                        this_https_url = `https://${this_dns}/`;
                    }else{
                        this_https_url = `https://${this_dns}:${https_port}/`;
                    }
                    this_https_a = `<a href="${this_https_url}" target="_blank">HTTPS</a>`;
                }else{
                    this_https_a = `-`;
                }

                //Check disabled
                let project_enabled = `<span class="font_green">Yes</span>`;
                if(project_data.enabled == false) {
                    project_enabled = `<span class="font_red">No</span>`;
                    this_http_a = `-`;
                    this_https_a = `-`;
                }

                //Append server mode config
                html_fqdn_rows += `
                    <div class="grid1_col${grid_divider}">${project_enabled}</div>
                    <div class="grid1_col${grid_divider}">${project}</div>
                    <div class="grid1_col${grid_divider}">${env}</div>
                    <div class="grid1_col${grid_divider}">${this_site}</div>
                    <div class="grid1_col${grid_divider}">${this_dns}</div>
                    <div class="grid1_col${grid_divider}">${this_http_a}</div>
                    <div class="grid1_col${grid_divider}">${this_https_a}</div>
                `;
            }

            //Normal divider after first row
            grid_divider = "";
        }
    }

    //Check is any mapping exists
    if(html_fqdn_rows == "") {
        html_fqdn_rows = `<div class="grid7_col">** No DNS FQDN Mapping Configured **</div>`;
    }

    html_fqdn_table = `
        <div class="grid7">
            <div class="grid7_head">All Project DNS FQDN Mapping</div>
            <div class="grid1_sub_head">Project Enabled</div>            
            <div class="grid1_sub_head">Project Name</div>
            <div class="grid1_sub_head">Environment</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">URL</div>
            <div class="grid1_sub_head">HTTP (port:${http_port})</div>
            <div class="grid1_sub_head">HTTPS (port:${https_port})</div>
            ${html_fqdn_rows}
        </div>
    `;
    
    //Return HTML
    return html_fqdn_table;
}

//Templates UI
function ui_template_create() {
    log("ui_template_create");

    //API pre-check
    if(api_check_global(["template_adm"]) == false) { return }

    //Check if project selected
    if(focused_project == "") {
        dialog("Error", "A project must be selected for extracting a template");
        return;
    }

    //Check sites exist
    let project_data = website_projects[focused_project];
    if(project_data["websites"] == undefined) {
        dialog("Error", `Project [${focused_project}] has not websites configured`);
        return;
    }else{
        if(Object.keys(project_data["websites"]) == 0) {
            dialog("Error", `Project [${focused_project}] has not websites configured`);
            return;
        }
    }

    //Create select list
    let select_site = "";
    for(website in project_data["websites"]) {
        select_site += `<input id="template_site" type="checkbox" value="${website}"> ${website}<br />`;
    }

    //Create dialog HTML
    html = `
        <div class="grid2">
            <div class="grid1_col">Template Name:</div>
            <div class="grid1_col"><input type="text" id="template_name" value="" autocomplete="off"></div>
            <div class="grid1_col">Template Description:</div>
            <div class="grid1_col"><textarea id="template_desc"></textarea></div>
            <div class="grid1_col">Site Select:</div>
            <div class="grid1_col">${select_site}</div>
        </div>
        
        <br /><br />
        <input type="button" value="Create" onClick="template_create(null, 'create');">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;
    
    //Call dialog function
    dialog(`Create Template from '${focused_project}'`, html);    
}
function ui_template_delete(template=null) {
    log("ui_template_delete");

    //API pre-check
    if(api_check_global(["template_adm"]) == false) { return }

    //Check if project selected
    if(template == "") {
        dialog("Error", "Template name is empty");
        return;
    }

    //Prompt user
    let html_dialog = `

        <input type="hidden" value="${template}" id="template_name" />

        <div>Are you sure you want to delete template [<b>${template}</b>] ?</div><br />
        <input type="button" value="Yes" onClick="template_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
        `;

    dialog("Delete Template Confirm", html_dialog);
}

//////////////////////////////////////
// Templates UI Tab
//////////////////////////////////////

function ui_templates_list(templates) {
    //Build HTML
    let html_rows = "";
    for(let template in templates) {
        //Get template description
        let this_desc = templates[template]["description"];

        //Get site list
        let this_sites = "";
        for(site in templates[template]["websites"]) {
            this_sites += `${site}<br />`;
        }

        html_rows += `
            <div class="grid1_col">${template}</div>
            <div class="grid1_col">${this_sites}</div>
            <div class="grid1_col">${this_desc}</div>
            <div class="grid1_col">
                <img class="icon icon_size" src="images/trash_icon.png" alt="" onClick="ui_template_delete('${template}');" title="Delete Template: ${template}" /> 
            </div>
        `;
    }

    //Update HTML
    if(html_rows == "") {
        html_rows = `<div class="grid4_col">*** No templates exist ***</div>`;
    }
    let html = `
        <div class='vhost_panel'>
            <div class="grid4">
                <div class="grid4_head">Templates List</div>
                <div class="grid1_sub_head">Template Name</div>
                <div class="grid1_sub_head">Sites List</div>
                <div class="grid1_sub_head">Description</div>
                <div class="grid1_sub_head"></div>
                ${html_rows}
            </div>
        </div>
    `;

    //Update panel
    $("#templates").html(html);
}

//////////////////////////////////////
// Admin UI Functions
//////////////////////////////////////

/////////////////////////////
// Web calls

//Admin functions
function admin_user_change_passwd() {
    log("admin_user_change_passwd");

    //Get password fields
    let passwd_old      = $("#admin_user_old_password").val();
    let passwd_new      = $("#admin_user_new_password").val();
    let passwd_confirm  = $("#admin_user_confirm_password").val();
    $("#dialog").dialog("close");

    //Check password fields
    if(passwd_old == "" || passwd_new == "" || passwd_confirm == "") {
        dialog("Error","Password fields cannot be blank")
        return;
    }
    if(passwd_old == passwd_new) {
        dialog("Error","Current and New password are the same, please specify a new password")
        return;
    }
    if(passwd_new != passwd_confirm) {
        dialog("Error","New and Confirmed passwords do not match")
        return;
    }
    
    // Set URL
    let url = "api/auth";
    let json = {
        "action":"change_password",
        "passwd_old": passwd_old,
        "passwd_new": passwd_new
    }

    //Set call parameters
    let params = {
        "id":"admin_user_change_passwd",
        "func_call":null,
        "method":"POST",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Server configurations
function admin_server_settings() {
    log("admin_server_settings");

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"get_configs"
    }

    //Set call parameters
    let params = {
        "id":"get_configs",
        "func_call":ui_admin_server_settings,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_server_url_mapping(mgmt, env) {
    log("admin_server_url_mapping");

    //Set selection
    if(mgmt==undefined) {
        mgmt = true;
        admin_panel["admin_server_mapping_mgmt"] = mgmt;
    }else{
        admin_panel["admin_server_mapping_mgmt"] = mgmt;
    }

    //Set selection
    if(env==undefined) {
        env = "dev";
        admin_panel["admin_server_mapping_env"] = "dev";
    }else{
        admin_panel["admin_server_mapping_env"] = env;
    }

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"get_server_url_mapping",
        "mgmt":mgmt,
        "env":env
    }

    //Set call parameters
    let params = {
        "id":"get_server_url_mapping",
        "func_call":ui_admin_server_url_mapping,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_server_url_match() {
    log("admin_server_url_match");

    //Get properties
    let this_mgmt = admin_panel["admin_server_mapping_mgmt"]
    let this_env = admin_panel["admin_server_mapping_env"]
    let this_url = $("#adm_map_url_test_box").val()

    //Check parameter
    if(this_env == "") {
        dialog("Error", "Please select environment")
    }

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"test_server_url_mapping",
        "mgmt":this_mgmt,
        "env":this_env,
        "url":this_url
    }

    //Set call parameters
    let params = {
        "id":"test_server_url_mapping",
        "func_call":ui_admin_test_url_mapping,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//User management
function admin_get_users_list() {
    log("admin_get_users_list");

    // Set URL
    let url = "api/admin";
    let json = {
        "action":"users_get"
    }

    //Set call parameters
    let params = {
        "id":"admin_get_users_list",
        "func_call":ui_admin_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_get_user_groups(username) {
    log("admin_get_user_groups");

    // Set URL
    let url = "api/admin";
    let json = {
        "action":"user_groups",
        "username":username
    }

    //Set call parameters
    let params = {
        "id":"admin_get_user_groups",
        "func_call":ui_admin_user_settings_panels,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_add_user() {
    log("admin_add_user");
    
    //Get fields
    let username = $("#admin_add_username").val();
    let password = $("#admin_add_password").val();
    let name = $("#admin_add_display_name").val();
    let email = $("#admin_add_email").val();
    $("#dialog").dialog("close");

    //Check fields
    if(username == "") {
        dialog("Error","Username cannot be blank");
        return;
    }
    if(password == "") {
        dialog("Error","Password cannot be blank");
        return;
    }

    //Set username lowercase
    username = username.toLowerCase();

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_add",
        "username":username,
        "password":password,
        "name":name,
        "email":email,
    }

    //Set call parameters
    let params = {
        "id":"admin_add_user",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_delete_user() {
    log("admin_delete_user");

    //Get username
    let username = $("#admin_del_username").val();

    //Clear user details screen
    if($("#admin_user_focus").val() == username) {
        $("#admin_user_permission").html("");
    }

    //Close dialog
    $("#dialog").dialog("close");

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_delete",
        "username":username
    }

    //Set call parameters
    let params = {
        "id":"admin_add_user",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//User settings
function admin_user_unlock(control) {
    log("admin_user_unlock");
    
    //Get properties
    let username = control.value;
    let state = control.checked;

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_unlock",
        "username":username
    }

    //Set call parameters
    let params = {
        "id":"admin_user_unlock",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_user_state(control) {
    log("admin_user_state");
    
    //Get properties
    let username = control.value;
    let state = control.checked;

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_state",
        "username":username,
        "state":state
    }

    //Set call parameters
    let params = {
        "id":"admin_user_state",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_user_group_change(control) {
    log("admin_user_state");
    
    //Get properties
    let group = control.id;
    let username = control.value;
    let state = control.checked;

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_group_member",
        "group":group,
        "username":username,
        "state":state
    }

    //Set call parameters
    let params = {
        "id":"admin_user_group_change",
        "func_call":admin_user_refresh_settings,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_user_details() {
    log("admin_user_details");
    
    //Get fields
    let username = $("#admin_user_focus").val();
    let name = $("#admin_user_name").val();
    let email = $("#admin_user_email").val();

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_details",
        "username":username,
        "name":name,
        "email":email,
    }

    //Set call parameters
    let params = {
        "id":"admin_user_details",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_user_set_password() {
    log("admin_user_set_password");
    
    //Get fields
    let username = $("#admin_user_focus").val();
    let password = $("#admin_user_new_password").val();

    //Clear password field
    $("#admin_user_new_password").val("");

    //Set URL
    let url = "api/admin";
    let json = {
        "action":"user_password_set",
        "username":username,
        "password":password,
    }

    //Set call parameters
    let params = {
        "id":"admin_user_set_password",
        "func_call":admin_get_users_list,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function admin_user_refresh_settings() {
    //Get username and refresh groups settings
    let username = $("#admin_user_focus").val();
    admin_get_user_groups(username);
}

/////////////////////////////
// UI functions

//User password reset -- TBD later (need to update the function call)
function ui_admin_user_change_passwd() {
    log("ui_admin_user_change_passwd");

    let html = `
        <form>
            <div class="grid2">
                <div class="grid2_sub_head">Username: ${jwt_user.username}</div>
                <div class="grid1_col">Current Password</div>
                <div class="grid1_col">
                    <input id="admin_user_old_password" type="password" value="" autocomplete="off">
                </div>
                <div class="grid1_col">New Password</div>
                <div class="grid1_col">
                    <input id="admin_user_new_password" type="password" value="" autocomplete="off">
                </div>
                <div class="grid1_col">Confirm Password</div>
                <div class="grid1_col">
                    <input id="admin_user_confirm_password" type="password" value="" autocomplete="off">
                </div>
            </div><br /><br />
        </form>
        <input type="button" value="Change Password" onClick="admin_user_change_passwd();">
    `;

    //Display UI
    dialog("Change Password", html);
}

//Admin UI navigation
function ui_admin_page() {
    log("ui_admin_page");
    
    let html = "";
    if(user_authorize.admin == false) {
        html = "Access Denied";
    }else{
        //Navigation
        let user_manage = `<div class="admin_nav_btn" onClick="ui_admin_user_manage();">User Management</div>`;
        let server_settings = `<div class="admin_nav_btn" onClick="admin_server_settings();">Server Settings</div>`;
        let server_map = `<div class="admin_nav_btn" onClick="admin_server_url_mapping();">Server Mapping</div>`;

        //Set HTML
        html = `
            <div class="admin_mgmt">
                <div class="admin_nav">
                    ${user_manage}
                    ${server_settings}
                    ${server_map}
                </div>
                <div id="admin_panel" class="admin_panel"></div>
            </div>
        `;    
    }

    //Update panel
    $("#admin").html(html);
}

//Server settings
function ui_admin_server_settings(response) {
    //Get server settings
    let server_configs = response.server;

    //Create table
    let html_rows = "";
    for(setting in server_configs) {
        //Setting description
        let this_desc = "";
        switch(setting) {
            case "hostname": 
                this_desc = "Server hostname setting";
            break;
            case "workers": 
                this_desc = "Number of worker processes configured to run on current server";
            break;
            case "cache_on": 
                this_desc = `
                    <b>Server caching functions:</b><br />
                    <b>true</b> - The server will cache server side execution of your project files.<br />
                    <b>false</b> - The server will delete cache of any files within your project. This excludes node modules.
                `;
            break;
            case "debug_mode_on": 
                this_desc = "Output to server console to display more detail when developing code. You will still need to use 'console.log' in some cases.";
            break;
            case "mgmt_mode": 
                this_desc = "Enable this management UI by setting 'mgmt_mode' to 'true' in the server configuration";
            break;
            case "mgmt_ui": 
                this_desc = `
                    The server will automatically set localhost, local IPs and hostname as listening names for the management UI. Define 
                    additional names using this parameter.
                `;
            break;
            case "environment": 
                this_desc = "The environment of this server (dev, qa, stage or prod). Environment vars are passed to server side execute code for use by project code.";
            break;
            case "http_on": 
                this_desc = "HTTP listener enabled or disabled";
            break;
            case "http_port": 
                this_desc = "HTTP listener port number";
            break;
            case "https_on": 
                this_desc = "HTTPS listener enabled or disabled. Requires a defined SSL certificate.";
            break;
            case "https_port": 
                this_desc = "HTTPS listener port number";
            break;
            case "ssl_key": 
                this_desc = "SSL private key file";
            break;
            case "ssl_cert": 
                this_desc = "SSL certificate file";
            break;
            case "auto_refresh_on": 
                this_desc = "Server monitors web source config file for changes and auto updates server indexing";
            break;
            case "auto_refresh_timer": 
                this_desc = "Time interval for server to check for configuration file updates";
            break;
            default:
                this_desc = "";
        }

        //Format value
        let this_value = (server_configs[setting]).toString();
        this_value = this_value.replace(",","<br />");

        //HTML rows
        html_rows += `
            <div class="grid1_col">${setting}</div>
            <div class="grid1_col">${this_value}</div>
            <div class="grid1_col">${this_desc}</div>
        `;
    }

    //Update HTML
    if(html_rows == "") {
        html_rows = `<div class="grid3_col">*** No templates exist ***</div>`;
    }
    let html = `
        <div class="grid3 grid3_server_settings">
            <div class="grid3_head">Server Settings</div>
            <div class="grid1_sub_head">Parameter</div>
            <div class="grid1_sub_head">Value</div>
            <div class="grid1_sub_head">Description</div>
            ${html_rows}
        </div>
    `;

    //Update panel
    $("#admin_panel").html(html);
}
function ui_admin_server_url_mapping(response) {
    //Get data
    let web_configs = {};
    let html_no_data = "";
    if(response["web_configs"] == undefined) {
        html_no_data = "No Web Config Data Returned<br />"
    }else{
        web_configs = response["web_configs"];
    }

    //Counter
    let match_count = 1;

    //HTML Managment UI Resolve Hostnames
    let html_mgmtui_hostnames = "";
    if(web_configs["resolve"]["mgmtui_map"]["hostnames"] != undefined) {
        let mgmtui_hostname = web_configs["resolve"]["mgmtui_map"]["hostnames"];
        if(Object.keys(mgmtui_hostname).length > 0) {
            //Get hostnames
            let html_mgmtui_rows = "";
            for(let i in mgmtui_hostname) {
                let hostname = mgmtui_hostname[i];
                html_mgmtui_rows += `
                    <div class="grid1_col">${hostname}</div>
                `;
            }

            //Set HTML
            html_mgmtui_hostnames = `
                <div class="grid1">
                    <div class="grid1_col">${match_count}) Match Hostnames (mgmt_mode = true)</div>
                    <div class="grid1_head">Management UI Hostnames</div>
                    <div class="grid1_sub_head">Hostname</div>
                    ${html_mgmtui_rows}
                </div>
            `;

            //Increment count
            match_count = match_count + 1;
        }
    }

    //HTML Managment UI Resolve VHosts
    let html_mgmtui_vhosts = "";
    if(web_configs["resolve"]["mgmtui_map"]["hostnames"] != undefined) {
        let mgmtui_vhosts = web_configs["resolve"]["mgmtui_map"]["vhosts"];
        if(Object.keys(mgmtui_vhosts).length > 0) {
            //Get hostnames
            let html_mgmtui_rows = "";
            for(let vhost in mgmtui_vhosts) {
                let project = mgmtui_vhosts[vhost]["project"];
                let website = mgmtui_vhosts[vhost]["website"];
                html_mgmtui_rows += `
                    <div class="grid1_col">${vhost}</div>
                    <div class="grid1_col">${project}</div>
                    <div class="grid1_col">${website}</div>
                `;
            }

            //Set HTML
            html_mgmtui_vhosts = `
                <div class="grid3">
                    <div class="grid3_col">${match_count}) Match VHost URI Path (mgmt_mode = true)</div>
                    <div class="grid3_head">Management UI VHost Preview Order</div>
                    <div class="grid1_sub_head">VHost Path</div>
                    <div class="grid1_sub_head">Project</div>
                    <div class="grid1_sub_head">Website</div>
                    ${html_mgmtui_rows}
                </div>
            `;

            //Increment count
            match_count = match_count + 1;
        }
    }

    //HTML Proxy Map Resolve
    let html_proxy_map = "";
    if(web_configs["resolve"]["proxy_map"] != undefined) {
        let proxy_map = web_configs["resolve"]["proxy_map"];
        if(Object.keys(proxy_map).length > 0) {
            //Get hostnames
            let html_proxy_rows = "";
            for(let proxy in proxy_map) {
                let project = proxy_map[proxy]["project"];
                let website = proxy_map[proxy]["website"];

                //Check website blank
                if(website == "") {
                    website = `<span class="font_red">(unmapped)</span>`;
                }

                //Add to row
                html_proxy_rows += `
                    <div class="grid1_col">${proxy}</div>
                    <div class="grid1_col">${project}</div>
                    <div class="grid1_col">${website}</div>
                `;
            }

            //Set HTML
            html_proxy_map = `
                <div class="grid3">
                    <div class="grid3_col">${match_count}) Match Proxy URL Mappings</div>
                    <div class="grid3_head">Proxy URL Mappings</div>
                    <div class="grid1_sub_head">Proxy Path</div>
                    <div class="grid1_sub_head">Project</div>
                    <div class="grid1_sub_head">Website</div>
                    ${html_proxy_rows}
                </div>
            `;

            //Increment count
            match_count = match_count + 1;
        }
    }

    //HTML DNS Map Resolve
    let html_dns_map = "";
    if(web_configs["resolve"]["dns_map"] != undefined) {
        let dns_map = web_configs["resolve"]["dns_map"];
        if(Object.keys(dns_map).length > 0) {
            //Get hostnames
            let html_dns_rows = "";
            for(let dns in dns_map) {
                let project = dns_map[dns]["project"];
                let website = dns_map[dns]["website"];

                //Check website blank
                if(website == "") {
                    website = `<span class="font_red">(unmapped)</span>`;
                }

                //Add to row
                html_dns_rows += `
                    <div class="grid1_col">${dns}</div>
                    <div class="grid1_col">${project}</div>
                    <div class="grid1_col">${website}</div>
                `;
            }

            //Set HTML
            html_dns_map = `
                <div class="grid3">
                    <div class="grid3_col">${match_count}) Match DNS Mappings</div>
                    <div class="grid3_head">DNS FQDN Mappings</div>
                    <div class="grid1_sub_head">DNS Name</div>
                    <div class="grid1_sub_head">Project</div>
                    <div class="grid1_sub_head">Website</div>
                    ${html_dns_rows}
                </div>
            `;

            //Increment count
            match_count = match_count + 1;
        }
    }

    //Check if tables are empty
    if(html_mgmtui_hostnames == "" && 
       html_mgmtui_vhosts == "" && 
       html_mgmtui_vhosts == "" && 
       html_proxy_map == "") {
        html_no_data = `
            ** There is no mapping configuration for this environment **<br /><br />
            &nbsp;&nbsp;&nbsp;&nbsp;Websites are not accessible in this environment.
        `;
    }

    //HTML Project Website settings and mapping
    let html_website_settings = "";
    let html_web_settings_rows = "";
    if(admin_panel["admin_server_mapping_mgmt"] == true) {
        //Get mgmt settings and default Managment UI site settings
        let project_params = web_configs.mgmtui;
        let website_params = project_params.websites.www;

        //Get settings
        html_web_settings_rows += ui_admin_server_url_mapping_websites("Management", "This UI", project_params, website_params);
    }
    if(Object.keys(web_configs.projects).length > 0) {
        //Get web_configs projects
        let projects = web_configs.projects;

        //Loop projects
        for(let project_name in projects) {
            let project_params = projects[project_name];

            //Set divider line
            let grid_divider = "grid1_col grid1_col_divider";

            //Loop Websites
            for(let website_name in project_params.websites) {
                let website_params = project_params.websites[website_name];

                //Build row
                let this_row = ui_admin_server_url_mapping_websites(project_name, website_name, project_params, website_params);
                if(grid_divider != "") {
                    this_row = this_row.replaceAll("grid1_col", grid_divider);
                }
                html_web_settings_rows += this_row;

                //Normal divider after first row
                grid_divider = "";
            }
        }
    }
    html_website_settings = `
        <div class="grid14">
            <div class="grid14_head">Project Website Configurations</div>
            <div class="grid2_sub_head">Project Settings</div>
            <div class="grid6_sub_head">Website Settings</div>
            <div class="grid2_sub_head">Sub Mapping</div>
            <div class="grid4_sub_head">Website URI Mapping</div>
            <div class="grid1_sub_head">Name</div>
            <div class="grid1_sub_head">Enabled</div>
            <div class="grid1_sub_head">Name</div>
            <div class="grid2_sub_head">Maintenance Mode and Page</div>
            <div class="grid1_sub_head">Default Doc</div>
            <div class="grid1_sub_head">Default 404</div>
            <div class="grid1_sub_head">Default 500</div>
            <div class="grid1_sub_head">URI Path</div>
            <div class="grid1_sub_head">Target Site</div>
            <div class="grid1_sub_head">API Fixed Path</div>
            <div class="grid1_sub_head">API Dynamic Path</div>
            <div class="grid1_sub_head">Static Content</div>
            <div class="grid1_sub_head">Static Path Server Exec</div>
            ${html_web_settings_rows}
        </div>
    `;

    //Generate HTML
    let html = `
        <div class="grid4">
            <div class="grid1_head">Management</div>
            <div class="grid1_head">Environment</div>
            <div class="grid1_head">URL Simulation</div>
            <div class="grid1_head">URL Simulation Match Results</div>
            <div class="grid1_col">
                <div id="adm_map_btn_mgmt_on" class="admin_map_btn">On</div>
                <div id="adm_map_btn_mgmt_off" class="admin_map_btn">Off</div>
            </div>
            <div class="grid1_col">
                <div id="adm_map_btn_dev" class="admin_map_btn">Dev</div>
                <div id="adm_map_btn_qa" class="admin_map_btn">QA</div>
                <div id="adm_map_btn_stage" class="admin_map_btn">Stage</div>
                <div id="adm_map_btn_prod" class="admin_map_btn">Prod</div>
            </div>
            <div class="grid1_col">
                <b>URL Address:</b><br />
                <input id="adm_map_url_test_box" class="admin_map_test_box" type="text" value="" autocomplete="off" />
                <br />
                <input id="adm_map_url_test_btn" type="button" value="Simulate URL Match >" />
            </div>
            <div class="grid1_col">
                <pre id="url_test_result" class="admin_map_test_pre"></pre>
            </div>
        </div>
        <br />
        <div class="grid1">
            <div class="grid1_head">Stage 1: Resolve Host, FQDN or Proxy</div>
            <div class="grid1_col">
                ${html_no_data}
                ${html_mgmtui_hostnames}
                ${html_mgmtui_vhosts}
                ${html_proxy_map}
                ${html_dns_map}
            </div>
        </div>
        <br />
        <div class="grid1">
            <div class="grid1_head">Stage 2: Resolve Project Website sub mapping, and content rules</div>
            <div class="grid1_col">
                <br />
                1) Check Maintenance Mode, 2) API Fixed Mapping, 3) API Dynamic Mapping, 4) Static Content Execute Server Side, 5) Static Content<br />
                ${html_website_settings}
            </div>
        </div>


    `;
  
    //Update panel
    $("#admin_panel").html(html);

    //Highlight management mode
    switch(admin_panel["admin_server_mapping_mgmt"]) {
        case true:   $('#adm_map_btn_mgmt_on').addClass('admin_map_btn_select');  break;
        case false:  $('#adm_map_btn_mgmt_off').addClass('admin_map_btn_select');  break;
    }

    //Highlight environment
    switch(admin_panel["admin_server_mapping_env"]) {
        case "dev":   $('#adm_map_btn_dev').addClass('admin_map_btn_select');  break;
        case "qa":    $('#adm_map_btn_qa').addClass('admin_map_btn_select');  break;
        case "stage": $('#adm_map_btn_stage').addClass('admin_map_btn_select');  break;
        case "prod":  $('#adm_map_btn_prod').addClass('admin_map_btn_select');  break;
    }

    //Add listener
    function btn_remove_class() {
        $('#adm_map_btn_dev').removeClass('admin_map_btn_select');
        $('#adm_map_btn_qa').removeClass('admin_map_btn_select');
        $('#adm_map_btn_stage').removeClass('admin_map_btn_select');
        $('#adm_map_btn_prod').removeClass('admin_map_btn_select');
    }

    var lis_adm_map_btn_mgmt_on = document.getElementById("adm_map_btn_mgmt_on");
    var lis_adm_map_btn_mgmt_off = document.getElementById("adm_map_btn_mgmt_off");

    var lis_adm_map_btn_dev = document.getElementById("adm_map_btn_dev");
    var lis_adm_map_btn_qa = document.getElementById("adm_map_btn_qa");
    var lis_adm_map_btn_stage = document.getElementById("adm_map_btn_stage");
    var lis_adm_map_btn_prod = document.getElementById("adm_map_btn_prod");

    var lis_adm_map_url_test_box = document.getElementById("adm_map_url_test_box");
    var lis_adm_map_url_test_btn = document.getElementById("adm_map_url_test_btn");

    lis_adm_map_btn_mgmt_on.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_mgmt_on').addClass('admin_map_btn_select');
        admin_server_url_mapping(true,admin_panel["admin_server_mapping_env"]);
    });
    lis_adm_map_btn_mgmt_off.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_mgmt_off').addClass('admin_map_btn_select');
        admin_server_url_mapping(false,admin_panel["admin_server_mapping_env"]);
    });
    
    lis_adm_map_btn_dev.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_dev').addClass('admin_map_btn_select');
        admin_server_url_mapping(admin_panel["admin_server_mapping_mgmt"],"dev");
    });
    lis_adm_map_btn_qa.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_qa').addClass('admin_map_btn_select');
        admin_server_url_mapping(admin_panel["admin_server_mapping_mgmt"],"qa");
    });
    lis_adm_map_btn_stage.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_stage').addClass('admin_map_btn_select');
        admin_server_url_mapping(admin_panel["admin_server_mapping_mgmt"],"stage");
    });
    lis_adm_map_btn_prod.addEventListener("click", function(event){
        btn_remove_class()
        $('#adm_map_btn_prod').addClass('admin_map_btn_select');
        admin_server_url_mapping(admin_panel["admin_server_mapping_mgmt"],"prod");
    });

    lis_adm_map_url_test_box.addEventListener("keypress", function(event){
        if(event.key === "Enter") {
            admin_server_url_match();
        }
    });
    lis_adm_map_url_test_btn.addEventListener("click", function(event){
        admin_server_url_match();
    });


}
function ui_admin_server_url_mapping_websites(project_name, website_name, project_params, website_params) {
    //Get Parameters
    let this_enabled = project_params.enabled;
    let this_maintenance = website_params.maintenance;
    let this_maintenance_page = website_params.maintenance_page;
    let this_default_doc = website_params.default_doc;
    let this_default_404 = website_params.default_errors["404"];
    let this_default_500 = website_params.default_errors["500"];

    //Highlight red or green
    if(this_enabled == false) {
        this_enabled = `<span class="font_red">No</span>`
    }else{
        this_enabled = `<span class="font_green">Yes</span>`
    }
    if(this_maintenance == true) {
        this_maintenance = `<span class="font_red">Yes</span>`
    }else{
        this_maintenance = `<span class="font_green">No</span>`
    }

    //Default mathing for rules
    let this_sub_mapping = "";
    let this_sub_mapping_target = "";
    let this_apis_fixed = "";
    let this_apis_dynamic = "";
    let this_static = "";
    let this_static_sever_exec = "";

    //Generate path match rules
    let this_sub_map = [];
    for(let sub in website_params.sub_map) {
        this_sub_map.push(sub);
    }
    this_sub_map.sort((a, b) => b.length - a.length);
    for(let i in this_sub_map) {
        this_sub_mapping = this_sub_mapping + this_sub_map[i] + "<br />";
        this_sub_mapping_target = this_sub_mapping_target + website_params.sub_map[this_sub_map[i]] + "<br />";
    }

    let this_api_fixed = [];
    for(let api in website_params.apis_fixed_path) {
        this_api_fixed.push(api);
    }
    this_api_fixed.sort((a, b) => b.length - a.length);
    for(let i in this_api_fixed) {
        this_apis_fixed = this_apis_fixed + this_api_fixed[i] + "<br />";
    }

    let this_api_dyn = [];
    for(let api in website_params.apis_dynamic_path) {
        this_api_dyn.push(api);
    }
    this_api_dyn.sort((a, b) => b.length - a.length);
    for(let i in this_api_dyn) {
        this_apis_dynamic = this_apis_dynamic + this_api_dyn[i] + "<br />";
    }

    let this_static_server = [];
    for(let api in website_params.path_static_server_exec) {
        this_static_server.push(api);
    }
    this_static_server.sort((a, b) => b.length - a.length);
    for(let i in this_static_server) {
        this_static_sever_exec = this_static_sever_exec + this_static_server[i] + "<br />";
    }

    let this_static_client = [];
    for(let api in website_params.path_static) {
        this_static_client.push(api);
    }
    this_static_client.sort((a, b) => b.length - a.length);
    for(let i in this_static_client) {
        this_static = this_static + this_static_client[i] + "<br />";
    }
    
    //Build row
    let html_web_settings_row = `
        <div class="grid1_col">${project_name}</div>
        <div class="grid1_col">${this_enabled}</div>
        <div class="grid1_col">${website_name}</div>
        <div class="grid1_col">${this_maintenance}</div>
        <div class="grid1_col">${this_maintenance_page}</div>
        <div class="grid1_col">${this_default_doc}</div>
        <div class="grid1_col">${this_default_404}</div>
        <div class="grid1_col">${this_default_500}</div>
        <div class="grid1_col">${this_sub_mapping}</div>
        <div class="grid1_col">${this_sub_mapping_target}</div>
        <div class="grid1_col">${this_apis_fixed}</div>
        <div class="grid1_col">${this_apis_dynamic}</div>
        <div class="grid1_col">${this_static}</div>
        <div class="grid1_col">${this_static_sever_exec}</div>
    `;
    
    //Return row
    return html_web_settings_row;
}
function ui_admin_test_url_mapping(response) {
    console.log(response)
    let this_log = decodeURIComponent(response.log)
    $("#url_test_result").html(this_log)
}

//User management
function ui_admin_user_manage() {
    log("ui_admin_user_manage");

    //Define left colume table
    let html = `
        <div class="grid2 grid2_admin_user_management">
            <div class="grid2_head">User Management</div>
            <div class="grid1_col" id="admin_user_list"></div>
            <div class="grid1_col" id="admin_user_permission"></div>
        </div>
    `;

    //Display UI
    $("#admin_panel").html(html);

    //Get user list
    admin_get_users_list();
}
function ui_admin_users_list(data) {
    log("ui_admin_users_list");

    //Store data in 'admin_panel' var (temp data)
    admin_panel["users"] = data;

    //Generate users list
    let html_rows = `
        <div class="grid1_sub_head"><img class="icon admin_icon_size" src="images/add_icon.png" alt="" onClick="ui_admin_user_add();" title="Add User" /></div>
        <div class="grid2_admin_sub_head_user">User</div>
        <div class="grid1_sub_head">Locked</div>
        <div class="grid1_sub_head">Disabled</div>
        <div class="grid1_sub_head"></div>
    `;

    //Loop through users list
    let locked = false;
    let disabled = false;
    for(let user in data) {
        //Get user properties
        locked = data[user]["account_locked"];
        disabled = data[user]["account_disabled"];

        //Set checkbox
        let chk_locked = "";
        let chk_disabled = "";
        if(locked == true) {
            chk_locked = `<input type="checkbox" value="${user}" onClick="admin_user_unlock(this)" checked>`;
        }else{
            chk_locked = `<input type="checkbox" value="${user}" disabled>`;
        }
        if(disabled == true) {
            chk_disabled = `<input type="checkbox" value="${user}" onClick="admin_user_state(this)" checked>`;
        }else{
            chk_disabled = `<input type="checkbox" value="${user}" onClick="admin_user_state(this)">`;
        }

        //Disable trash icon for admin
        let trash_btn = "";
        if(user != "admin") {
            trash_btn = `<img class="icon admin_icon_size" src="images/trash_icon.png" alt="" onClick="ui_admin_user_delete('${user}');" title="Delete user: ${user}" />`;
        }

        //HTML data
        if(user == "admin") {
            html_rows += `
                <div class="grid1_col">${trash_btn}</div>
                <div class="grid1_col">
                    <img class="admin_icon_size" src="images/user_icon.png" alt="" />
                </div>
                <div class="grid1_col">${user}</div>
                <div class="grid1_col">${chk_locked}</div>
                <div class="grid1_col"></div>
                <div class="grid1_col"></div>
            `;
        }else{
            html_rows += `
                <div class="grid1_col">${trash_btn}</div>
                <div class="grid1_col">
                    <img class="admin_icon_size" src="images/user_icon.png" alt="" />
                </div>
                <div class="grid1_col">${user}</div>
                <div class="grid1_col">${chk_locked}</div>
                <div class="grid1_col">${chk_disabled}</div>
                <div class="grid1_col admin_list_user" onClick="ui_admin_user_settings('${user}');">
                    <img class="admin_icon_size admin_list_user" src="images/arrow_double_right_icon.png" alt="" title="Manage user access settings, details, or password" />
                </div>
            `;
        }
    }

    //HTML
    let html = `
        <div class="grid6 grid6_admin_user_list">
            ${html_rows}
        </div>
    `;

    //Update users list
    $("#admin_user_list").html(html);
}

function ui_admin_user_add() {
    log("ui_admin_user_add");

    //Prompt user
    let html_dialog = `
        <form>
            <div class="grid2">
                <div class="grid1_col">Username</div>
                <div class="grid1_col">
                    <input id="admin_add_username" type="text" value="">
                </div>

                <div class="grid1_col">Password</div>
                <div class="grid1_col">
                    <input id="admin_add_password" type="password" value="" autocomplete="off">
                </div>
                
                <div class="grid1_col">Display Name</div>
                <div class="grid1_col">
                    <input id="admin_add_display_name" type="text" value="">
                </div>

                <div class="grid1_col">Email Address</div>
                <div class="grid1_col">
                    <input id="admin_add_email" type="text" value="">
                </div>

                <div class="grid2_col">
                    <input type="button" value="Add User" onClick="admin_add_user();">
                    <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
                </div>
            </div>
        </form>
    `;

    dialog("Add User", html_dialog);
}
function ui_admin_user_delete(username) {
    log("ui_admin_user_delete");

    //Prompt user
    let html_dialog = `

        <input id="admin_del_username" type="hidden" value="${username}">

        <div>Are you sure you want to delete user [<b>${username}</b>] ?</div><br />
        <input type="button" value="Yes" onClick="admin_delete_user();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
        `;

    dialog("Delete User Confirm", html_dialog);
}

function ui_admin_user_settings(user) {
    log("ui_admin_user_settings");

    //Create table
    let html = `
        <input type="hidden" value="${user}" id="admin_user_focus">
        <input type="hidden" value="groups" id="admin_user_panel">
        <input type="hidden" value="" id="admin_user_project_focus">

        <p>User settings for '<b>${user}</b>'</p>
        <div id="admin_user_tabs">
            <ul>
                <li><a href="#admin_user_groups" onClick="$('#admin_user_panel').val('groups');">Global Access</a></li>
                <li><a href="#admin_user_projects" onClick="$('#admin_user_panel').val('project');">Project Access</a></li>
                <li><a href="#admin_user_details" onClick="$('#admin_user_panel').val('details');">User Details</a></li>
                <li><a href="#admin_user_passwd" onClick="$('#admin_user_panel').val('password');">Set Password</a></li>
            </ul>
            <div id="admin_user_groups"></div>
            <div id="admin_user_projects"></div>
            <div id="admin_user_details"></div>
            <div id="admin_user_passwd"></div>
        </div>
    `;

    //Update HTML
    $("#admin_user_permission").html(html);

    //Set tabs
    $("#admin_user_tabs").tabs();

    //Get group permissions
    admin_get_user_groups(user);
}
function ui_admin_user_settings_panels(data) {
    log("ui_admin_user_settings_panels");

    //Get username
    let username = $("#admin_user_focus").val();

    //Store data in 'admin_panel' var (temp data)
    admin_panel["all_groups"] = data.all_groups;
    if(admin_panel["users"][username] != undefined) {
        admin_panel["users"][username]["group_membership"] = data.user_memberof;
    }

    //Populate panels
    ui_admin_user_setting_global();
    ui_admin_user_setting_project()
    ui_admin_user_setting_details();
    ui_admin_user_setting_password();
}
function ui_admin_user_setting_global() {
    log("ui_admin_user_setting_global");

    //Get username
    let username = $("#admin_user_focus").val();

    //Get all groups
    let all_groups = {};
    if(admin_panel["all_groups"] != undefined) {
        all_groups = admin_panel["all_groups"];
    }

    //Loop groups
    let html_rows = "";
    for(let group in all_groups) {
        if(!(group.startsWith("project::"))) {
            //Define checkbox
            let checkbox = "";
            if(all_groups[group]["member_users"].indexOf(username) > -1) {
                checkbox = `<input type="checkbox" id="${group}" value="${username}" onClick="admin_user_group_change(this);" checked>`;
            }else{
                checkbox = `<input type="checkbox" id="${group}" value="${username}" onClick="admin_user_group_change(this);">`;
            }

            //Add to group rows
            html_rows += `
                <div class="grid1_col">${group}</div>
                <div class="grid1_col">${checkbox}</div>
            `;
        }
    }

    //Set HTML
    let html = `
        <div class="grid2 grid2_admin_user_groups_projects">
            <div class="grid1_sub_head">Group Name</div>
            <div class="grid1_sub_head">Member</div>
            ${html_rows}
        </div>
    `;

    //Update HTML
    $("#admin_user_groups").html(html);
}
function ui_admin_user_setting_project() {
    log("ui_admin_user_setting_project");
    
    //Get all groups
    let all_groups = {};
    if(admin_panel["all_groups"] != undefined) {
        all_groups = admin_panel["all_groups"];
    }

    //Loop groups
    let project_list = [];
    for(let group in all_groups) {
        if(group.startsWith("project::")) {
            let parse_group = group.split("::");
            let project_name = parse_group[1];
            if(project_list.indexOf(project_name) == -1) {
                project_list.push(project_name);
            }
        }
    }
    project_list = project_list.sort();

    //List projects
    let html_projects = `<div class="grid2 grid2_admin_user_groups_projects">`;
    for(let i in project_list) {
        //Get project label
        let project_name = project_list[i];

        //Add to group rows
        html_projects += `
            <div class="grid1_col">${project_name}</div>
            <div class="grid1_col" onClick="ui_admin_user_setting_project_permissions('${project_name}');">
                <img class="auth_user_icon admin_list_user" src="images/arrow_double_right_icon.png" alt="" title="Manage user project permissions for: ${project_name}" />
            </div>
        `;
    }
    html_projects += `</div>`;

    //Set HTML
    let html = `
        <div class="grid2 grid2_admin_user_groups_projects">
            <div class="grid1_sub_head">Project</div>
            <div class="grid1_col" id="admin_user_project_name"></div>
            <div class="grid1_col">${html_projects}</div>
            <div class="grid1_col" id="admin_user_project_permission"></div>
        </div>
    `;

    //Update HTML
    $("#admin_user_projects").html(html);

    //Check if preselected project
    let this_panel = $("#admin_user_panel").val();
    let this_project = $("#admin_user_project_focus").val();
    if(this_panel == "project") {
        ui_admin_user_setting_project_permissions(this_project);
    }else{
        $("#admin_user_project_name").html("");
        $("#admin_user_project_permission").html("");
    }
}
function ui_admin_user_setting_project_permissions(project) {
    log("ui_admin_user_setting_project_permissions");

    //Get username
    let username = $("#admin_user_focus").val();
    $("#admin_user_project_focus").val(project)

    //Get all groups
    let all_groups = {};
    if(admin_panel["all_groups"] != undefined) {
        all_groups = admin_panel["all_groups"];
    }

    //Loop groups
    let html_rows = "";
    for(let group in all_groups) {
        if(group.startsWith(`project::${project}::`)) {
            //Define checkbox
            let checkbox = "";
            if(all_groups[group]["member_users"].indexOf(username) > -1) {
                checkbox = `<input type="checkbox" id="${group}" value="${username}" onClick="admin_user_group_change(this);" checked>`;
            }else{
                checkbox = `<input type="checkbox" id="${group}" value="${username}" onClick="admin_user_group_change(this);">`;
            }

            //Get last descriptive text
            let parse_group = group.split("::");
            let text = parse_group[2];

            //Add to group rows
            html_rows += `
                <div class="grid1_col">${text}</div>
                <div class="grid1_col">${checkbox}</div>
            `;
        }
    }

    //Set HTML
    let html = `
        <div class="grid2 grid2_admin_user_groups_projects">
            <div class="grid1_sub_head">Permission</div>
            <div class="grid1_sub_head">Enabled</div>
            ${html_rows}
        </div>
    `;

    //Update HTML
    $("#admin_user_project_name").html(`Project: <b>${project}</b>`);
    $("#admin_user_project_permission").html(html);

}
function ui_admin_user_setting_details() {
    log("ui_admin_user_setting_details");
    
    //Get focused user
    let username = $("#admin_user_focus").val();

    //Get user
    let user = admin_panel.users[username];
    let name = user.name;
    let email = user.email;

    //Set user password reset form
    html = `
        <div class="grid2">
            <div class="grid1_col">Display Name</div>
            <div class="grid1_col">
                <input type="text" value="${name}" id="admin_user_name" autocomplete="off">
            </div>
            <div class="grid1_col">Email Address</div>
            <div class="grid1_col">
                <input type="text" value="${email}" id="admin_user_email" autocomplete="off">
            </div>
        </div>
        <br />
        <input type="button" value="Save Settings" onClick="admin_user_details();">
    `;

    //Create update password fields
    $("#admin_user_details").html(html);
}
function ui_admin_user_setting_password() {
    log("ui_admin_user_setting_password");

    //Set user password reset form
    html = `
        <form>
            <input type="password" value="" id="admin_user_new_password" autocomplete="off">
        </form>
        <br />
        <input type="button" value="Set Password" onClick="admin_user_set_password();">
    `;

    //Create update password fields
    $("#admin_user_passwd").html(html);
}
