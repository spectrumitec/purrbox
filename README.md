<b>Purrbox, an All-in-One VHost Server nad Developement Platform</b><br />
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
    git clone https://github.com/spectrumitec/purrbox.git
</pre>
<p>4. Install node modules required to support this server. Newer versions of Node may already include 'crypto' module.</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken syslog-client
</pre>
<i>** crypto module not needed for newer versions of node **</i>
<br /><br />
<p>5. Start Node JS Purrbox</p>
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
        "mgmt_mode":true,
        "mgmt_ui":[
            "nodejs-dev",
            "nodejs-dev.network.local"
        ],
        "environment":"dev",
        "environment_name":"testing",
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

<b>Starting Up</b><br />
<p>
	After installation, you should be able to connect to the management UI. Check out the 'Help' tab for information and how tos. Default login creds are 'admin' and 'admin'
	<br /><br />
	Enjoy!
</p>

![2024-09-15_13-47-03](https://github.com/user-attachments/assets/eba965ec-d8ab-4ca3-8c1d-c9626aaa5ea8)



