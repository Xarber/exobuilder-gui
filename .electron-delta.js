const DeltaBuilder = require("@electron-delta/builder");
const path = require("path");

const options = {
  productIconPath: path.join(__dirname, "libs/Ex0sArc4d3P1C.ico"),
  productName: "exobuilder-gui",
  getPreviousReleases: async ({ platform, target }) => {
    let data = await https.get("https://api.github.com/repos/Xarber/exobuilder-gui/releases").then(r=>r.JSON());
  
    const ext = ((process.platform && process.platform === 'win32') || (platform && platform == 'win')) ? ".exe" : ".zip";
  
    let prevReleases = data.reduce((arr, release) => {
      release.assets
        .map((d) => {
          return d.browser_download_url
        })
        .filter((d) => { return !d.includes('untagged') })
        .filter((d) => d.endsWith(ext))
        .forEach((url) => {
          // ignore web installers or delta files
          if (!url.endsWith("-delta.exe") && !url.includes("-Setup")) {
            arr.push({ version: release.tag_name, url });
          }
        });
      return arr;
    }, []);
  
    const oldreleases = prevReleases.slice(0, 3);
  
    console.log("prevReleases", oldreleases);
  
    return oldreleases;
  },
  sign: async (filePath) => {},
};

exports.default = async function (context) {
  const deltaInstallerFiles = await DeltaBuilder.build({ context, options });
  return deltaInstallerFiles;
};
