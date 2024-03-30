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

VHost server class (web services)

*/

//
// Node JS virtual host server
//

//Set Node JS constants
const http = require("http");
const https = require("https");
const url = require("url");
const os = require("os");
const fs = require("fs");
const path = require("path");

//Set vhost logger
const vhost_logger = require(path.join(__dirname,"vhost_logger.js"));
const logger = new vhost_logger()

//Server class
class vhost_server {
    //System details
    hostname = "localhost";     //Hostname of running instance
    ipv4_address = "";          //Local IPv4 address
    ipv6_address = "";          //Local IPv6 address

    //Default class settings - set via server_conf.json
    workers = 1;                //Number of worker processes
    cache_on = false;           //Server side cache of import files (cache in production)
    debug_mode_on = false;      //Debug output
    server_mode = "dev";        //Server modes 'dev' or 'prod'
    server_dev_ui = [];         //Development mode resolve name (UI management) -- TBD
    environment="";             //User defined environment name (development, qa, stage, prod, etc)
	http_on=true;               //HTTP enable
	http_port=80;               //HTTP port
	https_on=true;              //HTTPS enable
	https_port=443;             //HTTPS port
	ssl_key="";                 //SSL certificate private key (single, SAN, wildcard or self signed)
	ssl_cert="";                //SSL certificate certificate (single, SAN, wildcard or self signed)
    auto_refresh_on=true;       //Web project configuration auto reload on changes
    auto_refresh_timer=10000;   //Time check for config changes (1,000 = 1 second)

    //Start up cached files
    running_cache = {};

    //System paths
    paths = {}                  //System paths

    //Configurations and mapping
    web_configs = {};		    //Configuration settings for each site
    web_dns_mapping = {};       //Mapping DNS FQDN to content
    web_dev_mapping = {};       //Dev preview (vhost)

    //https options
    ssl_certificate = {};

    //Construct class
    constructor() { 
        //Start class initialization
        this.define_paths()

        //Check essetial files
        this.check_paths();

        //Load vhost_server config
        this.load_server_config();

        //Disable debug mode with more than one worker process
        if(this.workers > 1) {
            this.debug_mode_on = false;
        }

        //Capture cached files
        this.running_cache = JSON.parse(JSON.stringify(require.cache));
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
        this.paths["errors"] = path.join(root,"server","default_errors",path.sep);
        this.paths["localhost"] = path.join(root,"server","localhost",path.sep);
        this.paths["web_source"] = path.join(root,"web_source",path.sep);
        this.paths["web_templates"] = path.join(root,"web_templates",path.sep);        
    }
    check_paths() {
        //Check required directories
        if(!fs.existsSync(this.paths["conf"])){
            fs.mkdirSync(this.paths["conf"]);
        }
        if(!fs.existsSync(this.paths["web_source"])){
            fs.mkdirSync(this.paths["web_source"]);
        }
        if(!fs.existsSync(this.paths["web_templates"])){
            fs.mkdirSync(this.paths["web_templates"]);
        }

        //Check server config file
        let this_conf = `${this.paths["conf"]}server_conf.json`;
        if(!fs.existsSync(this_conf)){
            let conf_data = {
                "workers":1,
                "cache_on":false,
                "debug_mode_on":true,
                "server_mode":"dev",
                "server_dev_ui":[],
                "environment":"dev",
                "http_on":true,
                "http_port":80,
                "https_on":true,
                "https_port":443,
                "ssl_key":"key.pem",
                "ssl_cert":"cert.pem",
                "auto_refresh_on":true,
                "auto_refresh_timer":5000
            }
            conf_data = JSON.stringify(conf_data,null,"\t")
            fs.writeFileSync(this_conf, conf_data)
        }
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
                console.error(" :: Cannot open server conf [" + server_conf + "] :: JSON config parse error, ignoring");
                return;
            }

            //Load config settings
            if(json.workers != undefined) {
                this.workers = json.workers;
            }
            if(json.cache_on != undefined) {
                (json.cache_on == false) ? this.cache_on = false : this.cache_on = true;
            }
            if(json.debug_mode_on != undefined) {
                (json.debug_mode_on == false) ? this.debug_mode_on = false : this.debug_mode_on = true;
            }
            if(json.server_mode != undefined) {
                (json.server_mode == "prod") ? this.server_mode = "prod" : this.server_mode = "dev";
            }
            if(json.server_dev_ui != undefined) {
                this.server_dev_ui.push("localhost");
                this.server_dev_ui.push(this.hostname);
                for(let i in json.server_dev_ui) {
                    let hostname = json.server_dev_ui[i];
                    if(this.server_dev_ui.indexOf(hostname) == -1) {
                        this.server_dev_ui.push(hostname);
                    }
                }
            }
            if(json.environment != undefined) {
                this.environment = json.environment;
            }
            if(json.http_on != undefined) {
                (json.http_on == true) ? this.http_on = true : this.http_on = false;
            }
            if(json.http_port != undefined) {
                if(isNaN(json.http_port) == false) {
                    if(json.http_port > 0 && json.http_port < 65536) {
                        this.http_port = json.http_port;
                    }
                }
            }
            if(json.https_on != undefined) {
                (json.https_on == true) ? this.https_on = true : this.https_on = false;
            }
            if(json.https_port != undefined) {
                if(isNaN(json.https_port) == false) {
                    if(json.https_port > 0 && json.https_port < 65536 && json.https_port != json.http_port) {
                        this.https_port = json.https_port;
                    }
                }
            }
            if(json.ssl_key != undefined) {
                this.ssl_key = json.ssl_key
            }
            if(json.ssl_cert != undefined) {
                this.ssl_cert = json.ssl_cert
            }
            if(json.auto_refresh_on != undefined) {
                (json.auto_refresh_on == true) ? this.auto_refresh_on = true : this.auto_refresh_on = false;
            }
            if(json.auto_refresh_timer != undefined) {
                if(isNaN(json.auto_refresh_timer) == false) {
                    this.auto_refresh_timer = json.auto_refresh_timer;
                }
            }
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
                        this.load_server_ipaddr_dev_ui(this_ipconf.address)

                        //Determine host primary IP address
                        if(this_ipconf.address != "127.0.0.1" && ipv4_select == false) {
                            ipv4_select = true;
                            this.ipv4_address = this_ipconf.address;
                        }
                    }else if(this_ipconf.family == "IPv6") {
                        //Add to server Dev UI IP list
                        this.load_server_ipaddr_dev_ui(this_ipconf.address)

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
    load_server_ipaddr_dev_ui(ipaddr=null){
        if(ipaddr != null) {
            if(ipaddr != "" && this.server_dev_ui.indexOf(ipaddr) == -1) {
                this.server_dev_ui.push(ipaddr);
            }
        }
    }

    //Console.log
    async log(data={}) {
        //Check log output empty
        if(Object.keys(data).length === 0) {
            return;
        }

        //Set default log message
        let this_log = {
            "project":"",
            "state":"info",
            "message":"",
            "log":{"log":"none"}
        }

        //Validate fields
        if(data.project != undefined) {
            this_log.project = data.project
        }
        if(data.state != undefined) {
            this_log.state = data.state
        }
        if(data.message != undefined) {
            this_log.message = data.message
        }
        if(data.log != undefined) {
            this_log.log = data.log
        }

        //Output in debug mode
        if(this.debug_mode_on == true) {
            if(data.message != undefined) {
                console.log(`   :: ${this_log.message}`);
            }
        }

        //Send to logger
        logger.log(this_log)
    }
    consolelog(message) {
        if(this.debug_mode_on == true) {
            console.log(message);
        }
    }

    //////////////////////////////////////
    // Format and sort functions
    //////////////////////////////////////

    format_url(this_path) {
        //Check starts with /
        if(this_path.startsWith("/") == false) {
            this_path = "/" + this_path;
        }

        //Check ends with /
        if(path.extname(this_path) == "") {
            if(this_path.endsWith("/") == false) {
                this_path = this_path + "/";
            }
        }
        
        //Return path
        return this_path;
    }
    format_path(this_path) {
        //Replace '/' with platform separator if windows
        let this_pattern = "/"
        this_path = this_path.replace(new RegExp(this_pattern, "g"), path.sep)

        //Ensure start and end has OS slash
        if(this_path.startsWith(path.sep) == false) {
            this_path = `${path.sep}${this_path}`;
        }
        let ext = path.extname(this_path);
        if(ext == "") {
            if(this_path.endsWith(path.sep) == false) {
                this_path = `${this_path}${path.sep}`;
            }
        }
        
        //Return path
        return this_path;
    }
    sort_mapping(this_mapping) {
        //Set properties
        let sort_mapping = this_mapping;
        let new_mapping = {};
        let key_string = "";
        
        //New mapping order
        sort_mapping = Object.keys(sort_mapping).sort().reverse();
        for(let item in sort_mapping) {
            key_string = sort_mapping[item];
            new_mapping[key_string] = this_mapping[key_string];
        }
        
        //Return
        return new_mapping;
    }    

    //////////////////////////////////////
    // Class functions
    //////////////////////////////////////
  
    get(property=null) {
        switch(property) {
            case "workers":
                return this.workers;
            break;
            case "debug_mode_on":
                return this.debug_mode_on;
            break;            
            case "auto_refresh_on":
                return this.auto_refresh_on;
            break;
            case "auto_refresh_timer":
                return this.auto_refresh_timer;
            break;
            default:
                return null;
        }
    }

    //////////////////////////////////////
    // Configuration query
    //////////////////////////////////////

    refresh_web_configs() {

        //
        // Run on load and timer based query
        // - Processes all the website project conf files
        // - Update on changed configuration (conf file time stamp)
        // - Remove configurations for removed websites
        //
        // On change detected, update indexes
        // - Create URL mapping index for web request (on configuration changes / remove only)
        // - Create streamlined URL to PATH mappings to get close to best performance 
        //

        //Initialize default mapping -- on server start with no project folders (dev mode only)
        if(this.server_mode == "dev") {
            if(Object.keys(this.web_dns_mapping).length == 0) {
                //Map default DNS for dev mode
                for(let i in this.server_dev_ui) {
                    let this_dns = this.server_dev_ui[i];

                    //Mapping dev UI names
                    this.web_dns_mapping[this_dns] = {}
                    this.web_dns_mapping[this_dns]["project"] = "system";
                    this.web_dns_mapping[this_dns]["ssl_redirect"] = true;
                    this.web_dns_mapping[this_dns]["maintenance_mode"] = false;
                    this.web_dns_mapping[this_dns]["maintenance_doc"] = "";
                    this.web_dns_mapping[this_dns]["default_doc"] = "index.html";
                    this.web_dns_mapping[this_dns]["default_404"] = "404.js";
                    this.web_dns_mapping[this_dns]["default_500"] = "500.js";
                    this.web_dns_mapping[this_dns]["apis_fixed"] = {}
                    this.web_dns_mapping[this_dns]["apis_dynamic"] = {
                        "/api/":`${this.paths["localhost"]}api${path.sep}`
                    }
                    this.web_dns_mapping[this_dns]["path_static_exec"] = {}
                    this.web_dns_mapping[this_dns]["paths_static"] = {
                        "/":this.paths["localhost"]
                    }
                }
            }
        }

        //Start refresh
        this.refresh_web_configs_check();
    }
    refresh_web_configs_check() {
        //Set vars
        let web_path = this.paths["web_source"];
        let detect_change = false;

        //Purge configuration where website project folders are removed
        for(let website_project in this.web_configs) {
            //Check of config file exists
            let this_config = path.join(web_path, website_project, "config.json");
            if(fs.existsSync(this_config) == false) {
                this.log({
                    "state":"info",
                    "message":`website_project[${website_project}] folder or configuration removed, removing config data`,
                    "log":{}
                })
                delete this.web_configs[website_project];
                detect_change = true;
            }
        }

        //Query folders in web source path (look for new / modified config files)
        let dir_list = fs.readdirSync(web_path);
        for(let target in dir_list) {
            //Get project name from folder name
            let website_project = dir_list[target];

            //Check if directory
            let this_dir = dir_list[target];
            let this_path = path.join(web_path, this_dir);
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
                            "state":"info",
                            "message":`website_project[${website_project}] :: JSON config parse error, ignoring`,
                            "log":{}
                        })
                        continue;
                    }

                    //Check if web_config already exists
                    if(this.web_configs[website_project] == undefined) {
                        this.log({
                            "state":"info",
                            "message":`New Configuration @ website_project[${website_project}]`,
                            "log":{}
                        })
                        this.web_configs[website_project] = {};
                        this.web_configs[website_project]["modified"] = this_modified;
                        this.web_configs[website_project]["json"] = this_json;
                        detect_change = true;
                    }else{
                        //Check if newer time stamp
                        if(this.web_configs[website_project]["modified"].toString() != this_modified.toString()) {
                            this.log({
                                "state":"info",
                                "message":`Configuration Updated @ website_project[${website_project}]`,
                                "log":{}
                            })
                            this.web_configs[website_project] = {};
                            this.web_configs[website_project]["modified"] = this_modified;
                            this.web_configs[website_project]["json"] = this_json;
                            detect_change = true;
                        }
                    }
                }else{
                    this.log({
                        "state":"info",
                        "message":`No configuration for [${website_project}] > ${this_config}, ignoring`,
                        "log":{}
                    })
                    continue;
                }
            }
        }

        //Re-index on changes
        if(detect_change == true) {
            this.refresh_web_configs_reindex();
        }
    }
    refresh_web_configs_reindex() {
        //Log
        this.log({
            "state":"info",
            "message":`Website project configuration changes found, updating hostnames index`,
            "log":{}
        })

        //Set vars
        let web_path = this.paths["web_source"];

        //Update indexes
        let this_ssl_redirect = {};     //Hold mapping for SSL redirect setting
        let this_web_maint_mode = {};   //Hold mapping for site maintenance mode
        let this_default_doc = {};      //Hold mapping for site default doc
        let this_default_404 = {};      //Hold mapping for site 404 doc
        let this_default_500 = {};      //Hold mapping for site 500 doc

        //Define mapping
        let all_vhosts = {};
        let all_dns = {};

        //Add 'dev' mappings dns
        if(this.server_mode == "dev") {
            for(let i in this.server_dev_ui) {
                let this_dns = this.server_dev_ui[i];

                //Mapping dev UI names
                all_dns[this_dns] = {}
                all_dns[this_dns]["project"] = "system";
                all_dns[this_dns]["ssl_redirect"] = true;
                all_dns[this_dns]["maintenance_mode"] = false;
                all_dns[this_dns]["maintenance_doc"] = "";
                all_dns[this_dns]["default_doc"] = "index.html";
                all_dns[this_dns]["default_404"] = "404.js";
                all_dns[this_dns]["default_500"] = "500.js";
                all_dns[this_dns]["apis_fixed"] = {}
                all_dns[this_dns]["apis_dynamic"] = {
                    "/api/":`${this.paths["localhost"]}api${path.sep}`
                }
                all_dns[this_dns]["path_static_exec"] = {}
                all_dns[this_dns]["paths_static"] = {
                    "/":this.paths["localhost"]
                }
            }
        }

        //Process configurations
        for(let website_project in this.web_configs) {
            //Set path
            let root_path = path.join(web_path, website_project)    //to replace above

            //Get website project enabled
            let project_enabled = this.web_configs[website_project].json.enabled;

            //Get DNS configuration (dev or prod)
            let project_dns_name = null;
            if(this.web_configs[website_project]["json"]["dns_names"] != undefined) {
                if(this.web_configs[website_project]["json"]["dns_names"][this.environment] != undefined) {
                    project_dns_name = this.web_configs[website_project]["json"]["dns_names"][this.environment];
                }
            }

            //Validate JSON data
            if(this.web_configs[website_project]["json"] == undefined) {
                this.log({
                    "state":"error",
                    "message":`website_project[${website_project}] -- Missing JSON data`,
                    "log":{}
                })
                continue;
            }

            //Validate JSON data
            let websites = {};
            if(this.web_configs[website_project]["json"]["websites"] == undefined) {
                this.log({
                    "state":"error",
                    "message":`website_project[${website_project}] -- Missing Websites in JSON data`,
                    "log":{}
                })

                continue;
            }else{
                websites = this.web_configs[website_project]["json"]["websites"];
            }

            //Loop through websites
            for(let website in websites) {

                //Set defaults
                let ssl_redirect = true;
                let maint_mode = false;
                let maint_doc = "maintenance.html";
                let default_doc = "index.html";
                let default_404 = "";   //Blank is default system errors
                let default_500 = "";   //Blank is default system errors

                let apis_fixed = {};
                let apis_dynamic = {};
                let paths_static = {};
                let path_static_exec = [];

                //Get settings from website in project config
                if(websites[website]["ssl_redirect"] != undefined) {
                    ssl_redirect = websites[website]["ssl_redirect"];
                }
                if(websites[website]["maintenance"] != undefined) {
                    maint_mode = websites[website]["maintenance"];
                }
                if(websites[website]["maintenance_page"] != undefined) {
                    maint_doc = websites[website]["maintenance_page"];
                }
                if(websites[website]["default_doc"] != undefined) {
                    default_doc = websites[website]["default_doc"];
                }

                if(websites[website]["default_errors"]["404"] != undefined) {
                    default_404 = websites[website]["default_errors"]["404"];
                }
                if(websites[website]["default_errors"]["500"] != undefined) {
                    default_500 = websites[website]["default_errors"]["500"];
                }

                if(websites[website]["apis_fixed_path"] != undefined) {
                    apis_fixed = websites[website]["apis_fixed_path"];
                }
                if(websites[website]["apis_dynamic_path"] != undefined) {
                    apis_dynamic = websites[website]["apis_dynamic_path"];
                }
                if(websites[website]["path_static"] != undefined) {
                    paths_static = websites[website]["path_static"];
                }
                if(websites[website]["path_static_server_exec"] != undefined) {
                    path_static_exec = websites[website]["path_static_server_exec"];
                }

                //Map api fixed paths
                let this_api_fixed_map = {};
                for(let web_path in apis_fixed) {
                    //Set mapping
                    let this_web_path = this.format_url(web_path);
                    let this_map_path = root_path + this.format_path(apis_fixed[web_path]);

                    //Add to mapping object
                    this_api_fixed_map[this_web_path] = this_map_path;
                }

                // Map api dynamic paths
                let this_api_dyn_map = {};
                for(let web_path in apis_dynamic) {
                    //Set mapping
                    let this_web_path = this.format_url(web_path);
                    let this_map_path = root_path + this.format_path(apis_dynamic[web_path]);

                    //Add to mapping object
                    this_api_dyn_map[this_web_path] = this_map_path;
                }

                // Map static path overrides
                let this_static_exec_map = {};
                for(let web_path in path_static_exec) {
                    //Set mapping
                    let this_web_path = this.format_url(web_path);
                    let this_map_path = root_path + this.format_path(path_static_exec[web_path]);

                    //Add to mapping object
                    this_static_exec_map[this_web_path] = this_map_path;
                }

                // Map static paths
                let this_static_map = {};
                for(let web_path in paths_static) {
                    //Set mapping
                    let this_web_path = this.format_url(web_path);
                    let this_map_path = root_path + this.format_path(paths_static[web_path]);

                    //Add to mapping object
                    this_static_map[this_web_path] = this_map_path;
                }

                //Sort arrays
                this_api_fixed_map      = this.sort_mapping(this_api_fixed_map);
                this_api_dyn_map        = this.sort_mapping(this_api_dyn_map);
                this_static_exec_map    = this.sort_mapping(this_static_exec_map);
                this_static_map         = this.sort_mapping(this_static_map);

                //Add 'dev' vhost mode mappings for website projects
                if(this.server_mode == "dev") {
                    //Set vhost path
                    let this_vhost_path = `/vhost/${website_project}::${website}`;

                    //VHost mapping
                    all_vhosts[this_vhost_path] = {}
                    all_vhosts[this_vhost_path]["project"] = website_project;
                    all_vhosts[this_vhost_path]["default_doc"] = default_doc;
                    all_vhosts[this_vhost_path]["default_404"] = default_404;
                    all_vhosts[this_vhost_path]["default_500"] = default_500;
                    all_vhosts[this_vhost_path]["apis_fixed"] = this_api_fixed_map
                    all_vhosts[this_vhost_path]["apis_dynamic"] = this_api_dyn_map
                    all_vhosts[this_vhost_path]["path_static_exec"] = this_static_exec_map
                    all_vhosts[this_vhost_path]["paths_static"] = this_static_map
                }

                //Check DNS names linked to website (for dev or prod mode)
                if(project_dns_name != null) {
                    for(let dns in project_dns_name) {
                        let this_website = project_dns_name[dns];
                        if(this_website == website) {
                            if(project_enabled == true) {

                                //NEW mapping
                                all_dns[dns] = {}
                                all_dns[dns]["project"] = website_project;
                                all_dns[dns]["ssl_redirect"] = ssl_redirect;
                                all_dns[dns]["maintenance_mode"] = maint_mode;
                                all_dns[dns]["maintenance_doc"] = maint_doc;
                                all_dns[dns]["default_doc"] = default_doc;
                                all_dns[dns]["default_404"] = default_404;
                                all_dns[dns]["default_500"] = default_500;
                                all_dns[dns]["apis_fixed"] = {}
                                all_dns[dns]["apis_dynamic"] = {}
                                all_dns[dns]["path_static_exec"] = {}
                                all_dns[dns]["paths_static"] = {}
        

                                //Set domain SSL redirect setting
                                this_ssl_redirect[dns] = ssl_redirect;

                                //Set domain maintenance mode doc
                                if(maint_mode == true) {
                                    this_web_maint_mode[dns] = maint_doc;
                                }
                                
                                //Set domain default document
                                this_default_doc[dns] = default_doc;

                                //Set domain default 404 page
                                this_default_404[dns] = default_404;

                                //Set domain default 500 page
                                this_default_500[dns] = default_500;

                                //DNS API Fixed Paths
                                if(Object.keys(this_api_fixed_map).length > 0) {
                                    all_dns[dns]["apis_fixed"] = this_api_fixed_map;
                                }

                                //DNS API Dynamic Paths
                                if(Object.keys(this_api_dyn_map).length > 0) {
                                    all_dns[dns]["apis_dynamic"] = this_api_dyn_map;
                                }
                                
                                //DNS Statis Paths (Server Execute Override)
                                if(Object.keys(this_static_exec_map).length > 0) {
                                    all_dns[dns]["path_static_exec"] = this_static_exec_map;
                                }

                                //DNS Static Paths
                                if(Object.keys(this_static_map).length > 0) {
                                    all_dns[dns]["paths_static"] = this_static_map;
                                }
                            }
                        }
                    }
                }
            }
        }

        //Set mapping to system
        this.web_dns_mapping = all_dns;
        this.web_dev_mapping = all_vhosts;

        //Output site mapping
        if(this.debug_mode_on == true) {
            this.output_mapping_table()
        }
    }

    //////////////////////////////////////
    // Web server functions
    //////////////////////////////////////

    //Server listeners
    start_server() {
        this.log({
            "state":"info",
            "message":"Starting Node.js (virtual hosts server)",
            "log":{}
        })

        //Start HTTP server
        if(this.http_on == true) {
            this.start_http_server();
        }

        //Start HTTPS server
        if(this.https_on == true) {
            //Load SSL certificate files
            let ssl_path = this.paths["conf"];

            //Load SSL files
            let ssl_key = `${ssl_path}${this.ssl_key}`;
            let ssl_cert = `${ssl_path}${this.ssl_cert}`;
            let if_ssl_key_exists = fs.existsSync(ssl_key);
            let if_ssl_cert_exists = fs.existsSync(ssl_cert);
            if(if_ssl_key_exists == true && if_ssl_cert_exists == true) {
                this.ssl_certificate = {
                    key: fs.readFileSync(ssl_key),
                    cert: fs.readFileSync(ssl_cert)
                };
            }else{
                this.log({
                    "state":"error",
                    "message":"Cannot load SSL certificate files",
                    "log":{}
                })
                return;
            }

            //Start server
            this.start_https_server();
        }

        //Client warning
        if(this.http_on == false && this.https_on == false) {
            this.consolelog("** ERROR: HTTP and HTTPS services are disabled -- workers are sitting around not doing their job");
            this.log({
                "state":"error",
                "message":"HTTP and HTTPS services are disabled -- workers are sitting around not doing their job",
                "log":{}
            })
        }
    }
    start_http_server() {
        //Reference to parent class
        var parent = this;

        //Create server
        http.createServer(function (req, res) {
            //Process request
            parent.client_request("http", req, res)
        }).listen(this.http_port);

        //Log
        this.log({
            "state":"info",
            "message":`HTTP server - port ${this.http_port}`,
            "log":{}
        })
    }
    start_https_server() {
        //Reference to parent class
        var parent = this;
        
        https.createServer(this.ssl_certificate, function (req, res) {
            //Process request
            parent.client_request("https", req, res)
        }).listen(this.https_port);

        //Log
        this.log({
            "state":"info",
            "message":`HTTP server - port ${this.https_port}`,
            "log":{}
        })
    }
    client_request(protocol, req, res) {
        //Set logger target name
        logger.target_log_name = "system"

        //Define _server
        let _server = {
            "local_ipv4":this.ipv4_address,
            "local_ipv6":this.ipv6_address,
            "request_ip":null,
            "node_version":null,
            "environment":this.environment
        }
        if(req.socket.localAddress != undefined) {
            if(req.socket.localAddress == "::1") {
                _server["request_ip"] = "localhost";
            }else{
                let this_split = req.socket.localAddress.split(":");
                _server["request_ip"] = this_split[(this_split.length - 1)];
                if(_server["request_ip"] == "127.0.0.1") {
                    _server["request_ip"] = "localhost";
                }
            }
        }
        if(process.version != undefined) {
            _server["node_version"] = process.version;
        }

        //Define _client
        let _client = {
            "remote_ip":null,
            "remote_ip_xff":null,
            "user_agent":null,
            "cookie":null
        }
        if(req.socket.remoteAddress != undefined) {
            if(req.socket.remoteAddress == "::1") {
                _client["remote_ip"] = "localhost";
            }else{
                let this_split = req.socket.remoteAddress.split(":");
                _client["remote_ip"] = this_split[(this_split.length - 1)];
                if(_client["remote_ip"] == "127.0.0.1") {
                    _client["remote_ip"] = "localhost";
                }
            }
        }
        if(req.headers['x-forwarded-for'] != undefined) {
            _client["remote_ip_xff"] = req.headers['x-forwarded-for'];
        }
        if(req.rawHeaders != undefined) {
            let a_i = req.rawHeaders.indexOf("User-Agent");
            let c_i = req.rawHeaders.indexOf("Cookie");

            if(a_i > -1) {
                _client["user_agent"] = req.rawHeaders[a_i + 1];
            }
            if(c_i > -1) {
                _client["cookie"] = req.rawHeaders[c_i + 1];
            }
        }

        //Raw Headers
        let _raw_headers    = req.rawHeaders;

        //Parse URL
        let parse_url = url.parse(req.url);

        //Set parameters
        let this_method 		= req.method;
        let this_http_version 	= req.httpVersion;
        let this_protocol 		= protocol;
        let this_host 			= "localhost";
        let this_port           = "";
        let this_path 			= parse_url.pathname;
        let this_query 			= parse_url.query;

        //Parse hostname and port
        let parse_host = req.headers.host.split(":");
        if(parse_host.length == 1) {
            this_host = parse_host[0];
        }else if(parse_host.length == 2) {
            this_host = parse_host[0];
            this_port = `:${parse_host[1]}`;
        }

        //Set target mapping
        let this_target = {}
        if(this.web_dns_mapping[this_host] != undefined) {
            this_target = this.web_dns_mapping[this_host];
        }

        //Request string
        let this_request = "";
        if(this_query == null) {
            this_request = `[${this_method}][HTTP/${this_http_version}] ${this_protocol}://${this_host}${this_port}${this_path}`;
        }else{
            this_request = `[${this_method}][HTTP/${this_http_version}] ${this_protocol}://${this_host}${this_port}${this_path}?${decodeURIComponent(this_query)}`;
        }

        //Determine if SSL redirect
        if(this_protocol == "http" && this.https_on == true) {
            if(this_target["ssl_redirect"] == true) {
                //Set redirect URL
                if(this.https_port != 443) {
                    this_host += `:${this.https_port}`
                }
                let redirect_url = `https://${this_host}${this_path}`
                if(this_query != null) {
                    redirect_url += `?${this_query}`
                }

                //Log
                this.log({
                    "state":"info",
                    "message":`Enforce SSL Connection : Redirect to > ${redirect_url}`,
                    "log":{}
                })

                //Redirect
                res.writeHead(301, {"Location": redirect_url});
                res.end();
                return;
            }
        }
        if(this_target["ssl_redirect"] == true && this.https_on == false) {
            //Log
            this.log({
                "state":"warn",
                "message":`SSL Redirect Enforced but server HTTPS is disabled`,
                "log":{}
            })
        }

        //Get URL to folder mapping
        let response_params = this.request_mapping(this_host, this_path, this_target);
        let status_code = response_params.status;
        let file_path = response_params.path;
        let exec_mode = response_params.exec;

        //Log connection
        this_request = {
            "project":response_params.project,
            "state":"info",
            "message":`Client Request > ${this_request}`,
            "log":{
                "_status_code":status_code,
                "_server":_server,
                "_client":_client,
                "_request":{
                    "method":this_method,
                    "http_version":this_http_version,
                    "protocol":this_protocol,
                    "host":this_host,
                    "port":this_port,
                    "path":this_path,
                    "query": decodeURIComponent(this_query)
                },
                "_mapping":{
                    "file_path":file_path,
                    "exec_mode":exec_mode
                }
            }
        }
        this.log(this_request)

        //Unload the server side file if cache is false (used when content is static)
        if(this.cache_on == false) {
            //delete require.cache[file_path];
            this.clear_cahced()
        }

        //Handle exec type
        if(exec_mode == "client") {
            //Send client side files
            let this_mime_type = this.mime_type(file_path);
            res.writeHead(status_code, {'Content-Type': this_mime_type});
            fs.createReadStream(file_path).pipe(res);
        }else if(exec_mode == "server") {
            //Parse query
            var parent = this;
            var params = {}

            //Set request parameters
            params = {
                "_server":_server,
                "_client":_client,
                "_raw_headers":_raw_headers,
                "method":this_method, 
                "http_version":this_http_version,
                "protocol":this_protocol,
                "hostname":this_host,
                "path":this_path,
                "query":{}
            }                

            //Process GET or POST / OTHER
            if(this_method == "POST") {
                this_query = "";
                req.on('data', function (data) {
                    this_query += data;
                });
                req.on('end', function () {
                    //Async function
                    params.query = parent.parse_query(this_query);
                    parent.exec_server_side(res, file_path, params);
                });
            }else{
                //Set request parameters
                params.query = this.parse_query(this_query);
                this.exec_server_side(res, file_path, params);
            }
        }else{
            this.log({
                "state":"error",
                "message":`Request not defined for client or server handling: ${file_path}`,
                "log":{
                    "_server":_server,
                    "_client":_client,
                    "_request":{
                        "method":this_method,
                        "http_version":this_http_version,
                        "protocol":this_protocol,
                        "host":this_host,
                        "port":this_port,
                        "path":this_path,
                        "query": decodeURIComponent(this_query)
                    }
                }
            })
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end("Error: exec state not set");
        }
    }
    async exec_server_side(res, file_path, params) {
        //Run server side code
        try {
            //Include server side code
            let exec_javascript = require(file_path);

            //Execute request and get response
            let response = await exec_javascript.request(params);

            //Handle response
            this.exec_server_side_response(res, file_path, response)
        }catch(err){
            this.exec_server_side_error(res, file_path, err);
        }
    }
    exec_server_side_response(res, file_path, response) {
        if(response == undefined) {
            this.exec_server_side_response_null(res, file_path)
        }else{
            try {
                //Defaults
                let this_status_code = 200;
                let this_headers = {};
                let this_body = null;
    
                //Get response parameters
                if(response.status_code != undefined) { this_status_code = response.status_code; }
                if(response.headers != undefined) { this_headers = response.headers; }
                if(response.body != undefined) { this_body = response.body; }
    
                //Set status code
                res.statusCode = this_status_code;
                
                //Set headers
                if(Object.keys(this_headers).length > 0) {
                    for(let header in this_headers) {
                        res.setHeader(header, this_headers[header]);
                    }
                }
    
                //Send response body
                res.end(this_body);
            }catch(err) {
                this.exec_server_side_error(res, file_path, err);
            }
        }
    }
    exec_server_side_response_null(res, file_path) {
        //Output error
        this.log({
            "state":"error",
            "message":`Server side execution error: ${file_path}`,
            "log":{}
        })

        //Unload the server side file on error
        delete require.cache[file_path];

        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`{"error":"500 Internal Server Error"}`);
    }
    exec_server_side_error(res, file_path, err) {
        //Stack trace
        var this_error = new Error();

        //Output error
        this.log({
            "state":"error",
            "message":`Server side execution error: ${file_path}`,
            "log":{
                "file":file_path,
                "err_string":err.toString(),
                "stack_trace":this_error.stack
            }
        })

        //Unload the server side file on error
        delete require.cache[file_path];

        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(err.toString());
    }

    //Request handling
    parse_query(query=null) {
        //Return empty
        if(query == null) {
            return {};
        }

        //Test pure JSON in query
        try {
            query = JSON.parse(decodeURIComponent(query));
            return query;
        }catch(err){}

        //Parse query by & sign
        let parse = query.split("&");
        let hashmap = {}

        //Loop query
        let key_value = "";
        let key = "";
        let value = "";
        for(let i in parse) {
            //Try split by = sign
            key_value = parse[i].split("=");
            if(key_value.length == 1 || key_value.length > 2) {
                key = parse[i];
                value = "";
            }else if(key_value.length == 2) {
                key = key_value[0];
                value = key_value[1];
            }
    
            //Web decode string
            key = decodeURI(key);
            value = decodeURI(value);
    
            //Check key (string, number)
            if(isNaN(key) == false) {
                key = (key * 1);
            }else{
                key = key.toString();
            }
    
            //Check value (json, string, number)
            if(value == "" || value == null) {
                value = value.toString();
            }else if(isNaN(value) == false) {
                value = (value * 1);
            }else{
                //Test JSON
                try {
                    value = JSON.parse(value);
                }catch(err) {
                    value = value.toString();
                }
            }
            
            //Add to 
            hashmap[key] = value;
        }

        //Return map
        return hashmap;
    }
    request_mapping(this_host, this_url, this_target) {
        //Set default vars
        let mapped_path = "";
        let mapped_params = {};
        let system_404 = `${this.paths["errors"]}404.js`;
        let system_404_api = `${this.paths["errors"]}404_api.js`;

        let default_doc = "index.html"
        let default_404 = "404.js"
        let default_ext = ".js"

        var dev_ui = this.server_dev_ui;
        var server_mode = this.server_mode;
        var web_dns_mapping = this.web_dns_mapping;

        //Set project source for site match
        let this_project = this_target.project;

        ///////////////////////////////////////////////////
        // Default system 404 error
        ///////////////////////////////////////////////////

        //System 404 error path mapping
        if(this_url.includes("default_errors")){
            //Extract default errors path
            let this_pattern = "(default_errors.*)";
            let this_match = this_url.match(this_pattern);
            let mapped_path = `${this.paths["server"]}${this_match[0]}`

            //Set mapped response
            mapped_params["project"] = this_project;
            mapped_params["status"] = 200;
            mapped_params["path"] = mapped_path;
            mapped_params["exec"] = "client";
            return mapped_params;
        }

        //Return system 404 error with no matching target site
        if(Object.keys(this_target).length === 0) {
            mapped_params["project"] = this_project;
            mapped_params["status"] = 404;
            mapped_params["path"] = system_404;
            mapped_params["exec"] = "server";
            return mapped_params;
        }
        ///////////////////////////////////////////////////

        //Dev mode previews - site target override
        if(this.server_mode == "dev") {
            if(this.server_dev_ui.indexOf(this_host) > -1) {
                //Look for vhost mapping
                if(this_url.startsWith("/vhost/")) {
                    for(let vhost in this.web_dev_mapping) {
                        if(this_url.startsWith(vhost)) {
                            //Override project source for vhost
                            this_project = this.web_dev_mapping[vhost]["project"];

                            //Set target site
                            this_target = this.web_dev_mapping[vhost]

                            //Strip vhost string from URI for matching
                            this_url = this_url.replace(vhost,"");
                            break;
                        }
                    }
                }
            }
        }

        //Get site default document settings
        if(this_target["default_doc"] != undefined) { 
            default_doc = this_target["default_doc"];
        }
        if(this_target["default_404"] != undefined) { 
            default_404 = this_target["default_404"];
        }

        //Set maintenance page as default doc (exclued dev mode vhost preview)
        if(this.server_dev_ui.indexOf(this_host) == -1) {
            if(this_target["maintenance_mode"] == true) {
                default_doc = this_target["maintenance_doc"];
            }
        }

        //Match API fixed mapping
        if(Object.keys(this_target["apis_fixed"]).length > 0) {
            for(let match_url in this_target["apis_fixed"]) {
                //Check this_url starts with match_url in any format, start value hard mapped to API file
                //  User may user URI path parsing as query -or-
                //  User may pass a query string / JSON
                
                if(this_url.startsWith(match_url)) {
                    //Get set map path for fixed API
                    mapped_path = this_target["apis_fixed"][match_url];

                    //Verify if file exists
                    let if_map_exists = fs.existsSync(mapped_path);
                    if(if_map_exists) {
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 200;
                        mapped_params["path"] = mapped_path;
                        mapped_params["exec"] = "server";
                    }else{
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 404;
                        mapped_params["path"] = system_404_api;
                        mapped_params["exec"] = "server";
                    }
                    return mapped_params;
                }
            }
        }

        //Match API dynamic path mapping
        if(Object.keys(this_target["apis_dynamic"]).length > 0) {
            //If this_url ends in a slash it is not an API file, most likely a directory for static content
            if(this_url.endsWith("/") == false) {
                //Look for match
                for(let match_url in this_target["apis_dynamic"]) {
                    if(this_url.startsWith(match_url)) {
                        //Strip match_url from this_url to get sub_path, append to mapped path
                        mapped_path = this_url.replace(match_url,"");
                        mapped_path = this_target["apis_dynamic"][match_url] + mapped_path;

                        //Check if API path has a file extension, add default extension to path
                        if(path.extname(mapped_path) == "") {
                            mapped_path += default_ext;
                        }

                        //Verify if file exists
                        let if_map_exists = fs.existsSync(mapped_path);
                        if(if_map_exists) {
                            mapped_params["project"] = this_project;
                            mapped_params["status"] = 200;
                            mapped_params["path"] = mapped_path;
                            mapped_params["exec"] = "server";
                        }else{
                            mapped_params["project"] = this_project;
                            mapped_params["status"] = 404;
                            mapped_params["path"] = system_404_api;
                            mapped_params["exec"] = "server";
                        }
                        return mapped_params;
                    }
                }
            }
        }

        //Use existing site 404 page or default to system 404 page (no presence of site 404 page)
        function site_404(this_target) {
            //Get 404 from dev ui host when previewing site
            if(server_mode == "dev") {
                if(dev_ui.indexOf(this_host)) {
                    if(web_dns_mapping[this_host] != undefined) {
                        this_target = web_dns_mapping[this_host];
                    }
                }
            }

            //Get site 404
            let default_404 = "";
            if(this_target["default_404"] != undefined) {
                default_404 = this_target["default_404"];
            }
            if(Object.keys(this_target["paths_static"]).length > 0) {
                let get_keys = Object.keys(this_target["paths_static"]);
                let last_key = get_keys[get_keys.length -1];
                let root_path = this_target["paths_static"][last_key];
                default_404 = `${root_path}${default_404}`;
            }

            //Check if exists
            let if_map_exists = fs.existsSync(default_404);
            if(!(if_map_exists)) {
                default_404 = system_404;
            }

            return default_404;
        }

        //Match static path sever execute (override static content to execute as server side script)
        if(Object.keys(this_target["path_static_exec"]).length > 0) {
            for(let match_url in this_target["path_static_exec"]) {
                //Match exact URL path for static override
                if(match_url == this_url) {
                    //Get mapped path
                    mapped_path = this_target["path_static_exec"][match_url];

                    //Verify if file exists
                    let if_map_exists = fs.existsSync(mapped_path);
                    if(if_map_exists) {
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 200;
                        mapped_params["path"] = mapped_path;
                        mapped_params["exec"] = "server";
                    }else{
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 404;
                        mapped_params["path"] = site_404(this_target);
                        mapped_params["exec"] = "server";
                    }
                    return mapped_params;
                }
            }
        }

        //Match static file content
        if(Object.keys(this_target["paths_static"]).length > 0) {
            for(let match_url in this_target["paths_static"]) {
                //Format this_url for static matching (not trailing slash assumed a sub dir, not a file)
                let target_url = this.format_url(this_url)

                //Check if target URL starts with match rule
                if(target_url.startsWith(match_url)) {
                    //Strip match_url from this_url to get sub_path, append to mapped path
                    mapped_path = this_url.replace(match_url,"");                    
                    mapped_path = this_target["paths_static"][match_url] + mapped_path;
                    
                    //URL without file -- append default document
                    if(path.extname(mapped_path) == "") {
                        mapped_path += default_doc;
                    }

                    //Verify if file exists
                    let if_map_exists = fs.existsSync(mapped_path);
                    if(if_map_exists) {
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 200;
                        mapped_params["path"] = mapped_path;
                        mapped_params["exec"] = "client";

                        //Check default doc path (can be default doc or maintenance page) -- override execute params
                        if(mapped_path.endsWith(default_doc)) {
                            if(path.extname(mapped_path) == default_ext) {
                                mapped_params["exec"] = "server";
                            }
                        }
                    }else{
                        mapped_params["project"] = this_project;
                        mapped_params["status"] = 404;
                        mapped_params["path"] = site_404(this_target);
                        if(path.extname(mapped_params["path"]) == default_ext) {
                            mapped_params["exec"] = "server";
                        }else{
                            mapped_params["exec"] = "client";
                        }
                    }

                    //Return mapped path
                    return mapped_params;
                }
            }
        }

        //Catch all
        mapped_params["project"] = this_project;
        mapped_params["status"] = 404;
        mapped_params["path"] = system_404;
        mapped_params["exec"] = "server";
        return mapped_params;
    }
    mime_type(file) {
        let mime_types = {
            default: "application/octet-stream",
            ".html": "text/html; charset=UTF-8",
            ".htm": "text/html; charset=UTF-8",
            ".js": "application/javascript; charset=UTF-8",
            ".css": "text/css",
            ".png": "image/png",
            ".jpg": "image/jpg",
            ".gif": "image/gif",
            ".ico": "image/x-icon",
            ".svg": "image/svg+xml"
        };

        //Get file extension
        let this_ext = path.extname(file)

        //Get mime type
        return mime_types[this_ext] || mime_types.default;
    }

    //Server cache mode = false, unload cached files (not node modules loaded via server)
    clear_cahced() {
        for(let cached in require.cache) {
            if(!(cached.includes("node_modules"))) {
                if(this.running_cache[cached] == undefined) {
                    this.log({
                        "state":"info",
                        "message":`server.cache_on = false, remove module from server cache [${cached}]`,
                        "log":{}
                    })

                    delete require.cache[cached];
                }
            }
        }
    }

    //////////////////////////////////////
    // Debug mode functions
    //////////////////////////////////////

    //Debug mode output
    output_server_settings() {
        if(this.debug_mode_on == true && this.workers == 1) {
            let auto_refresh_timer = `${this.auto_refresh_timer.toString()} milliseconds`;

            this.consolelog(" ═══════════════════════════════════════════════════════════════════════════════");
            this.consolelog(" Node.js VHost Server");
            this.consolelog(`   Node Version            : ${process.version}`);
            this.consolelog(`   Platform                : ${process.platform}`);
            this.consolelog(`   Hostname                : ${this.hostname}`);
            this.consolelog(`   IPv4 Address            : ${this.ipv4_address}`);
            this.consolelog(`   IPv6 Address            : ${this.ipv6_address}`);
            this.consolelog(`   Server Root             : ${this.paths["root"]}`);
            this.consolelog(`   Website Source Path     : ${this.paths["web_source"]}`);
            this.consolelog("");
            this.consolelog(`   Server Mode             : ${this.server_mode}`);
            this.consolelog(`   Server Dev UI Hostnames : ${this.server_dev_ui.toString()}`);
            this.consolelog(`   Environment             : ${this.environment}`);
            this.consolelog(`   Cache Mode On           : ${this.cache_on}`);
            this.consolelog(`   Debug Mode On           : ${this.debug_mode_on}`);
            this.consolelog(`   Auto Refresh            : ${this.auto_refresh_on}`);
            this.consolelog(`   Auto Refresh Interval   : ${auto_refresh_timer}`);
            this.consolelog(`   HTTP State              : ${this.http_on}`);
            this.consolelog(`   HTTP Port               : ${this.http_port.toString()}`);
            this.consolelog(`   HTTPS State             : ${this.https_on}`);
            this.consolelog(`   HTTPS Port              : ${this.https_port.toString()}`);
            this.consolelog(`   SSL Key File            : ${this.ssl_key.toString()}`);
            this.consolelog(`   SSL Cert File           : ${this.ssl_cert.toString()}`);                
            this.consolelog(" ═══════════════════════════════════════════════════════════════════════════════");
        }
    }

    output_mapping_table() {
        this.output_web_configs_tracking();
        this.output_web_dns_mapping();
        this.output_web_path_mapping();
        this.output_vhosts();
        this.output_vhost_mapping();

        this.consolelog("");
    }
    output_web_configs_tracking(){
        this.consolelog("");
        this.consolelog("    Web Configuration Tracking");

        //Heading
        let name = "Project Name";
        let enabled = "Enabled";
        let modified = "Config Last Modified";

        //Project name column width
        let n_len = name.length;        //Project name string length
        let e_len = enabled.length;     //Project enabled string length
        let m_len = modified.length;    //Project last updated timestamp

        //Scale column width
        for(let project in this.web_configs) {
            if(project.length > n_len) { n_len = project.length }
        }

        //Pad length
        n_len += 2;
        e_len += 2;
        m_len += 2;

        //Output heading
        name       = name.padEnd(n_len," ");
        enabled    = enabled.padEnd(e_len," ");
        modified   = modified.padEnd(m_len," ");
        this.consolelog(`     ${name}${enabled}${modified}`)

        //Output underline
        name       = ("+").padEnd(n_len,"-");
        enabled    = ("+").padEnd(e_len,"-");
        modified   = ("+").padEnd(m_len,"-");
        this.consolelog(`     ${name}${enabled}${modified}`)

        //Output rows
        for(let project in this.web_configs) {
            name =      (project).toString().padEnd(n_len," ");
            enabled =   (this.web_configs[project].json.enabled).toString().padEnd(e_len," ");
            modified =  (this.web_configs[project].modified).toString().padEnd(m_len," ");
            this.consolelog(`     ${name}${enabled}${modified}`)
        }
    }
    output_web_dns_mapping() {
        this.consolelog("");
        this.consolelog("    Web DNS Active");

        //Heading
        let a_dns = "Active DNS Name";
        let ssl = "SSL Redirect";
        let m_mode = "Maintenance Mode";
        let m_doc = "Maintenance Doc";
        let d_doc = "Default Doc";
        let d_404 = "404 Doc";
        let d_500 = "500 Doc";

        //Set column width
        let a_len = a_dns.length;
        let s_len = ssl.length;
        let mm_len = m_mode.length;
        let md_len = m_doc.length;
        let dd_len = d_doc.length;
        let d4_len = d_404.length;
        let d5_len = d_500.length;

        //Scale column width
        let this_map = this.web_dns_mapping;
        for(let dns in this_map) {
            if(dns.length > a_len) { a_len = dns.length }
            if(this_map[dns]["ssl_redirect"].length > s_len) {      s_len = this_map[dns]["ssl_redirect"].length }
            if(this_map[dns]["maintenance_mode"].length > mm_len) { mm_len = this_map[dns]["maintenance_mode"].length }
            if(this_map[dns]["maintenance_doc"].length > md_len) {  md_len = this_map[dns]["maintenance_doc"].length }
            if(this_map[dns]["default_doc"].length > dd_len) {      dd_len = this_map[dns]["default_doc"].length }
            if(this_map[dns]["default_404"].length > d4_len) {      d4_len = this_map[dns]["default_404"].length }
            if(this_map[dns]["default_500"].length > d5_len) {      d5_len = this_map[dns]["default_500"].length }
        }

        //Pad length
        a_len += 2;
        s_len += 2;
        mm_len += 2;
        md_len += 2;
        dd_len += 2;
        d4_len += 2;
        d5_len += 2;

        //Output heading
        a_dns  = a_dns.padEnd(a_len," ");
        ssl    = ssl.padEnd(s_len," ");
        m_mode = m_mode.padEnd(mm_len," ");
        m_doc  = m_doc.padEnd(md_len," ");
        d_doc  = d_doc.padEnd(dd_len," ");
        d_404  = d_404.padEnd(d4_len," ");
        d_500  = d_500.padEnd(d5_len," ");
        this.consolelog(`     ${a_dns}${ssl}${m_mode}${m_doc}${d_doc}${d_404}${d_500}`)

        //Output underline
        a_dns  = ("+").padEnd(a_len,"-");
        ssl    = ("+").padEnd(s_len,"-");
        m_mode = ("+").padEnd(mm_len,"-");
        m_doc  = ("+").padEnd(md_len,"-");
        d_doc  = ("+").padEnd(dd_len,"-");
        d_404  = ("+").padEnd(d4_len,"-");
        d_500  = ("+").padEnd(d5_len,"-");
        this.consolelog(`     ${a_dns}${ssl}${m_mode}${m_doc}${d_doc}${d_404}${d_500}`)

        //Output rows
        for(let dns in this_map) {
            a_dns  = (dns).toString().padEnd(a_len," ");
            ssl    = (this_map[dns]["ssl_redirect"]).toString().padEnd(s_len," ");
            m_mode = (this_map[dns]["maintenance_mode"]).toString().padEnd(mm_len," ");
            m_doc  = (this_map[dns]["maintenance_doc"]).toString().padEnd(md_len," ");
            d_doc  = (this_map[dns]["default_doc"]).toString().padEnd(dd_len," ");
            d_404  = (this_map[dns]["default_404"]).toString().padEnd(d4_len," ");
            d_500  = (this_map[dns]["default_500"]).toString().padEnd(d5_len," ");
            this.consolelog(`     ${a_dns}${ssl}${m_mode}${m_doc}${d_doc}${d_404}${d_500}`)
        }
    }
    output_web_path_mapping() {
        this.consolelog("");
        this.consolelog(`    Web Path Mapping`);

        //Heading
        let dns_name = "DNS Name";
        let map_type = "Map Type";
        let web_path = "Web Path";
        let map_path = "Mapped Path";

        //Set column width
        let d_len = dns_name.length;
        let mt_len = map_type.length;
        let wp_len = web_path.length;
        let mp_len = map_path.length;

        //Map types column width
        let map_types = [
            "api_fixed",
            "api_synamic",
            "static_exec",
            "static_client"
        ]
        for(let i in map_types) {
            if(map_types[i].length > mt_len) {
                mt_len = map_types[i].length;
            }
        }

        //Scale column width
        for(let dns in this.web_dns_mapping) {
            if(dns.length > d_len) { d_len = dns.length }
            let this_conf = this.web_dns_mapping[dns];
            for(let web_path in this_conf["apis_fixed"]) {
                let map_path = this_conf["apis_fixed"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["apis_dynamic"]) {
                let map_path = this_conf["apis_dynamic"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["path_static_exec"]) {
                let map_path = this_conf["path_static_exec"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["paths_static"]) {
                let map_path = this_conf["paths_static"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
        }

        //Pad length
        d_len += 2;
        mt_len += 2;
        wp_len += 2;
        mp_len += 2;

        //Output heading
        dns_name = dns_name.padEnd(d_len," ");
        map_type = map_type.padEnd(mt_len," ");
        web_path = web_path.padEnd(wp_len," ");
        map_path = map_path.padEnd(mp_len," ");
        this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)

        //Output underline
        dns_name  = ("+").padEnd(d_len,"-");
        map_type  = ("+").padEnd(mt_len,"-");
        web_path  = ("+").padEnd(wp_len,"-");
        map_path  = ("+").padEnd(mp_len,"-");
        this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)

        //Scale column width
        for(let dns in this.web_dns_mapping) {
            dns_name = dns.padEnd(d_len," ");
            let this_conf = this.web_dns_mapping[dns];
            for(let web_path in this_conf["apis_fixed"]) {
                let map_path = this_conf["apis_fixed"][web_path];
                map_type = map_types[0].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");
                this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)
            }
            for(let web_path in this_conf["apis_dynamic"]) {
                let map_path = this_conf["apis_dynamic"][web_path];
                map_type = map_types[1].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");
                this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)
            }
            for(let web_path in this_conf["path_static_exec"]) {
                let map_path = this_conf["path_static_exec"][web_path];
                map_type = map_types[2].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");
                this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)
            }
            for(let web_path in this_conf["paths_static"]) {
                let map_path = this_conf["paths_static"][web_path];
                map_type = map_types[3].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");
                this.consolelog(`     ${dns_name}${map_type}${web_path}${map_path}`)
            }
        }
    }
    output_vhosts() {
        this.consolelog("");
        this.consolelog(`    VHost Alias and Defaults`);

        //RegEx pattern
        let pattern = new RegExp("/vhost/","g");

        //Heading
        let vhost = "VHost Name";
        let d_doc = "Default Doc";
        let d_404 = "404 Doc";
        let d_500 = "500 Doc";

        //Set column width
        let v_len = vhost.length;
        let dd_len = d_doc.length;
        let d4_len = d_404.length;
        let d5_len = d_500.length;

        //Scale column width
        for(let vname in this.web_dev_mapping) {
            //Get config
            let this_conf = this.web_dev_mapping[vname];
            
            //Format vhost name
            vname = vname.replace(pattern,"");
            if(vname.length > v_len) { v_len = vname.length }

            //Get doc column width
            if(this_conf["default_doc"].length > dd_len) { dd_len = this_conf["default_doc"].length }
            if(this_conf["default_404"].length > d4_len) { d4_len = this_conf["default_404"].length }
            if(this_conf["default_500"].length > d5_len) { d5_len = this_conf["default_500"].length }
        }

        //Pad length
        v_len += 2;
        dd_len += 2;
        d4_len += 2;
        d5_len += 2;

        //Output heading
        vhost = vhost.padEnd(v_len," ");
        d_doc = d_doc.padEnd(dd_len," ");
        d_404 = d_404.padEnd(d4_len," ");
        d_500 = d_500.padEnd(d5_len," ");
        this.consolelog(`     ${vhost}${d_doc}${d_404}${d_500}`)

        //Output underline
        vhost  = ("+").padEnd(v_len,"-");
        d_doc  = ("+").padEnd(dd_len,"-");
        d_404  = ("+").padEnd(d4_len,"-");
        d_500  = ("+").padEnd(d5_len,"-");
        this.consolelog(`     ${vhost}${d_doc}${d_404}${d_500}`)

        //Output row data
        for(let vname in this.web_dev_mapping) {
            //Get config
            let this_conf = this.web_dev_mapping[vname];

            //String leading vhost
            vname = vname.replace(pattern,"");

            //Get default configurations
            vhost = vname.toString().padEnd(v_len," ");
            d_doc = (this_conf["default_doc"]).toString().padEnd(dd_len," ");
            d_404 = (this_conf["default_404"]).toString().padEnd(d4_len," ");
            d_500 = (this_conf["default_500"]).toString().padEnd(d5_len," ");
            this.consolelog(`     ${vhost}${d_doc}${d_404}${d_500}`)
        }
    }
    output_vhost_mapping() {
        this.consolelog("");
        this.consolelog(`    VHOST Path Mapping`);

        //RegEx pattern
        let pattern = new RegExp("/vhost/","g");

        //Heading
        let vhost = "VHost Name";
        let map_type = "Map Type";
        let web_path = "Web Path";
        let map_path = "Mapped Path";

        //Set column width
        let v_len = vhost.length;
        let mt_len = map_type.length;
        let wp_len = web_path.length;
        let mp_len = map_path.length;

        //Map types column width
        let map_types = [
            "api_fixed",
            "api_synamic",
            "static_exec",
            "static_client"
        ]
        for(let i in map_types) {
            if(map_types[i].length > mt_len) {
                mt_len = map_types[i].length;
            }
        }

        //Scale column width
        for(let vname in this.web_dev_mapping) {
            //Get config
            let this_conf = this.web_dev_mapping[vname];
            
            //Format vhost name
            vname = vname.replace(pattern,"");
            if(vname.length > v_len) { v_len = vname.length }

            //Get mapping column width
            for(let web_path in this_conf["apis_fixed"]) {
                let map_path = this_conf["apis_fixed"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["apis_dynamic"]) {
                let map_path = this_conf["apis_dynamic"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["path_static_exec"]) {
                let map_path = this_conf["path_static_exec"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
            for(let web_path in this_conf["paths_static"]) {
                let map_path = this_conf["paths_static"][web_path];
                if(web_path.length > wp_len) { wp_len = web_path.length }
                if(map_path.length > mp_len) { mp_len = map_path.length }
            }
        }

        //Pad length
        v_len += 2;
        mt_len += 2;
        wp_len += 2;
        mp_len += 2;

        //Output heading
        vhost = vhost.padEnd(v_len," ");
        map_type = map_type.padEnd(mt_len," ");
        web_path = web_path.padEnd(wp_len," ");
        map_path = map_path.padEnd(mp_len," ");
        this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)

        //Output underline
        vhost  = ("+").padEnd(v_len,"-");
        map_type  = ("+").padEnd(mt_len,"-");
        web_path  = ("+").padEnd(wp_len,"-");
        map_path  = ("+").padEnd(mp_len,"-");
        this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)

        //Output row data
        for(let vname in this.web_dev_mapping) {
            //Get config
            let this_conf = this.web_dev_mapping[vname];

            //String leading vhost
            vname = vname.replace(pattern,"");
            vhost = vname.toString().padEnd(v_len," ");

            //Get mapping column width
            for(let web_path in this_conf["apis_fixed"]) {
                let map_path = this_conf["apis_fixed"][web_path];

                map_type = map_types[0].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");

                this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)    
            }
            for(let web_path in this_conf["apis_dynamic"]) {
                let map_path = this_conf["apis_dynamic"][web_path];

                map_type = map_types[1].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");

                this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)    
            }
            for(let web_path in this_conf["path_static_exec"]) {
                let map_path = this_conf["path_static_exec"][web_path];

                map_type = map_types[2].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");

                this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)    
            }
            for(let web_path in this_conf["paths_static"]) {
                let map_path = this_conf["paths_static"][web_path];

                map_type = map_types[3].padEnd(mt_len," ");
                web_path = web_path.padEnd(wp_len," ");
                map_path = map_path.padEnd(mp_len," ");

                this.consolelog(`     ${vhost}${map_type}${web_path}${map_path}`)    
            }
        }
        

    }
}

//Export modules
module.exports = vhost_server;