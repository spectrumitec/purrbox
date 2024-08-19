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
    //Request parameters
    params = null;

    //Class state
    conn = {
        "id":"web_connector",
        "request":"",
        "response":{},
        "error":"",
        "state":"",
        "method":"GET",
        "url":"",
        "query":null,
        "status_code":"",
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
        if(arguments[0] != undefined) {
            //Set parameters
            this.params = arguments[0];
            this.conn.request = arguments[0];

            //Set connection state
            if(this.params["method"] != undefined) {
                this.set_method(this.params["method"]);
            }
            if(this.params["url"] != undefined) {
                this.set_url(this.params["url"]);
            }
            if(this.params["query"] != undefined) {
                this.set_query(this.params["query"]);
            }

            //Set callback
            if(this.params["callback"] != undefined) {
                this.callback = this.params["callback"];
            }
        }

        //If parameters are defined, send request immediately
        if(this.conn.url != "") {
            this.send_request();
        }
    }

    //Set functions
    set_method(method=null) {
        if(method != null) {
            method = method.toUpperCase();
            switch(method) {
                case "GET": case "POST":
                    this.conn.method = method;
                break;
                default:
                    console.log(`web_connector :: invalid method [${method}]`)
            }
        }
    }
    set_url(url=null) {
        if(url != null) {
            this.conn.url = url;
        }
    }
    set_query(query=null) {
        if(query != null) {
            try{
                this.conn.query = JSON.stringify(query);
            }catch(e){
                console.log(`web_connector :: failed to convert query to string`);
                console.log(e);
            }
        }
    }

    //Get functions
    get_response() {
        return this.conn.response;
    }

    //Send request
    send_request() {
        //Set response variable
        this.conn.state = "running";

        //Process the request on return data
        switch(this.conn.method) {
            case "GET":
                this.conn.response = $.getJSON(this.conn.url, this.conn.query)
                .fail(function() {
                    console.log("web_connector :: send_request :: request fail");
                });
            break;
            case "POST":
                let post_query = JSON.parse(this.conn.query);
                this.conn.response = $.post(this.conn.url, post_query)
                .fail(function() {
                    console.log("web_connector :: send_request :: request fail");
                });
            break;
        }

        //Run check
        this.check_response();

    }

    //Periodic response check
    check_response() {
        if(this.conn.response.readyState != 4) {
            //Check is data is not returned yet (keep tying until given timeout)
            this.timeout++
            if(this.timeout < this.waitcount){
                setTimeout(() => {
                    this.check_response()
                }, this.timer);
            }else{
                //Set connection states
                this.conn.state = "error";
                this.conn.status_code = "408";
                this.conn.error = "Request Timeout";
                this.conn.text = "";
                this.conn.json = {};

                //Callback
                this.callback_function();
            }
        }else{
            //Check status code
            if(this.conn.response.status != 200) {
                //Set connection states
                this.conn.state = "error";
                this.conn.status_code = (this.conn.response.status).toString();
                this.conn.error = (this.conn.response.statusText).toString();
                this.conn.text = "";
                this.conn.json = {};
                
                //Error state
                if(this.conn.query != "") {
                    console.log(`web_connector :: Error : STATUS[${this.conn.response.status}] > ${this.conn.url}?${this.conn.query}`);
                }else{
                    console.log(`web_connector :: Error : STATUS[${this.conn.response.status}] > ${this.conn.url}`);
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
                        this.conn.json = JSON.parse(decodeURIComponent(this.conn.response.responseText));
                    }catch{
                        console.log(`web_connector :: Error : responseText not JSON format`);
                    }
                }

                //Callback
                this.callback_function();
            }
        }
    }
    callback_function() {
        if(this.callback != null) {
            this.callback(this.conn);
        }
    }
}