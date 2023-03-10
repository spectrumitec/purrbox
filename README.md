<b>Node JS Wonderbox</b>

<br />
<p>Note to users: This is a new project in development awaiting future features and dedicated website for helping users get started. There is minimum content available for information at the current time.</p>
<br />

<b>About:</b><br />
<p>Wonderbox objective is to provide an easy way for setting up static sites or applications where users do not want to use a framework such as react or angular, or write code to start a web services. It is designed to support running multiple site projects under a single IP addres and port. Components include a web server engine and a web based Dev UI for management of your project settings. The system is built to support running multiple environments such as a Dev, QA, Stage and Prod via the server configuration settings. Web projects are configured for portability between environments to allow for promoting code from Dev to other environments with minimumal intervention. A template system is built into the management UI allowing users to create their own code templates for projects or packaging fully functional applications.</p>

<b>General Features:</b><br />
<ul>
    <li>Simplified installation and setup</li>
    <li>Support running on Linux, Windows, Mac and containers</li>
    <li>Leverages Node JS clustering module (atuo-restart server process and leverage multiple CPUs)</li>
    <li>Serve multiple sites from a single IP without the need for managing an additional proxy service like NGINX</li>
    <li>Support for SSL and SSL redirection per project website</li>
    <li>Automatic self refesh of project configuration and site mapping</li>
    <li>Configurable option to unload cache content as you develop (server restart and monitoring modules not required)</li>
    <li>Configurable mapping for static content or server side execution</li>
    <li>Website source version cloning and preview ability (when working with code branches and feature changes)</li>
    <li>DNS resolution mapping (FQDN resolution to server IP can be mapped easily to site code)</li>
    <li>Server pre-processing of client and server details, headers, environment setting, query parsing, etc. and available for server side execute</li>
    <li>Optional default system site template or helper files from file management</li>
    <li>Ability for templating your starter code for new projects or fully functional sites for distribution</li>
</ul>

<b>Installation:</b><br />
<p>1. Prepare your environment and install Node JS v18.x or higher and git if required</p>
<p>2. Create a directory where you will run the server</p>
<p>3. Use git to clone the project source files</p>
<pre>
    cd /path/to/server
    git clone https://github.com/spectrumitec/wonderbox.git
</pre>
<p>4. Install node modules required to support this server</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken 
</pre>
<p>5. Start Node JS Wonderbox</p>
<pre>
    node start_server
</pre>
<p>6. Open a web browser and connect to the server IP address (or localhost if running on your local system). The defualt login is 'admin' and password 'admin'. You may change password after login in top right corner from user drop down.</p>

<b>Server Configuration:</b><br />
<p>There is a single server configuration file located in the root directory. Changes to the configuration settings requires a server restart. The following is an example 'server_conf.json'. If you prefer to connect to the Dev Managment UI via server hostname, you can add the FQDN and hostnames in your server configuration 'server_dev_ui' setting(See example below 'nodejs-dev' and 'nodejs-dev.network.local').</p>
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
<p>When you login to the Dev Management UI, there is a 'Server Settings' panel under 'Admin' tab that has some basic explaination for the uses of each setting.</p>

<b>Current Limitations:</b><br />
<ul>
    <li>SSL certificates cannot be assinged individually to each site. A server hosting multiple sites will require a SAN or wildcard certificate. Alternatively, you can create a new self signed certificate and allow a load balancer to handle the SSL certificates (SSL offload).</li>
    <li>Cannot use newer import syntax as site content is executed from inside a server class which does not allow imports. Will need to use require statement for module imports.</li>
    <li>Logging has not yet been completed, planned for future versions.</li>
    <li>JWT auth for Dev management UI will have MySQL/MariaDB in future versions, currently limited to local file configurations. See server path '/root_folder/server/conf/'</li>
</ul>

<b>Quick Start Guide:</b><br />
<p>To begin with a simple project, and let's not call it 'Hello World!'. You can start with logging into the Dev Management UI at 'https://your_ip_addres' or 'https://localhost', if you have not already setup the server configuration 'server_dev_ui' settings. On the main 'Projects' tab, there are four button on the left pane at the top. The 'box' icon allows you to create a new project. Supply a project 'Name' and 'Description' (optional) to create a base configuration. A new project should appear in the left pane.</p>
<p>Select your project and you will see the project tree is broken into a few sections:</p>
<ul>
    <li><b>The root of the project</b> - This is where basic settings allow for changing description or enable / disable the project for DNS resolution settings. Here you can also preview your site creations under a special VHost path (/vhost/project::sitename/). Disabling your project does not disable the VHost preview function. Note: VHost preview is only available when server dev mode is active.</li>
    <li><b>Sites and Settings</b> - This is where you create a website under your project. All sites will appear under this tree selector when created. There are three general options here where you can create a blank empty web source folder, a system default starter site, and user defined templates (should you have your own templates to use). Blank site selection is for customized builds where needing to create a specific folder structure to your project.</li>
    <li><b>Project Files</b> - This is more of a helper panel for some basic folder strucutre and file creation. The Dev Management UI has some basic file templates for creating HTML, CSS or API files. If customizing your folder stuctures, you can follow up with configuring the site mappings (see website settings below)</li>
    <li><b>DNS Resolution</b> - This is when you either have a DNS server or using a local host file on your workstation to resolve to your server IP address or your server(s) are behind a load balancer virtual IP. DNS resolution uses the server settings environment variable and an FQDN name to map and reslove to a select site in your project. If you have a Dev, QA, Stage and Prod server environment as an example, copying or using git clone / pull to copy your source code between environments will leverage this in each environment by refering to the server environment varaible and your project mapping configuration for DNS. Note: While the server is in Dev mode, you are unable to use localhost, IP addresses or any FQDN and hostnames defined in the server 'server_dev_ui' settings.</li>
</ul>
<p>Website settings under your project's 'Sites and Settings' tree view, provides configurations you would to use access your project code. These are broken into the following:</p>
<ul>
    <li><b>General Settings</b> - Your site will usually have a default document or potentially need to ensure your site is secured. These settings allow you to define the default document, a maintenance splash page, SSL redirection and ability to toggle your site default doc to a maintenance page. Maintenance page doesn't disable all the sub paths of a site. Only the main index page or site root is altered with maintenance page (does not apply to site VHost preview). If needing to disable the entire site, optionally you can create a maintenance site and update the DNS resolution to point to maintenance instead which will disable all your APIs as well. You may still preview using the VHost link while the DNS is pointing to the maintence site.</li>
    <li><b>Error Page Default Documents</b> - These allow you to specify a custom 404 or 500 error pages otherwise the server default error pages will be used</li>
    <li><b>API Fixed File Mapping</b> - Allows for a sub path mapping to resolve to a single API file. Fix mapping will resolve all paths under the defined sub path to the API file chosen. API mapping is strictly server side execution and will not send source code to the client browser. (Do not map to an API file off the root path as the root path is reserved for static content)</li>
    <li><b>API Dynamic Path Mapping</b> - Allows for a sub path mapping to resolve to any API file in the folder tree structure. The server will map the URL path accordingly to the underlying filesystem path. API mappings is strictly server side execution and will not send source code to the client browser. (Do not map to the root path as the root path is reserved for static content)</li>
    <li><b>Static Content Path Mapping</b> - This will cover any static content like HTML, client side JavaScript, CSS, images, etc. The server will handle MIME types related to file extension. Any files that are in the root URL path and not located in API mapping paths are treated as static content except where overriden.</li>
    <li><b>Static Content Server Execute Override</b> - In some cases you may require a file at the root path to execute at the server and not be sent to client like static content. This allows to specify those file paths as an override. An example of this is a health check script used for a load balancer that might check modules, database connectivity, etc. and send the load balancer a status 500 error or other code to let it know this web server has a problem.</li>
</ul>
<p>As a helper for any server side API, see the 'Project Files' tree, create a new file in your API folder, then select the API file type which will drop in a standard template (helper file) that is ready for developing your server side code. The helper will output a JSON return of the available server variables that can be used in your application. This may be used as a testor to validate headers, query parameters, etc. When layout out your website mapping, any folders and files that are not inside the mapping cannot be directly accessed by the client's browser. You may include classes and functions in your API files that would be used for server side execution.</p>

<b>The Manual Side of Things:</b><br />
<p>From a manual configuration perspective, the server root has a general layout (below). Git ignore for this project is set to ignore the 'web_source' and 'web_templates' folders. When starting your server for the first time, it will create these folders for your web source and templates. You can setup your own GitHub projects and import node modules into your project folders as required. There is no tie into a database or antyhing that can corrupt your server configuration. Do note that a manually configuring your project config.json files with a syntax error can cause your server to crash loop. Using the UI for config changes is the safest way to avoid this. The server can be script friendly if you plan on automating project and site pushes as the server detects new projects and refreshes it's mapping as long as the server auto refresh is enabled and set on a check interval.</p>
<pre>
root folder
  &#746; node_modules              Node modules installed during installation
  &#8735; server                    Main server folder
    &#8735; class                   System classes
    &#8735; conf                    Configuration location for system classes (created on first server start from JWT config creation)
    &#8735; default_errors          Location of system default 404 and 500 error pages
    &#8735; default_file_types      Location of template file types (used when creating new files in Dev Management UI)
    &#8735; default_new_site        Location of default system template
    &#8735; localhost               Location of Dev Management UI
    &#8735; ssl_certs               SSL certificate location (see server_conf.json if creating SSL by different file names)
  &#8735; web_source                Location of all project folders
    &#8735; your_project            The project folder associated with the project tree
      &#8735; website_folder        The folder for each website defined under your project
      &#8735; config.json           The configuration file within your project containing all settings
  &#8735; web_templates             Location for any template created or downloaded (similar to project folder structure)
  &#8735; server_conf.json          Server configuration file
  &#8735; server_start.js           Server start script
</pre>
<p>Project configuration example is as follows. Most of what is in the configuration file is relatively easy to see where it relates in the Dev Management UI. A few points:</p>
<ul>
    <li>If you have a server that is in Prod mode, which disables the Dev Managment UI, you can still fully configure things in the project configuration file. One example is setting 'enabled' to 'false' when the server is set to auto referesh. It will unregister the DNS mapping essentially disabling the site on that server.</li>
    <li>Path mapping has web URL path as the 'key' and the file system relative path as the 'value'. If changing the configuration manually on a Windows platform, maintain the UNIX/Linux style path separator "/" as the server will map properly for Windows systems. Do not use full OS path mapping as the server appends the file path to root of project website folder path.</li>
    <li>DNS names has the sections "dev", "qa", "stage" and "prod". You can have multiple DNS FQDNs under each environment section pointing to your site. Each DNS entry is mapped individually to a site. The Dev Management UI will prevent you from setting same DNS names to different sites or projects at the same time since the server will only resolve an FQDN to one site. Caveat here is to be aware if copying project source from different servers into one server for possible overlap of FQDN. You will want to make sure DNS mapping is properly set to each site. You can view the Dev Management UI 'Site Index' tab for FQDN mapping to make sure your sites are set to resolve correctly. A DNS name will resolve to only one site.</li>
</ul>
<pre>
    {
        "project_desc": "Project description",
        "enabled": true,
        "dns_names": {
            "dev": {
                "www-dev.network.local": "main-v1"
            },
            "prod": {
                "www.network.local": "main-v1"
            }
        },
        "websites": {
            "main-v1": {
                "ssl_redirect": true,
                "maintenance": false,
                "maintenance_page": "maintenance.html",
                "default_doc": "index.html",
                "default_errors": {
                    "404": "404.html",
                    "500": "500.html"
                },
                "apis_fixed_path": {},
                "apis_dynamic_path": {
                    "/api/": "/main-v1/api/"
                },
                "path_static": {
                    "/": "/main-v1/"
                },
                "path_static_server_exec": {}
            }
        }
    }
</pre>