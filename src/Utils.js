const fs  = require("fs-extra");
const path = require("path");
class Utils {
    static log(msg, type = 'log',debugMode){
        if( (type!="debug") || ( (type!="debug")&&(debugMode) ) ){
            const timestamp =  new Date().toLocaleString("pt-BR");
            const loggerFunction = console[type];
            loggerFunction(`[${timestamp}]`,msg);
            if(type =="error"){
                process.exit(0);
            }
        }
    }

    static saveFile(jsonFile, fileName, noLog){
        fs.outputJsonSync(fileName, jsonFile, {
            spaces: "\t"
        })
        if(!noLog){
            this.log(`File ${fileName} saved.`);
        }
    }

    static checkAndCreateFolder(fileFolder){
        if (!fs.existsSync(fileFolder)) {
            fs.mkdirSync(fileFolder, {
                recursive: true
            });
        }
        return true;
    }
    static openJson(fileName){
        if (fs.existsSync(fileName)) {
            const rawdata = fs.readFileSync(fileName);
            const json = JSON.parse(rawdata);
            return json;
        }
        return undefined;
    }
}

module.exports = Utils;