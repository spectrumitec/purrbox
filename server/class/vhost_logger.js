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

//Set Node JS constants
const os = require("os");
const fs = require("fs");
const path = require("path");
const syslog = require("syslog-client");

//Server class
class vhost_logger {
    //System paths
    paths = {}                          //System paths
    default_log_name = "log-system";    //Log filename or syslog identifier
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
    }
    define_paths() {
        //Set root
        let root = `${path.dirname(path.dirname(__dirname))}${path.sep}`;

        //Set default paths
        this.paths["root"] = root;
        this.paths["logs"] = path.join(root,"logs",path.sep);
        this.paths["conf"] = path.join(root,"conf",path.sep);
        this.paths["config"] = path.join(root,"conf","logger.json");
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
                this.files_old = calc_time;
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
        }
    }

    //Logging functions
    log(data={}) {
        //Set message
        let timestamp = new Date().toISOString();
        let log_data = {
            "timestamp":timestamp,
            "server":this.server,
            "process_id":process.pid,
            "application":"wonderbox",
            "state":"info",
            "message":"",
            "log":{}
        };

        //Set file timestamp
        let filedatetime = timestamp.replace(/T.+/, '');

        //Set default log files
        this.file_text = `${this.default_log_name}_${filedatetime}.log`;
        this.file_json = `${this.default_log_name}_${filedatetime}.json`;
        log_data.application = `${log_data.application}-${this.default_log_name}`;

        //Get fields from payload
        if(data.logfile != "") {
            this.file_text = `request-${data.logfile}_${filedatetime}.log`;
            this.file_json = `request-${data.logfile}_${filedatetime}.json`;
            log_data.application = `${log_data.application}-${data.logfile}`;
        }
        if(data.state != undefined) {
            log_data.state = data.state
        }
        if(data.message != undefined) {
            log_data.message = data.message
        }
        if(data.log != undefined) {
            log_data.log = data.log
        }

        //Log cleanup (if set to network, still check log file path to clear old file if any)
        this.log_file_cleanup()

        //Write log
        if(this.syslog_use == "file") {
            this.log_file(log_data)
        }else if(this.syslog_use == "network") {
            this.log_network(log_data)
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
        //Standard log file
        let log_entry = `${log.timestamp} [server:${log.server}] [pid:${log.process_id}] [state:${log.state}] -- ${log.message}\n`
        let log_file = path.join(this.paths["logs"], this.file_text)

        fs.appendFile(log_file, log_entry, err => {
            if (err) {
                console.error(err);
            }
        });

        //JSON log file
        log_file = path.join(this.paths["logs"], this.file_json)
        let log_data = "";
        let if_log_exists = fs.existsSync(log_file);
        let json = [];
        if(if_log_exists == true) {
            //Open log file
            log_data = fs.readFileSync(log_file);
            try {
                json = JSON.parse(log_data);
            }catch{
                return;
            }
        }

        //Appand JSON data
        json.push(log)

        //Write file
        log_data = JSON.stringify(json,null)
        fs.writeFile(log_file, log_data, err => {
            if (err) {
                console.error(err);
            }
        });
    }
    log_network(log) {
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
            }
            let client = syslog.createClient(this.server_ipaddr, options);

            //Send log options
            options = {
                "facility": syslog.Facility.Local0,
                "severity": syslog.Severity.Informational
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
                if (error) {
                    console.error(error);
                }
            });
        }
    }
}

//Export modules
module.exports = vhost_logger;