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
        dialog("Error","Permission has not been granted to this function")
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
        dialog("Error","Permission has not been granted to this function")
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

function project_set_textbox(e) {
    //API pre-check
    if(api_check_project(["project_set"]) == false) { return }

    //Continue
    let target_id = `${e.id}_text`;
    let target_value = $(`#${target_id}`).val();

    switch(e.id) {
        case "project_desc":
            project_set_property(e.id, target_value);
        break;
    }
}
function project_set_checkbox(e) {
    //API pre-check
    if(api_check_project(["project_set"]) == false) { 
        if(e.checked == false) {
            e.checked = true;
        }else{
            e.checked = false;
        }
        return;
    }

    //Continue
    switch(e.id) {
        case "project_enabled":
            project_set_property(e.id, e.checked);
        break;
    }
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
function website_set_textbox(e) {
    //API pre-check
    if(api_check_project(["project_adm", "website_adm", "website_set"]) == false) { return }

    //Continue
    let target_id = `${e.id}_text`;
    let target_value = $(`#${target_id}`).val();

    switch(e.id) {
        case "maintenance_page":
            website_set_property(e.id,target_value);
        break;
        case "default_doc":
            website_set_property(e.id,target_value);
        break;
        case "404_doc":
            website_set_property(e.id,target_value);
        break;
        case "500_doc":
            website_set_property(e.id,target_value);
        break;
    }
}
function website_set_checkbox(e) {
    //API check
    if(api_check_project(["project_adm", "website_adm", "website_set"]) == false) { 
        if(e.checked == false) {
            e.checked = true;
        }else{
            e.checked = false;
        }
        return;
    }

    //Continue
    switch(e.id) {
        case "ssl_redirect":
            website_set_property(e.id,e.checked);
        break;
        case "maintenance_enabled":
            website_set_property(e.id,e.checked);
        break;
    }
}
function website_set_property(property, value) {
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

    //Set call parameters
    let params = {
        "id":"website_property",
        "func_call":get_configs,
        "method":"GET",
        "url":url,
        "query":json
    }

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

//Project buttons
function ui_project_panel() {
    log("ui_project_panel")

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

function ui_build_page_content(data) {
    log("ui_build_page_content")

    //Store configs
    server_configs = data.server;
    website_projects = data.projects;

    //Paths
    server_paths = data.paths;
    protected_paths = data.protected_paths;

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
    ui_build_project_list();

    //Build panel window
    ui_project_panel_load();

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
function ui_build_project_list() {
    log("ui_build_project_list");

    //Build tree view base
    let project_all = [];

    //Loop projects
    for(project in website_projects) {
        log(`ui_build_project_list :: project[${project}]`)

        let this_project = null;
        if(website_projects[project]["state"] == "disabled") {
            //Create 
            this_project = {
                "id" : `${project}`,
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
                "id" : `${project}`,
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
    project_all = { "core":{ 
        "data": project_all
    }};

    //Populate or update jsTree
    if($("#project_tree").html() == "") {
        $("#project_tree").jstree(project_all);
    }else{
        //Reset tree
        $("#project_tree").jstree("destroy").empty();
        $("#project_tree").jstree(project_all);
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
            "id" : `${project_name}::mapping`,
            "text" : "Sites and Settings",
            "icon" : "images/mapping_icon.png",
            "state" : {
                "opened" : true,
                "selected" : false
            },
            "children": []
        },
        {
            "id" : `${project_name}::files`,
            "text" : "Project Files",
            "icon" : "images/folder_icon.png"
        },
        {
            "id" : `${project_name}::dns`,
            "text" : "DNS Resolution",
            "icon" : "images/world_icon.png"
        }
    ];

    //Get sites
    for(let site in project_data.websites) {
        let this_site = {
                "id":`${project_name}::website::${site}`,
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
    if(! (tree_id).includes("::")) {
        log("ui_project_tree_click :: select project");

        //Check project focus change
        if(tree_id != focused_project) {
            focused_project = tree_id;
        }

        //Expand and collapse tree focus
        var all_nodes = $("#project_tree").jstree(true).get_json();
        for(n in all_nodes) {
            if(all_nodes[n].id == tree_id) {
                $("#project_tree").jstree("open_node", all_nodes[n].id);
            }else{
                $("#project_tree").jstree("close_node", all_nodes[n].id);
            }
        }

        //Set focus panel
        focused_panel = "project_panel_main";
        focused_site = "";
    }else{
        //parse tree_id
        let parse_tree_id = tree_id.split("::")

        //Set focus panel
        if(parse_tree_id[1] != undefined) {
            switch(parse_tree_id[1]) {
                case "mapping":
                    focused_panel = "project_panel_mapping";
                    focused_site = "";
                    break;
                case "website":
                    if(parse_tree_id[2] != undefined) {
                        focused_panel = "project_panel_website";
                        focused_site = parse_tree_id[2];
                    }
                    break;
                case "files":
                    focused_panel = "project_panel_files";
                    focused_site = "";
                    break;
                case "dns":
                    focused_panel = "project_panel_dns";
                    focused_site = "";
                    break;
                }
        }
    }

    //Clear panel on new tree selection
    $("#project_panel").html("");

    //Determine panel load
    ui_project_panel_load();
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
                <input type="text" id="project_new_name" value="" autocomplete="none">
            </div>
            <div class="grid1_col">Project Description:</div>
            <div class="grid1_col">
                <input type="text" id="project_new_desc" value="" autocomplete="none">
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
function ui_project_panel_load() {

    //
    // focused_project defined @ ui_project_tree_click
    // focused_panel defined @ ui_project_tree_click
    //

    log(`ui_project_panel_load :: Project : ${focused_project}`)
    log(`ui_project_panel_load :: Panel   : ${focused_panel}`)
    log(`ui_project_panel_load :: Website : ${focused_site}`)

    //Load panel
    switch(focused_panel) {
        case "project_panel_main":      ui_project_main(); break;
        case "project_panel_mapping":   ui_project_sites_and_settings(); break;
        case "project_panel_website":   ui_project_website_setting(); break;
        case "project_panel_files":     ui_project_files(); break;
        case "project_panel_dns":       ui_project_dns(); break;
    }
}
function ui_project_main() {
    log(`ui_project_main :: focused project[${focused_project}]`)

    //Make balnk panel if focused project is blank
    if(focused_project == "") {
        $("#project_title").html("");
        $("#project_panel").html("Project not selected");
        return;
    }

    //Default
    let project_data = website_projects[focused_project];
    let html_panel = "";

    //Get server conf
    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Loop websites
    let this_site;
    let this_dns;
    let this_vhost = "";
    for(let website in project_data["websites"]) {
        //Get Site data
        this_site = project_data["websites"][website];

        //Set vhost
        let this_path = `/vhost/${focused_project}::${website}/`;
        this_vhost += `
            <div class="grid1_col">${website}</a></div>
            <div class="grid1_col"><a href="${this_path}" target="_blank">${this_path}</a></div>
        `;
    }

    //VHost index
    this_vhost = `
        <br />
        <div class="grid2 grid2_project_vhost">
            <div class="grid2_head">Website Preview</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">VHost URL</div>
            ${this_vhost}
        </div>
    `;

    //Loop domain names
    let this_domains = "";
    if(project_data.enabled == true) {
        //Loop through environments
        for(env in project_data.dns_names) {
            //Process server modes DNS config
            for(dns in project_data.dns_names[env]) {
                this_row = "";
                this_dns = dns;
                this_site = project_data.dns_names[env][dns];

                //Check DNS resolves to site
                if(this_site != "") {
                    //Get URL for HTTP or HTTPS
                    if(http_on == true) {
                        if(http_port == "80") {
                            this_path = `http://${this_dns}/`;
                        }else{
                            this_path = `http://${this_dns}:${http_port}/`;
                        }
                        this_row += `
                            <div class="grid1_col">${env}</div>
                            <div class="grid1_col">${this_site}</div>
                            <div class="grid1_col"><a href="${this_path}" target="_blank">${this_path}</a></div>
                            `;
                    }
                    if(https_on == true) {
                        if(https_port == "443") {
                            this_path = `https://${this_dns}/`;
                        }else{
                            this_path = `https://${this_dns}:${https_port}/`;
                        }
                        this_row += `
                            <div class="grid1_col">${env}</div>
                            <div class="grid1_col">${this_site}</div>
                            <div class="grid1_col"><a href="${this_path}" target="_blank">${this_path}</a></div>
                            `;
                    }

                    //Append server mode config
                    this_domains += this_row;
                }
            }
        }
    }else{
        //Note disabled state
        this_domains = `<div class="grid3_col">** Project Disabled, Domain resolution inactive **</div>`;
    }

    //Project enabled
    let this_enabled = "";
    if(project_data.enabled == true) {
        this_enabled = `<input id="project_enabled" type="checkbox" onClick="project_set_checkbox(this);" checked>`
    }else{
        this_enabled = `<input id="project_enabled" type="checkbox" onClick="project_set_checkbox(this);">`
    }

    //Domains
    if(this_domains == "") {
        this_domains = `<div class="grid3_col">** No domains mapped to sites **</div>`;
    }
    this_domains = `
        <br />
        <div class="grid3 grid3_project_dns">
            <div class="grid3_head">DNS FQDN Mapping</div>
            <div class="grid1_sub_head">Environment</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">URL</div>
            ${this_domains}
        </div>
    `;

    //Set HTML page
    html_panel += `
        <div class="grid3">
            <div class="grid3_head">Project Settings</div>
            <div class="grid1_col">Description</div>
            <div class="grid1_col">
                <input id="project_desc_text" type="text" value="${project_data.project_desc}">
            </div>
            <div class="grid1_col">
                <img id="project_desc" class="icon icon_size" src="images/save_icon.png" onClick="project_set_textbox(this);" />
            </div>
            <div class="grid1_col">Enabled</div>
            <div class="grid1_col">
                ${this_enabled}
            </div>
            <div class="grid1_col"></div>
        </div>
        ${this_vhost}
        ${this_domains}
    `;

    //Update panel
    $("#project_title").html(`Project: ${focused_project}`);
    $("#project_panel").html(html_panel);
}
function ui_project_sites_and_settings() {
    log("ui_project_sites_and_settings");

    //Focused site
    let project_data = website_projects[focused_project];
    let websites = project_data.websites;

    //Generate list of websites
    let html_site_list = "";
    let site_rows = "";
    for(site in websites) {
        site_rows += `
            <div class="grid1_col grid1_col_site_list">${site}</div>
            <div class="grid1_col grid1_col_site_list">
                <img class="icon project_site_rename" src="images/write_icon.png" alt="" onClick="ui_website_rename_clone('${site}', 'rename');" title="Rename Site" /> 
            </div>
            <div class="grid1_col grid1_col_site_list">
                <img class="icon project_site_clone" src="images/world_clone_icon.png" alt="" onClick="ui_website_rename_clone('${site}', 'clone');" title="Clone Site" />
            </div>
            <div class="grid1_col grid1_col_site_list">
                <img class="icon project_site_trash" src="images/trash_icon.png" alt="" onClick="ui_website_delete('${site}');" title="Delete Site" /> 
            </div>
        `;
    }
    if(site_rows == "") {
        site_rows = `<div class="grid4_col">** No existing sites **</div>`;
    }
    html_site_list = `
        <div class="grid4 grid4_site_list">
            <div class="grid4_head">Websites</div>
            <div class="grid4_sub_head">Site Name</div>
            ${site_rows}
        </div>
    `;

    //Create setting panel
    let html = `
        <div class="grid3 grid3_project_websites">
            <div class="grid3_sub_head">Create Website</div>
            <div class="grid1_col">
                <input class="project_site_new_btn" type="button" value="Create Site as Empty Folder (blank)" onClick="ui_website_new_default('empty');"><br />
                <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
            </div>
            <div class="grid1_col">
                <input class="project_site_new_btn" type="button" value="Create Site From Default Template" onClick="ui_website_new_default('default');"><br />
                <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
            </div>
            <div class="grid1_col">
                <input class="project_site_new_btn" type="button" value="Create Site From User Template" onClick="ui_website_new_template();"><br />
                <div class="project_site_new_arrow"><img src="images/arrow_double_down_icon.png" alt="" /></div>
            </div>
        </div>
        <br />
        ${html_site_list}
    `;

    //Output project panel
    $("#project_panel").html(html);
}
function ui_project_website_setting() {
    log("ui_project_website_setting");

    //Focused site
    let setting_data = website_projects[focused_project]["websites"][focused_site];

    //Site setting enabled
    let ssl_redirect = "";
    let maint_state = "";
    let maint_page = `<input id="maintenance_page_text" type="input" value="${setting_data.maintenance_page}">`;
    let default_doc = `<input id="default_doc_text" type="input" value="${setting_data.default_doc}">`;

    //Set checkboxes
    if(setting_data.ssl_redirect == true) {
        ssl_redirect = `<input id="ssl_redirect" type="checkbox" onClick="website_set_checkbox(this)" checked>`;
    }else{
        ssl_redirect = `<input id="ssl_redirect" type="checkbox" onClick="website_set_checkbox(this)">`;
    }
    if(setting_data.maintenance == true) {
        maint_state = `<input id="maintenance_enabled" type="checkbox" onClick="website_set_checkbox(this)" checked>`;
    }else{
        maint_state = `<input id="maintenance_enabled" type="checkbox" onClick="website_set_checkbox(this)">`;
    }

    //General settings
    let general = `
        <div class="grid3">
            <div class="grid3_head">General Settings</div>
            <div class="grid1_col">Redirect to SSL</div>
            <div class="grid1_col">${ssl_redirect}</div>
            <div class="grid1_col"></div>
            <div class="grid1_col">Maintenance Mode</div>
            <div class="grid1_col">${maint_state}</div>
            <div class="grid1_col"></div>
            <div class="grid1_col">Maintenance Page</div>
            <div class="grid1_col">${maint_page}</div>
            <div class="grid1_col">
                <img id="maintenance_page" class="icon icon_size" src="images/save_icon.png" onClick="website_set_textbox(this)" />
            </div>
            <div class="grid1_col">Default Document</div>
            <div class="grid1_col">${default_doc}</div>
            <div class="grid1_col">
                <img id="default_doc" class="icon icon_size" src="images/save_icon.png" onClick="website_set_textbox(this)" />
            </div>
        </div>
    `;

    //Default Error page text boxes
    let doc404 = `<input id="404_doc_text" type="input" value="${setting_data.default_errors["404"]}">`;
    let doc500 = `<input id="500_doc_text" type="input" value="${setting_data.default_errors["500"]}">`;

    //Default error pages
    let default_errors = `
        <div class="grid3">
            <div class="grid3_head">Error Page Default Documents</div>
            <div class="grid1_col">404 Not Found</div>
            <div class="grid1_col">${doc404}</div>
            <div class="grid1_col">
                <img id="404_doc" class="icon icon_size" src="images/save_icon.png" onClick="website_set_textbox(this)" />
            </div>
            <div class="grid1_col">500 Internal Error</div>
            <div class="grid1_col">${doc500}</div>
            <div class="grid1_col">
                <img id="500_doc" class="icon icon_size" src="images/save_icon.png" onClick="website_set_textbox(this)" />
            </div>
        </div>
    `;

    //API fixed path
    let apis_fixed_path = "";
    for(let a in setting_data.apis_fixed_path) {
        let web_path = a;
        let map_path = setting_data.apis_fixed_path[a];
        apis_fixed_path += `
            <div class="grid1_col">${web_path}</div>
            <div class="grid1_col">${map_path}</div>
            <div class="grid1_col">
                <img class="icon project_site_map_delete" src="images/trash_icon.png" alt="" onClick="ui_website_map_delete('apis_fixed_path', '${web_path}');" title="Delete map: ${web_path}" />
            </div>
        `;
    }
    if(apis_fixed_path == "") {
        apis_fixed_path = `
            <div class="grid3_col">No fixed APIs defined</div>
        `;
    }
    apis_fixed_path = `
        <div class="grid3 grid3_site_mapping">
            <div class="grid2_head">API Fixed File Mapping</div>
            <div class="grid1_head">
                <img class="icon project_site_map_add" src="images/add_icon.png" alt="" onClick="ui_website_map_new('apis_fixed_path');" title="Add a fixed path API mapping. Direct all URL sub paths to file." />
            </div>
            <div class="grid1_sub_head">Web Path</div>
            <div class="grid1_sub_head">Map Path</div>
            <div class="grid1_sub_head"></div>
            ${apis_fixed_path}
        </div>
    `;

    //API dynamic path
    let apis_dynamic_path = "";
    for(let a in setting_data.apis_dynamic_path) {
        let web_path = a;
        let map_path = setting_data.apis_dynamic_path[a];
        apis_dynamic_path += `
            <div class="grid1_col">${web_path}</div>
            <div class="grid1_col">${map_path}</div>
            <div class="grid1_col">
                <img class="icon project_site_map_delete" src="images/trash_icon.png" alt="" onClick="ui_website_map_delete('apis_dynamic_path', '${web_path}');" title="Delete map: ${web_path}" />
            </div>
        `;
    }
    if(apis_dynamic_path == "") {
        apis_dynamic_path = `
            <div class="grid3_col">No dynamic APIs defined</div>
        `;
    }
    apis_dynamic_path = `
        <div class="grid3 grid3_site_mapping">
            <div class="grid2_head">API Dynamic Path Mapping</div>
            <div class="grid1_head">
                <img class="icon project_site_map_add" src="images/add_icon.png" alt="" onClick="ui_website_map_new('apis_dynamic_path');" title="Add dynamic path API mapping. Map to API file at path location." />
            </div>
            <div class="grid1_sub_head">Web Path</div>
            <div class="grid1_sub_head">Map Path</div>
            <div class="grid1_sub_head"></div>
            ${apis_dynamic_path}
        </div>
    `;

    //Static files
    let path_static = "";
    for(let s in setting_data.path_static) {
        let web_path = s;
        let map_path = setting_data.path_static[s];
        path_static += `
            <div class="grid1_col">${web_path}</div>
            <div class="grid1_col">${map_path}</div>
            <div class="grid1_col">
                <img class="icon project_site_map_delete" src="images/trash_icon.png" alt="" onClick="ui_website_map_delete('path_static', '${web_path}');" title="Delete map: ${web_path}" />
            </div>
        `;
    }
    if(path_static == "") {
        path_static = `
            <div class="grid3_col">No static content defined</div>
        `;
    }
    path_static = `
        <div class="grid3 grid3_site_mapping">
            <div class="grid2_head">Static Content Path Mapping</div>
            <div class="grid1_head">
                <img class="icon project_site_map_add" src="images/add_icon.png" alt="" onClick="ui_website_map_new('path_static');" title="Map static content (e.g. default root path)" />
            </div>
            <div class="grid1_sub_head">Web Path</div>
            <div class="grid1_sub_head">Map Path</div>
            <div class="grid1_sub_head"></div>
            ${path_static}
        </div>
    `;

    //Static file path (exec server side)
    let path_static_server_exec = "";
    for(let s in setting_data.path_static_server_exec) {
        let web_path = s;
        let map_path = setting_data.path_static_server_exec[s];
        path_static_server_exec += `
            <div class="grid1_col">${web_path}</div>
            <div class="grid1_col">${map_path}</div>
            <div class="grid1_col">
                <img class="icon project_site_map_delete" src="images/trash_icon.png" alt="" onClick="ui_website_map_delete('path_static_server_exec', '${web_path}');" title="Delete map: ${web_path}" />
            </div>
        `;
    }
    if(path_static_server_exec == "") {
        path_static_server_exec = `
            <div class="grid3_col">No static content defined</div>
        `;
    }
    path_static_server_exec = `
        <div class="grid3 grid3_site_mapping">
            <div class="grid2_head">Static Content Server Execute Override</div>
            <div class="grid1_head">
                <img class="icon project_site_map_add" src="images/add_icon.png" alt="" onClick="ui_website_map_new('path_static_server_exec');" title="Static path location that should run as server side code (e.g. Load balancer health check)" />
            </div>
            <div class="grid1_sub_head">Web Path</div>
            <div class="grid1_sub_head">Map Path</div>
            <div class="grid1_sub_head"></div>
            ${path_static_server_exec}
        </div>
    `;

    //Create setting panel
    let html = `
        <p class="project_setting_title">Website Mapping Settings: <b>${focused_site}</b></p>
        ${general}
        <br />
        ${default_errors}
        <br />
        ${apis_fixed_path}
        <br />
        ${apis_dynamic_path}
        <br />
        ${path_static}
        <br />
        ${path_static_server_exec}
    `;

    //Update panel
    $("#project_panel").html(html);
}

//Website Management UI
function ui_website_new_default(type="empty") {
    log("ui_website_new_default");

    //API pre-check
    if(api_check_project(["website_adm"]) == false) { return }

    //Create dialog HTML
    html = `

        <input id="new_site_type" type="hidden" value="${type}">

        <div class="grid2">
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
        <div class="grid2">
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

        <div class="grid2">
            <div class="grid1_col">Current Site Name:</div>
            <div class="grid1_col">${site_name}</div>
            <div class="grid1_col">New Site Name:</div>
            <div class="grid1_col">
                <input type="text" id="new_site_name" value="">
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

//Website Settings UI
function ui_website_map_new(map_type) {
    log("ui_website_map_new");

    //API pre-check
    if(api_check_project(["website_adm", "website_set"]) == false) { return }
    
    //Set label
    let dialog_label = "";
    switch(map_type) {
        case "apis_fixed_path":         dialog_label = "Map Fixed API"; break;
        case "apis_dynamic_path":       dialog_label = "Map Dynamic API"; break;
        case "path_static":             dialog_label = "Map Static Path"; break;
        case "path_static_server_exec": dialog_label = "Map Static Path Override (Server Execute)"; break;
    }

    //Generate HTML
    let html = `

        <input type="hidden" id="website_map_type" value="${map_type}"><br />

        <div class="grid2">
            <div class="grid1_col">Web URL Sub Path:</div>
            <div class="grid1_col">
                <input type="text" id="website_web_path" value="" autocomplete="off">
            </div>
            <div class="grid1_col">Map Path:</div>
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
function ui_website_map_delete(map_type, path) {
    log("ui_website_map_delete");

    //API pre-check
    if(api_check_project(["website_adm", "website_set"]) == false) { return }

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
    }
    dialog(dialog_label, html);
}

//Project files management UI
function ui_project_files() {
    log("ui_project_files");

    //Define HTML
    let html = `
        <div class="project_file_title">Project Files:</div>
        <div class="project_file_menu">
            <div class="project_files_menu_btn project_files_menu_add_folder" onClick="ui_project_files_add('folder');" title="Add Folder"></div>
            <div class="project_files_menu_btn project_files_menu_add_file" onClick="ui_project_files_add('file');" title="Add File"></div>
            <div class="project_files_menu_btn project_files_menu_delete" onClick="ui_project_files_delete_check();" title="Delete Folder or File"></div>
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
    log("files_delete :: User form");

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

//DNS management UI
function ui_project_dns() {
    log("ui_project_dns");

    //Get project files list from server
    let this_project = website_projects[focused_project];

    //Create select drop down (website names)
    function site_dns_rows(this_project, this_env) {
        let dns_rows = "";

        //Loop DNS names
        dns_target = this_project.dns_names[this_env];
        for(let dns in dns_target) {
            let dns_resolve = dns_target[dns];

            //Loop sites
            let dns_select = "";
            for(site in this_project.websites) {
                if(site == dns_resolve) {
                    dns_select += `<option value="${dns}:${site}" selected>${site}</option>`;
                }else{
                    dns_select += `<option value="${dns}:${site}">${site}</option>`;
                }
            }
                
            //Build select drop down
            dns_select = `
                <select id="${dns}" onChange="dns_update('${this_env}', this.value);">
                    <option value="${dns}:"></option>
                    ${dns_select}
                </select>
            `;

            //Create DNS row
            dns_rows += `
                <div class="grid1_col">${this_env}</div>
                <div class="grid1_col">${dns}</div>
                <div class="grid1_col">${dns_select}</div>
                <div class="grid1_col">
                    <img class="icon project_dns_delete" src="images/trash_icon.png" alt="" onClick="ui_project_dns_delete('${this_env}', '${dns}');" title="Delete DNS mapping: ${dns}" />
                </div>
            `;
        }

        return dns_rows;
    }

    //Generate DNS list
    let html_dns_rows = "";
    for(let env in this_project.dns_names) {
        html_dns_rows = html_dns_rows + site_dns_rows(this_project, env);
    }

    //DNS Prod Table
    html_prod_dns = `
        <p class="project_setting_title">DNS Mapping Settings</p>
        <p>DNS resolution settings defines the mapping when the web services are in 'dev' or 'prod' mode</p>
        <div class="grid4 grid4_site_mapping">
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
        <br /><br />
        <p>
			<b>NOTE:</b> DNS mapping applies to the server environment setting. When promoting code between environments,
            server DNS mapping will use the environment variable to map the DNS FQDN to the site.
		</p>
    `;

    //Output project panel
    $("#project_panel").html(html_prod_dns);
}
function ui_project_dns_add() {
    log("ui_project_dns_add");

    //API pre-check
    if(api_check_project(["dns_adm"]) == false) { return }
    
    //Generate site list
    let this_project = website_projects[focused_project];
    let site_select = "";
    for(site in this_project.websites) {
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
    let this_project = website_projects[focused_project];
    if(this_project["websites"] == undefined) {
        dialog("Error", `Project [${focused_project}] has not websites configured`);
        return;
    }else{
        if(Object.keys(this_project["websites"]) == 0) {
            dialog("Error", `Project [${focused_project}] has not websites configured`);
            return;
        }
    }

    //Create select list
    let select_site = "";
    for(website in this_project["websites"]) {
        select_site += `<input id="template_site" type="checkbox" value="${website}"> ${website}<br />`;
    }

    //Create dialog HTML
    html = `
        <div class="grid2">
            <div class="grid1_col">Template Name:</div>
            <div class="grid1_col"><input type="text" id="template_name" value=""></div>
            <div class="grid1_col">Template Description:</div>
            <div class="grid1_col"><input type="textarea" id="template_desc" value=""></div>
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
// Site Index UI Tab
//////////////////////////////////////

function ui_site_index() {
    log("ui_preview_and_dns");

    //Get domain and vhost resolve
    let html_vhosts = ui_site_index_mapped_vhosts();
    let html_dns = ui_site_index_mapped_dns();

    //Generate HTML output
    let html = `
        <div class='vhost_panel'>
            <p>All virtual hosts and DNS references configured for project sites</p>
            ${html_vhosts}
            <br />
            ${html_dns}
            <p><b>NOTE:</b> Disabled projects or unlinked DNS names will unlist URL links</p>
        <div>
    `;

    //Update section
    $("#vhosts").html(html);
}
function ui_site_index_mapped_vhosts() {
    log("ui_preview_and_dns :: mapped_vhosts");

    //Build vhosts list
    let html_rows = "";
    for(let this_project in website_projects) {
        //Get project state
        let this_enabled = website_projects[this_project].enabled;
        let this_desc = website_projects[this_project].project_desc;

        //Map sites
        for(website in website_projects[this_project]["websites"]) {
            //Site name
            let this_site = website;

            //Get website parameters
            let this_path = `/vhost/${this_project}::${website}/`;
            let this_maint = website_projects[this_project]["websites"][website]["maintenance"];
            
            //List tiems
            let this_link = `<a href="${this_path}" target="_blank">${this_path}</a><br />`

            //Define rows
            html_rows += `
                <div class="grid1_col">${this_link}</div>
                <div class="grid1_col">${this_project}</div>
                <div class="grid1_col">${this_desc}</div>
                <div class="grid1_col">${this_site}</div>
                <div class="grid1_col">${this_enabled}</div>
                <div class="grid1_col">${this_maint}</div>
            `;
        }
    }

    //Build HTML table
    let html = `
        <div class="grid6 grid6_vhost_panel">
            <div class="grid6_head">Site Preview (Server 'dev' mode only)</div>
            <div class="grid1_sub_head">Preview Link</div>
            <div class="grid1_sub_head">Project Name</div>
            <div class="grid1_sub_head">Description</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">Project Enabled</div>
            <div class="grid1_sub_head">Site Maintenance</div>
            ${html_rows}
        </div>
    `;

    return html;
}
function ui_site_index_mapped_dns() {
    log("ui_preview_and_dns :: mapped_dns");

    let http_on = server_configs.http_on;
    let http_port = server_configs.http_port;
    let https_on = server_configs.https_on;
    let https_port = server_configs.https_port;

    //Build vhosts list
    let html_rows = "";
    for(let this_project in website_projects) {
        //Get project state
        let this_enabled = website_projects[this_project].enabled;
        let this_desc = website_projects[this_project].project_desc;

        //Check DNS names config
        if(this_enabled == true) {
            if(website_projects[this_project]["dns_names"] != undefined) {
                for(this_env in website_projects[this_project]["dns_names"]) {
                    //Get DNS
                    let dns = website_projects[this_project]["dns_names"][this_env];

                    //Determine link
                    for(let this_dns in dns) {
                        //Get site resolve
                        let this_site = "";
                        if(dns[this_dns] == "") {
                            this_site = "<i>not mapped</i>"
                        }else{
                            this_site = dns[this_dns];
                        }

                        if(http_on == true) {
                            if(http_port == "80") {
                                this_dns = `${this_dns}`;
                            }else{
                                this_dns = `${this_dns}:${http_port}`;
                            }
                            this_link = `<a href='http://${this_dns}/' target='_blank'>http://${this_dns}/</a>`;
                            html_rows += `
                                <div class="grid1_col">${this_link}</div>
                                <div class="grid1_col">${this_project}</div>
                                <div class="grid1_col">${this_desc}</div>
                                <div class="grid1_col">${this_site}</div>
                                <div class="grid1_col">${this_env}</div>
                        `;
                        }
                        if(https_on == true) {
                            if(https_port == "443") {
                                this_dns = `${this_dns}`;
                            }else{
                                this_dns = `${this_dns}:${https_port}`;
                            }
                            this_link = `<a href='https://${this_dns}/' target='_blank'>https://${this_dns}/</a>`;
                            html_rows += `
                                <div class="grid1_col">${this_link}</div>
                                <div class="grid1_col">${this_project}</div>
                                <div class="grid1_col">${this_desc}</div>
                                <div class="grid1_col">${this_site}</div>
                                <div class="grid1_col">${this_env}</div>
                            `;
                        }
                    }
                }
            }
        }
    }

    //Set HTML for this site mode
    if(html_rows != "") {
        html_rows = `
            <div class="grid1_sub_head">URL</div>
            <div class="grid1_sub_head">Project Name</div>
            <div class="grid1_sub_head">Description</div>
            <div class="grid1_sub_head">Site Name</div>
            <div class="grid1_sub_head">Environment</div>
            ${html_rows}
        `;
    }

    //Generate DNS table
    let html = `
        <div class="grid5 grid5_vhost_panel">
            <div class="grid5_head">DNS FQDN Mapping</div>
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
        let server_settings = `<div class="admin_nav_btn" onClick="admin_server_settings();">Server Settings</div>`;
        let user_manage = `<div class="admin_nav_btn" onClick="ui_admin_user_manage();">User Management</div>`;

        //Set HTML
        html = `
            <div class="admin_mgmt">
                <div class="admin_nav">
                    ${server_settings}
                    ${user_manage}
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
            case "server_mode": 
                this_desc = "Server mode 'dev' enabled this UI where 'prod' will disable this UI";
            break;
            case "server_dev_ui": 
                this_desc = "URL hostnames that will resolve to display this UI. IP address is enabled by default however may not work when running in a container";
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
