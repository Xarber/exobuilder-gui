**NOTICE: You can also set up a JSON NGINX webserver and insert it in the option.json sources and the server will pass it to tinfoil automatically**
- Optional configs to make the server better ------------------------------------------------
* TINFOIL CONFIG (place it in a game directory, name it as *.tfl, don't worry, the server won't load it with default modes.json config)
**READ MORE HERE: https://blawar.github.io/tinfoil/custom_index/**
`
{
    "version": 7.00,
    "files": ["https://url1", "sdmc:/url2", "http://url3"],
    "directories": ["https://url1", "sdmc:/url2", "http://url3"],
    "success": "Shop loaded successfully!",
    "referrer": "http://mydomain.com/index.tfl",
    "googleApiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "oneFichierKeys": ["ap1key1", "apikey2", "apikey3"],
    "headers": ["My-Custom_header: hello", "My-Custom_header2: world"],
    "clientCertPub": "-----BEGIN PUBLIC KEY----- ....",
    "clientCertKey": "-----BEGIN PRIVATE KEY----- ....",
    "themeBlackList": ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    "themeWhiteList": ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    "themeError": "please select an authorized theme.",
    "locations": [
        "https://abc123.com/456/",
        {"url": "https://xyz.com/blah", "title": "xyz", "action"="disable"},
        {"url": "https://xyz.com/blah2", "title": "xyz2", "action"="enable"},
        {"url": "https://xyz.com/blah3", "title": "xyz3", "action"="add"}
    ],
    "titledb": {
        "050000BADDAD0000": {
            "id": "050000BADDAD0000",
            "name": "Tinfoil",
            "version": 0,
            "region": "US",
            "releaseDate": 20180801,
            "rating": 10,
            "publisher": "N/A",
            "description": "Nintendo Switch Title Manager",
            "size": 14000000,
            "rank": 1
        }
    },
    "x-set-header: MyCustomHeader%3A%20hello%20world",
    "x-tmp-header: MyCustomHeader%3A%20hello%20world"
}
`
* options.json CONFIG
* This is a configuration file and log file at the same time, use it to set the shop to your needs!
* PS: You can put an absolute path on any of the options (except <*pre/post*_*include/require*>) to get the value from the file.
* It is VERY important to block access to this file to nginx. Also block auth/ folder. You can do it with this config:
* 
* location ~ /options\.json$
* {
*     return 403;
* }
* location ^~ /auth/ {
*     deny all;
*     return 403;
* }
`
{
    "log_accesses": 1, //Log every access/request at the end of the options.json file
    "sources": [ //Where to load games from. Can be folder or URL
        {"source":"games/","active":1,"group":"someGroupName","recursive":1} //Omit the "group" property or set it to type different than string to disable it.
    ],
    "modes": { //FIRST MODE = DEFAULT!
        "nx": {
            "frmt":["nsp","nsz","xci","xcz"], //FORMATS TO LOAD
            "icon":"data:image/png;base64,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" //DEFAULT FORMAT ICON
        }
    },
    "groups": {//Groups you'll find when using fetch-groups or searching empty values on the website.
        "SomeGroupName": [ //Group Name
            //{ ... }, { ... } -> The same game formats as you would get on fetch-search / fetch-request .
        ]
    },
    "saves": { //Easily backup folders with FTP. Caution! This may bring performance issues or errors on large files/folders.
        "SomeDeviceName": { //This is the device name that will be shown on saves/ folder and status.
            "uri": "ftp://user:pass@host/startPath/", //FTP URI to the device
            "fld": [
                "FTB1/",
                "FTB2"
            ], //Folders to backup
            "enabled": 0 //Enable this device
        }
    },
    "uplloc": ["/root/uploads/"], //List of folders to allow upload to. To upload to theese folders, a key will be needed. Instead, upload to "uploads/" (default) to not require a key.
    "autofile": 0, //Automatically extact .zip / .rar / .7z / .torrent on the local folders the client has access to. This will install unrar, transmission-cli and p7zip packages. IMPORTANT!!! ROOT PERMISSIONS MUST BE GRANTED TO THE SCRIPT!! (get php user with <?php echo shell_exec('whoami'); ?>, then add "<USER> ALL=(ALL) NOPASSWD: ALL" on "visudo" command on the terminal)
    "afiloc": ["/root/someDir/"], //List of folders to run autofile into. Remember, autofile always runs on local "sources" property locations.
    "shp_ttl": "X-Shop", //Select a title for the shop.
    "lckdwn": 0, //Completely locks down the shop, returning an error message (if tinfoil client, `tfl_otp` and `dynamic_tfl` are on): "<Shop Title> is currently on lockdown.\n<Eventual Custom Message Defined in 'lckdwn' property>". If not on tinfoil client, the shop will return a basic HTML page with the same alert.
    "tfl_otp": 0, //Select whether to only output game list or .tfl file + game list (You can find TFL index syntax online). Valid options are JSON (string or object) or 0. You can also insert a .tfl file in a game dir to load it into tinfoil. This will ALWAYS stay 0 on non-tinfoil requests.
    "dynamic_tfl": 1, //If this is 1 and "tfl_otp" is an object, this will automatically override the "success" / "error" key to give more detailed output.
    "allow_web_part": 1, //If 0 then redirects to root of site (ex. a.b.c/d -> b.c); If string and $_GET["accessphrase"]!=string Redirect;
    "csens_search": 0, //This specifies whether the search is case sensitive or not.
    "smart_search": 1, //Output more games by running a more complex search, to avoid typing mistakes.
    "ss_max_err": 1, //Maximum wrong letters inside of smart searches. Keep this low to avoid crashes!
    "pglen": 20, //Page length on searching with "\*" or "\*:PAGE_NUMBER"
    "save_web_key": 1, //Saves the "accessphrase" not to need it next times.
    "tinfoil_icons": 1, //Loads icons from tinfoil.io (needs VPN/DNS)
    "use_ttldb": 0, //Select whether to use or not the title DB specified below. This will probably slow down page loading, but you will have a much more detailed game output. Also, title DB is always disabled on tinfoil client, as already used by tinfoil itself.
    "title_db": "https://raw.githubusercontent.com/blawar/titledb/master/US.en.json", //The Title DB JSON file/URL (Disabled for tinfoil clients!). The format is {"somekey":{"id":"ID HERE",  . . .  }}
    "ttldb_time": 604800, //How much time has to pass before re-downloading the DB. The format is 3600 * 24 * < DAYS > (default is 7 days).
    "allow_ds_fetch": 1, //Allows Discord's Useragent to load the page's information and display it as embed. Always enabled if "allow_web_part" is.
    "allow_upt_robot": 1, //Allows Uptime Robot's Useragent to load the page's information and get monitor status. Always enabled if "allow_web_part" is.
    "allow_uploads": 1, //Allows uploading files from the web part of the shop.
    "auth_users": 0, //Needs users to authenticate to access the shop, both website and tinfoil.
    "auth_CID": 1, //Selects auth mode: 1 = Register from website (ClientID associated), 0 = Register with fetch request + admin key (User associated)
    "admin_key": "admin", //This key can override ANY pass/username having the user's ClientID, also, having this key you can configure shop settings from the website. If set to 0 then it will be disabled.
    "pre_include": 0, //Uses PHP's include() method before loading the shop.
    "pre_require": 0, //Uses PHP's require() method before loading the shop.
    "post_include": 0, //Uses PHP's include() method after loading the shop.
    "post_require": 0 //Uses PHP's require() method after loading the shop.
}
//New Access ------------------------------------------- -> LOG EXAMPLE
// [Day.Month.Year - Hour:Minute:Second] [IP | CLIENT_ID | IS_TINFOIL] User_Agent
`