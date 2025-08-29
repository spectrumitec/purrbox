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
Node JS virtual server logger
    Initial build for basic log file creation on local instance and/or send
    to log server
*/

//Set dirname
const __dirname = import.meta.dirname;

//Set Node JS constants
import * as os from "os"
import * as fs from "fs"
import * as path from "path";
import * as syslog from "syslog-client";

//Server class
class vhost_logger {
    //Version
    application = "Purrbox";
    application_ver = "x.x.x";
    application_mode = "(ECMAScript)";

    //System paths
    paths = {}                          //System paths
    default_log_name = "system";        //Log filename or syslog identifier
    server = "";

    //Syslog File Parameters
    syslog_use = "file";                //Default when config missing
    files_old = 604800000;              //Default 7 days old
    file_text = "";
    file_json = "";
    server_type = "rsyslog";            //Rsyslog, Graylog
    server_ipaddr = "127.0.0.1";
    server_port = "514";
    server_protocol = "udp";
    server_timeout = 5000;

    //Construct class
    constructor() { 
        //Get system hostname
        this.server = os.hostname();

        //Start class initialization
        this.define_paths();

        //Check essetial files
        this.check_paths();

        //Load config
        this.load_config();

        //Check Environment Variable Overrides (containers)
        this.check_env_overrides();
    }
    define_paths() {
        //Set root
        let root = `${path.dirname(path.dirname(__dirname))}${path.sep}`;

        //Set default paths
        this.paths["root"] = root;
        this.paths["logs"] = path.join(root,"logs",path.sep);
        this.paths["conf"] = path.join(root,"conf",path.sep);
        this.paths["config"] = path.join(root,"conf","logger.json");

        //Application version
        this.paths["app_ver"] = path.join(root,"server","class","app_ver");
    }
    check_paths() {
        //Check required directories
        if(!fs.existsSync(this.paths["logs"])){
            fs.mkdirSync(this.paths["logs"]);
        }
        if(!fs.existsSync(this.paths["conf"])){
            fs.mkdirSync(this.paths["conf"]);
        }

        //Check server config file
        let this_conf = this.paths["config"];
        if(!fs.existsSync(this_conf)){
            let conf_data = {
                "use":"file",
                "file": {
                    "delete_older":"7d"
                },
                "server": {
                    "ipaddr":"127.0.0.1",
                    "port":"514",
                    "protocol":"udp"
                }
            }
            conf_data = JSON.stringify(conf_data,null,"\t")
            fs.writeFileSync(this_conf, conf_data)
        }
    }
    load_config() {
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
            if(json.use != undefined) {
                this.syslog_use = json.use;
            }

            if(json["file"]["delete_older"] != undefined) {
                let field = json["file"]["delete_older"]; 
                this.files_old = this.calc_log_file_purge(field);
            }
            if(json["server"]["ipaddr"] != undefined) {
                this.server_ipaddr = json["server"]["ipaddr"];
            }
            if(json["server"]["port"] != undefined) {
                this.server_port = json["server"]["port"];
            }
            if(json["server"]["protocol"] != undefined) {
                this.server_protocol = json["server"]["protocol"];
            }
            if(json["server"]["protocol"] != undefined) {
                this.server_timeout = Number(json["server"]["timeout"]);
            }
        }

        //Check for config file
        let app_ver = this.paths["app_ver"];
        let if_app_ver = fs.existsSync(app_ver);
        if(if_app_ver == true) {
            let content	= fs.readFileSync(app_ver);
            this.application_ver = content.toString();
        }
    }
    check_env_overrides() {
        //Check environment when used in container environments
        for(let e in process.env) {
            switch(e) {
                case "PURRBOX_LOG_TYPE":
                    if(process.env[e] == "none") {
                        this.syslog_use = "none";
                    }
                    if(process.env[e] == "file") {
                        this.syslog_use = "file";
                    }
                    if(process.env[e] == "server") {
                        this.syslog_use = "server";
                    }
                break;
                case "PURRBOX_LOG_FILE_PURGE":
                    this.files_old = this.calc_log_file_purge(process.env[e]);
                break;
                case "PURRBOX_LOG_SERVER_IPADDR":
                    this.server_ipaddr = process.env[e];
                break;
                case "PURRBOX_LOG_SERVER_PORT":
                    this.server_port = process.env[e];
                break;
                case "PURRBOX_LOG_SERVER_PROTOCOL":
                    this.server_protocol = process.env[e];
                break;
            }
        }
    }
    
    //Calulate time
    calc_log_file_purge(field) {
        //Calculate time in seconds
        let unit = field.slice(-1);
        let num = field.replace(/\D/g,'');
        let calc_time;
        switch(unit) {
            case "m":
                calc_time = num * (60 * 1000);
                break;
            case "h":
                calc_time = num * (60 * 60 * 1000);
                break;
            case "d":
                calc_time = num * (60 * 60 * 24 * 1000);
                break;
            case "w":
                calc_time = num * (60 * 60 * 24 * 7 * 1000);
                break;
            default:
                //Default to second
                calc_time = num * 1000;
        }

        //Return value
        return calc_time;
    }

    //Logging functions
    log(data={}) {
        //Set message
        let timestamp = new Date().toISOString();
        let log_data = {
            "_timestamp":timestamp,
            "_application":this.application,
            "_application_ver":this.application_ver,
            "_server_hostname":this.server,
            "_process_id":process.pid,
            "_node_version":process.version,
            "source":"",
            "state":"info",
            "message":""
        };

        //Set file timestamp
        let filedatetime = timestamp.replace(/T.+/, '');

        //Set default log files
        this.file_text = `${this.default_log_name}_${filedatetime}.log`;
        this.file_json = `${this.default_log_name}_${filedatetime}.json`;

        //Get fields from payload
        log_data.source = data.source;
        if(data.source == "system" || data.source == "mapper") {
            this.file_text = `${data.source}_${filedatetime}.log`;
            this.file_json = `${data.source}_${filedatetime}.json`;
        }else{
            if(data.status_code == 500) {
                this.file_text = `${data.source}_error_${filedatetime}.log`;
                this.file_json = `${data.source}_error_${filedatetime}.json`;
            }else{
                this.file_text = `${data.source}_request_${filedatetime}.log`;
                this.file_json = `${data.source}_request_${filedatetime}.json`;
            }
        }
        if(data.state != undefined) {
            log_data.state = data.state
        }
        if(data.message != undefined) {
            log_data.message = data.message
        }

        //Append additional fields
        for(let field in data) {
            if(log_data[field] == undefined) {
                log_data[field] = data[field];
            }
        }

        //Log cleanup (if set to server, still check log file path to clear old file if any)
        this.log_file_cleanup()

        //Write log
        if(this.syslog_use == "none") {
            return;
        }else if(this.syslog_use == "file") {
            this.log_file(log_data)
        }else if(this.syslog_use == "server") {
            this.log_server(log_data)
        }else{
            //Set default log files
            this.file_text = `log_error_${filedatetime}.log`;
            this.file_json = `log_error_${filedatetime}.json`;
            log_data.state = "error";
            log_data.message = `Logger has an invalid configuration file, use defined as '${this.syslog_use}'`;
            log_data.log = {};
            this.log_file(log_data);
        }
    }
    log_file_cleanup() {
        //Log dir
        var parent = this;
        let log_dir = this.paths["logs"];

        fs.readdir(log_dir, function(err, files) {
            files.forEach(function(file, index) {
                var this_file = path.join(log_dir, file);
                fs.stat(this_file, function(err, stat) {
                    if (err) {
                        return console.error(err);
                    }

                    let endTime, now;
                    now = new Date().getTime();
                    endTime = new Date(stat.ctime).getTime() + parent.files_old;

                    if (now > endTime) {
                        if(fs.existsSync(this_file)) {
                            fs.unlinkSync(this_file);
                        }
                    }
                });
            });
        });   
    }
    log_file(log) {
        //Append Standard Log File
        let log_entry = `${log._timestamp} [server:${log._server_hostname}] [pid:${log._process_id}] [ver:${log._node_version}] [state:${log.state}] -- ${log.message}\n`;
        let log_file = path.join(this.paths["logs"], this.file_text);
        fs.appendFile(log_file, log_entry, err => {
            if (err) {
                console.error(err);
            }
        });

        //Append JSON Log File
        log_entry = JSON.stringify(log) + "\n";
        log_file = path.join(this.paths["logs"], this.file_json);
        fs.appendFile(log_file, log_entry, err => {
            if (err) {
                console.error(err);
            }
        });
    }
    log_server(log) {
        //Vars
        var parent = this;
        var timestamp = new Date().toISOString();

        //Set log settings
        if(this.server_type == "rsyslog") {
            //Create client
            let options = {
                "syslogHostname": this.server,
                "transport": syslog.Transport.Udp,
                "port": this.server_port
            };
            if(this.server_protocol == "tcp") {
				options.transport = syslog.Transport.Tcp;
				options.tcpTimeout = this.server_timeout;
            }
            let client = syslog.createClient(this.server_ipaddr, options);

            //Send log options
            options = {
                "facility": syslog.Facility.Local0,
                "severity": syslog.Severity.Informational,
                "timestamp": Date()
            };
            if(log.state == "error") {
                options.severity = syslog.Severity.Error;
            }
            if(log.state == "warn") {
                options.severity = syslog.Severity.Warning;
            }

            //Configure message
            let json = JSON.stringify(log)
            client.log(json, options, function(error) {
                if (!error) {
                    //Close client connection
                    client.close();
                }
            });

            client.on("error", function (error) {
                console.log(error)

                //Set default log files
                let filedatetime = timestamp.replace(/T.+/, '');
                parent.file_text = `log_error_${filedatetime}.log`;
                parent.file_json = `log_error_${filedatetime}.json`;
                log.state = "error";
                log.message = `Failure sending syslog to: '${parent.server_ipaddr}:${parent.server_port} ${parent.server_protocol}'`;
                log.log = {
                    "error":error
                };
                parent.log_file(log);

                //Close client connection
                client.close();
            });

        }
    }
}

//Export modules
export default vhost_logger;