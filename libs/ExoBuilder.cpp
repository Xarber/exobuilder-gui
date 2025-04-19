#include <iostream>
#include <string.h>
#include <vector>
#include <stdio.h>
#include <stdlib.h>
#include <sstream>
#include <fstream>
#include <filesystem>
#include <cstdint>
#include <algorithm>
using namespace std;
namespace fs = filesystem;

//! Global Variables
filesystem::path cwd = filesystem::current_path();
string gittoken = "";
string server = "xcenter.it";
#ifdef _WIN32
    string sysnul = ">nul";
    string xidelroot = "$json";
    string setpathcmd = "";
#else
    string sysnul = ">/dev/null 2>&1";
    string xidelroot = ".";
    string setpathcmd = "export PATH=\"buildcomponents/bin/usr/bin:$PATH\" && ";
#endif

//! Program Variables
bool serveronline = false;
bool gitonline = false;
bool savelogs = false;
int buildver = 0;
int buildverfw = 0;
int buildverex = 0;
bool skipIteration = false;
bool restartscript = false;
bool oldassets = false;
bool skipdownload = false;
bool downloadonly = false;
bool keepassets = false;
bool offlinemode = false;
bool directbuild = false;
bool prepareonly = false;
bool packup = false;
bool clearfiles = false;
bool exitimmediately = true;
bool downloadextrafiles = false;
bool downloadnxfw = false;
bool multibuild = false;
bool writesigfiles = false;
bool promptextrafiles = true;

string outdir = "out";
string customversion = "";

int testver = 0;

//! Generic functions
string exec(string cmd) {
    #ifdef _WIN32
        FILE *fp = _popen(cmd.c_str(), "r");
    #else 
        FILE *fp = popen((cmd+" 2>&1").c_str(), "r");
    #endif
    char buf[1024];
    string result = "";

    while (fgets(buf, 1024, fp)) {
        result = result + buf;
    }
    return result;
}
void clear() {
    #ifdef _WIN32
        system("cls");
    #else 
        system("clear");
    #endif
}
void pause() {
    #ifdef _WIN32
        system("pause >nul");
    #else
        system("bash -c read -n1 -r -p \"\" key");
    #endif
}
bool replace(string& str, const string& from, const string& to) {
    size_t start_pos = str.find(from);
    if(start_pos == string::npos)
        return false;
    str.replace(start_pos, from.length(), to);
    return true;
}
void replaceAll(string& str, const string& from, const string& to) {
    if(from.empty())
        return;
    size_t start_pos = 0;
    while((start_pos = str.find(from, start_pos)) != string::npos) {
        str.replace(start_pos, from.length(), to);
        start_pos += to.length(); // In case 'to' contains 'from', like replacing 'x' with 'yx'
    }
}
vector<string> split(string s, string delimiter) {
    size_t pos_start = 0, pos_end, delim_len = delimiter.length();
    string token;
    vector<string> res;
    while ((pos_end = s.find(delimiter, pos_start)) != string::npos) {
        token = s.substr (pos_start, pos_end - pos_start);
        pos_start = pos_end + delim_len;
        res.push_back (token);
    }
    res.push_back (s.substr (pos_start));
    return res;
}
string join(vector<string> vec, string delimiter) {
    if (vec.size()==0) return "";
    string out = ""+vec[0];
    for (int i = 1;i < vec.size();i++) {
        out+=delimiter+vec[i];
    }
    return out;
}
string stringConcat(string string1, string string2) {
    std::ostringstream stream;
    stream << string1 << string2;
    return stream.str();
}
string stringNumConcat(string string1, int string2) {
    std::ostringstream stream;
    stream << string1 << string2;
    return stream.str();
}
bool contains(string str, string substr) {
    return (str.find(substr) != str.npos);
}
string fixpath(string path, bool reverse = false, bool removeLeadingDot = false, bool fixspaces = false) {
    #ifdef _WIN32
        replaceAll(path, "/", "\\");
        if (reverse) {
            replaceAll(path, "\\", "/");
            if (path.substr(0, 1) == "." && removeLeadingDot) path = path.substr(2);
        }
    #else 
        if (fixspaces) {replaceAll(path, " ", "\\ ");}
        else {replaceAll(path, "\\", "/");}
        if (path.substr(0,1) != "/" && path.substr(0,2) != "./") path = "./"+path;
    #endif
    replaceAll(path, "\\\\", "\\");
    replaceAll(path, "//", "/");
    return path;
}
string listFiles(string path, bool recursive = false) {
    string output = "";
    #ifdef _WIN32
        if (recursive && path.substr(0, 2) != "./" && path.substr(0, 1) != "/" && path.substr(1,3) != ":/") {
            output = exec("powershell.exe \"Get-ChildItem -Recurse '"+path+"' | Resolve-Path -Relative\"");
        } else output = exec("dir /b \""+fixpath(path)+"\"");
    #else
        output = exec((recursive?(setpathcmd+"tree -i -f --noreport \""):"ls -a1 \"")+path+"\"");
    #endif
    return output;
}
string readFile(string path) {
    ifstream ifs(path);
    string output((istreambuf_iterator<char>(ifs)), (istreambuf_iterator<char>()));
    return output;
}
void writeFile(string path, string content) {
    ofstream fileStream;
    fileStream.open(path);
    fileStream << content;
}
bool copyFile(string from, string to, bool force = false, bool move = false) {
    string filename = from.substr(from.find_last_of("/\\") + 1);
    string tofilename = to.substr(to.find_last_of("/\\") + 1);
    if (filename == "*") {
        replace(from, filename, "");
        from = fixpath(from, true, true);
        to = fixpath(to+"/", true, true);
        vector fromList = split(listFiles(from), "\n");
        for (int i = 0;i < fromList.size();i++) {
            if (fromList[i] == "" || fromList[i] == "." || fromList[i] == "..") continue;
            string fromfilename = fromList[i].substr(fromList[i].find_last_of("/\\") + 1);
            if (fs::exists(to+fromfilename)) {
                if (!force) continue;
                if (force && fs::is_directory(to+fromfilename)) {
                    fs::remove_all(to+fromfilename);
                } else fs::remove(to+fromfilename);
            }
            fs::copy(stringConcat(from,fromList[i]), to+fromfilename);
            if (move) try {
                fs::remove(stringConcat(from,fromList[i]));
            }catch(string e){}
        }
    } else {
        if (tofilename == "") {
            if (fs::exists(to + filename)) {
                if (!force) return false;
                if (force && fs::is_directory(to + filename)) {
                    fs::remove_all(to + filename);
                } else fs::remove(to + filename);
            }
            fs::copy(from, to + filename);
            if (move) fs::remove(from);
            return fs::exists(to + filename);
        } else {
            if (fs::exists(to)) {
                if (!force) return false;
                if (force && fs::is_directory(to)) {
                    fs::remove_all(to);
                } else fs::remove(to);
            }
            fs::copy(from, to);
            if (move) fs::remove(from);
            return fs::exists(to);
        }
    }
    return false;
}
void unzip(string zippath, string where) {
    if (zippath.substr(0, 2) != "./" && zippath.substr(0, 1) != "/") zippath = "./"+zippath;
    if (where.substr(0, 2) != "./" && where.substr(0, 1) != "/") where = "./"+where;
    #ifdef _WIN32 
        system(("powershell -command Expand-Archive '"+zippath+"' -DestinationPath '"+where+"' -Force").c_str());
    #else
        system(("unzip -o -qq \""+zippath+"\" -d \""+where+"\"").c_str());
    #endif
}
string fetch(string uri, string authtoken = "") {
    return exec((setpathcmd+"curl -L -s \""+uri+"\" "+(authtoken.size()>0 ? "--header \"Authorization: Bearer "+authtoken+"\" " : "")).c_str());
}
bool download(string uri, string output, string authtoken = "", bool prodmode = true) {
    output.erase(output.find_last_not_of(" \n\r\t")+1);
    output.erase(0, output.find_first_not_of(" \n\r\t"));
    uri.erase(uri.find_last_not_of(" \n\r\t")+1);
    uri.erase(0, uri.find_first_not_of(" \n\r\t"));
    string command = (setpathcmd+"curl -L"+(prodmode?" -s":"")+" -o \""+output+"\" \""+uri+"\""+(authtoken.size()>0 ? " --header \"Authorization: Bearer "+authtoken+"\"" : "")+(prodmode?(" "+sysnul):""));
    if (!prodmode) {
        cout << command << endl;
        for (char c : command) {
            printf("%02X ", (unsigned char)c);
        }
        printf("\n");
    }
    return (system(command.c_str()) == 0 && fs::exists(output));
}
string updateStatFile(string status, initializer_list<string> details) {
    string statfileout = "";
    statfileout += "[status]\n"+status+"\n\n[details]";
    for (const auto& detail : details) {
        statfileout += "\n" + detail;
    }
    statfileout +="\n\n";
    writeFile(fixpath("buildcomponents/status.inf"), statfileout);
    return statfileout;
}
vector<string> readStatFile() {
    if (!fs::exists("buildcomponents") || !fs::exists(fixpath("buildcomponents/status.inf"))) {
        vector<string> output;
        return output;
    }
    vector statFile = split(readFile(fixpath("buildcomponents/status.inf")), "\n");
    vector<string> output;
    for (int i = 0;i < statFile.size();i++) {
        string line = statFile[i];
        if (line == "" || (line.substr(0,1) =="[" && line.substr(line.size()-1, 1) == "]")) continue;
        output.push_back(line);
    }
    return output;
}
uint64_t checkSum(const std::string& data) {
    uint64_t checksum = 0;
    for(unsigned char ch : data) {
        //Add ascii code for every character in data
        checksum += static_cast<unsigned int>(ch);
    }
    return checksum;
}
uint64_t fileChecksum(string filePath) {
    std::ifstream file(filePath, std::ios::binary);  
    if (!file.is_open()) {
        std::cerr << "Could not open the file: " << filePath << std::endl;
        return 0;
    }
    std::string data((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    return checkSum(data);
}
uint64_t directoryChecksum(const std::string& dirPath) {
    uint64_t checksum = 0;
    for (const auto& entry : fs::recursive_directory_iterator(dirPath)) {
        if (fs::is_regular_file(entry.path())) {
            checksum += fileChecksum(entry.path().string());
        }
    }
    return checksum;
}

//! Program functions
void error(int errorCode = 1) {
    cout << "An error occurred and the program exited." << endl;
    exit(errorCode);
}
void serverStatus(bool offlinemode = false) {
    if (system((setpathcmd+"curl -s --connect-timeout 10 res."+server+" "+sysnul).c_str()) == 0) {
        serveronline = offlinemode ? false : true;
    } else {
        cout << "Server is offline! Trying to run with saved files..." << endl;
    }
    if (system((setpathcmd+"curl -L -s --connect-timeout 10 github.com "+sysnul).c_str()) == 0) {
        gitonline = true;
    } else {
        cout << "GitHub is down! The script can't run right now, please wait while their servers go back up." << endl;
        cout << "The estimated time can range from 15-30 minutes to several hours max." << endl;
        updateStatFile("Failed", {"GitHub unavailable"});
        error(500);
    }
}
void dirIntegrity(string dir = "") {
    if (!fs::exists("buildcomponents")) fs::create_directory("buildcomponents");
    if (!fs::exists("buildcomponents/data")) fs::create_directory("buildcomponents/data");
    if (!fs::exists("buildcomponents/content")) fs::create_directory("buildcomponents/content");
    if (!fs::exists("buildcomponents/content/uncategorized")) fs::create_directory("buildcomponents/content/uncategorized");
    if (!fs::exists("buildcomponents/basepack")) fs::create_directory("buildcomponents/basepack");
    if (!fs::exists("buildcomponents/libraries")) fs::create_directory("buildcomponents/libraries");
    if (!fs::exists("buildcomponents/workdir")) fs::create_directory("buildcomponents/workdir");
    if (!fs::exists("buildcomponents/tmp")) fs::create_directory("buildcomponents/tmp");
    if (dir.size() > 0 && !fs::exists(dir)) fs::create_directory(dir);
}
void helpMenu(string path) {
    cout << "ExoBuilder Script - @Xarber 2024" << endl;
    cout << "Usage: " << path << " [parameters]" << endl;
    cout << "No parameter is necessary; You can open the script by double clicking." << endl;
    cout << "You can also use abbreviations of the parameters, with one dash and the initial of the parameter. (E.G. --help = -h)" << endl;
    cout << "With quick parameters, multiple options are stackable, EXCEPT for multiple word options, such as --version and --dir. (E.G. --build --offline = -bo)" << endl;
    cout << endl;
    cout << "Parameters:" << endl;
    cout << "--asset-save-only: Only downloads files, and then quits the program." << endl;
    cout << "--build: Skips the build prompt and directly build the pack. (Default: Disabled)" << endl;
    cout << "--clear: Compress the pack to a zip file and delete the old files once done. (Default: No)" << endl;
    cout << "--dir [directory]: Change the output directory (Default: \"out\")" << endl;
    cout << "--exit: Exits the program immediately instead of prompting to." << endl;
    cout << "--firmware-download: Download latest NX Firmware from THZoria's repo (Default: No)" << endl;
    cout << "--gittoken [token|\"empty\"]: GitHub Classic Personal Access Token, to authenticate to GH's servers. (Default: None;Empty skips PAT prompt)" << endl;
    cout << "--help: Shows this help list." << endl;
    cout << "--install-extra-files: Directly install all extra assets without asking (Default: Prompt)" << endl;
    cout << "--keep-files: Skip deleting asset files after the script is done. (Default: No)" << endl;
    cout << "--log: Save logs to log.txt file" << endl;
    cout << "--multi-build: Builds the pack with multiple output folders, in add-on format ([!] Auto enables multiple parameters; Meant for scripting purposes, Default: No)" << endl;
    cout << "--no-extra-files: Skip downloading any extra files (Default: Prompt)" << endl;
    cout << "--offline: Run the script in offline mode (Do not connect to X-Center servers. The script still requires internet, Default: No)" << endl;
    cout << "--prepare-only: Only prepares the program and then exits. (Default: Disabled)" << endl;
    cout << "--restart: Restarts the script after an unsuccessful stop (Instead of resuming from where it left off. Default: Resume)" << endl;
    cout << "--skip-download: Uses only the assets in the content folder, without downloading any extra ones. CAREFUL! If assets are missing, the script won't give any error! (Default: No)" << endl;
    cout << "--test [directory]: Tests a pack for support certification. Server needs to be online! This automatically enables '-p' option. (Default: Don't test)" << endl;
    cout << "--use-old-assets: Use the previous asset list and skip the parsing process with github (Bypasses rate limit, Default: No)" << endl;
    cout << "--version [version]: Select a custom version of the pack (Ex. 18.0.0-1.0.6, Default: latest version)" << endl;
    cout << "--write-signature-files: Writes includes a .sig file with the pack's signature after build (Meant for scripting purposes, Default: No)" << endl;
    cout << "--zip: Compress the pack to a zip file once done. (Default: No;)" << endl;
    exit(0);
}
string authenticate(string gittesttoken = "") {
    if (gittesttoken.size() < 30 || gittesttoken.substr(0, 4) != "ghp_") return "";
    string output = exec(setpathcmd+"curl -L -s \"https://api.github.com/rate_limit\" --header \"Authorization: Bearer "+gittesttoken+"\"");
    return (output.find("Bad credentials") == output.npos) ? gittesttoken : "";
}
string askAuthToken() {
    string outgittoken = "";
    if (!fs::exists("gittoken.txt")) {
        string tmpGitToken = "";
        cout << "No GitHub Personal Access Token found!" << endl;
        cout << "While unauthenticated, you can get rate limited after 2 uses of the app in the same hour." << endl;
        cout << "You can get a classic personal access token here:" << endl;
        cout << "https://github.com/settings/tokens" << endl;
        cout << "If you have a token, input it now, or else, just press enter." << endl;
        cout << "Note: You can also manually create a \"gittoken.txt\" file with the token in it anytime." << endl;
        cout << "Github PAT: ";
        getline(cin, tmpGitToken);
        cout << endl;
        if (authenticate(tmpGitToken) == tmpGitToken) outgittoken = tmpGitToken;
        writeFile("gittoken.txt", outgittoken);
    } else {
        string tmpGitToken = readFile("gittoken.txt");
        if (authenticate(tmpGitToken) == tmpGitToken) outgittoken = tmpGitToken;
    }

    return outgittoken;
}
string genAssetFile(string componentlist, string customversion = "") {
    vector FileLines = split(componentlist, "\n");
    string output = "";
    string outtype = "uncategorized";
    for (int i = 0;i < FileLines.size();i++) {
        string line = FileLines[i];
        line.erase(line.find_last_not_of(" \n\r\t")+1);
        if (line == "Componenti essenziali pack ---") {outtype = "core";output = (output.size() == 0) ? "$core" : output+"\n$core";}
        if (line == "Lista Overlay Tesla utilizzati ---") {outtype = "ovl";output = (output.size() == 0) ? "$ovl" : output+"\n$ovl";}
        if (line == "Lista App Homebrew utilizzate ---") {outtype = "hb";output = (output.size() == 0) ? "$hb" : output+"\n$hb";}
        if (line == "Lista Sys Module utilizzati ---") {outtype = "sysmodules";output = (output.size() == 0) ? "$sysmodules" : output+"\n$sysmodules";}
        if (line == "Componenti aggiuntive opzionali ---") {outtype = "extra";output = (output.size() == 0) ? "$extra" : output+"\n$extra";}
        if (line.substr(0, 7) == " | http") {
            string repo = line.substr(3, line.size());
            replace(repo, "https://github.com/", "");
            replace(repo, "http://github.com/", "");
            string nogitlink = repo;
            if (nogitlink.substr(0, 4) == "http") {
                output = (output.size() == 0) ? nogitlink : output+"\n"+nogitlink;
            } else {
                //... Cancer code cause linux apparently has a storke while adding a variable to a string :D
                replace(repo, "/releases/latest", "");
                #ifdef _WIN32
                #else
                    repo.erase(repo.find_last_not_of(" \n\r\t")+1);
                #endif
                string gitapi = "https://api.github.com/repos/"+repo+"/releases";
                download(gitapi, "buildcomponents/tmp/repo_releases.json", gittoken);
                string curlout = readFile("buildcomponents/tmp/repo_releases.json");
                bool xideltest = contains(exec(fixpath("buildcomponents/libraries/xidel")+" -s --data={\"test\":\"true\"} -e \""+xidelroot+"/test\""), "true");
                string repoassets = "";
                if (xideltest) {
                    if (multibuild) {
                        if (outtype == "extra") buildverex += atoi((exec(fixpath("buildcomponents/libraries/xidel")+" -s buildcomponents/tmp/repo_releases.json --xquery \"count("+xidelroot+"/url)\"")).c_str());
                        if (repo == "THZoria/NX_Firmware") buildverfw += atoi((exec(fixpath("buildcomponents/libraries/xidel")+" -s buildcomponents/tmp/repo_releases.json --xquery \"count("+xidelroot+"/url)\"")).c_str());
                    } else buildver += atoi((exec(fixpath("buildcomponents/libraries/xidel")+" -s buildcomponents/tmp/repo_releases.json --xquery \"count("+xidelroot+"/url)\"")).c_str());
                    repoassets = exec(fixpath("buildcomponents/libraries/xidel")+" -s buildcomponents/tmp/repo_releases.json -e \""+xidelroot+"/assets[1]/browser_download_url\"");
                    writeFile(fixpath("buildcomponents/build.ver"), to_string(buildver));
                } else {
                    repoassets = "incompatible";
                }
                if (repoassets.substr(0, 4) == "http") {
                    output = (output.size() == 0) ? repoassets : output+"\n"+repoassets;
                } else if (contains(curlout, "rate limit") || contains(repoassets, "incompatible")) {
                    cout << (contains(repoassets, "incompatible") ? "Your system doesn't support xidel library." : "Your session has been rate limited from github.") << endl;
                    bool rateLimited = true;
                    if (serveronline) {
                        replace(repo, "/", "%2F");
                        string serverout = exec(setpathcmd+"curl -s \"https://res."+server+"/ExoPack/"+customversion+"ExoBuilder.php?intent=releases&out=simple&from="+repo+"\"");
                        if (serverout != "RATE-LIMITED") {
                            rateLimited = false;
                            output = (output.size() == 0 ? serverout : output+"\n"+serverout);
                            break;
                        }
                    }
                    if (rateLimited) {
                        cout << "There was a problem in parsing the updated JSON! You either got rate limited or lost internet connection." << endl;
                        cout << "The X-Center Server is not available so the updated files can't be parsed." << endl;
                        if (contains(repoassets, "incompatible")) cout << "Your system doesn't support xidel, so it needs to rely on X-Center server to update the asset list." << endl;
                        cout << "If you got rate limited (from Github API), you need to wait an hour before reusing this tool." << endl;
                        cout << "You can also create a Personal Access Token (classic) from github.com/settings/tokens , and save it as \"gittoken.txt\"." << endl;            
                        if (!fs::exists("buildcomponents/data/component_assets.txt")) {
                            updateStatFile("Failed", {"Failed updating assets"});
                            error(500);
                        }
                        cout << "Reusing old assets list..." << endl;
                        output = readFile("buildcomponents/data/component_assets.txt");
                        break;
                    }
                } else {
                    cout << repo << " Repository not found / No assets." << endl;
                }
            }
        }
    }
    replaceAll(output, "\n\n", "\n");
    output.erase(output.find_last_not_of(" \n\r\t")+1);
    return output;
}
bool testPack(string directory) {
    if (!serveronline) {cout << "Can't test pack! Server is offline." << endl;return false;}
    if (!fs::exists(fixpath(directory))) {cout << "Can't test pack! Directory doesn't exist." << endl;return false;}
    if (fs::exists(fixpath(directory+"/ExoPack/"))) directory = fixpath(directory+"/ExoPack/");
    if (!fs::exists(fixpath(directory+"/Guides/")) || !fs::exists(fixpath(directory+"/Payloads/"))) {cout << "Can't test pack! Directory is not valid." << endl;return false;}
    directory = fixpath(directory);
    cout << "Retrieving pack information..." << endl;
    string packsdpath = fixpath(directory+"/sd/");
    bool hasExtraFiles = (readFile(fixpath(packsdpath+"/config/hasextrafiles")) == "1");
    vector FileListPack = split(listFiles(directory), "\n");
    for (int i = 0;i < FileListPack.size();i++) {
        string filepath = FileListPack[i];
        if (filepath == "." || filepath == "..") continue;
        if (filepath.substr(0,1)=="'") filepath = filepath.substr(1, filepath.size() - 1);
        if (filepath.substr(0, 6) == "Switch") {
            packsdpath = fixpath(directory+"/"+filepath+"/");
            break;
        }
    }
    int packtestver = 0;
    if (fs::exists(directory + "/ExoPack-Version.txt")) {
        string tmptestver = readFile(fixpath(directory + "/ExoPack-Version.txt"));
        tmptestver = tmptestver.substr(0, tmptestver.find("\n"));
        if (tmptestver.find("Pack Extended Version: ") != tmptestver.npos) {
            replace(tmptestver, "Pack Extended Version: ", "");
            #ifdef _WIN32
            #else
                tmptestver.erase(tmptestver.find_last_not_of(" \n\r\t")+1);
            #endif
            packtestver = atoi(tmptestver.c_str());
        }
    }
    int certstr = checkSum(readFile(fixpath(packsdpath + "/atmosphere/spver")));
    cout << "Checking pack integrity..." << endl;
    int packchksum = directoryChecksum(directory);
    string fetchout = fetch("https://res."+server+"/ExoPack/"+customversion+"ExoBuilder.php?intent=testpack&testver="+to_string(packtestver)+"&chksum="+to_string(packchksum)+"&spv="+to_string(certstr)+(hasExtraFiles ? "&extra=1":""));
    if (fetchout == "updating") {
        cout << "The server is updating pack resources at the moment, so testing the pack is limited. Try again later." << endl;
        return false;
    } else if (fetchout == "outdated-ok") {
        cout << "The pack is outdated, but a certification has been issued anyways." << endl;
        fetchout = "OK";
    }
    return (fetchout == "OK");
}

vector<string> statFile = readStatFile();
string lastRunStatus = statFile.size() > 0 ? statFile[0] : "Success";
string continueFromSection = "run";
string continueFromSection2 = "run";
int continueFromProgress = 0;

//! Program Execution
int main(int argc, char* argv[])
{
    cout << "Preparing program..." << endl;

    if (fs::exists("./ExoBuilder.exbi")) {
        cout << "EXBI File found! Extracting..." << endl;
        if (!fs::exists("buildcomponents")) fs::create_directory("buildcomponents");
        if (!fs::exists("buildcomponents/exbi")) fs::create_directory("buildcomponents/exbi");
        fs::rename("./ExoBuilder.exbi", "./buildcomponents/exbi/ExoBuilder.zip");
        unzip("./buildcomponents/exbi/ExoBuilder.zip", ".");
        fs::remove("./buildcomponents/exbi/ExoBuilder.zip");
    }

    //* Load Parameters
    cout << "Loading parameters..." << endl;
    for (int i = 1;i < argc;i++) {
        if (skipIteration) {
            skipIteration = false;
            continue;
        }
        string argument = argv[i];
        string nextArg = argv[i+1] ? argv[i+1] : "";
        bool isMultiArgument = (argument.substr(0, 2) != "--" && argument.substr(0,1) == "-" && argument.size() > 1);

        if (nextArg.substr(0, 2) == "--") nextArg = "";

        if (argument=="--asset-save-only" || (isMultiArgument&&string::npos!=argument.find('a'))) downloadonly = true;
        if (argument=="--build" || (isMultiArgument&&string::npos!=argument.find('b'))) directbuild = true;
        if (argument=="--clear" || (isMultiArgument&&string::npos!=argument.find('c'))) {
            packup = true;
            clearfiles = true;
        }
        if ((argument=="--dir" || argument=="-d") && nextArg.size() > 0) {
            outdir = nextArg;
            skipIteration = true;
        }
        if (argument=="--exit" || (isMultiArgument&&string::npos!=argument.find('e'))) exitimmediately = true;
        if (argument=="--firmware-download" || (isMultiArgument&&string::npos!=argument.find('f'))) downloadnxfw = true;
        if ((argument=="--gittoken" || argument=="-g") && nextArg.size() > 0) {
            if (nextArg == "empty" || authenticate(nextArg) == nextArg) gittoken = nextArg;
            skipIteration = true;
        }
        if (argument=="--help" || (isMultiArgument&&string::npos!=argument.find('h'))) helpMenu(argv[0]);
        if (argument=="--install-extra-files" || (isMultiArgument&&string::npos!=argument.find('i'))) downloadextrafiles = true;
        if (argument=="--keep-files" || (isMultiArgument&&string::npos!=argument.find('k'))) keepassets = true;
        if (argument=="--log" || (isMultiArgument&&string::npos!=argument.find('l'))) {
            savelogs = true;
            if (fs::exists("ExoBuilder.log")) fs::remove("ExoBuilder.log");
            sysnul = ">>ExoBuilder.log";
        }
        if (argument=="--multi-build" || (isMultiArgument&&string::npos!=argument.find('m'))) {
            directbuild = true;
            downloadextrafiles = true;
            skipdownload = false;
            downloadnxfw = true;
            writesigfiles = true;
            multibuild = true;
        }
        if (argument=="--no-extra-files" || (isMultiArgument&&string::npos!=argument.find('n'))) {
            promptextrafiles = false;
            downloadextrafiles = false;
        }
        if (argument=="--offline" || (isMultiArgument&&string::npos!=argument.find('o'))) offlinemode = true;
        if (argument=="--prepare-only" || (isMultiArgument&&string::npos!=argument.find('p'))) prepareonly = true;
        if (argument=="--restart" || (isMultiArgument&&string::npos!=argument.find('r'))) restartscript = true;
        if (argument=="--skip-download" || (isMultiArgument&&string::npos!=argument.find('s'))) skipdownload = true;
        if (argument=="--use-old-assets" || (isMultiArgument&&string::npos!=argument.find('u'))) oldassets = true;
        if ((argument=="--version" || argument=="-v") && nextArg.size() > 0) {
            customversion = "versions/"s + nextArg + "/";
            skipIteration = true;
        }
        if ((argument=="--test" || argument=="-t") && nextArg.size() > 0) exit((testPack(nextArg) == true ? 0 : 1));
        if (argument=="--write-signature-files" || (isMultiArgument&&string::npos!=argument.find('w'))) writesigfiles = true;
        if (argument=="--zip" || (isMultiArgument&&string::npos!=argument.find('z'))) packup = true;
    }
    if (directbuild && prepareonly) {directbuild=false;prepareonly=false;}

    if (lastRunStatus != "Success" && restartscript == false) {
        if (statFile.size() > 2) continueFromProgress = stoi(statFile[2].substr(0, statFile[2].find_first_of('/'))) - 1;

        if (statFile[1]=="Updating info files"||statFile[1]=="Component list & asset list missing"||statFile[1]=="Asset list missing & user override"){continueFromSection="updateinfo";}
        else if (statFile[1]=="Cleaning workdir files") {continueFromSection="cleanworkdir";}
        else if (statFile[1]=="Downloading assets"||statFile[1]=="Failed downloading core file"){continueFromSection="downloadassets";}
        else if (statFile[1]=="Extracting base pack"){continueFromSection="preparebasepack";}
        else if (statFile[1]=="Extracting components"){continueFromSection="buildpack";}
        else if (statFile[1]=="Cleaning zip files"){continueFromSection="cleanextrafiles";}
        else if (statFile[1]=="Fixing locations"){continueFromSection="pathfix";}
        else if (statFile[1]=="Cleaning files"){continueFromSection="postclean";}
        else if (statFile[1]=="Moving the pack"){continueFromSection="movepack";}
        else if (statFile[1]=="Compressing the pack"){continueFromSection="compress";}
        else if (statFile[1]=="Writing signature files"){continueFromSection="writesigfiles";}
        continueFromSection2 = continueFromSection;
    }

    //* Check Authentication
    if (gittoken != "empty" && gittoken.size() == 0) gittoken = askAuthToken();
    cout << ((gittoken != "empty" && gittoken.size() > 0) ? "\nAuthenticated to GitHub!" : "\nExecuting script as unauthenticated...") << endl;
    if (gittoken == "empty") gittoken = "";

    //* Rebuild directories
    cout << "Checking and rebuilding work directories..." << endl;
    dirIntegrity();

    //* Check server status
    cout << "Checking server status..." << endl;
    serverStatus(offlinemode);

    if (continueFromSection == "run") {
        //* Download libraries
        updateStatFile("Preparing", {"Updating libraries"});
        cout << "Downloading / Updating libraries..." << endl;
        #ifdef _WIN32
            if ((!serveronline && !fs::exists("buildcomponents/libraries/xidel.exe")) || (serveronline && !download("https://res."+server+"/libraries/xidel.exe", "buildcomponents/libraries/xidel.exe"))) {
                cout << "Couldn't download \"XIDEL\" library! Server may be offline / No internet connection." << endl;
                cout << "Retry or manually download xidel and insert it in \"./buildcomponents/libraries/\"" << endl;
                updateStatFile("Failed", {"Can't download XIDEL"});
                error(404);
            }
        #else
            dirIntegrity("buildcomponents/bin");
            dirIntegrity("buildcomponents/bin/deb");
            exec("( cd buildcomponents/bin/deb; apt download tree )");
            exec("( cd buildcomponents/bin/deb; apt download curl )");
            exec("dpkg -x buildcomponents/bin/deb/tree*.deb buildcomponents/bin/");
            exec("dpkg -x buildcomponents/bin/deb/curl*.deb buildcomponents/bin/");
            if ((!serveronline && !fs::exists("buildcomponents/libraries/xidel")) || (serveronline && !download("https://res."+server+"/libraries/xidel-linux", "buildcomponents/libraries/xidel"))) {
                cout << "Couldn't download \"XIDEL\" library! Server may be offline / No internet connection." << endl;
                cout << "Retry or manually download xidel and insert it in \"./buildcomponents/libraries/\"" << endl;
                updateStatFile("Failed", {"Can't download XIDEL"});
                error(404);
            } else {
                system("chmod +x buildcomponents/libraries/xidel");
            }
        #endif

        //* Download base files
        updateStatFile("Preparing", {"Downloading base files"});
        cout << "Downloading / Updating pack base files..." << endl;
        if (serveronline) {
            download("https://res."+server+"/ExoPack/"+customversion+"BuildingComponents.zip", "buildcomponents/basepack/sdbase.zip");
            download("https://res."+server+"/ExoPack/"+customversion+"PackStructure.zip", "buildcomponents/basepack/structure.zip");
            download("https://res."+server+"/ExoPack/"+customversion+"IconsBG.zip", "buildcomponents/basepack/bootloader.zip");
            download("https://res."+server+"/ExoPack/"+customversion+"ExoPack.txt", "buildcomponents/basepack/ExoPack-Version.txt");
            download("https://res."+server+"/ExoPack/"+customversion+"RepoExtraFiles.txt", "buildcomponents/data/component_remove.txt");
        }
        if (!fs::exists("buildcomponents/data/component_remove.txt")) writeFile("buildcomponents/data/component_remove.txt", "$dir\nwiiu\nswitch/DBI_ru\nswitch/DBI_ptbr\n$file\njoin_15_2GBparts_linux_macosx.sh\njoin_15_2GBparts_windows.bat\njoin_30_1GBparts_linux_macosx.sh\njoin_30_1GBparts_windows.bat\nswitch/Breeze.nro\nhb_list.txt");
        if (!fs::exists("buildcomponents/basepack/sdbase.zip") || !fs::exists("buildcomponents/basepack/structure.zip") || !fs::exists("buildcomponents/basepack/bootloader.zip")) {
            cout << "Couldn't download base pack files! Server may be offline / No internet connection." << endl;
            cout << "Please retry later. After a successful run, this error won't show up anymore (Unless the files get deleted)." << endl;
            updateStatFile("Failed", {"Can't find base pack files"});
            error(404);
        }
        if (fs::exists("buildcomponents/basepack/ExoPack-Version.txt")) {
            string tmptestver = readFile("buildcomponents/basepack/ExoPack-Version.txt");
            tmptestver = tmptestver.substr(0, tmptestver.find("\n"));
            if (tmptestver.find("Pack Extended Version: ") != tmptestver.npos) {
                replace(tmptestver, "Pack Extended Version: ", "");
                #ifdef _WIN32
                #else
                    tmptestver.erase(tmptestver.find_last_not_of(" \n\r\t")+1);
                #endif
                testver = atoi(tmptestver.c_str());
            }
        }
    }

    if (continueFromSection == "run" || continueFromSection == "updateinfo") {
        if (continueFromSection == "updateinfo" && continueFromProgress > 0 && buildver == 0 && fs::exists("buildcomponents/build.ver")) buildver = stoi(readFile(fixpath("buildcomponents/build.ver")));
        continueFromSection = "run";
        //* Download info files
        updateStatFile("Preparing", {"Updating info files"});
        if (!oldassets) {
            cout << "Downloading / Updating info files..." << endl;
            if (serveronline) download("https://res."+server+"/ExoPack/"+customversion+"hb_list.txt", "buildcomponents/data/component_list.txt");
            if (!fs::exists("buildcomponents/data/component_list.txt") && !fs::exists("buildcomponents/data/component_assets.txt")) {
                cout << "Couldn't download component list, or load asset list! Server may be offline / No internet connection." << endl;
                cout << "Please retry later. After a successful run, this error won't show up anymore (Unless the files get deleted)." << endl;
                updateStatFile("Failed", {"Component list & asset list missing"});
                error(404);
            } else if (fs::exists("buildcomponents/data/component_list.txt")) writeFile("buildcomponents/data/component_assets.txt", genAssetFile((downloadnxfw?" | https://github.com/THZoria/NX_Firmware/releases/latest\n":"")+readFile("buildcomponents/data/component_list.txt"), customversion));
        } else {
            cout << "User request: Using old asset-info files." << endl;
            if (!fs::exists("buildcomponents/data/component_assets.txt")) {
                cout << "Can't use old assets, since none were found!" << endl;
                updateStatFile("Failed", {"Asset list missing & user override"});
                error(404);
            }
        }
    }
    if (buildver == 0 && fs::exists("buildcomponents/build.ver")) buildver = stoi(readFile(fixpath("buildcomponents/build.ver")));

    if (continueFromSection == "run") {
        //* Program is ready!
        clear();
        updateStatFile("Ready", {"Program Ready", "Updated"});
        cout << "The program is set up and ready to run!" << endl;
        if (prepareonly) {
            updateStatFile("Success", {"Program Updated & user override"});
            exit(0);
        }
        if (!directbuild) {
            cout << "Do you want to create an ExoPack right now? [Y / N] ";
            string createprompt = "*";
            bool firstInput = false;
            while ((createprompt != "Y" && createprompt != "y" && createprompt != "N" && createprompt != "n")) {
                if (createprompt != "*" || firstInput) {
                    clear();
                    cout << "Please choose a valid option!" << endl;
                    cout << "The program is set up and ready to run!" << endl;
                    cout << "Do you want to create an ExoPack right now? [Y / N] ";
                } else {firstInput = true;}
                getline(cin, createprompt);
                cout << endl;
                if (createprompt == "N" || createprompt == "n") {
                    updateStatFile("Success", {"Program Updated & user override"});
                    exit(0);
                }
            }
        }
    }

    if (continueFromSection == "run" || continueFromSection == "cleanworkdir") {
        continueFromSection = "run";
        //* Clear leftover files
        updateStatFile("Working", {"Cleaning workdir files"});
        if (skipdownload) {cout << "Clearing the work directory..." << endl;}
        else {
            cout << "Clearing the assets folder..." << endl;
            fs::remove_all("buildcomponents/content");
        }
        fs::remove_all("buildcomponents/workdir");
    }

    if (continueFromSection == "run" || continueFromSection == "downloadassets") {
        continueFromSection = "run";
        //* Download assets
        updateStatFile("Working", {"Downloading assets"});
        if (skipdownload && !multibuild) {
            cout << "User request: Skipped asset download." << endl;
            if (fs::exists("buildcomponents/data/component_assets.txt")) {
                string filetype = "uncategorized";
                vector FileLines = split(readFile("buildcomponents/data/component_assets.txt"), "\n");
                for (int i = 0;i < FileLines.size();i++) {
                    string line = FileLines[i];
                    if (line.substr(0, 1) == "$") {
                        filetype = line.substr(1, line.size());
                        dirIntegrity("buildcomponents/content/"+filetype);
                    } else if (line.size() > 0) {
                        string filename = line.substr(line.find_last_of("/\\") + 1);
                        string fileext = line.substr(line.find_last_of(".") + 1);
                        if (!fs::exists("buildcomponents/content/"+filetype+"/"+filename) && (fileext == "zip" || fileext == "nro" || fileext == "bin" || fileext == "ovl")) cout << "Missing " << filetype << " component file! - " << filename << endl;
                    }
                }
            }
        } else {
            cout << "Downloading all assets... (This may take a while)" << endl;
            string filetype = "uncategorized";
            vector FileLines = split(readFile("buildcomponents/data/component_assets.txt"), "\n");
            for (int i = 0;i < FileLines.size();i++) {
                string line = FileLines[i];
                if ((continueFromSection2 == "downloadassets") && i < continueFromProgress) {
                    if (line.substr(0, 1) == "$") {
                        filetype = line.substr(1, line.size());
                        dirIntegrity("buildcomponents/content/"+filetype);
                    }
                    continue;
                }
                string progress = to_string(i+1)+"/"+to_string(FileLines.size());
                updateStatFile("Working", {"Downloading assets", progress});
                if (line.substr(0, 1) == "$") {
                    filetype = line.substr(1, line.size());
                    dirIntegrity("buildcomponents/content/"+filetype);
                } else if (line.size() > 0) {
                    if (filetype == "extra") {
                        if (promptextrafiles && !downloadextrafiles) {
                            promptextrafiles = false;
                            string promptextrafilesout = "";
                            cout << "Extra files found, download them? [Y / *Any] " << endl;
                            getline(cin, promptextrafilesout);
                            cout << endl;
                            if (promptextrafilesout == "Y" || promptextrafilesout == "y") downloadextrafiles = true;
                        } else if (promptextrafiles) promptextrafiles = false;
                        if (!downloadextrafiles) continue;
                    }
                    string filename = line.substr(line.find_last_of("/\\") + 1);
                    #ifdef _WIN32
                    #else
                        line.erase(line.find_last_not_of(" \n\r\t")+1);
                        filetype.erase(filetype.find_last_not_of(" \n\r\t")+1);
                        filename.erase(filename.find_last_not_of(" \n\r\t")+1);
                    #endif
                    string lineext = line.substr(line.find_last_of(".") + 1);
                    if (fs::exists(fixpath("buildcomponents/content/"+filetype+"/"+filename))) fs::remove(fixpath("buildcomponents/content/"+filetype+"/"+filename));
                    dirIntegrity(fixpath("buildcomponents/content/"+filetype+""));
                    if (lineext == "zip" || lineext == "nro" || lineext == "ovl" || lineext == "bin")
                    if (!download(line, fixpath("buildcomponents/content/"+filetype+"/"+filename), "")) {
                        cout << "Failed to download "+filetype+" file - \"" + filename + "\"!" << endl;
                        if (filetype == "core") {
                            updateStatFile("Failed", {"Failed downloading core file", progress, filename});
                            error(404);
                        }
                    }
                }
            }
        }
        if (downloadonly) {
            cout << "Exiting program per user request..." << endl;
            updateStatFile("Success", {"Downloaded assets & user override"});
            exit(0);
        }
    }

    string sdpath = "buildcomponents/workdir/ExoPack/sd/";
    string sdpathfw = multibuild ? "buildcomponents/workdir/ExoPack-FW/sd/" : sdpath;
    string sdpathex = multibuild ? "buildcomponents/workdir/ExoPack-EX/sd/" : sdpath;
    if (continueFromSection == "run" || continueFromSection == "preparebasepack") {
        continueFromSection = "run";
        //* Extract pack structure
        updateStatFile("Working", {"Extracting base pack"});
        cout << "Extracting base pack..." << endl;
        if (multibuild) {
            unzip("buildcomponents/basepack/structure.zip", "buildcomponents/workdir/");
            fs::rename("buildcomponents/workdir/ExoPack", "buildcomponents/workdir/ExoPack-FW");
            unzip("buildcomponents/basepack/structure.zip", "buildcomponents/workdir/");
            fs::rename("buildcomponents/workdir/ExoPack", "buildcomponents/workdir/ExoPack-EX");
        }
        unzip("buildcomponents/basepack/structure.zip", "buildcomponents/workdir/");
        vector FileListExoPack = split(listFiles(fixpath("buildcomponents/workdir/ExoPack/")), "\n");
        for (int i = 0;i < FileListExoPack.size();i++) {
            string filepath = FileListExoPack[i];
            if (filepath == "." || filepath == "..") continue;
            if (filepath.substr(0,1)=="'") filepath = filepath.substr(1, filepath.size() - 1);
            if (filepath.substr(0, 6) == "Switch") {
                sdpath = "buildcomponents/workdir/ExoPack/"+filepath+"/";
                sdpathfw = multibuild ? "buildcomponents/workdir/ExoPack-FW/"+filepath+"/" : sdpath;
                sdpathex = multibuild ? "buildcomponents/workdir/ExoPack-EX/"+filepath+"/" : sdpath;
                break;
            }
        }
        dirIntegrity(sdpath);
        if (fs::exists("buildcomponents/basepack/ExoPack-Version.txt")) {
            fs::copy_file("buildcomponents/basepack/ExoPack-Version.txt", "buildcomponents/workdir/ExoPack/ExoPack-Version.txt");
            writeFile("buildcomponents/workdir/ExoPack/ExoPack-Version.txt", readFile("buildcomponents/workdir/ExoPack/ExoPack-Version.txt")+stringNumConcat("\nBuild Version: ", buildver));
            if (multibuild) {
                writeFile("buildcomponents/workdir/ExoPack/ExoPack-Version.txt", readFile("buildcomponents/workdir/ExoPack-EX/ExoPack-Version.txt")+stringNumConcat("\nBuild Version: ", buildverex));
                writeFile("buildcomponents/workdir/ExoPack/ExoPack-Version.txt", readFile("buildcomponents/workdir/ExoPack-FW/ExoPack-Version.txt")+stringNumConcat("\nBuild Version: ", buildverfw));
            }
        }
        unzip("buildcomponents/basepack/sdbase.zip", sdpath);
        unzip("buildcomponents/basepack/bootloader.zip", sdpath);
    } else {
        vector FileListExoPack = split(listFiles(fixpath("buildcomponents/workdir/ExoPack/")), "\n");
        for (int i = 0;i < FileListExoPack.size();i++) {
            string filepath = FileListExoPack[i];
            if (filepath == "." || filepath == "..") continue;
            if (filepath.substr(0,1)=="'") filepath = filepath.substr(1, filepath.size() - 1);
            if (filepath.substr(0, 6) == "Switch") {
                sdpath = "buildcomponents/workdir/ExoPack/"+filepath+"/";
                sdpathfw = multibuild ? "buildcomponents/workdir/ExoPack-FW/"+filepath+"/" : sdpath;
                sdpathex = multibuild ? "buildcomponents/workdir/ExoPack-EX/"+filepath+"/" : sdpath;
                break;
            }
        }
    }

    if (continueFromSection == "run" || continueFromSection == "buildpack") {
        continueFromSection = "run";
        //* Extract components
        updateStatFile("Working", {"Extracting components"});
        cout << "Extracting pack files..." << endl;
        vector FileListComponents = split(listFiles(fixpath("buildcomponents/content/"), true), "\n");
        dirIntegrity(sdpath+"switch");
        if (multibuild) dirIntegrity(sdpathex+"switch");
        for (int i = ((continueFromSection2 == "buildpack") ? continueFromProgress : 0);i < FileListComponents.size();i++) {
            string progress = to_string(i+1)+"/"+to_string(FileListComponents.size());
            updateStatFile("Working", {"Extracting components", progress});
            string componentpath = fixpath(FileListComponents[i], true, true); 
            string filename = componentpath.substr(componentpath.find_last_of("/\\") + 1);
            string fileplainname = filename.substr(0, filename.find_last_of("."));
            string fileext = componentpath.substr(componentpath.find_last_of(".") + 1);
            string componenttype = componentpath;
            replace(componenttype, "buildcomponents/content/", "");
            replace(componenttype, "/"+filename, "");
            #ifdef _WIN32
            #else
                componenttype.erase(componenttype.find_last_not_of(" \n\r\t")+1);
            #endif
            if (componenttype == "extra") {
                if (promptextrafiles && !downloadextrafiles) {
                    promptextrafiles = false;
                    string promptextrafilesout = "";
                    cout << "Extra files found, extract them? [Y / *Any] " << endl;
                    getline(cin, promptextrafilesout);
                    cout << endl;
                    if (promptextrafilesout == "Y" || promptextrafilesout == "y") downloadextrafiles = true;
                } else if (promptextrafiles) promptextrafiles = false;
                if (!downloadextrafiles) continue;
            }
            if (fileext == "zip") {
                if (fileplainname.substr(0, 9) == "Firmware.") {
                    dirIntegrity(fixpath(sdpathfw+"Firmware"));
                    dirIntegrity(fixpath(sdpathfw+"Firmware/"+fileplainname.substr(9)));
                    unzip(componentpath, fixpath(sdpathfw+"Firmware/"+fileplainname.substr(9)));
                } else unzip(componentpath, ((componenttype == "extra" && multibuild) ? sdpathex : sdpath));
            } else if (fileext == "nro") {
                dirIntegrity(((componenttype == "extra" && multibuild) ? sdpathex : sdpath)+"switch/"+fileplainname);
                fs::copy(componentpath, ((componenttype == "extra" && multibuild) ? sdpathex : sdpath)+"switch/"+fileplainname+"/"+filename);
            } else if (fileext == "ovl") {
                dirIntegrity(((componenttype == "extra" && multibuild) ? sdpathex : sdpath)+"switch/.overlays");
                fs::copy(componentpath, ((componenttype == "extra" && multibuild) ? sdpathex : sdpath)+"switch/.overlays/"+filename);
            } else if (fileext == "bin") {
                fs::copy(componentpath, ((componenttype == "extra" && multibuild) ? "buildcomponents/workdir/ExoPack-EX/Payloads/" : "buildcomponents/workdir/ExoPack/Payloads/")+filename);
            } else if (filename.size()>0&&!fs::is_directory(componentpath)) {
                cout << "Unrecognized file found: \""+filename+"\", deleting..." << endl;
                fs::remove(componentpath);
            }
        }
        copyFile(fixpath(sdpath+"guides/*"), "buildcomponents/workdir/ExoPack/Guides/", true, true);
        fs::remove_all(sdpath+"guides/");
        fs::remove("buildcomponents/workdir/ExoPack/HB Utilizzati.txt");
        fs::copy_file("buildcomponents/data/component_list.txt", "buildcomponents/workdir/ExoPack/HB Utilizzati.txt");
        if (multibuild) {
            fs::remove_all(sdpathex+"guides/");
            fs::remove("buildcomponents/workdir/ExoPack-EX/HB Utilizzati.txt");
            fs::remove_all(sdpathfw+"guides/");
            fs::remove("buildcomponents/workdir/ExoPack-FW/HB Utilizzati.txt");
        }
    }

    if (continueFromSection == "run" || continueFromSection == "cleanextrafiles") {
        continueFromSection = "run";
        //* Clean extra zip file contents
        updateStatFile("Working", {"Cleaning zip files"});
        cout << "Cleaning extra files..." << endl;
        string cleantype = "";
        vector removeList = split(readFile("buildcomponents/data/component_remove.txt"), "\n");
        for (int i = 0;i < removeList.size();i++) {
            if (removeList[i] == "") continue;
            if (removeList[i].substr(0, 1) == "$") {
                cleantype = removeList[i].substr(1);
            } else {
                #ifdef _WIN32
                    if (fs::exists(sdpath+removeList[i])) {
                        if (cleantype == "dir") {fs::remove_all(fixpath(sdpath+removeList[i]));}
                        else fs::remove(fixpath(sdpath+removeList[i]));
                    }
                #else
                    string delpath = fixpath(sdpath+removeList[i]);
                    delpath.erase(delpath.find_last_not_of(" \n\r\t")+1);
                    string command = "";
                    command = "rm -rf \""+delpath+"\"";
                    system(command.c_str());
                #endif
            }
        }
    }

    if (continueFromSection == "run" || continueFromSection == "pathfix") {
        continueFromSection = "run";
        //* Fix payloads
        updateStatFile("Working", {"Fixing locations"});
        cout << "Fixing file locations..." << endl;
        copyFile(sdpath+"/bootloader/payloads/*", "buildcomponents/workdir/ExoPack/Payloads/", true);
        copyFile("buildcomponents/workdir/ExoPack/Payloads/*", sdpath+"/bootloader/payloads/", true);
        if (downloadextrafiles) {
            dirIntegrity(fixpath(sdpath+"/config"));
            writeFile(sdpath+"/config/hasextrafiles", "1");
        }
        
        vector SDFileList = split(listFiles(sdpath), "\n");
        for (int i = 0;i < SDFileList.size();i++) {
            string componentpath = SDFileList[i];
            if (componentpath == "") continue;
            string fileext = componentpath.substr(componentpath.find_last_of(".") + 1);
            if (fileext == "bin") copyFile(sdpath+componentpath, "buildcomponents/workdir/ExoPack/Payloads/", true);
        }
        vector PayloadList = split(listFiles("buildcomponents/workdir/ExoPack/Payloads/"), "\n");
        for (int i = 0;i < PayloadList.size();i++) {
            if (PayloadList[i] == "") continue;
            if (PayloadList[i].substr(0, 6) == "hekate") copyFile("buildcomponents/workdir/ExoPack/Payloads/"+PayloadList[i], sdpath+"payload.bin", true);
        }
    }

    if (continueFromSection == "run" || continueFromSection == "postclean") {
        continueFromSection = "run";
        //* Cleanup
        updateStatFile("Working", {"Cleaning files"});
        cout << "Cleaning up leftover files..." << endl;
        if (!keepassets) {
            fs::remove_all("buildcomponents/content");
            dirIntegrity();
        }
        if (outdir == "out" && fs::exists("out") && fs::is_directory("out")) fs::remove_all("out");
        dirIntegrity(fixpath(outdir));
    }

    if (continueFromSection2 == "run" || continueFromSection == "writesigfiles") {
        continueFromSection = "run";
        //* Write Signature Files
        updateStatFile("Working", {"Writing signature files"});
        cout << "Writing signature files..." << endl;
        vector folders = split(listFiles(fixpath("buildcomponents/workdir/")), "\n");
        for (int i = 0;i < folders.size();i++) {
            string folder = folders[i];
            if (folder.size() < 6) continue;
            int sig = directoryChecksum("buildcomponents/workdir/" + folder);
            writeFile("buildcomponents/workdir/" + folder + ".sig", to_string(sig));
        }
    }

    if (continueFromSection == "run" || continueFromSection == "movepack") {
        continueFromSection = "run";
        //* Move the pack
        updateStatFile("Working", {"Moving the pack"});
        cout << "Moving the pack to output directory..." << endl;
        fs::rename("buildcomponents/workdir/ExoPack", outdir+"/ExoPack");
        if (writesigfiles) fs::rename("buildcomponents/workdir/ExoPack.sig", outdir+"/ExoPack.sig");
        if (multibuild) {
            if (writesigfiles) {
                fs::rename("buildcomponents/workdir/ExoPack-EX.sig", outdir+"/ExoPack-EX.sig");
                fs::rename("buildcomponents/workdir/ExoPack-FW.sig", outdir+"/ExoPack-FW.sig");
            }
            fs::rename("buildcomponents/workdir/ExoPack-EX", outdir+"/ExoPack-EX");
            fs::rename("buildcomponents/workdir/ExoPack-FW", outdir+"/ExoPack-FW");
        }
    }

    if (continueFromSection == "run" || continueFromSection == "compress") {
        continueFromSection = "run";
        //* Compress the pack
        if (packup) {
            updateStatFile("Working", {"Compressing the pack"});
            cout << "Packing up..." << endl;
            system(("cd \""+outdir+"\" && tar --exclude=ExoPack.tar -cf \"ExoPack.tar\" \"*\"").c_str());
            if (clearfiles) fs::remove_all(outdir+"/ExoPack");
            if (clearfiles && multibuild) {
                fs::remove_all(outdir+"/ExoPack-FW");
                fs::remove_all(outdir+"/ExoPack-EX");
            }
        }
    }

    //* Done!
    clear();
    updateStatFile("Success", {"Built successfully"});
    cout << "Done!" << endl;
    cout << "ExoPack built successfully!" << endl;
    cout << "Output directory is \""+outdir+"\"." << endl;
    if (fs::exists("buildcomponents/build.ver") && buildver > stoi(readFile(fixpath("buildcomponents/build.ver")))) cout << "One or more components have been updated and old packs are now outdated." << endl;
    if (buildver > testver) cout << "Careful! This pack has untested components, and may be unstable." << endl;
    if (buildver != 0) writeFile(fixpath("buildcomponents/build.ver"), to_string(buildver));
    if (!exitimmediately) {
        #ifdef _WIN32
            cout << "Press any key to exit." << endl;
        #else
            cout << "Press enter to exit." << endl;
        #endif
        pause();
    }
}