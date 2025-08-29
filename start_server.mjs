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

Web server start script, node process cluster manager

*/

//Import node modules
import cluster from "node:cluster";

//Import vhost server class
import vhost_server from "./server/class/vhost_server.mjs";
import vhost_logger from "./server/class/vhost_logger.mjs";

//Create class
const server = new vhost_server();
const logger = new vhost_logger();

//Set parameters
var app_ver = `${server.application} ${server.application_ver} ${server.application_mode}`
var workers = server.get("workers")
var cache_on = server.get("cache_on")
var auto_refresh = server.get("auto_refresh_on")
var refresh_timer = server.get("auto_refresh_timer")
var cache_reset_timer = null;

//Catch signal kill
process.on('SIGINT', () => {
    console.info(` :: [pid:${process.pid}] Signal Process End`)
    process.exit(0)
});

//Cluster
if(cluster.isMaster) {
    console.log();
    console.log(` ${app_ver}`);
    console.log();
    console.log(" ═══════════════════════════════════════════════════════════════════════════════");
    console.log(" Node.js VHost Server Cluster Controller");
    console.log(`   Controller is running: pid[${process.pid}]`);
    console.log(`   Configured for [${workers}] workers`);
    console.log(" ═══════════════════════════════════════════════════════════════════════════════");
    console.log();

    //Output server details
    server.output_server_settings();

    //Verify settings to start
    if(workers == undefined) { 
        console.log("   ** Server config missing workers = <number> setting");
        process.exit();
    }

    //Set message listener
    function worker_listeners() {
        for (let id in cluster.workers) {
            cluster.workers[id].on('message', worker_msg);
        }
    }
    //Check for worker messages
    function worker_msg(msg) {
        console.log(` :: [pid:${process.pid}] Cluster Worker message: ${msg}`)

        //Set worker reset if no timer set and 
        if(msg == "cache_reset" && cache_reset_timer == null) {
            cache_reset_timer = setTimeout(worker_reset, 100);
        }
    }
    function worker_reset() {
        cache_reset_timer = null;
        for (let id in cluster.workers) {
            cluster.workers[id].kill();
        }
    }

    //Start workers
    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }
    worker_listeners();

    //Restart node on failure
    cluster.on("exit", (worker, code, signal) => {
        console.log(` :: [pid:${process.pid}] VHost Worker exit :: code[${code}] signal[${signal}]`);
        cluster.fork();
        worker_listeners();
    });
}else{

    console.log(` :: [pid:${process.pid}] VHost Worker started`);

    //Scan web config mapping and source file changes
    server.refresh_web_configs();
    server.refresh_scan_source();

	//Set refresh timer to periodically refresh web project configurations without server reload
	function refresh_source() {
		server.refresh_web_configs();
	}    
	if(auto_refresh == true) {
		setInterval(refresh_source, refresh_timer);
	}

    //Cache off check
    function cache_reset_check() {
        server.refresh_scan_source();
    }
    if(cache_on == false) {
		setInterval(cache_reset_check, 1000);
	}

	//Start server listeners
	server.start_server();
}
