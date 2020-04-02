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
        const folderFiels = fs.readdirSync(folder); 
        for (const file of folderFiels) {
            const name = file.replace(".json","");
            if(!flagsJson[name]){ 
                const fileName = path.join(flagsFolder,`${name.replace(/ /g,'-')}.png`);
                if(fs.existsSync(fileName)){
                    flagsJson[name] = fileName;     
                } else{
                    flagsJson[name] = path.join(flagsFolder ,"Update.png");
                }
            }           
        }
        return flagsJson;
    }

    specialCases(flagsJson){
        const currentFolder = this.rootFolder;
        const flagsFolder = path.join(currentFolder,"Flags");
        flagsJson["US"] = flagsJson["USA"];
        flagsJson["UAE"] = flagsJson["United Arab Emirates"];
        flagsJson["Mainland China"] = flagsJson["China"];
        flagsJson["China Mainland "] = flagsJson["China"];
        flagsJson["China (mainland)"] = flagsJson["China"];
        flagsJson["Czechia"] = flagsJson["Czech Republic"];
        flagsJson["Afeganistão"] = flagsJson["Afghanistan"];
        flagsJson["Albânia"] = flagsJson["Albania"];
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
        flagsJson["DR Congo"] = flagsJson["DRC"];
        flagsJson["Congo (DRC)"] = flagsJson["DRC"];
        flagsJson["Cabo Verde"] =  path.join(flagsFolder,"Cape-Verde.png");
        flagsJson["Congo (Kinshasa)"] =  flagsJson["DRC"];
        flagsJson["Korea, South"] =  flagsJson["South Korea"];
        flagsJson["Ivory Coast"] =  flagsJson["Cote d'Ivoire"];
        flagsJson["Côte d’Ivoire"] = flagsJson["Cote d'Ivoire"];
        flagsJson["Curaçao"] = path.join(flagsFolder,"Curacao.png");
        flagsJson["United States"] =  flagsJson["USA"];
        flagsJson["Palestinian Authority"] =  path.join(flagsFolder,"Palestine.png");
        flagsJson["Saint Barthélemy"] = path.join(flagsFolder,"Saint-Barthelemy.png");
        flagsJson["Timor-Leste"] = path.join(flagsFolder,"East-Timor.png");
        flagsJson["U.S. Virgin Islands"] = path.join(flagsFolder,"United-States-Virgin-Islands.png");
        flagsJson["CAR"] =   flagsJson["Central African Republic"];
        flagsJson["Caribbean Netherlands"] = flagsJson["Netherlands"];
        flagsJson["St. Vincent Grenadines"] = flagsJson["Saint Vincent and the Grenadines"];
        flagsJson["Turks and Caicos"] = flagsJson["Turks and Caicos Islands"];
        return flagsJson;
    };
    async creatFlagJson(){
        const currentFolder = this.rootFolder;
        const sourceFolder = path.join(currentFolder,"Downloads","Source");
        let flagsJson = {};
        flagsJson =  this.addCountryToFlag(path.join(sourceFolder,"1"),flagsJson);
        flagsJson =  this.addCountryToFlag(path.join(sourceFolder,"2"),flagsJson);;
        flagsJson = this.specialCases(flagsJson);
        const flagsKeys = Object.keys(flagsJson);
        const whiteList =["Total","Channel Islands","Diamond Princess","MS Zaandam"];
        for (const country of flagsKeys) {
            const flagFile = flagsJson[country];
            if((flagFile)&&(whiteList.indexOf(country)==-1)){
                if( flagFile.indexOf("Update") >= 0 ){
                    Utils.log(`Warming: Flag of ${country} not found`,`warn`);    
                }            
            }
        }
        const jsonLocation = path.join(currentFolder,"flags.json");
        Utils.saveFile(flagsJson,jsonLocation);
        Utils.log(`Flags Json updated.`);
    }
}
module.exports = Flags;