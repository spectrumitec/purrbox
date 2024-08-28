<b>Node JS Wonderbox</b>
<br />
<b>About:</b><br />
<p>This project is currently meant to work as a web service which supports static site content or application code that is not written under a known framework (native Javascript back end coding). The goal of this is to create a service for ease of standing up projects and websites for development or site creation. The management UI does not have a site editor which will require site and code developement using Visual Studio code or preferred IDE. Each project is intended to be self contained and portable, meaning you can create a website or multiple websites under a project and move the project folder between environments (Dev, QA, Stage, and Prod). The server can be setup to auto load the project source and handles the mapping of static and server side execution automatically. There is no DNS registration built into the web service but you can point DNS FQDN names or map proxy URL and domain and path to the server IP which you can configure to map to your project and site in the Management UI.</p>

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
    <li>Sub mapping under a project, create a sub folder resolving to another webite under current project</li>
    <li>Special error pages and maintenance pages for custom error pages or blocking incoming requests and directing to maintenance page.</li>
    <li>Website source version cloning and preview ability (when working with code branches and feature changes)</li>
    <li>DNS resolution mapping (FQDN resolution to server IP can be mapped easily to site code)</li>
    <li>Proxy friendly mapping without a need for regex rewrite complexity (does require site relative path for CSS, JS, Images, etc.)</li>
    <li>Server pre-processing of client and server details, headers, environment setting, query parsing, etc. and available for server side execute</li>
    <li>Optional default system site template or helper files from file management</li>
    <li>Ability for templating your starter code for new projects or fully functional sites for distribution</li>
    <li>Logging system for local file or log server including stack trace logging</li>
    <li>Admin panel for user access permissions for management, URL simulation testing to validate a site will load properly</li>
</ul>

<b>Installation:</b><br />
<p>1. Prepare your environment and install Node JS v18.x or higher and git if required</p>
<p>2. Create a directory where you will run the server</p>
<p>3. Use git to clone the project source files</p>
<pre>
    cd /path/to/server
    git clone https://github.com/spectrumitec/wonderbox.git
</pre>
<p>4. Install node modules required to support this server. Newer versions of Node may already include 'crypto' module.</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken syslog-client
</pre>
<i>** crypto module not needed for newer versions of node **</i>
<br /><br />
<p>5. Start Node JS Wonderbox</p>
<pre>
    node start_server
</pre>
<p>6. Open a web browser and connect to the server IP address (or localhost if running on your local system). The defualt login is 'admin' and password 'admin'. You may change password after login in top right corner from user drop down.</p>

<b>Server Configuration:</b><br />
<p>Server configuration files are located in the conf directory from root. Changes to the configuration settings requires a server restart. The following is an example 'server_conf.json'. If you prefer to connect to the Dev Managment UI via server hostname, you can add the FQDN and hostnames in your server configuration 'server_dev_ui' setting(See example below 'nodejs-dev' and 'nodejs-dev.network.local').</p>
<pre>
    {
        "hostname":"nodejs-dev",
        "workers":1,
        "cache_on":false,
        "debug_mode_on":false,
        "mgmt_mode":"dev",
        "mgmt_ui":[
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

Syslog or log files can be configured. In conf directory off the root folder, you can edit the logger.conf. You may either select to use 'file' or 'network'. File logging is more ideal for single instance and testing. Setting to network can point logs at graylog. 
<pre>
    {
    	"use": "server",
    	"file": {
    		"delete_older": "7d"
    	},
    	"server": {
    		"ipaddr": "192.168.1.5",
    		"port": "1514",
    		"protocol": "udp"
    	}
    }
</pre>

<b>Current Limitations:</b><br />
<ul>
    <li>SSL certificates cannot be assinged individually to each site. A server hosting multiple sites will require a SAN or wildcard certificate. Alternatively, you can create a new self signed certificate and allow a load balancer to handle the SSL certificates (SSL offload).</li>
    <li>Cannot use newer import syntax as site content is executed from inside a server class which does not allow imports. Will need to use require statement for module imports.</li>
    <li>JWT auth for Dev management UI will have MySQL/MariaDB in future versions, currently limited to local file configurations. See server path '/root_folder/server/conf/'</li>
</ul>

<b>Quick Start Guide:</b><br />
<p>To begin with a simple project, and let's not call it 'Hello World!'. You can start with logging into the Dev Management UI at 'https://your_ip_addres' or 'https://localhost', if you have not already setup the server configuration 'server_dev_ui' settings. On the main 'Projects' tab, there are four button on the left pane at the top. The 'box' icon allows you to create a new project. Supply a project 'Name' and 'Description' (optional) to create a base configuration. A new project should appear in the left pane.</p>

![2024-08-27_18-00-49](https://github.com/user-attachments/assets/65066c8f-2d63-41c2-a34f-aa3c3b141843)


<br />
<p>Select your project and you will see the project tree is broken into a few sections:</p>
<ul>
    <li><b>The root of the project</b> - This is where basic settings allow for changing description or enable / disable the project for DNS resolution settings. Here you can also preview your site creations under a special VHost path (/vhost/project::sitename/). Disabling your project does not disable the VHost preview function. Note: VHost preview is only available when server dev mode is active.</li>
    <li><b>Sites and Settings</b> - This is where you create a website under your project. All sites will appear under this tree selector when created. There are three general options here where you can create a blank empty web source folder, a system default starter site, and user defined templates (should you have your own templates to use). Blank site selection is for customized builds where needing to create a specific folder structure to your project.</li>
    <li><b>Project Files</b> - This is more of a helper panel for some basic folder strucutre and file creation. The Dev Management UI has some basic file templates for creating HTML, CSS or API files. If customizing your folder stuctures, you can follow up with configuring the site mappings (see website settings below)</li>
Stage and Prod server environment as an example, copying or using git clone / pull to copy your source code between environments will leverage this in each environment by refering to the server environment varaible and your project mapping configuration for DNS. Note: While the server is in Dev mode, you are unable to use localhost, IP addresses or any FQDN and hostnames defined in the server 'server_dev_ui' settings.</li>
</ul>

![2024-08-27_18-20-32](https://github.com/user-attachments/assets/f8428eaa-01a8-415c-a015-4e9242eb6fa0)


<p>Website settings under your project's 'Sites and Settings' tree view, provides configurations you would to use access your project code. These are broken into the following:</p>
<ul>
    <li><b>General Settings</b> - Your site will usually have a default document or potentially need to ensure your site is secured. These settings allow you to define the default document, a maintenance splash page, SSL redirection and ability to toggle your site default doc to a maintenance page. Maintenance page doesn't disable all the sub paths of a site. Only the main index page or site root is altered with maintenance page (does not apply to site VHost preview). If needing to disable the entire site, optionally you can create a maintenance site and update the DNS resolution to point to maintenance instead which will disable all your APIs as well. You may still preview using the VHost link while the DNS is pointing to the maintence site.</li>
    <li><b>Error Page Default Documents</b> - These allow you to specify a custom 404 or 500 error pages otherwise the server default error pages will be used</li>
    <li><b>API Fixed File Mapping</b> - Allows for a sub path mapping to resolve to a single API file. Fix mapping will resolve all paths under the defined sub path to the API file chosen. API mapping is strictly server side execution and will not send source code to the client browser. (Do not map to an API file off the root path as the root path is reserved for static content)</li>
    <li><b>API Dynamic Path Mapping</b> - Allows for a sub path mapping to resolve to any API file in the folder tree structure. The server will map the URL path accordingly to the underlying filesystem path. API mappings is strictly server side execution and will not send source code to the client browser. (Do not map to the root path as the root path is reserved for static content)</li>
    <li><b>Static Content Path Mapping</b> - This will cover any static content like HTML, client side JavaScript, CSS, images, etc. The server will handle MIME types related to file extension. Any files that are in the root URL path and not located in API mapping paths are treated as static content except where overriden.</li>
    <li><b>Static Content Server Execute Override</b> - In some cases you may require a file at the root path to execute at the server and not be sent to client like static content. This allows to specify those file paths as an override. An example of this is a health check script used for a load balancer that might check modules, database connectivity, etc. and send the load balancer a status 500 error or other code to let it know this web server has a problem.</li>
    <li><b>Sub Map</b> - You can use this to map to another site in your project. Example might be where you need to have an API that communicates in XML for a legacy interface. You can configure that site to be all XML response from 
    that sub mapped site for anything API, error pages and maintenance page, while the rest of the site leverages JSON as it's primary communication.</li>
</ul>

![2024-08-27_18-21-30](https://github.com/user-attachments/assets/b831d349-ef67-43d7-bdb8-4c4ea71d23f3)


<p>As a helper for any server side API, see the 'Project Files' tree, create a new file in your API folder, then select the API file type which will drop in a standard template (helper file) that is ready for developing your server side code. The helper will output a JSON return of the available server variables that can be used in your application. This may be used as a testor to validate headers, query parameters, etc. When layout out your website mapping, any folders and files that are not inside the mapping cannot be directly accessed by the client's browser. You may include classes and functions in your API files that would be used for server side execution.</p>

![2024-08-27_18-23-11](https://github.com/user-attachments/assets/c879bf68-6439-4abd-abdf-23491e0c784f)

<p>Resolve section helps with mapping Proxy domain and path or DNS FQDN to your project websites. Sub mapping in the website settings will map under the URL path automatically.</p>

![2024-08-27_18-14-41](https://github.com/user-attachments/assets/575f64e3-914e-4691-bd4b-b5c641c7ad22)


<b>The Manual Side of Things:</b><br />
<p>From a manual configuration perspective, the server root has a general layout (below). Git ignore for this project is set to ignore the 'web_source' and 'web_templates' folders. When starting your server for the first time, it will create these folders for your web source and templates. You can setup your own GitHub projects and import node modules into your project folders as required. There is no tie into a database or antyhing that can corrupt your server configuration. Do note that a manually configuring your project config.json files with a syntax error can cause your server to crash loop. Using the UI for config changes is the safest way to avoid this. The server can be script friendly if you plan on automating project and site pushes as the server detects new projects and refreshes it's mapping as long as the server auto refresh is enabled and set on a check interval.</p>
<pre>
root folder
  &#9500; node_modules                  Node modules installed during installation
  &#9500; conf                          Server configuration folder
  &#9474;   &#9500; cert.pem                  SSL Cert
  &#9474;   &#9500; key.pem                   SSL Private Key    
  &#9474;   &#9500; server_conf.json          Server configuration file
  &#9474;   &#9492; logger.json               Server logging configuration file
  &#9500; logs                          Log files when set for file logging
  &#9500; server                        Main server folder
  &#9474;   &#9500; class                     System classes
  &#9474;   &#9500; conf                      Configuration location for system classes (created on first server start from JWT config creation)
  &#9474;   &#9500; default_errors            Location of system default 404 and 500 error pages
  &#9474;   &#9500; default_file_types        Location of template file types (used when creating new files in Dev Management UI)
  &#9474;   &#9500; default_new_site          Location of default system template
  &#9474;   &#9492; localhost                 Location of Dev Management UI
  &#9500; web_source                    Location of all project folders
  &#9474;   &#9492; your_project              The project folder associated with the project tree
  &#9474;       &#9500; website_folder        The folder for each website defined under your project
  &#9474;       &#9492; config.json           The configuration file within your project containing all settings
  &#9500; web_templates                 Location for any template created or downloaded (similar to project folder structure)
  &#9492; server_start.js               Server start script
</pre>
<p>Project configuration example is as follows. Most of what is in the configuration file is relatively easy to see where it relates in the Dev Management UI. A few points:</p>
<ul>
    <li>If you have a server that is in Prod mode, which disables the Dev Managment UI, you can still fully configure things in the project configuration file. One example is setting 'enabled' to 'false' when the server is set to auto referesh. It will unregister the DNS mapping essentially disabling the site on that server.</li>
    <li>Path mapping has web URL path as the 'key' and the file system relative path as the 'value'. If changing the configuration manually on a Windows platform, maintain the UNIX/Linux style path separator "/" as the server will map properly for Windows systems. Do not use full OS path mapping as the server appends the file path to root of project website folder path.</li>
    <li>DNS names has the sections "dev", "qa", "stage" and "prod". You can have multiple DNS FQDNs under each environment section pointing to your site. Each DNS entry is mapped individually to a site. The Dev Management UI will prevent you from setting same DNS names to different sites or projects at the same time since the server will only resolve an FQDN to one site. Caveat here is to be aware if copying project source from different servers into one server for possible overlap of FQDN. You will want to make sure DNS mapping is properly set to each site. You can view the Dev Management UI 'Site Index' tab for FQDN mapping to make sure your sites are set to resolve correctly. A DNS name will resolve to only one site.</li>
</ul>
<pre>
{
	"project_desc": "Description of project",
	"enabled": true,
	"proxy_map": {
		"dev": {
            "proxy.domain.com/path":"www"
        },
		"qa": {},
		"stage": {},
		"prod": {}
	},
	"dns_names": {
		"dev": {
            "www.domain.com":"www"
        },
		"qa": {},
		"stage": {},
		"prod": {}
	},
	"websites": {
		"www": {
			"ssl_redirect": true,
			"maintenance": {
				"dev": false,
				"qa": false,
				"stage": false,
				"prod": false
			},
			"maintenance_page": "maintenance.html",
			"maintenance_page_api": "maintenance.json",
			"default_doc": "index.html",
			"default_errors": {
				"user": {
					"404": "404.html",
					"500": "500.html"
				},
				"api": {
					"404": "404.json",
					"500": "500.json"
				}
			},
			"apis_fixed_path": {},
			"apis_dynamic_path": {},
			"path_static": {
				"/": "/www/"
			},
			"path_static_server_exec": {},
			"sub_map": {}
		}
	}
}
</pre>

<b>Managment UI Admin</b>
<ul>
    <li>User management and permissions</li>
    <li>Mapping similation for testing URL routing in various environments (FQDN / Proxy testing)</li>
    <li>Server configuration reference</li>
</ul>

![2024-08-27_18-17-57](https://github.com/user-attachments/assets/438247de-472f-4d77-a639-479a8d52edd6)

![2024-08-27_18-16-33](https://github.com/user-attachments/assets/a2801832-675b-4d0b-914a-0c8790c236d0)

