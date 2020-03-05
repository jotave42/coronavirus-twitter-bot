const path = require("path");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const Twit = require("twit");
const tokens  = require("./tokens.json");

const Tweet =  (bot,jsonFile) =>{
    const tweet = `Coronavirus Update \n`
                + `Country_Region: ${jsonFile.Country_Region}\n`
                + `Confirmed: ${jsonFile.Confirmed}\n`
                + `Deaths: ${jsonFile.Deaths}\n`
                + `Recovered: ${jsonFile.Deaths}\n`
                + `The data comes from: tinyurl.com/uwns6z5\n`
                + `#Coronvirus #COVID19 #bot`  
    bot.post('statuses/update', { status: tweet }, (err, data, response) => {
            if(!err){
                console.log("Tweet success");
            } else {
                console.log(err.message);
                if(err.message ==="Status is a duplicate."){
                    console.log("ignored");
                    return;
                }
                console.log("Tweet faild trying again");
                Tweet(bot,jsonFile);
            }
      });
};

const saveFile =  (jsonFile, fileName) => {
    fs.writeFileSync(fileName,JSON.stringify(jsonFile,null,4));
    console.log(`File ${fileName} saved.`);
};

const downloadFiles  = async () =>{
    console.log("Starting Download..")
    const bot = new Twit({
        consumer_key: tokens.APIKey,
        consumer_secret: tokens.APISecretKey,
        access_token: tokens.AccessToken,
        access_token_secret: tokens.AccessTokenSecret,
        timeout_ms:  60*1000
    });
    const urlRequest =`https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/ncov_cases/FeatureServer/2/query?f=json&where=Confirmed%20%3E%200&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&orderByFields=Confirmed%20desc&resultOffset=0&resultRecordCount=200&cacheHint=true` 
    const currentFolder = __dirname;	
    const fileFolder = path.join(currentFolder,"Downloads");
    if (!fs.existsSync(fileFolder)){
        
        fs.mkdirSync(fileFolder,{recursive: true});
    }
    return fetch(urlRequest).then( async (res)=>{
        const data = await res.json();
        data.features.forEach((element) => {
            const node = element.attributes;
            const {Country_Region,Confirmed,Deaths,Recovered} = node;
            const fileName = path.join(fileFolder,Country_Region+".json")
            const newJson = {
                Country_Region,
                Confirmed,
                Deaths,
                Recovered
            };
            if(fs.existsSync(fileName)){
                const oldJson = require(fileName);
                if( (newJson.Confirmed === oldJson.Confirmed) && (newJson.Deaths === oldJson.Deaths) && (newJson.Recovered === oldJson.Recovered) ){
                    console.log("Any change at: ",newJson.Country_Region);
                } else {
                    console.log("Change at: ",newJson.Country_Region);
                    saveFile(newJson, fileName);
                    Tweet(bot,newJson);

                }
            } else {
                saveFile(newJson, fileName);
                Tweet(bot,newJson);
            }
         
        });
    }).catch( (err) =>{
        console.log(err);
    });
}
downloadFiles();
setInterval(downloadFiles, 5*60*1000);

