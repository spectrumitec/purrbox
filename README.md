<b>Node JS Wonderbox</b>

<br />
<p>Note to users: This is a new project in development awaiting future features and dedicated website for helping users get started. There is minimum content available for information at the current time.</p>
<br />

<b>About:</b><br />
<p>Wonderbox objective is to provide an easy way for setting up static sites or applications where users do not want to use a framework such as react or angular. It is designed to support running multiple site projects under a single IP addres and port. Components include a web server engine and a web based Dev UI for management of your project settings. The system is built to support running multiple environments such as a Dev, QA, Stage and Prod via a server configuration setting. Web projects are configured for portability between environments to allow for promoting code from Dev to other environments with minimumal intervention. A template system is built into the management UI allowing users to create their own code templates for projects or packaging fully functional applications.</p>

<b>General Features:</b><br />
<ul>
    <li>Simplified installation and setup</li>
    <li>Support running on Linux, Windows, Mac and containers</li>
    <li>Leverages Node JS clustering module (atuo-restart server process and leverage multiple CPUs)</li>
    <li>Serve multiple sites from a single IP without needing a proxy service</li>
    <li>Support for SSL and SSL redirection per project site</li>
    <li>Automatic self refesh of project configuration and site mapping</li>
    <li>Configurable option to unload cache content as you develop (server restart and monitoring modules not required)</li>
    <li>Configurable mapping for static content or server side execution</li>
    <li>Website source version cloning and preview ability (when working with code branches and feature changes)</li>
    <li>DNS resolution mapping (FQDN resolution to server IP can be mapped easily to site code)</li>
    <li>Server environment passthrough to code for use with dynamic configuration of database in your own code for use with promotion between environments</li>
    <li>Optional default system site template or helper files from file management</li>
    <li>Ability for templating your starter code for new projects or fully functional sites for distribution</li>
</ul>

<b>Installation:</b><br />
<p>1. Prepare your environment and install Node JS v18.x or higher, git commands, etc.</p>
<p>2. Create a directory where you will run the server</p>
<p>3. Use git to clone the project source files</p>
<pre>
    cd /path/to/server
    git clone https://github.com/cjs500/wonderbox.git
</pre>
<p>4. Install node modules required to support this server</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken 
</pre>
<p>5. Start Node JS Wonderbox</p>
<pre>
    node start_server
</pre>
<p>6. Open a web browser and connect to the server IP address to test connectivity (or localhost if running on your local system). The defualt login is 'admin' and password 'admin'</p>

<b>Server Configuration:</b><br />
<p>There is a single configuration file located in the root directory for server specific functions. Changes to the configuration settings requires a server restart. The following is an example 'server_conf.json' for settings available. For accessing the management UI under a different name (not just IP or localhost), you can add hostnames separated by commas to the 'server_dev_ui' array.</p>
<pre>
    {
        "hostname":"nodejs-dev",
        "workers":1,
        "cache_on":false,
        "debug_mode_on":false,
        "server_mode":"dev",
        "server_dev_ui":[
            "nodejs-dev",
            "nodejs-dev.network.local"
        ],
        "environment":"dev",
        "http_on":true,
        "http_port":80,
        "https_on":true,
        "https_port":443,
        "ssl_key":"key.pem",
        "ssl_cert":"cert.pem",
        "auto_refresh_on":true,
        "auto_refresh_timer":5000
    }
</pre>
<p>When you login to the Dev Management UI, there is a 'Server Settings' panel under 'Admin' tab that has some basic explaination for the uses of each setting. </p>

<b>Current Limitations:</b><br />
<ul>
    <li>SSL certificates cannot be assinged individually to each site. A server hosting multiple sites will require a SAN or wildcard certificate.</li>
    <li>Cannot use newer import syntax as the site content is executed from further in the server application. Will need to use require statement for module imports.</li>
    <li>Logging has not yet been completed, planned for future versions.</li>
    <li>JWT auth for Dev management UI will have MySQL/MariaDB in future versions, currently limited to local file configurations.</li>
</ul>

<b>Quick Start Guide:</b><br />
<p>To begin with a simple project, and let's not call it 'Hello World!'. You can start with logging in to the Dev Management UI at 'https://your_ip_addres' or 'https://localhost', if you have not already setup the server configuration above with 'server_dev_ui' settings. On the main 'Projects' tab, there are four button on the left pane at the top. The 'box' icon allows you to create a new project. Supply a project 'Name' and 'Description' (optional) to create a base configuration. A new project should appear in the left pane.</p>
<p>Select your project and you will see the project tree is broken into a few sections:</p>
<ul>
    <li><b>The root of the project</b> - This is where there are some basic settings for changing description or enable / diable for DNS resolution settings. Here you can also preview your site creations under a special VHost path on the Dev Management UI. Note: the Dev UI and previous is only available when the server is in Dev mode. Setting the server to Prod mode will disable the Dev Management UI.</li>
    <li><b>Sites and Settings</b> - This is where you create a website under your project. All sites will appear under this tree selector when created. There are three general options here where you can create a blank empty web source folder, a system default starter site, and user defined templates (for a later time if you have created any to use). Blank site selection is for customized builds where needing to create a specific folder structure to your project. See below for website panel settings.</li>
    <li><b>Project Files</b> - This is more of a helper panel for some basic folder strucutre and file creation. The Dev Management UI has some basic file templates for creating HTML, CSS or API files.</li>
    <li><b>DNS Resolution</b> - This is when you either have a DNS server / local host file resolve an FQDN to the IP address of your server or if your server(s) are behind a load balancer. DNS resolution uses the server environment configuration and FQDN name in your project to reslove to a select site version or branch. If you have a Dev, QA, Stage and Prod server environment as an example, copying or using git to clone your source code between environment will leverage this in ech environment. From your Dev server you can specify what DNS FQDN is used for Dev and other environments. When cloned to a different environment, the server will resolve as required. This can allow for code promotion with minimum intervention to change settings.</li>
</ul>
<p>Website settings under your project's 'Sites and Settings' tree view, provides configurations you would use for how your code is executed. These are broken into the following:</p>
<ul>
    <li><b>General Settings</b> - Your site's static content will usually have a default document or potentially need to ensure your site is secured. These settings allow you to define the default document, a maintenance splash page, SSL redirection and ability to toggle your site default doc to a maintenance page. Maintenance page doesn't disable all the sub paths of a site. If needing to disable the entire site, optionally you can create a maintenance site and update the DNS resolution to point to maintenance istead.</li>
    <li><b>Error Page Default Documents</b> - These allow you to specify a custom 404 or 500 error pages otherwise the server default will be used</li>
    <li><b>API Fixed File Mapping</b> - Allows for a sub path mapping to resolve to a single API file. Fix mapping will resolve all paths under the defined sub path to the API file chosen. API mapping is strictly server side execution and will not send source code to the client browser. (Do not map to an API file off the root path)</li>
    <li><b>API Synamic Path Mapping</b> - Allows for a sub path to be mapped for any API file that falls under this defined sub path. You may have all APIs at a root path or API files under several sub folders. The server will map the URL path accordingly. API mappings is strictly server side execution and will not send source code to the client browser. (Do not map to the root path as the root path is reserved for static content)</li>
    <li><b>Static Content Path Mapping</b> - This will cover any static content like HTML, client side JavaScript, CSS, images, etc. You do not need to have API mappings outside of the root location if you choose not to. The server will map server side API execution before static content.</li>
    <li><b>Static Content Server Execute Override</b> - In some cases you may require a file at the root path to execute at the server and not be sent to client like static content. This allows to specify those file paths as an override. An example of this is a health check script used for a load balancer that might check modules, database connectivity, etc. and send the load balancer a 500 error or other code to let it know this web server has a problem.</li>
</ul>
<p>For any server side API files, see the 'Project Files' tree and create a new file in your API folder, then select the API type which will drop in a standard template (helper file) that is ready for developing your server side code.</p>

<b>The Manual Side of Things:</b>
<p>From a manual perspective, the server root has a general layout as the following:</p>
<pre>
    root folder
     &#8735; node_modules
     &#8735; server
         &#8735; class
         &#8735; conf
         &#8735; default_errors
         &#8735; default_file_types
         &#8735; default_new_site
         &#8735; localhost
         &#8735; ssl_certs
     &#8735; web_source
         &#8735; your_project
             &#8735; website_folder
             &#8735; config.json
     &#8735; web_templates
     &#8735; server_conf.json
     &#8735; server_start.js
</pre>
