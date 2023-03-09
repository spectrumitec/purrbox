<b>Node JS Wonderbox</b>

<b>About:</b><br />
<p>This is a new project for providing an easy way for setting up static sites or applications where users do not want to use a framework such as react or angular. It is designed to support running multiple site projects under a single IP addres and port. Components include a web server engine and a web UI for management of your project settings. The system is built to support running multiple environments such as a Dev, QA, Stage and Prod via a server configuration setting. Web projects are configured for portability between environments to allow for promoting code from Dev to other environments with minimumal intervention. A template system is built into the management UI allowing users to create their own code templates for projects or packaging fully functional applications.</p>

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
<p>2. Install node packages required to support this server</p>
<p>3. Create a directory where you will run the server</p>
<p>4. Use git to clone the project source files</p>
<pre>
    git clone https://github.com/cjs500/wonderbox.git
</pre>
<p>5. Install node modules required to support this server</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken 
</pre>
<p>6. Start Node JS Wonderbox</p>
<pre>
    node start_server
</pre>
<p>7. Open a web browser and connect to the server IP address to test connectivity (or localhost if running on your local system). The defualt login is 'admin' and password 'admin'</p>

<b>Server Configuration:</b><br />
<p>There is a single configuration file located in the root directory for server specific functions. Changes to the settings requires a server restart to activate. The following is an example 'server_conf.json' for settings available. When connected to the UI management interface, as server settings under Admin tab has some basic explaination for the uses. For accessing the management UI under a different name (not just IP or localhost), you can add hostnames separated by commas to the 'server_dev_ui' array.</p>
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