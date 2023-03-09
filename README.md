<b>Node JS Wonderbox</b>

<b>About:</b><br />
<p>This is a new project for providing an easy way for setting up static sites or applications where users do not want to use a framework such as react or angular. It is designed to support running multiple site projects under a single IP addres and port. Components include a web server engine and a web UI for management of your project settings. The system is built to support running multiple environments such as a Dev, QA, Stage and Prod via a server configuration setting. Web projects are configured for portability between environments to allow for promoting code from Dev to other environments with minimumal intervention. A template system is built into the management UI allowing users to create their own code templates for projects or packaging fully functional applications.</p>
<b>General Features:</b><br />
<ul>
    <li>Simplified installation and setup</li>
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
<pre>
    npm install ip bcrypt crypto jsonwebtoken 
</pre>
<p>3. Start Node JS Wonderbox</p>
<pre>
    node start_server
</pre>
