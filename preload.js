const { contextBridge, ipcRenderer } = require("electron");

window.selectFolder = () => ipcRenderer.invoke('dialog:openDirectory');
window.prompt = (text, options = {})=>{
    options.type ??= "input";
    options.textOverride ??= text;
    options.isTitleDesc ??= false;
    options.descText ??= false;
    options.confirmText ??= "Confirm";
    options.cancelText ??= "Cancel";
    options.inputPlaceholder ??= "Write text here";
    options.awaitClose ??= false;
    var {type, descText, confirmText, cancelText, inputPlaceholder, textOverride, isTitleDesc, awaitClose} = options;
    if (isTitleDesc) {
        descText = text;
        if (textOverride === text) textOverride = "Notification";
    }
    text = textOverride;
    return new Promise(async function(resolve, reject) {
        try {
            text ??= type === "confirm" ? "Confirm the action" : "Input some text...";
            var backgroundDiv = document.createElement('div');
            backgroundDiv.style = "background-color: rgba(0, 0, 0, 0.5);position: fixed;top: 0;left: 0;z-index: 999;width: 100%;height: 100%;";
            var promptDiv = document.createElement('div');
            promptDiv.style = "background-color: rgba(40, 40, 40);position: relative;top: 50%;left: 50%;transform: translate(-50%, -50%);border-radius: 5px;padding: 10px;max-width: calc(90% - 25px);max-height: calc(90% - 25px);overflow-y: auto;";
            var promptTitle = document.createElement('h1');
            promptTitle.style = "";
            promptTitle.innerText = text;
            var promptDesc = document.createElement('p');
            promptDesc.style = "margin: 10px 5px;";
            promptDesc.innerText = descText;
            var promptInput = document.createElement('input');
            promptInput.style = "color: white;border: 1px solid gray;border-radius: 5px;padding: 5px 10px;";
            promptInput.placeholder = inputPlaceholder ?? "Write text here";
            var promptActionDiv = document.createElement('div');
            promptActionDiv.style = "display: block;margin-left: auto;";
            var promptConfirm = document.createElement('button');
            promptConfirm.style = "background-color: rgba(0, 70, 170);border-radius: 5px;border: 1px solid gray;color: white;margin: 5px;";
            promptConfirm.innerText = confirmText;
            promptConfirm.addEventListener('click', ()=>{backgroundDiv.remove();resolve(type === "input" ? promptInput.value : true)});
            var promptCancel = document.createElement('button');
            promptCancel.style = "background-color: rgba(20, 20, 20);border-radius: 5px;border: 1px solid gray;color: white;margin: 5px;";
            promptCancel.innerText = cancelText;
            promptCancel.addEventListener('click', ()=>{backgroundDiv.remove();resolve(false);});
        
            promptDiv.appendChild(promptTitle);
            if (!!descText && descText.length > 0) promptDiv.appendChild(promptDesc);
            if (type == "input") promptDiv.appendChild(promptInput);
            if (cancelText !== false) promptActionDiv.appendChild(promptCancel);
            if (confirmText !== false) promptActionDiv.appendChild(promptConfirm);
            if (cancelText !== false || confirmText !== false) promptDiv.appendChild(promptActionDiv)
            backgroundDiv.appendChild(promptDiv);
            document.body.appendChild(backgroundDiv);
            if (!!awaitClose && typeof awaitClose.then === "function") {await awaitClose;promptConfirm.click();}
        }catch(e){reject(e)}
    });
};
window.alert = (text, more)=>window.prompt(text, {...more, cancelText: false, type: "confirm"});
window.confirm = (text, more)=>window.prompt(text, {...more, type: "confirm"});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };
});