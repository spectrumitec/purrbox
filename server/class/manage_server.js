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

/*

Management class for localhost host Dev UI

*/

//
// Node JS manage projects
//

//Set Node JS constants
const fs = require("fs");
const path = require("path");

//JWT auth class
const class_jwt_auth = path.join(path.dirname(__dirname),"class","jwt_auth.js");
const jwt_auth = require(class_jwt_auth);

//Set vhost logger
const vhost_logger = require(path.join(__dirname,"vhost_logger.js"));
const logger = new vhost_logger()

//Set vhost logger
const vhost_mapping = require(path.join(__dirname,"vhost_mapping.js"));
const mapping = new vhost_mapping()

//Manage class
class manage_server {
    //General settings
    paths = {}
    jwt_auth = null;

    //File types
    mime_types = {}

    //Construct class
    constructor(cookie=null, user_agent=null, user_ip=null) { 
        //Start class initialization
        this.define_paths();
        this.load_mime_types();

        //Init JWT auth class
        this.jwt_auth = new jwt_auth(cookie, user_agent, user_ip);

        //Initialize class - JWT configurations
        this.class_init()
    }
    class_init() {

        // JWT Auth Class initialize for application

        //System defaults
        let default_authorized = [
            "project_adm",
            "project_create",
            "project_set",
            "template_adm",
            "website_adm",
            "website_set",
            "dns_adm",
            "files_adm",
            "files_read",
            "read_only"
        ];

        //Check default authorized rules
        let get_default_auth = this.jwt_auth.default_authorize_get();
        if(get_default_auth.error == "") {
            //Get default authorized from JWT auth
            let all_authorize = get_default_auth.default_authorize;

            //Check for missing default authorized
            for(let i in default_authorized) {
                let this_authorize = default_authorized[i]
                if(all_authorize[this_authorize] == undefined) {
                    this.jwt_auth.default_authorize_create(this_authorize, false);
                }
            }

            //Remove legacy authorized
            for(let this_authorize in all_authorize) {
                if(default_authorized.indexOf(this_authorize) == -1) {
                    this.jwt_auth.default_authorize_delete(this_authorize);
                }
            }
        }

        //Check required groups
        let required_groups = [
            "Project Admin",
            "Project Create",
            "Template Admin",
            "DNS Admin"
        ]
        //Add project specific groups to list
        let all_projects = this.get_projects();
        for(let project in all_projects) {
            required_groups.push(`project::${project}::Admin`);
            required_groups.push(`project::${project}::Settings`);
            required_groups.push(`project::${project}::Website Admin`);
            required_groups.push(`project::${project}::Website Settings`);
            required_groups.push(`project::${project}::Files Admin`);
            required_groups.push(`project::${project}::Files Read`);
            required_groups.push(`project::${project}::Read Only`);
        }

        //Check application specific groups
        let group_changes = false;
        let get_groups = this.jwt_auth.groups_get();
        let all_groups = {}
        if(get_groups.error == "") {
            //Get groups list
            all_groups = get_groups.groups;

            //Add required groups
            for(let i in required_groups) {
                //Get groups name
                let group = required_groups[i];

                if(all_groups[group] == undefined) {
                    let grp_updated = this.jwt_auth.group_add(group)
                    if(grp_updated.error == "") {
                        group_changes = true;
                    }
                }
            }

            //Remove Group
            for(let group in all_groups) {
                if(group != "admins") {
                    if(required_groups.indexOf(group) == -1) {
                        let grp_updated = this.jwt_auth.group_delete(group)
                        if(grp_updated.error == "") {
                            group_changes = true;
                        }
                    }
                }
            }
        }

        //Refresh groups list if changes
        if(group_changes == true) {
            //Refresh all groups list
            let get_groups = this.jwt_auth.groups_get();
            if(get_groups.error == "") {
                //Get groups list
                all_groups = get_groups.groups;
            }

            //Cycle groups and set base permissions
            for(let group in all_groups) {
                if(group != "admins") {
                    if(group.startsWith("project::")) {
                        if(group.endsWith("::Admin")) {
                            this.jwt_auth.group_set_authorized(group,"project_adm",true);
                            this.jwt_auth.group_set_authorized(group,"website_adm",true);
                            this.jwt_auth.group_set_authorized(group,"files_adm",true);
                        }
                        if(group.endsWith("::Settings")) {
                            this.jwt_auth.group_set_authorized(group,"project_set",true);
                        }
                        if(group.endsWith("::Website Admin")) {
                            this.jwt_auth.group_set_authorized(group,"website_adm",true);
                            this.jwt_auth.group_set_authorized(group,"website_set",true);
                        }
                        if(group.endsWith("::Website Settings")) {
                            this.jwt_auth.group_set_authorized(group,"website_set",true);
                        }
                        if(group.endsWith("::Files Admin")) {
                            this.jwt_auth.group_set_authorized(group,"files_adm",true);
                            this.jwt_auth.group_set_authorized(group,"files_read",true);
                        }
                        if(group.endsWith("::Files Read")) {
                            this.jwt_auth.group_set_authorized(group,"files_read",true);
                        }
                        if(group.endsWith("::Read Only")) {
                            this.jwt_auth.group_set_authorized(group,"files_read",true);
                            this.jwt_auth.group_set_authorized(group,"read_only",true);
                        }
                    }else{
                        switch(group) {
                            case "Project Admin":       this.jwt_auth.group_set_authorized(group,"project_adm",true); break;
                            case "Project Create":      this.jwt_auth.group_set_authorized(group,"project_create",true); break;
                            case "Template Admin":      this.jwt_auth.group_set_authorized(group,"template_adm",true); break;
                            case "DNS Admin":           this.jwt_auth.group_set_authorized(group,"dns_adm",true); break;
                        }
                    }
                }
            }
        }
    }

    //////////////////////////////////////
    // Set functions
    //////////////////////////////////////

    //Set paths
    define_paths() {
        //Set root
        let root = `${path.dirname(path.dirname(__dirname))}${path.sep}`;
        
        //Set default paths
        this.paths["root"] = root;
        this.paths["conf"] = path.join(root,"conf",path.sep);
        this.paths["config"] = path.join(root,"conf","server_conf.json");
        this.paths["server"] = path.join(root,"server",path.sep);
        this.paths["class"] = path.join(root,"server","class",path.sep);
        this.paths["errors"] = path.join(root,"server","default_errors",path.sep);
        this.paths["localhost"] = path.join(root,"server","localhost",path.sep);
        this.paths["default_templates"] = path.join(root,"server","default_templates",path.sep);
        this.paths["web_source"] = path.join(root,"web_source",path.sep);
        this.paths["web_templates"] = path.join(root,"web_templates",path.sep);    
    }
    load_mime_types() {
        //Load MIME Types
        let mine_types_config = path.join(this.paths.class, "_mine_types.json");
        if(fs.existsSync(mine_types_config)) {
            //Load JSON data
            let mime_data = fs.readFileSync(mine_types_config);
            try {
                var json = JSON.parse(mime_data);
            }catch{
                console.error(" :: Cannot open mime types conf [" + mine_types_config + "] :: JSON config parse error, ignoring");
                return;
            }
            this.mime_types = json;
        }
    }

    //////////////////////////////////////
    // Validate functions
    //////////////////////////////////////

    validate_name(str) {
        //Check null
        if(str == undefined) {
            return false;
        }
        if(str == null) {
            return false;
        }

        //Trim spaces
        str = str.trim();

        //Return if blank
        if(str == "") {
            return false;
        }

        //Check invalid characters
        let pattern = /[^a-zA-Z0-9\_\-\.]/g;
        let found = str.match(pattern);
        if(found == null) {
            return true;
        }else{
            return false;
        }
    }
    validate_desc(str) {
        //Check null
        if(str == undefined) {
            return false;
        }
        if(str == null) {
            return false;
        }

        //Trim spaces
        str = str.trim();

        //Return if blank
        if(str == "") {
            return true;
        }

        //Check invalid characters
        str = str.trim();
        let pattern = /[^a-zA-Z0-9\'\_\-\s\.\,\!\:]/g;
        let found = str.match(pattern);
        if(found == null) {
            return true;
        }else{
            return false;
        }
    }
    validate_web_path(str) {
        str = str.trim();
        let pattern = /[^a-zA-Z0-9\.\_\-\/]/g;
        let found = str.match(pattern);
        if(found == null) {
            return true;
        }else{
            return false;
        }
    }
    validate_map_path(str) {
        str = str.trim();
        let pattern = /[^a-zA-Z0-9\.\_\-\/]/g;
        let found = str.match(pattern);
        if(found == null) {
            return true;
        }else{
            return false;
        }
    }
    validate_allowed_path(path) {
        //Vars
        let web_source = this.paths["web_source"];

        //Stop use of '..' in path
        let pattern = path.sep + "..";
        let match = path.match(new RegExp(pattern, "g"));
        if(match != null) {
            if(match.indexOf(pattern) > -1) {
                return {"error":"Path not permitted"}
            }
        }

        //Make sure only allow in web_source folder
        if(path.startsWith(web_source) == false) {
            return {"error":`Invalid path[${path}]`}
        }
        if(path == web_source) {
            return {"error":`Invalid path[${path}]`}
        }

        //Pass general check
        return{"error":""}
    }

    //////////////////////////////////////
    // Common functions
    //////////////////////////////////////

    //Format functions
    format_path(this_path) {
        //Ensure start and end has OS slash
        if(this_path.startsWith("/") == false) {
            this_path = `/${this_path}`;
        }

        //Check ends with /
        if(path.extname(this_path) == "") {
            if(this_path.endsWith("/") == false) {
                this_path = `${this_path}/`;
            }
        }

        //Remove multiple '/' in a row
        this_path = this_path.replaceAll(/\/+/g,"/");
        
        //Return path
        return this_path;
    }

    //Sort hash table
    sort_hash_array(input) {
        var result = {};
        var keys = Object.keys(input);
        keys = keys.sort()
        for(let k in keys) {
            let this_key = keys[k];
            result[this_key] = input[this_key];
        }
        return result;
    }
    sort_hash_array_longest_str(hash_array) {
        //Sort keys
        let sort_keys = []
        for(let key in hash_array) {
            sort_keys.push(key)
        }
        sort_keys.sort((a, b) => b.length - a.length);

        //Output to new hash map
        let new_hash_array = {}
        for(let i in sort_keys) {
            new_hash_array[sort_keys[i]] = hash_array[sort_keys[i]];
        }

        //Return sort
        return new_hash_array;
    }

    //////////////////////////////////////
    // IO functions
    //////////////////////////////////////

    //File functions
    make_file(file=null, content=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == true) {
            return {"error":`File already exists: '${file}'`}
        }

        //Write file
        let create_file = fs.writeFileSync(file, content);
        if(create_file == false) {
            return {"error":`Failed to create file: '${file}'`}
        }else{
            return {"error":""}
        }
    }
    delete_file(file=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Delete file
        try {
            fs.unlinkSync(file);
            return {"error":""}
        }catch{
            return {"error":`Cannot delete file: '${file}'`}
        }
    }
    update_file(file=null, content=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Write file
        let update_file = fs.writeFileSync(file, content);
        if(update_file == false) {
            return {"error":`Failed to create file: '${file}'`}
        }else{
            return {"error":""}
        }
    }
    read_file(file=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Read file
        try {
            let file_content = fs.readFileSync(file, {encoding:'utf8', flag:'r'});
            return {
                    "error":"",
                    "content":file_content
                }
        }catch{
            return {"error":`Cannot read file: '${file}'`}
        }
    }

    //Directory functions
    make_directory(dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == true) {
            return {"error":`Folder already exists: '${dir}'`}
        }

        //Make directory
        let create_dir = fs.mkdirSync(dir);
        if(create_dir == false) {
            return {"error":`Failed to create folder: '${dir}'`}
        }else{
            return {"error":""}
        }
    }
    delete_directory(dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == false) {
            return {"error":`Folder doesn't exists: '${dir}'`}
        }

        //Delete directory
        try {
            fs.rmSync(dir, { recursive: true, maxRetries: 3, retryDelay: 100 });
            return {"error":""}
        } catch(err) {
            return {"error":"Unable to delete folder"}
        }
    }
    rename_directory(dir=null, new_dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == false) {
            return {"error":`Folder doesn't exists: '${dir}'`}
        }

        //Check if new folder exists
        if_dir_exists = fs.existsSync(new_dir);
        if(if_dir_exists == true) {
            return {"error":`Folder already exists: '${new_dir}'`}
        }

        //Delete directory
        try {
            fs.renameSync(dir, new_dir);
            return {"error":""}
        } catch(err) {
            return {"error":`Unable to rename folder from ${dir} to ${new_dir}`}
        }
    }
    copy_directory(dir=null, new_dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == false) {
            return {"error":`Folder doesn't exists: '${dir}'`}
        }

        //Check if new folder exists
        if_dir_exists = fs.existsSync(new_dir);
        if(if_dir_exists == true) {
            return {"error":`Folder already exists: '${new_dir}'`}
        }

        //Read current directory structure
        let long_src = dir;
        let long_dst = new_dir;
        let src_dir_struc = this.read_dir_struct(dir);

        //Copy directory structure under new path
        let this_state = this.copy_directory_map(long_src, long_dst, src_dir_struc);
        if(this_state != "") {
            return {"error":`Directory copy errors occurred :: ${this_state}`}
        }else{
            return {"error":""}
        }
    }
    copy_directory_map(long_src, long_dst, src_dir_struc) {
        //Mark errors
        let this_errors = "";

        //Loop through directory structure and create directory map
        for(let d in src_dir_struc) {
            let this_dir = src_dir_struc[d];
            if(this_dir.type == "dir") {
                //Set new path
                let new_path = this_dir.id.replace(long_src, long_dst);

                //Create directory
                let this_state = this.make_directory(new_path)
                if(this_state["error"] == "") {
                    if(this_errors == "") {
                        this_errors += this_state["error"];
                    }else{
                        this_errors += `, ${this_state["error"]}`;
                    }
                }

                //Loop sub folders
                this.copy_directory_map(long_src, long_dst, this_dir.children);
            }
        }

        //Loop directory structrue and copy files to new paths (post folder processing to avoid missing folders)
        for(let d in src_dir_struc) {
            let this_dir = src_dir_struc[d];
            if(this_dir.type == "file") {
                //Set new path
                let new_path = this_dir.id.replace(long_src, long_dst);

                //Create directory
                try {
                    fs.copyFileSync(this_dir.id, new_path);
                } catch(err) {
                    if(this_errors == "") {
                        this_errors += `Failed to copy file: '${new_path}'`;
                    }else{
                        this_errors += `, Failed to copy file: '${new_path}'`;
                    }
                }

                //Loop sub folders
                let this_sub_state = this.copy_directory_map(long_src, long_dst, this_dir.children);
                if(this_sub_state != "") {
                    if(this_errors == "") {
                        this_errors += this_sub_state;
                    }else{
                        this_errors += `, ${this_sub_state}`;
                    }
                }
            }
        }

        //Return copy state
        return this_errors;
    }

    //Load config file
    load_server_conf() {
        let server_conf = this.paths["config"];

        let if_cfg_exists = fs.existsSync(server_conf);
        let conf_data = {}
        if(if_cfg_exists == true) {
            try {
                conf_data = JSON.parse(fs.readFileSync(server_conf));
            }catch(err){
                conf_data = {}
            }
        }

        return conf_data;
    }
    load_project_conf(project_name=null) {
        //Check arguments
        if(project_name == null) { return {"error":"Project name is 'null'"}}

        //Check if directory
        let project_conf = path.join(this.paths.web_source,project_name,"config.json");
        let conf_data = {}

        //Check of config file exists
        let if_cfg_exists = fs.existsSync(project_conf);
        if(if_cfg_exists == false) {
            return {"error":`Project config does not exist: ${project_conf}`}
        }else{
            //Parse JSON
            try {
                conf_data = JSON.parse(fs.readFileSync(project_conf));
                return {
                    "error":"",
                    "data":conf_data
                }
            }catch(err){
                return {
                    "error":`JSON Parse error for: ${project_conf}`,
                    "data":{}
                }
            }
        }
    }
    load_template_conf(template_conf=null) {
        //Check arguments
        if(template_conf == null) { return {"error":"Template name is 'null'"}}

        //Check if directory
        let conf_data = {}

        //Check of config file exists
        let if_cfg_exists = fs.existsSync(template_conf);
        if(if_cfg_exists == false) {
            return {"error":`Project config does not exist: ${template_conf}`}
        }else{
            //Parse JSON
            try {
                conf_data = JSON.parse(fs.readFileSync(template_conf));
                return {
                    "error":"",
                    "data":conf_data
                }
            }catch(err){
                return {
                    "error":`JSON Parse error for: ${template_conf}`,
                    "data":{}
                }
            }
        }
    }

    //Query directory tree
    read_dir_struct(dir=null) {
        //Check arguments
        if(dir == null) { return {"error":"Directory path is 'null'"}}

        //Check if target is a directory
        if(fs.lstatSync(dir).isDirectory() == false){
            return {"error":`${dir} is not a directory`}
        }

        //Parse the path separator to get base path
        let parse_dir = dir.split(path.sep);
        let parse_last_idx = parse_dir.length - 1;
        let base_name = parse_dir[parse_last_idx];
        let map_path = "/";

        //Check if directory
        let is_directory = fs.lstatSync(dir).isDirectory()

        //Item details
        let this_root = [{
            "id":dir,
            "map_path":map_path,
            "name":base_name,
            "type":"dir",
            "ext":"",
            "children":this.read_dir_tree(dir, map_path)
        }]

        //Process directory
        if(is_directory == true) {
            this_root["type"] = "dir"
            this_root["children"] = this.read_dir_tree(dir, map_path);
        }else{
            this_root["type"] = "file"
        }

        //Return directory structure
        return this_root;
    }
    read_dir_tree(dir=null, map_path="") {
        //set base structure
        let get_tree = [];

        //Get current dir listing
        let this_dir = fs.readdirSync(dir);
        for(let i in this_dir) {
            //Define properties
            let prop_id         = path.join(dir, this_dir[i]);
            let prop_name       = this_dir[i];
            let prop_map_path   = "";
            let prop_type       = "";
            let prop_ext        = "";

            //Check if directory
            let is_directory = fs.lstatSync(prop_id).isDirectory()
            if(is_directory == true) {
                prop_type       = "dir";
                prop_ext        = "";
            }else{
                prop_type       = "file";
                prop_ext        = path.extname(prop_id)
            }

            //Set mapping between dir or file
            if(prop_type == "dir") {
                prop_map_path    = `${map_path}${prop_name}/`;
            }else{
                prop_map_path    = `${map_path}${prop_name}`;
            }

            //Item details
            let this_item = {
                "id":prop_id,
                "map_path":prop_map_path,
                "name":prop_name,
                "type":prop_type,
                "ext":prop_ext,
                "children":[]
            }

            //Query sub directory
            if(prop_type == "dir") {
                this_item.children = this.read_dir_tree(prop_id, prop_map_path);
            }

            //Add to tree
            get_tree.push(this_item);
        }

        //Reorder as dir first and then files
        let this_tree = [];
        for(let i in get_tree) {
            if(get_tree[i].type == "dir") {
                this_tree.push(get_tree[i])
            }
        }
        for(let i in get_tree) {
            if(get_tree[i].type == "file") {
                this_tree.push(get_tree[i])
            }
        }

        return this_tree;
    }

    //////////////////////////////////////
    // JWT Auth functions
    //////////////////////////////////////

    //JWT passthrough function
    jwt_auth_check() {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.auth_check();
        }
    }
    jwt_user_auth(username, password) {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.auth_user(username, password);
        }
    }
    jwt_auth_validate() {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.auth_validate();
        }
    }
    jwt_auth_refresh() {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.auth_refresh();
        }
    }
    jwt_auth_logoff() {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.auth_logoff();
        }
    }
    jwt_auth_user_reset_passwd(passwd_old, passwd_new) {
        if(this.jwt_auth.error != "") {
            return {"error":this.jwt_auth.error}
        }else{
            return this.jwt_auth.user_reset_password(passwd_old, passwd_new);
        }
    }

    //JWT check user function
    jwt_auth_user_check() {
        //Result
        let result = {
            "error":"",
            "mode":"auth",
            "state":"",
            "authenticated":false,
            "admin":false,
            "username":"",
            "global_authorize":{},
            "project_admin":[],
            "project_authorize":{}
        }

        //Check JWT auth class error
        if(this.jwt_auth.error != "") {
            result.error = this.jwt_auth.error;
        }else{
            //Set auth mode
            result.mode = this.jwt_auth.auth_mode;

            //Check auth mode
            if(result.mode == "none") {
                result.auth = false;
                result.state = "OK";
                result.authenticated = true;
            }else{
                //Get username
                result.username = this.jwt_auth.get_username();

                //Set admin level
                if(result.username == "admin") {
                    result.admin = true;
                }

                //Validate user session
                let auth_validate = this.jwt_auth.auth_validate();
                if(auth_validate.error != "") {
                    result.error = auth_validate.error;
                }else{
                    result.state = auth_validate.state;
                    result.authenticated = auth_validate.authenticated;
                }

                //Get user groups
                if(result.authenticated == true) {
                    //Get groups
                    let get_groups = this.jwt_auth.user_groups_get(result.username);
                    let groups = {}
                    if(get_groups.error == "") {
                        groups = get_groups.groups;
                    }

                    //Authorization
                    for(let group in groups) {
                        if(group.startsWith("project::")) {
                            //Create project authorize
                            let pattern = "::(.*)::";
                            let match_ptoject = group.match(new RegExp(pattern));
                            if(match_ptoject[1] != undefined) {
                                //Get project name
                                let this_project = match_ptoject[1];

                                //Define project admin level
                                if(group.endsWith("::Admin")) {
                                    result.project_admin.push(this_project);
                                }

                                //Set project authorize
                                if(result.project_authorize[this_project] == undefined) {
                                    result.project_authorize[this_project] = {}
                                }
                                for(let authorize in groups[group]) {
                                    let value = groups[group][authorize]
                                    result.project_authorize[this_project][authorize] = value
                                }
                            }
                        }else{
                            switch(group) {
                                case "admins": case "Project Admin": case "Project Create": case "Template Admin": case "DNS Admin":
                                    //Set authorized
                                    for(let authorize in groups[group]) {
                                        let value = groups[group][authorize]
                                        result.global_authorize[authorize] = value;
                                    }

                                    //Check admins group member
                                    if(group == "admins") {
                                        result.admin = true;
                                    }
                                break;
                            }
                        }
                    }
                }
            }
        }

        //Return results
        return result;
    }

    //API access check
    api_access_check(access={"type":null,"permission":[],"project":null}) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "admin":false,
            "api_access":false,
            "auth_check":{}
        }
        
        //Get authenticated 
        let auth_check = this.jwt_auth_user_check();
        if(auth_check.error != "") {
            result.error = auth_check.error;
            return result;
        }else{
            //Save auth_check to result
            result.auth_check = auth_check;

            //Check if auth mode is 'none'
            if(auth_check.mode == "none") {
                //Set full access for auth set to none
                result.state = "OK";
                result.authenticated = true;
                result.admin = true;
                result.api_access = true;

                //Return results
                return result;
            }else{
                //Check state
                result.state = auth_check.state;
                result.authenticated = auth_check.authenticated;
                if(auth_check.authenticated == false) { 
                    return result; 
                }

                //Check permission type
                switch(access.type) {
                    case "global":
                        //Check parameters from calling function
                        if(access.permission == undefined) {
                            result.error = "API global permissions are not defined";
                            return result;
                        }
                        //Check user is an admin
                        if(auth_check.admin == true) {
                            result.admin = true;
                            result.api_access = true;
                            return result;
                        }else{
                            if(this.api_global_authorize(auth_check, access.permission) == false) {
                                result.error = "Access Denied";
                                return result;
                            }else{
                                result.api_access = true;
                                return result;
                            }
                        }
                    break;
                    case "project":
                        //Check parameters from calling function
                        if(access.permission == undefined) {
                            result.error = "API project permissions are not defined";
                            return result;
                        }
                        if(access.project == undefined || access.project == null) {
                            result.error = "API project permissions are not defined";
                            return result;
                        }
                        //Check user is an admin
                        if(auth_check.admin == true) {
                            result.admin = true;
                            result.api_access = true;
                            return result;
                        }else{
                            if(this.api_project_authorize(auth_check, access.permission, access.project) == false) {
                                result.error = "Access Denied";
                                return result;
                            }else{
                                result.api_access = true;
                                return result;
                            }
                        }
                    break;
                    default:
                        //
                        // Assumes no API restriction check, all users
                        //

                        //Check user is an admin
                        if(auth_check.admin == true) {
                            result.admin = true;
                        }

                        //Set default allow
                        result.api_access = true;
                        return result;
                }
            }
        }
    }
    api_global_authorize(auth_check, permissions=[]) {
        //Set vars
        let global = {}

        //Get user permission state
        if(auth_check.global_authorize != undefined) {
            global = auth_check.global_authorize;
        }

        //Check project permission level
        if(permissions.length > 0) {
            for(let i in permissions) {
                let permission = permissions[i];
                if(global[permission] == true) {
                    return true;
                }
            }
        }

        //Catch all
        return false;
    }
    api_project_authorize(auth_check, permissions=[], project) {
        //Set vars
        let admins = [];
        let authorized = {};

        //Get user permission state
        if(auth_check.global_authorize != undefined) {
            global = auth_check.global_authorize;
        }
        if(auth_check.project_admin != undefined) {
            admins = auth_check.project_admin;
        }
        if(auth_check.project_authorize != undefined) {
            if(auth_check.project_authorize[project] != undefined) {
                authorized = auth_check.project_authorize[project];
            }
        }

        //Check project admin level
        if(project != null || project != "") {
            if(admins.indexOf(project) > -1) {
                return true;
            }
        }

        //Check project permission level
        if(permissions.length > 0) {
            for(let i in permissions) {
                let permission = permissions[i];
                if(authorized[permission] == true) {
                    return true;
                }
            }
        }

        //Return default
        return false;
    }

    //////////////////////////////////////
    // Get functions
    //////////////////////////////////////

    //Query project directories
    get_projects() {
        //Generate mapping
        mapping.map_generate();
        let all_projects = mapping.web_configs.projects;
        return all_projects;
    }
    get_templates(type="") {
        //Set target templates location
        let templates_path = "";
        if(type == "user") {
            templates_path = this.paths.web_templates;
        }else{
            templates_path = this.paths.default_templates;
        }

        //Variables
        let templates = {}
        
        //Loop folders in template path
        let dir_list = fs.readdirSync(templates_path);
        for(var target in dir_list) {
            //Get template name from folder name
            let template = dir_list[target];
            let project_conf = path.join(templates_path, template, "project_conf.json");
            let website_conf = path.join(templates_path, template, "website_conf.json");

            //Check what type
            let template_type = "";
            let template_conf = "";
            if(fs.existsSync(project_conf)) {
                template_type = "project";
                template_conf = project_conf;
            }else if(fs.existsSync(website_conf)) {
                template_type = "website";
                template_conf = website_conf;
            }

            //Try load if template config exists
            if(template_type != "") {
                let conf_load = this.load_template_conf(template_conf);
                if(conf_load.error == "") {
                    //Set templates
                    templates[template] = {
                        "type":template_type,
                        "conf":conf_load.data
                    }
                }
            }

        }

        //Return collections
        return templates;
    }

    //////////////////////////////////////
    // Update functions
    //////////////////////////////////////

    //Common update project configuration
    update_project_conf_file(project_name=null, conf_data={}) {
        //Check arguments
        if(project_name == null) {  return {"error":"Project name is 'null'"} }
        if(Object.keys(conf_data).length === 0) {  return {"error":"Project config is empty"} }

        //Conf file
        let conf_file = path.join(this.paths.web_source, project_name, "config.json");
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.update_file(conf_file, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error}
        }else{
            return {"error":""}
        }
    }
    make_template_conf_file(conf_file=null, conf_data={}) {
        //Check arguments
        if(conf_file == null) {  return {"error":"Config filename is 'null'"} }
        if(Object.keys(conf_data).length === 0) {  return {"error":"Project config is empty"} }

        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.make_file(conf_file, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error}
        }else{
            return {"error":""}
        }
    }
    update_template_conf_file(conf_file=null, conf_data={}) {
        //Check arguments
        if(conf_file == null) {  return {"error":"Config filename is 'null'"} }
        if(Object.keys(conf_data).length === 0) {  return {"error":"Project config is empty"} }

        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.update_file(conf_file, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error}
        }else{
            return {"error":""}
        }
    }

    //////////////////////////////////////
    // Management Functions
    //////////////////////////////////////
    
    //Get configs
    get_configs() {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        //Generate mapping
        mapping.map_generate();

        //Load server configs
        let server_config = this.load_server_conf();
        let files_restricted = this.files_restricted();
        let all_projects = mapping.web_configs.projects;
        let templates_system = this.get_templates("system");
        let templates_user = this.get_templates("user");

        // Auth Check ///////////////

        //Define auth check
        let api_check = this.api_access_check()
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        //Get auth mode
        let auth_mode = api_check.auth_check.mode;
        let is_admin = api_check.auth_check.admin;

        // Do command ///////////////

        //Check if no auth
        if(auth_mode == "none") {
            //Get config defaults
            result.data["server"] = server_config;
            result.data["paths"] = this.paths;
            result.data["protected_paths"] = files_restricted;
            result.data["projects"] = all_projects;
            result.data["templates"] = {
                "system":templates_system,
                "user":templates_user
            }
        }else{
            //Authenticated user
            result.data["server"] = server_config;
            result.data["paths"] = this.paths;
            result.data["protected_paths"] = files_restricted;
            result.data["projects"] = {}
            result.data["templates"] = {
                "system":templates_system,
                "user":templates_user
            }

            //Get user authorize
            let global_auth = api_check.auth_check.global_authorize;
            let project_admin = api_check.auth_check.project_admin;
            let project_auth = api_check.auth_check.project_authorize;

            //Determine project access for user
            if(is_admin == true) {
                result.data["projects"] = all_projects;
            }else{
                for(let project in all_projects) {
                    //Get project
                    let this_project = all_projects[project];

                    //Allowed access
                    let allow_true = false;
                    if(global_auth["project_adm"] == true || project_auth[project] != undefined) {
                        allow_true = true;
                    }

                    //Check user allowed access to project
                    if(allow_true == true) {
                        result.data["projects"][project] = this_project;
                    }else{
                        //Removed showing project as disabled -- decide later if keeping
                        //result.data["projects"][project] = this_project
                        //result.data["projects"][project]["state"] = "disabled";
                    }
                }
            }

            //Add project errors
            result.data["project_error"] = mapping.web_configs.errors;

            //Add user authorized
            result.data["user_authorize"] = {}
            result.data["user_authorize"]["admin"] = is_admin;
            result.data["user_authorize"]["global_authorize"] = global_auth;
            result.data["user_authorize"]["project_admin"] = project_admin;
            result.data["user_authorize"]["project_authorize"] = project_auth;
        }

        //Return all configs
        return result;
    }

    //Project management functions
    project_config_structure() {
        return {
            "project_desc":"",
            "enabled":true,
            "proxy_map":{
                "dev": {},
                "qa": {},
                "stage": {},
                "prod": {}
            },
            "dns_names":{
                "dev": {},
                "qa": {},
                "stage": {},
                "prod": {}
            },
            "websites":{}
        }
    }

    project_manage(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "authorized": false,
            "data":{}
        }

        // Validate /////////////////

        // Validate Request /////////////////
        if(query == null) {
            result.error = "Missing query parameters";
            return result;
        }else{
            let validate = {
                "query": query,
                "result": result
            }
            validate = this.project_manage_validate(validate);
            query = validate.query;
            result = validate.result;
            if(result.error != "") {
                return result;
            }
        }

        // Auth Check ///////////////

        //Check authenticated
        let auth_check = this.jwt_auth_user_check();
        result.error = auth_check.error;
        result.state = auth_check.state;
        result.authenticated = auth_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        //Authorize validate
        let authorized = this.project_manage_authorized(auth_check, query);
        result.authorized = authorized;
        if(authorized == false) {
            result.error = "User is not authorized to complete this action";
            return result;
        }

        // Do command ///////////////

        if(authorized == false) {
            result.error = "User does not have permission to complete this action";
        }else{
            switch(query.action) {
                case "project_new":
                    result = this.project_manage_create(result, auth_check, query);
                break;
                case "project_clone":
                    result = this.project_manage_clone(result, auth_check, query);
                break;
                case "project_rename":
                    result = this.project_manage_rename(result, query);
                break;
                case "project_delete":
                    result = this.project_manage_delete(result, query);
                break;
                case "project_set_property":
                    result = this.project_manage_set_property(result, query);
                break;
                case "project_fix_config":
                    result = this.project_manage_config_fix(result, query);
                break;
            }
        }

        //Return results
        return result;
    }
    project_manage_validate(validate) {
        //Get query
        let query = validate.query;

        //Validate action
        if(!(query.action == "project_new" ||
                query.action == "project_clone" ||
                query.action == "project_rename" ||
                query.action == "project_delete" ||
                query.action == "project_set_property" ||
                query.action == "project_fix_config")
        ) {
            validate.result.error = "Project action is invalid";
            return validate;
        }

        //Validate parameters
        if(query.action == "project_new" || query.action == "project_clone" || query.action == "project_rename") {
            //Project name used as target name to create, new clone name or new renamed project
            if(query.project_name == undefined) {
                validate.result.error = "Project name is invalid";
                return validate;
            }else{
                if(this.validate_name(query.project_name) == false) {
                    validate.result.error = "Project name is invalid";
                    return validate;
                }
            }

            //Reserve system names (will cause some errors)
            if(query.project_name == "system" || query.project_name == "mgmtui") {
                validate.result.error = "Project name is reserved by system";
                return validate;
            }
        }
        if(query.action == "project_clone" || query.action == "project_rename" || query.action == "project_delete") {
            //Project selected used as the clone from, rename from, or target delete
            if(query.project_selected == undefined) {
                validate.result.error = "Selected project name is invalid";
                return validate;
            }else if(query.project_selected != "") {
                //Confirm name is valid
                if(this.validate_name(query.project_selected) == false) {
                    validate.result.error = "Selected project name is invalid";
                    return validate;
                }

                //Check project exists
                let all_projects = this.get_projects();
                if(all_projects[query.project_selected] == undefined) {
                    validate.result.error = "Selected project no longer";
                    return validate;
                }
            }
        }
        if(query.action == "project_new") {
            //Check new project type
            if(!(query.type == "blank" || query.type == "system_template" || query.type == "user_template")) {
                validate.result.error = `Project new type[${query.type}] is invalid`;
                return validate;
            }

            //Description field can be blank, check for invalid character
            if(query.project_desc == undefined) {
                validate.result.error = "Project description is invalid";
                return validate;
            }else if(query.project_desc != "") {
                if(this.validate_desc(query.project_desc) == false) {
                    validate.result.error = "Project description is invalid";
                    return validate;
                }
            }

            //Check is using system or user templates
            if(query.type == "system_template" || query.type == "user_template") {
                if(query.template == undefined) {
                    validate.result.error = `Project new, select template is undefined`;
                    return validate;
                }else if(query.template == "") {
                    validate.result.error = `Project new, select template[${query.template}] is not defined`;
                    return validate;
                }

                //Get templates from source
                let templates = {}
                if(query.type == "system_template") {
                    templates = this.get_templates("system");
                }else{
                    templates = this.get_templates("user");
                }

                //Validate template exists
                if(templates[query.template] == undefined) {
                    validate.result.error = `Project new, selected type[${query.type}] template[${query.template}] no longer exists`;
                    return validate;
                }
                if(templates[query.template]["type"] != "project") {
                    validate.result.error = `System error: Project new, selected template[${query.template}] is not a project template`;
                    return validate;
                }
            }
        }
        if(query.action == "project_set_property") {
            //Validate project name
            if(this.validate_desc(query.project_name) == false) {
                validate.result.error = "Project Name is invalid";
                return validate;
            }

            //Validate property values for checkboxes
            switch(query.property) {
                case "project_desc": 
                    if(this.validate_desc(query.value) == false) {
                        validate.result.error = "Project Description is invalid";
                        return validate;
                    }
                break;
                case "project_enabled": 
                    if(!(query.value == true || query.value == false)) {
                        validate.result.error = `Invalid checkbox state[${query.value}]`;
                        return validate;
                    }
                break;
                default:
                    validate.result.error = `Invalid property[${query.property}]`;
                    return validate;
            }
        }
        if(query.action == "project_fix_config") {
            //Validate project name
            if(this.validate_desc(query.project_name) == false) {
                validate.result.error = "Project Name is invalid";
                return validate;
            }
        }

        //Return validate
        return validate;
    }
    project_manage_authorized(auth_check, query) {
        //Check authorized
        let authorized = false;
        if(auth_check.admin == true || auth_check.mode == "none") {
            //User is the admin
            authorized = true;
        }else{
            //Check user is part of global authorized groups
            if(auth_check.global_authorize["project_adm"] != undefined) {
                authorized = true;
            }

            //Check project_adm of the selected project
            let local_project = null;
            if(auth_check.project_authorize[query.project_selected] != undefined) {
                local_project = auth_check.project_authorize[query.project_selected];
                if(local_project["project_adm"] != undefined && local_project["project_adm"] == true) {
                    authorized = true;
                }
            }

            //Check project create permissions
            if(auth_check.global_authorize["project_create"] != undefined) {
                if(query.action == "project_new") {
                    authorized = true;
                }
                //Project_selected will only exist with clone, rename and delete
                if(query.action == "project_clone") {
                    if(auth_check.project_authorize[query.project_selected] != undefined) {
                        //Allow user to clone from a project that they have read only to
                        authorized = true;
                    }
                }
            }
        }

        //Return auth
        return authorized;
    }
    project_manage_create(result, auth_check, query) {
        //Handle request type
        switch(query.type) {
            case "blank":
                result = this.project_manage_create_blank(result, auth_check, query);
            break;
            case "system_template": case "user_template":
                result = this.project_manage_create_from_template(result, auth_check, query);
            break;
            default:
                result.error = "Invalid type";
                return result;
        }

        //Return result
        return result;
    }
    project_manage_create_blank(result, auth_check, query) {
        //Get parameters
        let project_name = query.project_name;
        let project_desc = query.project_desc;

        //Check for existing folder
        let web_source = this.paths.web_source;
        let project_folder = path.join(web_source, project_name);
        if(fs.existsSync(project_folder)) {
            result.error = `Project folder[${project_folder}] already exists`;
            return result;
        }

        //Create folder
        let if_mkdir = this.make_directory(project_folder);
        if(if_mkdir.error != "") {
            result.error = if_mkdir.error;
            return result;
        }else{
            //Conf file
            let conf_file = path.join(web_source, project_name, "config.json");
            let conf_data = this.project_config_structure()
            conf_data.project_desc = project_desc;
            conf_data = JSON.stringify(conf_data,null,"\t")
            
            //Write config
            let if_mkfile = this.make_file(conf_file, conf_data);
            if(if_mkfile.error != "") {
                result.error = if_mkfile.error;
                return result;
            }

            //Assign permission to user who created the project (if not admin)
            this.project_manage_create_permissions(auth_check, query);

            //Return result
            return result;
        }
    }
    project_manage_create_from_template(result, auth_check, query) {
        //Get parameters
        let type = query.type;
        let project_name = query.project_name;
        let project_desc = query.project_desc;
        let template = query.template;

        //Set template source
        let template_root = "";
        if(type == "system_template") {
            template_root = this.paths.default_templates;
        }else{
            template_root = this.paths.web_templates;
        }

        //Check for existing project folder
        let web_source = this.paths.web_source;
        let project_folder = path.join(web_source, project_name);
        if(fs.existsSync(project_folder) == true) {
            result.error = `Project folder[${project_folder}] already exists`;
            return result;
        }

        //Check if template folder exists
        let template_folder = path.join(template_root, template);
        if(fs.existsSync(template_folder) == false) {
            result.error = `Template folder[${template_folder}] does not exist`;
            return result;
        }

        //Copy template to project
        let is_copied = this.copy_directory(template_folder, project_folder);
        if(is_copied.error != "") {
            result.error = is_copied.error;
            return result;
        }

        //Rename conf file
        let template_conf_file = path.join(project_folder, "project_conf.json");
        let project_conf_file = path.join(project_folder, "config.json");
        if(fs.renameSync(template_conf_file, project_conf_file) == false) {
            result.error = `Failed to rename template config filename to project filename`;
            return result;
        }

        //Load project new conf file
        let load_conf = this.load_project_conf(project_name);
        if(load_conf.error != "") {
            result.error = load_conf.error;
            return result;
        }
        let conf_data = load_conf.data;

        //Get new config structure
        let new_conf_data = this.project_config_structure();
        new_conf_data.project_desc = project_desc;
        new_conf_data.websites = conf_data.websites;
        
        //Write config
        let if_mkfile = this.update_project_conf_file(project_name, new_conf_data);
        if(if_mkfile.error != "") {
            result.error = if_mkfile.error;
            return result;
        }

        //Assign permission to user who created the project (if not admin)
        this.project_manage_create_permissions(auth_check, query);

        //Return result
        return result;
    }
    project_manage_create_permissions(auth_check, query) {
        //Get parameters
        let project_name = query.project_name;

        //Assign permission to user who created the project (if not admin)
        if(auth_check.mode == "auth") {
            if(auth_check.admin == false) {
                let this_user = auth_check.username;
                this.class_init(); // Add groups required
                let this_group_name = `project::${project_name}::Admin`;
                this.jwt_auth.group_set_user(this_group_name, this_user, true)
            }
        }
    }
    project_manage_clone(result, auth_check, query) {
        //Get parameters
        let project_selected = query.project_selected;
        let project_name = query.project_name;

        //Try and rename source folder first
        let web_source = this.paths.web_source;
        let curr_project_folder = path.join(web_source, project_selected);
        let new_project_folder = path.join(web_source, project_name);
        let try_copy = this.copy_directory(curr_project_folder, new_project_folder);
        if(try_copy["error"] != "") {
            result.error = try_copy["error"];
            return result;
        }

        //Remove Proxy Map and DNS Names configuration from clone
        mapping.map_generate();
        let blank_map = {
            "dev": {},
            "qa": {},
            "stage": {},
            "prod": {}
        }
        let conf_data = mapping.web_configs.projects[project_name]
        conf_data["proxy_map"] = blank_map;
        conf_data["dns_names"] = blank_map;

        //Save project config
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Assign permission to user who created the project (if not admin)
        if(auth_check.mode == "auth") {
            if(auth_check.admin == false) {
                let this_user = auth_check.username;
                this.class_init(); // Add groups required
                let this_group_name = `project::${project_name}::Admin`;
                this.jwt_auth.group_set_user(this_group_name, this_user, true)
            }
        }

        //Return results
        return result;
    }
    project_manage_rename(result, query) {
        //Get parameters
        let project_selected = query.project_selected;
        let project_name = query.project_name;

        //Try and rename source folder first
        let web_source = this.paths.web_source;
        let curr_project_folder = path.join(web_source, project_selected);
        let new_project_folder = path.join(web_source, project_name);
        let try_rename = this.rename_directory(curr_project_folder, new_project_folder);
        if(try_rename["error"] != "") {
            result.error = try_rename["error"];
            return result;
        }

        //Return results
        return result;
    }
    project_manage_delete(result, query) {
        //Get parameters
        let project_name = query.project_selected;

        //Check if file exists
        let web_source = this.paths.web_source;
        let target_project = path.join(web_source, project_name);
        let if_proj_exists = fs.existsSync(target_project);
        if(if_proj_exists == false) {
            result.error = `Project folder doesn't exist: '${project_name}'`;
            return result;
        }else{
            //Delete directory
            let is_deleted = fs.rmSync(target_project, { recursive: true, maxRetries: 3, retryDelay: 100, force: true });
            if(is_deleted == false) {
                result.error = `Project folder failed to delete: '${project_name}'`;
                return result;
            }

            //Return result
            return result;
        }
    }
    project_manage_set_property(result, query) {
        //Get values
        let project_name = query.project_name;
        let property = query.property;
        let value = query.value;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }

        //Get config data
        conf_data = conf_load.data;
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Update property
        switch(property) {
            case "project_desc":
                conf_data.project_desc = value;
            break;
            case "project_enabled":
                conf_data.enabled = value;
            break;
        }

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = "Configuration data is empty";
        }

        //Return result
        return result;
    }
    project_manage_config_fix(result, query) {
        //Get vars
        let project_name = query.project_name;

        //
        // Uses mapping class to load and map all projects, validate configuration and folder/files
        // Extract only the project configuration details from mapping class that have been corrected
        // by the system and save the configuration file. Does not correct file and folder issues.
        //

        //Use mapper class validate and correct config
        mapping.map_generate()

        //Get conf_data
        if(mapping.web_configs.projects[project_name] != undefined) {
            //Get config data
            let conf_data = mapping.web_configs.projects[project_name];

            //Arrange the config file
            let new_config = this.project_config_structure()
            new_config.project_desc =   conf_data.project_desc
            new_config.enabled =        conf_data.enabled
            new_config.proxy_map =      conf_data.proxy_map
            new_config.dns_names =      conf_data.dns_names
            new_config.websites =       conf_data.websites

            //Write updated config ///////////////////

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, new_config);
            if(is_updated.error != "") {
                result.error = "Configuration data is empty";
            }
        }else{
            result.error = "Could not retreive the configuration file";
        }

        //Return result
        return result;
    }

    //Manage project tempaltes
    template_manage(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "authorized": false,
            "data":{}
        }

        // Validate /////////////////

        // Validate Request /////////////////
        if(query == null) {
            result.error = "Missing query parameters";
            return result;
        }else{
            let validate = {
                "query": query,
                "result": result
            }
            validate = this.template_manage_validate(validate);
            query = validate.query;
            result = validate.result;
            if(result.error != "") {
                return result;
            }
        }

        // Auth Check ///////////////

        //Check authenticated
        let auth_check = this.jwt_auth_user_check();
        result.error = auth_check.error;
        result.state = auth_check.state;
        result.authenticated = auth_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        //Authorize validate
        let authorized = this.template_manage_authorized(auth_check, query);
        result.authorized = authorized;
        if(authorized == false) {
            result.error = "User is not authorized to complete this action";
            return result;
        }

        // Do command ///////////////

        if(authorized == false) {
            result.error = "User does not have permission to complete this action";
        }else{
            switch(query.action) {
                case "template_new":
                    result = this.template_manage_create(result, query);
                break;
                case "template_delete":
                    result = this.template_manage_delete(result, query);
                break;
            }
        }

        //Get templates
        let templates_system = this.get_templates("system");
        let templates_user = this.get_templates("user");
        result.data["system"] = templates_system;
        result.data["user"] = templates_user;

        //Return results
        return result;
    }
    template_manage_validate(validate) {
        //Get query
        let query = validate.query;

        //Validate action
        if(!(query.action == "template_new" ||
            query.action == "template_delete")
        ) {
            validate.result.error = "Template action is invalid";
            return validate;
        }

        //Validate per action
        switch(query.action) {
            case"template_new":
                //Verify type
                if(query.type == undefined) {
                    validate.result.error = "Missing template type parameter";
                    return validate;
                }else{
                    if(!(query.type == "website" || query.type == "project")) {
                        validate.result.error = `Template type[${query.type}] is invalid`;
                        return validate;
                    }
                }

                //Verify project name
                if(this.validate_name(query.project_name) == false) {
                    validate.result.error = "Project name is invalid";
                    return validate;
                }else{
                    //Get all projects
                    let all_projects = this.get_projects();
                    if(all_projects[query.project_name] == undefined) {
                        validate.result.error = "Project no longer exists";
                        return validate;
                    }
                }

                //Verify the template name
                if(this.validate_name(query.template_name) == false) {
                    validate.result.error = "Template name is invalid";
                    return validate;
                }

                //Verify the template description
                if(query.description != "") {
                    if(this.validate_desc(query.description) == false) {
                        validate.result.error = "Template description is invalid";
                        return validate;
                    }
                }

                //Verify websites list
                if(query.type == "website") {
                    if(query.websites == undefined) {
                        validate.result.error = "Template website selection is not defined";
                        return validate;
                    }else if(query.websites.length == 0) {
                        validate.result.error = "Template website selection is empty";
                        return validate;
                    }
                }
            break;
            case"template_delete":
                //Verify the template name
                if(this.validate_name(query.template_name) == false) {
                    validate.result.error = "Template name is invalid";
                    return validate;
                }
            break;
        }

        //Return validate
        return validate;
    }
    template_manage_authorized(auth_check, query) {
        //Check authorized
        let authorized = false;
        if(auth_check.admin == true || auth_check.mode == "none") {
            //User is the admin
            authorized = true;
        }else{
            //Check user is part of global authorized groups
            if(auth_check.global_authorize["template_adm"] != undefined) {
                authorized = true;
            }

            //Check query action
            if(query.action == "template_list") {
                authorized = true;
            }
        }

        //Return auth
        return authorized;
    }
    template_manage_create(result, query) {
        //Build template type
        switch(query.type) {
            case "project":
                result = this.template_manage_create_project(result, query);
            break;
            case "website":
                result = this.template_manage_create_website(result, query);
            break;
        }
        
        //Return result
        return result;
    }
    template_manage_create_project(result, query) {
        //Get vars
        let project_name = query.project_name;
        let template_name = query.template_name;
        let description = query.description;

        //Set paths
        let source_path = path.join(this.paths.web_source, project_name);
        let template_path = path.join(this.paths.web_templates, template_name);

        //Validate source path
        if(fs.existsSync(source_path) == false) {
            result.error = `Project folder is not found: '${source_path}'`;
            return result;
        }

        //Validate template doesn't exist already
        if(fs.existsSync(template_path) == true) {
            result.error = `Template folder already exists: '${template_path}'`;
            return result;
        }

        //Copy project folder to template
        let is_copied = this.copy_directory(source_path, template_path);
        if(is_copied["error"] != "") {
            result.error = is_copied["error"];
            return result;
        }

        //Rename the configuration file
        let template_conf_path = path.join(template_path, "config.json");
        let template_conf_new = path.join(template_path, "project_conf.json");
        if(fs.renameSync(template_conf_path, template_conf_new) == false) {
            result.error = "Could not rename template config file";
            return result;
        }

        //Open the copied configuration file and modify
        let load_conf = this.load_template_conf(template_conf_new);
        let template_conf = {}
        if(load_conf.error != "") {
            result.error = load_conf.error;
            return result;
        }else{
            template_conf = load_conf.data;
        }

        //Create new config
        let new_conf = {
            "description":description,
            "websites":template_conf.websites
        }
        
        //Write config file
        let is_updated = this.update_template_conf_file(template_conf_new, new_conf);
        if(is_updated.error != "") {
            result.error = is_updated.error;
            return result;
        }

        //Return result
        return result;
    }
    template_manage_create_website(result, query) {
        //Get vars
        let project_name = query.project_name;
        let template_name = query.template_name;
        let description = query.description;
        let websites = query.websites;

        //Set paths
        let source_path = path.join(this.paths.web_source, project_name);
        let template_path = path.join(this.paths.web_templates, template_name);

        //Validate source path
        if(fs.existsSync(source_path) == false) {
            result.error = `Project folder is not found: '${source_path}'`;
            return result;
        }

        //Validate template doesn't exist already
        if(fs.existsSync(template_path) == true) {
            result.error = `Template folder already exists: '${template_path}'`;
            return result;
        }

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {};
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }
        conf_data = conf_load.data;
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Validate selected sites exist
        for(let i in websites) {
            let this_site = websites[i];

            //Validate the site exists in the project config
            if(conf_data.websites[this_site] == undefined) {
                result.error = `Site[${this_site}] not found in project[${project_name}]`;
                return result;
            }

            //Validate the site folder exists in project folder
            let source_site_path = path.join(source_path, this_site);
            if(fs.existsSync(source_site_path) == false) {
                result.error = `Project site folder doesn't exist: '${source_site_path}'`;
                return result;
            }
        }

        //Generate templete configuration file
        let template_conf = {
            "description":description,
            "websites":{}
        }

        //Create the template folders
        let is_created = this.make_directory(template_path);
        if(is_created["error"] != "") {
            result.error = is_created["error"];
            return result;
        }

        for(let i in websites) {
            //Get site name
            let this_site = websites[i];

            //Copy folder path
            let source_site_path = path.join(source_path, this_site);
            let template_site_path = path.join(template_path, this_site);
            
            let is_copied = this.copy_directory(source_site_path, template_site_path);
            if(is_copied["error"] != "") {
                result.error = is_copied["error"];
                return result;
            }

            //Copy site data
            let array_copy = conf_data.websites[this_site];
            array_copy = JSON.stringify(array_copy);
            template_conf.websites[this_site] = JSON.parse(array_copy);
        }

        //Write template config data
        let template_conf_file = path.join(template_path, "website_conf.json");

        //Write config file
        let is_updated = this.make_template_conf_file(template_conf_file, template_conf);
        if(is_updated.error != "") {
            result.error = is_updated.error;
            return result;
        }

        //Return result
        return result;
    }
    template_manage_delete(result, query) {
        //Get vars
        let template_name = query.template_name;

        //Define template path
        let template_dir = path.join(this.paths.web_templates, template_name);

        //Delete directory
        let is_deleted = this.delete_directory(template_dir);
        if(is_deleted["error"] != "") {
            result.error = is_deleted["error"];
        }

        //Return result
        return result;
    }

    //Manage site policy
    website_manage(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "authorized":false,
            "data":{}
        }

        // Validate Request /////////////////
        if(query == null) {
            result.error = "Missing query parameters";
            return result;
        }else{
            let validate = {
                "query": query,
                "result": result
            }
            validate = this.website_manage_validate(validate);
            query = validate.query;
            result = validate.result;
            if(result.error != "") {
                return result;
            }
        }

        // Auth Check ///////////////////////

        //Check authenticated
        let auth_check = this.jwt_auth_user_check();
        result.error = auth_check.error;
        result.state = auth_check.state;
        result.authenticated = auth_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        //Authorize validate
        let authorized = this.website_manage_authorized(auth_check, query);
        result.authorized = authorized;
        if(authorized == false) {
            result.error = "User is not authorized to complete this action";
            return result;
        }

        // Do command ///////////////        

        switch(query.action) {
            case "website_new":
                result = this.website_manage_create(result, query);
            break;
            case "website_rename": case "website_clone":
                result = this.website_manage_rename_clone(result, query);
            break;
            case "website_delete":
                result = this.website_manage_website_delete(result, query);
            break;
            case "website_set_property":
                result = this.website_manage_set_property(result, query);
            break;
            // website_maint_page_create
            // website_errors_pages_create
            case "website_map_add":
                result = this.website_manage_map_add(result, query);
            break;
            case "website_map_delete":
                result = this.website_manage_map_delete(result, query);
            break;
        }

        //Return result
        return result
    }
    website_manage_validate(validate) {
        //Check required fields
        let query = validate.query;
        
        //Validate actions
        let actions = [
            "website_new",
            "website_rename",
            "website_clone",
            "website_delete",
            "website_set_property",
            "website_maint_page_create",
            "website_errors_pages_create",
            "website_map_add",
            "website_map_delete",
        ]
        if(actions.includes[query.action] == false) {
            validate.result.error = `Invalid request action [${query.action}]`
            return validate;
        }

        //Validate project and website field is defined
        if(query.project == undefined) {
            validate.result.error = "Missing parameters project field";
            return validate;
        }
        if(this.validate_name(query.project) == false) {
            validate.result.error = "Project name is invalid";
            return validate;
        }

        //Validate new website first (focused website will be blank for this)
        switch(query.action) {
            case "website_new":
                //Verify new type
                if(query.type == undefined) {
                    validate.result.error = "Invalid new website type parameter";
                    return validate;
                }
                if(!(query.type == "blank" || query.type == "system_template" || query.type == "user_template")) {
                    validate.result.error = `Invalid new website type parameter [${query.type}]`;
                    return validate;
                }

                //Validate fields
                if(query.type == "blank") {
                    if(this.validate_name(query.website_name) == false) {
                        validate.result.error = "New website name is invalid";
                        return validate;
                    }
                }else if(query.type == "system_template" || query.type == "user_template") {
                    //Verify fields
                    if(query.template_name == undefined) {
                        validate.result.error = "Missing template name for creation of new website(s)";
                        return validate;
                    }
                    if(query.template_websites == undefined || Object.keys(query.template_websites).length == 0) {
                        validate.result.error = "Missing template website(s) for creation of new website(s)";
                        return validate;
                    }

                    //Get templates
                    let templates = {}
                    if(query.type == "system_template") {
                        templates = this.get_templates("system");
                    }else if(query.type == "user_template") {
                        templates = this.get_templates("user");
                    }

                    //Validate template location and template websites are valid
                    if(templates[query.template_name] == undefined) {
                        validate.result.error = `Template store[${query.type}] name[${query.template_name}] does not exist`;
                        return validate;
                    }else if(templates[query.template_name]["conf"] == undefined || templates[query.template_name]["conf"]["websites"] == undefined) {
                        validate.result.error = `Template store[${query.type}] name[${query.template_name}] appears to be corrupt or invalid`;
                        return validate;
                    }

                    //Validate the website parameters
                    let websites = templates[query.template_name]["conf"]["websites"];
                    for(let new_website in query.template_websites) {
                        //Verify the template website exists
                        if(websites[new_website] == undefined) {
                            validate.result.error = `Template store[${query.type}] name[${query.template_name}] website[${new_website}] does not exist`;
                            return validate;
                        }
                        //Validate the new_website name
                        if(this.validate_name(query.template_websites[new_website]) == false) {
                            validate.result.error = `New website name[${query.template_websites[new_website]}] is invalid`;
                            return validate;
                        }
                    }
                }

                //New website return validate as OK
                return validate;
            break;
            case "website_rename": case "website_clone": case "website_delete":
                //Verify website selected
                if(query.select_website_name == undefined) {
                    validate.result.error = "Selected Website property is not defined";
                    return validate;
                }
                if(this.validate_name(query.select_website_name) == false) {
                    validate.result.error = "Website name is invalid";
                    return validate;
                }

                //Check new name for rename or clone
                if(query.action == "website_rename" || query.action == "website_clone") {
                    //Verify website selected
                    if(query.new_website_name == undefined) {
                        validate.result.error = "Selected Website new name property is not defined";
                        return validate;
                    }
                    if(this.validate_name(query.new_website_name) == false) {
                        validate.result.error = "Website new name contains invalid characters";
                        return validate;
                    }
                }

                //Rename, Clone, Delete website return validate as OK
                return validate;
            break;
        }

        //Validate website field is defined
        if(query.website == undefined) {
            validate.result.error = "Missing parameters website field";
            return validate;
        }
        if(this.validate_name(query.website) == false) {
            validate.result.error = "Website name is invalid";
            return validate;
        }

        //Validate types
        switch(query.action) {
            case "website_set_property":
                //Verify property values
                if(query.property == undefined) {
                    validate.result.error = "Website property is not defined";
                    return validate;
                }
                if(!(query.property == "ssl_redirect" || 
                    query.property == "default_doc" ||
                    query.property == "maintenance" ||
                    query.property == "maintenance_page" || 
                    query.property == "maintenance_page_api" || 
                    query.property == "error_page"
                )) {
                    validate.result.error = `Website property[${query.property}] is invalid`;
                    return validate;
                }

                //Common field validate
                if(query.value == undefined) {
                    validate.result.error = `Website property[${query.property}] value is undefined`;
                    return validate;
                }

                //Validate maintenance sub types
                if(query.property == "maintenance") {
                    //Validate environment selected
                    if(query.env == undefined) {
                        validate.result.error = `Website maintenance mode env is not defined`;
                        return validate;
                    }
                    if(!(query.env == "dev" || 
                        query.env == "qa" || 
                        query.env == "stage" || 
                        query.env == "prod"
                    )) {
                        validate.result.error = `Website maintenance mode env[${query.env}] is invalid`;
                        return validate;
                    }
                }

                //Validate true / false properties
                if(query.property == "ssl_redirect" || query.property == "maintenance") {
                    //Validate value
                    if(!(query.value == true || query.value == false)) {
                        validate.result.error = `Website property[${query.property}] value[${query.value}] is invalid`;
                        return validate;
                    }
                }

                //Validate error pages sub types
                if(query.property == "error_page") {
                    //Validate error document types
                    if(query.type == undefined) {
                        validate.result.error = `Website error response type is undefined`;
                        return validate;
                    }
                    if(!(query.type == "user" || 
                        query.type == "api"
                    )) {
                        validate.result.error = `Website error response type[${query.type}] is invalid`;
                        return validate;
                    }

                    //Validate error page
                    if(query.page == undefined) {
                        validate.result.error = `Website error page is undefined`;
                        return validate;
                    }
                    if(!(query.page == "404" || 
                        query.page == "500"
                    )) {
                        validate.result.error = `Website error page[${query.page}] is invalid`;
                        return validate;
                    }
                }

                //Validate string or filenames for value properties
                if(query.property == "default_doc" || 
                   query.property == "maintenance_page" || 
                   query.property == "maintenance_page_api" ||
                   query.property == "error_page"
                ) {
                    //Validate value is string
                    if(typeof(query.value) != "string") {
                        validate.result.error = `Website property[${query.property}] value[${query.value}] is not a string value`;
                        return validate;
                    }

                    //Validate filename
                    if(this.validate_name(query.value) == false) {
                        validate.result.error = `Website property[${query.property}] filename[${query.value}] contains invalid character`;
                        return validate;
                    }
                    let extname = path.extname(query.value);
                    let extnames = [
                        ".csv", 
                        ".html", 
                        ".htm", 
                        ".js", 
                        ".json", 
                        ".jsonld", 
                        ".txt", 
                        ".xhtml", 
                        ".xml"
                    ];
                    if(extnames.includes(extname) == false) {
                        validate.result.error = `Website property[${query.property}] filename[${query.value}] is not a supported extension`;
                        return validate;
                    }
                }
            break;
            case "website_map_add": case "website_map_delete":
                //Validate map type
                if(query.map_type == undefined) {
                    validate.result.error = `Website map_type is not defined`;
                    return validate;
                }
                if(!(query.map_type === "apis_fixed_path" ||
                    query.map_type === "apis_dynamic_path" ||
                    query.map_type === "path_static" ||
                    query.map_type === "path_static_server_exec" ||
                    query.map_type === "sub_map"
                )) {
                    validate.result.error = `Website map_type[${query.map_type}] is invalid`;
                    return validate;
                }

                //Validate web path
                if(query.web_path == undefined) {
                    validate.result.error = `Website web_path is not defined`;
                    return validate;
                }else{
                    //Check path
                    let web_path = decodeURIComponent(query.web_path);
                    if(this.validate_web_path(web_path) == false) {
                        validate.result.error = `Website web_path has invalid charaters`;
                        return validate;
                    }

                    //Format path
                    validate.query.web_path = this.format_path(web_path)
                }

                //Validate map path
                if(query.action == "website_map_add") {
                    if(query.map_path == undefined) {
                        validate.result.error = `Website map_path is not defined`;
                        return validate;
                    }else{
                        let map_path = decodeURIComponent(query.map_path);
                        if(query.map_type == "sub_map") {
                            if(this.validate_name(map_path) == false) {
                                validate.result.error = `Website map_path has invalid charaters`;
                                return validate;
                            }
                        }else{
                            //Check path
                            if(this.validate_map_path(map_path) == false) {
                                validate.result.error = `Website map_path has invalid charaters`;
                                return validate;
                            }

                            //Format path
                            validate.query.map_path = this.format_path(map_path)
                        }
                    }
                }
            break;
            default:
                validate.result.error = "Invalid request actopm"
                return validate;
            }

        //Return result
        return validate;
    }
    website_manage_authorized(auth_check, query) {
        //Check authorized
        let authorized = false;
        if(auth_check.admin == true || auth_check.mode == "none") {
            //User is the admin
            authorized = true;
        }else{
            //Check user is part of global authorized groups
            if(auth_check.global_authorize["project_adm"] != undefined) {
                authorized = true;
            }else{
                //Check access to website
                if(auth_check.project_authorize[query.project] != undefined) {
                    //Get permissions
                    let project_adm = auth_check.project_authorize[query.project]["project_adm"];
                    let website_adm = auth_check.project_authorize[query.project]["website_adm"];
                    let website_set = auth_check.project_authorize[query.project]["website_set"];

                    //Check admin of the project itself
                    if(project_adm != undefined && project_adm == true) {
                        authorized = true;
                    }else{
                        //Check authorized based on action
                        switch(query.action) {
                            case "website_new": case "website_rename": case "website_clone": case "website_delete":
                                if(website_adm != undefined && website_adm == true) {
                                    authorized = true;
                                }
                            break;
                            default:
                                //All other settings
                                if(website_adm != undefined && website_adm == true) {
                                    authorized = true;
                                }else if(website_set != undefined && website_set == true) {
                                    authorized = true;
                                }
                        }   
                    }
                }
            }
        }

        //Return auth
        return authorized;
    }
    website_manage_create(result, query) {
        //Get variables
        let project_name = query.project;
        let website_type = query.type;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {};
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }
        conf_data = conf_load.data;
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Check if websites section exists
        if(conf_data.websites == undefined) {
            conf_data.websites = {};
        }

        //Website build
        let build = {
            "result":result,
            "query":query,
            "conf_data":conf_data,
            "updated":false
        }

        //Handle request type
        switch(website_type) {
            case "blank":
                build = this.website_manage_create_blank(build);
            break;
            case "system_template": case "user_template":
                build = this.website_manage_create_from_template(build);
            break;
            default:
                result.error = "Invalid type";
                return result;
        }

        //Get build data
        conf_data = build.conf_data;
        result = build.result;

        //Check errors
        if(result.error != "") {
            return result;
        }

        //Check updated = true
        if(build.updated == true) {
            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }
        }

        //Return result
        return result;
    }
    website_manage_create_blank(build) {
        //Get config data
        let conf_data = build.conf_data;
        let project_name = build.query.project;
        let website_name = build.query.website_name;

        //Check if site already exists
        if(conf_data.websites.website_name != undefined) {
            build.result.error = `Site name[${website_name}] already exists`;
            return build;
        }

        //Set target folder
        let new_site_folder = path.join(this.paths.web_source, project_name, website_name);

        //Create site directory
        let is_created = this.make_directory(new_site_folder);
        if(is_created.error != "") {
            build.result.error = is_created.error;
            return build;
        }

        //New config
        let new_conf = {}

        //Create blank conf
        new_conf = {
            "ssl_redirect": false,
            "maintenance": {
                "dev": false,
                "qa": false,
                "stage": false,
                "prod": false
            },
            "maintenance_page": "",
            "maintenance_page_api": "",
            "default_doc": "",
            "default_errors": {
				"user": {
					"404": "",
					"500": ""
				},
				"api": {
					"404": "",
					"500": ""
				}
			},
            "apis_fixed_path": {},
            "apis_dynamic_path": {},
            "path_static": {},
            "path_static_server_exec": {},
			"sub_map": {}
        }

        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Add to config
        build.conf_data.websites[website_name] = new_conf;
        build.updated = true;

        //Return result
        return build;
    }
    website_manage_create_from_template(build) {
        //Get config data
        let conf_data = build.conf_data;

        //Get templates
        let templates = {}
        let template_path = "";
        if(build.query.type == "system_template") {
            templates = this.get_templates("system");
            template_path = this.paths.default_templates;
        }else{
            templates = this.get_templates("user");
            template_path = this.paths.web_templates;
        }

        //Check templates data
        if(Object.keys(templates).length == 0) {
            build.result.error = "System error, template data not retreived properly";
            return build;
        }
        if(templates[build.query.template_name] == undefined) {
            build.result.error = "System error, template data not retreived properly";
            return build;
        }

        //Set template data
        let template_name = build.query.template_name;
        let template_data = templates[template_name];
        let template_websites = template_data.conf.websites;

        //Get websites lists
        let project_name = build.query.project;
        let project_websites = conf_data.websites;
        let target_websites = build.query.template_websites;

        //Process websites to deploy
        let deploy = {}
        for(let target in target_websites) {
            //Get from the template
            let template_website_name = target;
            let template_website_conf = template_websites[target];
            let template_website_path = path.join(template_path, template_name, template_website_name);

            //New website name
            let website_new_name = target_websites[target];
            let website_new_path = path.join(this.paths.web_source, project_name, website_new_name);

            //Check for conflicting name
            if(project_websites[website_new_name] != undefined) {
                build.result.error = `Website name[${website_new_name}] already exists`
                return build;
            }

            //Deploy target
            deploy[target] = {
                "template_website_name":template_website_name,
                "template_website_conf":template_website_conf,
                "template_website_path":template_website_path,
                "website_new_name":website_new_name,
                "website_new_path":website_new_path
            }
        }

        //Deploy new sites from template
        for(let new_website in deploy) {
            //Confirm template directory
            let source_dir = deploy[new_website]["template_website_path"];
            if(fs.existsSync(source_dir) == false) {
                build.result.error = `Template[${template_name}] website[${deploy[new_website]["template_website_name"]}] source dir does not exist`;
                return build;
            }

            //Copy template website dir to project
            let target_dir = deploy[new_website]["website_new_path"];
            let is_copied = this.copy_directory(source_dir, target_dir);
            if(is_copied["error"] != "") {
                build.result.error = is_copied["error"];
                return build;
            }

            //Verify target directory
            if(fs.existsSync(target_dir) == false) {
                build.result.error = `Failed to copy template[${template_name}] website[${deploy[new_website]["template_website_name"]}] files to project`;
                return build;
            }

            //Import template configuration data
            let template_website_name = deploy[new_website]["template_website_name"];
            let website_name = deploy[new_website]["website_new_name"];
            let website_conf = deploy[new_website]["template_website_conf"];

            //Update website mapping, make sure target path is the same
            let sections = [
                "apis_fixed_path",
                "apis_dynamic_path",
                "path_static",
                "path_static_server_exec"
            ]
            for(let i in sections) {
                let section = sections[i];

                //Loop through mapping
                for(let web_path in website_conf[section]) {
                    let map_path = website_conf[section][web_path];

                    //Replace string
                    let target_str = `/${template_website_name}/`;
                    let replace_str = `/${website_name}/`;
                    map_path = map_path.replace(target_str, replace_str);
                    
                    //replace target
                    website_conf[section][web_path] = map_path;
                }
            }

            //Clear sub mapping (if exists)
            website_conf["sub_map"] = {}

            //Add to conf
            conf_data["websites"][website_name] = website_conf;
        }

        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Add to config
        build.conf_data = conf_data;
        build.updated = true;

        //Return build
        return build;
    }
    website_manage_rename_clone(result, query) {
        //Get vars
        let action = query.action;
        let project_name = query.project;
        let curr_site_name = query.select_website_name;
        let new_site_name = query.new_website_name;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }

        //Get config data
        conf_data = conf_load.data;
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Check for project site
        if(conf_data.websites[curr_site_name] == undefined) {
            result.error = `Site name[${curr_site_name}] is not defined`;
            return result;
        }

        //Try and rename source folder first
        let web_source = this.paths.web_source;
        let curr_site_folder = path.join(web_source, project_name, curr_site_name);
        let new_site_folder = path.join(web_source, project_name, new_site_name)
        if(action == "website_rename") {
            let try_rename = this.rename_directory(curr_site_folder, new_site_folder);
            if(try_rename["error"] != "") {
                result.error = try_rename["error"];
                return result;
            }
        }else{
            let try_copy = this.copy_directory(curr_site_folder, new_site_folder);
            if(try_copy["error"] != "") {
                result.error = try_copy["error"];
                return result;
            }
        }

        //Copy the array
        let array_copy = conf_data.websites[curr_site_name];
        array_copy = JSON.stringify(array_copy);
        conf_data.websites[new_site_name] = JSON.parse(array_copy);

        //On rename, remove the current site configuration
        if(action == "website_rename") {
            delete conf_data.websites[curr_site_name];
        }

        //Update path mapping
        let sections = [
            "apis_fixed_path",
            "apis_dynamic_path",
            "path_static",
            "path_static_server_exec"
        ]
        for(let i in sections) {
            let section = sections[i];
            let search_str = `/${curr_site_name}`;
            let replace_str = `/${new_site_name}`;

            //Loop through mapping
            for(let web_path in conf_data.websites[new_site_name][section]) {
                let map_path = conf_data.websites[new_site_name][section][web_path];

                //Replace string
                let target_str = `/${curr_site_name}/`;
                let replace_str = `/${new_site_name}/`;
                map_path = map_path.replace(target_str, replace_str);
                
                //replace target
                conf_data.websites[new_site_name][section][web_path] = map_path;
            }
        }

        //Sort websites
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Update DNS linking for rename site
        if(action == "website_rename") {
            //Clean up Proxy Map and DNS linking for deleted sites
            let mapping = ["proxy_map", "dns_names"];
            for(let i in mapping) {
                let this_map = mapping[i];

                //Loop environments
                let environments = ["dev", "qa", "stage", "prod"];
                for(let e in environments) {
                    let this_env = environments[e];

                    if(conf_data[this_map] != undefined) {
                        //Set DNS resolve to blank for removed sites
                        if(conf_data[this_map][this_env] != undefined) {
                            for(let map in conf_data[this_map][this_env]) {
                                let this_site = conf_data[this_map][this_env][map];
                                if(conf_data.websites[this_site] == undefined) {
                                    conf_data[this_map][this_env][map] = new_site_name;
                                }
                            }
                        }
                    }
                }
            }

            //Clean up sub mapping
            for(let website in conf_data.websites) {
                for(let map in conf_data.websites[website]["sub_map"]) {
                    let target_site = conf_data.websites[website]["sub_map"][map];
                    if(target_site == curr_site_name) {
                        conf_data.websites[website]["sub_map"][map] = new_site_name;
                    }
                }
            }
        }

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Results
        return result;
    }
    website_manage_website_delete(result, query) {
        //Get vars
        let project_name = query.project;
        let website_name = query.select_website_name;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }

        //Get config data
        conf_data = conf_load.data;
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Check for project site
        if(conf_data.websites[website_name] == undefined) {
            result.error = `Site name[${website_name}] is not defined`;
            return result;
        }

        //Try and delete source folder first
        let web_source = this.paths.web_source;
        let website_folder = path.join(web_source, project_name, website_name);
        let try_delete = this.delete_directory(website_folder);
        if(try_delete["error"] != "") {
            result.error = try_delete["error"];
            return result;
        }

        //Remove the site configuration
        delete conf_data.websites[website_name];

        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Clean up Proxy Map and DNS linking for deleted sites
        let mapping = ["proxy_map", "dns_names"];
        for(let i in mapping) {
            let this_map = mapping[i];

            //Loop environments
            let environments = ["dev", "qa", "stage", "prod"];
            for(let e in environments) {
                let this_env = environments[e];

                if(conf_data[this_map] != undefined) {
                    //Set DNS resolve to blank for removed sites
                    if(conf_data[this_map][this_env] != undefined) {
                        for(let map in conf_data[this_map][this_env]) {
                            let this_site = conf_data[this_map][this_env][map];
                            if(conf_data.websites[this_site] == undefined) {
                                conf_data[this_map][this_env][map] = "";
                            }
                        }
                    }
                }
            }
        }

        //Clean up sub mapping
        for(let website in conf_data.websites) {
            for(let map in conf_data.websites[website]["sub_map"]) {
                let target_site = conf_data.websites[website]["sub_map"][map];
                if(target_site == website_name) {
                    delete conf_data.websites[website]["sub_map"][map];
                }
            }
        }

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Return
        return result;
    }
    website_manage_set_property(result, query) {
        //Get variables
        let project_name = query.project;
        let website_name = query.website;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }else{
            //Get config data
            conf_data = conf_load.data;
            if(Object.keys(conf_data).length === 0) {
                result.error = "Configuration data is empty";
                return result;
            }

            //Verify config setting exists
            if(conf_data["websites"][website_name] == undefined) {
                conf_data["websites"][website_name] = {}
            }
            if(conf_data["websites"][website_name]["default_errors"] == undefined) {
                conf_data["websites"][website_name]["default_errors"] = {}
            }

            //Get value
            let property = query.property;
            let value = query.value;

            //Update website state
            switch(property) {
                case "ssl_redirect":
                    conf_data["websites"][website_name]["ssl_redirect"] = value;
                break;
                case "default_doc":
                    conf_data["websites"][website_name]["default_doc"] = value;
                break;
                case "maintenance":
                    let env = query.env;
                    conf_data["websites"][website_name]["maintenance"][env] = value;
                break;
                case "maintenance_page":
                    conf_data["websites"][website_name]["maintenance_page"] = value;
                break;
                case "maintenance_page_api":
                    conf_data["websites"][website_name]["maintenance_page_api"] = value;
                break;
                case "error_page":
                    let type = query.type;
                    let page = query.page;
                    conf_data["websites"][website_name]["default_errors"][type][page] = value;
                break;
            }

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Result
            return result;
        }
    }
    website_manage_map_add(result, query) {
        //Get variables
        let project_name = query.project;
        let website_name = query.website;
        let map_type = query.map_type;
        let web_path = query.web_path;
        let map_path = query.map_path;
        
        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }else{
            //Get config data
            conf_data = conf_load.data;
            if(Object.keys(conf_data).length === 0) {
                result.error = "Configuration data is empty";
                return result;
            }

            //Validate site config
            if(conf_data["websites"] == undefined) {
                result.error = "Error accessing 'websites' in configuration";
                return result;
            }
            if(conf_data["websites"][website_name] == undefined) {
                result.error = `Error accessing site name[${website_name}] in configuration`;
                return result;
            }
            let this_site = conf_data["websites"][website_name]
            
            //Add any missing sections
            if(this_site[map_type] == undefined) {
                conf_data["websites"][website_name][map_type] = {}
            }

            //Check for conflicts
            for(let this_web_path in conf_data["websites"][website_name][map_type]) {
                if(this_web_path == web_path) {
                    switch(map_type) {
                        case "apis_fixed_path":
                            result.error = "Web path is already defined in 'API fixed mapping'";
                        break;
                        case "apis_dynamic_path":
                            result.error = "Web path is already defined in 'API dynamic mapping'";
                        break;
                        case "path_static":
                            result.error = "Web path is already defined in 'Static content mapping'";
                        break;
                        case "path_static_server_exec":
                            result.error = "Map path is already defined in 'Static content server execute override mapping'";
                        break;
                        case "sub_map":
                            result.error = "Web path is already defined in 'Project Website Sub Mapping'";
                        break;
                    }
                    return result;
                }
            }

            //Add setting
            let this_config = "";
            let sort_config = "";

            this_config = conf_data["websites"][website_name][map_type];
            this_config[web_path] = map_path;
            sort_config = this.sort_hash_array_longest_str(this_config);
            conf_data["websites"][website_name][map_type] = sort_config;

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Return result
            return result;
        }
    }
    website_manage_map_delete(result, query) {
        //Get variables
        let project_name = query.project;
        let website_name = query.website;
        let map_type = query.map_type;
        let web_path = query.web_path;

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }else{
            //Get config data
            conf_data = conf_load.data;
            if(Object.keys(conf_data).length === 0) {
                result.error = "Configuration data is empty";
                return result;
            }

            //Verify settings are in place
            if(conf_data["websites"] == undefined) {
                result.error = "Error accessing 'websites' in configuration";
                return result;
            }
            if(conf_data["websites"][website_name] == undefined) {
                result.error = `Error accessing site name[${website_name}] in configuration`;
                return result;
            }
            if(conf_data["websites"][website_name][map_type] == undefined) {
                result.error = `Error accessing site name[${website_name}] map_type[${map_type}] in configuration`;
                return result;
            }

            //Delete the item
            delete conf_data["websites"][website_name][map_type][web_path];

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Result
            return result;
        }
    }

    //Project files management
    files_restricted() {
        //Define variables
        let restrict_paths = {};
        let web_source = this.paths.web_source;
        let all_configs = this.get_projects();

        //Define restricted paths
        for(let project in all_configs) {
            //Project root folder
            let project_path = path.join(web_source, project);
            restrict_paths[project_path] = "Project folder";

            //Get all website paths
            for(let website in all_configs[project]["websites"]) {
                //Set this website data
                let this_website = all_configs[project]["websites"][website];

                //Protect base website path
                let website_path = path.join(web_source, project, website);
                restrict_paths[website_path] = "Website folder bound to configuration";

                //Protect mapping folders
                let sections = ["apis_fixed_path", "apis_dynamic_path", "path_static", "path_static_server_exec"]
                for(let i in sections) {
                    let section = sections[i];
                    if(this_website[section] != undefined) {
                        for(let web_path in this_website[section]) {
                            //Protect map path
                            let map_path = this_website[section][web_path];
                            map_path = map_path.substring(map_path.length - (map_path.length - website.length - 1))
                            if(map_path != "") {
                                restrict_paths[path.join(website_path, map_path)] = "Website fixed API path mapping";
                            }

                            //Protect default_doc for static path
                            if(section == "path_static") {
                                let default_doc = this_website["default_doc"]
                                if(default_doc != "") {
                                    let doc_path = path.join(website_path, map_path, default_doc)
                                    restrict_paths[doc_path] = "Website static path mapped default doc";
                                }
                            }
                        }
                    }
                }

                //Protect _maintenance_page and _error_pages if default file exists
                if(this_website["maintenance_page"] != "" || this_website["maintenance_page_api"] != "") {
                    restrict_paths[path.join(website_path, "_maintenance_page")] = "Website maintenance page path";
                }
                if(this_website["maintenance_page"] != "") {
                    restrict_paths[path.join(website_path, "_maintenance_page", this_website["maintenance_page"])] = "Website maintenance page";
                }
                if(this_website["maintenance_page_api"] != "") {
                    restrict_paths[path.join(website_path, "_maintenance_page", this_website["maintenance_page_api"])] = "Website maintenance page";
                }

                //Protect _error_pages if default file exists
                let default_error_docs = ["404", "500"];
                let setting_exist = false;
                for(let d in default_error_docs) {
                    let error_page_user = this_website["default_errors"]["user"][default_error_docs[d]];
                    let error_page_api = this_website["default_errors"]["api"][default_error_docs[d]]
                    if(error_page_user != "") {
                        setting_exist = true;
                        restrict_paths[path.join(website_path, "_error_pages", error_page_user)] = "Website error pages";
                    }
                    if(error_page_api != "") {
                        setting_exist = true;
                        restrict_paths[path.join(website_path, "_error_pages", error_page_api)] = "Website error pages";
                    }
                }
                if(setting_exist == true) {
                    restrict_paths[path.join(website_path, "_error_pages")] = "Website error pages path";
                }


            }

            //Get JSON config
            restrict_paths[path.join(web_source, project, "config.json")] = "Project configuation file";
        }

        //Remove all end of line slashes (append in other function where needed)
        return restrict_paths;
    }
    files_get(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
        }

        //Get properties
        let project_name = query.project;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","files_adm","files_read"],
            "project":project_name
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////        

        //Check if directory
        let web_source = this.paths.web_source;
        let project_dir = `${web_source}${project_name}`;
        let dir_struct = this.read_dir_struct(project_dir);

        //Return directory
        result.data = dir_struct;
        return result;
    }
    files_view(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(query.target_file == undefined) {
                result.error = "Target file not defined";
                return result;
            }
        }

        //Get properties
        let project_name = query.project;
        let target_path = decodeURIComponent(query.target_file);

        //Check path belongs to project
        let web_source = this.paths.web_source;
        let target_project = `${web_source}${project_name}`;

        // Check if file belongs to project path
        if(!(target_path.startsWith(target_project))) {
            result.error = "File path does not belong to project";
            return result;
        }

        //Check for protected files
        let check_path = this.validate_allowed_path(target_path);
        if(check_path["error"] != "") {
            result.error = check_path.error;
            return result;
        }

        // Check filename extention
        let file_ext = path.extname(target_path);
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
        if(match_ext.indexOf(file_ext) == -1) {
            result.error = "File extension not recognized as a text document";
            return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","files_adm","files_read"],
            "project":project_name
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////        

        //Get file contents
        let get_file = this.read_file(target_path);
        if(get_file["error"] != "") {
            result.error = get_file.error;
            return result;
        }else{
            //Get content
            let this_content = get_file["content"];
            let non_ascii = /[^\x00-\x7E]/g
            let this_match = this_content.match(non_ascii);

            //Strip non-ascii characters
            this_content = this_content.replace(non_ascii, "");

            //Return if ASCII
            if(this_match != null) {
                result.data = `ERROR: File contains non-ASCII characters\n\n${this_content}`;
            }else{
                result.data = this_content;
            }

            //Result
            return result;
        }
    }
    files_add_folder(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.folder) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(query.path == undefined) {
                result.error = "Select path is undefined";
                return result;
            }
        }

        //Get vars
        let project_name = query.project;
        let folder_name = query.folder;
        let target_path = decodeURIComponent(query.path);

        //Check path belongs to project
        let web_source = this.paths.web_source;
        let target_project = `${web_source}${project_name}`;

        // Check if file belongs to project path
        if(!(target_path.startsWith(target_project))) {
            result.error = "Folder path does not belong to project";
            return result;
        }

        //Verify target path is allowed
        let check_path = this.validate_allowed_path(target_path);
        if(check_path["error"] != "") {
            result.error = check_path["error"];
            return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","files_adm"],
            "project":project_name
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////

        //Set folder location
        let create_folder = path.join(target_path, folder_name);
        let is_created = this.make_directory(create_folder);
        if(is_created["error"] != "") {
            result.error = is_created["error"];
        }

        //Results
        return result;
    }
    files_add_file(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.file_name) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(query.path == undefined) {
                result.error = "Select path is undefined";
                return result;
            }
        }

        //Get vars
        let project_name = query.project;
        let target_path = decodeURIComponent(query.path);
        let file_type = query.file_type;
        let file_name = query.file_name;

        //Check file type
        let file_types = [
            "blank",
            "html",
            "css",
            "api"
        ]
        if(file_types.indexOf(file_type) == -1) {
            result.error = `Invalid file type[${file_type}]`;
            return result;
        }

        //Check path belongs to project
        let web_source = this.paths.web_source;
        let target_project = path.join(web_source, project_name);

        // Check if path belongs to project path
        if(!(target_path.startsWith(target_project))) {
            result.error = "Folder path does not belong to project";
            return result;
        }

        //Verify target path is allowed
        let check_path = this.validate_allowed_path(target_path);
        if(check_path["error"] != "") {
            result.error = check_path["error"];
            return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","files_adm"],
            "project":project_name
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////

        //Set paths
        //let file_type_path = `${this.paths.server}default_file_types${s}`;
        let file_type_path = path.join(this.paths.server, "default_file_types");
        //let file_type_html = `${file_type_path}file_type.html`;
        //let file_type_css = `${file_type_path}file_type.css`;
        //let file_type_api = `${file_type_path}file_type.js`;
        let file_type_html = path.join(file_type_path, "file_type.html");
        let file_type_css = path.join(file_type_path, "file_type.css");
        let file_type_api = path.join(file_type_path, "file_type.js");

        //Set file contents
        let file_content = "";

        //Load from pre-sets
        let file_type_content = null;
        if(file_type == "html") {
            file_type_content = this.read_file(file_type_html);
            if(file_type_content["error"] != "") {
                result.error = `Unable to create file type[${file_type}]`;
                return result;
            }else{
                file_content = file_type_content.content;
            }
        }else if(file_type == "css") {
            file_type_content = this.read_file(file_type_css);
            if(file_type_content["error"] != "") {
                result.error = `Unable to create file type[${file_type}]`;
                return result;
            }else{
                file_content = file_type_content.content;
            }
        }else if(file_type == "api") {
            file_type_content = this.read_file(file_type_api);
            if(file_type_content["error"] != "") {
                result.error = `Unable to create file type[${file_type}]`;
                return result;
            }else{
                file_content = file_type_content.content;
            }
        }

        //Set file location
        //let create_file = `${target_path}${s}${file_name}`;
        let create_file = path.join(target_path, file_name);
        let is_created = this.make_file(create_file, file_content);
        if(is_created["error"] != "") {
            result.error = is_created.error;
        }

        //Result
        return result;
    }
    files_delete(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(query.path == undefined) {
                result.error = "Select path is undefined";
                return result;
            }
        }

        //Get properties
        let project_name = query.project;
        let target_path = decodeURIComponent(query.path);

        //Check path belongs to project
        let web_source = this.paths.web_source;
        let target_project = `${web_source}${project_name}`;

        // Check if file belongs to project path
        if(!(target_path.startsWith(target_project))) {
            result.error = "File path does not belong to project";
            return result;
        }

        //Check for protected files
        let check_path = this.validate_allowed_path(target_path);
        if(check_path["error"] != "") {
            result.error = check_path.error;
            return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","files_adm"],
            "project":project_name
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////        

        //Remove path separator at end of line
        if(target_path.substr(target_path.length - 1) == s) {
            target_path = target_path.substr(0, target_path.length - 1);
        }

        //Check if not allowed to delete
        let restrict_paths = this.files_restricted();
        if(restrict_paths[target_path] != undefined) {
            result.error = restrict_paths[target_path];
            return result;
        }

        //Check if path is dir or file
        let is_directory = fs.lstatSync(target_path).isDirectory()
        let is_deleted = null;
        if(is_directory == true) {
            is_deleted = this.delete_directory(target_path);
            if(is_deleted["error"] != "") {
                result.error = is_deleted["error"];
            }
        }else{
            is_deleted = this.delete_file(target_path);
            if(is_deleted["error"] != "") {
                result.error = is_deleted["error"];
            }
        }

        //Result
        return result;
    }

    //Project website mapping
    resolve_manage(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Common vars
        var environments = ["dev","qa","stage","prod"]

        //Check query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(query.action == undefined) {
                result.error = "Unknown action";
                return result;
            }else{
                if(!(query.action === "resolve_add" ||
                    query.action === "resolve_update" || 
                    query.action === "resolve_delete")) 
                {
                   result.error = "Invalid action";
                   return result;
                }
            }

            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.type) == false) {
                result.error = "Map type is invalid";
                return result;
            }
            if(this.validate_name(query.env) == false) {
                result.error = "Environment not defined";
                return result;
            }
            if(this.validate_web_path(query.url) == false) {
                result.error = "URL is invalid";
                return result;
            }
            if((query.action == "resolve_add")) {
                if(query.site != undefined) {
                    if(query.site != "" && this.validate_name(query.site) == false) {
                        result.error = "Site name is invalid";
                        return result;
                    }
                }else{
                    result.error = "Site name is not defined";
                    return result;
                }
            }
            if(query.action == "resolve_update") {
                if(query.update == undefined || query.update == "") {
                    result.error = "Update type is not defined";
                    return result;
                }else{
                    //Check update type
                    if(!(query.update === "resolve_select_project" ||
                        query.update === "resolve_select_env" || 
                        query.update === "resolve_select_site")
                    ){
                       result.error = "Invalid Environment";
                       return result;
                    }

                    //Check environment string
                    if(query.update === "resolve_select_env") {
                        if(environments.includes(query.change) == false) {
                            result.error = "Invalid Environment";
                            return result;
                        }
                    }
                }
            }
        }

        //Validate environment name
        if(!(query.type === "proxy_map" || query.type === "dns_names")) {
            result.error = "Invalid mapping type";
            return result;
        }

        //Validate environment name
        if(environments.includes(query.env) == false) {
            result.error = "Invalid Environment";
            return result;
        }

        //Get vars
        let project_name = query.project;
        let map_type = query.type;
        let map_env = query.env;
        let map_url = query.url;
        let site_name = "";
        let this_change = "";
        if((query.action == "resolve_add")) {
            site_name = query.site;
        }
        if((query.action == "resolve_update")) {
            this_change = query.change;
        }        
        if(map_type == "proxy_map") {
            map_url = (map_url + "/").replaceAll(/\/+/g,"/");
        }

        // Auth Check ///////////////

        //Define auth check
        let access={}
        access={
            "type":"global",
            "permission":["dns_adm"],
            "project":null
        }
        let api_check = this.api_access_check(access)

        //Global access is not authenticated, check project level permission
        if(api_check.api_access == false && query.action == "resolve_update") { 
            access={
                "type":"project",
                "permission":["project_adm","website_adm","website_set"],
                "project":project_name
            }
            api_check = this.api_access_check(access)
        }

        //Get result
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////        

        //Get all project data
        let all_projects = this.get_projects();
        let conf_data = {};
        if(all_projects[project_name] != undefined) {
            //Get this project conf data from all projects load
            conf_data = all_projects[project_name];
        }else{
            result.error = "Error loading configuration data";
            return result;
        }

        //Look for DNS FQDN conflicts
        if(query.action == "resolve_add") {
            for(let search_project in all_projects) {
                let this_project = all_projects[search_project];
                if(this_project[map_type] != undefined) {
                    for(let search_env in this_project[map_type]) {
                        for(let search_url in this_project[map_type][search_env]) {
                            if(search_url == map_url) {
                                result.error = `Map URL is already assigned to project[${search_project}] map_type[${map_type}] environment[${search_env}]`;
                                return result;
                            }
                        }
                    }
                }
            }
        }

        //Get config data
        if(Object.keys(conf_data).length === 0) {
            result.error = "Configuration data is empty";
            return result;
        }

        //Make sure DNS names exists
        let config_changed = false;
        if(conf_data[map_type] == undefined) {
            conf_data[map_type] = {
                "dev":{},
                "qa":{},
                "stage":{},
                "prod":{}
            }
            config_changed = true;
        }

        //Make sure DNS environment exists
        if(conf_data[map_type][map_env] == undefined) {
            conf_data[map_type][map_env] = {}
            config_changed = true;
        }

        //Add mapping to site name resolution
        switch(query.action) {
            case "resolve_add":
                if(conf_data[map_type][map_env][map_url] == undefined) {
                    conf_data[map_type][map_env][map_url] = site_name;
                    let sort_dns = this.sort_hash_array_longest_str(conf_data[map_type][map_env]);
                    conf_data[map_type][map_env] = sort_dns;
                    config_changed = true;
                }
            break;
            case "resolve_update":
                switch(query.update) {
                    case "resolve_select_project":
                        //Verify project exists
                        if(all_projects[query.change] == undefined) {
                            result.error = `Target project[${query.change}] is not found`;
                            return result;
                        }

                        //Check access
                        access={
                            "type":"project",
                            "permission":["project_adm","website_adm","website_set"],
                            "project":query.change
                        }
                        api_check = this.api_access_check(access)
                        //Return on invalid state
                        if(api_check.error != "") { return result; }
                        if(api_check.authenticated == false) { return result; }

                        //Check destination project
                        if(all_projects[query.change]) {
                            //Delete URL from current project
                            let del_query = {
                                "action":"resolve_delete",
                                "project":query.project,
                                "type":query.type,
                                "env": query.env,
                                "url": query.url
                            }
                            let del_result = this.resolve_add_update_delete(del_query);

                            //Check if user has permission to move proxy_map or dns_names
                            if(del_result.error != "") { 
                                return del_result; 
                            }else{
                                //Add URL to target project
                                let add_query = {
                                    "action":"resolve_add",
                                    "project":query.change,
                                    "type":query.type,
                                    "env": query.env,
                                    "url": query.url,
                                    "site": ""              //Set site to blank, user select after re-assign
                                }
                                let add_result = this.resolve_add_update_delete(add_query);

                                //No need to write config in this type of update, handled above
                                if(add_result.error != "") { 
                                    return add_result; 
                                }else{
                                    return result;
                                }
                            }
                        }
                    break;
                    case "resolve_select_env":
                        //Check existing environment settings
                        if(conf_data[map_type][map_env][map_url] == undefined) {
                            result.error = `Map type[${map_type}] environment[${map_env}] URL[${map_url}] is not found in configuration`;
                            return result;
                        }else{
                            //Move setting to other environment
                            let this_site = conf_data[map_type][map_env][map_url];
                            conf_data[map_type][query.change][map_url] = this_site;
                            delete conf_data[map_type][map_env][map_url];
                            config_changed = true;
                        }
                    break;
                    case "resolve_select_site":
                        if(conf_data[map_type][map_env][map_url] == undefined) {
                            result.error = "Map URL is not found in configuration";
                            return result;
                        }else{
                            conf_data[map_type][map_env][map_url] = this_change;
                            let sort_dns = this.sort_hash_array_longest_str(conf_data[map_type][map_env]);
                            conf_data[map_type][map_env] = sort_dns;
                            config_changed = true;
                        }
                    break;
                }
            break;
            case "resolve_delete":
                if(conf_data[map_type][map_env][map_url] == undefined) {
                    result.error = "Map URL does not exist configuration";
                    return result;
                }else{
                    delete conf_data[map_type][map_env][map_url];
                    config_changed = true;
                }
            break;
        }

        //Update config file
        if(config_changed == false){
            result.error = "No mapping configurations changed";
            return result;
        }else{
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Result
            return result;
        }
    }

    //////////////////////////////////////
    // Admin Functions
    //////////////////////////////////////

    //Validate user is an admin level
    admin_check() {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "admin":false,
            "data":{}
        }
        
        //Get authenticated 
        let auth_check = this.jwt_auth_user_check();
        if(auth_check.error != "") {
            result.error = auth_check.error;
            return result;
        }else{
            //Check if auth mode is 'none'
            if(auth_check.mode == "none") {
                //Set full access for auth set to none
                result.state = "OK";
                result.authenticated = true;
                result.admin = true;
            }else{
                //Check state
                result.state = auth_check.state;
                result.authenticated = auth_check.authenticated;
                result.admin = auth_check.admin;
            }

            //Return results
            return result;
        }
    }

    admin_get_server_url_mapping(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.mgmt == undefined) {
            result.error = "Management Mode parameter is invalid";
            return result;
        }
        if(query.env == undefined) {
            result.error = "Environment parameter is invalid";
            return result;
        }

        //Generate mapping
        mapping.mgmt_mode = query.mgmt;
        mapping.set_environment(query.env);
        mapping.map_generate();

        //Check error
        if(mapping.error != "") {
            result.error = mapping.error;
            return result;
        }
        
        //Get data
        result.error = mapping.error;
        result.data["web_configs"] = mapping.web_configs;
        result.data["web_mapping"] = mapping.web_mapping;

        //Return
        return result;
    }
    admin_test_server_url_mapping(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.mgmt == undefined) {
            result.error = "Management Mode parameter is invalid";
            return result;
        }
        if(query.env == undefined) {
            result.error = "Environment parameter is invalid";
            return result;
        }
        if(query.url == undefined) {
            result.error = "URL parameter is invalid";
            return result;
        }

        //Test URL match
        mapping.mgmt_mode = query.mgmt;
        mapping.set_environment(query.env);
        mapping.map_generate();
        result.data = mapping.match_url(query.url);

        //Get results
        result.error = mapping.error;

        //Return
        return result;
    }

    admin_users_get() {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Get users list
        let get_users = this.jwt_auth.users_get();
        if(get_users.error != "") {
            result.error = get_users.error;
        }else{
            result.data = get_users.data;
        }

        //Return
        return result;
    }
    admin_user_groups_get(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is not defined";
            return result;
        }

        //Get all groups
        let get_groups = this.jwt_auth.groups_get(); 
        if(get_groups.error != "") {
            result.error = get_groups.error;
        }else{
            result.data.all_groups = get_groups.groups;
        }

        //Get users list
        let get_users = this.jwt_auth.user_groups_get(query.username);
        if(get_users.error != "") {
            result.error = get_users.error;
        }else{
            result.data.user_memberof = get_users.groups;
        }

        //Return
        return result;
    }

    admin_user_add(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }
        if(query.password == undefined) {
            result.error = "Password is invalid";
            return result;
        }
        if(query.name == undefined) {
            result.error = "Name is invalid";
            return result;
        }
        if(query.email == undefined) {
            result.error = "Email is invalid";
            return result;
        }

        //Get all groups
        let add_user = this.jwt_auth.user_add(query.username, query.password, query.name, query.email); 
        if(add_user.error != "") {
            result.error = add_user.error;
        }

        //Return result
        return result;
    }
    admin_user_delete(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }

        //Get all groups
        let del_user = this.jwt_auth.user_delete(query.username); 
        if(del_user.error != "") {
            result.error = del_user.error;
        }

        //Return result
        return result;
    }
    admin_user_unlock(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }

        //Get all groups
        let user_state = this.jwt_auth.user_unlock(query.username); 
        if(user_state.error != "") {
            result.error = user_state.error;
        }

        //Return result
        return result;
    }
    admin_user_state(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }
        if(query.state == undefined) {
            result.error = "State is invalid";
            return result;
        }
        
        //Get all groups
        let user_state = this.jwt_auth.user_state_set(query.username, query.state); 
        if(user_state.error != "") {
            result.error = user_state.error;
        }

        //Return result
        return result;
    }
    admin_user_group_member(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.group == undefined) {
            result.error = "Group is invalid";
            return result;
        }
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }
        if(query.state == undefined) {
            result.error = "State is invalid";
            return result;
        }
        
        //Get all groups
        let user_group = this.jwt_auth.group_set_user(query.group, query.username, query.state); 
        if(user_group.error != "") {
            result.error = user_group.error;
        }

        //Return result
        return result;
    }
    admin_user_details(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }
        if(query.name == undefined) {
            result.error = "User name is invalid";
            return result;
        }
        if(query.email == undefined) {
            result.error = "User email is invalid";
            return result;
        }
        
        //Get all groups
        let user_state = this.jwt_auth.user_state_details(query.username, query.name, query.email); 
        if(user_state.error != "") {
            result.error = user_state.error;
        }

        //Return result
        return result;
    }
    admin_user_password_set(query) {
        //Set results
        let result = this.admin_check();

        //Check state
        if(result.error != "" || result.authenticated == false) {
            return result;
        }else if(result.admin == false) {
            result.error = "Access Denied";
            return result;
        }

        //Validate
        if(query.username == undefined) {
            result.error = "Username is invalid";
            return result;
        }
        if(query.password == undefined) {
            result.error = "Password is invalid";
            return result;
        }
        
        //Get all groups
        let user_state = this.jwt_auth.user_password_set(query.username, query.password); 
        if(user_state.error != "") {
            result.error = user_state.error;
        }

        //Return result
        return result;
    }
}

//Export modules
module.exports = manage_server;