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

//////////////////////////////////////
// API functions
//////////////////////////////////////

//Get configs
function get_helpdocs_index() {
    log("get_helpdocs_index")
    
    //Set URL
    let url = "api/ui_manage";
    let json = {
        "action":"helpdocs_index"
    }

    //Set call parameters
    let params = {
        "id":"helpdocs_index",
        "func_call":ui_helpdocs_index,
        "method":"GET",
        "url":url,
        "query":json
    }

    //Execute call
    web_calls(params)
}

//////////////////////////////////////
// UI Functions
//////////////////////////////////////

function ui_helpdocs_page() {
    log("ui_helpdocs_page");

    //Build helpdocs page
    let html = `
        <div class="helpdocs_index_title">
            Help Document Index
        </div>
        <div class="helpdocs_index">
            <div id="helpdocs_jstree"></div>
        </div>
        <iframe id="helpdocs_iframe" class="helpdocs_iframe" src="help/documents/Introduction.html" onload="ui_helpdocs_page_css(this);"></iframe>
    `;

    //Update page HTML
    $("#help").html(html);

    //Get index
    get_helpdocs_index();
}
function ui_helpdocs_page_css(iframe) {
    //Set iframe document
    let iframe_doc = iframe.contentDocument || iframe.contentWindow.document;

    //Get header
    let head = iframe_doc.getElementsByTagName('head')[0];

    //Set iframe document link
    let link = iframe_doc.createElement('link');
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "/help/css/help.css";

    //Append head
    head.appendChild(link);
}
function ui_helpdocs_index(data) {
    log("ui_helpdocs_index")

    //Get directory format
    let jstree_dir = ui_helpdocs_index_dir(data);
    jstree_dir = ui_helpdocs_index_reorder(jstree_dir);

    //Expand first node
    if(jstree_dir[0] != undefined) {
        jstree_dir[0].state.opened = true;
    }

    //Build tree array
    jstree_dir = { "core":{ 
        "data": jstree_dir
    }};

    //Insert the tree
    $("#helpdocs_jstree").jstree(jstree_dir);

    //Set listeners
    $("#helpdocs_jstree").on("select_node.jstree", function (e, data) {
        log(`helpdocs_jstree :: Select: ${data.node.id}`);

        //Select help file
        if(data.node.original.type == "file") {
            let doc_path = `help/documents${data.node.original.map_path}`;
            $('#helpdocs_iframe').attr('src', doc_path);
        }
        if(data.node.original.type == "dir") {
            $("#helpdocs_jstree").jstree("open_node", data.node.id);
        }
    });
}
function ui_helpdocs_index_dir(dir) {
    //Loop directory and define icons
    for(let i in dir) {
        //Define icons
        if(dir[i].type == "file") {
            //Set icon
            switch(dir[i].ext) {
                case ".html":   dir[i]["icon"] = `images/file_html_icon.png`; break;
                case ".js":     dir[i]["icon"] = `images/file_js_icon.png`; break;
                case ".css":    dir[i]["icon"] = `images/file_json_css_icons.png`; break;
                case ".json":   dir[i]["icon"] = `images/file_json_css_icons.png`; break;
                case ".txt":    dir[i]["icon"] = `images/file_txt_icon.png`; break;
                default:        dir[i]["icon"] = `images/file_icon.png`; break;
            }
        }else{
            //Set icon
            dir[i]["icon"] = `images/closed_folder_icon.png`;
        }

        //Define state for item
        dir[i]["state"] = {
            "opened":false,
            "disabled":false,
            "selected":false
        }

        //Set text
        dir[i]["text"] = (dir[i]["name"]).replaceAll(".html", "");
        dir[i]["text"] = (dir[i]["text"]).replaceAll("_", " ");
        dir[i]["text"] = (dir[i]["text"]).replaceAll("-", ".");

        //Run against sub tree
        if(dir[i].children.length > 0) {
            ui_helpdocs_index_dir(dir[i].children);
        }
    }

    //Return dir
    return dir;
}
function ui_helpdocs_index_reorder(dir) {
    //Build new dir structure
    let new_children = []

    //Loop through top level for Intro file
    for(let child in dir[0].children) {
        //Get HTML document as top level (Introduction File)
        let target = dir[0].children[child]
        if(target.type == "file") {
            target["state"]["selected"] = true;
            new_children.push(target);
        }
    }

    //Loop through top level for dir
    for(let child in dir[0].children) {
        //Get HTML document as top level (Introduction File)
        let target = dir[0].children[child]
        if(target.type == "dir") {
            new_children.push(target);
        }
    }

    //Replace top level children
    dir[0].children = new_children;

    //Return dir
    return dir;
}