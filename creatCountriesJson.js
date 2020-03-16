const fs = require("fs-extra");
const path = require("path");
const log = (msg, type = 'log') => {
    const timestamp =  new Date().toLocaleString("pt-BR");
    const loggerFunction = console[type];
    loggerFunction(`[${timestamp}] ${msg}`);
}
const addCountriesToJson =  (countriesJson) =>{
    const currentFolder = __dirname;
    const folder = path.join(currentFolder,"Flags");
    const sourceFolder1 = path.join(currentFolder,"Downloads","Source","1");
    const sourceFolder2 = path.join(currentFolder,"Downloads","Source","2");
    

    fs.readdirSync(folder).forEach(file => {
        const name = file.replace(".png","").replace(/-/ig," ");
        const nameKey = name.toLowerCase();
        if(!countriesJson[nameKey]){ 
            const countriesNumber = [];
            let fileName = path.join(sourceFolder1,`${name}.json`);
            if(fs.existsSync(fileName)){
                countriesNumber.push(fileName);     
            } 
            fileName = path.join(sourceFolder2,`${name}.json`);
            if(fs.existsSync(fileName)){
                countriesNumber.push(fileName);    
            }
            countriesJson[nameKey] =countriesNumber;
        }
    });
    return countriesJson;
};
const specialCases = (countriesJson) =>{
    const currentFolder = __dirname;
    const sourceFolder1 = path.join(currentFolder,"Downloads","Source","1");
    const sourceFolder2 = path.join(currentFolder,"Downloads","Source","2");
    countriesJson["cote d ivoire"].push(path.join(sourceFolder1,"Cote d'Ivoire.json"));
    countriesJson["czech republic"].push(path.join(sourceFolder1,"Czechia.json"));
    countriesJson["czech republic"].push(path.join(sourceFolder2,"Czechia.json"));
    const czechia =[]
    czechia.push(path.join(sourceFolder1,"Czechia.json"));
    czechia.push(path.join(sourceFolder2,"Czechia.json"));
    countriesJson["czechia"]= czechia;
    countriesJson["democratic republic of the congo"].push(path.join(sourceFolder2,"DRC.json"));
    countriesJson["faroe islands"].push(path.join(sourceFolder2,"Faeroe Islands.json"));
    countriesJson["macau"].push(path.join(sourceFolder2,"Macao.json"));
    countriesJson["réunion"].push(path.join(sourceFolder1,"Reunion.json"));
    const Reunion = [];
    Reunion.push(path.join(sourceFolder1,"Reunion.json"));
    Reunion.push(path.join(sourceFolder2,"Réunion.json"));
    countriesJson["reunion"] = Reunion;
    countriesJson["saint vincent and the grenadines"].push(path.join(sourceFolder2,"St. Vincent Grenadines.json"));
    countriesJson["south korea"].push(path.join(sourceFolder1,"Korea, South.json"));
    countriesJson["south korea"].push(path.join(sourceFolder2,"S. Korea.json"));
    countriesJson["uk"].push(path.join(sourceFolder1,"United Kingdom.json"));
    countriesJson["united kingdom"] = countriesJson["uk"];
    countriesJson["usa"].push(path.join(sourceFolder1,"US.json"));
    countriesJson["us"] = countriesJson["usa"];
    countriesJson["united states of america"] =countriesJson["us"];
    countriesJson["united states"] =countriesJson["us"];
    countriesJson["macedonia"].push(path.join(sourceFolder1,"North Macedonia.json")); 
    countriesJson["macedonia"].push(path.join(sourceFolder2,"North Macedonia.json")); 
    return countriesJson;
};
const creatCountriesJson = () =>{
    const currentFolder = __dirname; 
    let countriesJson = {};
    countriesJson =  addCountriesToJson(countriesJson);
    countriesJson = specialCases(countriesJson);
    const jsonLocation = path.join(currentFolder,"countries.json");
    fs.outputJsonSync(jsonLocation, countriesJson, { spaces: "\t" });
    log(`File ${jsonLocation} saved.`);
    log(`Countries Json updated.`)
};
module.exports = creatCountriesJson;