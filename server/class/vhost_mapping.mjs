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

VHost server mapping class (web services)

*/

//
// Node JS virtual host server
//

//Set dirname
const __dirname = import.meta.dirname;

//Set Node JS constants
import * as url from "url";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

//Import classes
import vhost_logger from "./vhost_logger.mjs";

//Set vhost logger
const logger = new vhost_logger()

//Server class
class vhost_mapping {
    //Error state
    error = "";

    //System paths
    paths = {}                  //System paths

    //Server UI names (dev mode)
    mgmt_mode = false;
    mgmt_ui = []

    //Environment
    env = ""
    env_name = ""

    //Supported file types
    mime_types = {}

    //Configurations and mapping
    change_tracking = {}
    web_configs = {
        "mgmt":{},
        "projects":{},
        "errors":{},
    }
    web_mapping = {
        "defaults":{},
        "resolve":{
            "mgmtui_map":{
                "hostnames":[],
                "vhosts":{}
            },
            "proxy_map":{},
            "dns_map":{}
        }
    }

    //Class initiailize
    constructor() { 
        //Start class initialization
        this.define_paths()

        //Load server configuration
        this.load_server_config()

        //Check Environment Variable Overrides (containers)
        this.check_env_overrides()
    }

    define_paths() {
        //Set root
        let root = `${path.dirname(path.dirname(__dirname))}${path.sep}`;

        //Set default paths
        this.paths["root"] = root;
        this.paths["conf"] = path.join(root,"conf",path.sep);
        this.paths["config"] = path.join(root,"conf","server_conf.json");
        this.paths["server"] = path.join(root,"server",path.sep);
        this.paths["class"] = path.join(root,"server","class",path.sep);
        this.paths["system"] = path.join(root,"server","default_system",path.sep);
        this.paths["errors"] = path.join(root,"server","default_errors",path.sep);
        this.paths["localhost"] = path.join(root,"server","localhost",path.sep);
        this.paths["web_source"] = path.join(root,"web_source",path.sep);
        this.paths["web_templates"] = path.join(root,"web_templates",path.sep);        
    }
    load_server_config() {
        //Set hostname
        this.hostname = os.hostname();

        //Get local system settings
        this.load_server_ipaddr();

        //Check for config file
        let server_conf = this.paths["config"];
        let if_cfg_exists = fs.existsSync(server_conf);
        if(if_cfg_exists == true) {
            //Load JSON data
            let config_data	= fs.readFileSync(server_conf);
            try {
                var json = JSON.parse(config_data);
            }catch{
                this.error = `Cannot open server conf [${server_conf}] :: JSON config parse error, ignoring`;
                return;
            }

            //Load config settings
            if(json.debug_mode_on != undefined) {
                (json.debug_mode_on == false) ? this.debug_mode_on = false : this.debug_mode_on = true;
            }

            //Load config settings
            if(json.mgmt_mode != undefined) {
                (json.mgmt_mode == false) ? this.mgmt_mode = false : this.mgmt_mode = true;
            }
            if(json.mgmt_ui != undefined) {
                //Get hostname and IP
                this.mgmt_ui.push("localhost");
                this.mgmt_ui.push(this.hostname);
                for(let i in json.mgmt_ui) {
                    let hostname = json.mgmt_ui[i];
                    if(this.mgmt_ui.indexOf(hostname) == -1) {
                        this.mgmt_ui.push(hostname);
                    }
                }

                //Sort list
                this.mgmt_ui.sort();
            }
            if(json.environment != undefined) {
                this.env = json.environment;
            }
            if(json.environment_name != undefined) {
                this.env_name = json.environment_name;
            }

            //
            //Legacy config file (convert to new)
            //
            if(json.server_mode != undefined) {
                (json.server_mode == "prod") ? this.mgmt_mode = false : this.mgmt_mode = true;
            }
            if(json.server_dev_ui != undefined) {
                this.mgmt_ui.push("localhost");
                this.mgmt_ui.push(this.hostname);
                for(let i in json.server_dev_ui) {
                    let hostname = json.server_dev_ui[i];
                    if(this.mgmt_ui.indexOf(hostname) == -1) {
                        this.mgmt_ui.push(hostname);
                    }
                }
                this.mgmt_ui.sort();
            }
        }

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
    load_server_ipaddr() {
        //Get system IP addresses
        try {
            //Set hostname
            this.hostname = os.hostname();

            //Process IP addresses
            let ifaces = os.networkInterfaces();
            let ipv4_select = false;
            let ipv6_select = false;
            for(let iface in ifaces) {
                for(let ipconf in ifaces[iface]) {
                    let this_ipconf = ifaces[iface][ipconf];
                    if(this_ipconf.family == "IPv4") {
                        //Add to server Dev UI IP list
                        this.load_server_ipaddr_mgmt_ui(this_ipconf.address)

                        //Determine host primary IP address
                        if(this_ipconf.address != "127.0.0.1" && ipv4_select == false) {
                            ipv4_select = true;
                            this.ipv4_address = this_ipconf.address;
                        }
                    }else if(this_ipconf.family == "IPv6") {
                        //Add to server Dev UI IP list
                        this.load_server_ipaddr_mgmt_ui(this_ipconf.address)

                        //Determine host primary IP address
                        if(this_ipconf.address != "::1" && ipv6_select == false) {
                            ipv6_select = true;
                            this.ipv6_address = this_ipconf.address;
                        }
                    }
                }
            }
        }catch(err) {
            console.log("Cannot get OS details")
            console.log(err)
            return
        }
    }
    load_server_ipaddr_mgmt_ui(ipaddr=null){
        if(ipaddr != null) {
            if(ipaddr != "" && this.mgmt_ui.indexOf(ipaddr) == -1) {
                this.mgmt_ui.push(ipaddr);
            }
        }
    }
    check_env_overrides() {
        //Check environment when used in container environments
        for(let e in process.env) {
            switch(e) {
                case "PURRBOX_DEBUG_MODE_ON":
                    if(process.env[e] == 0) {
                        this.debug_mode_on = false;
                    }
                    if(process.env[e] == 1) {
                        this.debug_mode_on = true;
                    }   
                break;
                case "PURRBOX_MGMT_MODE":
                    if(process.env[e] == 0) {
                        this.mgmt_mode = false;
                    }
                    if(process.env[e] == 1) {
                        this.mgmt_mode = true;
                    }
                break;
                case "PURRBOX_MGMT_UI":
                    try{
                        let parse_mgmt_ui = process.env[e].split(",");
                        for(let i in parse_mgmt_ui) {
                            this.mgmt_ui.push(parse_mgmt_ui[i]);
                        }
                    }catch(err) {
                        console.log(err);
                    }
                break;
                case "PURRBOX_ENV":
                    if(process.env[e].toLowerCase() == "dev") {
                        this.environment = "dev";
                    }
                    if(process.env[e].toLowerCase() == "qa") {
                        this.environment = "qa";
                    }
                    if(process.env[e].toLowerCase() == "stage") {
                        this.environment = "stage";
                    }
                    if(process.env[e].toLowerCase() == "prod") {
                        this.environment = "prod";
                    }
                break;
                case "PURRBOX_ENV_NAME":
                    this.environment_name = process.env[e];
                break;
            }
        }
    }

    //Set environment
    set_environment(env="") {
        if(env == "") {
            this.log({
                "source":"mapper",
                "state":"info",
                "message":`Mapper cannot set environment, value is invalid[${env}]`
            })
        }else{
            this.env = env;
        }
    }

    //Common logging
    async log(data={}) {
        //Check log output empty
        if(Object.keys(data).length === 0) {
            return;
        }

        //Set default log message
        let this_log = {
            "source":"",
            "state":"info",
            "message":"",
            "environment":this.env,
            "environment_name":this.env_name,
        }

        //Validate fields
        if(data.source != undefined) {
            this_log.source = data.source
        }
        if(data.state != undefined) {
            this_log.state = data.state
        }
        if(data.message != undefined) {
            this_log.message = data.message
        }

        //Append additional fields
        for(let field in data) {
            if(this_log[field] == undefined) {
                this_log[field] = data[field];
            }
        }

        //Output in debug mode
        if(this.debug_mode_on == true) {
            if(data.message != undefined) {
                console.log(` :: [pid:${process.pid}] ${this_log.message}`);
            }
        }

        //Send to logger
        logger.log(this_log)
    }

    //////////////////////////////////
    //Project File Scanning
    //////////////////////////////////

    //Check file changes
    scan_project_changes() {
        //Set vars
        let web_source = this.paths["web_source"];
        let detect_change = false;

        //Purge configuration where website project folders are removed
        for(let project in this.change_tracking) {
            //Check of config file exists
            let this_config = path.join(web_source, project, "config.json");
            if(fs.existsSync(this_config) == false) {
                this.log({
                    "source":"mapper",
                    "state":"info",
                    "message":`project[${project}] folder or configuration removed, removing config data`
                })
                delete this.change_tracking[project];
                detect_change = true;
            }
        }

        //Query folders in web source path (look for new / modified config files)
        let dir_list = fs.readdirSync(web_source);
        for(let target in dir_list) {
            //Get project name from folder name
            let project = dir_list[target];

            //Check if directory
            let this_dir = dir_list[target];
            let this_path = path.join(web_source, this_dir);
            let this_config = path.join(this_path, "config.json");

            //Verify this_path is a directory
            let is_dir = fs.lstatSync(this_path).isDirectory();
            if(is_dir == true) {
                //Check of config file exists
                let if_cfg_exists = fs.existsSync(this_config);
                if(if_cfg_exists == true) {

                    //Get data and file stats
                    let this_file_data 	= fs.readFileSync(this_config);
                    let this_file_stat 	= fs.statSync(this_config);
                    
                    //Extract information
                    let this_content = this_file_data.toString();
                    let this_modified = this_file_stat.mtimeMs;
                    
                    //Check file data is JSON
                    try {
                        var this_json = JSON.parse(this_content);
                    }catch{
                        this.log({
                            "source":"mapper",
                            "state":"info",
                            "message":`project[${project}] :: Project configuration error, unable to parse JSON data, ignoring`
                        })
                        continue;
                    }

                    //Check if web_config already exists
                    if(this.change_tracking[project] == undefined) {
                        this.log({
                            "source":"mapper",
                            "state":"info",
                            "message":`New Configuration @ project[${project}]`
                        })
                        this.change_tracking[project] = {};
                        this.change_tracking[project]["modified"] = this_modified;
                        this.change_tracking[project]["json"] = this_json;
                        detect_change = true;
                    }else{
                        //Check if newer time stamp
                        if(this.change_tracking[project]["modified"].toString() != this_modified.toString()) {
                            this.log({
                                "source":"mapper",
                                "state":"info",
                                "message":`Configuration Updated @ project[${project}]`
                            })
                            this.change_tracking[project] = {};
                            this.change_tracking[project]["modified"] = this_modified;
                            this.change_tracking[project]["json"] = this_json;
                            detect_change = true;
                        }
                    }
                }else{
                    this.log({
                        "source":"mapper",
                        "state":"info",
                        "message":`No configuration for [${project}] > ${this_config}, ignoring`
                    })
                    continue;
                }
            }
        }

        //Return change
        return detect_change
    }

    //////////////////////////////////
    //System & Project File Mapping
    //////////////////////////////////

    //Mapping
    map_generate() {
        //Start time
        let time = new Date()
        let start_time = time.getTime()

        //Define web_configs
        this.web_configs.mgmt = this.map_mgmtui_configs();
        this.web_configs.projects = this.map_project_configs();

        //Define mapping for mgmt UI
        if(this.mgmt_mode == true) {
            this.web_mapping.resolve.mgmtui_map = this.map_resolve_mgmtui();
        }else{
            this.web_mapping.resolve.mgmtui_map = {}
        }

        //Resolve Proxy and DNS Mapping
        this.web_mapping.resolve.proxy_map = this.map_resolve_proxy_dns_map("proxy_map");
        this.web_mapping.resolve.dns_map = this.map_resolve_proxy_dns_map("dns_names");

        //Define mapping configs
        this.web_mapping.defaults = this.map_system_default();

        //Validate the configuration files
        this.validate_web_configs();

        //End time
        time = new Date()
        let end_time = time.getTime()

        this.log({
            "source":"mapper",
            "state":"info",
            "message":`Project configuration mapping and validate time: ${end_time - start_time} ms`,
            "time": (end_time - start_time)
        })

    }
    map_mgmtui_configs() {
        //Set return variable
        let this_mgmtui = {}

        //Dev mode website configurations
        if(this.mgmt_mode == true) {
            //Mapping dev UI names
            this_mgmtui = {
                "project_desc": "Management UI",
                "enabled": true,
                "proxy_map": {
                    "dev": {},
                    "qa": {},
                    "stage": {},
                    "prod": {}
                },
                "dns_names": {
                    "dev": {},
                    "qa": {},
                    "stage": {},
                    "prod": {}
                },
                "websites": {
                    "ui": {
                        "ssl_redirect": true,
                        "maintenance": {
                            "dev": false,
                            "qa": false,
                            "stage": false,
                            "prod": false
                        },
                        "maintenance_page": "maintenance.html",
                        "maintenance_page_api": "maintenance.json",
                        "default_doc": "index.html",
                        "default_errors": {
                            "user": {
                                "404": "404.html",
                                "500": "500.html"
                            },
                            "api": {
                                "404": "404.json",
                                "500": "500.json"
                            }
                        },
                        "apis_fixed_path": {},
                        "apis_dynamic_path": {
                            "/api/":`${this.paths["localhost"]}api${path.sep}`
                        },
                        "path_static": {
                            "/":this.paths["localhost"]
                        },
                        "path_static_server_exec": {},
                        "sub_map": {}
                    }
                }
            }
        }

        //Return data
        return this_mgmtui;
    }
    map_project_configs() {
        //Set return variable
        let this_projects = {}

        //Cycle project files
        let web_source = this.paths["web_source"];
        let dir_list = fs.readdirSync(web_source);
        for(let target in dir_list) {
            //Get project name from folder name
            let project = dir_list[target];

            //Check if directory
            let this_dir = dir_list[target];
            let this_path = path.join(web_source, this_dir);
            let this_config = path.join(this_path, "config.json");

            //Verify this_path is a directory
            let is_dir = fs.lstatSync(this_path).isDirectory();
            if(is_dir == true) {
                //Check of config file exists
                let if_cfg_exists = fs.existsSync(this_config);
                if(if_cfg_exists == true) {

                    //Get data and file stats
                    let this_file_data 	= fs.readFileSync(this_config);
                    let this_content = this_file_data.toString();
                    var this_json = {}
                    
                    //Check file data is JSON
                    try {
                        this_json = JSON.parse(this_content);
                        this_projects[project] = this_json;
                    }catch{
                        this.log({
                            "source":"mapper",
                            "state":"info",
                            "message":`project[${project}] :: JSON config parse error, ignoring`
                        })
                        continue;
                    }
                }
            }
        }

        //Return web configs
        return this_projects;
    }
    map_resolve_mgmtui() {
        //Set return variable
        let this_mgmtui_map = {
            "hostnames":this.mgmt_ui,
            "vhosts":this.map_resolve_mgmtui_vhosts()
        }

        //Return
        return this_mgmtui_map;
    }
    map_resolve_mgmtui_vhosts() {
        //Loop project names and sites
        let vhost_path = []
        let temp_map = {}
        let vhost_map = {}
        for(let project in this.web_configs.projects) {
            for(let website in this.web_configs.projects[project]["websites"]) {
                let vhost = `/vhost/${project}::${website}/`;
                vhost_path.push(vhost);
                temp_map[vhost] = {
                    "project":project,
                    "website":website
                }
            }
        }

        //Sort array by string length
        vhost_path.sort((a, b) => b.length - a.length);

        //Add to mapping
        for(let i in vhost_path) {
            vhost_map[vhost_path[i]] = temp_map[vhost_path[i]];
        }

        //Return vhost mapping
        return vhost_map;
    }
    map_resolve_proxy_dns_map(map_type) {
        //Get environment
        let env = this.env;
        let this_path = []
        let temp_map = {}
        let this_map = {}

        //Get proxy mapping
        for(let project in this.web_configs.projects) {
            if(this.web_configs.projects[project].enabled == true) {
                //Get proxy mapping
                if(this.web_configs.projects[project][map_type] != undefined) {
                    if(this.web_configs.projects[project][map_type][env] != undefined) {
                        if(Object.keys(this.web_configs.projects[project][map_type][env]).length > 0) {
                            for(let proxy in this.web_configs.projects[project][map_type][env]) {
                                this_path.push(proxy);
                                temp_map[proxy] = {
                                    "project": project,
                                    "website": this.web_configs.projects[project][map_type][env][proxy]
                                }
                            }
                        }
                    }
                }
            }
        }

        //Sort array by string length
        this_path.sort((a, b) => b.length - a.length);

        //Add to mapping
        for(let i in this_path) {
            this_map[this_path[i]] = temp_map[this_path[i]];
        }

        //Return mapping
        return this_map;
    }
    map_system_default() {
        //Set default docs
        let this_defaults = {
            "default_doc":"index.html",
            "default_404_user":"404.html",
            "default_404_api":"404.json",
            "default_500_user":"500.html",
            "default_500_api":"500.json",
            "maintenance_page":"maintenance.html",
            "maintenance_page_api":"maintenance.json"
        }

        //Return web configs
        return this_defaults;
    }    

    //////////////////////////////////
    //Project configuration validate
    //////////////////////////////////

    //
    // Temporarily correct configuration
    // Add to web_config["errors"][project]
    //

    validate_web_configs() {
        //Reset errors state
        this.web_configs.errors = {}

        //Loop configurations
        for(let project in this.web_configs.projects) {
            //Validate general settings
            this.validate_project_params(project);
            this.validate_project_resolve_maps(project, "proxy_map");
            this.validate_project_resolve_maps(project, "dns_names");
            this.validate_project_websites(project);
        }
    }
    validate_project_flag_error(project, website=null, errlvl, msg, website_files_type=null) {
        //
        // Error levels [errlvl]
        //   warning = minor misconfiguration (e.g. Proxy or DNS with null setting)
        //   error   = Configuration missing and needs correcting
        //

        //Check if errors sections exists
        if(this.web_configs.errors[project] == undefined) {
            this.web_configs.errors[project] = {
                "errlvl":"warning",
                "message":"",
                "websites":{}
            }
        }

        //Check is website section is defined
        if(website != null) {
            if(this.web_configs.errors[project]["websites"][website] == undefined) {
                this.web_configs.errors[project]["websites"][website] = {
                    "errlvl":"warning",
                    "message":"",
                    "maintenance_page_exists":true,
                    "default_doc_exists":true,
                    "default_errors_exists":true
                }
            }
        }

        //Update error
        if(website == null) {
            //Set error level
            if(errlvl == "error") {
                this.web_configs.errors[project]["errlvl"] = errlvl;
            }
            this.web_configs.errors[project]["message"] += `${msg}\n`;
        }else{
            //Set error level
            if(errlvl == "error") {
                this.web_configs.errors[project]["errlvl"] = errlvl;
                this.web_configs.errors[project]["websites"][website]["errlvl"] = errlvl;
            }
            this.web_configs.errors[project]["websites"][website]["message"] += `${msg}\n`;

            //Flag parameter error
            switch(website_files_type) {
                case "maintenance_page_exists":  this.web_configs.errors[project]["websites"][website][website_files_type] = false; break;
                case "default_doc_exists":       this.web_configs.errors[project]["websites"][website][website_files_type] = false; break;
                case "default_errors_exists":    this.web_configs.errors[project]["websites"][website][website_files_type] = false; break;
            }
        }
    }
    validate_project_params(project) {
        //Get project data
        let project_data = this.web_configs.projects[project];

        //Check project description
        if(project_data["project_desc"] == undefined) {
            this.validate_project_flag_error(project, null, "error", `Config File: Porject Desc [project_desc=string] is not defined`)
            this.web_configs.projects[project]["project_desc"] = "";
        }

        //Check project enabled
        if(project_data["enabled"] == undefined) {
            this.validate_project_flag_error(project, null, "error", `Config File: Porject Enable [enabled=boolean] is not defined`)
            this.web_configs.projects[project]["enabled"] = true;
        }else if(typeof(project_data["enabled"]) != "boolean") {
            this.validate_project_flag_error(project, null, "error", `Config File: Project Enable [enabled=boolean] is wrong data type`)
            this.web_configs.projects[project]["enabled"] = true;
        }

        //Check project proxy map
        if(project_data["proxy_map"] == undefined) {
            this.validate_project_flag_error(project, null, "error", `Config File: Project Proxy Map [proxy_map={...}] is not defined`)
            this.web_configs.projects[project]["proxy_map"] = { dev: {}, qa: {}, stage: {}, prod: {} }
        }else if(typeof(project_data["proxy_map"]) != "object") {
            this.validate_project_flag_error(project, null, "error", `Config File: Project Proxy Map [proxy_map={...}] is wrong data type`)
            this.web_configs.projects[project]["proxy_map"] = { dev: {}, qa: {}, stage: {}, prod: {} }
        }

        //Check project DNS names
        if(project_data["dns_names"] == undefined) {
            this.validate_project_flag_error(project, null, "error", `Config File: Project DNS Hostnames [dns_names={...}] is not defined`)
            this.web_configs.projects[project]["dns_names"] = { dev: {}, qa: {}, stage: {}, prod: {} }
        }else if(typeof(project_data["dns_names"]) != "object") {
            this.validate_project_flag_error(project, null, "error", `Config File: Project DNS Hostnames [dns_names={...}] is wrong data type`)
            this.web_configs.projects[project]["dns_names"] = { dev: {}, qa: {}, stage: {}, prod: {} }
        }

        //Sort project fields
        let this_project = {
            "project_desc": this.web_configs.projects[project]["project_desc"],
            "enabled": this.web_configs.projects[project]["enabled"],
            "proxy_map": this.web_configs.projects[project]["proxy_map"],
            "dns_names": this.web_configs.projects[project]["dns_names"],
            "websites": this.web_configs.projects[project]["websites"]
        }
        this.web_configs.projects[project] = this_project;
    }
    validate_project_resolve_maps(project, map_type) {
        //Get project data
        let project_data = this.web_configs.projects[project];

        //Set map type string
        let map_type_str = "Proxy Map";
        if(map_type == "dns_names") {
            map_type_str = "DNS Names Map";
        }

        //Set environments
        let environments = [
            "dev",
            "qa",
            "stage",
            "prod",
        ]

        //Check Environments
        for(let i in environments) {
            let env = environments[i];
            if(project_data[map_type][env] == undefined) {
                this.validate_project_flag_error(project, null, "error", `Config File: Project ${map_type_str} [${map_type}[${env}]={...}] is not defined`)
                this.web_configs.projects[project][map_type][env] = {};
            }else if(typeof(project_data[map_type][env]) != "object") {
                this.validate_project_flag_error(project, null, "error", `Config File: Project ${map_type_str} [${map_type}[${env}]={...}] is wrong data type`)
                this.web_configs.projects[project][map_type][env] = {};
            }else{
                //Check if any settings are blank
                for(let this_map in this.web_configs.projects[project][map_type][env]) {
                    let this_target = this.web_configs.projects[project][map_type][env][this_map];
                    if(this_target == "") {
                        this.validate_project_flag_error(project, null, "warning", `Config File: Project ${map_type_str} [${map_type}[${env}]], map[${this_map}] is not resolved`)
                    }
                    if(this_target != "" && this.web_configs.projects[project]["websites"][this_target] == undefined) {
                        this.validate_project_flag_error(project, null, "warning", `Config File: Project ${map_type_str} [${map_type}[${env}]], map[${this_map}] resolves to invalid website[${this_target}]`)
                    }
                }
            }
        }
    }
    validate_project_websites(project) {
        //Get asset data
        let project_data = this.web_configs.projects[project];

        //Check project Websites section
        if(project_data["websites"] == undefined) {
            this.validate_project_flag_error(project, null, "error", `Config File: Websites [websites={...}] is not defined`)
            this.web_configs.projects[project]["websites"] = { }
        }else if(typeof(project_data["websites"]) != "object") {
            this.validate_project_flag_error(project, null, "error", `Config File: Websites [websites={...}] is wrong data type`)
            this.web_configs.projects[project]["websites"] = { }
        }else{
            //Loop websites
            for(let website in project_data["websites"]) {
                //Validate website config
                if(typeof(project_data["websites"][website]) != "object") {
                    this.validate_project_flag_error(project, null, "error", `Config File: Website [${website}] is not a valid website configuration`)
                    delete this.web_configs.projects[project]["websites"][website]
                }else{
                    let website_root = path.join(this.paths.web_source, project, website);
                    if(fs.existsSync(website_root) == false) {
                        this.validate_project_flag_error(project, website, "error", `Missing Files: Website folder '${website}' not found in project`)
                    }else{
                        //Validate website parameters
                        this.validate_project_website_params(project, website);

                        //Validate website paths (maintenance, error_pages, mapping)
                        this.validate_project_website_default_doc_path(project, website);
                        this.validate_project_website_maint_and_errors_paths(project, website);
                        this.validate_project_website_mapping(project, website);
                    }
                }
            }
        }
    }
    validate_project_website_params(project, website) {
        //Get website parameters
        let project_data = this.web_configs.projects[project];
        let website_data = this.web_configs.projects[project]["websites"][website];
        let check = true;

        //Check ssl_redirect
        if(website_data["ssl_redirect"] == undefined) {
            this.validate_project_flag_error(project, website, "error", `Config File: Website field[ssl_redirect] is not defined`)
            check = false;
        }else if(typeof(website_data["ssl_redirect"]) != "boolean") {
            this.validate_project_flag_error(project, website, "error", `Config File: Website field[ssl_redirect] is wrong data type`)
            check = false;
        }
        if(check == false) {
            this.web_configs.projects[project]["websites"][website]["ssl_redirect"] = true;
            check = true;
        }

        //Check maintenance
        if(website_data["maintenance"] == undefined) {
            this.validate_project_flag_error(project, website, "error", `Config File: Website field[maintenance] is not defined`)
            check = false;
        }else if(typeof(website_data["maintenance"]) != "object") {
            this.validate_project_flag_error(project, website, "error", `Config File: Website field[maintenance] is wrong data type`)
            check = false;
        }
        if(check == false) {
            this.web_configs.projects[project]["websites"][website]["maintenance"] = { "dev": false, "qa": false, "stage": false, "prod": false };
            check = true;
        }

        //Check maintenance environment
        let environments = ["dev", "qa", "stage", "prod"];
        for(let i in environments) {
            let env = environments[i];
            if(website_data["maintenance"][env] == undefined) {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[maintenance][${env}] is not defined`)
                check = false;
            }else if(typeof(website_data["maintenance"][env]) != "boolean") {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[maintenance][${env}] is wrong data type`)
                check = false;
            }
            if(check == false) {
                this.web_configs.projects[project]["websites"][website]["maintenance"][env] = false;
                check = true;
            }
        }

        //Check default documents
        let default_docs = ["maintenance_page", "maintenance_page_api", "default_doc"];
        for(let d in default_docs) {
            let doc_setting = default_docs[d];
            if(website_data[doc_setting] == undefined) {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[${doc_setting}] is not defined`)
                check = false;
            }else if(typeof(website_data[doc_setting]) != "string") {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[${doc_setting}] is wrong data type`)
                check = false;
            }
            if(check == false) {
                this.web_configs.projects[project]["websites"][website][doc_setting] = "";
                check = true;
            }
        }

        //Check default errors documents parameters sections exists
        let default_error_docs = ["404", "500"];
        let default_error_types = ["user", "api"];
        for(let t in default_error_types) {
            //Verify the default docs sections exist in the config file
            let response_type = default_error_types[t];     // Defines of error pages are to user or api call
            if(website_data["default_errors"][response_type] == undefined) {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[default_errors][${response_type}] is not defined`)
                check = false;
            }else if(typeof(website_data["default_errors"][response_type]) != "object") {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[default_errors][${response_type}] is wrong data type`)
                check = false;
            }
            if(check == false) {
                this.web_configs.projects[project]["websites"][website]["default_errors"][response_type] = {}
                for(let i in default_error_docs) {
                    let doc_type = default_error_docs[i];
                    this.web_configs.projects[project]["websites"][website]["default_errors"][response_type][doc_type] = "";
                }
                check = true;
            }
        }
        for(let response_type in website_data["default_errors"]) {
            // Remove invalid response types of default_errors
            if(response_type != "user" && response_type != "api") {
                delete this.web_configs.projects[project]["websites"][website]["default_errors"][response_type];
            }
        }
        for(let t in default_error_types) {
            //Check default errors doc_type files parameters are set
            let response_type = default_error_types[t];     // Defines of error pages are to user or api call
            for(let i in default_error_docs) {
                let doc_type = default_error_docs[i];
                if(website_data["default_errors"][response_type][doc_type] == undefined) {
                    check = false;
                }else if(typeof(website_data["default_errors"][response_type][doc_type]) != "string") {
                    check = false;
                }else if(website_data["default_errors"][response_type][doc_type] == "") {
                    check = false;
                }
                if(check == false) {
                    this.web_configs.projects[project]["websites"][website]["default_errors"][response_type][doc_type] = "";
                    check = true;
                }
            }
        }

        //Check mapping sections
        let map_sections = ["apis_fixed_path","apis_dynamic_path","path_static","path_static_server_exec","sub_map"];
        for(let i in map_sections) {
            let section = map_sections[i];

            //Make sure section is proper data type and defined
            if(website_data[section] == undefined) {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] is not defined`)
                check = false;
            }else if(typeof(website_data[section]) != "object") {
                this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] is wrong data type`)
                check = false;
            }
            if(check == false) {
                this.web_configs.projects[project]["websites"][website][section] = {};
                check = true;
            }

            //Wehere sections are already defined, verify settings
            for(let map in website_data[section]) {
                let target = website_data[section][map];
                if(map == "") {
                    delete this.web_configs.projects[project]["websites"][website][section][map];
                    this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] map[${map}] label is blank`)
                }
                if(target == "") {
                    delete this.web_configs.projects[project]["websites"][website][section][map];
                    if(section == "sub_map") {
                        this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] map[${map}] does not resolve a website`)
                    }else{
                        this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] map[${map}] does not resolve a path`)
                    }
                }else{
                    if(section == "sub_map") {
                        if(target == website) {
                            this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] map[${map}] points to itself, website[${target}]`)
                        }else if(project_data["websites"][target] == undefined) {
                            this.validate_project_flag_error(project, website, "error", `Config File: Website field[${section}] map[${map}] points to invalid website[${target}]`)
                        }
                    }
                }
            }
        }

        //Sort parameters
        let sort_params = {
            "ssl_redirect": this.web_configs.projects[project]["websites"][website]["ssl_redirect"],
            "maintenance": this.web_configs.projects[project]["websites"][website]["maintenance"],
            "maintenance_page": this.web_configs.projects[project]["websites"][website]["maintenance_page"],
            "maintenance_page_api": this.web_configs.projects[project]["websites"][website]["maintenance_page_api"],
            "default_doc": this.web_configs.projects[project]["websites"][website]["default_doc"],
            "default_errors": this.web_configs.projects[project]["websites"][website]["default_errors"],
            "apis_fixed_path": this.web_configs.projects[project]["websites"][website]["apis_fixed_path"],
            "apis_dynamic_path": this.web_configs.projects[project]["websites"][website]["apis_dynamic_path"],
            "path_static": this.web_configs.projects[project]["websites"][website]["path_static"],
            "path_static_server_exec": this.web_configs.projects[project]["websites"][website]["path_static_server_exec"],
			"sub_map": this.web_configs.projects[project]["websites"][website]["sub_map"]
        }
        this.web_configs.projects[project]["websites"][website] = sort_params;
    }
    validate_project_website_default_doc_path(project, website) {
        //Get the default map and target
        let path_static = this.web_configs.projects[project]["websites"][website]["path_static"];
        let default_doc = this.web_configs.projects[project]["websites"][website]["default_doc"];

        if(default_doc != "") {
            //Loop paths
            for(let map in path_static) {
                //Set path
                let target = path_static[map];
                let target_path = path.join(this.paths.web_source, project, target, default_doc);

                //Full target
                let full_target = (`${target}/${default_doc}`).replaceAll(/\/+/g, "/");

                //Verify exists
                if(fs.existsSync(target_path) == false) {
                    this.validate_project_flag_error(project, website, "error", `Missing Files: Website mapping section[path_static] file '${full_target}' is not found`, "default_doc_exists")
                }
            }
        }
    }
    validate_project_website_maint_and_errors_paths(project, website) {
        //Set maintenance page default docs
        let default_maint_pages = []
        default_maint_pages.push(this.web_configs.projects[project]["websites"][website]["maintenance_page"]);
        default_maint_pages.push(this.web_configs.projects[project]["websites"][website]["maintenance_page_api"]);

        //Set maintenance page default docs
        let default_error_pages = []
        default_error_pages.push(this.web_configs.projects[project]["websites"][website]["default_errors"]["user"]["404"]);
        default_error_pages.push(this.web_configs.projects[project]["websites"][website]["default_errors"]["user"]["500"]);
        default_error_pages.push(this.web_configs.projects[project]["websites"][website]["default_errors"]["api"]["404"]);
        default_error_pages.push(this.web_configs.projects[project]["websites"][website]["default_errors"]["api"]["500"]);

        //Check special directories
        let special_dir = ["_maintenance_page", "_error_pages"];
        for(let s in special_dir) {
            //Set target path
            let this_dir = special_dir[s];
            let target_root_path = path.join(this.paths.web_source, project, website, this_dir);

            //Get document list per directory
            let doc_list = []
            let flag = "";
            switch(this_dir) {
                case "_maintenance_page":
                    doc_list = default_maint_pages;
                    flag = "maintenance_page_exists";
                break;
                case "_error_pages":
                    doc_list = default_error_pages;
                    flag = "default_errors_exists";
                break;
            }

            //Check doc list is defined
            let not_blank = false;
            for(let d in doc_list) {
                if(doc_list[d] != "") {
                    not_blank = true;
                    break;
                }
            }

            //Check target path if there are defined files
            if(not_blank == true) {
                if(fs.existsSync(target_root_path) == false) {
                    this.validate_project_flag_error(project, website, "warning", `Missing Files: Website sub folder '${this_dir}' path is not found`, flag);
                }else{
                    for(let d in doc_list) {
                        let this_file = doc_list[d];
                        let this_file_path = path.join(target_root_path, this_file);
                        if(fs.existsSync(this_file_path) == false) {
                            this.validate_project_flag_error(project, website, "warning", `Missing Files: Website file '${this_dir}/${this_file}' is not found`, flag);
                        }
                    }
                }
            }
        }
    }
    validate_project_website_mapping(project, website) {
        //Set mapping sections
        let map_sections = ["apis_fixed_path", "apis_dynamic_path", "path_static_server_exec"];

        //Get website root path
        let website_root = path.join(this.paths.web_source, project, website);

        //Loop mapping sections
        for(let i in map_sections) {
            let section = map_sections[i];
            let target_section = this.web_configs.projects[project]["websites"][website][section]

            //Loop section mapping
            for(let map in target_section) {
                //Get target mapping
                let target = target_section[map]
                let target_path = path.join(this.paths.web_source, project, target)

                //Verify exists
                if(fs.existsSync(target_path) == false) {
                    this.validate_project_flag_error(project, website, "error", `Missing Files: Website mapping section[${section}] file or folder '${target}' is not found`, "default_doc_exists")
                }
            }
        }
    }

    //////////////////////////////////
    //Match Functions
    //////////////////////////////////

    //Match URL
    match_url(target_url) {
        //Get environment
        let env = this.env;

        //Match output
        let match = {
            "state":false,              // Match true or false use to track stage 1 and stage 2 matching
            "url_parsed":"",            // URL parse + custom fields not originally part of URL.parse function
            "log":"",                   // Running log of match logic (specific to a single URL match)
            "match_host":"",            // URL hostname
            "match_vhost":"",           // Management UI VHost match (if exists)
            "match_proxyuri":"",        // Proxy server URI path (if exists)
            "match_submap":"",          // Website sub map URI path (if exists)
            "project":"",               // Project name
            "website":"",               // Website name
            "config":{},                // Target website configuration
            "ssl_redirect":false,       // Website SSL Redirect setting
            "maintenance":false,        // Website Maintenance Mode setting
            "maintenance_page":"",      // Website default Maintenance Page
            "default_doc":"",           // Website Default Doc
            "default_404_user":"",      // Website Default 404 doc - HTML client response
            "default_404_api":"",       // Website Default 404 doc - API JSON, XML, other
            "default_500_user":"",      // Website Default 500 doc - HTML client response
            "default_500_api":"",       // Website Default 500 doc - API JSON, XML, other
            "website_root_path":"",     // Web source, project, website path
            "website_uri_prefix":"",    // URI prefix before a target string
            "website_uri_suffix":"",    // URI suffix target string for rule compare
            "fixed_api_path":{},        // Fixed API trailing path
            "file_match_type":"",       // Processed rule API Fix Path, API Dynamic Path, Static Content (Server Execute), Static to Client
            "file_exec":"",             // Execute server side or send to client
            "file_path":"",             // File system path of content file
            "file_name":"",             // Filename of content file
            "error":false,              // Mark if error code like 404 or other
            "status_code":200,          // Status code for headers
            "status_msg":""             // Status message for request
        }

        //Check mgmt mode
        if(this.mgmt_mode == true) {
            match.log += "> Server Management Mode ON\n";
        }else{
            match.log += "> Server Management Mode OFF\n";
        }

        //Verify environment
        switch(env) {
            case "dev": match.log += "> Environment Dev\n"; break;
            case "qa": match.log += "> Environment QA\n"; break;
            case "stage": match.log += "> Environment Stage\n"; break;
            case "prod": match.log += "> Environment Prod\n"; break;
            default:
                this.error = `Invalid Environment [${env}]`;
                match.log += `> Invalid Environment [${env}]\n`;
                return
        }

        //Parse URL
        match.url_parsed = this.match_parse_target_url(target_url);

        match.log += `> Request URL [${target_url}]\n`;
        match.log += `    protocol :: ${match.url_parsed.protocol}\n`;
        match.log += `    hostname :: ${match.url_parsed.hostname}\n`;
        match.log += `    port     :: ${match.url_parsed.port}\n`;
        match.log += `    basepath :: ${match.url_parsed.basepath}\n`;
        match.log += `    query    :: ${match.url_parsed.query}\n`;
        match.log += `    filename :: ${match.url_parsed.filename}\n`;

        match.log += `\n`;
        match.log += `--- Stage 1 ---\n`;
        match.log += `> Resolve Host, FQDN or Proxy\n`;

        //Check match against Dev UI hostname and VHost paths
        if(this.mgmt_mode == true) {
            match = this.match_mgmtui(match, match.url_parsed);
        }

        //Check match against proxy map and DNS names
        if(match.state == false) { match = this.match_proxy_path(match) }
        if(match.state == false) { match = this.match_dns_name(match) }

        //Check match against website sub mapping
        if(match.state == true) {
            if(match.project != "system" && match.project != "mgmt") {
                match = this.match_website_sub_map(match)
            }
        }

        match.log += "\n";
        match.log += `--- Stage 2 ---\n`;

        //Resolve to content
        if(match.state == false) {
            match.log += "> Resolve failed\n";

            if(match.url_parsed.basepath.includes("/_default_system/")) {
                //Process default system files
                match = this.match_default_system_request(match);
            }else{
                //Send to 404 page
                match = this.match_default_system_404(match) 
            }

            //Check error pages
            match = this.match_check_request_content(match);

            //Log current match level
            match.log += "\n";
            match.log += "--- Result ---\n";
            match.log += `    URL Hostname          :: ${match.url_parsed.hostname}\n`;
            match.log += `    URL Basepath          :: ${match.url_parsed.basepath}\n`;
            match.log += `    URL Filename          :: ${match.url_parsed.filename}\n`;
        }else{
            match.log += "> Resolve success\n";

            if(match.url_parsed.basepath.includes("/_default_system/")) {
                match = this.match_default_system_request(match);
            }else{
                if(match.project == "mgmt" && match.website == "ui") {
                    //Process request for Management UI site
                    match = this.match_mgmtui_request(match);

                    //Check error pages
                    match = this.match_mgmtui_error_pages(match);

                }else{
                    //Get website parameters (defaults, maintenance and error pages)
                    match = this.match_website_params(match);

                    //Match path to API, or static (need to know file type before block at maintenance level)
                    match = this.match_website_request(match);

                    //Check maintenance mode
                    match = this.match_website_maintenance_mode(match);

                    //Check error pages
                    match = this.match_website_error_pages(match);
                }
            }

            //Check error pages
            match = this.match_check_request_content(match);

            //Log current match level
            match.log += "\n";
            match.log += "--- Result ---\n";
            match.log += `    Matched Hostname      :: ${match.match_host}\n`;
            match.log += `    Matched MgmtUI VHost  :: ${match.match_vhost}\n`;
            match.log += `    Matched Proxy URI     :: ${match.match_proxyuri}\n`;
            match.log += `    Matched Sub Map       :: ${match.match_submap}\n`;
        }

        //Target
        match.log += `    Project               :: ${match.project}\n`;
        match.log += `    Website               :: ${match.website}\n`;
        match.log += `    SSL redirect          :: ${match.ssl_redirect}\n`;
        match.log += `    Website Root Path     :: ${match.website_root_path}\n`;
        match.log += `    Website URI Path      :: ${match.url_parsed.basepath}\n`;
        match.log += `    Website URI Prefix    :: ${match.website_uri_prefix}\n`;
        match.log += `    Website URI Suffix    :: ${match.website_uri_suffix}\n`;
        match.log += `    Default Doc           :: ${match.default_doc}\n`;
        match.log += `    Default 404 User      :: ${match.default_404_user}\n`;
        match.log += `    Default 404 API       :: ${match.default_404_api}\n`;
        match.log += `    Default 500 User      :: ${match.default_404_user}\n`;
        match.log += `    Default 500 API       :: ${match.default_404_api}\n`;
        match.log += `    Maintenance Mode      :: ${match.maintenance}\n`;
        match.log += `    Maintenance Page      :: ${match.maintenance_page}\n`;
        match.log += `    Match State           :: ${match.state}\n`;
        match.log += `    Match Type            :: ${match.file_match_type}\n`;
        match.log += `    File Execute          :: ${match.file_exec}\n`;
        match.log += `    File Path             :: ${match.file_path}\n`;
        match.log += `    File Name             :: ${match.file_name}\n`;
        match.log += `    Error                 :: ${match.error}\n`;
        match.log += `    Status Code           :: ${match.status_code}\n`;
        match.log += `    Status Message        :: ${match.status_msg}\n`;

        //Return match parameters
        return match
    }
    match_parse_target_url(target_url) {
        //Parse URL
        let this_url = url.parse(target_url);

        //Determine file extension, name and base path
        if(this_url.pathname.match(/\/vhost\/[0-9a-z\-\_\.]*::[0-9a-z\-\_\.]*\//g) && this_url.pathname.endsWith("/")) {
            this_url.extname = "";
            this_url.filename = "";
            this_url.basepath = this_url.pathname;
        }else{
            //Add properties to URL parse
            this_url.extname = path.extname(this_url.pathname);
            if(this_url.extname == "") {
                this_url.filename = "";
                this_url.basepath = this_url.pathname;
            }else{
                this_url.filename = path.basename(this_url.pathname);
                this_url.basepath = (`${path.dirname(this_url.pathname)}/`).replaceAll(/\/+/g,"/");
            }
        }

        //Add trailing slash when no file extension
        if(this_url.extname == "" && this_url.basepath.substring(this_url.basepath.length - 1) != "/") {
            this_url.basepath += "/";
        }

        //Populate port
        if(this_url.port == null) {
            if(this_url.protocol == "http:") {
                this_url.port = 80;
            }
            if(this_url.protocol == "https:") {
                this_url.port = 443;
            }
        }

        //Process query string (parse)
        if(this_url.query != "") {
            this_url.query_parsed = this.match_parse_query(this_url.query)
        }

        //Any properties that are null, change to blank string
        for(let property in this_url) {
            if(this_url[property] == null) {
                this_url[property] = "";
            }
        }

        //Return target URL
        return this_url;
    }
    match_parse_query(query=null) {
        //Return empty
        if(query == null) {
            return {};
        }

        //Test pure JSON in query
        try {
            query = JSON.parse(decodeURIComponent(query));
            return query;
        }catch(err){}

        //Vars
        let hashmap = {}
        let key_index = 0;           //Supliment a key index number         -- if query format is not key=val
        let parsed_key_val = "";
        let key = "";
        let value = "";

        //Parse query by & sign
        let parse = query.split("&");

        //Check single query like an ID or other
        if(parse.length == 1) {
            //Try split string
            parsed_key_val = parse[0].split("=");
            if(parsed_key_val.length == 1) {
                //This is most likely a single string value (ID or other) but not JSON (try catch above)
                return query;
            }
        }

        //Process the query string
        for(let i in parse) {
            //Try split string
            parsed_key_val = parse[i].split("=");
            if(parsed_key_val.length == 1) {
                key = "";
                value = parsed_key_val[0];
            }else if(parsed_key_val.length == 2) {
                key = parsed_key_val[0];
                value = parsed_key_val[1];
            }else{
                key_index += 1;
                key = `failed_parse${key_index}`;
                value = parse[i];
            }
    
            //Web decode string
            key = decodeURI(key);
            value = decodeURI(value);

            //Test JSON decode
            try {
                value = JSON.parse(value);
                if(key == "") {
                    key = `key_json${key_index}`;
                    key_index += 1;
                }
            }catch(err) {
                if(key == "") {
                    key = `key_string${key_index}`;
                    key_index += 1;
                }
            }
            
            //Add to 
            hashmap[key] = value;
        }

        //Return map
        return hashmap;
    }

    //Stage 1 - Resolve to Hostname / FQDN, Proxy Path, Management UI, VHost Preview
    match_mgmtui(match) {
        //Match log
        match.log += "> Check against Managment UI Hostnames\n";

        //Get hostname and URI path
        let target_hostname = match.url_parsed.hostname;
        let target_uri = match.url_parsed.pathname;

        match.log += `    Target hostname: ${target_hostname}\n`;

        //Loop through hostnames
        let mgmtui_hostnames = this.web_mapping.resolve.mgmtui_map.hostnames;
        for(let i in mgmtui_hostnames) {
            let this_hostname = mgmtui_hostnames[i];
            if(this_hostname == target_hostname) {
                match.state = true;
                match.log += `    YES: Management UI hostname[${this_hostname}] matched\n`;
                match.log += `         Map to 'Management UI'\n`;
                match.match_host = this_hostname;
                match.project = "mgmt";
                match.website = "ui";
                break;
            }else{
                match.log += `    NO: Management UI hostname[${this_hostname}] not matched\n`;
            }
        }

        //Match Dev UI VHost
        if(match.state == true) {
            //Match log
            match.log += "> Check against Management UI VHost paths\n";
            match.log += `    Target URI: ${target_uri}\n`;

            //Get VHost paths
            if(target_uri.match(/\/vhost\/[0-9A-Za-z\-\_\.]*::[0-9A-Za-z\-\_\.]*\//g)) {
                //Search VHost mapping
                let mgmtui_vhosts = this.web_mapping.resolve.mgmtui_map.vhosts;
                for(let vhost in mgmtui_vhosts) {
                    if(target_uri.startsWith(vhost)) {
                        let project = mgmtui_vhosts[vhost]["project"];
                        let website = mgmtui_vhosts[vhost]["website"];
                        match.state = true;
                        match.log += `    YES: Management UI VHost path [${vhost}] matched\n`;
                        match.log += `         Map to project[${project}] website[${website}]\n`;
                        match.match_vhost = vhost;
                        match.project = project;
                        match.website = website;
                        break;
                    }else{
                        match.log += `    NO: Management UI VHost path[${vhost}] not matched\n`;
                    }
                }
            }else{
                match.log += "    URI path is not a VHost path, ignoring\n";
            }
        }

        //Return match
        return match;
    }
    match_proxy_path(match) {
        //Match log
        match.log += "> Check against Proxy Path\n";
        
        //Get full path for proxy match
        let target_hostname = match.url_parsed.hostname;
        let target_uri = match.url_parsed.pathname;
        let target_url_full = target_hostname + target_uri;

        //Cycle proxy mapping
        let proxy_map = this.web_mapping.resolve.proxy_map;
        if(Object.keys(proxy_map).length > 0) {
            //Match log
            match.log += `    Target proxy path: ${target_url_full}\n`;

            //Search for proxy map
            for(let proxy in proxy_map) {
                if(target_url_full.startsWith(proxy)) {
                    let project = proxy_map[proxy]["project"];
                    let website = proxy_map[proxy]["website"];

                    //Check is website field is blank
                    if(website == "") {
                        match.log += `    YES: Proxy map [${proxy}] matched\n`;
                        match.log += `         Website is not defined, ignoring map\n`;
                    }else{
                        match.state = true;
                        match.log += `    YES: Proxy map [${proxy}] matched\n`;
                        match.log += `         Map to project[${project}] website[${website}]\n`;
                        match.match_host = target_hostname;
                        match.match_proxyuri = proxy.replace(target_hostname, "");
                        match.project = project;
                        match.website = website;
                    }
                    break;
                }else{
                    match.log += `    NO: Proxy map [${proxy}] not matched\n`;
                }
            }
        }

        //Return match parameters
        return match
    }
    match_dns_name(match) {
        //Match log
        match.log += "> Check against DNS Names\n";
        
        //Get hostname
        let target_dns_name = match.url_parsed.hostname;

        //Cycle proxy mapping
        let dns_map = this.web_mapping.resolve.dns_map;
        if(Object.keys(dns_map).length > 0) {
            //Match log
            match.log += `    Target DNS Name: ${target_dns_name}\n`;

            //Search for DNS map
            for(let dns in dns_map) {
                if(target_dns_name == dns) {
                    let project = dns_map[dns]["project"];
                    let website = dns_map[dns]["website"];

                    //Check is website field is blank
                    if(website == "") {
                        match.log += `    YES: DNS map [${dns}] matched\n`;
                        match.log += `         Website is not defined, ignoring map\n`;
                    }else{
                        match.state = true;
                        match.log += `    YES: DNS name [${dns}] matched\n`;
                        match.log += `         Map to project[${project}] website[${website}]\n`;
                        match.match_host = target_dns_name;
                        match.project = project;
                        match.website = website;
                    }
                    break;
                }else{
                    match.log += `    NO: DNS name [${dns}] not matched\n`;
                }
            }
        }

        //Return match parameters
        return match
    }
    match_website_sub_map(match) {
        //Match log
        match.log += `> Check website sub mapping for project[${match.project}] website[${match.website}]\n`;
        match.config = this.web_configs.projects[match.project]["websites"][match.website];

        //Check count of sub maps
        let website_config = match.config;
        if(Object.keys(website_config.sub_map).length > 0) {
            //Strip VHost if exists in URI
            let website_uri = "";
            if(match.match_proxyuri != "") {
                website_uri = "/" + (match.url_parsed.path).replace(match.match_proxyuri,"");
            }else if(match.match_vhost != "") {
                website_uri = "/" + (match.url_parsed.path).replace(match.match_vhost,"");
            }else{
                website_uri = match.url_parsed.path;
            }

            match.log += `    Processing website sub mapping for URI[${website_uri}]\n`;

            //Check sub map settings
            let sub_map = website_config.sub_map;
            for(let sub in sub_map) {
                if(website_uri.startsWith(sub)) {
                    let website = sub_map[sub];

                    //Check website field blank
                    if(website == "") {
                        match.log += `    YES: Website sub map [${sub}] matched\n`;
                        match.log += `         Website is not defined, ignoring map\n`;
                    }else{
                        match.match_submap = sub;
                        match.config = this.web_configs.projects[match.project]["websites"][website];
                        match.website = website;
                        match.log += `    YES: Website sub map [${sub}] matched\n`;
                        match.log += `         Map to project[${match.project}] website[${website}]\n`;
                    }
                    break;
                }else{
                    match.log += `    NO: Website sub map [${sub}] not matched\n`;
                }
            }  
        }

        //Return match parameters
        return match;
    }

    //Default system resolve
    match_default_system_404(match) {
        //Match log
        match.log += "    Set default system 404\n";

        //Set web paths
        match.match_host = match.url_parsed.hostname;
        match.website_root_path = this.paths.system;
        match.website_uri_prefix = "/";
        match.website_uri_suffix = match.url_parsed.basepath;

        //Set default system
        match.project = "system";
        match.website = "system";

        //Common settings
        match.default_doc = this.web_mapping.defaults.default_doc;
        match.default_404_user = this.web_mapping.defaults.default_404_user;
        match.default_404_api = this.web_mapping.defaults.default_404_api;
        match.default_500_user = this.web_mapping.defaults.default_500_user;
        match.default_500_api = this.web_mapping.defaults.default_500_api;
        match.maintenance_page = this.web_mapping.defaults.maintenance_page;
        match.maintenance_page_api = this.web_mapping.defaults.maintenance_page_api;

        //Choose file based on execute type
        if(match.file_match_type == "path_static") {
            match.file_exec = "client";
            match.file_name = match.default_404_user;
        }else if(match.file_match_type == "apis_fixed_path" || match.file_match_type == "apis_dynamic_path" || match.file_match_type == "path_static_server_exec") {
            //Set client since this will service a '.json' file, not server side execut            
            match.file_exec = "client";
            match.file_name = match.default_404_api;
        }else{
            match.file_match_type = "path_static";
            match.file_exec = "client";
            match.file_name = match.default_404_user;
        }

        //Set file path
        match.file_path = this.paths.system;
        match.status_code = 404;

        //Return match
        return match;
    }
    match_default_system_maintenance_page(match) {
        //Match log
        match.log += "    Set default system maintenance page\n";

        //Set default system
        match.project = "system";
        match.website = "system";

        //Common settings
        match.default_doc = this.web_mapping.defaults.default_doc;
        match.default_404_user = this.web_mapping.defaults.default_404_user;
        match.default_404_api = this.web_mapping.defaults.default_404_api;
        match.default_500_user = this.web_mapping.defaults.default_500_user;
        match.default_500_api = this.web_mapping.defaults.default_500_api;
        match.maintenance_page = this.web_mapping.defaults.maintenance_page;
        match.maintenance_page_api = this.web_mapping.defaults.maintenance_page_api;

        //Choose file based on execute type
        if(match.file_match_type == "path_static") {
            match.file_exec = "client";
            match.file_name = "maintenance.html";
        }else if(match.file_match_type == "apis_fixed_path" || match.file_match_type == "apis_dynamic_path" || match.file_match_type == "path_static_server_exec") {
            //Set client since this will service a '.json' file, not server side execut            
            match.file_exec = "client";
            match.file_name = "maintenance.json";
        }else{
            match.file_match_type = "path_static";
            match.file_exec = "client";
            match.file_name = "maintenance.html";
        }

        //Set file path
        match.file_path = this.paths.system;
        match.status_code = 200;

        //Return match
        return match;
    }
    match_default_system_request(match) {
        //Set match details
        match.match_host = match.url_parsed.hostname;
        match.website_root_path = this.paths.system;

        //Set default system
        match.project = "system";
        match.website = "system";

        //Common settings
        match.default_doc = this.web_mapping.defaults.default_doc;
        match.default_404_user = this.web_mapping.defaults.default_404_user;
        match.default_404_api = this.web_mapping.defaults.default_404_api;
        match.default_500_user = this.web_mapping.defaults.default_500_user;
        match.default_500_api = this.web_mapping.defaults.default_500_api;
        match.maintenance_page = this.web_mapping.defaults.maintenance_page;
        match.maintenance_page_api = this.web_mapping.defaults.maintenance_page_api;

        //Target URI path
        let this_uri = match.url_parsed.basepath;

        //Remove duplicate '_default_system/_default_system/' string
        if(this_uri.includes("_default_system/_default_system/")) {
            this_uri = this_uri.replace("_default_system/_default_system/", "_default_system/");
        }

        //Check _default_system URI string
        if(this_uri.includes("/_default_system/")) {
            match.log += "    Detected '_default_system' path content\n";
            match.log += `      Target URI[${this_uri}]\n`;

            //Parse the URI
            let parse_uri = this_uri.split("_default_system");
            let relative_sub_uri = parse_uri[1];

            match.website_uri_prefix = parse_uri[0] + "_default_system/";
            match.website_uri_suffix = relative_sub_uri;

            //Define default folder for server execute
            match.file_match_type = "path_static";
            match.file_exec = "client";

            //set path and file
            let this_path = relative_sub_uri;
            let this_file = "";
            if(match.url_parsed.filename == "") {
                this_file = this.web_mapping.defaults.default_doc;
            }else{
                this_file = match.url_parsed.filename;
            }

            //Set path and target
            match.file_path = path.join(this.paths.system,this_path);
            match.file_name = this_file;

            //Output log
            match.log += "      Default System Folder\n";
            match.log += `        Target Path [${relative_sub_uri}]\n`;
            match.log += `        Execute: ${match.file_exec}\n`;
            match.log += `        Path:    ${match.file_path}\n`;
            match.log += `        File:    ${match.file_name}\n`;
        }

        //Return match
        return match;
    }

    //Management UI request content
    match_mgmtui_request(match) {
        match.log += `> Resolved to Management UI\n`;

        //Get Managment UI config
        match.config = this.web_configs.mgmt.websites.ui;

        //Set filesystem root path
        match.website_root_path = path.join(this.paths.localhost);

        //Default parameters
        match.state = true;
        match.ssl_redirect          = match.config.ssl_redirect;
        match.maintenance           = match.config.maintenance[this.env];
        match.maintenance_page      = match.config.maintenance_page;
        match.maintenance_page_api  = match.config.maintenance_page;
        match.default_doc           = match.config.default_doc;
        match.default_404_user      = match.config.default_errors.user["404"];
        match.default_500_user      = match.config.default_errors.user["500"];
        match.default_404_api       = match.config.default_errors.api["404"];
        match.default_500_api       = match.config.default_errors.api["500"];

        //Set URL
        let this_uri = match.url_parsed.basepath;

        //Map API path content
        if((match.url_parsed.basepath.startsWith("/api/") && match.url_parsed.basepath.length > 5) ||
           (match.url_parsed.basepath.startsWith("/api/") && match.url_parsed.filename != "")) {
            match.log += `    Set Dynamic API path\n`;
            match.file_match_type = "apis_dynamic_path";
            match.file_exec = "server";

            //Check parse_url basepath and file
            let this_path = "";
            let this_file = "";
            if(match.url_parsed.filename == "") {
                this_uri = this_uri.substring(0, (this_uri.length - 1)) + ".mjs";
                this_path = path.dirname(this_uri);
                this_file = path.basename(this_uri);
                match.website_uri_suffix = this_path;
                match.file_name = this_file;
            }else{
                this_path = this_uri;
                this_file = path.basename(match.url_parsed.filename);
                match.website_uri_suffix = this_path;
                match.file_name = this_file;
            }

            //Set path and file
            match.file_path = path.join(this.paths.localhost,this_path);
            match.file_name = this_file;
        }else{
            match.log += "    Set Static Content path\n";
            match.file_match_type = "path_static";
            match.file_exec = "client";

            //Set file path
            match.website_uri_suffix = this_uri;
            match.file_path = path.join(this.paths.localhost,this_uri);

            //Set default filename
            if(match.url_parsed.filename == "") {
                match.url_parsed.filename = match.default_doc;
                match.file_name = match.config.default_doc;
            }else{
                match.file_name = match.url_parsed.filename;
            }
        }

        //Check if error pages and javascript
        if(this_uri.includes("_error_pages")) {
            if(path.extname(match.file_name) == ".mjs") {
                match.file_exec = "server";
            }
        }

        //Return match
        return match;
    }
    match_mgmtui_error_pages(match) {
        //Match log
        match.log += "> Check Management UI error page mapping\n";

        //
        // String "/_error_pages/" may be anywhere in the URI path (FQDN, proxy path, VHost path)
        //

        //Target URI path
        let this_uri = match.url_parsed.basepath;

        //Remove duplicate '_error_pages/_error_pages/' string
        if(this_uri.includes("_error_pages/_error_pages/")) {
            this_uri = this_uri.replace("_error_pages/_error_pages/", "_error_pages/");
        }

        //Check error pages URI string
        if(this_uri.includes("/_error_pages/")) {
            match.log += "    Detected '_error_pages' path content\n";

            //Parse URI by '_maintenance_page' string
            let parse_uri = this_uri.split("_error_pages");
            match.website_uri_prefix = parse_uri[0];
            match.website_uri_suffix = parse_uri[1];

            //Define default folder for server execute
            let relative_sub_uri = match.website_uri_suffix
            if((relative_sub_uri.startsWith("/api/") && relative_sub_uri.length > 5) || 
               (relative_sub_uri.startsWith("/api/") && match.url_parsed.filename != "")) {

                //Set type and file exec
                match.file_match_type = "apis_dynamic_path";
                match.file_exec = "server";

                //Define URI as path and file
                let this_url = "";
                let this_path = "";
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    this_url = relative_sub_uri.substring(0, (relative_sub_uri.length - 1)) + ".mjs";
                    this_path = path.dirname(this_url) + "/";
                    this_file = path.basename(this_url);
                }else{
                    this_path = relative_sub_uri;
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.localhost,"_error_pages",this_path);
                match.file_name = this_file;
            }else{
                //Set type and file exec
                match.file_match_type = "path_static";
                match.file_exec = "client";

                //set path and file
                let this_path = relative_sub_uri;
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    this_file = this.web_mapping.defaults["404"];
                }else{
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.localhost,"_error_pages",this_path);
                match.file_name = this_file;
            }

            //Output log
            match.log += "      Error Pages Folder\n";
            match.log += `        Target Path [${relative_sub_uri}]\n`;
            match.log += `        Execute: ${match.file_exec}\n`;
            match.log += `        Path:    ${match.file_path}\n`;
            match.log += `        File:    ${match.file_name}\n`;
        }

        //Return match
        return match;
    }

    //Resolve website sub mapping, get website parameters
    match_website_params(match) {
        //Match log
        match.log += "> Get website parameters\n";

        //Set configurations
        match.ssl_redirect          = match.config.ssl_redirect;
        match.maintenance           = match.config.maintenance[this.env];
        match.maintenance_page      = match.config.maintenance_page;
        match.maintenance_page_api  = match.config.maintenance_page_api;
        match.default_doc           = match.config.default_doc;
        match.default_404_user      = match.config.default_errors.user["404"];
        match.default_404_api       = match.config.default_errors.api["404"];
        match.default_500_user      = match.config.default_errors.user["500"];
        match.default_500_api       = match.config.default_errors.api["404"];
        
        //Set website URI root path
        if(match.match_proxyuri != "") {
            match.website_uri_prefix = (match.match_proxyuri + match.match_submap).replaceAll(/\/+/g, "/");
        }else if(match.match_vhost != "") {
            match.website_uri_prefix = (match.match_vhost + match.match_submap).replaceAll(/\/+/g, "/");
        }

        //Return match parameters
        return match;
    }

    //Website request content
    match_website_request(match) {
        //Match log
        match.log += "> Match request to website mapping\n";

        //Request URI path
        let request_base_path = match.url_parsed.basepath;
        match.log += `    Request URI path[${request_base_path}]\n`;

        //Determine the URI prefix (proxy / vhost + sub map) to get base path of site
        let prefix_base_path = "";
        if(match.match_proxyuri != "") {
            prefix_base_path = (match.match_proxyuri + match.match_submap).replaceAll(/\/+/g, "/");
        }else if(match.match_vhost != "") {
            prefix_base_path = (match.match_vhost + match.match_submap).replaceAll(/\/+/g, "/");
        }else{
            prefix_base_path = (match.match_submap).replaceAll(/\/+/g, "/");
        }

        //Determine URI path from website base path
        let website_uri_path = request_base_path.substring(request_base_path.length - (request_base_path.length - prefix_base_path.length));
        website_uri_path = (`/${website_uri_path}`).replaceAll(/\/+/g, "/");

        match.website_uri_suffix = website_uri_path;

        //Reset match state for website rules check
        match.state = false;

        //Set website default filesystem root path
        match.website_root_path = path.join(this.paths.web_source,match.project,match.website);

        //Process website rules
        match = this.match_website_request_api_fixed(match);
        if(match.state == false) { match = this.match_website_request_api_dynamic(match) }
        if(match.state == false) { match = this.match_website_request_static_server_exec(match) }
        if(match.state == false) { match = this.match_website_request_static_client(match) }

        //Return match
        return match;
    }
    match_website_request_api_fixed(match) {
        //Match log
        match.log += `> Match 'apis_fixed_path' :: project[${match.project}] website[${match.website}]\n`;

        //Get rulesets
        let ruleset_api_fixed = match.config["apis_fixed_path"];

        //Process API fixed rules
        if(Object.keys(ruleset_api_fixed).length == 0) {
            match.log += `    No rules for [apis_fixed_path]\n`;
        }else{
            match.log += `    Process rules [apis_fixed_path]\n`;

            //Sort ruleset
            let sort_keys = []
            for(let api in ruleset_api_fixed) {
                sort_keys.push(api)
            }
            sort_keys.sort((a, b) => b.length - a.length);

            //Loop keys and search for match
            let this_uri = match.website_uri_suffix;
            for(let i in sort_keys) {
                let match_string = sort_keys[i];
                if(this_uri.startsWith(match_string)) {
                    match.log += `    - YES: Rule [${match_string}] matched [${this_uri}]\n`;

                    //Get path value
                    let rule_target_file_path = ruleset_api_fixed[match_string];
                    match.log += `           Target Path [${rule_target_file_path}]\n`;

                    //Create API fixed path trailing parsed URL
                    let trail_uri = this_uri.substring(match_string.length, this_uri.length);
                    if(trail_uri.substring(trail_uri.length - 1) == "/") {
                        trail_uri = trail_uri.substring(0, trail_uri.length - 1);
                    }
                    if(trail_uri != "") {
                        let parse_trail_url = trail_uri.split("/")
                        if(parse_trail_url.length > 0) {
                            match.fixed_api_path = parse_trail_url;
                        }
                    }

                    //Set file path
                    let target_path = path.join(this.paths.web_source,match.project,rule_target_file_path)
                    let file_path = path.dirname(target_path)
                    let file_name = path.basename(target_path)

                    //Set match state
                    match.state = true;
                    match.file_match_type = "apis_fixed_path";
                    match.file_exec = "server";
                    match.file_path = file_path;
                    match.file_name = file_name;

                    match.log += `           Execute: ${match.file_exec}\n`;
                    match.log += `           Path:    ${match.file_path}\n`;
                    match.log += `           File:    ${match.file_name}\n`;

                    break;
                }else{
                    match.log += `    - NO: Rule [${match_string}] no match\n`;
                }
            }
        }

        //Return match
        return match;
    }
    match_website_request_api_dynamic(match) {
        //Match log
        match.log += `> Match 'apis_dynamic_path' :: project[${match.project}] website[${match.website}]\n`;
        
        //Get rulesets
        let ruleset_api_dynamic = match.config["apis_dynamic_path"];

        //Process API dynamic rules
        if(match.state == false) {
            if(Object.keys(ruleset_api_dynamic).length == 0) {
                match.log += `    No rules for [apis_dynamic_path]\n`;
            }else{
                match.log += `    Process rules [apis_dynamic_path]\n`;

                //Sort ruleset
                let sort_keys = []
                for(let api in ruleset_api_dynamic) {
                    sort_keys.push(api)
                }
                sort_keys.sort((a, b) => b.length - a.length);

                //Loop keys and search for match
                let this_uri = match.website_uri_suffix;
                for(let i in sort_keys) {
                    let match_string = sort_keys[i];
                    if(this_uri.startsWith(match_string)) {
                        match.log += `    - YES: Rule [${match_string}] matched [${this_uri}]\n`;

                        //Get ruleset target
                        let rule_target_file_path = ruleset_api_dynamic[match_string];
                        match.log += `           Target Path [${rule_target_file_path}]\n`;

                        //Get trailing URI from match
                        let uri_tail = "/" + this_uri.substring(this_uri.length - (this_uri.length - match_string.length));

                        //Get sub folder from website target
                        let website_basepath = (`/${match.website}`)
                        let path_subfolder = rule_target_file_path.substring(rule_target_file_path.length - (rule_target_file_path.length - website_basepath.length));

                        //Set path from website
                        let target_path = (`/${path_subfolder}/${uri_tail}/`).replaceAll(/\/+/g, "/");

                        //Set start vars
                        let this_sub_path = "";
                        let this_file = "";

                        //Check base URI path without specifying a sub path
                        if(uri_tail == "/") {
                            match.log += `           NO: Base API Path detected with no API target [${uri_tail}]\n`;
                            return match;
                        }else{
                            //Process target path, determine if filename already detected
                            if(match.url_parsed.filename == "") {
                                //Filename is blank, change trailing slash to file extension
                                target_path = target_path.substring(0, target_path.length - 1) + ".mjs";
                                this_sub_path = path.dirname(target_path);
                                this_file = path.basename(target_path);
                            }else{
                                this_sub_path = target_path;
                                this_file = match.url_parsed.filename;
                            }
                        }

                        //Define target path
                        let file_path = path.join(match.website_root_path,this_sub_path);
                        let file_name = this_file;

                        //Set match state
                        match.state = true;
                        match.file_match_type = "apis_dynamic_path";
                        match.file_exec = "server";
                        match.file_path = file_path;
                        match.file_name = file_name;

                        match.log += `           Execute: ${match.file_exec}\n`;
                        match.log += `           Path:    ${match.file_path}\n`;
                        match.log += `           File:    ${match.file_name}\n`;

                        break;
                    }else{
                        match.log += `    - NO: Rule [${match_string}] no match\n`;
                    }
                }
            }
        }

        //Return match
        return match;
    }
    match_website_request_static_server_exec(match) {
        //Match log
        match.log += `> Match 'path_static_server_exec' :: project[${match.project}] website[${match.website}]\n`;

        //Get rulesets
        let ruleset_static_exec = match.config["path_static_server_exec"];

        //Process Static Content for Server Side Execution rules
        if(match.state == false) {        
            if(Object.keys(ruleset_static_exec).length == 0) {
                match.log += `    No rules for [path_static_server_exec]\n`;
            }else{
                match.log += `    Process rules [path_static_server_exec]\n`;
            }

            //Sort ruleset
            let sort_keys = []
            for(let api in ruleset_static_exec) {
                sort_keys.push(api)
            }
            sort_keys.sort((a, b) => b.length - a.length);

            //Loop keys and search for match
            let this_uri = match.website_uri_suffix;
            let this_file_name = match.url_parsed.filename;
            for(let i in sort_keys) {
                let match_string = sort_keys[i];
                let static_path = this_uri + this_file_name;

                if(static_path == match_string) {
                    match.log += `    - YES: Rule [${match_string}] matched [${static_path}]\n`;

                    //Get path value
                    let rule_target_file_path = ruleset_static_exec[match_string];
                    match.log += `           Target Path [${rule_target_file_path}]\n`;

                    //Set file path
                    let target_path = path.join(this.paths.web_source,match.project,rule_target_file_path)
                    let file_path = path.dirname(target_path)
                    let file_name = path.basename(target_path)

                    //Set match state
                    match.state = true;
                    match.file_match_type = "path_static_server_exec";
                    match.file_exec = "server";
                    match.file_path = file_path;
                    match.file_name = file_name;

                    match.log += `           Execute: ${match.file_exec}\n`;
                    match.log += `           Path:    ${match.file_path}\n`;
                    match.log += `           File:    ${match.file_name}\n`;

                    break;
                }else{
                    match.log += `    - NO: Rule [${match_string}] no match\n`;
                }
            }
        }

        //Return match
        return match;
    }
    match_website_request_static_client(match) {
        //Match log
        match.log += `> Match 'path_static' :: project[${match.project}] website[${match.website}]\n`;

        //Get rulesets
        let ruleset_static = match.config["path_static"];

        //Process Static Conent for Client rules
        if(match.state == false) {        
            if(Object.keys(ruleset_static).length == 0) {
                match.log += `    No rules for [path_static]\n`;
            }else{
                match.log += `    Process rules [path_static]\n`;

                //Sort ruleset
                let sort_keys = []
                for(let api in ruleset_static) {
                    sort_keys.push(api)
                }
                sort_keys.sort((a, b) => b.length - a.length);

                //Loop keys and search for match
                let this_uri = match.website_uri_suffix;
                let this_file_name = match.url_parsed.filename;
                for(let i in sort_keys) {
                    let match_string = sort_keys[i];
                    if(this_uri.startsWith(match_string)) {
                        match.log += `    - YES: Rule [${match_string}] matched [${this_uri}]\n`;

                        //Get ruleset target
                        let rule_target_file_path = ruleset_static[match_string];
                        match.log += `           Target Path [${rule_target_file_path}]\n`;

                        //Get trailing URI from match
                        let uri_tail = "/" + this_uri.substring(this_uri.length - (this_uri.length - match_string.length));

                        //Get sub folder from website target
                        let website_basepath = (`/${match.website}`)
                        let path_subfolder = rule_target_file_path.substring(rule_target_file_path.length - (rule_target_file_path.length - website_basepath.length));

                        //Set path from website
                        let target_path = (`/${path_subfolder}/${uri_tail}/`).replaceAll(/\/+/g, "/");

                        //Set file path
                        let file_path = path.join(match.website_root_path,target_path);
                        let file_name = path.basename(this_file_name);

                        //Check if filename is blank
                        if(this_file_name == "") {
                            file_name = match.default_doc;
                        }else{
                            file_name = this_file_name;
                        }

                        //Catch file name blank and use system default (catch blank default document)
                        if(file_name == undefined || file_name == "" || file_name == null) {
                            file_name = this.web_mapping.defaults.default_doc;
                        }

                        //Set match state
                        match.state = true;
                        match.file_path = file_path;
                        match.file_name = file_name;

                        //Check if default document is '.js'
                        if(path.extname(match.default_doc) == ".mjs") {
                            match.file_match_type = "path_static_server_exec";
                            match.file_exec = "server";
                        }else{
                            match.file_match_type = "path_static";
                            match.file_exec = "client";
                        }

                        match.log += `           Execute: ${match.file_exec}\n`;
                        match.log += `           Path:    ${match.file_path}\n`;
                        match.log += `           File:    ${match.file_name}\n`;

                        break;
                    }else{
                        match.log += `    - NO: Rule [${match_string}] no match\n`;
                    }
                }
            }
        }

        //Return match
        return match;
    }

    //Maintenance mode check (redirect to maintenance page)
    match_website_maintenance_mode(match) {
        //Match log
        match.log += "> Check website maintenance mode\n";

        // Detect maintenance mode
        // Accept path to '_maintenance_page'
        // Deny all other path requests

        // Uncustomizable settings
        // */_maintenance_page/api/*                         path is treated as server side execute only
        // */_maintenance_page/<maintenance_doc_name>.js     with JS extension is treated like a static content server exec override
        // */_maintenance_page/*                             all paths not matching above is treated as static content

        //
        // String "/_maintenance_page/" may be anywhere in the URI path (FQDN, proxy path, VHost path)
        //

        //For preview of maintenance page while maintenance mode is off, the URI may have /_maintenance_page/_maintenance_page/ when
        //the secondary load of CSS, IMG and other files are loading from default maintenance page file. index.html or other default
        //must use relative path to include css, images and javascript files (e.g. '_maintenance_page/css/styles.css'). This will
        //result in duplicate string.

        //Remove duplicate '_maintenance_page/_maintenance_page/' string
        if(match.website_uri_suffix.includes("_maintenance_page/_maintenance_page/")) {
            match.website_uri_suffix = match.website_uri_suffix.replace("_maintenance_page/_maintenance_page/", "_maintenance_page/");
        }

        //Get website config
        if(match.config.maintenance[this.env] == true) {
            match.log += "    Maintenance mode is enabled\n";

            //Check if in vhost preview mode
            if(match.match_vhost != "") {
                match.log += "      VHost previews allowed to access main website content\n";
                match.log += "      Proxy and DNS mapping will redirect to maintenance page\n";
            }else{
                match.log += "      Block all website requests and redirect to maintenance page\n";

                //Ignore if maintenance page content is already requests
                if(match.website_uri_suffix.includes("/_maintenance_page/") == false) {
                    if(match.file_match_type == "apis_fixed_path" || match.file_match_type == "apis_dynamic_path") {
                        match.log += "      Map to website maintenance page for APIs\n";

                        //Set maintenance file as default document
                        match.file_name = match.maintenance_page_api;
                    }else{
                        match.log += "      Map to website maintenance page\n";

                        //Set maintenance file as default document
                        match.file_name = match.maintenance_page;
                    }

                    //Set maintenance file as default document
                    match.file_path = path.join(match.website_root_path,"_maintenance_page/");

                    //Catch blank filename
                    if(match.file_name == "") {
                        match.file_name = this.web_mapping.defaults.maintenance_page;
                    }

                    match.log += `        Set target path[${match.file_path}]\n`;
                    match.log += `        Set target file[${match.file_name}]\n`;

                    //Determine client or server execute
                    match.file_match_type = "path_static";
                    match.file_exec = "client";
                    if(path.extname(match.file_name) == ".mjs") {
                        match.file_match_type = "path_static_server_exec";
                        match.file_exec = "server";
                    }

                }
            }
        }else{
            match.log += "    Maintenance mode is disabled\n";
        }

        //Allow maintenance page override to view when maintenance is disabled
        if(match.website_uri_suffix.includes("/_maintenance_page/")) {
            match.log += "    Detected '_maintenance_page' path content\n";

            //Parse URI by '_maintenance_page' string
            let parse_uri = match.website_uri_suffix.split("_maintenance_page");
            match.website_uri_prefix = parse_uri[0];
            match.website_uri_suffix = parse_uri[1];

            //Define default folder for server execute
            let relative_sub_uri = match.website_uri_suffix
            if((relative_sub_uri.startsWith("/api/") && relative_sub_uri.length > 5) || 
               (relative_sub_uri.startsWith("/api/") && match.url_parsed.filename != "")) {
 
                //Set type and file exec
                match.file_match_type = "apis_dynamic_path";
                match.file_exec = "server";

                //Define URI as path and file
                let this_url = "";
                let this_path = "";
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    this_url = relative_sub_uri.substring(0, (relative_sub_uri.length - 1)) + ".mjs";
                    this_path = path.dirname(this_url) + "/";
                    this_file = path.basename(this_url);
                }else{
                    this_path = relative_sub_uri;
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.web_source,match.project,match.website,"_maintenance_page",this_path);
                match.file_name = this_file;
            }else{
                //Set type and file exec
                match.file_match_type = "path_static";
                match.file_exec = "client";

                //set path and file
                let this_path = relative_sub_uri;
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    this_file = this.web_mapping.defaults.default_doc;
                }else{
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.web_source,match.project,match.website,"_maintenance_page",this_path);
                match.file_name = this_file;
            }

            //Output log
            match.log += "      Maintenance Page Folder\n";
            match.log += `        Target Path [${relative_sub_uri}]\n`;
            match.log += `        Execute: ${match.file_exec}\n`;
            match.log += `        Path:    ${match.file_path}\n`;
            match.log += `        File:    ${match.file_name}\n`;
        }

        //Return match
        return match;
    }
    match_website_error_pages(match) { //// Needs to detect Match Type (path_static or API)
        //Match log
        match.log += "> Check website error page mapping\n";

        //
        // String "/_error_pages/" may be anywhere in the URI path (FQDN, proxy path, VHost path)
        //

        //For preview of maintenance page while maintenance mode is off, the URI may have /_error_pages/_error_pages/ when
        //the secondary load of CSS, IMG and other files are loading from default maintenance page file. index.html or other default
        //must use relative path to include css, images and javascript files (e.g. '_error_pages/css/styles.css'). This will
        //result in duplicate string.

        //Remove duplicate '_error_pages/_error_pages/' string
        if(match.website_uri_suffix.includes("_error_pages/_error_pages/")) {
            match.website_uri_suffix = match.website_uri_suffix.replace("_error_pages/_error_pages/", "_error_pages/");
        }

        //Check error pages URI string
        if(match.website_uri_suffix.includes("/_error_pages/")) {
            match.log += "    Detected '_error_pages' path content\n";

            //Parse URI by '_error_pages' string
            let parse_uri = match.website_uri_suffix.split("_error_pages");
            match.website_uri_prefix = parse_uri[0];
            match.website_uri_suffix = parse_uri[1];

            //Define default folder for server execute
            let relative_sub_uri = match.website_uri_suffix
            if((relative_sub_uri.startsWith("/api/") && relative_sub_uri.length > 5) || 
               (relative_sub_uri.startsWith("/api/") && match.url_parsed.filename != "")) {

                // This configured a dynamic API preset path '_error_pages/api/*' for user to leverage back end server
                // code execution to do specific actions as required. Assumed most error pages will be static
                // source files. This is an optional feature.

                //Set type and file exec
                match.file_match_type = "apis_dynamic_path";
                match.file_exec = "server";

                //Define URI as path and file
                let this_url = "";
                let this_path = "";
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    this_url = relative_sub_uri.substring(0, (relative_sub_uri.length - 1)) + ".mjs";
                    this_path = path.dirname(this_url) + "/";
                    this_file = path.basename(this_url);
                }else{
                    this_path = relative_sub_uri;
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.web_source,match.project,match.website,"_error_pages",this_path);
                match.file_name = this_file;
            }else{

                // All static files mapped from website '_error_pages/*'

                //Set type and file exec
                match.file_match_type = "path_static";
                match.file_exec = "client";

                //set path and file
                let this_path = relative_sub_uri;
                let this_file = "";
                if(match.url_parsed.filename == "") {
                    //Filename not specified will use website defined 404 page
                    this_file = match.default_404_user;

                    //Use system default filename if file not defined, 404 catch at file / content verify
                    if(this_file == "") {
                        this.web_mapping.defaults.default_404_user;
                    }
                }else{
                    this_file = match.url_parsed.filename;
                }

                //Set path and target
                match.file_path = path.join(this.paths.web_source,match.project,match.website,"_error_pages",this_path);
                match.file_name = this_file;
            }

            //Output log
            match.log += "      Error Pages Folder\n";
            match.log += `        Target Path [${relative_sub_uri}]\n`;
            match.log += `        Execute: ${match.file_exec}\n`;
            match.log += `        Path:    ${match.file_path}\n`;
            match.log += `        File:    ${match.file_name}\n`;
        }

        //Return match
        return match;
    }

    //Validate request content exists, handle website 404 page, default to site 404
    match_check_request_content(match) {
        //Match log
        match.log += "> Check website source request\n";

        // General logic
        // _default_system is handled before Management UI and hosted websites. File resolution is completed in those functions
        // Management UI requests are handled before hosted websites. File resolution is completed in those functions
        // _maintenance_page folder is located in the root of the website folder, not in a sub folder. File resolution handled by maintenance functions
        // _error_pages folder is located in the root of the website folder, not in a sub folder. File resolution handled by error pages functions
        //
        // Above only maps to source path but does not validate file exists
        //
        // This function should handle file existence
        //    1) Check content exists and complete
        //    2) Chech content not exist, handle missing content
        //       - Check '_default_system' path
        //         - Check default system file list, if missing trigger 500 status and return null (system fault)
        //         - Check if other file rquest
        //           - Check if known system file like HTML, CSS, IMG or JS files, if missing trigger 404 status and return null (system fault)
        //           - If requesting file that is not known by system, redirect to default 404, set 404 status
        //       - Check '_maintenance_page' path
        //         - If website default maintenance page is missing, try and use '_default_system' maintenance page catch all
        //         - If not the default website maintenance page (sub content like HTML, CSS, IMG or JS), trigger 404 status
        //           - Check if website 404 is defined and exists
        //           - If not existing, use default system 404
        //       - Check '_error_pages' path
        //         - Check if website default error page, if does not exist set default system error page, set status code
        //         - Check if not default error page, this is most likely content like HTML, CSS, IMG or JS files
        //           - For sub content of _error_pages do not use website default error page (may have code errors and will cause request loop)
        //           - Set status code 404 and resolve to default system 404 page
        //       - Check website content path
        //         - If content files does not exist, set website default 404
        //         - If website default 404 does not exist, use default system 404
        //

        //Check file exists
        let file_exist = false;
        if(!(match.file_path == "" || match.file_name == "")) {
            //Get target file
            let target_file = path.join(match.file_path, match.file_name);
            match.log += `    Target file: ${target_file}\n`;

            //Check if file exists
            file_exist = this.match_file_exists(target_file);
        }else{
            //File and path not matched to site rules
            match.log += `    No matching rules found\n`;
        }

        //Handle missing
        if(file_exist == false) {
            match.log += `      Content file not found\n`;

            //Determine target path
            if(match.file_path.includes("default_system")) {
                match = this.match_file_not_exist_default_system(match);
            }else if(match.file_path.includes("_maintenance_page")) {
                match = this.match_file_not_exist_maintenance_page(match);
            }else if(match.file_path.includes("_error_pages")) {
                match = this.match_file_not_exist_error_pages(match);
            }else if(match.project == "mgmt") {
                match = this.match_file_not_exist_mgmtui(match);
            }else{
                match = this.match_file_not_exist_website_content(match);
            }

            //Output log
            match.log += `    Focus Content Load:\n`;
            match.log += `      Error Pages Folder\n`;
            match.log += `        Type:    ${match.file_match_type}\n`;
            match.log += `        Execute: ${match.file_exec}\n`;
            match.log += `        Path:    ${match.file_path}\n`;
            match.log += `        File:    ${match.file_name}\n`;
        }else{
            match.log += `    Content file exists, continue to serve request'\n`;
        }

        //Return match
        return match;
    }
    match_file_exists(target_file) {
        //Check file path
        if(fs.existsSync(target_file)) {
            return true;
        }else{
            return false;
        }
    }
    match_file_not_exist_default_system(match) {
        match.log += `      Request '_default_system'\n`;

        // File not found to a file that belongs to default system should not route back to 404 default page.
        // Example: If a CSS, Image or JavaScript file or other reference from the 404.html is not found from
        //          a system error or deleted file, this need to avoid pointing back at the 404.html and trying
        //          to load the same missing files. At this point it should be caught as a system fault. Any
        //          files that are not part of the default list can be pointed to default 404.html page.

        //System path files
        let default_system_files = [
            "/index.html",
            "/maintenance.html",
            "/maintenance.json",
            "/404.html",
            "/404.json",
            "/500.html",
            "/500.json",
            "/css/common.css",
            "/images/404.png",
            "/images/500.png"
        ]

        //Get the URI
        let uri_path = `${match.website_uri_suffix}${match.file_name}`;

        //Check is known system file is missing
        let check_missing = default_system_files.includes(uri_path);
        if(check_missing == true) {
            match.log += `      *** Default System File[${uri_path}] is Missing ***\n`;
            match.error = true;
            match.status_code = 500;
            match.status_msg = "Default System file is missing";
        }else{
            //Set default 404
            match = this.match_default_system_404(match);
        }

        //Return match
        return match;
    }
    match_file_not_exist_maintenance_page(match) {
        match.log += `      Validate '_maintenance_page' focus from project[${match.project}] website[${match.website}]\n`;

        //Use system default maintenance page
        match = this.match_default_system_maintenance_page(match);

        //Return match
        return match;
    }
    match_file_not_exist_error_pages(match) {
        match.log += `      Validate '_error_pages' focus from project[${match.project}] website[${match.website}]\n`;

        //Get website default maintenance page
        if(match.project == "mgmt") {
            //Set error page for missing content file
            match.file_match_type = "path_static";
            match.file_exec = "client";
            match.file_path = path.join(this.paths.localhost,"_error_pages");
            match.file_name = "404.html";
        }else{
            //Avoid pointing to website default 404 in case default 404 page is calling missing content. Can start a request loop.
            match.log += `      Website default 404 error pages not found, user default system 404 page\n`;
            match = this.match_default_system_404(match);
        }

        //Return match
        return match;
    }
    match_file_not_exist_mgmtui(match) {
        match.log += `      Set Error Page from Managment UI\n`;

        //Check VHost path error
        if(match.url_parsed.basepath.match(/\/vhost\/[0-9A-Za-z\-\_]*::[0-9A-Za-z\-\_]*\//g)) {
            match.log += `        Invalid VHost Path: ${match.url_parsed.basepath}\n`;

            //Set Management UI VHost path error page
            match.file_match_type = "path_static";
            match.file_exec = "client";
            match.file_path = path.join(this.paths.localhost,"_error_pages");
            match.file_name = "vhost_error.html";
            match.status_code = 404;
        }else{
            //Common
            match.file_exec = "client";
            match.file_path = path.join(this.paths.localhost,"_error_pages");
            match.status_code = 404;

            if(match.file_match_type == "path_static") {
                //Set client error page
                match.file_name = "404.html";
            }else{
                //Set API error page
                match.file_match_type = "apis_dynamic_path";
                match.file_name = "404.json";
            }
        }

        //Return match
        return match;
    }
    match_file_not_exist_website_content(match) {
        match.log += `      Set Error Page from project[${match.project}] website[${match.website}]\n`;

        //Set files based on API or user request
        let target_file = match.default_404_user;
        if(match.file_match_type == "apis_fixed_path" || match.file_match_type == "apis_dynamic_path") {
            target_file = match.default_404_api;
        }

        //Check filename is not blank
        if(target_file == "" || match.file_match_type == "") {
            match.log += `      No default error page defined, use system default\n`;
            match = this.match_default_system_404(match);
        }else{
            //Set error page target
            let target_path = path.join(this.paths.web_source, match.project, match.website, "_error_pages")
            let this_error_page = path.join(target_path, target_file);

            //Check target error page exists
            if(this.match_file_exists(this_error_page) == false) {
                match.log += `        Website Error Page not found: ${this_error_page}\n`;
                match.log += `        Call default system 404 function\n`;

                //Call default 404
                match = this.match_default_system_404(match);
            }else{
                match.log += `        Error Page found\n`;

                match.file_exec = "client";
                match.file_path = target_path;
                match.file_name = target_file;
                match.status_code = 404;
            }
        }


        //Return match
        return match;
    }
}

//Export modules
export default vhost_mapping;