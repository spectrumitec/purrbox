'use strict';

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

//Set Node JS constants
import cluster from "node:cluster";

//Import system
import vhost_server from "./server/class/vhost.js"

//Create server class
const server = new vhost_server();

//Set parameters
var workers = server.get("workers")
var debug_mode = server.get("debug_mode_on")
var auto_refresh = server.get("auto_refresh_on")
var refresh_timer = server.get("auto_refresh_timer")

//Cluster
if(cluster.isMaster) {
    console.log();
    console.log(" ═══════════════════════════════════════════════════════════════════════════════");
    console.log(" Node.js VHost Server Cluster Controller");
    console.log(`   Controller is running: pid[${process.pid}]`);

    //Verify settings to start
    if(debug_mode == true && workers > 1) {
        console.log("   ** Debug mode is disabled when running more than one worker process");
    }
    if(workers == undefined) { 
        console.log("   ** Server config missing workers = <number> setting");
        process.exit();
    }

    //Start workers
    console.log(`   Configured Workers: ${workers}`);
    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }

    // Restart node on failure
    cluster.on("exit", (worker, code, signal) => {
        console.log(`  ** VHost Worker failed. pid[${worker.process.pid}]`);
        cluster.fork();
    });
    console.log(" ═══════════════════════════════════════════════════════════════════════════════");
    console.log();
}else{

    console.log(` :: VHost Worker started. pid[${process.pid}]`);

    //Output server settings (debug mode = true, worker = 1)
    server.output_server_settings();

    //Load web source configs
    server.query_web_source_config()

    server.refresh_web_config();

	//Set refresh timer to periodically refresh web project configurations without server reload
	function refresh_web_configs() {
		server.query_web_source_config()

        server.refresh_web_config();

	}    
	if(auto_refresh == true) {
		setInterval(refresh_web_configs, refresh_timer);
	}

	//Start server listeners
	server.start_server();
}
