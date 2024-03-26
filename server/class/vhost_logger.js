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

//
// Node JS virtual server logger
//

//Set Node JS constants
const fs = require("fs");
const path = require("path");

//Server class
class vhost_logger {
    //System paths
    paths = {}                  //System paths

    //Construct class
    constructor() { 
        //Start class initialization
        this.define_paths()

        //Check essetial files
        this.check_paths();
    }
    define_paths() {
        //Set root
        let root = `${path.dirname(path.dirname(__dirname))}${path.sep}`;

        //Set default paths
        this.paths["root"] = root;
        this.paths["logs"] = path.join(root,"logs",path.sep);
        this.paths["web_source"] = path.join(root,"web_source",path.sep);
    }
    check_paths() {
        //Check required directories
        if(!fs.existsSync(this.paths["logs"])){
            fs.mkdirSync(this.paths["logs"]);
        }
    }

    //Create log
    log(payload={}) {
        //Set message
        var timestamp = new Date().toISOString();
        var log_message = {
            "timestamp":timestamp,
            "state":"info",
            "target":"",
            "request":"",
            "log":{}
        };

        //Get fields from payload
        if(payload.state != undefined) {
            log_message.state = payload.state
        }
        if(payload.target != undefined) {
            log_message.target = payload.target
        }
        if(payload.request != undefined) {
            log_message.request = payload.request
        }
        if(payload.log != undefined) {
            log_message.log = payload.log
        }

        console.log(log_message)

        // Check if the current log file needs rotation
        /*
        if (this.currentLogSize + logMessage.length > this.maxFileSizeInBytes) {
            this.rotateLogFile();
        }

        // Append the log message to the current log file
        fs.appendFileSync(this.currentLogFile, logMessage, 'utf8');
        this.currentLogSize += logMessage.length;
        */
    }
    rotateLogFile() {
        // Close the current log file (if any)
        if (this.currentLogFile) {
            fs.closeSync(fs.openSync(this.currentLogFile, 'a'));
        }

        // Generate a new log file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newLogFile = path.join(this.logDirectory, `app-${timestamp}.log`);

        // Update the current log file and reset log size
        this.currentLogFile = newLogFile;
        this.currentLogSize = 0;

        // Clean up old log files if needed
        this.cleanupOldLogFiles();
    }
    cleanupOldLogFiles() {
        const logFiles = fs.readdirSync(this.logDirectory);
        if (logFiles.length > this.maxFiles) {
            const filesToDelete = logFiles.slice(0, logFiles.length - this.maxFiles);
            filesToDelete.forEach((file) => {
            fs.unlinkSync(path.join(this.logDirectory, file));
            });
        }
    }
    

}

//Export modules
module.exports = vhost_logger;