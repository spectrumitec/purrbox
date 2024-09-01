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
var server_paths = {};
var protected_paths = {};

var website_projects = {};
var website_project_errors = {}
var templates_system = {};
var templates_user = {};

var focused_project = "";
var focused_panel = "";
var focused_site = "";

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
        "func_call":ui_page_content,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//Resets focus (project deletes, renames)
function focus_reset() {
    //Clear management page
    $("#project_title").html("");
    $("#project_panel").html("");

    //Reset focus
    focused_project = "";
    focused_panel = "";
    focused_site = "";

    //Rebuild page
    get_configs();
}

//Manage projects
function project_manage(action, data={}) {
    log("project_new");

    //Set default json
    let json = {
        "action":action
    }

    //Add to query for action type
    let callback = get_configs;
    switch(action) {
        case "project_new":
            json["type"] = data.type;
            json["project_name"] = data.project_name;
            json["project_desc"] = data.project_desc;
            if(data.type == "system_template" || data.type == "user_template") {
                json["template"] = data.template;
            }
        break;
        case "project_rename": 
            json["project_selected"] = data.project_selected;
            json["project_name"] = data.project_name;
            callback = focus_reset;
        break;
        case "project_clone":
            json["project_selected"] = data.project_selected;
            json["project_name"] = data.project_name;
        break;
        case "project_delete":
            json["project_selected"] = focused_project;
            callback = focus_reset;
        break;
        case "project_set_property":
            json["project_name"] = focused_project;
            json["property"] = data.property;
            json["value"] = data.value;
        break;
        case "project_fix_config":
            json["project_name"] = focused_project;
        break;
        default:
            dialog("Error","Project manage invalid request action")
            return;
    }

    //Set URL
    let url = "api/ui_manage";

    //Set call parameters
    let params = {
        "id":"project_new",
        "func_call":callback,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function project_manage_create() {
    log("project_manage_create");

    //Get dialog properties
    let create_type = $("#create_type").val();
    let template_name = $("#template_name").val();
    let project_name = $("#project_name").val();
    let project_desc = $("#project_desc").val();
    $("#dialog").dialog("close");

    //Check parameters
    if(!(create_type == "blank" || create_type == "system_template" || create_type == "user_template")) {
        dialog("Error","New project create type is invalid");
        return;
    }
    if(project_name == "") {
        dialog("Error","Please specify a project name");
        return;
    }
    if((create_type == "system_template" || create_type == "user_template") && template_name == "") {
        dialog("Error","Please select a template that the project will be created from");
        return;
    }

    //Get properties
    let data = {
        "type":create_type,
        "project_name":project_name,
        "project_desc":project_desc
    }
    if(create_type == "system_template" || create_type == "user_template") {
        data["template"] = template_name;
    }

    //Send to server
    project_manage("project_new", data);
}
function project_manage_rename_clone() {
    log("project_manage_clone");

    //Get dialog properties
    let project_rename_clone = $("#project_rename_clone").val();
    let project_name = $("#project_name").val();
    $("#dialog").dialog("close");

    //Define action
    let action = "";
    if(project_rename_clone == "clone") {
        action = "project_clone";
    }else if(project_rename_clone == "rename") {
        action = "project_rename";
    }else{
        dialog("Error","Invalid action, clone or rename needed");
        return;
    }

    //Check parameters
    if(focused_project == "") {
        dialog("Error","Please select a project name");
        return;
    }
    if(project_name == "") {
        dialog("Error","Please specify a project name");
        return;
    }

    //Get properties
    let data = {
        "project_selected":focused_project,
        "project_name":project_name
    }

    //Send to server
    project_manage(action, data);
}
function project_manage_delete() {
    log("project_delete");

    //Close dialog
    let project_name = $("#project_name").val();
    $("#dialog").dialog("close");

    //Validate confirm delete
    if(project_name != focused_project) {
        dialog("Error", "Project name entered does not match selected project")
        return;
    }

    //Send request to server
    project_manage("project_delete", {});
}
function project_manage_set_property(property, value) {
    log("project_manage_set_property")

    //Validate
    if(property == undefined || property == "") {
        dialog("Error","Project property is invalid");
        return;
    }
    if(value == undefined) {
        dialog("Error","Project property value is invalid");
        return;
    }else{
        if(property == "project_enabled") {
            if(!(value == true || value == false)) {
                dialog("Error",`Project property[${property}] value[${value}] is invalid`);
                return;
            }
        }
    }

    //Set data
    let data = {
        "property":property,
        "value":value
    }

    //Send request to server
    project_manage("project_set_property", data);
}
function project_manage_fix_config() {
    log("project_manage_fix_config");

    //Validate project focus
    if(focused_project == "") {
        dialog("Error", "Project is not selected");
        return;
    }

    //Notice
    dialog_title = "Notice";
    dialog_message = `
        The server will check configuration structure and will<br />
        replace missing fields. This will not erase existing<br />
        configuration settings.`;
    dialog(dialog_title,dialog_message);

    //Send request to server
    project_manage("project_fix_config", {});
}

//Templates tab
function template_manage(action, data={}) {
    log("template_manage");

    //Set default json
    let json = {
        "action":action
    }

    //Add to query for action type
    switch(action) {
        case "template_new":
            json["type"] = data.type;
            json["project_name"] = data.project_name;
            json["template_name"] = data.template_name;
            json["description"] = data.description;
            if(data.type == "website") {
                json["websites"] = data.websites;
            }
        break;
        case "template_delete":
            json["template_name"] = data.template_name;
        break;
        default:
            dialog("Error","Template manage invalid request action")
            return;
    }

    // Set URL
    let url = "api/ui_manage";

    //Set call parameters
    let params = {
        "id":"template_create",
        "func_call":template_manage_refresh,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function template_manage_create() {
    log("template_manage_create");

    let data = {
        "type":"",
        "project_name":focused_project,
        "template_name":"",
        "description":"",
        "websites":[]
    }

    //Get type checkboxes
    if(document.getElementById("template_type_website").checked == true) {
        data.type = "website";
    }
    if(document.getElementById("template_type_project").checked == true) {
        data.type = "project";
    }
    if(data.type == "") {
        dialog("Error","Please select a <b>Template Type</b>")
        return;
    }

    //Get template name and description
    data.template_name = $("#template_name").val();
    data.description = $("#template_desc").val();

    //Check name
    if(data.template_name == "") {
        dialog("Error","Please define a <b>Template Name</b>")
        return;
    }

    //Create select list
    if(data.type == "website") {
        let project_data = website_projects[focused_project];
        for(website in project_data["websites"]) {
            let list_id = `select_website::${website}`;
            let list_val = document.getElementById(list_id).checked;
            if(list_val == true) {
                data.websites.push(website);
            }
        }
    }

    //Check website list
    if(data.type == "website") {
        if(data.websites.length == 0) {
            dialog("Error","Please select websites to be included in the template")
            return;
        }
    }

    //Close dialog
    $("#dialog").dialog("close");

    //Send to server
    template_manage("template_new", data);
}
function template_manage_delete() {
    log("template_manage_delete");

    //Confirm delete
    let template_name = $("#template_name").val();
    let confirm_template_name = $("#confirm_template_name").val();
    if(template_name != confirm_template_name) {
        dialog("Error","Confirmation of template name does not match selected")
        return;
    }

    //Set data
    let data = {
        "template_name":template_name
    }

    //Close dialog
    $("#dialog").dialog("close");

    //Send request to server
    template_manage("template_delete", data);
}
function template_manage_refresh(data) {
    log("template_manage_refresh");

    //Update templates data
    if(data.system != undefined) {
        templates_system = data.system;
    }
    if(data.user != undefined) {
        templates_user = data.user;
    }

    //Refresh page
    ui_templates_list();
}

//Manage website functions
function website_manage(action, data={}) {
    log(`website_manage :: ${action}`)

    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":action,
        "project":focused_project,
        "website":focused_site
    }

    //Set query properties
    switch(action) {
        case "website_new":
            //Remove website focus field
            delete json.website;

            //Process data returned
            json.type = data.type;
            switch(data.type) {
                case "blank":
                    json.website_name = data.website_name;
                break;
                case "system_template": case "user_template":
                    json.template_name = data.template_name;
                    json.template_websites = data.template_websites;
                break;
                default:
                    dialog("Error", `Function error, invalid website type`);
                    return;
            }
        break;
        case "website_rename": case "website_clone": case "website_delete":
            //Remove website focus field
            delete json.website;

            //Get parameters
            json.select_website_name = data.select_website_name;
            if(action == "website_rename" || action == "website_clone") {
                json.new_website_name = data.new_website_name;
            }
        break;
        case "website_set_property":
            try{
                switch(data.property) {
                    case "ssl_redirect":
                    case "maintenance_page":
                    case "maintenance_page_api":
                    case "default_doc":
                        json.property = data.property;
                        json.value = data.value;
                    break;
                    case "maintenance":
                        json.property = data.property;
                        json.value = data.value;
                        json.env = data.env;
                    break;
                    case "error_page":
                        json.property = data.property;
                        json.type = data.type;
                        json.page = data.page;
                        json.value = data.value;
                    break;
                    default:
                        dialog("Error", `Invalid request action[<b>${action}</b>] property[<b>${data.property}</b>]`);
                        return;
                }
            }catch(err) {
                dialog("Error", `Function request error: ${err}`);
                return;
            }
        break;
        case "website_maint_page_create": case "website_errors_pages_create": 
            //No added query fields needed
        break;
        case "website_map_add":
            json.map_type = data.map_type;
            json.web_path = data.web_path;
            json.map_path = data.map_path;
        break;
        case "website_map_delete":
            json.map_type = data.map_type;
            json.web_path = data.web_path;
        break;
        default:
            dialog("Error", `Invalid request action[<b>${action}]</b>`);
            return;
    }

    //Makes sure no json parameters are undefined
    for(let key in json) {
        if(json[key] == undefined) {
            dialog("Error", `Function error: key[<b>${key}</b>] value[<b>${json[key]}]</b>`);
            return;
        }
    }

    //Set call parameters
    let params = {
        "id":"website_manage",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    console.log(json)

    //Execute call
    web_calls(params)
}
function website_manage_create() {
    log(`website_manage_create`)

    //Get dialog properties
    let create_type = $("#create_type").val()
    let template_name = $("#template_name").val()

    //Get properties
    let data = {
        "type":create_type
    }
    switch(create_type) {
        case "blank":
            //Get website name from dialog
            let website_name = $("#website_name").val();
            if(website_name == "") {
                $("#dialog").dialog("close");
                dialog("Error", "Please specify a website name")
                return;
            }else{
                data["website_name"] = website_name;
            }
        break;
        case "system_template": case "user_template":
            //Create websites create list
            data["template_name"] = template_name;
            data["template_websites"] = {}

            //Determine templates to use
            let template_websites = {};
            if(create_type == "system_template") {
                template_websites = templates_system[template_name]["conf"]["websites"];
            }else if(create_type == "user_template") {
                template_websites = templates_user[template_name]["conf"]["websites"];
            }

            //Get selected websites and name overrides from template
            let list_website_names = []
            for(let website in template_websites) {
                //Set ID names in dialog
                let chkbox_id = `website::${website}::checkbox`;
                let txtbox_id = `website::${website}::text`;

                //Get checked values
                let checked = document.getElementById(chkbox_id).checked;
                let override = document.getElementById(txtbox_id).value;

                //Get website name or override
                let website_name = website;
                if(override != "") {
                    website_name = override;
                }

                //Add to dataset
                if(checked == true) {
                    //Check if website_name has been defined more than once
                    if(list_website_names.includes(website_name)) {
                        $("#dialog").dialog("close");
                        dialog("Error", "The new website names were defined more than once")
                        return;
                    }else{
                        list_website_names.push(website_name);
                    }

                    //Add website
                    data["template_websites"][website] = website_name;
                }
            }

            //Check if websites is empty
            if(Object.keys(data["template_websites"]).length == 0) {
                $("#dialog").dialog("close");
                dialog("Error", "No websites are selected from the template")
                return;
            }
        break;
        default:
            $("#dialog").dialog("close");
            dialog("Error", "System error, invalid create type")
            return;
    }
    $("#dialog").dialog("close");

    //Send data to website manage function
    website_manage("website_new", data)
}
function website_manage_rename_clone_delete(request=null) {
    log(`website_manage_rename_clone_delete`)
    
    //Get properties
    let action = "";
    let data = {}

    //Verify action
    if(request == null) {
        $("#dialog").dialog("close");
        dialog("Error", "Invalid request")
        return;
    }else{
        //Define action
        if(request == "rename") {
            action = "website_rename";
        }else if(request == "clone") {
            action = "website_clone";
        }else if(request == "delete") {
            action = "website_delete";
        }

        //Get selected website
        let select_website_name = $("#select_website_name").val();
        data["select_website_name"] = select_website_name;

        //Get form details
        if(request == "rename" || request == "clone") {
            let new_website_name = $("#new_website_name").val();
            if(new_website_name == "") {
                $("#dialog").dialog("close");
                dialog("Error", "Please specify a new website name")
                return;
            }else{
                data["new_website_name"] = new_website_name;
            }
        }else{
            let confirm_website_name = $("#confirm_website_name").val();
            if(select_website_name != confirm_website_name) {
                $("#dialog").dialog("close");
                dialog("Error", "Website confirm name must match the name you are deleting")
                return;
            }else{
                data["selected_website"] = select_website_name;
            }
        }
    }
    $("#dialog").dialog("close");

    //Send data to website manage function
    website_manage(action, data);
}
function website_manage_map_add() {
    log("website_manage_map_add");
    
    //Get fields
    let data = {
        "map_type":$("#website_map_type").val(),
        "web_path":encodeURIComponent($("#website_web_path").val()),
        "map_path":encodeURIComponent($("#website_map_path").val()),
    }
    $("#dialog").dialog("close");

    //Send data to website manage function
    website_manage("website_map_add", data)
}
function website_manage_map_delete() {
    log("website_manage_map_delete");
            
    //Get fields
    let data = {
        "map_type":$("#delete_map_type").val(),
        "web_path":encodeURIComponent($("#delete_map_path").val())
    }
    $("#dialog").dialog("close");

    //Send data to website manage function
    website_manage("website_map_delete", data);
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

//Manage Porject Mapping
function resolve_add_map() {
    log("resolve_add_map");

    //Get fields
    let this_proj = $("#resolve_add_project").val();
    let this_type = $("#resolve_add_type").val();
    let this_env = $("#resolve_add_env").val();
    let this_url = $("#resolve_add_url").val();
    let this_site = $("#resolve_add_site").val();

    //Strip out any 'http://' or 'https://'
    if(this_url.startsWith("http://")) {
        this_url = this_url.replace("http://", "");
    }
    if(this_url.startsWith("https://")) {
        this_url = this_url.replace("https://", "");
    }

    //Check type dns_names, make sure only hostname
    if(this_type == "dns_names") {
        let parse_url = this_url.split("/");
        this_url = parse_url[0];
    }

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"resolve_add",
        "project":this_proj,
        "type":this_type,
        "env": this_env,
        "url": this_url,
        "site": this_site
    }

    //Set call parameters
    let params = {
        "id":"resolve_add",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}
function resolve_update_map(value) {
    log("resolve_update_map");

    //Set vars
    let this_update = "";
    let this_proj = "";
    let this_type = "";
    let this_env = "";
    let this_url = "";
    let this_change = "";

    //Parse values
    try {
        let parse_value = value.split("::");
        this_update = parse_value[0];
        this_proj = parse_value[1];
        this_type = parse_value[2];
        this_env = parse_value[3];
        this_url = parse_value[4];
        this_change = parse_value[5];
    }catch(e) {
        dialog("Error", "Function caused an invalid call");
        return;
    }

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"resolve_update",
        "update":this_update,
        "project":this_proj,
        "type":this_type,
        "env": this_env,
        "url": this_url,
        "change": this_change
    }

    //Set call parameters
    let params = {
        "id":"resolve_update",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

    console.log(json)

    //Execute call
    web_calls(params)
}
function resolve_delete_map() {
    log("resolve_delete_map");

    //Get fields
    let this_proj = $("#resolve_delete_proj").val();
    let this_type = $("#resolve_delete_type").val();
    let this_env = $("#resolve_delete_env").val();
    let this_url = $("#resolve_delete_url").val();
    $("#dialog").dialog("close");

    // Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"resolve_delete",
        "project":this_proj,
        "type":this_type,
        "env": this_env,
        "url": this_url
    }

    //Set call parameters
    let params = {
        "id":"resolve_delete",
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

//Build initial page layout
function ui_page_layout() {
    log("ui_page_layout")

    //Set HTML
    let html = `
        <div class="project_list">
            <div id="project_menu" class="project_menu"></div>
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
function ui_page_content(data) {
    log("ui_page_content")

    //Store configs
    server_configs = data.server;

    //Paths
    server_paths = data.paths;
    protected_paths = data.protected_paths;

    //Project Data
    website_projects = data.projects;
    website_project_errors = data.project_error;

    templates_system = data.templates.system;
    templates_user = data.templates.user;

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

    //Build button bar over tree navigation
    ui_sidenav_btns_top();

    //Build navigation tree
    ui_sidenav_tree();

    //Build panel window
    ui_content_panel();

    //Re-select first tab
    $("#tabs").tabs("option", "active", 0);
}

//Project nav buttons above tree
function ui_sidenav_btns_top() {
    log("ui_sidenav_btns_top")

    //Check project permissions
    let admin_access = api_check_global(["project_adm"]);
    let create_access = api_check_global(["project_create"]);
    let no_admin = " project_menu_btn_transparent";
    let no_create = " project_menu_btn_transparent";

    //Unhide certain buttons
    if(admin_access == true) {
        no_admin = "";
        no_create = "";
    }else if(create_access == true) {
        no_create = "";
    }

    //HTML buttons
    let html = `
        <div id="project_new" class="project_menu_btn icon_box${no_create}" title="New Project"></div>
        <div id="project_clone" class="project_menu_btn icon_box_clone${no_create}" title="Clone Project"></div>
        <div id="project_rename" class="project_menu_btn icon_write${no_create}" title="Rename Project"></div>
        <div id="template_new" class="project_menu_btn icon_template${no_admin}" title="Create Website Template"></div>
        <div id="project_delete" class="project_menu_btn icon_trash${no_create}" title="Delete Project"></div>
        <div id="project_reload" class="project_menu_btn icon_reload" title="Reload Projects"></div>
    `;

    //Update buttons
    $("#project_menu").html(html);

    //All access listeners
    var lis_project_reload = document.getElementById("project_reload");
    lis_project_reload.addEventListener("click", function(event){
        get_configs();
    });

    //Set listeners
    if(admin_access == true || create_access == true) {
        var lis_project_new = document.getElementById("project_new");
        var lis_project_clone = document.getElementById("project_clone");
        var lis_project_rename = document.getElementById("project_rename");
        var lis_project_delete = document.getElementById("project_delete");
        lis_project_new.addEventListener("click", function(event){
            ui_sidenav_btn_project_new();
        });
        lis_project_clone.addEventListener("click", function(event){
            ui_sidenav_btn_project_rename_clone("clone");
        });
        lis_project_rename.addEventListener("click", function(event){
            ui_sidenav_btn_project_rename_clone("rename");
        });
        lis_project_delete.addEventListener("click", function(event){
            ui_sidenav_btn_project_delete();
        });
    }
    if(admin_access == true) {
        var lis_template_new = document.getElementById("template_new");
        lis_template_new.addEventListener("click", function(event){
            ui_template_create();
        });
    }
}
function ui_sidenav_btn_project_new() {
    log("ui_sidenav_btn_project_new");

    //API pre-check
    if(api_check_global(["project_adm", "project_create"]) == false) {
        dialog("Error","You do not have permission to create a project");
        return 
    }

    //Loop tempaltes and look for website types
    let system_template_count = 0;
    let user_template_count = 0;
    let types = ["system", "user"]
    for(let t in types) {
        let type = types[t];
        let templates = null;
        if(type == "system") {
            templates = templates_system;
        }else{
            templates = templates_user;
        }

        //Count templates
        for(let template in templates) {
            if(templates[template]["type"] == "project") {
                if(type == "system") {
                    system_template_count = system_template_count + 1;
                }else{
                    user_template_count = user_template_count + 1;
                }
            }
        }
    }

    //Add option if user defined templates
    let html_system_template = "";
    let html_user_template = "";
    if(system_template_count > 0) {
        html_system_template = `
            <div class="grid1_col">
                <input type="radio" id="project_system_templates" name="project_create" value="system">
                <label for="project_create">Create from system template</label>
            </div>
        `;
    }
    if(user_template_count > 0) {
        html_user_template = `
            <div class="grid1_col">
                <input type="radio" id="project_user_templates" name="project_create" value="template">
                <label for="project_create">Create from user template</label>
            </div>
        `;
    }

    //HTML dialog
    html = `
        <input id="create_type" type="hidden" value="blank" />
        <input id="template_name" type="hidden" value="" />
        <div class="grid2_inner grid2_project_create">
            <div class="grid1_inner_col">
                <div class="grid1_inner">
                    <div class="grid1_col">
                        <b>1- Select Type:</b>
                    </div>
                    <div class="grid1_col">
                        <input type="radio" id="project_blank" name="project_create" value="blank" checked>
                        <label for="project_create">Empty project folder</label>
                    </div>
                    ${html_system_template}
                    ${html_user_template}
                </div>
            </div>
            <div id="project_create_options" class="grid1_inner_col"></div>
        </div>
    `;

    //Call dialog function
    dialog(`Create Project`, html);

    //Default blank template
    ui_sidenav_btn_project_new_blank();

    //Set listener
    var lis_project_blank = document.getElementById("project_blank");
    lis_project_blank.addEventListener("click", function(event){
        $("#create_type").val("blank");
        $("#template_name").val("");
        ui_sidenav_btn_project_new_blank();        
    });

    //When user templates
    if(system_template_count > 0) {
        var lis_project_system_templates = document.getElementById("project_system_templates");
        lis_project_system_templates.addEventListener("click", function(event){
            $("#create_type").val("system_template");
            $("#template_name").val("");
            ui_sidenav_btn_project_new_from("system");
        });
    }
    if(user_template_count > 0) {
        var lis_project_user_templates = document.getElementById("project_user_templates");
        lis_project_user_templates.addEventListener("click", function(event){
            $("#create_type").val("user_template");
            $("#template_name").val("");
            ui_sidenav_btn_project_new_from("user");
        });
    }
}
function ui_sidenav_btn_project_new_blank() {
    log("ui_sidenav_btn_project_new_blank");

    //Create dialog HTML
    html = `
        <div class="grid1_inner">
            <div class="grid1_col">
                <b>2- New Project Details:</b>
            </div>
            <div class="grid1_col">
                <div class="grid1_inner">
                    <div class="grid1_col_inner">Project Name:</div>
                    <div class="grid1_col">
                        <input type="text" id="project_name" value="" autocomplete="off">
                    </div>
                    <div class="grid1_col_inner">Project Description:</div>
                    <div class="grid1_col">
                        <textarea id="project_desc"></textarea>
                    </div>
                </div>
            </div>
        </div>
       
        <br /><br />
        <input type="button" value="Create" onClick="project_manage_create();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    $("#project_create_options").html(html);
    dialog_center();
}
function ui_sidenav_btn_project_new_from(type="") {
    log(`ui_sidenav_btn_project_new_from [${type}]`);

    //Set table label
    let templates = {}
    if(type == "system") {
        templates = templates_system;
    }else{
        templates = templates_user;
    }

    //Loop templates
    let listeners = {}
    let template_list = "";
    let description = "";
    for(let template in templates) {
        if(templates[template]["type"] == "project") {
            //Key name
            let key_name = `template::${template}`;
            listeners[key_name] = template;

            //Create HTML list
            description = templates[template]["conf"]["description"];
            template_list += `
                <div class="grid1_col">
                    <input type="radio" id="${key_name}" name="template_list" value="${type}::${template}">
                    <label for="template_list">${template}</label><br>
                </div>
                <div class="grid1_col">
                    <div class="text_space_top_3">${description}</div>
                </div>
            `;
        }
    }

    //Set label
    let label = "";
    if(type == "system") {
        label = "System";
    }else{
        label = "User";
    }

    //Create HTML for dialog (website_create_options)
    let html = `
        <div class="grid2 grid2_project_create_templates">
            <div class="grid2_col">
                <b>2- Select ${label} template:</b>
            </div>
            <div class="grid1_sub_head">Template Name</div>
            <div class="grid1_sub_head">Description</div>
            ${template_list}
        </div>
        <br /><br />
        <div class="grid1_inner">
            <div class="grid1_col">
                <b>3- New Project Details:</b>
            </div>
            <div class="grid1_col">
                <div class="grid1_inner">
                    <div class="grid1_col_inner">Project Name:</div>
                    <div class="grid1_col">
                        <input type="text" id="project_name" value="" autocomplete="off">
                    </div>
                    <div class="grid1_col_inner">Project Description:</div>
                    <div class="grid1_col">
                        <textarea id="project_desc"></textarea>
                    </div>
                </div>
            </div>
        </div>
       
        <br /><br />
        <input type="button" value="Create" onClick="project_manage_create();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;
    
    //Update the right column with the templates selector table
    $("#project_create_options").html(html);
    dialog_center();

    //Add listeners
    for(let key in listeners) {
        let template = listeners[key];
        listeners[key] = document.getElementById(key);
        listeners[key].addEventListener("click", function(event){
            $("#template_name").val(template);
        });
    }
}
function ui_sidenav_btn_project_rename_clone(type="") {
    log("ui_sidenav_btn_project_clone");

    //API pre-check
    if(api_check_global(["project_adm", "project_create"]) == false) { 
        dialog("Error","You do not have permission to create a project");
        return 
    }

    //Check if project selected
    if(focused_project == "") {
        dialog("Error", "A project is not selected. Please select a project to clone.");
        return;
    }

    //Determine label
    let label = "Rename"
    if(type == "clone") {
        label = "Clone"
    }

    //Create dialog HTML
    html = `
        <input id="project_rename_clone" type="hidden" value="${type}" />

        <div class="grid2_inner">
            <div class="grid1_col">Selected Project:</div>
            <div class="grid1_col">${focused_project}</div>
            <div class="grid1_col">Name of Clone:</div>
            <div class="grid1_col">
                <input type="text" id="project_name" value="" autocomplete="off">
            </div>
        </div>
        
        <br /><br />
        <input type="button" value="${label}" onClick="project_manage_rename_clone();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog(`${label} Project`, html);
}
function ui_sidenav_btn_project_delete() {
    log("ui_sidenav_btn_project_delete");

    //API pre-check
    if(api_check_global(["project_adm", "project_create"]) == false) { 
        dialog("Error","You do not have permission to create a project");
        return 
    }

    //Check if project selected
    if(focused_project == "") {
        dialog("Error", "A project is not selected. Please select a project to delete.");
        return;
    }

    //Prompt user
    let html_dialog = `
        <p>
        Are you sure you want to delete project <b>${focused_project}</b> ?
        <br /><br />
        Confirm delete by typing project name below:
        </p>
        <input id="project_name" type="text" value="" autocomplete="off">
        <br /><br />
        <input type="button" value="Delete" onClick="project_manage_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
        `;

    //Call dialog function
    dialog("Delete Project Confirm", html_dialog);
}

//Project tree list
function ui_sidenav_tree() {
    log("ui_sidenav_tree");

    //Build tree view base
    let project_all = [];

    //Loop projects
    for(project in website_projects) {
        log(`ui_sidenav_tree :: project[${project}]`)

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
                "children": ui_sidenav_tree_projects(project, website_projects[project])
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
                "id" : "resolve",
                "text" : "Resolve",
                "icon" : "images/resolve_icon.png",
                "state" : {
                    "opened" : true,
                    "selected" : false
                },
                "children": []
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
        ui_sidenav_tree_click(data);
    });
    $("#project_tree").on("open_node.jstree", function (e, data) {
        project_files_selected_object = "";
        ui_sidenav_tree_click(data);
    });
    $("#project_tree").on("close_node.jstree", function () {
        project_files_selected_object = "";
        $("#project_title").html("");
        $("#project_panel").html("");
    });
}
function ui_sidenav_tree_projects(project_name, project_data) {
    log(`ui_sidenav_tree_projects :: ${project_name}`);

    //Build tree view base
    let project_tree = [
        {
            "id" : `project_websites::${project_name}`,
            "text" : "Websites",
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
        }
    ];

    //Get sites
    for(let site in project_data.websites) {
        let this_site = {
                "id":`project_website::${project_name}::${site}`,
                "parent":"project_websites",
                "text":`${site}`,
                "icon" : "images/world_icon.png"
            };
        
        //Add to tree
        project_tree[0]["children"].push(this_site);
    }

    //Return tree
    return project_tree;
}
function ui_sidenav_tree_click(data) {
    //Get ID string from tree view
    let tree_id = data.node.id;

    log(`ui_sidenav_tree_click :: ${tree_id}`);

    //Tree selection
    if(tree_id.startsWith("project::")) {
        log("ui_sidenav_tree_click :: select project");

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
                case "project_websites":
                    focused_panel = "project_panel_websites";
                    focused_site = "";
                    break;
                case "project_website":
                    focused_panel = "project_panel_website";
                    focused_project = parse_tree_id[1];
                    focused_site = parse_tree_id[2];
                    break;
                case "project_files":
                    focused_panel = "project_panel_files";
                    focused_site = "";
                    break;

                case "resolve":
                    focused_panel = "resolve_panel";
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
    ui_content_panel();
}

//Load panel UIs
function ui_content_panel() {

    //
    // focused_project defined @ ui_sidenav_tree_click
    // focused_panel defined @ ui_sidenav_tree_click
    //

    log(`ui_content_panel :: Panel   : ${focused_panel}`)
    log(`ui_content_panel :: Project : ${focused_project}`)
    log(`ui_content_panel :: Website : ${focused_site}`)

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
            case "project_panel_websites":  ui_websites(); break;
            case "project_panel_website":   ui_website_settings(); break;
            case "project_panel_files":     ui_project_files(); break;

            case "resolve_panel":           ui_resolve_panel(); break;
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
            <div class="grid2_head">Top of Navigation Tree Buttons</div>
            <div class="grid1_col"><img src="images/box_icon.png" alt="" /></div>
            <div class="grid1_col">Create a project</div>
            <div class="grid1_col"><img src="images/box_clone_icon.png" alt="" /></div>
            <div class="grid1_col">Clone a project</div>
            <div class="grid1_col"><img src="images/write_icon.png" alt="" /></div>
            <div class="grid1_col">Rename a project</div>
            <div class="grid1_col"><img src="images/template_icon.png" alt="" /></div>
            <div class="grid1_col">Select a project and turn it into a re-usable template</div>
            <div class="grid1_col"><img src="images/trash_icon.png" alt="" /></div>
            <div class="grid1_col">Select project in the projects tree and delete it</div>
            <div class="grid1_col"><img src="images/reload_icon.png" alt="" /></div>
            <div class="grid1_col">Reload project configurations from server (refresh)</div>
            <div class="grid2_col"></div>
            <div class="grid2_head">Side Navigation</div>
            <div class="grid1_col"><img src="images/box_icon.png" alt="" /></div>
            <div class="grid1_col">Your projects will list under this icon on the tree</div>
            <div class="grid1_col"><img src="images/resolve_icon.png" alt="" /></div>
            <div class="grid1_col">Once you have projects with websites, you can setup Proxy Map and DNS Name</div>
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

        //Get project errors
        let this_error = "good";
        if(website_project_errors[project] != undefined) {
            this_error = website_project_errors[project]["errlvl"];
        }

        //Format enabled and disables
        let config_valid = `<div class="icon icon_size icon_good"></div>`;
        switch(this_error) {
            case "warning":
                config_valid = `<div class="icon icon_size icon_warning"></div>`;
            break;
            case "error":
                config_valid = `<div class="icon icon_size icon_error"></div>`;
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
            <div class="grid2_head">Resolve</div>
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
function ui_resolve_panel() {
    log(`ui_resolve_panel`)
    
    //Check resolve permissions
    let panel_write_access = api_check_global(["dns_adm"]);
    let read_access = "";
    if(panel_write_access == false) {
        read_access = ui_panel_read_only()
    }

    //Get server conf
    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Create FQDN list
    let html_fqdn_rows = "";

    //Loop through projects
    let select_project = "";
    for(let project in website_projects) {
        //Set project data
        let project_data = website_projects[project];

        //Set project options list
        select_project += `<option value="${project}">${project}</option>`;

        //Loop through environments
        let mapping = ["proxy_map", "dns_names"]
        for(let m in mapping) {
            let resolve_type = mapping[m];

            //Set type label
            let resolve_type_label = "Proxy Map";
            if(resolve_type == "dns_names") {
                resolve_type_label = "DNS FQDN";
            }

            //Loop environments
            for(let env in project_data[resolve_type]) {
                //Process server modes DNS config
                for(let resolve_url in project_data[resolve_type][env]) {
                    //Parse URL for Proxy Mapping
                    let this_hostname = "";
                    let this_path = "";
                    if(resolve_type == "proxy_map") {
                        //Parse URL
                        let parse_url = resolve_url.split("/");
                        this_hostname = parse_url[0];
                        this_path = resolve_url.substring(this_hostname.length, resolve_url.length);
                    }else{
                        this_hostname = resolve_url;
                        this_path = "/";
                    }

                    //Links
                    let this_http_url = "";
                    let this_https_url = "";
                    let this_http_a = "";
                    let this_https_a = "";

                    //Get URL for HTTP
                    if(http_on == true) {
                        if(http_port == "80") {
                            this_http_url = `http://${this_hostname}${this_path}`;
                        }else{
                            this_http_url = `http://${this_hostname}:${http_port}${this_path}`;
                        }
                        this_http_a = `<a href="${this_http_url}" target="_blank">HTTP</a>`;
                    }else{
                        this_http_a = `-`;
                    }

                    //Get URL for HTTPS
                    if(https_on == true) {
                        if(https_port == "443") {
                            this_https_url = `https://${this_hostname}${this_path}`;
                        }else{
                            this_https_url = `https://${this_hostname}:${http_port}${this_path}`;
                        }
                        this_https_a = `<a href="${this_https_url}" target="_blank">HTTPS</a>`;
                    }else{
                        this_https_a = `-`;
                    }

                    //Check site not mapped
                    this_site = project_data[resolve_type][env][resolve_url];

                    //Check disabled
                    if(project_data.enabled == false || this_site == "") {
                        this_http_a = `-`;
                        this_https_a = `-`;
                    }

                    //Check panel write access
                    if(panel_write_access == true) {
                        let btn_delete = "";
                        let select_project = "";
                        let select_env = "";
                        let select_site = "";

                        //
                        // Drop down list change value breakdown (separator :: )
                        //   0 - update type
                        //   1 - project name (origin)
                        //   2 - resolve type
                        //   3 - environment
                        //   4 - URL
                        //   5 - change value

                        //Build project list drop down
                        for(let new_project in website_projects) {
                            if(project == new_project) {
                                select_project += `<option value="resolve_select_project::${project}::${resolve_type}::${env}::${resolve_url}::${new_project}" selected>${new_project}</option>`;
                            }else{
                                select_project += `<option value="resolve_select_project::${project}::${resolve_type}::${env}::${resolve_url}::${new_project}">${new_project}</option>`;
                            }
                        }
                        select_project = `
                            <select id="resolve_select_project::${project}::${resolve_type}::${env}::${resolve_url}" class="resolve_project_option">
                                ${select_project}
                            </select>
                        `;

                        //Build environment list drop down
                        let these_env = ["dev","qa","stage","prod"];
                        for(let e in these_env) {
                            let new_env = these_env[e];
                            if(env == new_env) {
                                select_env += `<option value="resolve_select_env::${project}::${resolve_type}::${env}::${resolve_url}::${new_env}" selected>${new_env}</option>`;
                            }else{
                                select_env += `<option value="resolve_select_env::${project}::${resolve_type}::${env}::${resolve_url}::${new_env}">${new_env}</option>`;
                            }
                        }
                        select_env = `
                            <select id="resolve_select_env::${project}::${resolve_type}::${env}::${resolve_url}" class="resolve_env_option">
                                ${select_env}
                            </select>
                        `;

                        //Build site list for drop down (related to current project)
                        for(let new_site in project_data.websites) {
                            if(this_site == new_site) {
                                select_site += `<option value="resolve_select_site::${project}::${resolve_type}::${env}::${resolve_url}::${new_site}" selected>${new_site}</option>`;
                            }else{
                                select_site += `<option value="resolve_select_site::${project}::${resolve_type}::${env}::${resolve_url}::${new_site}">${new_site}</option>`;
                            }
                        }
                        select_site = `
                            <select id="resolve_select_site::${project}::${resolve_type}::${env}::${resolve_url}" class="resolve_website_option">
                                <option value="resolve_select_site::${project}::${resolve_type}::${env}::${resolve_url}::"></option>
                                ${select_site}
                            </select>
                        `;

                        //Delete button
                        btn_delete = `<div id="resolve_trash_site::${project}::${resolve_type}::${env}::${resolve_url}" class="icon icon_size icon_trash"></div>`;

                        //Append server mode config
                        html_fqdn_rows += `
                            <div class="grid1_col">${select_project}</div>
                            <div class="grid1_col">${resolve_type_label}</div>
                            <div class="grid1_col">${select_env}</div>
                            <div class="grid1_col">${resolve_url}</div>
                            <div class="grid1_col">${this_http_a}</div>
                            <div class="grid1_col">${this_https_a}</div>
                            <div class="grid1_col">${select_site}</div>
                            <div class="grid1_col">${btn_delete}</div>
                        `;

                    }else{
                        if(this_site == "") {
                            this_site = `<span class="font_red">(unmapped)</span>`;
                        }

                        //Append server mode config
                        html_fqdn_rows += `
                            <div class="grid1_col">${project}</div>
                            <div class="grid1_col">${resolve_type_label}</div>
                            <div class="grid1_col">${env}</div>
                            <div class="grid1_col">${resolve_url}</div>
                            <div class="grid1_col">${this_http_a}</div>
                            <div class="grid1_col">${this_https_a}</div>
                            <div class="grid2_col">${this_site}</div>
                        `;
                    }
                }
            }
        }
    }

    //Check is any mapping exists
    if(html_fqdn_rows == "") {
        html_fqdn_rows = `<div class="grid8_col">** No Mapping Configured **</div>`;
    }

    //Add button
    let resolve_add = "";
    if(panel_write_access == true) {
        //Map add
        resolve_add = `
            <div class="grid1_col">
                <select id="resolve_add_project" class="resolve_project_option">
                    <option value=""></option>
                    ${select_project}
                </select>
            </div>
            <div class="grid1_col">
                <select id="resolve_add_type">
                    <option value=""></option>
                    <option value="proxy_map">Proxy Map</option>
                    <option value="dns_names">DNS FQDN</option>
                </select>
            </div>
            <div class="grid1_col">
                <select id="resolve_add_env" class="resolve_env_option">
                    <option value=""></option>
                    <option value="dev">Dev</option>
                    <option value="qa">QA</option>
                    <option value="stage">Stage</option>
                    <option value="prod">Prod</option>
                </select>
            </div>
            <div class="grid1_col">
                <input id="resolve_add_url" type="text" value="" />
            </div>
            <div class="grid2_col"></div>
            <div class="grid1_col">
                <select id="resolve_add_site" class="resolve_website_option">
                    <option value=""></option>
                </select>
            </div>
            <div class="grid1_col">
                <div id="resolve_add_btn" class="icon icon_size icon_add"></div>
                <input id="resolve_add_proj" type="hidden" value="${focused_project}" />
            </div>
        `;
    }

    //VHost summary
    let vhost_summary = ui_resolve_vhost_summary()

    //Define table
    let html = `
        ${read_access}
        <div class="grid8">
            <div class="grid8_head">Project Website Proxy and DNS Resolve</div>
            <div class="grid1_sub_head">Project</div>
            <div class="grid1_sub_head">Map Type</div>
            <div class="grid1_sub_head">Environment</div>
            <div class="grid1_sub_head">URL</div>
            <div class="grid1_sub_head">HTTP (port:${http_port})</div>
            <div class="grid1_sub_head">HTTPS (port:${https_port})</div>
            <div class="grid2_sub_head">Website Target</div>
            ${html_fqdn_rows}
            ${resolve_add}
        </div>
        <br />
        ${vhost_summary}
    `;

    //Populate panel
    $("#project_title").html("Resolve Proxy Mapping and DNS FQDN");
    $("#project_panel").html(html);

    if(panel_write_access == true) {
        //Project select listener
        let lis_resolve_add_project = document.getElementById("resolve_add_project")
        lis_resolve_add_project.addEventListener("change", function(event){
            let select_project = $("#resolve_add_project").val()
            let select_site = `<option value="" selected></option>`;
            for(let project in website_projects) {
                if(select_project == project) {
                    for(let website in website_projects[project]["websites"]) {
                        select_site += `<option value="${website}">${website}</option>`;
                    }
                }
            }
            $("#resolve_add_site").html(select_site)
        });

        //Add select and trash button listeners
        let lis_resolve = {}
        let resolve_types = ["proxy_map", "dns_names"];
        for(let project in website_projects) {
            for(let i in resolve_types) {
                let resolve_type = resolve_types[i];
                for(let this_env in website_projects[project][resolve_type]) {
                    for(let this_url in website_projects[project][resolve_type][this_env]) {
                        //Get IDs of controls
                        let resolve_select_proj = `resolve_select_project::${project}::${resolve_type}::${this_env}::${this_url}`;
                        let resolve_select_env = `resolve_select_env::${project}::${resolve_type}::${this_env}::${this_url}`;
                        let resolve_select_site = `resolve_select_site::${project}::${resolve_type}::${this_env}::${this_url}`;
                        let resolve_trash_map = `resolve_trash_site::${project}::${resolve_type}::${this_env}::${this_url}`;

                        //Configure listener
                        lis_resolve[resolve_select_proj] = document.getElementById(resolve_select_proj);
                        lis_resolve[resolve_select_env] = document.getElementById(resolve_select_env);
                        lis_resolve[resolve_select_site] = document.getElementById(resolve_select_site);
                        lis_resolve[resolve_trash_map] = document.getElementById(resolve_trash_map);

                        lis_resolve[resolve_select_proj].addEventListener("change", function(event){
                            resolve_update_map(this.value);
                        });
                        lis_resolve[resolve_select_env].addEventListener("change", function(event){
                            resolve_update_map(this.value);
                        });
                        lis_resolve[resolve_select_site].addEventListener("change", function(event){
                            resolve_update_map(this.value);
                        });
                        lis_resolve[resolve_trash_map].addEventListener("click", function(event){
                            ui_resolve_delete_map(this.id);
                        });
                    }
                }
            }
        }

        //Add listener for map add button
        let lis_resolve_add_btn = document.getElementById("resolve_add_btn");
        lis_resolve_add_btn.addEventListener("click", function(event){
            resolve_add_map();
        });
    }
}
function ui_resolve_vhost_summary() {
    log("ui_resolve_vhost_summary");
    
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
            <div class="grid3_head">Porject Website VHost Preview</div>
            <div class="grid1_sub_head">Project Name</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">Path (VHost URL)</div>
            ${html_vhost_rows}
        </div>
    `;

    //Return HTML
    return html_vhost_table;
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

    //Get errors
    let project_errors = {}
    let project_error_state = "good";
    let project_error_notes = "";
    let project_fix_button = "";
    if(website_project_errors[focused_project] != undefined) {
        //Set error state
        project_errors = website_project_errors[focused_project];
        project_error_state = project_errors.errlvl;

        //Get error notes
        if(project_errors.message != "") {
            project_error_notes += "<b>Porject Error Notes:</b><br />";
            project_error_notes += (project_errors.message).replaceAll("\n", "<br />");
            project_error_notes += "<br />";
        }

        //Check website errors
        if(Object.keys(project_errors.websites).length > 0) {
            project_error_notes += "<b>Websites Errors:</b><br />";
            for(let website in project_errors.websites) {
                project_error_notes += `${website}:<br />`;
                project_error_notes += (project_errors.websites[website]["message"]).replaceAll("\n", "<br />");
                project_error_notes += `<br />`;
            }
        }

        //Set project fix button
        let config_fix_note = "";
        if(project_error_notes.includes("Config File:")) {
            project_fix_button = `<input id="project_config_fix" class="project_fix_btn" type="button" value="Fix Config File Errors" />`;
            config_fix_note = `
                <b>CONFIG FILE FIX NOTE:</b><br />
                Most configuration file errors can be corrected by the fix button above. For updates from prior server version 
                this will bring config file changes into alignment. It may reset maintenance mode, maintenance page and default 
                errors pages and may require some reconfiguration.
                <br /><br />
                If there are invalid configuration settings the fix button will try and correct them or potentially remove those 
                parameters if appearing corrupted. If you have updated the configuration file manually, please make sure to create 
                a backup of the file before proceeding.
                <br /><br />
            `;
        }
        let file_missing_note = "";
        if(project_error_notes.includes("Missing Files:")) {
            file_missing_note = `
                <b>MISSING FILES NOTE:</b><br />
                Missing files or folders are detected in your project. If you have manually renamed or deleted any files or folders 
                at the filesystem level, it may result in reported errors. Items such as maintenance and error pages can be created 
                from the website settings panels. Makes sure default file names for these 
                settings match what you have in your source files such as default document, maintenance page, and error document names 
                otherwise the system may report errors.
                <br /><br />
                See websiite settings <img src="images/gear_icon.png" alt="" /> for '_maintenance_page' or '_error_pages' errors
                <br /><br />
            `;
        }

        //Add notes
        project_error_notes = config_fix_note + file_missing_note + project_error_notes;

        //Format string
        let match_text = project_error_notes.match(/(('|\[)[a-zA-Z0-9\=\{\}\.\_\-\ \\\/]*('|\]))/g)
        for(let i in match_text) {
            let this_match = match_text[i];
            project_error_notes = project_error_notes.replaceAll(this_match, `<b class="font_red">${this_match}</b>`);
        }

    }

    //Project config valid (property added from project_config_validate() on load)
    let project_valid_state = "";
    switch(project_error_state) {
        case "good":
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="icon icon_size icon_good"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Good</div>
                    </div>
                </div>
            `;
        break;
        case "warning":
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="icon icon_size icon_warning"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Warning</div>
                    </div>
                </div>
            `;
        break;
        case "error":
            project_valid_state = `
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div class="icon icon_size icon_error"></div>
                    </div>
                    <div class="grid1_inner_col">
                        <div class="project_config_state_text">Error</div>
                    </div>
                </div>
            `;
        break;
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
                ${project_error_notes}
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
                ${project_error_notes}
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
            <div class="grid1_col"><div class="text_space_top_3">Enabled</div></div>
            <div class="grid1_col">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <input id="project_enabled" type="checkbox"${this_enabled}>
                    </div>
                    <div class="grid1_inner_col">
                        (disable will turn off Porxy Map or DNS FQDN resolve)
                    </div>
                </div>
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
            project_manage_set_property("project_desc", this_project_desc)
        });
        lis_project_enabled.addEventListener("change", function(event){
            let this_project_enabled = document.getElementById("project_enabled").checked
            project_manage_set_property("project_enabled", this_project_enabled)
        });

        //Add listener for fix button
        if(document.getElementById("project_config_fix") != undefined) {
            var lis_project_config_fix = document.getElementById("project_config_fix");
            lis_project_config_fix.addEventListener("click", function(event){
                project_manage_fix_config()
            }); 
        }
    }else{
        document.getElementById("project_enabled").disabled = true;
    }
}
function ui_websites() {
    log("ui_websites");

    //Focused site
    let project_data = website_projects[focused_project];
    let websites = project_data.websites;

    //Set default HTML
    let html = "";

    //Check websites permissions
    let website_admin_access = api_check_project(["project_adm", "website_adm"]);
    let website_settings_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);

    let html_read_only_banner = "";
    if(website_admin_access == false || website_settings_write_access == false) {
        html_read_only_banner = ui_panel_read_only();
        html_read_only_banner += "<p>Restricted from:<br />";
        if(website_admin_access == false) {
            html_read_only_banner += "Website Creation<br />";
        }
        if(website_settings_write_access == false) {
            html_read_only_banner += "Website Settings<br />";
        }
        html_read_only_banner += "</p>";
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
                        <input id="chk_ssl_redirect::${site}" type="checkbox"${ssl_checked}${ssl_disabled} /> 
                    </div>
                    <div class="grid1_inner_col">
                        global
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
                <div class="grid1_inner_col">
                    <input id="chk_maint_mode::${site}::${env}" type="checkbox"${maint_checked}${maint_disabled} />
                </div>
                <div class="grid1_inner_col">
                    ${env}&nbsp;&nbsp;&nbsp;
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
        if(website_admin_access == true) {
            html_website_rows += `
                <div class="grid1_col">
                    <div class="grid4_inner grid4_site_name_edit">
                        <div class="grid1_inner_col">${site}</div>
                        <div class="grid1_inner_col">
                            <div class="icon icon_size icon_write" onClick="ui_website_rename_clone('${site}', 'rename');" title="Rename Site"></div>
                        </div>
                        <div class="grid1_inner_col">
                            <div class="icon icon_size icon_clone" onClick="ui_website_rename_clone('${site}', 'clone');" title="Clone Site"></div>
                        </div>
                        <div class="grid1_inner_col">
                            <div class="icon icon_size icon_trash" onClick="ui_website_delete('${site}');" title="Delete Site"></div>
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

    //No websites row
    if(html_website_rows == "") {
        html_website_rows = `<div class="grid4_col">** No existing websites **</div>`;
    }

    //Create website row
    let html_create_website = "";
    if(website_admin_access == true) {
        html_create_website = `
            <div class="grid4_sub_head">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">
                        <div id="create_website" class="icon icon_size icon_add"></div>
                    </div>
                    <div class="grid1_inner_col"><b>Create Website</b></div>
                </div>
            </div>
        `;
    }

    //HTML Table
    html_website_table = `
        <div class="grid4">
            <div class="grid4_head">Websites</div>
            <div class="grid1_sub_head">Website Name</div>
            <div class="grid1_sub_head">SSL Redirect</div>
            <div class="grid1_sub_head">Maintenance Mode (per Environment)</div>
            <div class="grid1_sub_head">Website Preview</div>
            ${html_website_rows}
            ${html_create_website}
        </div>
    `;

    //Get VHOST and FQDN mapping
    let html_site_resolve_table = ui_websites_resolve();

    //Add VHOST and DNS mapping
    html = html_read_only_banner +
           html_website_table +
           html_site_resolve_table;

    //Output project panel
    $("#project_panel").html(html);

    //API pre-check
    if(website_admin_access == true) {
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
                let parse_id = this.id.split("::");                 //Get site
                focused_site = parse_id[1]                          //Focus Site
                let data = {
                    "property": "ssl_redirect",
                    "value": this.checked
                }
                website_manage("website_set_property", data);
                focused_site = "";                                  //Un-focus Site
            });
            chk_listeners[maint_mode_key_dev].addEventListener("click", function(event){
                let parse_id = this.id.split("::");
                focused_site = parse_id[1]
                let data = {
                    "property": "maintenance",
                    "env": parse_id[2],
                    "value": this.checked
                }
                website_manage("website_set_property", data);
                focused_site = "";
            });
            chk_listeners[maint_mode_key_qa].addEventListener("click", function(event){
                let parse_id = this.id.split("::");
                focused_site = parse_id[1]
                let data = {
                    "property": "maintenance",
                    "env": parse_id[2],
                    "value": this.checked
                }
                website_manage("website_set_property", data);
                focused_site = "";
            });
            chk_listeners[maint_mode_key_stage].addEventListener("click", function(event){
                let parse_id = this.id.split("::");
                focused_site = parse_id[1]
                let data = {
                    "property": "maintenance",
                    "env": parse_id[2],
                    "value": this.checked
                }
                website_manage("website_set_property", data);
                focused_site = "";
            });
            chk_listeners[maint_mode_key_prod].addEventListener("click", function(event){
                let parse_id = this.id.split("::");
                focused_site = parse_id[1]
                let data = {
                    "property": "maintenance",
                    "env": parse_id[2],
                    "value": this.checked
                }
                website_manage("website_set_property", data);
                focused_site = "";
            });
        }

        //Add listener - project site create
        var lis_create_website = document.getElementById("create_website");
        lis_create_website.addEventListener("click", function(event){
            ui_website_create();
        });

    }

    //Add listeners - Project Mapping 
    let dns_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);
    if(dns_write_access == false) {
        dns_write_access = api_check_global(["dns_adm"]);
    }
    if(dns_write_access == true) {
        //Add website select listeners
        let lis_resolve = {}
        let resolve_types = ["proxy_map", "dns_names"];
        for(let i in resolve_types) {
            let resolve_type = resolve_types[i];
            for(let this_env in project_data[resolve_type]) {
                for(let this_url in project_data[resolve_type][this_env]) {
                    //Configure listener
                    let resolve_select_env = `resolve_select_env::${focused_project}::${resolve_type}::${this_env}::${this_url}`;
                    let resolve_select_site = `resolve_select_site::${focused_project}::${resolve_type}::${this_env}::${this_url}`;

                    lis_resolve[resolve_select_env] = document.getElementById(resolve_select_env);
                    lis_resolve[resolve_select_site] = document.getElementById(resolve_select_site);
                    lis_resolve[resolve_select_env].addEventListener("change", function(event){
                        resolve_update_map(this.value);
                    });
                    lis_resolve[resolve_select_site].addEventListener("change", function(event){
                        resolve_update_map(this.value);
                    });
                }
            }
        }
    }
}
function ui_websites_resolve() {
    log("ui_websites_resolve");

    //Focused site
    let project_data = website_projects[focused_project];

    //Check websites permissions
    let panel_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);
    if(panel_write_access == false) {
        panel_write_access = api_check_global(["dns_adm"]);
    }

    //Get server conf
    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Create FQDN list
    let html_fqdn_table = "";
    let html_fqdn_rows = "";

    //Loop through environments
    let mapping = ["proxy_map", "dns_names"]
    for(let m in mapping) {
        let resolve_type = mapping[m];

        //Set type label
        let resolve_type_label = "Proxy Map";
        if(resolve_type == "dns_names") {
            resolve_type_label = "DNS FQDN";
        }

        //Loop environments
        for(let env in project_data[resolve_type]) {
            //Process server modes DNS config
            for(let resolve_url in project_data[resolve_type][env]) {
                //Parse URL for Proxy Mapping
                let this_hostname = "";
                let this_path = "";
                if(resolve_type == "proxy_map") {
                    //Parse URL
                    let parse_url = resolve_url.split("/");
                    this_hostname = parse_url[0];
                    this_path = resolve_url.substring(this_hostname.length, resolve_url.length);
                }else{
                    this_hostname = resolve_url;
                    this_path = "/";
                }

                //Links
                let this_http_url = "";
                let this_https_url = "";
                let this_http_a = "";
                let this_https_a = "";

                //Get URL for HTTP
                if(http_on == true) {
                    if(http_port == "80") {
                        this_http_url = `http://${this_hostname}${this_path}`;
                    }else{
                        this_http_url = `http://${this_hostname}:${http_port}${this_path}`;
                    }
                    this_http_a = `<a href="${this_http_url}" target="_blank">HTTP</a>`;
                }else{
                    this_http_a = `-`;
                }

                //Get URL for HTTPS
                if(https_on == true) {
                    if(https_port == "443") {
                        this_https_url = `https://${this_hostname}${this_path}`;
                    }else{
                        this_https_url = `https://${this_hostname}:${http_port}${this_path}`;
                    }
                    this_https_a = `<a href="${this_https_url}" target="_blank">HTTPS</a>`;
                }else{
                    this_https_a = `-`;
                }

                //Check site not mapped
                this_site = project_data[resolve_type][env][resolve_url];

                //Check disabled
                if(project_data.enabled == false || this_site == "") {
                    this_http_a = `-`;
                    this_https_a = `-`;
                }

                //Check panel write access
                if(panel_write_access == true) {
                    let select_env = "";
                    let select_site = "";

                    //
                    // Drop down list change value breakdown (separator :: )
                    //   0 - update type
                    //   1 - project name (origin)
                    //   2 - resolve type
                    //   3 - environment
                    //   4 - URL
                    //   5 - change value

                    //Build environment list drop down
                    let these_env = ["dev","qa","stage","prod"];
                    for(let e in these_env) {
                        let new_env = these_env[e];
                        if(env == new_env) {
                            select_env += `<option value="resolve_select_env::${focused_project}::${resolve_type}::${env}::${resolve_url}::${new_env}" selected>${new_env}</option>`;
                        }else{
                            select_env += `<option value="resolve_select_env::${focused_project}::${resolve_type}::${env}::${resolve_url}::${new_env}">${new_env}</option>`;
                        }
                    }
                    select_env = `
                        <select id="resolve_select_env::${focused_project}::${resolve_type}::${env}::${resolve_url}" class="resolve_env_option">
                            ${select_env}
                        </select>
                    `;

                    //Build site list for drop down (related to current project)
                    for(let new_site in project_data.websites) {
                        if(this_site == new_site) {
                            select_site += `<option value="resolve_select_site::${focused_project}::${resolve_type}::${env}::${resolve_url}::${new_site}" selected>${new_site}</option>`;
                        }else{
                            select_site += `<option value="resolve_select_site::${focused_project}::${resolve_type}::${env}::${resolve_url}::${new_site}">${new_site}</option>`;
                        }
                    }
                    select_site = `
                        <select id="resolve_select_site::${focused_project}::${resolve_type}::${env}::${resolve_url}" class="resolve_website_option">
                            <option value="resolve_select_site::${focused_project}::${resolve_type}::${env}::${resolve_url}::"></option>
                            ${select_site}
                        </select>
                    `;

                    //Append server mode config
                    html_fqdn_rows += `
                        <div class="grid1_col">${resolve_type_label}</div>
                        <div class="grid1_col">${select_env}</div>
                        <div class="grid1_col">${resolve_url}</div>
                        <div class="grid1_col">${this_http_a}</div>
                        <div class="grid1_col">${this_https_a}</div>
                        <div class="grid1_col">${select_site}</div>
                    `;

                }else{
                    if(this_site == "") {
                        this_site = `<span class="font_red">(unmapped)</span>`;
                    }

                    //Append server mode config
                    html_fqdn_rows += `
                        <div class="grid1_col">${resolve_type_label}</div>
                        <div class="grid1_col">${env}</div>
                        <div class="grid1_col">${resolve_url}</div>
                        <div class="grid1_col">${this_http_a}</div>
                        <div class="grid1_col">${this_https_a}</div>
                        <div class="grid1_col">${this_site}</div>
                    `;
                }
            }
        }
    }

    //Check disabled
    let disabled_note = "";
    if(project_data.enabled == false) {
        disabled_note = `<i class="font_red">(URLs disabled while project is set to disabled)</i>`;
    }

    //Add button
    if(panel_write_access == true) {
        //Get get mapping to site
        select_site = "";
        for(let site in project_data.websites) {
            select_site += `<option value="${site}">${site}</option>`;
        }
    }

    //Check is any mapping exists
    if(html_fqdn_rows == "") {
        html_fqdn_rows = `<div class="grid6_col">** No Mapping Configured **</div>`;
    }

    //Define table
    html_fqdn_table = `
        <br />
        <div class="grid6">
            <div class="grid6_head">Project Website Proxy or DNS Resolve ${disabled_note}</div>
            <div class="grid1_sub_head">Map Type</div>
            <div class="grid1_sub_head">Environment</div>
            <div class="grid1_sub_head">URL</div>
            <div class="grid1_sub_head">HTTP (port:${http_port})</div>
            <div class="grid1_sub_head">HTTPS (port:${https_port})</div>
            <div class="grid1_sub_head">Target Website</div>
            ${html_fqdn_rows}
        </div>
    `;
    
    //Return HTML
    return html_fqdn_table;
}
function ui_website_settings() {
    log("ui_website_settings");

    //Check websites permissions
    let panel_write_access = api_check_project(["project_adm", "website_adm", "website_set"]);

    //Panel Read Access note
    let read_access = ""
    if(panel_write_access == false) {
        //Set top of page read only
        read_access = ui_panel_read_only();
    }

    //Focused site
    let project_data = website_projects[focused_project];
    let setting_data = website_projects[focused_project]["websites"][focused_site];

    //Set SSL redirect checkbox
    let ssl_redirect = "";
    if(setting_data.ssl_redirect == true) {
        ssl_redirect = `<input id="ssl_redirect" type="checkbox" checked>`;
    }else{
        ssl_redirect = `<input id="ssl_redirect" type="checkbox">`;
    }

    //Set default doc
    let default_doc = `<input id="default_doc_text" type="text" value="${setting_data.default_doc}">`;

    //Set Maintenance Mode
    let maint_state_env = "";
    for(let env in setting_data.maintenance) {
        let maint_checked = ""
        if(setting_data.maintenance[env] == true) {
            maint_checked = " checked";
        }
        maint_state_env += `
                <div class="grid1_inner_col">
                    <input id="maintenance_${env}" type="checkbox"${maint_checked}>
                </div>
                <div class="grid1_inner_col">
                    ${env}&nbsp;&nbsp;&nbsp;
                </div>
        `;
    }
    maint_state_env = `
        <div class="grid8_inner">
            ${maint_state_env}
        </div>
    `;

    //Set default docs text boxes (maintenance page and index)
    let maint_page = `
        <div class="grid3_inner grid3_inner_site_mapping_err_maint">
            <div class="grid1_inner_col"></div>
            <div class="grid1_inner_col"><b>User Response</b></div>
            <div class="grid1_inner_col"><b>API Response</b></div>
            <div class="grid1_inner_col"></div>
            <div class="grid1_inner_col">
                <input id="maintenance_page_text" type="text" value="${setting_data.maintenance_page}">
            </div>
            <div class="grid1_inner_col">
                <input id="maintenance_page_api_text" type="text" value="${setting_data.maintenance_page_api}">
            </div>
        </div>
    `;

    //set error docs list
    let def_errors_user = setting_data.default_errors.user;
    let def_errors_api = setting_data.default_errors.api;
    let def_error_types = ["404", "500"];
    let error_documents = "";
    let error_doc_rows = "";
    for(let i in def_error_types) {
        //Get error doc type
        let doc_type = def_error_types[i];

        //Set doc type
        error_doc_rows += `<div class="grid1_col"><b>${doc_type}</b></div>`;

        //Set user doc type column
        if(def_errors_user == undefined || def_errors_user[doc_type] == undefined) {
            error_doc_rows += `
                <div class="grid1_inner_col">
                    <input id="error_page_${doc_type}_user" type="text" value="">
                </div>`;
        }else{
            error_doc_rows += `
                <div class="grid1_inner_col">
                    <input id="error_page_${doc_type}_user" type="text" value="${def_errors_user[doc_type]}">
                </div>`;
        }

        //Set api doc type column
        if(def_errors_api == undefined || def_errors_api[doc_type] == undefined) {
            error_doc_rows += `
                <div class="grid1_inner_col">
                    <input id="error_page_${doc_type}_api" type="text" value="">
                </div>`;
        }else{
            error_doc_rows += `
                <div class="grid1_inner_col">
                    <input id="error_page_${doc_type}_api" type="text" value="${def_errors_api[doc_type]}">
                </div>`;
        }
    }
    error_documents = `
        <div class="grid3_inner grid3_inner_site_mapping_err_maint">
            <div class="grid1_inner_col"></div>
            <div class="grid1_inner_col"><b>User Response</b></div>
            <div class="grid1_inner_col"><b>API Response</b></div>
            ${error_doc_rows}
        </div>
    `;

    //Check error state
    let site_error = {}
    let state_default_doc = "";     // Image warning to signale default document missing
    let state_maint_page = "";      // Image warning to signale default document missing
    let state_error_pages = "";     // Image warning to signale default document missing
    let fix_maint_page_btn = "";    // Button HTML code when user has panel write access
    let fix_error_page_btn = "";    // Button HTML code when user has panel write access
    if(website_project_errors[focused_project] != undefined && website_project_errors[focused_project]["websites"][focused_site] != undefined) {
        //Get site errors
        site_error = website_project_errors[focused_project]["websites"][focused_site];

        //Create fix buttons
        if(site_error.default_doc_exists == false) {
            state_default_doc = `<div class="icon_size icon_warning" title="Default Document in static content mapping was not found"></div>`;
        }
        if(site_error.maintenance_page_exists == false) {
            state_maint_page = `<div class="icon_size icon_warning" title="Maintenance Page folder or files are not found"></div>`;
        }
        if(site_error.default_errors_exists == false) {
            state_error_pages = `<div class="icon_size icon_warning" title="Default Errors folder or file are not found"></div>`;
        }

        if(panel_write_access == true) {
            if(site_error.maintenance_page_exists == false) {
                fix_maint_page_btn = `<input id="website_maint_create" class="project_fix_btn" type="button" value="Create maintenance page" />`;
            }
            if(site_error.default_errors_exists == false) {
                fix_error_page_btn = `<input id="website_errors_create" class="project_fix_btn" type="button" value="Create error pages" />`;
            }
        }
    }

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
            <div class="grid1_col">${ssl_redirect} global</div>
            <div class="grid1_col">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">Default Document</div>
                    <div class="grid1_inner_col">${state_default_doc}</div>
                </div>
            </div>
            <div class="grid1_col">${default_doc}</div>
            <div class="grid1_col">Maintenance Mode (environments)</div>
            <div class="grid1_col">${maint_state_env}</div>
            <div class="grid1_col">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">Maintenance Page</div>
                    <div class="grid1_inner_col">${state_maint_page}</div>
                    <div class="grid2_inner_col">${fix_maint_page_btn}</div>
                </div>
            </div>
            <div class="grid1_col">
                ${maint_page}
            </div>
            <div class="grid1_col">
                <div class="grid2_inner">
                    <div class="grid1_inner_col">Error Pages</div>
                    <div class="grid1_inner_col">${state_error_pages}</div>
                    <div class="grid2_inner_col">${fix_error_page_btn}</div>
                </div>
            </div>
            <div class="grid1_col">
                ${error_documents}
            </div>
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
                    <div class="grid1_inner_col">${html_add_button}&nbsp;&nbsp;</div>
                    <div class="grid1_inner_col"><b>${heading_label}</b></div>
                    
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
                <div class="grid1_col"></div>
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
        //Add listener for basic properties
        var lis_ssl_redirect = document.getElementById("ssl_redirect");
        var lis_default_doc_text = document.getElementById("default_doc_text");
        lis_ssl_redirect.addEventListener("change", function(event){
            let data = {
                "property": "ssl_redirect",
                "value": document.getElementById("ssl_redirect").checked
            }
            website_manage("website_set_property", data);
        });
        lis_default_doc_text.addEventListener("change", function(event){
            let data = {
                "property": "default_doc",
                "value": $("#default_doc_text").val()
            }
            website_manage("website_set_property", data);
        });

        //Set listener for maintenance mode checkboxes
        var lis_maintenance_dev = document.getElementById("maintenance_dev");
        var lis_maintenance_qa = document.getElementById("maintenance_qa");
        var lis_maintenance_stage = document.getElementById("maintenance_stage");
        var lis_maintenance_prod = document.getElementById("maintenance_prod");
        lis_maintenance_dev.addEventListener("change", function(event){
            let data = {
                "property": "maintenance",
                "env": "dev",
                "value": document.getElementById("maintenance_dev").checked
            }
            website_manage("website_set_property", data);
        });
        lis_maintenance_qa.addEventListener("change", function(event){
            let data = {
                "property": "maintenance",
                "env": "qa",
                "value": document.getElementById("maintenance_qa").checked
            }
            website_manage("website_set_property", data);
        });
        lis_maintenance_stage.addEventListener("change", function(event){
            let data = {
                "property": "maintenance",
                "env": "stage",
                "value": document.getElementById("maintenance_stage").checked
            }
            website_manage("website_set_property", data);
        });
        lis_maintenance_prod.addEventListener("change", function(event){
            let data = {
                "property": "maintenance",
                "env": "prod",
                "value": document.getElementById("maintenance_prod").checked
            }
            website_manage("website_set_property", data);
        });

        //Set listener for maintenance mode documents
        var lis_maintenance_page_text = document.getElementById("maintenance_page_text");
        var lis_maintenance_page_api_text = document.getElementById("maintenance_page_api_text");
        lis_maintenance_page_text.addEventListener("change", function(event){
            let data = {
                "property": "maintenance_page",
                "value": $("#maintenance_page_text").val()
            }
            website_manage("website_set_property", data);
        });
        lis_maintenance_page_api_text.addEventListener("change", function(event){
            let data = {
                "property": "maintenance_page_api",
                "value": $("#maintenance_page_api_text").val()
            }
            website_manage("website_set_property", data);
        });

        //Set listener for error documents
        var lis_error_page_404_user = document.getElementById("error_page_404_user");
        var lis_error_page_404_api = document.getElementById("error_page_404_api");
        var lis_error_page_500_user = document.getElementById("error_page_500_user");
        var lis_error_page_500_api = document.getElementById("error_page_500_api");
        lis_error_page_404_user.addEventListener("change", function(event){
            let data = {
                "property": "error_page",
                "type": "user",
                "page": "404",
                "value": $("#error_page_404_user").val()
            }
            website_manage("website_set_property", data);
        });
        lis_error_page_404_api.addEventListener("change", function(event){
            let data = {
                "property": "error_page",
                "type": "api",
                "page": "404",
                "value": $("#error_page_404_api").val()
            }
            website_manage("website_set_property", data);
        });
        lis_error_page_500_user.addEventListener("change", function(event){
            let data = {
                "property": "error_page",
                "type": "user",
                "page": "500",
                "value": $("#error_page_500_user").val()
            }
            website_manage("website_set_property", data);
        });
        lis_error_page_500_api.addEventListener("change", function(event){
            let data = {
                "property": "error_page",
                "type": "api",
                "page": "500",
                "value": $("#error_page_500_api").val()
            }
            website_manage("website_set_property", data);
        });

        //Set listeners for maintenance and error pages fix
        if(document.getElementById("website_maint_create") != undefined) {
            var lis_website_maint_create = document.getElementById("website_maint_create");
            lis_website_maint_create.addEventListener("click", function(event){
                website_manage("website_maint_page_create");
            });
        }
        if(document.getElementById("website_errors_create") != undefined) {
            var lis_website_errors_create = document.getElementById("website_errors_create");
            lis_website_errors_create.addEventListener("click", function(event){
                website_manage("website_errors_pages_create");
            });
        }
    }else{
        document.getElementById("ssl_redirect").disabled = true;
        document.getElementById("default_doc_text").disabled = true;

        document.getElementById("maintenance_dev").disabled = true;
        document.getElementById("maintenance_qa").disabled = true;
        document.getElementById("maintenance_stage").disabled = true;
        document.getElementById("maintenance_prod").disabled = true;

        document.getElementById("maintenance_page_text").disabled = true;
        document.getElementById("maintenance_page_api_text").disabled = true;

        document.getElementById("error_page_404_user").disabled = true;
        document.getElementById("error_page_404_api").disabled = true;
        document.getElementById("error_page_500_user").disabled = true;
        document.getElementById("error_page_500_api").disabled = true;
    }
}

//Project website management UI
function ui_website_create() {
    log("ui_website_create");

    //Loop tempaltes and look for website types
    let template_count = 0;
    for(let template in templates_user) {
        if(templates_user[template]["type"] == "website") {
            template_count = template_count + 1;
        }
    }

    //Loop tempaltes and look for website types
    let system_template_count = 0;
    let user_template_count = 0;
    let types = ["system", "user"]
    for(let t in types) {
        let type = types[t];
        let templates = null;
        if(type == "system") {
            templates = templates_system;
        }else{
            templates = templates_user;
        }

        //Count templates
        for(let template in templates) {
            if(templates[template]["type"] == "website") {
                if(type == "system") {
                    system_template_count = system_template_count + 1;
                }else{
                    user_template_count = user_template_count + 1;
                }
            }
        }
    }

    //Add option if templates exist
    let html_system_template = "";
    let html_user_template = "";
    if(system_template_count > 0) {
        html_system_template = `
            <div class="grid1_col">
                <input type="radio" id="website_system_templates" name="website_create" value="system">
                <label for="website_create">Create from system template</label>
            </div>
        `;
    }
    if(user_template_count > 0) {
        html_user_template = `
            <div class="grid1_col">
                <input type="radio" id="website_user_templates" name="website_create" value="template">
                <label for="website_create">Create from user template</label>
            </div>
        `;
    }

    //Set HTML body
    html = `
        <input id="create_type" type="hidden" value="blank" />
        <input id="template_name" type="hidden" value="" />
        <div class="grid2_inner grid2_project_create">
            <div class="grid1_inner_col">
                <div class="grid1_inner">
                    <div class="grid1_col">
                        <b>1- Select Type:</b>
                    </div>
                    <div class="grid1_col">
                        <input type="radio" id="website_blank" name="website_create" value="blank" checked>
                        <label for="website_create">Empty website folder</label>
                    </div>
                    ${html_system_template}
                    ${html_user_template}
                </div>
                <div id="template_select" class="grid1_inner"></div>
            </div>
            <div id="website_create_options" class="grid1_inner_col"></div>
        </div>
    `;

    //Call dialog function
    dialog(`Create Website`, html);

    //Default blank site
    ui_website_create_blank();

    //Set listener
    var lis_website_blank = document.getElementById("website_blank");
    lis_website_blank.addEventListener("click", function(event){
        $("#create_type").val("blank");
        $("#template_name").val("");
        ui_website_create_blank();        
    });
    if(system_template_count > 0) {
        var lis_website_system_templates = document.getElementById("website_system_templates");
        lis_website_system_templates.addEventListener("click", function(event){
            $("#create_type").val("system_template");
            $("#template_name").val("");
            ui_website_create_from("system");
        });
    }
    if(user_template_count > 0) {
        var lis_website_user_templates = document.getElementById("website_user_templates");
        lis_website_user_templates.addEventListener("click", function(event){
            $("#create_type").val("user_template");
            $("#template_name").val("");
            ui_website_create_from("user");
        });
    }
}
function ui_website_create_blank() {
    log("ui_website_create_blank");

    //Blank out template selection
    $("#template_select").html("");

    //Create HTML for dialog (website_create_options)
    let html = `
        <div class="grid1_inner">
            <div class="grid1_col">
                <b>2- Create empty website folder:</b>
            </div>
            <div class="grid1_col">
                <div class="grid1_inner">
                    <div class="grid1_col_inner">Website Name:</div>
                    <div class="grid1_col">
                        <input type="text" id="website_name" value="" autocomplete="off">
                    </div>
                </div>
            </div>
        </div>

        <br /><br />
        <input type="button" value="Create" onClick="website_manage_create();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Populate the options
    $("#website_create_options").html(html);
    dialog_center();
}
function ui_website_create_from(type="") {
    log(`ui_website_create_from [${type}]`);

    //Clear options
    $("#website_create_options").html("");

    //Set table label
    let template_type = "";
    let templates = {}
    if(type == "system") {
        template_type = "System";
        templates = templates_system;
    }else{
        template_type = "User";
        templates = templates_user;
    }

    //Loop templates
    let listeners = {}
    let template_list = "";
    for(let template in templates) {
        if(templates[template]["type"] == "website") {
            //Key name
            let key_name = `template::${template}`;
            listeners[key_name] = template;

            //Set list
            template_list += `
                <div class="grid1_col">
                    <input type="radio" id="${key_name}" name="template_list" value="${type}::${template}">
                    <label for="template_list">${template}</label><br>
                </div>
            `;
        }
    }

    //Set label
    let label = "";
    if(type == "system") {
        label = "System";
    }else{
        label = "User";
    }

    //Create HTML for dialog (website_create_options)
    let html = `
        <div class="grid1_col">
            <b>2- Select ${label} template:</b>
        </div>
        ${template_list}
    `;

    //Update the right column with the templates selector table
    $("#template_select").html(html);
    dialog_center();


    //Add listeners
    for(let key in listeners) {
        let template = listeners[key];
        listeners[key] = document.getElementById(key);
        listeners[key].addEventListener("click", function(event){
            //Set hidden field
            $("#template_name").val(template);

            //Get templates
            let selected_template = {}
            if(type == "system") {
                selected_template = templates_system[template];
            }else{
                selected_template = templates_user[template];
            }

            //Build table of websites
            let template_desc = selected_template["conf"]["description"]
            let website_rows = "";
            for(let website in selected_template["conf"]["websites"]) {
                website_rows += `
                    <div class="grid1_col">
                        <input id="website::${website}::checkbox" type="checkbox" />
                    </div>
                    <div class="grid1_col">
                        ${website}
                    </div>
                    <div class="grid1_col">
                        <input id="website::${website}::text" type="text" value="" />
                    </div>
                `;
            }

            //Generate table
            let html_template_websites = `
                <div class="grid2 grid3_site_create_template">
                    <div class="grid3_col">
                        <b>3- Select websites to deply to your project:</b>
                    </div>
                    <div class="grid3_sub_head"><b>Template Description</b></div>
                    <div class="grid3_col">${template_desc}</div>
                    <div class="grid1_sub_head">Select</div>
                    <div class="grid1_sub_head">Website Name</div>
                    <div class="grid1_sub_head">Name Override</div>
                    ${website_rows}
                </div>
            
                <br /><br />
                <input type="button" value="Create" onClick="website_manage_create();">
                <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
            `;

            //Insert template select options
            $("#website_create_options").html(html_template_websites);
            dialog_center();
        });
    }
}
function ui_website_rename_clone(website_name, action) {
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
        <input type="hidden" id="select_website_name" value="${website_name}">

        <div class="grid2_inner">
            <div class="grid2_col">Current Site Name: <b>${website_name}</b></div>
            <div class="grid1_col">New Website Name:</div>
            <div class="grid1_col">
                <input type="text" id="new_website_name" value="" autocomplete="off">
            </div>
        </div>
        
        <br /><br />
        <input type="button" value="${btn_label}" onClick="website_manage_rename_clone_delete('${action}');">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    if(action == "rename") {
        dialog("Rename Site", html);
    }else{
        dialog("Clone Site", html);
    }
}
function ui_website_delete(website_name) {
    log("ui_website_new_default");

    //API pre-check
    if(api_check_project(["website_adm"]) == false) { return }

    //Create dialog HTML
    html = `
        <input type="hidden" id="select_website_name" value="${website_name}">

        <p>
        Are you sure you want to delete site <b>${website_name}</b> ?
        <br /><br />
        Confirm delete by typing website name below:
        </p>
        <input id="confirm_website_name" type="text" value="" autocomplete="off">
        <br /><br />
        <input type="button" value="Delete" onClick="website_manage_rename_clone_delete('delete');">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;

    //Call dialog function
    dialog("Delete Website Confirm", html);
}

// website settings?

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

        <div class="grid2_inner">
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
        <input type="button" value="Map Path" onClick="website_manage_map_add();">
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

    if(Object.keys(project_data.websites).length == 1) {
        //Call dialog function
        dialog("Note", "There is only 1 website in your project, you should have more than one website for sub mapping.");
        return;
    }

    //Loop project websites
    let website_select = "";
    for(site in project_data.websites) {
        if(site != focused_site) {
            website_select += `<option value="${site}">${site}</option>`;
        }
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

        <div class="grid2_inner">
            <div class="grid1_col">Web URL Sub Path:</div>
            <div class="grid1_col">
                <input type="text" id="website_web_path" value="" autocomplete="off">
            </div>
            <div class="grid1_col">Project Site</div>
            <div class="grid1_col">
                ${website_select}
            </div>
        </div>
        <br /><br />
        <input type="button" value="Map Path" onClick="website_manage_map_add();">
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
        <input type="button" value="Yes" onClick="website_manage_map_delete();">
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

    //Check project files permissions
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

//Resolve ampping management UI
function ui_resolve_delete_map(value=null) {
    log("ui_resolve_delete_map");

    //Validate
    if(value == null) {
        dialog("Error", "Function caused an invalid call");
        return;
    }

    //Parse
    let proj = "";
    let type = "";
    let env = "";
    let url = "";
    try {
        let parse_val = value.split("::");
        proj = parse_val[1];
        type = parse_val[2];
        env = parse_val[3];
        url = parse_val[4];
    }catch(e) {
        dialog("Error", "Function caused an invalid call");
        return;
    }

    //Set strings
    let this_map_type = "Proxy Map";
    if(type == "dns_names") {
        this_map_type = "DNS FQDN";
    }

    //Create dialog HTML
    html = `
        <input type="hidden" id="resolve_delete_proj" value="${proj}">
        <input type="hidden" id="resolve_delete_type" value="${type}">
        <input type="hidden" id="resolve_delete_env" value="${env}">
        <input type="hidden" id="resolve_delete_url" value="${url}">

        <p>Are you sure you want to delete website map?</p><br />
        <div class="grid2_inner">
            <div class="grid1_col"><b>Project</b></div>
            <div class="grid1_col">${proj}</div>
            <div class="grid1_col"><b>Map Type</b></div>
            <div class="grid1_col">${this_map_type}</div>
            <div class="grid1_col"><b>Environment</b></div>
            <div class="grid1_col">${env}</div>
            <div class="grid1_col"><b>URL</b></div>
            <div class="grid1_col">${url}</div>
        </div>
        
        <br /><br />
        <input type="button" value="Yes" onClick="resolve_delete_map();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;
    
    //Call dialog function
    dialog("Delete Website Map", html);
}

//Templates management from project panel
function ui_template_create() {
    log("ui_template_create");

    //API pre-check
    if(api_check_global(["template_adm"]) == false) { 
        dialog("Error", "You do not have permission to complete this action");
        return;
    }

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

    //Create dialog HTML
    html = `
        <div class="grid2_inner">
            <div class="grid1_col"><b>Selected Project:</b></div>
            <div class="grid1_col">${focused_project}</div>
            <div class="grid1_col"><b>Template Type:</b></div>
            <div class="grid1_col">
                <input type="radio" id="template_type_project" name="template_type" value="project">
                <label for="template_type">Project (Includes all files and folders)</label><br />
                <input type="radio" id="template_type_website" name="template_type" value="website">
                <label for="template_type">Website (Only website folders and files)</label>
            </div>
            <div class="grid1_col"><b>Template Name:</b></div>
            <div class="grid1_col"><input type="text" id="template_name" value="" autocomplete="off"></div>
            <div class="grid1_col"><b>Template Description:</b></div>
            <div class="grid1_col"><textarea id="template_desc"></textarea></div>
            <div id="template_website_label" class="grid1_col"></div>
            <div id="template_website_list" class="grid1_col"></div>
        </div>
        
        <br /><br />
        <input type="button" value="Create" onClick="template_manage_create();">
        <input type="button" value="Cancel" onClick="$('#dialog').dialog('close');">
    `;
    
    //Call dialog function
    dialog(`Create Template`, html);

    //Set listener
    var lis_template_website = document.getElementById("template_type_website");
    var lis_template_project = document.getElementById("template_type_project");
    lis_template_website.addEventListener("click", function(event){
        ui_template_create_website();
    });
    lis_template_project.addEventListener("click", function(event){
        $("#template_website_label").html("");
        $("#template_website_list").html("");
        dialog_center();
    });    
}
function ui_template_create_website() {
    //Label
    let html_label = `
        <b>Select Websites:</b><br />
        (What will be included<br />
        in the template)
    `;

    //Create select list
    let project_data = website_projects[focused_project];
    let website_list = "";
    for(website in project_data["websites"]) {
        let list_id = `select_website::${website}`;
        website_list += `<input id="${list_id}" type="checkbox" value="${website}"> ${website}<br />`;
    }

    //Populate fields
    $("#template_website_label").html(html_label);
    $("#template_website_list").html(website_list);

    dialog_center();
}
function ui_template_delete(template=null) {
    log("ui_template_delete");

    //API pre-check
    if(api_check_global(["template_adm"]) == false) { 
        dialog("Error", "You do not have permission to complete this action");
        return;
    }

    //Check if project selected
    if(template == "") {
        dialog("Error", "Template name parameter is empty");
        return;
    }

    //Prompt user
    let html = `

        <input id="template_name" type="hidden" value="${template}" />

        <p>
        Are you sure you want to delete template [<b>${template}</b>] ?
        <br /><br />
        Confirm delete by typing template name below:
        </p>
        <input id="confirm_template_name" type="text" value="" autocomplete="off" />
        <br /><br />

        <input type="button" value="Delete" onClick="template_manage_delete();">
        <input type="button" value="No" onClick="$('#dialog').dialog('close');">
    `;

    dialog("Delete Template Confirm", html);
}

//////////////////////////////////////
// Templates UI Tab
//////////////////////////////////////

function ui_templates_list() {
    log("ui_templates_list");
    
    //Get Templates
    let templates_system = ui_template_list_type("system");
    let templates_user = ui_template_list_type("user");

    //Update HTML
    let html = `
        ${templates_system}
        <br />
        ${templates_user}
    `;

    //Update panel
    $("#templates").html(html);
}
function ui_template_list_type(type="system") {
    log(`ui_template_list_type :: ${type}`);

    //Get permissions
    let panel_access = api_check_global(["template_adm"]);

    //Focus templates
    let templates = {}
    let table_title = "";
    if(type == "system") {
        templates = templates_system;
        table_title = "Default System Templates";
    }else{
        templates = templates_user;
        table_title = "User Defined Templates";
    }

    //Build HTML
    let html_rows = "";
    let tbl_cols = 4;
    let col_last = 1;
    for(let template in templates) {
        //Template
        let this_template = templates[template];
        let this_type = this_template["type"];
        let this_desc = this_template["conf"]["description"];

        //Get site list
        let this_sites = "";
        for(site in this_template["conf"]["websites"]) {
            this_sites += `${site}<br />`;
        }

        //User templage delete button only
        let btn_delete = "";
        if(panel_access == true) {
            if(type == "user") {
                tbl_cols = 5;
                col_last = 2;
                btn_delete = `
                    <div class="grid1_col">
                        <img class="icon icon_size" src="images/trash_icon.png" alt="" onClick="ui_template_delete('${template}');" title="Delete Template: ${template}" /> 
                    </div>
                `;
            }
        }
        html_rows += `
            <div class="grid1_col">${template}</div>
            <div class="grid1_col">${this_type}</div>
            <div class="grid1_col">${this_sites}</div>
            <div class="grid1_col">${this_desc}</div>
            ${btn_delete}
        `;
    }

    //Check if empty
    if(html_rows == "") {
        html_rows = `
            <div class="grid${tbl_cols}_col">** No templates exists **</div>
        `;
    }

    //Build table
    let html = `
        <div class="grid${tbl_cols} grid${tbl_cols}_template_list">
            <div class="grid${tbl_cols}_head">${table_title}</div>
            <div class="grid1_sub_head">Template Name</div>
            <div class="grid1_sub_head">Template Type</div>
            <div class="grid1_sub_head">Website(s)</div>
            <div class="grid${col_last}_sub_head">Description</div>
            ${html_rows}
        </div>
    `;

    //Return HTML
    return html;
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
    let web_mapping = {};
    let html_no_data = "";
    if(response["web_configs"] == undefined) {
        html_no_data = "No Web Config Data Returned<br />"
    }else{
        web_configs = response["web_configs"];
    }
    if(response["web_mapping"] == undefined) {
        html_no_data = "No Web Config Data Returned<br />"
    }else{
        web_mapping = response["web_mapping"];
    }

    //Counter
    let match_count = 1;

    //HTML Managment UI Resolve Hostnames
    let html_mgmtui_hostnames = "";
    if(web_mapping["resolve"]["mgmtui_map"]["hostnames"] != undefined) {
        let mgmtui_hostname = web_mapping["resolve"]["mgmtui_map"]["hostnames"];
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
    if(web_mapping["resolve"]["mgmtui_map"]["hostnames"] != undefined) {
        let mgmtui_vhosts = web_mapping["resolve"]["mgmtui_map"]["vhosts"];
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
    if(web_mapping["resolve"]["proxy_map"] != undefined) {
        let proxy_map = web_mapping["resolve"]["proxy_map"];
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
    if(web_mapping["resolve"]["dns_map"] != undefined) {
        let dns_map = web_mapping["resolve"]["dns_map"];
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
       html_proxy_map == "" &&
       html_dns_map == "") {
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

    //Maintenance docs
    let this_maintenance_page = `<i>user</i>: ${website_params.maintenance_page}<br /><i>api</i>: ${website_params.maintenance_page_api}`;

    //Default document
    let this_default_doc = website_params.default_doc;

    //Error documents
    let this_error_docs = website_params.default_errors;
    let this_default_404 = "";
    let this_default_500 = "";
    let error_docs = ["404", "500"];
    for(let e in error_docs) {
        let error_doc = error_docs[e];
        let error_doc_list = `<i>user</i>: ${this_error_docs["user"][error_doc]}<br /><i>api</i>: ${this_error_docs["api"][error_doc]}`;
        if(error_doc == "404") {
            this_default_404 = error_doc_list;
        }
        if(error_doc == "500") {
            this_default_500 = error_doc_list;
        }
    }

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
