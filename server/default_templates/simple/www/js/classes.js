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
    Web connector class

*/

class web_connector {
    //Debug
    debug = false;

    //Class state
    http = null;
    http_timeout = 5000;       //Ten second time out
    conn = {
        "id":"web_connector",
        "request":"",
        "response":{},
        "error":"",
        "state":"",
        "method":"GET",
        "url":"",
        "query":null,
        "status_code":"0",
        "text":"",
        "json":{}
    }

    // Class varaibles
    callback = null;

    //Timeout settings
    waitcount = 300;
    timer = 100;
    timeout = 0;
    
    //Object constructor
    constructor() {

        this.log("construct")

        if(arguments[0] != undefined) {
            //Set parameters
            let params = arguments[0];
            this.conn.request = arguments[0];

            //Set connection state
            if(params["method"] != undefined) {
                this.set_method(params["method"]);
            }
            if(params["url"] != undefined) {
                this.set_url(params["url"]);
            }
            if(params["query"] != undefined) {
                this.set_query(params["query"]);
            }

            //Set callback
            if(params["callback"] != undefined) {
                this.callback = params["callback"];
            }
        }

        //If parameters are defined, send request immediately
        if(this.conn.url != "") {
            this.send_request();
        }
    }

    //Class console logging (debug = true)
    log(output) {
        //Console output
        if(this.debug == true) { 
            let datestamp = this.get_datestamp();
            if(typeof output === "object") {
                console.log(output);
            }else{
                console.log(`${datestamp} :: web_connector :: ${output}`); 
            }
        }
    }
    padTo2Digits(num) {
        return num.toString().padStart(2, "0");
    }
    padTo3Digits(num) {
        return num.toString().padStart(3, "0");
    }
    get_datestamp() {
        let d = new Date();
        let yyyy = d.getFullYear();
        let mo   = this.padTo2Digits(d.getMonth() + 1);
        let dd   = this.padTo2Digits(d.getDate());
        let hh   = this.padTo2Digits(d.getHours());
        let mm   = this.padTo2Digits(d.getMinutes());
        let ss   = this.padTo2Digits(d.getSeconds());
        let ms   = this.padTo3Digits(d.getMilliseconds());
        let this_datestamp = yyyy + mo  + dd  + "." + hh  + mm  + ss + "." + ms;
        return this_datestamp;
    }

    //Set functions
    set_method(method=null) {
        if(method != null) {
            method = method.toUpperCase();
            switch(method) {
                case "GET": case "POST":
                    this.conn.method = method;
                    this.log(`set_method :: method [${method}]`)
                break;
                default:
                    this.log(`set_method :: invalid method [${method}]`)
            }
        }
    }
    set_url(url=null) {
        if(url != null) {
            this.conn.url = url;
            this.log(`set_url :: ${url}`)
        }
    }
    set_query(query=null) {
        if(query != null) {
            if(typeof(query) == "object") {
                try{
                    this.conn.query = JSON.stringify(query);
                    this.log(`set_query :: ${this.conn.query}`)
                }catch(e){
                    this.log(`set_query :: failed to convert query to string`);
                    this.log(e);
                }
            }else{
                this.conn.query = query.toString();
            }
        }
    }

    //Get functions
    get_response() {
        return this.conn.response;
    }

    //Send request
    send_request() {
        this.log("send_request ::")

        //Set state
        this.conn.state = "running";

        //Define Ajax object
        try {
            //Modern browsers
            this.http=new XMLHttpRequest();    
        }catch (e) {
            this.conn.state = "error";
            this.conn.error = "Your browser does not support HTTP requests!";
            this.log(`send_request :: ${this.conn.error}`);
            this.callback_function();
            return;
        }

        //Set web call
        let this_url = this.conn.url;
        if(this.conn.query != null) {
            this_url += `?${this.conn.query}`;
        }

        //Execute GET / POST
        this.log(`send_request :: open connection to server: ${this_url}`)
        try{
            this.http.open(this.conn.method,this_url,true);
            this.http.send();
            this.http.timeout = this.http_timeout;
        }catch (e) {
            this.log(e)
        }

        //Check timeout
        this.http.ontimeout = (e) => {
            this.conn.state = "error";
            this.conn.error = "Request timed out"
            this.log(`send_request :: ${this.conn.error}`)
            this.callback_function();
            return;
        }

        //Check readystate change
        this.http.onreadystatechange = (e) => {
            switch(this.http.readyState) {
                case 2:
                    this.log("send_request :: headers response")
                break;
                case 3:
                    this.log("send_request :: downloading response")
                break;
                case 4:
                    this.log("send_request :: complete")
                    this.conn.response = this.http;
                    this.process_response();
                break;
            }
        }
    }

    //Periodic response check
    process_response() {
        this.log("process_response ::")

        //Check status code
        if(this.conn.response.status != 200) {
            //Set connection states
            this.conn.state = "error";
            this.conn.status_code = (this.conn.response.status).toString();
            this.conn.error = (this.conn.response.statusText).toString();
            this.conn.text = "";
            this.conn.json = {};

            //Identify no response from server
            if(this.http.status == 0) {
                this.conn.error = "No response was received from the server";
            }

            //Error state
            if(this.conn.query != "") {
                this.log(`Error : STATUS[${this.conn.response.status}] > ${this.conn.url}?${this.conn.query}`);
            }else{
                this.log(`Error : STATUS[${this.conn.response.status}] > ${this.conn.url}`);
            }

            //Callback
            this.callback_function();                
        }else{
            //Set connection states
            this.conn.state = "completed";
            this.conn.status_code = (this.conn.response.status).toString();
            this.conn.error = "";
            this.conn.text = this.conn.response.responseText;

            //Set parse JSON
            if(this.conn.response.responseJSON != undefined) {
                this.conn.json = this.conn.response.responseJSON;
            }else{
                try{
                    this.conn.json = JSON.parse(this.conn.response.responseText);
                }catch{
                    try{
                        this.conn.json = JSON.parse(decodeURIComponent(this.conn.response.responseText));
                    }catch(e) {
                        this.log(`responseText not JSON format`);
                    }
                }
            }

            //Callback
            this.callback_function();
        }
    }
    callback_function() {
        this.log("callback_function ::")

        if(this.callback != null) {
            this.callback(this.conn);
        }
    }
}
