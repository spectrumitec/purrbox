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

//Set vhost logger
const vhost_mapping = require(path.join(__dirname,"vhost_mapping.js"));
const mapping = new vhost_mapping()

//Server class
class vhost_server {
    //System details
    hostname = "localhost";     //Hostname of running instance
    ipv4_address = "";          //Local IPv4 address
    ipv6_address = "";          //Local IPv6 address

    //Legacy configuration warning
    legacy_config = false;
    legacy_notes = "";

    //Default class settings - set via server_conf.json
    workers = 1;                //Number of worker processes
    cache_on = false;           //Server side cache of import files (cache in production)
    debug_mode_on = false;      //Debug output
	mgmt_mode = true;           //Management modes 'true' or 'false'
	mgmt_ui = []                //Management UI hostnames
    environment="";             //User defined environment (development, qa, stage, prod, etc)
    environment_name="";        //User defined environment name (e.g. fron_end, app, other)
	http_on=true;               //HTTP enable
	http_port=80;               //HTTP port
	https_on=true;              //HTTPS enable
	https_port=443;             //HTTPS port
	ssl_key="";                 //SSL certificate private key (single, SAN, wildcard or self signed)
	ssl_cert="";                //SSL certificate certificate (single, SAN, wildcard or self signed)
    auto_refresh_on=true;       //Web project configuration auto reload on changes
    auto_refresh_timer=10000;   //Time check for config changes (1,000 = 1 second)

    //Start up cached files
    running_cache = {}

    //System paths
    paths = {}                  //System paths

    //https options
    ssl_certificate = {}

    //Supported file types
    mime_types = {}

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

        //Run startup map
        mapping.map_generate()
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
                "debug_mode_on":false,
                "mgmt_mode": true,
	            "mgmt_ui": [],
                "environment":"dev",
                "environment_name":"",
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
            if(json.mgmt_mode != undefined) {
                (json.mgmt_mode == false) ? this.mgmt_mode = false : this.mgmt_mode = true;
            }
            if(json.mgmt_ui != undefined) {
                this.mgmt_ui.push("localhost");
                this.mgmt_ui.push(this.hostname);
                for(let i in json.mgmt_ui) {
                    let hostname = json.mgmt_ui[i];
                    if(this.mgmt_ui.indexOf(hostname) == -1) {
                        this.mgmt_ui.push(hostname);
                    }
                }
                this.mgmt_ui.sort();
            }
            if(json.environment != undefined) {
                this.environment = json.environment;
            }
            if(json.environment_name != undefined) {
                this.environment_name = json.environment_name;
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

            //
            //Legacy config file (convert to new)
            //

            if(json.server_mode != undefined) {
                // Old setting: server_mode = 'prod' or 'dev'
                this.legacy_config = true;
                this.legacy_notes += "     [server_mode = 'prod' or 'dev'] changed to [mgmt_mode = true or false]\n";

                //Convert settings
                (json.server_mode == "prod") ? this.mgmt_mode = false : this.mgmt_mode = true;
            }
            if(json.server_dev_ui != undefined) {
                // Old setting: server_dev_ui = []
                this.legacy_config = true;
                this.legacy_notes += "     [server_dev_ui = [array] ] changed to [mgmt_ui = [array] ]\n";

                //Convert settings
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

    //Console.log
    consolelog(message) {
        if(this.debug_mode_on == true) {
            console.log(message);
        }
    }
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
            "environment":this.environment,
            "environment_name":this.environment_name
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
                console.log(` :: ${this_log.message}`);
            }
        }

        //Send to logger
        logger.log(this_log)
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

        //Check changes
        if(mapping.scan_project_changes() == true) {
            this.log({
                "source":"system",
                "state":"info",
                "message":`Project configuration change detected, update project mapping`
            })

            //Update changes
            mapping.map_generate();
        }
    }

    //////////////////////////////////////
    // Web server functions
    //////////////////////////////////////

    //Server listeners
    start_server() {
        this.log({
            "source":"system",
            "state":"info",
            "message":"Starting Node.js (virtual hosts server)"
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
                    "source":"system",
                    "state":"error",
                    "message":"Cannot load SSL certificate files"
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
                "source":"system",
                "state":"error",
                "message":"HTTP and HTTPS services are disabled -- workers are sitting around not doing their job"
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
            "source":"system",
            "state":"info",
            "message":`HTTP server - port ${this.http_port}`
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
            "source":"system",
            "state":"info",
            "message":`HTTP server - port ${this.https_port}`
        })
    }
    client_request(protocol, req, res) {
        //Set logger target name
        //logger.target_log_name = "devui"

        //Start time
        let time = new Date();
        let start_time = time.getTime();
        let end_time = null;

        //Define _server
        let _server = {
            "local_ipv4":this.ipv4_address,
            "local_ipv6":this.ipv6_address,
            "request_ip":null,
            "node_version":null,
            "environment":this.environment,
            "environment_name":this.environment_name
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
        let _headers = {};
        for(let i = 0; i <= (req.rawHeaders.length-1) ; i++ ){
            if(i % 2 != 1) {
                _headers[req.rawHeaders[i]] = req.rawHeaders[i+1]
            }
        }

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

        //Request string
        let full_url = ""
        if(this_query == null) {
            full_url = `${this_protocol}://${this_host}${this_port}${this_path}`;
        }else{
            full_url = `${this_protocol}://${this_host}${this_port}${this_path}?${decodeURIComponent(this_query)}`;
        }

        //Match URL
        let request_match = mapping.match_url(full_url);

        //SSL Redirect
        if(protocol == "http" && this.https_on == true) {
            if(request_match.ssl_redirect == true) {
                //Set redirect URL
                if(this.https_port != 443) {
                    this_host += `:${this.https_port}`
                }
                let redirect_url = `https://${this_host}${this_path}`
                if(this_query != null) {
                    redirect_url += `?${this_query}`
                }

                //End time
                time = new Date()
                end_time = time.getTime()

                //Log
                this.log({
                    "source":"system",
                    "state":"info",
                    "message":`Request Time [${end_time - start_time} ms] :: Enforce SSL Connection : Redirect to > ${redirect_url}`,
                    "time":(end_time-start_time)
                })

                //Redirect
                res.writeHead(301, {"Location": redirect_url});
                res.end();
                return;
            }
        }
        if(request_match.ssl_redirect == true && this.https_on == false) {
            //Log
            this.log({
                "source":"system",
                "state":"warn",
                "message":`SSL Redirect Enforced but server HTTPS is disabled`
            })
        }

        //Get URL to folder mapping
        let status_code = request_match.status_code;
        let file_path = path.join(request_match.file_path, request_match.file_name);
        let exec_mode = request_match.file_exec;

        //Log connection
        let this_request = {
            "source":`${request_match.project}-${request_match.website}`,
            "state":"info",
            "full_url":full_url,
            "message":"",
            "server_ipv4":_server.local_ipv4,
            "server_ipv6":_server.local_ipv6,
            "client_ip":_client.remote_ip,
            "client_ip_xff":_client.remote_ip_xff,
            "client_agent":_client.user_agent,
            "req_method":this_method,
            "req_http_version":this_http_version,
            "req_http_protocol":this_protocol,
            "req_hostname":this_host,
            "req_port":this_port,
            "req_path":this_path,
            "req_query":decodeURIComponent(this_query),
            "status_code":request_match.status_code,
            "status_msg":request_match.status_msg,
            "match_error":request_match.error,
            "match_website":request_match.website,
            "match_hostname":request_match.match_host,
            "match_vhost":request_match.match_vhost,
            "match_proxyuri":request_match.match_proxyuri,
            "match_submap":request_match.match_submap,
            "match_file_type":request_match.file_match_type,
            "match_file_exec":request_match.file_exec,
            "match_file_path":request_match.file_path,
            "match_file_name":request_match.file_name,
            "match_log":request_match.log,
            "time":start_time  // Used to pass to server side execute and recalc total time
        }

        //Create _request details
        let _request = {
            "method":this_method, 
            "http_version":this_http_version,
            "protocol":this_protocol,
            "hostname":this_host,
            "path":this_path,
            "path_prefix":request_match.website_uri_prefix,
            "path_suffix":request_match.website_uri_suffix,
            "query_string":this_query,
            "fixed_api_path":[]
        }
        if(request_match.fixed_api_path.length > 0) {
            _request.fixed_api_path = request_match.fixed_api_path;
        }

        //Unload the server side file if cache is false (used when content is static)
        if(this.cache_on == false) {
            //delete require.cache[file_path];
            this.clear_cahced()
        }

        //Handle exec type
        if(exec_mode == "client") {
            //End time and request log
            time = new Date()
            end_time = time.getTime()
            this_request["time"] = (end_time-start_time);
            this_request["message"] = `Request Time [${this_request["time"]} ms] > [${request_match.status_code}] ${this_request["full_url"]}`;
            this.log(this_request)

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
                "_headers":_headers,
                "_request":_request, 
                "_query":{}
            }

            //Process GET or POST / OTHER
            if(this_method == "POST") {
                this_query = "";
                req.on('data', function (data) {
                    this_query += data;
                });
                req.on('end', function () {
                    params._query = mapping.match_parse_query(this_query);
                    parent.exec_server_side(res, file_path, params, this_request);
                });
            }else{
                //Set request parameters
                params._query = mapping.match_parse_query(this_query);
                this.exec_server_side(res, file_path, params, this_request);
            }
        }else{
            //End time and request log
            time = new Date()
            end_time = time.getTime()
            this_request["time"] = (end_time-start_time);

            //Update log output
            this_request["source"] = "system";
            this_request["state"] = "error";
            this_request["message"] = `Request Time [${this_request["time"]} ms] > [500] Failed to define client or server handling for file: ${file_path}`;
            this_request["status_code"] = 500;
            this_request["status_msg"] = "System error classifying file to execute server side or send to client";

            //Send log
            this.log(this_request)

            //Response
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end("Error: exec state not set");
        }
    }
    async exec_server_side(res, file_path, params, this_request) {
        //Run server side code
        try {
            //Include server side code
            let exec_javascript = require(file_path);

            //Execute request and get response
            let response = await exec_javascript.request(params);

            //Handle response
            this.exec_server_side_response(res, file_path, response, this_request)
        }catch(err){
            this.exec_server_side_error(res, file_path, err, this_request);
        }
    }
    exec_server_side_response(res, file_path, response, this_request) {
        if(response == undefined) {
            this.exec_server_side_response_null(res, file_path, this_request)
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

                //End time and request log
                let time = new Date()
                let end_time = time.getTime()
                this_request["time"] = (end_time - this_request["time"]);

                //Update log output
                this_request["message"] = `Request Time [${this_request.time} ms] > [${this_request.status_code}] ${this_request.full_url}`;

                //Send log
                this.log(this_request);

                //Set headers
                if(Object.keys(this_headers).length > 0) {
                    for(let header in this_headers) {
                        res.setHeader(header, this_headers[header]);
                    }
                }
    
                //Send response body
                res.end(this_body);
            }catch(catch_error) {
                this.exec_server_side_error(res, file_path, catch_error, this_request);
            }
        }
    }
    exec_server_side_response_null(res, file_path, this_request) {
        //Unload the server side file on error
        delete require.cache[file_path];

        //End time and request log
        let time = new Date()
        let end_time = time.getTime()
        this_request["time"] = (end_time - this_request["time"]);

        //Update log output
        this_request["state"] = "error";
        this_request["message"] = `Request Time [${this_request["time"]} ms] > [500] ${this_request["full_url"]}`;
        this_request["status_code"] = 500;
        this_request["status_msg"] = `500 Internal Server Error: ${file_path}, response null`;

        //Send log
        this.log(this_request);

        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`{"error":"500 Internal Server Error"}`);
    }
    exec_server_side_error(res, file_path, catch_error, this_request) {
        //Unload the server side file on error
        delete require.cache[file_path];

        //End time and request log
        let time = new Date()
        let end_time = time.getTime()
        this_request["time"] = (end_time - this_request["time"]);

        //Update log output
        this_request["state"] = "error";
        this_request["message"] = `Request Time [${this_request["time"]} ms] > [500] ${this_request["full_url"]}`;
        this_request["status_code"] = 500;
        this_request["status_msg"] = `500 Internal Server Error: ${file_path}`;
        this_request["stack_trace"] = catch_error.stack;

        //Send log
        this.log(this_request);

        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(catch_error.toString());
    }

    //Request handling
    mime_type(file) {
        //
        // Ref:
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
        //

        //Set MIME Types
        let mime_types = this.mime_types;

        //Add default
        mime_types["default"] = "application/octet-stream";

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
                        "source":"system",
                        "state":"info",
                        "message":`server.cache_on = false, remove module from server cache [${cached}]`
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
            this.consolelog("");
            this.consolelog(`   Management Mode         : ${this.mgmt_mode}`);
            this.consolelog(`   Management UI Hostnames : ${this.mgmt_ui.toString()}`);
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

        //Update legacy settings
        if(this.legacy_config == true) {
            console.log("\n");
            console.log("   *** Outdated Server Configuration Detected ***\n");
            console.log(this.legacy_notes);
            console.log("\n");

            //Log
            this.log({
                "source":"system",
                "state":"error",
                "message":`Outdated server config setting detected`
            })
        }
    }
}

//Export modules
module.exports = vhost_server;