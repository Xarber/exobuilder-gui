const { contextBridge, ipcRenderer } = require("electron");

window.selectFolder = () => ipcRenderer.invoke('dialog:openDirectory');

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };
});