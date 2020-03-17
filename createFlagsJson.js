const fs = require("fs-extra");
const path = require("path");
const log = (msg, type = 'log') => {
    const timestamp =  new Date().toLocaleString("pt-BR");
    const loggerFunction = console[type];
    loggerFunction(`[${timestamp}] ${msg}`);
}
const addCountryToFlag =  (folder,flagsJson) =>{
    const currentFolder = __dirname;
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
};
const specialCases = (flagsJson) =>{
    const currentFolder = __dirname;
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
    return flagsJson;
};
const creatFlagJson = () =>{
    const currentFolder = __dirname;
    const sourceFolder = path.join(currentFolder,"Downloads","Source");
    let folder = path.join(sourceFolder,"1");
    let flagsJson = {};
    flagsJson =  addCountryToFlag(path.join(sourceFolder,"1"),flagsJson);
    flagsJson =  addCountryToFlag(path.join(sourceFolder,"2"),flagsJson);
    flagsJson = specialCases(flagsJson);
    const flagsKeys = Object.keys(flagsJson);
    flagsKeys.map(country => {
        const flagFile = flagsJson[country];
        if( flagFile.indexOf("Update") >= 0 ){
            log(`Warming: Flag of ${country} not found`,`warn`);          
        }
    });
    const jsonLocation = path.join(currentFolder,"flags.json");
    fs.outputJsonSync(jsonLocation, flagsJson, { spaces: "\t" });
    log(`File ${jsonLocation} saved.`);
    log(`Flags Json updated.`);
};

module.exports = creatFlagJson;