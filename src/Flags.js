const fs = require("fs-extra");
const path = require("path");
const Utils = require("./Utils.js");
class Flags {
    constructor(projectFolder){
        this.rootFolder = projectFolder;
    }
    addCountryToFlag(folder,flagsJson){
        const currentFolder = this.rootFolder;
        const flagsFolder = path.join(currentFolder,"Flags");
        fs.readdirSync(folder).forEach(file => {
            const name =file.replace(".json","");
            if(!flagsJson[name]){ 
                const fileName = path.join(flagsFolder,`${name.replace(/ /g,'-')}.png`);
                if(fs.existsSync(fileName)){
                    flagsJson[name] = fileName;     
                } else{
                    flagsJson[name] = path.join(flagsFolder ,"Update.png");
                }
            }
        });
        return flagsJson;
    }

    specialCases(flagsJson){
        const currentFolder = this.rootFolder;
        const flagsFolder = path.join(currentFolder,"Flags");
        flagsJson["US"] = flagsJson["USA"];
        flagsJson["UAE"] = flagsJson["United Arab Emirates"];
        flagsJson["Mainland China"] = flagsJson["China"];
        flagsJson["Czechia"] = flagsJson["Czech Republic"];
        flagsJson["North Macedonia"] = path.join(flagsFolder,"Macedonia.png");
        flagsJson["Republic of Ireland"] = flagsJson["Ireland"];
        flagsJson["Faeroe Islands"] = flagsJson["Faroe Islands"];
        flagsJson["Macao"] = flagsJson["Macau"];
        flagsJson["S. Korea"] = flagsJson["South Korea"];
        flagsJson["St. Barth"] = flagsJson["Saint Barthelemy"];
        flagsJson["St. Martin"] = flagsJson["Saint Martin"];
        flagsJson["Iran (Islamic Republic of)"] = flagsJson["Iran"];
        flagsJson["Holy See"] = flagsJson["Vatican City"];
        flagsJson["Hong Kong SAR"] = flagsJson["Hong Kong"];
        flagsJson["Macao SAR"] = flagsJson["Macau"];
        flagsJson["occupied Palestinian territory"] = flagsJson["Palestine"];
        flagsJson["Republic of Korea"] = flagsJson["South Korea"];
        flagsJson["Republic of Moldova"] = path.join(flagsFolder,"Moldova.png");
        flagsJson["Russian Federation"] =  flagsJson["Russia"];
        flagsJson["Viet Nam"] =  flagsJson["Vietnam"];
        flagsJson["United Kingdom"] =  flagsJson["UK"];
        flagsJson["Reunion"] =  flagsJson["France"];
        flagsJson["Cote d'Ivoire"] =  path.join(flagsFolder,"Cote-d-Ivoire.png");
        flagsJson["DRC"] = path.join(flagsFolder,"Democratic-Republic-of-the-Congo.png");
        flagsJson["Congo (Kinshasa)"] =  flagsJson["DRC"];
        flagsJson["Korea, South"] =  flagsJson["South Korea"];
        flagsJson["Ivory Coast"] =  flagsJson["Cote d'Ivoire"];
        flagsJson["United States"] =  flagsJson["USA"];

        return flagsJson;
    };
    creatFlagJson(){
        const currentFolder = this.rootFolder;
        const sourceFolder = path.join(currentFolder,"Downloads","Source");
        let flagsJson = {};
        flagsJson =  this.addCountryToFlag(path.join(sourceFolder,"1"),flagsJson);
        flagsJson =  this.addCountryToFlag(path.join(sourceFolder,"2"),flagsJson);
        flagsJson = this.specialCases(flagsJson);
        const flagsKeys = Object.keys(flagsJson);
        flagsKeys.map(country => {
            const flagFile = flagsJson[country];
            if( flagFile.indexOf("Update") >= 0 ){
                Utils.log(`Warming: Flag of ${country} not found`,`warn`);          
            }
        });
        const jsonLocation = path.join(currentFolder,"flags.json");
        Utils.saveFile(flagsJson,jsonLocation);
        Utils.log(`Flags Json updated.`);
    }
}
module.exports = Flags;