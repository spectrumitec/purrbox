<b>Purrbox, a Node.js Virtual Hosting and Development Platform</b><br />
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
    git clone https://github.com/spectrumitec/purrbox.git .
</pre>
<p>4. Install node modules required to support this server. Newer versions of Node may already include 'crypto' module.</p>
<pre>
    npm install ip bcrypt crypto jsonwebtoken syslog-client
</pre>
<i>** crypto module not needed for newer versions of node **</i>
<br /><br />
<p>
5. Start Node JS Purrbox
<br /><br />
Starting in CommonJS mode
</p>
<pre>
    node start_server.js
</pre>
<p>Starting in ECMAScript mode</p>
<pre>
    node start_server.mjs
</pre>
<p>6. Open a web browser and connect to the server IP address (or localhost if running on your local system). The defualt login is 'admin' and password 'admin'. You may change password after login in top right corner from user drop down.</p>

<b>Starting Up</b><br />
<p>
	After installation, you should be able to connect to the management UI. Default login creds are 'admin' and 'admin'
    <br /><br />
    Check out the 'Help' tab for information and How Tos.
	<br /><br />
	Enjoy!
</p>

![2024-09-15_15-23-19](https://github.com/user-attachments/assets/b5449246-5521-437b-8407-6fcd3214f91d)

![2024-09-16_08-08-27](https://github.com/user-attachments/assets/762b2bb3-be90-46c7-8e21-222bde2801c5)


