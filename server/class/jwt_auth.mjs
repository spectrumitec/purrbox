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
    JWT Auth leverages 'jsonwebtoken'

    -- Initial phase to leverage local JSON file (file db) / 'none' setting for no login
    -- Reviewing REDIS or MySQL / MariaDB
    -- Future state to review
       - Redirect to OAuth2 service
       - Act as auth service
*/

//Set dirname
const __dirname = import.meta.dirname;

//Set Node JS constants
import * as fs from "fs"
import * as path from "path";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import * as jsonwebtoken from "jsonwebtoken";

//Set constant
const jwt = jsonwebtoken.default;

//TO BE REMOVED
const s = path.sep;

//Manage class
class jwt_auth {
    //General settings
    paths = {}
    error = "";
    conf = {};

    //Auth mode
    auth_mode = "auth";
    auth_store = "file";

    //DB and session
    auth_db = {}
    auth_session = {}

    //User specifics
    user_agent = null;
    user_ip = null;

    token = "";
    token_header = {}
    token_payload = {}

    //Construct class
    constructor(cookie=null, user_agent=null, user_ip=null) {
        //Start class initialization
        this.define_paths();

        //Check required folders and files
        this.get_config();

        //Set parameters
        this.user_agent = user_agent;
        this.user_ip = user_ip;

        //Process user cookie
        this.parse_cookie(cookie);
    }
    parse_cookie(cookie) {
        //Get policy
        let cookie_name = "jwt";
        let get_policy = this.get_policy("token_cookie_name");
        if(get_policy.error == "") {
            if(get_policy.policy != "") {
                cookie_name = get_policy.policy;
            }
        }

        //Check null cookie
        if(cookie == null) {
            return;
        }

        //Parse cookies
        let parse_cookies = cookie.split(";");
        let this_token = null;
        for(let i in parse_cookies) {
            let this_cookie = parse_cookies[i].trim();
            let parse_cookie = this_cookie.split("=");
            if(parse_cookie[0] == cookie_name) {
                if(parse_cookie[1] != undefined) {
                    this_token = parse_cookie[1];
                }
            }
        }

        //Parse token
        if(this_token != null) {
            //Set token
            this.token = this_token;

            //Parse token
            let parse_token = this_token.split(".");
            if(parse_token[0] != undefined) {
                this.token_header = JSON.parse(atob(parse_token[0]))
            }
            if(parse_token[1] != undefined) {
                this.token_payload = JSON.parse(atob(parse_token[1]))
            }
        }
    }

    //////////////////////////////////////
    // Define paths and require configs
    //////////////////////////////////////

    //Set paths
    define_paths() {
        //Get OS path seperator
        let root = `${path.dirname(path.dirname(__dirname))}`;
        
        //Set default paths
        this.paths["root"] = `${root}${s}`
        this.paths["server"] = `${root}${s}server${s}`;
        this.paths["class"] = `${root}${s}server${s}class${s}`;
        this.paths["conf"] = `${root}${s}server${s}conf${s}`;

        //Set conf files
        this.paths["conf_file"] = `${this.paths["conf"]}jwt_auth_conf.json`;
        this.paths["file_db"] = `${this.paths["conf"]}jwt_auth_db.json`;
        this.paths["sessions_db"] = `${this.paths["conf"]}jwt_auth_sessions.json`;
    }
    get_config() {
        let if_dir_exists = null;
        let if_file_exists = null;
        let mk_dir = null;
        let mk_file = null;

        //Check config folders exist (create if not)
        if_dir_exists = fs.existsSync(this.paths.conf);
        if(if_dir_exists == false) {
            mk_dir = this.make_directory(this.paths.conf);
            if(mk_dir.error != "") {
                this.error = mk_dir.error;
                return;
            }
        }

        //Check config file exists (create defaults if not)
        if_file_exists = fs.existsSync(this.paths.conf_file);
        if(if_file_exists == false) {
            //Create new conf
            mk_file = this.new_conf();
            if(mk_file.error != "") {
                this.error = mk_file.error;
                return;
            }
        }

        //Load config file
        let load_conf = this.load_conf();
        if(load_conf.error != "") {
            this.error = load_conf.error;
            return;
        }else{
            if(this.conf.store.type == undefined) {
                this.error = "Unable to determine JWT database"
            }else{
                this.auth_store = this.conf.store.type;
            }
        }

        //Check local file databases (JSON) in auth_store = 'file' mode
        if(this.auth_store == "file") {
            //Create file database (users, groups, etc)
            if_file_exists = fs.existsSync(this.paths.file_db);
            if(if_file_exists == false) {
                mk_file = this.new_file_db();
                if(mk_file.error != "") {
                    this.error = mk_file.error
                    return;
                }
            }

            //Check sessions db file
            if_file_exists = fs.existsSync(this.paths.sessions_db);
            if(if_file_exists == false) {
                //Create sessions db
                mk_file = this.new_sessions_db();
                if(mk_file.error != "") {
                    this.error = mk_file.error;
                    return;
                }
            }
        }

        //Set auth mode
        if(this.conf.auth_mode != undefined) {
            this.auth_mode = this.conf.auth_mode;
        }
    }

    //////////////////////////////////////
    // File IO functions
    //////////////////////////////////////

    //File functions
    make_file(file=null, content=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == true) {
            return {"error":`File already exists: '${file}'`}
        }

        //Write file
        let create_file = fs.writeFileSync(file, content);
        if(create_file == false) {
            return {"error":`Failed to create file: '${file}'`}
        }else{
            return {"error":""}
        }
    }
    delete_file(file=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Delete file
        try {
            fs.unlinkSync(file);
            return {"error":""}
        }catch{
            return {"error":`Cannot delete file: '${file}'`}
        }
    }
    update_file(file=null, content=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Write file
        let update_file = fs.writeFileSync(file, content);
        if(update_file == false) {
            return {"error":`Failed to create file: '${file}'`}
        }else{
            return {"error":""}
        }
    }
    read_file(file=null) {
        //Check if file exists
        let if_file_exists = fs.existsSync(file);
        if(if_file_exists == false) {
            return {"error":`File does not exist: '${file}'`}
        }

        //Read file
        try {
            let file_content = fs.readFileSync(file, {encoding:'utf8', flag:'r'});
            return {
                    "error":"",
                    "content":file_content
                }
        }catch{
            return {"error":`Cannot read file: '${file}'`}
        }
    }

    //Directory functions
    make_directory(dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == true) {
            return {"error":`Folder already exists: '${dir}'`}
        }

        //Make directory
        let create_dir = fs.mkdirSync(dir);
        if(create_dir == false) {
            return {"error":`Failed to create folder: '${dir}'`}
        }else{
            return {"error":""}
        }
    }
    delete_directory(dir=null) {
        //Check if folder exists
        let if_dir_exists = fs.existsSync(dir);
        if(if_dir_exists == false) {
            return {"error":`Folder doesn't exists: '${dir}'`}
        }

        //Delete directory
        try {
            fs.rmSync(dir, { recursive: true, maxRetries: 3, retryDelay: 100 });
            return {"error":""}
        } catch(err) {
            return {"error":"Unable to delete folder"}
        }
    }    

    //Configuration files
    new_conf() {
        //Config data
        let conf_data = {
            "auth_mode":"auth",
	        "store": {
                "type":"file",
                "mysql": {
                    "server":"127.0.0.1",
                    "username":"user",
                    "password":"password",
                    "database":"datbase"
                }
            }
        }

        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.make_file(this.paths.conf_file, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error};
        }else{
            return {"error":""}
        }
    }
    load_conf() {
        if((fs.existsSync(this.paths.conf_file)) == true) {
            let load_conf = this.read_file(this.paths.conf_file);
            if(load_conf.error != "") {
                return { "error":load_conf.error }
            }else{
                try {
                    let json_data = JSON.parse(load_conf.content);
                    this.conf = json_data;
                    return { "error" : ""}
                }catch{
                    return { "error":`Configuration file has invalid JSON data [${this.paths.conf_file}]` }
                }
            }
        }else{
            return { "error":`Configuration file doesn't exist [${this.paths.conf_file}]` }
        }
    }

    //Users, secret, and session data via file
    new_file_db() {
        //Vars
        let password_hash = this.get_hash_password("admin");

        //Config data
        let conf_data = {
            "default_authorize": {},
            "default_policy":{
                "password_retries": 3,
                "account_lockout": "30m",
                "token_refresh_threshold": "15m",
                "token_cookie_name": "jwt"
            },
            "token_algorithm": {
                "algorithm": "HS256",
                "expiresIn": "2h"
            },
            "users":{
                "admin":{
                    "name":"Administrator",
                    "email":"",
                    "password":password_hash,
                    "auth_tries":0,
                    "auth_tries_time":0,
                    "account_locked":false,
                    "account_disabled":false
                }
            },
            "groups":{
                "admins":{
                    "member_users":[
                        "admin"
                    ],
                    "authorize": {
                        "admins": true
                    }
                }
            },
            "custom": {}
        }

        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.make_file(this.paths.file_db, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error};
        }else{
            return {"error":""};
        }
    }
    update_file_db(conf_data={}) {
        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.update_file(this.paths.file_db, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error}
        }else{
            return {"error":""}
        }
    }
    load_file_db() {
        if((fs.existsSync(this.paths.file_db)) == true) {
            let load_conf = this.read_file(this.paths.file_db);
            if(load_conf.error != "") {
                return { "error":load_conf.error }
            }else{
                try {
                    let json_data = JSON.parse(load_conf.content);
                    return { 
                        "error" : "",
                        "db" : json_data
                    }
                }catch{
                    return { "error":`Configuration file has invalid JSON data [${this.paths.file_db}]` }
                }
            }
        }else{
            return { "error":`Configuration file doesn't exist [${this.paths.file_db}]` }
        }
    }

    //Session file
    new_sessions_db() {
        //Config data
        let conf_data = {
            "user_token":{},
            "application_token":{}
        }

        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.make_file(this.paths.sessions_db, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error};
        }else{
            return {"error":""};
        }
    }
    update_sessions_db(conf_data={}) {
        //Conf file
        conf_data = JSON.stringify(conf_data,null,"\t")
        
        //Write config
        let if_mkfile = this.update_file(this.paths.sessions_db, conf_data);
        if(if_mkfile.error != "") {
            return {"error":if_mkfile.error}
        }else{
            return {"error":""}
        }
    }
    load_sessions_db() {
        if((fs.existsSync(this.paths.sessions_db)) == true) {
            let load_conf = this.read_file(this.paths.sessions_db);
            if(load_conf.error != "") {
                return { "error":load_conf.error }
            }else{
                try {
                    let json_data = JSON.parse(load_conf.content);
                    return { 
                        "error" : "",
                        "db" : json_data
                    }
                }catch{
                    return { "error":`Configuration file has invalid JSON data [${this.paths.sessions_db}]` }
                }
            }
        }else{
            return { "error":`Configuration file doesn't exist [${this.paths.sessions_db}]` }
        }
    }

    //////////////////////////////////////
    // Application Functions
    //////////////////////////////////////

    /*
        Intended to be used by application to define or customize the JWT Auth services. These functions do not 
        verify access permissions to run these functions. The application must validate user, groups, authorized
        or custom definitions as the developer requires per their application.
    */
    
    default_authorize_get() {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.default_authorize_get_file_db(); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    default_authorize_get_file_db() {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.default_authorize == undefined) {
            return { "error":"Error querying default authorize" }
        }else{
            return { 
                "error":"", 
                "default_authorize":db.default_authorize
            }
        }
    }

    default_authorize_create(key=null, value=null) {
        //Validate
        if(key == null) {   return {"error":"'key' is null"}}
        if(value == null) { return {"value":"'key' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.default_authorize_create_file_db(key, value); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    default_authorize_create_file_db(key, value) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.default_authorize == undefined) {
            return {"error":"Error querying default authorize"}
        }else{
            db.default_authorize[key] = value;
        }

        //Cycle groups, update authorized settings
        for(let group in db.groups) {
            if(group != "admins") {
                if(db.groups[group]["authorize"][key] == undefined) {
                    db.groups[group]["authorize"][key] = false;
                }
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    default_authorize_delete(key=null) {
        //Validate
        if(key == null) {   return {"error":"'key' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.default_authorize_delete_file_db(key); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    default_authorize_delete_file_db(key) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.default_authorize == undefined) {
            return {"error":"Error querying default authorize"}
        }else{
            delete db.default_authorize[key];
        }

        //Cycle groups, update authorized settings
        for(let group in db.groups) {
            if(group != "admins") {
                if(db.groups[group]["authorize"][key] != undefined) {
                    delete db.groups[group]["authorize"][key];
                }
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    //Group functions
    groups_get() {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.groups_get_file_db(); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    groups_get_file_db() {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.groups == undefined) {
            return { "error":"Error querying groups" }
        }else{
            return { 
                "error":"", 
                "groups":db.groups
            }
        }
    }

    group_add(group=null) {
        //Validate
        if(group == null) {   return {"error":"'group' name is null"}}
        
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.group_add_file_db(group); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    group_add_file_db(group) {
        //Verify group
        if(group == "admins") {
            return { "error":"Group 'admins' is reserved by the system" }
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to group
        if(db.groups == undefined) {
            return { "error":"Error querying groups" }
        }else{
            if(db.groups[group] == undefined) {
                //Set groups defaults
                db.groups[group] = {
                    "member_users": [],
                    "authorize": {}
                }
            }else{
                return {"error":`Group '${group}' already exists`}
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    group_delete(group=null) {
        //Validate
        if(group == null) {   return {"error":"'group' name is null"}}
        
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.group_delete_file_db(group); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    group_delete_file_db(group) {
        //Verify group
        if(group == "admins") {
            return { "error":"Group 'admins' is reserved by the system" }
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to group
        if(db.groups == undefined) {
            return { "error":"Error querying groups" }
        }else{
            //Set groups defaults
            delete db.groups[group];
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    group_set_authorized(group=null, authorize=null, value=null) {
        //Validate
        if(group == null) {         return {"error":"'group' name is null"}}
        if(authorize == null) {     return {"error":"'authorize' property is null"}}
        if(value == null) {         return {"error":"'authorize' property is null"}}
        
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.group_set_authorized_file_db(group, authorize, value); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    group_set_authorized_file_db(group, authorize, value) {
        //Verify group
        if(group == "admins") {
            return { "error":"Group 'admins' is reserved by the system" }
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to group
        if(db.groups == undefined) {
            return { "error":"Error querying groups" }
        }else{
            if(db.groups[group]["authorize"] == undefined) {
                return { "error":"Error querying group authorize settings" }
            }else{
                db.groups[group]["authorize"][authorize] = value;
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    group_set_user(group=null, username=null, state=null) {
        //Validate
        if(group == null) {    return {"error":"'group' name is null"}}
        if(username == null) { return {"error":"'username' name is null"}}
        if(state == null) {    return {"error":"'State' name is null"}}
        
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.group_set_user_file_db(group, username, state); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    group_set_user_file_db(group, username, state) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Username 'admin' is reserved for system use, cannot be modified";
            return result;
        }

        //Check if user exists
        if(db.users[username] == undefined) {
            return { "error":"User doesn't exist" }
        }

        //Set to group
        if(db.groups == undefined) {
            return { "error":"Error querying groups" }
        }else{
            if(db.groups[group]["member_users"] == undefined) {
                return { "error":"Error querying group authorize settings" }
            }else{
                if(state == true) {
                    db.groups[group]["member_users"].push(username);
                }else if(state == false) {
                    let this_list = db.groups[group]["member_users"];
                    let index = this_list.indexOf(username);
                    if(index > -1) {
                        db.groups[group]["member_users"].splice(index);
                    }
                }else{
                    return { "error":"Invalid State" }
                }
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    //User functions
    get_username() {
        if(this.token_payload.username != undefined) {
            return this.token_payload.username;
        }else{
            return "";
        }
    }

    users_get() {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.users_get_file_db(); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    users_get_file_db() {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Focus DB
        let users_list = {}

        //Get all users (except admin)
        for(let user in db.users) {
            //Create users list
            users_list[user] = {}
            users_list[user]["name"] = db.users[user]["name"];
            users_list[user]["email"] = db.users[user]["email"];
            users_list[user]["account_locked"] = db.users[user]["account_locked"];
            users_list[user]["account_disabled"] = db.users[user]["account_disabled"];
        }

        //Return users list
        return {
            "error":"",
            "data":this.sort_hash_array(users_list)
        }
    }

    user_state_get(username=null) {
        //Validate
        if(username == null) {    return {"error":"'username' name is null"}}
        
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_state_get_file_db(username); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_state_get_file_db(username) {
        //Result
        let result = {
            "error":"",
            "account_locked":true,
            "account_disabled":true
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            result.error = get_file_db.error;
            return result;
        }else{
            db = get_file_db.db;
        }

        //Get user state
        if(db.users[username] == undefined) {
            result.error = "Username not found"
        }else{
            result.account_locked = db.users[username]["account_locked"];
            result.account_disabled = db.users[username]["account_disabled"];
        }

        //Return users list
        return result;
    }

    user_groups_get(username=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_groups_get_file_db(username); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_groups_get_file_db(username) {
        //Result
        let result = {
            "error":"",
            "groups":{}
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            result.error = get_file_db.error;
            return result;
        }else{
            db = get_file_db.db;
        }

        //Get group members
        for(let group in db.groups) {
            let this_group = db.groups[group];
            if(this_group.member_users.indexOf(username) > -1) {
                result.groups[group] = db.groups[group]["authorize"];
            }
        }

        //Return users list
        return result;
    }

    user_add(username=null, password=null, name=null, email=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}
        if(password == null) { return {"error":"'password' is null"}}
        if(name == null) { return {"error":"'name' is null"}}
        if(email == null) { return {"error":"'email' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_add_file_db(username, password, name, email); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_add_file_db(username, password, name, email) {
        //Result
        let result = {
            "error":""
        }

        //Validate fields
        //
        // TBD
        //

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Username 'admin' is reserved for system use";
            return result;
        }

        //Check if user already exists
        if(db.users[username] != undefined) {
            result.error = `Username '${username}' already exists`
        }else{
            let password_hash = this.get_hash_password(password);

            db.users[username] = {
                "name": `${name}`,
                "email": `${email}`,
                "password": `${password_hash}`,
                "auth_tries": 0,
                "auth_tries_time":0,
                "account_locked": false,
                "account_disabled": false
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }

    user_delete(username=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_delete_file_db(username); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_delete_file_db(username) {
        //Result
        let result = {
            "error":""
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Cannot delete username 'admin'";
            return result;
        }

        //Check if user already exists
        if(db.users[username] == undefined) {
            result.error = `Username '${username}' does not exists`
        }else{
            delete db.users[username];
        }

        //Search group members
        let get_groups = this.user_groups_get(username);
        if(get_groups.error != "") {
            result.error = get_groups.error;
            return result;
        }else{
            for(let group in get_groups.groups) {
                let this_list = db.groups[group]["member_users"];
                let index = this_list.indexOf(username);
                if(index > -1) {
                    db.groups[group]["member_users"].splice(index);
                }
            }
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }

    user_unlock(username=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_unlock_file_db(username); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_unlock_file_db(username) {
        //Result
        let result = {
            "error":""
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check if user already exists
        if(db.users[username] == undefined) {
            result.error = `Username '${username}' does not exists`
        }else{
            db.users[username]["auth_tries"] = 0;
            db.users[username]["auth_tries_time"] = 0;
            db.users[username]["account_locked"] = false;
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }

    user_state_set(username=null, state=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}
        if(state == null) { return {"error":"'state' is null"}}

        if(state != true && state != false) {
            return {"error":"State value is invalid"}
        }

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_state_set_file_db(username, state); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_state_set_file_db(username, state) {
        //Result
        let result = {
            "error":""
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Username 'admin' is reserved for system use, cannot be modified";
            return result;
        }

        //Check if user already exists
        if(db.users[username] == undefined) {
            result.error = `Username '${username}' does not exists`
        }else{
            db.users[username]["account_disabled"] = state;
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }

    user_state_details(username=null, name=null, email=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}
        if(name == null) { return {"error":"'name' is null"}}
        if(email == null) { return {"error":"'email' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_state_details_file_db(username, name, email); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_state_details_file_db(username, name, email) {
        //Result
        let result = {
            "error":""
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Username 'admin' is reserved for system use, cannot be modified";
            return result;
        }

        //Check if user already exists
        if(db.users[username] == undefined) {
            result.error = `Username '${username}' does not exists`
        }else{
            db.users[username]["name"] = name;
            db.users[username]["email"] = email;
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }

    user_password_set(username=null, password=null) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}
        if(password == null) { return {"error":"'password' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_password_set_file_db(username, password); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_password_set_file_db(username, password) {
        //Result
        let result = {
            "error":""
        }

        //Validate fields
        //
        // TBD
        //

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check admin user
        if(username == "admin") {
            result.error = "Username 'admin' is reserved for system use, cannot be modified";
            return result;
        }

        //Check if user already exists
        if(db.users[username] == undefined) {
            result.error = `Username '${username}' does not exists`
        }else{
            db.users[username]["password"] = this.get_hash_password(password);
        }

        //Update file_db
        let is_updated = this.update_file_db(db);
        if(is_updated.error != "") {
            result.error = is_updated.error
        }

        //Return users list
        return result;
    }


    //////////////////////////////////////
    // General Use Functions
    //////////////////////////////////////

    //Hash password
    get_hash_password(password) {
        return bcrypt.hashSync((password).toString(), 10)
    }

    //Numeric datestamp
    padTo2Digits(num) {
        return num.toString().padStart(2, "0");
    }
    padTo3Digits(num) {
        return num.toString().padStart(3, "0");
    }
    get_datestamp() {
        let d = new Date();
        let yyyy = d.getFullYear();
        let mo   = padTo2Digits(d.getMonth() + 1);
        let dd   = padTo2Digits(d.getDate());
        let hh   = padTo2Digits(d.getHours());
        let mm   = padTo2Digits(d.getMinutes());
        let ss   = padTo2Digits(d.getSeconds());
        let ms   = padTo3Digits(d.getMilliseconds());
        let this_datestamp = yyyy + mo  + dd  + "." + hh  + mm  + ss + "." + ms;
        return this_datestamp;
    }

    //Convert to seconds
    convert_seconds(str) {
        //If number only, return number
        if(isNaN(str) == false) {
            return str;
        }

        //Check format - e.g. '30m' as 30 minutes
        let last_chr = str.substr(str.length - 1);
        str = (str.substr(0, (str.length - 1)) * 1);

        //Check for valid number, not valid return default 5 minutes
        if(isNaN(str) == true) {
            return 300;
        }else{
            //Return value
            let value = 300;

            //Calc seconds based on last_chr
            switch(last_chr) {
                case "m":
                    value = (str * 60);
                break;
                case "h":
                    value = (str * 60 * 60);
                break;
                case "d":
                    value = (str * 60 * 60 * 24);
                break;
            }

            //Return value
            return value;
        }
    }

    //Sort hash table
    sort_hash_array(input) {
        var result = {};
        var keys = Object.keys(input);
        keys = keys.sort()
        for(let k in keys) {
            let this_key = keys[k];
            result[this_key] = input[this_key];
        }
        return result;
    }

    //////////////////////////////////////
    // Admin Functions
    //////////////////////////////////////

    //Get policies
    get_token_algorithm() {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.get_token_algorithm_file_db()
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    get_token_algorithm_file_db() {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.token_algorithm == undefined) {
            return { "error":"Error querying token parameters" }
        }else{
            return { 
                "error":"", 
                "algorithm":db.token_algorithm
            }
        }
    }

    get_policy(property) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.get_policy_file_db(property)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }    
    }
    get_policy_file_db(property) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Set to user_token
        if(db.default_policy[property] == undefined) {
            return { "error":"Error querying policy" }
        }else{
            return { 
                "error":"", 
                "policy":db.default_policy[property]
            }
        }
    }

    //////////////////////////////////////
    // User Functions
    //////////////////////////////////////

    //User and password validate
    user_login(username, password) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.user_login_file_db(username, password)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_login_file_db(username, password) {
        //Return
        let result = {
            "error":"",
            "state":"",
            "login_time":Math.round(new Date().getTime() / 1000),
            "username":username,
            "name":"",
            "email":""
        }

        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            result.error = get_file_db.error;
            return result;
        }else{
            db = get_file_db.db;
        }

        //DB update flag
        let update_db = false;

        //Validate DB fields
        if(db.users[username] == undefined) { 
            result.error = "Invalid Username";
            result.state = "invalid_user";
            return result;
        }
        if(db.users[username]["name"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["email"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["password"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["auth_tries"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["auth_tries_time"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["account_locked"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }
        if(db.users[username]["account_disabled"] == undefined) { 
            result.error = "User configuration missing";
            result.state = "invalid_user_config";
            return result;
        }

        //Check account disabled
        if(db.users[username]["account_disabled"] == true) {
            result.state = "disabled";
            return result;
        }

        //Locked account check (unlock after timeout expires)
        if(db.users[username]["account_locked"] == true) {
            //Check this time exceeds auth_tries_time
            if(result.login_time > db.users[username]["auth_tries_time"]) {
                update_db = true;
                db.users[username]["account_locked"] = false;
                db.users[username]["auth_tries"] = 0;
                db.users[username]["auth_tries_time"] = 0;
            }else{
                result.state = "locked";
                return result;
            }
        }

        //Check password attempts tries (reset timer)
        if(db.users[username]["auth_tries"] > 0) {
            if(result.login_time > db.users[username]["auth_tries_time"]) {
                update_db = true;
                db.users[username]["auth_tries"] = 0;
                db.users[username]["auth_tries_time"] = 0;
            }
        }

        //Verify user password
        let pwd_compare = bcrypt.compareSync(password,db.users[username]["password"])
        if(pwd_compare == true) {
            //Set results
            result.name = db.users[username]["name"];
            result.email = db.users[username]["email"];

            //Check fail counters
            if(db.users[username]["auth_tries_time"] != 0) {
                update_db = true;
                db.users[username]["auth_tries"] = 0;
                db.users[username]["auth_tries_time"] = 0;
            }
        }else{
            //Set state
            result.state = "failed";

            //Set vars
            let get_policy = null;
            let password_retries = 3;                                   // default value
            let account_lockout_time = this.convert_seconds("30m");     // default value
            update_db = true;

            //Get policies
            get_policy = this.get_policy("password_retries");
            if(get_policy.error == "") {
                password_retries = this.convert_seconds(get_policy.policy);
            }
            get_policy = this.get_policy("account_lockout_time");
            if(get_policy.error == "") {
                account_lockout_time = this.convert_seconds(get_policy.policy);
            }

            //Check retries
            db.users[username]["auth_tries"] = db.users[username]["auth_tries"] + 1;
            db.users[username]["auth_tries_time"] = result.login_time + account_lockout_time;            
            if(db.users[username]["auth_tries"] >= password_retries) {
                //Set state
                db.users[username]["account_locked"] = true;
            }
        }

        //Update database for user tries
        if(update_db == true) {
            //Update database 
            let is_updated = this.update_file_db(db);
            if(is_updated.error != "") {
                result.error = is_updated.error
            }
        }

        //Check state
        if(result.state == "") {
            result.state = "success";
        }

        //Return user settings
        return result;
    }

    //Token validate
    validate_session_username(username) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.validate_session_username_file_db(username)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    validate_session_username_file_db(username) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            result.error = get_file_db.error;
            return result;
        }else{
            db = get_file_db.db;
        }

        //Get user state
        if(db.users[username] == undefined) {
            return false;
        }else{
            if(db.users[username]["account_disabled"] == true) {
                return false;
            }
        }

        //Return user OK
        return true;
    }

    //User group membership
    user_permission(username) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.user_permission_file_db(username)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_permission_file_db(username) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Get authorized parameters for user
        let user_groups = [];
        let user_authorized = {};

        //Loop through groups and authorized access
        for(let group in db.groups) {
            let this_group = db.groups[group];
            if(this_group.member_users.indexOf(username) != -1) {
                //Add group to list
                user_groups.push(group);

                //Loop authorized
                for(let authorize in this_group.authorize) {
                    //Get true or false permission
                    let permission = this_group.authorize[authorize];

                    //Add or update permission
                    if(user_authorized[authorize] == undefined) {
                        user_authorized[authorize] = permission;
                    }else{
                        //Override false authorized with true
                        if(permission == true) {
                            user_authorized[authorize] = permission;
                        }
                    }
                }
            }
        }

        //Return values
        return {
            "error":"",
            "groups":user_groups,
            "authorized":user_authorized
        }
    }

    //User set password
    user_set_password(username, password) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.user_set_password_file_db(username, password)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_set_password_file_db(username, password) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            return {"error":get_file_db.error}
        }else{
            db = get_file_db.db;
        }

        //Check username
        if(db.users[username] == undefined) {
            return {"error":"User not found to update password"}
        }else{
            if(db.users[username]["password"] == undefined) {
                return {"error":"User password field is not defined, system error"}
            }else{
                //Generate new password hash
                db.users[username]["password"] = bcrypt.hashSync(password, 10);

                //Update file DB
                let is_updated = this.update_file_db(db);
                if(is_updated.error != "") {
                    return {"error":is_updated.error}
                }else{
                    return {"error":""}
                }
            }
        }
    }

    //User password reset
    user_reset_password(password_old=null, password_new=null) {
        //Validate parameters
        if(password_old == null) { return {"error":"Missing user password"}}
        if(password_new == null) { return {"error":"Missing user new password"}}

        //Validate user session
        let auth_validate = this.auth_validate();
        if(auth_validate.error != "") {
            return {"error":auth_validate.error}
        }else{
            if(auth_validate.state != "OK" && auth_validate.state != "refresh") {
                return {
                    "error":"",
                    "state":auth_validate.state
                }
            }
        }

        //Get token
        let payload = this.token_payload;

        //Get username
        let username = null;
        if(payload.username == undefined) {
            return {"error":"Unable to confirm username"}
        }else{
            username = payload.username;
        }

        //Validate username and password
        let user_validate = this.user_reset_password_test(username, password_old);
        if(user_validate.error != "") {
            return {"error":user_validate.error}
        }

        //Update the user password
        let update_password = this.user_set_password(username, password_new);
        if(update_password.error != "") {
            return {"error":update_password.error}
        }else{
            return {"error":""}
        }
    }
    user_reset_password_test(username, password) {
        //Validate
        if(username == null) { return {"error":"'username' is null"}}
        if(password == null) { return {"error":"'password' is null"}}

        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":    return this.user_reset_password_test_file_db(username, password); break;
            case "redis":   return { "error":`REDIS store type under construction`};  break;
            case "mysql":   return { "error":`MySQL store type under construction`};   break;
            default:        return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    user_reset_password_test_file_db(username, password) {
        //Load session DB
        let db = {}
        let get_file_db = this.load_file_db();
        if(get_file_db.error != "") {
            result.error = get_file_db.error;
            return result;
        }else{
            db = get_file_db.db;
        }

        //Check username
        if(db.users[username] == undefined) {
            return {"error":"Username does not exist"}
        }
    
        //Verify user password
        let pwd_compare = bcrypt.compareSync(password,db.users[username]["password"])
        if(pwd_compare == false) {
            return {"error":"Current password is incorrect"}
        }else{
            return {"error":""}
        }
    }

    //////////////////////////////////////
    // Session Management
    //////////////////////////////////////

    generate_secret() {
        return crypto.randomBytes(256).toString("base64");
    }    

    //Session management
    set_user_session(secret, token) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.set_user_session_file_db(secret, token)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    set_user_session_file_db(secret, token) {
        //Load session DB
        let sessions = {}
        let get_sessions = this.load_sessions_db();
        if(get_sessions.error != "") {
            return {"error":get_sessions.error}
        }else{
            sessions = get_sessions.db;
        }

        //Set to user_token
        if(sessions.user_token == undefined) {
            return {"error":"Error saving token"}
        }else{
            //Add token to database
            sessions.user_token[token] = {
                "secret": secret,
                "user_agent": this.user_agent,
                "user_ip": this.user_ip
            }

            //Update file DB
            let is_updated = this.update_sessions_db(sessions);
            if(is_updated.error != "") {
                return {"error":is_updated.error}
            }else{
                return {"error":""}
            }
        }
    }

    get_user_session(token) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.get_user_session_file_db(token)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    get_user_session_file_db(token) {
        //Load session DB
        let sessions = {}
        let get_sessions = this.load_sessions_db();
        if(get_sessions.error != "") {
            return {"error":get_sessions.error}
        }else{
            sessions = get_sessions.db;
        }

        //Set to user_token
        if(sessions.user_token == undefined) {
            return { "error":"Error querying token" }
        }else{
            //Add token to database
            if(sessions.user_token[token] == undefined) {
                return { 
                    "error":"",
                    "token": false,
                    "secret": "",
                    "user_agent": "",
                    "user_ip": ""
                }
            }else{
                return { 
                    "error":"",
                    "token": true,
                    "secret": sessions.user_token[token]["secret"],
                    "user_agent": sessions.user_token[token]["user_agent"],
                    "user_ip": sessions.user_token[token]["user_ip"]
                }
            }
        }
    }

    del_user_session(token) {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.del_user_session_file_db(token)
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    del_user_session_file_db(token) {
        //Load session DB
        let sessions = {}
        let get_sessions = this.load_sessions_db();
        if(get_sessions.error != "") {
            return {"error":get_sessions.error}
        }else{
            sessions = get_sessions.db;
        }

        //Delete user token
        if(sessions["user_token"][token] != undefined) {
            delete sessions["user_token"][token];
        }else{
            return {"error":"Token not found"}
        }
        
        //Update file_db
        let is_updated = this.update_sessions_db(sessions);
        if(is_updated.error != "") {
            return {"error":is_updated.error}
        }else{
            return {"error":""}
        }
    }

    clear_old_sessions() {
        //Check conf setting
        let this_type = this.conf.store.type;
        switch(this_type) {
            case "file":
                return this.clear_old_sessions_file_db()
            break;
            case "redis":
                return { "error":`REDIS store type under construction`}
            break;
            case "mysql":
                return { "error":`MySQL store type under construction`}
            break;
            default:
                return { "error":`Configuration store type invalid[${this.conf.type}]`}
        }
    }
    clear_old_sessions_file_db() {
        //Load session DB
        let sessions = {}
        let get_sessions = this.load_sessions_db();
        if(get_sessions.error != "") {
            return {"error":get_sessions.error}
        }else{
            sessions = get_sessions.db;
        }

        //Clear sessions
        if(sessions.user_token != undefined) {
            //Get current time
            let this_time = Math.round(new Date().getTime() / 1000);
            let db_update = false;

            //Check sessions
            for(let token in sessions.user_token) {
                //Parse token
                let parse_token = token.split(".");
                if(parse_token[1] != undefined) {
                    try{
                        //Get expire time
                        let payload = JSON.parse(atob(parse_token[1]));
                        let exp_time = payload.exp;
                        let time_diff = exp_time - this_time;

                        if(time_diff < 0) {
                            delete sessions.user_token[token];
                            db_update = true;
                        }
                    }catch(error){
                        console.log(error)
                    }
                }
            }

            //Write updates to file DB
            if(db_update == true) {
                this.update_sessions_db(sessions);
            }
        }
    }

    //////////////////////////////////////
    // Authentication / Authorize Functions
    //////////////////////////////////////

    auth_check() {
        //Clear old sessions (File DB only)
        this.clear_old_sessions();

        //Define response
        let auth = {
            "error":"",
            "mode":"auth",
            "state":"",
            "authenticated":false,
            "username":"",
            "name":"",
            "email":""
        }

        //Determine auth setting
        if(this.auth_mode != undefined) {
            auth.mode = this.auth_mode;
            if(this.auth_mode == "none") {
                //Auth disabled
                return auth;
            }
        }

        //Validate existing token
        if(this.token == "") {
            auth.authenticated = false;
            return auth;
        }else{
            let validate = this.auth_validate();

            //Get valid states
            if(validate.error != "") { auth.error = validate.error }
            auth.state = validate.state;
            auth.authenticated = validate.authenticated;

            //Return unauthenticated
            if(validate.authenticated == false) {
                return auth;
            }
        }

        //Get user details
        if(this.token_payload.username != undefined) {  
            auth.username = this.token_payload.username; 
        }
        if(this.token_payload.name != undefined) {  
            auth.name = this.token_payload.name; 
        }
        if(this.token_payload.email != undefined) {  
            auth.email = this.token_payload.email; 
        }

        //Return setting (auth mode = 'auth' or 'none', cookie key name)
        return auth;
    }
    auth_user(username=null, password=null) {
        //Result
        let result = {
            "error":"",
            "state":"unauthenticated",
            "cookie":"",
            "authenticated":false,
            "username":username,
            "name":"",
            "email":""
        }

        //Verify parameters 
        if(username == "" || username == null) {
            result.error = "Missing Username";
            return result;
        }
        if(password == "" || password == null) {
            result.error = "Password cannot be blank";
            return result;
        }

        //Get token parameters
        let algorithm = { "algorithm": "HS256" }
        let token_algorithm = this.get_token_algorithm();
        if(token_algorithm.error == "") {
            algorithm = token_algorithm.algorithm;
        }

        //Define base token parameters
        let secret = this.generate_secret();

        //Auth username and password
        let payload = {}
        let valid_user = this.user_login(username, password);
        if(valid_user.error != "") {
            result.error = valid_user.error;
            return result;
        }else{
            //Check state
            if(valid_user.state != "success") {
                result.state = valid_user.state;
                return result;
            }else{
                //Set state
                result.state = valid_user.state;

                //Set user settings to payload
                payload = {
                    "username":valid_user.username,
                    "name":valid_user.name,
                    "email":valid_user.email
                }
            }
        }

        //Sign token
        let token = jwt.sign(payload, secret, algorithm);

        //Get cookie name policy
        let get_policy = this.get_policy("token_cookie_name");
        if(get_policy.error != "") {
            result.error = get_policy.error;
            return result;
        }else{
            result.cookie = `${get_policy.policy}=${token}`
        }

        // Write to session DB
        let token_saved = this.set_user_session(secret, token)
        if(token_saved.error != "") {
            result.error = token_saved.error;
            return result;
        }else{
            //Set final authenticated
            result.authenticated = true;
            result.username = username;
            result.name = valid_user.name;
            result.email = valid_user.email;
        }

        //Return token
        return result;
    }
    auth_validate() {
        //Default
        let token = this.token;

        //Result
        let result = {
            "error":"",
            "state":"expired",
            "authenticated":false,
        }

        //Check no token
        if(token == "") {
            return result;
        }else{
            //Check username in token
            let username = this.get_username();
            if(username == "") {
                result.error = "Error processing token";
                result.state = "error";
                return result;
            }else{
                let get_user_state = this.user_state_get(username);
                if(get_user_state.error != "") {
                    result.error = get_user_state.error;
                    result.state = "error";
                    return result;
                }else{
                    if(get_user_state.account_locked == true || get_user_state.account_disabled == true) {
                        //Delete token on disabled user
                        this.del_user_session(token);

                        //Set state
                        if(get_user_state.account_locked == true) {
                            result.state = "locked";
                        }
                        if(get_user_state.account_disabled == true) {
                            result.state = "disabled";
                        }
                        return result;
                    }
                }
            }
        }

        //Check user token from original user identifiers
        let get_session_token = this.get_user_session(token);
        let secret = null;
        if(get_session_token.error != "") {
            result.error = get_session_token.error;
            result.state = "error";
            return result;
        }else{
            if(get_session_token.token == false) {
                //No token found
                return result;
            }else{
                //Check default
                let session_reset = false;

                //Check user_agent for different browser string
                if(this.user_agent != get_session_token.user_agent) {
                    session_reset = true;
                }
                if(this.user_ip != get_session_token.user_ip) {
                    session_reset = true;
                }
                if(session_reset == true) {
                    //Reset token -- potentially exposed and sent from another browser
                    this.del_user_session(token);

                    //Return reset
                    result.state = "invalid";
                    return result;
                }

                //Get secret
                secret = get_session_token.secret;
            }
        }

        //Check user token still valid
        let payload = {}
        try{
            payload = jwt.verify(token, secret);
        }catch(error){
            //Remove expired token
            this.del_user_session(token);

            //Return reset token
            result.state = "expired";
            return result;
        }

        //Calculate expire time different
        let this_time = Math.round(new Date().getTime() / 1000);
        let exp_time = this.token_payload.exp;
        let time_diff = exp_time - this_time;

        //Get policy
        let refresh_threshold = 300;
        let get_policy = this.get_policy("token_refresh_threshold");
        if(get_policy.error == "") {
            refresh_threshold = this.convert_seconds(get_policy.policy);
        }

        //Determine notice to refresh
        if(time_diff > refresh_threshold) {
            result.state = "OK";
            result.authenticated = true;
        }else{
            result.state = "refresh";
            result.authenticated = true;
        }

        //Return verification
        return result;
    }
    auth_refresh() {
        //Response
        let result = {
            "error":"",
            "state":"unauthenticated",
            "authenticated":false,
            "cookie":null
        }

        //Validate the token
        let validate_token = this.auth_validate();
        if(validate_token.error != "") {
            return validate_token;
        }else{
            if(validate_token.state == "OK") {
                //Token OK states should not land on refresh, send back
                result.state = validate_token.state;
                result.authenticated = validate_token.authenticated;
                return result;
            }else if(validate_token.state != "refresh") {
                //Token is not able to refresh, send back
                result.state = validate_token.state;
                result.authenticated = validate_token.authenticated;
                return result;
            }
        }

        //Get token
        let old_token = this.token;
        let payload = this.token_payload;

        //Remove token to be refreshed
        let del_token = this.del_user_session(old_token);
        if(del_token.error != "") {
            result.error = "Error refreshing token";
            return result;
        }

        //Get token parameters
        let algorithm = { "algorithm": "HS256" }
        let token_algorithm = this.get_token_algorithm();
        if(token_algorithm.error == "") {
            algorithm = token_algorithm.algorithm;
        }

        //Remove expire from payload
        delete payload["iat"];
        delete payload["exp"];

        //Get secret
        let secret = this.generate_secret();

        //Generate new token
        let token = jwt.sign(payload, secret, algorithm);

        //Get cookie name policy
        let get_policy = this.get_policy("token_cookie_name");
        if(get_policy.error != "") {
            result.error = get_policy.error;
            return result;
        }else{
            result.cookie = `${get_policy.policy}=${token}`
        }

        // Write to session DB
        let token_saved = this.set_user_session(secret, token)
        if(token_saved.error != "") {
            result.error = token_saved.error;
            return result;
        }else{
            //Set final authenticated
            result.state = "OK";
            result.authenticated = true;
        }

        //Return token
        return result;
    }
    auth_logoff() {
        //Result
        let result = {
            "error":"",
            "state":"",
            "cookie":"",
            "authenticated":false
        }
        
        //Remove expired token
        this.del_user_session(this.token);

        //Get cookie name policy
        let get_policy = this.get_policy("token_cookie_name");
        if(get_policy.error != "") {
            result.error = get_policy.error;
            return result;
        }else{
            result.cookie = `${get_policy.policy}=${this.token}`
        }

        //Return reset token
        return result;
    }

    api_authorize_user() {
        //
        // Authorized paramaters should not be returned to browser. To be used by API for user authorization.
        //

        //Authorized parameters
        let authorized = {
            "error":"",
            "auth":"auth",
            "state":"",
            "authenticated":false,
            "groups":[],
            "authorized":{}
        }

        //Check auth mode ('none' or 'auth')
        let auth_init = this.auth_init();
        if(auth_init.error != "") {
            authorized.error = auth_init.error;
            return authorized;
        }else{
            //Capture auth mode
            authorized.auth = auth_init.auth;

            //Check auth mode 'none' -- no authorization
            if(auth_init.auth == "none") {
                authorized.state = "OK";
                authorized.authenticated = true;
                return authorized;
            }
        }

        //Auth mode = 'auth'
        //Validate user session authenticated
        let validate_session = this.auth_validate();
        if(validate_session.error != "") {
            authorized.error = validate_session.error;
            return authorized;
        }else{
            if(validate_session.state == undefined) {
                authorized.error = "Auth validate failed";
                return authorized;
            }else{
                authorized.state = validate_session.state;
                if(validate_session.state == "OK") {
                    authorized.authenticated = true;
                }else{
                    return authorized;
                }
            }
        }

        //Check user token refresh
        //Extract payload
        let payload = this.token_payload;

        //Calculate expire time different
        let this_time = Math.round(new Date().getTime() / 1000);
        let exp_time = payload.exp;
        let time_diff = exp_time - this_time;

        //Get policy
        let refresh_threshold = 300;
        let get_policy = this.get_policy("token_refresh_threshold");
        if(get_policy.error == "") {
            refresh_threshold = this.convert_seconds(get_policy.policy);
        }

        //Refresh token
        if(time_diff < refresh_threshold) {
            authorized.state = "refresh";
        }

        //Get user permissions
        let user_permission = this.user_permission(payload.username);
        if(user_permission.error != "") {
            authorized.error = user_permission.error;
            return authorized;
        }else{
            authorized.groups       = user_permission.groups;
            authorized.authorized   = user_permission.authorized;
        }

        //Return API authorize response
        return authorized;
    }
    api_authorize_server() {
        //Future state server auth
    }
}

//Export modules
export default jwt_auth;