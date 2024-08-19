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
const s = path.sep;

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

    //Construct class
    constructor(cookie=null, user_agent=null, user_ip=null) { 
        //Start class initialization
        this.define_paths();

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
            "Template Admin"
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
            required_groups.push(`project::${project}::DNS Admin`);
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
                            this.jwt_auth.group_set_authorized(group,"dns_adm",true);
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
                        if(group.endsWith("::DNS Admin")) {
                            this.jwt_auth.group_set_authorized(group,"dns_adm",true);
                        }
                        if(group.endsWith("::Read Only")) {
                            this.jwt_auth.group_set_authorized(group,"files_read",true);
                            this.jwt_auth.group_set_authorized(group,"read_only",true);
                        }
                    }else{
                        switch(group) {
                            case "Project Admin":       this.jwt_auth.group_set_authorized(group,"project_adm",true); break;
                            case "Template Admin":      this.jwt_auth.group_set_authorized(group,"template_adm",true); break;
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
        this.paths["web_source"] = path.join(root,"web_source",path.sep);
        this.paths["web_templates"] = path.join(root,"web_templates",path.sep);    
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
        let pattern = /[^a-zA-Z0-9\.\:\_\-\/]/g;
        let found = str.match(pattern);
        if(found == null) {
            return true;
        }else{
            return false;
        }
    }
    validate_map_path(str) {
        str = str.trim();
        let pattern = /[^a-zA-Z0-9\.\:\_\-\/]/g;
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
        let pattern = `${s}..`;
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

        console.log(new_hash_array)

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
    load_template_conf(template_name=null) {
        //Check arguments
        if(template_name == null) { return {"error":"Template name is 'null'"}}

        //Check if directory
        let template_conf = path.join(this.paths.web_templates, template_name, "template_conf.json");
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
        let parse_dir = dir.split(s);
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

            console.log(prop_id)

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
                                case "admins": case "Project Admin": case "Template Admin":
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
        //Variables
        let web_source = this.paths.web_source;
        let projects = {}
        
        //Loop folders in web path
        let dir_list = fs.readdirSync(web_source);
        for(var target in dir_list) {
            //Get project name from folder name
            let project = dir_list[target];
            let conf_load = this.load_project_conf(project);
            let conf_data = {};
            if(conf_load.error != "") {
                continue;
            }else{
                conf_data = conf_load.data;
            }

            //Populate conf data
            if(Object.keys(conf_data).length > 0) {
                projects[project] = conf_data;
            }
        }

        //Return collections
        return projects;
    }
    get_templates() {
        //Variables
        let web_templates = this.paths.web_templates;
        let templates = {}
        
        //Loop folders in template path
        let dir_list = fs.readdirSync(web_templates);
        for(var target in dir_list) {
            //Get template name from folder name
            let template = dir_list[target];
            let conf_load = this.load_template_conf(template);
            let conf_data = {};
            if(conf_load.error != "") {
                continue;
            }else{
                conf_data = conf_load.data;
            }

            //Populate conf data
            if(Object.keys(conf_data).length > 0) {
                templates[template] = conf_data;
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

        //Load server configs
        let server_config = this.load_server_conf();
        let all_projects = this.get_projects();
        let files_restricted = this.files_restricted();

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
        }else{
            //Authenticated user
            result.data["server"] = server_config;
            result.data["paths"] = this.paths;
            result.data["protected_paths"] = files_restricted;
            result.data["projects"] = {}

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

                    //Check user allowed access to project
                    if(project_auth[project] == undefined) {
                        result.data["projects"][project] = this_project
                        result.data["projects"][project]["state"] = "disabled";
                    }else{
                        result.data["projects"][project] = this_project;
                    }
                }
            }

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
            "enabled":false,
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
    project_new(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Validate
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_desc(query.desc) == false) {
                result.error = "Project description is invalid";
                return result;
            }
        }
        if(query.project == "devui") {
            result.error = "Project name is reserved by system";
            return result;
        }

        //Get vars
        let project_name = query.project;
        let project_desc = query.desc;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"global",
            "permission":["project_adm"],
            "project":null
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        //Get auth mode
        let auth_mode = api_check.auth_check.mode;
        let is_admin = api_check.auth_check.admin;
        let this_user = api_check.auth_check.username;

        // Do command ///////////////

        //Check for existing folder
        let web_source = this.paths.web_source;
        let project_folder = `${web_source}${project_name}`;
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
            let conf_file = `${web_source}${project_name}${s}config.json`;
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
            if(auth_mode == "auth") {
                if(is_admin == false) {
                    this.class_init(); // Add groups required
                    let this_group_name = `project::${project_name}::Admin`;
                    this.jwt_auth.group_set_user(this_group_name, this_user, true)
                }
            }

            //Return result
            return result;
        }
    }
    project_delete(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Validate
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name parameter is invalid";
                return result;
            }
        }

        //Check query parameters
        let project_name = query.project;
        
        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm"],
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

        //Check if file exists
        let web_source = this.paths.web_source;
        let target_project = `${web_source}${project_name}`;
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
    project_set_property(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Validate query parameters
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.property) == false) {
                result.error = "Property identifier is invalid";
                return result;
            }
        }

        //Get values
        let project_name = query.project;
        let property = query.property;
        let value = query.value;

        //Validate property values for checkboxes
        switch(property) {
            case "project_desc": 
                if(this.validate_desc(value) == false) {
                    result.error = "Project Description is invalid";
                    return result;
                }
            break;
            case "project_enabled": 
                if(!(value == true || value == false)) {
                    result.error = `Invalid checkbox state[${value}]`;
                    return result;
                }
            break;
            default:
                result.error = `Invalid property[${property}]`;
                return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm"],
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
    }
    project_config_fix(query=null) {

        //
        // Check the configuration file only, doesn't validate to files and folders
        // 
        //

        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Validate
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            if(this.validate_name(query.project) == false) {
                result.error = "Project name parameter is invalid";
                return result;
            }
        }

        //Check query parameters
        let project_name = query.project;
        
        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm"],
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

        //Get project config
        let conf_load = this.load_project_conf(project_name);
        let conf_data = {}
        if(conf_load.error != "") {
            result.error = "Cannot load configuration";
            return result;
        }else{
            //Get config data
            conf_data = conf_load.data;
            
            //Validate and fix configuration data ///////////////////

            //Root level config settings
            if(conf_data.project_desc == undefined) {
                conf_data.project_desc = "";
            }
            if(conf_data.enabled == undefined || typeof(conf_data.enabled) != "boolean") {
                conf_data.enabled = false;
            }

            //Check proxy map
            if(conf_data.proxy_map == undefined || typeof(conf_data.proxy_map) != "object") {
                conf_data.proxy_map = {
                    "dev": {},
                    "qa": {},
                    "stage": {},
                    "prod": {}
                }
            }else{
                if(conf_data.proxy_map.dev == undefined || typeof(conf_data.proxy_map.dev) != "object") {
                    conf_data.proxy_map.dev = {}
                }
                if(conf_data.proxy_map.qa == undefined || typeof(conf_data.proxy_map.qa) != "object") {
                    conf_data.proxy_map.qa = {}
                }
                if(conf_data.proxy_map.stage == undefined || typeof(conf_data.proxy_map.stage) != "object") {
                    conf_data.proxy_map.stage = {}
                }
                if(conf_data.proxy_map.prod == undefined || typeof(conf_data.proxy_map.prod) != "object") {
                    conf_data.proxy_map.prod = {}
                }
            }

            //Check DNS map
            if(conf_data.dns_names == undefined || typeof(conf_data.dns_names) != "object") {
                conf_data.dns_names = {
                    "dev": {},
                    "qa": {},
                    "stage": {},
                    "prod": {}
                }
            }else{
                if(conf_data.dns_names.dev == undefined || typeof(conf_data.dns_names.dev) != "object") {
                    conf_data.dns_names.dev = {}
                }
                if(conf_data.dns_names.qa == undefined || typeof(conf_data.dns_names.qa) != "object") {
                    conf_data.dns_names.qa = {}
                }
                if(conf_data.dns_names.stage == undefined || typeof(conf_data.dns_names.stage) != "object") {
                    conf_data.dns_names.stage = {}
                }
                if(conf_data.dns_names.prod == undefined || typeof(conf_data.dns_names.prod) != "object") {
                    conf_data.dns_names.prod = {}
                }
            }

            //Validate any website configurations
            if(conf_data.websites == undefined) {
                conf_data.websites = {}
            }else{
                for(let website in conf_data.websites) {
                    //Check website SSL redirect
                    if(conf_data.websites[website]["ssl_redirect"] == undefined || typeof(conf_data.websites[website]["ssl_redirect"]) != "boolean") {
                        conf_data.websites[website]["ssl_redirect"] = true;
                    }

                    //Check maintenance mode
                    if(conf_data.websites[website]["maintenance"] == undefined || typeof(conf_data.websites[website]["maintenance"]) != "object") {
                        conf_data.websites[website]["maintenance"] = {
                            "dev": false,
                            "qa": false,
                            "stage": false,
                            "prod": false
                        }
                    }else{
                        if(conf_data.websites[website]["maintenance"]["dev"] == undefined || typeof(conf_data.websites[website]["maintenance"]["dev"]) != "boolean") {
                            conf_data.websites[website]["maintenance"]["dev"] = false;
                        }
                        if(conf_data.websites[website]["maintenance"]["qa"] == undefined || typeof(conf_data.websites[website]["maintenance"]["qa"]) != "boolean") {
                            conf_data.websites[website]["maintenance"]["qa"] = false;
                        }
                        if(conf_data.websites[website]["maintenance"]["stage"] == undefined || typeof(conf_data.websites[website]["maintenance"]["stage"]) != "boolean") {
                            conf_data.websites[website]["maintenance"]["stage"] = false;
                        }
                        if(conf_data.websites[website]["maintenance"]["prod"] == undefined || typeof(conf_data.websites[website]["maintenance"]["prod"]) != "boolean") {
                            conf_data.websites[website]["maintenance"]["prod"] = false;
                        }
                    }

                    //Check default maintenance page
                    if(conf_data.websites[website]["maintenance_page"] == undefined) {
                        conf_data.websites[website]["maintenance_page"] = "";
                    }

                    //Check default maintenance page
                    if(conf_data.websites[website]["default_doc"] == undefined) {
                        conf_data.websites[website]["default_doc"] = "";
                    }
    
                    //Check error pages
                    if(conf_data.websites[website]["default_errors"] == undefined || typeof(conf_data.websites[website]["default_errors"]) != "object") {
                        conf_data.websites[website]["default_errors"] = {
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
                        if(conf_data.websites[website]["default_errors"]["401"] == undefined) {
                            conf_data.websites[website]["default_errors"]["401"] = "";
                        }
                        if(conf_data.websites[website]["default_errors"]["403"] == undefined) {
                            conf_data.websites[website]["default_errors"]["403"] = "";
                        }
                        */
                        if(conf_data.websites[website]["default_errors"]["404"] == undefined) {
                            conf_data.websites[website]["default_errors"]["404"] = "";
                        }
                        /*
                        if(conf_data.websites[website]["default_errors"]["405"] == undefined) {
                            conf_data.websites[website]["default_errors"]["405"] = "";
                        }
                        if(conf_data.websites[website]["default_errors"]["408"] == undefined) {
                            conf_data.websites[website]["default_errors"]["408"] = "";
                        }
                        if(conf_data.websites[website]["default_errors"]["414"] == undefined) {
                            conf_data.websites[website]["default_errors"]["414"] = "";
                        }
                        */
                        if(conf_data.websites[website]["default_errors"]["500"] == undefined) {
                            conf_data.websites[website]["default_errors"]["500"] = "";
                        }
                    }

                    //Check sections exists
                    if(conf_data.websites[website]["apis_fixed_path"] == undefined) {
                        conf_data.websites[website]["apis_fixed_path"] = {}
                    }
                    if(conf_data.websites[website]["apis_dynamic_path"] == undefined) {
                        conf_data.websites[website]["apis_dynamic_path"] = {}
                    }
                    if(conf_data.websites[website]["path_static"] == undefined) {
                        conf_data.websites[website]["path_static"] = {}
                    }
                    if(conf_data.websites[website]["path_static_server_exec"] == undefined) {
                        conf_data.websites[website]["path_static_server_exec"] = {}
                    }
                    if(conf_data.websites[website]["sub_map"] == undefined) {
                        conf_data.websites[website]["sub_map"] = {}
                    }
                }
            }

            //Validate configuration aligns with folders and files ///////////////////


            //Align old config to new config structure ///////////////////

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

            //Return result
            return result;
        }
    }
    project_config_validate_websites(project=null, website=null) {

    }
    project_config_validate_error_pages(project=null, website=null) {

    }
    project_config_validate_maintenance_page(project=null, website=null) {

    }

    //Manage project tempaltes
    template_list() {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Auth Check ///////////////

        //Define auth check
        let api_check = this.api_access_check()
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////

        //Get templates list
        result.data = this.get_templates();
        return result;
    }
    template_create(query=null) {
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
            if(this.validate_name(query.template) == false) {
                result.error = "Template name is invalid";
                return result;
            }
            if(this.validate_desc(query.desc) == false) {
                result.error = "Template description is invalid";
                return result;
            }
        }

        //Set arguments
        let project_name = query.project;
        let template_name = query.template;
        let template_desc = query.desc;
        let template_sites = query.sites;

        //Validate template sites selected
        if(template_sites.length == 0) {
            result.error = "Site Select is required, no sites selected";
            return result;
        }
        for(let i in template_sites) {
            let this_site = template_sites[i];
            if(this.validate_name(this_site) == false) {
                result.error = `Site Selected [${this_site}] has invalid characters`;
                return result;
            }
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"global",
            "permission":["template_adm"],
            "project":null
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
        let source_path = `${this.paths.web_source}${project_name}`;
        let template_path = `${this.paths.web_templates}${template_name}`;

        //Validate template doesn't exist already
        let if_dir_exists = fs.existsSync(template_path);
        if(if_dir_exists == true) {
            result.error = `Folder already exists: '${dir}'`;
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
        for(let i in template_sites) {
            let this_site = template_sites[i];

            //Validate the site exists in the project config
            if(conf_data.websites[this_site] == undefined) {
                result.error = `Site[${this_site}] not found in project[${project_name}]`;
                return result;
            }

            //Validate the site folder exists in project folder
            let source_site_path = `${source_path}${s}${this_site}`;
            let if_dir_exists = fs.existsSync(source_site_path);
            if(if_dir_exists == false) {
                result.error = `Project site folder doesn't exist: '${source_site_path}'`;
                return result;
            }
        }

        //Generate templete configuration file
        let template_conf = {
            "description":template_desc,
            "websites":{}
        }

        //Create the template folders
        let is_created = this.make_directory(template_path);
        if(is_created["error"] != "") {
            result.error = is_created["error"];
            return result;
        }
        for(let i in template_sites) {
            //Get site name
            let this_site = template_sites[i];

            //Copy folder path
            let source_site_path = `${source_path}${s}${this_site}`;
            let template_site_path = `${template_path}${s}${this_site}`;
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
        let template_conf_file = `${template_path}${s}template_conf.json`
        template_conf = JSON.stringify(template_conf,null,"\t")
        
        //Write config
        let if_mkfile = this.make_file(template_conf_file, template_conf);
        if(if_mkfile.error != "") {
            result.error = if_mkfile.error;
        }

        //Return result
        return result;
    }
    template_delete(query=null) {
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
            if(this.validate_name(query.template) == false) {
                result.error = "Template name is invalid";
                return result;
            }
        }

        //Get vars
        let template_name = query.template;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"global",
            "permission":["template_adm"],
            "project":null
        }
        let api_check = this.api_access_check(access)
        result.error = api_check.error;
        result.state = api_check.state;
        result.authenticated = api_check.authenticated;

        //Return on invalid state
        if(result.error != "") { return result; }
        if(result.authenticated == false) { return result; }

        // Do command ///////////////        

        //Define template path
        let template_dir = `${this.paths.web_templates}${template_name}`;

        //Delete directory
        let is_deleted = this.delete_directory(template_dir);
        if(is_deleted["error"] != "") {
            result.error = is_deleted["error"];
        }

        //Return result
        return result;
    }

    //Manage site policy
    website_new(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        // Validate /////////////////

        //Check query parameters
        let target_name = "";
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            //Validate common parameters
            if(this.validate_name(query.type) == false) {
                result.error = "Request type is invalid";
                return result;
            }
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }

            //Validate site or template names
            switch(query.type) {
                case "empty": case "default":
                    if(this.validate_name(query.site) == false) {
                        result.error = "Site name is invalid";
                        return result;
                    }
                    target_name = query.site;
                break;
                case "template":
                    if(this.validate_name(query.template) == false) {
                        result.error = "Template name is invalid";
                        return result;
                    }
                    target_name = query.template;
                break;
                default:
                    result.error = "Invalid request type";
                    return result;
            }
        }

        //Get vars
        let req_type = query.type;
        let project_name = query.project;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["website_adm"],
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

        //Check if websites exists
        if(conf_data.websites == undefined) {
            conf_data.websites = {};
        }

        //Handle request type
        switch(req_type) {
            case "empty":
                return this.website_new_empty(project_name, target_name, conf_data, result);
            break;
            case "default":
                return this.website_new_default(project_name, target_name, conf_data, result);
            break;
            case "template":
                return this.website_new_from_template(project_name, target_name, conf_data, result);
            break;
            default:
                result.error = "Invalid type";
                return result;
        }
    }
    website_new_empty(project_name, site_name, conf_data, result) {
        //Check if site already exists
        if(conf_data.websites.site_name != undefined) {
            result.error = `Site name[${site_name}] already exists`;
            return result;
        }

        //Set target folder
        let new_site_folder = `${this.paths.web_source}${project_name}${s}${site_name}`;

        //Create site directory
        let is_created = this.make_directory(new_site_folder);
        if(is_created.error != "") {
            result.error = is_created.error;
            return result;
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
            "default_doc": "",
            "default_errors": {
                "404":"",
                "500":""
            },
            "apis_fixed_path": {},
            "apis_dynamic_path": {},
            "path_static": {},
            "path_static_server_exec": {}
        }

        //Add to config
        conf_data.websites[site_name] = new_conf;

        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Return result
        return result;
    }
    website_new_default(project_name, site_name, conf_data, result) {
        //Check if site already exists
        if(conf_data.websites.site_name != undefined) {
            result.error = `Site name[${site_name}] already exists`;
            return result;
        }

        //Set source folder
        let default_new_site = `${this.paths.server}default_new_site`

        //Set target folder
        let new_site_folder = `${this.paths.web_source}${project_name}${s}${site_name}`;

        //Clone directory files
        let is_copied = this.copy_directory(default_new_site, new_site_folder);
        if(is_copied["error"] != "") {
            result.error = is_copied["error"];
            return result;
        }

        //New config
        let new_conf = {}

        //Create blank conf
        new_conf = {
            "ssl_redirect": true,
            "maintenance": {
                "dev": false,
                "qa": false,
                "stage": false,
                "prod": false
            },
            "maintenance_page": "maintenance.html",
            "default_doc": "index.html",
            "default_errors": {
                "404":"404.html",
                "500":"500.html"
            },
            "apis_fixed_path": {},
            "apis_dynamic_path": {},
            "path_static": {
                "/": `/${site_name}/`
            },
            "path_static_server_exec": {},
            "sub_map": {}
        }

        //Add to config
        conf_data.websites[site_name] = new_conf;
        
        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Return result
        return result;
    }
    website_new_from_template(project_name, template, conf_data, result) {
        //Get template data
        let conf_load = this.load_template_conf(template);
        let template_conf = {};
        if(conf_load["error"] != "") {
            result.error = "Cannot load template configuration data";
            return result;
        }
        template_conf = conf_load.data;
        if(Object.keys(template_conf).length === 0) {
            result.error = "Templae configuration data is empty";
            return result;
        }

        //Validate template websites
        if(template_conf.websites == undefined) {
            result.error = "Template configuration data is missing websites";
            return result;
        }

        //Define the root folder paths for templates and web source
        let web_template_path = this.paths.web_templates;
        let web_source_path = this.paths.web_source;

        //Define template and web source root paths
        let this_template_path = `${web_template_path}${template}${s}`;
        let this_project_path = `${web_source_path}${project_name}${s}`;

        //Validate if site folder or configuration exists
        for(let site in template_conf.websites) {
            //Check if project website configuration exists
            if(conf_data.websites[site] != undefined) {
                result.error = `Project configuration site[${site}] already exists`;
                return result;
            }

            //Define site folder target
            let this_project_site_path = `${this_project_path}${site}`;

            //Check if website folder exists already in the project directory
            let if_dir_exists = fs.existsSync(this_project_site_path);
            if(if_dir_exists == true) {
                result.error = `Project site folder already exist: '${this_project_site_path}'`;
                return result;
            }
        }

        //Add template website to the project
        for(let site in template_conf.websites) {
            //Define folder targets
            let this_template_site_path = `${this_template_path}${site}`;
            let this_project_site_path = `${this_project_path}${site}`;

            let is_copied = this.copy_directory(this_template_site_path, this_project_site_path);
            if(is_copied["error"] != "") {
                result.error = is_copied["error"];
                return result;
            }

            //Copy site data
            let array_copy = template_conf.websites[site];
            array_copy = JSON.stringify(array_copy);
            conf_data.websites[site] = JSON.parse(array_copy);
        }

        //Sort array
        conf_data.websites = this.sort_hash_array(conf_data.websites);

        //Update config file
        let is_updated = this.update_project_conf_file(project_name, conf_data);
        if(is_updated.error != "") {
            result.error = is_updated.error;
        }

        //Return results
        return result;
    }
    website_delete(query=null) {
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
            if(this.validate_name(query.site) == false) {
                result.error = "Site name is invalid";
                return result;
            }
        }

        //Get vars
        let project_name = query.project;
        let site_name = query.site;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["website_adm"],
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

            //Check for project site
            if(conf_data.websites[site_name] == undefined) {
                result.error = `Site name[${site_name}] is not defined`;
                return result;
            }

            //Try and delete source folder first
            let web_source = this.paths.web_source;
            let site_folder = `${web_source}${project_name}${s}${site_name}`;
            let try_delete = this.delete_directory(site_folder);
            if(try_delete["error"] != "") {
                result.error = try_delete["error"];
                return result;
            }

            //Remove the site configuration
            delete conf_data.websites[site_name];

            //Sort array
            conf_data.websites = this.sort_hash_array(conf_data.websites);

            //Clean up DNS linking for deleted sites
            if(conf_data.dns_names != undefined) {
                //Set DNS resolve to blank for removed sites
                if(conf_data.dns_names.dev != undefined) {
                    for(let dns in conf_data.dns_names.dev) {
                        let this_site = conf_data.dns_names.dev[dns];
                        if(conf_data.websites[this_site] == undefined) {
                            conf_data.dns_names.dev[dns] = "";
                        }
                    }
                }
                if(conf_data.dns_names.prod != undefined) {
                    for(let dns in conf_data.dns_names.prod) {
                        let this_site = conf_data.dns_names.prod[dns];
                        if(conf_data.websites[this_site] == undefined) {
                            conf_data.dns_names.prod[dns] = "";
                        }
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
    }
    website_rename_clone(query=null) {
        //Set configs
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "data":{}
        }

        console.log(query)
        
        // Validate /////////////////

        //Check query parameters
        let target_name = "";
        if(query == null) {
            result.error = "Missing parameters";
            return result;
        }else{
            //Validate common parameters
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.curr_site) == false) {
                result.error = "Current site name is invalid";
                return result;
            }
            if(this.validate_name(query.new_site) == false) {
                result.error = "New site name is invalid";
                return result;
            }
        }

        //Get values
        let project_name = query.project;
        let curr_site_name = query.curr_site;
        let new_site_name = query.new_site;

        //Check is rename to the same name
        if(curr_site_name == new_site_name) {
            result.error = "The current site name and new site name are the same";
            return result;
        }

        //Action
        let action = "";
        switch(query.action) {
            case "website_rename":
                action = "rename";
            break;
            case "website_clone":
                action = "clone";
            break;
            default:
                result.error = "Invalid paramter, rename or clone required";
                return result;
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["website_adm"],
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

            //Check for project site
            if(conf_data.websites[curr_site_name] == undefined) {
                result.error = `Site name[${curr_site_name}] is not defined`;
                return result;
            }

            //Try and rename source folder first
            let web_source = this.paths.web_source;
            let curr_site_folder = `${web_source}${project_name}${s}${curr_site_name}`;
            let new_site_folder = `${web_source}${project_name}${s}${new_site_name}`;
            if(action == "rename") {
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
            if(action == "rename") {
                delete conf_data.websites[curr_site_name];
            }

            //Update path mapping
            let search_str = `/${curr_site_name}`;
            let replace_str = `/${new_site_name}`;
            for(let cfg in conf_data.websites[new_site_name]["apis_fixed_path"]) {
                let cfg_set = conf_data.websites[new_site_name]["apis_fixed_path"][cfg];
                let new_set = cfg_set.replace(search_str, replace_str);
                conf_data.websites[new_site_name]["apis_fixed_path"][cfg] = new_set;
            }
            for(let cfg in conf_data.websites[new_site_name]["apis_dynamic_path"]) {
                let cfg_set = conf_data.websites[new_site_name]["apis_dynamic_path"][cfg];
                let new_set = cfg_set.replace(search_str, replace_str);
                conf_data.websites[new_site_name]["apis_dynamic_path"][cfg] = new_set;
            }
            for(let cfg in conf_data.websites[new_site_name]["path_static"]) {
                let cfg_set = conf_data.websites[new_site_name]["path_static"][cfg];
                let new_set = cfg_set.replace(search_str, replace_str);
                conf_data.websites[new_site_name]["path_static"][cfg] = new_set;
            }
            for(let cfg in conf_data.websites[new_site_name]["path_static_server_exec"]) {
                let cfg_set = conf_data.websites[new_site_name]["path_static_server_exec"][cfg];
                let new_set = cfg_set.replace(search_str, replace_str);
                conf_data.websites[new_site_name]["path_static_server_exec"][cfg] = new_set;
            }

            //Sort websites
            conf_data.websites = this.sort_hash_array(conf_data.websites);

            //Update DNS linking for rename site
            if(action == "rename") {
                if(conf_data.dns_names != undefined) {
                    //Set DNS resolve to blank for removed sites
                    if(conf_data.dns_names.dev != undefined) {
                        for(let dns in conf_data.dns_names.dev) {
                            let this_site = conf_data.dns_names.dev[dns];
                            if(this_site == curr_site_name) {
                                conf_data.dns_names.dev[dns] = new_site_name;
                            }
                        }
                    }
                    if(conf_data.dns_names.prod != undefined) {
                        for(let dns in conf_data.dns_names.prod) {
                            let this_site = conf_data.dns_names.prod[dns];
                            if(this_site == curr_site_name) {
                                conf_data.dns_names.prod[dns] = new_site_name;
                            }
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
    }
    website_set_property(query=null) {
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
            if(this.validate_name(query.site) == false) {
                result.error = "Site name is invalid";
                return result;
            }
            if(this.validate_name(query.property) == false) {
                result.error = "Property name is invalid";
                return result;
            }
            if(query.property == "maintenance_enabled") {
                if(this.validate_name(query.env) == false) {
                    result.error = "Environment name is invalid";
                    return result;
                }
            }
            if(query.value == undefined) {
                result.error = "Value is invalid";
                return result;
            }
        }

        //Get properties
        let project_name = query.project;
        let site_name = query.site;
        let property = query.property;
        let value = query.value;

        //Get environment (maintenance mode)
        let env = "";
        if(query.property == "maintenance_enabled") {
            env = query.env;
        }

        //Validate property
        if(!(property === "ssl_redirect" ||
             property === "maintenance_enabled" ||
             property === "maintenance_page" ||
             property === "default_doc" ||
             property === "404_doc" ||
             property === "500_doc")) {
            result.error = `Invalid property[${property}]`;
            return result;
        }

        //Validate value
        if(property === "ssl_redirect") {
            if(!(value == true || value == false)) {
                result.error = `Invalid checkbox state[${value}]`;
                return result;
            }
        }else if(property === "maintenance_enabled") {
            if(env != "dev" && env != "qa" && env != "stage" && env != "prod") {
                result.error = `Invalid maintenance checkbox environment[${env}]`;
                return result;
            }
            if(!(value == true || value == false)) {
                result.error = `Invalid checkbox state[${value}]`;
                return result;
            }
        }else{
            //Validate value has a file extension
            if(!(path.extname(value) == ".html" || path.extname(value) == ".js")) {
                result.error = `Invalid file extension[${path.extname(value)}]`;
                return result;
            }

            //Validate file name
            if(this.validate_name(value) == false) {
                result.error = `Filename contains invalid charaters[${value}]`;
                return result;
            }
        }

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm", "website_adm", "website_set"],
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
            if(conf_data["websites"][site_name] == undefined) {
                conf_data["websites"][site_name] = {}
            }
            if(conf_data["websites"][site_name]["default_errors"] == undefined) {
                conf_data["websites"][site_name]["default_errors"] = {}
            }

            //Update website state
            switch(property) {
                case "ssl_redirect":
                    conf_data["websites"][site_name]["ssl_redirect"] = value;
                break;
                case "maintenance_enabled":
                    conf_data["websites"][site_name]["maintenance"][env] = value;
                break;
                case "maintenance_page":
                    conf_data["websites"][site_name]["maintenance_page"] = value;
                break;
                case "default_doc":
                    conf_data["websites"][site_name]["default_doc"] = value;
                break;
                case "404_doc":
                    conf_data["websites"][site_name]["default_errors"]["404"] = value;
                break;
                case "500_doc":
                    conf_data["websites"][site_name]["default_errors"]["500"] = value;
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
    website_path_mapping_add(query=null) {
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
            //Validate query type
            if(query.type == undefined) {
                result.error = "Parameter missing";
                return result;
            }
            if(!(query.type === "apis_fixed_path" ||
                query.type === "apis_dynamic_path" ||
                query.type === "path_static" ||
                query.type === "path_static_server_exec" ||
                query.type === "sub_map"
            )) {
                result.error = `Invalid type[${query.type}]`;
                return result;
            }

            //Validate common parameters
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.site) == false) {
                result.error = "Site name is invalid";
                return result;
            }
            if(this.validate_web_path(query.web_path) == false) {
                result.error = "Web path has invalid charaters";
                return result;
            }
            if(query.type == "sub_map") {
                if(this.validate_name(query.map_path) == false) {
                    result.error = "Map website has invalid charaters";
                    return result;
                }
            }else{
                if(this.validate_map_path(query.map_path) == false) {
                    result.error = "Map path has invalid charaters";
                    return result;
                }
            }
        }

        //Get vars
        let project_name = query.project;
        let site_name = query.site;
        let map_type = query.type;
        let web_path = decodeURIComponent(query.web_path);
        let map_path = decodeURIComponent(query.map_path);

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","website_adm","website_set"],
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

        //Make sure beginning and training slash are present
        web_path = this.format_path(web_path);
        if(map_type != "sub_map") {
            map_path = this.format_path(map_path);
        }

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
            if(conf_data["websites"][site_name] == undefined) {
                result.error = `Error accessing site name[${site_name}] in configuration`;
                return result;
            }
            let this_site = conf_data["websites"][site_name]
            
            //Add any missing sections
            if(this_site[map_type] == undefined) {
                conf_data["websites"][site_name][map_type] = {}
            }

            //Check for conflicts
            for(let this_web_path in conf_data["websites"][site_name][map_type]) {
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

            this_config = conf_data["websites"][site_name][map_type];
            this_config[web_path] = map_path;
            sort_config = this.sort_hash_array_longest_str(this_config);
            conf_data["websites"][site_name][map_type] = sort_config;

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Return result
            return result;
        }
    }
    website_path_mapping_delete(query=null) {
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
            //Validate common parameters
            if(this.validate_name(query.project) == false) {
                result.error = "Project name is invalid";
                return result;
            }
            if(this.validate_name(query.site) == false) {
                result.error = "Site name is invalid";
                return result;
            }
            if(this.validate_web_path(query.web_path) == false) {
                result.error = "Web path has invalid charaters";
                return result;
            }
            if(query.type == undefined) {
                result.error = "Parameter missing";
                return result;
            }

            //Validate types
            if(!(query.type === "apis_fixed_path" ||
                query.type === "apis_dynamic_path" ||
                query.type === "path_static" ||
                query.type === "path_static_server_exec" ||
                query.type === "sub_map")
            ) {
                result.error = `Invalid type[${query.type}]`;
                return result;
            }
        }

        //Get vars
        let project_name = query.project;
        let site_name = query.site;
        let map_type = query.type;
        let web_path = decodeURIComponent(query.web_path);

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","website_adm","website_set"],
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
            if(conf_data["websites"][site_name] == undefined) {
                result.error = `Error accessing site name[${site_name}] in configuration`;
                return result;
            }
            if(conf_data["websites"][site_name][map_type] == undefined) {
                result.error = `Error accessing site name[${site_name}] map_type[${map_type}] in configuration`;
                return result;
            }

            //Delete the item
            delete conf_data["websites"][site_name][map_type][web_path];

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

        //Format the 
        function format_map_path(website, map_path) {
            //Replace path separator (Windows OS)
            if(s == "\\") {
                let pattern = "/";
                map_path = map_path.replace(new RegExp(pattern, "g"), s);
            }

            //Remove leading slash and end slashes
            if(map_path.substr(0,1) == s) {
                map_path = map_path.replace(`${s}${website}`, "");
            }else{
                map_path = map_path.replace(`${website}`, "");
            }
            if(map_path.substr(map_path.length - 1) == s) {
                map_path = map_path.substr(0, (map_path.length - 1));
            }

            //Return path
            return map_path;
        }

        //Define restricted paths
        for(let project in all_configs) {
            //Project root folder
            let project_path = `${web_source}${project}`;
            restrict_paths[project_path] = "Project folder";

            //Get all website paths
            for(let website in all_configs[project]["websites"]) {
                //Set base website path
                let website_path = `${web_source}${project}${s}${website}`;
                restrict_paths[website_path] = "Website folder bound to configuration";

                //Check path mappings
                if(all_configs[project]["websites"][website]["apis_fixed_path"] != undefined) {
                    for(let web_path in all_configs[project]["websites"][website]["apis_fixed_path"]) {
                        let map_path = all_configs[project]["websites"][website]["apis_fixed_path"][web_path];
                        map_path = format_map_path(website, map_path);
                        if(map_path != "") {
                            restrict_paths[`${project_path}${s}${website}${map_path}`] = "Website fixed API path mapping";
                        }
                    }
                }
                if(all_configs[project]["websites"][website]["apis_dynamic_path"] != undefined) {
                    for(let web_path in all_configs[project]["websites"][website]["apis_dynamic_path"]) {
                        let map_path = all_configs[project]["websites"][website]["apis_dynamic_path"][web_path];
                        map_path = format_map_path(website, map_path);
                        if(map_path != "") {
                            restrict_paths[`${project_path}${s}${website}${map_path}`] = "Website dynamic API path mapping";
                        }
                    }
                }
                if(all_configs[project]["websites"][website]["path_static"] != undefined) {
                    for(let web_path in all_configs[project]["websites"][website]["path_static"]) {
                        let map_path = all_configs[project]["websites"][website]["path_static"][web_path];
                        map_path = format_map_path(website, map_path);
                        if(map_path != "") {
                            restrict_paths[`${web_source}${project}${s}${website}${map_path}`] = "Static path mapping";
                        }
                    }
                }
                if(all_configs[project]["websites"][website]["path_static_server_exec"] != undefined) {
                    for(let index in all_configs[project]["websites"][website]["path_static_server_exec"]) {
                        let map_path = all_configs[project]["websites"][website]["path_static_server_exec"][index];
                        map_path = format_map_path(website, map_path);
                        if(map_path != "") {
                            restrict_paths[`${web_source}${project}${s}${website}${map_path}`] = "Static path server override mapping";
                        }
                    }
                }

            }

            //Get JSON config
            restrict_paths[`${web_source}${project}${s}config.json`] = "Project configuation file";
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
        let create_folder = `${target_path}${s}${folder_name}`;
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
        let target_project = `${web_source}${project_name}`;

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
        let file_type_path = `${this.paths.server}default_file_types${s}`
        let file_type_html = `${file_type_path}file_type.html`;
        let file_type_css = `${file_type_path}file_type.css`;
        let file_type_api = `${file_type_path}file_type.js`;

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
        let create_file = `${target_path}${s}${file_name}`;
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

    //Project DNS settings
    dns_add(query=null) {
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
            if(this.validate_name(query.dns) == false) {
                result.error = "DNS name is invalid";
                return result;
            }
            if(this.validate_name(query.site) == false) {
                result.error = "Site name is invalid";
                return result;
            }
            if(query.env == undefined) {
                result.error = "Environment not defined";
                return result;
            }
        }

        //Validate environment name
        if(!(query.env === "dev" ||
             query.env === "qa" || 
             query.env === "stage" || 
             query.env === "prod")) {
            result.error = "Invalid Environment";
            return result;
        }

        //Get vars
        let project_name = query.project;
        let dns_env = query.env;
        let dns_name = query.dns;
        let site_name = query.site;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","dns_adm"],
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
        for(let search_project in all_projects) {
            let this_project = all_projects[search_project];
            if(this_project.dns_names != undefined) {
                for(let search_env in this_project.dns_names) {
                    for(let search_dns in this_project.dns_names[search_env]) {
                        if(search_dns == dns_name) {
                            result.error = `DNS Name is already assigned to project[${search_project}] environment[${search_env}] DNS Mapping`;
                            return result;
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
        if(conf_data.dns_names == undefined) {
            conf_data["dns_names"] = {
                "dev":{},
                "qa":{},
                "stage":{},
                "prod":{}
            }
            config_changed = true;
        }

        //Make sure DNS environment exists
        if(conf_data.dns_names[dns_env] == undefined) {
            conf_data.dns_names[dns_env] = {}
            config_changed = true;
        }

        //Add DNS to site name resolution
        if(conf_data.dns_names[dns_env][dns_name] == undefined) {
            conf_data.dns_names[dns_env][dns_name] = site_name;
            let sort_dns = this.sort_hash_array(conf_data.dns_names[dns_env]);
            conf_data.dns_names[dns_env] = sort_dns;
            config_changed = true;
        }

        //Update config file
        if(config_changed == false){
            result.error = "No DNS configurations changed";
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
    dns_delete(query=null) {
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
            if(this.validate_name(query.dns) == false) {
                result.error = "DNS name is invalid";
                return result;
            }
            if(query.env == undefined) {
                result.error = "Environment not defined";
                return result;
            }
        }

        //Validate environment name
        if(!(query.env === "dev" ||
             query.env === "qa" || 
             query.env === "stage" || 
             query.env === "prod")) {
            result.error = "Invalid Environment";
            return result;
        }

        //Get vars
        let project_name = query.project;
        let dns_env = query.env;
        let dns_name = query.dns;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","dns_adm"],
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

            //Check for DNS
            let config_changed = false;
            if(conf_data.dns_names[dns_env] != undefined) {
                if(conf_data.dns_names[dns_env][dns_name] != undefined) {
                    delete conf_data.dns_names[dns_env][dns_name];
                    config_changed = true;
                }
            }

            //Update config file
            if(config_changed == false){
                result.error = "No DNS configurations changed";
                return result;
            }else{
                let is_updated = this.update_project_conf_file(project_name, conf_data);
                if(is_updated.error != "") {
                    result.error = is_updated.error;
                }

                //Results
                return result;
            }
        }
    }
    dns_update(query=null) {
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
            if(this.validate_name(query.dns) == false) {
                result.error = "DNS name is invalid";
                return result;
            }
            if(query.site != undefined && query.site != "") {
                if(this.validate_name(query.site) == false) {
                    result.error = "Site name is invalid";
                    return result;
                }
            }
            if(query.env == undefined) {
                result.error = "Environment not defined";
                return result;
            }
        }

        //Validate environment name
        if(!(query.env === "dev" ||
             query.env === "qa" || 
             query.env === "stage" || 
             query.env === "prod")) {
            result.error = "Invalid Environment";
            return result;
        }

        //Get vars
        let project_name = query.project;
        let dns_env = query.env;
        let dns_name = query.dns;
        let site_name = query.site;

        // Auth Check ///////////////

        //Define auth check
        let access={
            "type":"project",
            "permission":["project_adm","dns_adm"],
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

            //Validate setting exists
            if(conf_data.dns_names[dns_env][dns_name] == undefined) {
                result.error = "DNS Configuration does not exist";
                return result;
            }else{
                conf_data.dns_names[dns_env][dns_name] = site_name;
                let sort_dns = this.sort_hash_array(conf_data.dns_names[dns_env]);
                conf_data.dns_names[dns_env] = sort_dns;
            }

            //Update config file
            let is_updated = this.update_project_conf_file(project_name, conf_data);
            if(is_updated.error != "") {
                result.error = is_updated.error;
            }

            //Results
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