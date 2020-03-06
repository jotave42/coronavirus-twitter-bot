const path = require("path");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const Twit = require("twit");

const safeRequire = () =>{
    try{
        return  require("./tokens.json");
    } catch(err){
        return {
            APIKey : process.env.APIKey,
            APISecretKey : process.env.APISecretKey,
            AccessToken : process.env.AccessToken,
            AccessTokenSecret : process.env.AccessTokenSecret
        }
    };
}
const getTrends = async (bot) =>{
    return new Promise((resolve, reject) =>{
        bot.get('trends/place', {id:'1'}, async(err, data, response)=>{
            const trends = data[0].trends.filter((elem)=>{
                if(elem.name[0] == "#" ){
                    return elem
               }
            });
            trends.splice(10);
            const trendsKeys = Object.keys(trends);
            const trendsObject = [];
            const processTrands = trendsKeys.map(elemId => {
            const element = trends[elemId];
                trand = {
                    name: element.name,
                    len: element.name.length
                }
                trendsObject.push(trand);
            });
            await Promise.all(processTrands);
            resolve(trendsObject);
        
        });
    });
};
const Tweet =  (bot,trendsJson,jsonFile,oldJson) =>{
    let tweet;
    const maxlen = 280;
    let datetimeTweet = new Date();
    let todayTweet = datetimeTweet.toLocaleString("pt-BR"); 
    if(!oldJson){
        tweet = `Coronavirus Update \n`
                    + `Country_Region: ${jsonFile.Country_Region}\n`
                    + `Confirmed: ${jsonFile.Confirmed}\n`
                    + `Deaths: ${jsonFile.Deaths}\n`
                    + `Recovered: ${jsonFile.Recovered}\n`
                    + `The data comes from: tinyurl.com/uwns6z5\n`
                    + `#Coronavirus #COVID19 #bot\n`  
    } else {
        tweet = `Coronavirus Update \n`
                    + `Country_Region: ${jsonFile.Country_Region}\n`
                    + `Confirmed: ${oldJson.Confirmed} => ${jsonFile.Confirmed}\n`
                    + `Deaths: ${oldJson.Deaths} => ${jsonFile.Deaths}\n`
                    + `Recovered: ${oldJson.Recovered} => ${jsonFile.Recovered}\n`
                    + `The data comes from: tinyurl.com/uwns6z5\n`
                    + `#Coronavirus #COVID19 #bot\n`  
    }
    let tweetLen = tweet.length; 
    if(trendsJson){
        if(trendsJson.length>0){
            for (const trend of trendsJson) {
                const newTrendLen = trend.len + 1 // + 1  in order to add a space 
                const newLen = tweetLen + newTrendLen;
                if(newLen < maxlen){
                    tweet += trend.name + " ";
                    tweetLen = newLen;
                }
            }
        }
    }

    bot.post('statuses/update', { status: tweet }, (err, data, response) => {
        if(!err){
                console.log(`[${todayTweet}] Tweet success`);
            } else {
                console.log(err.message);
                if(err.message ==="Status is a duplicate."){
                    console.log(`[${todayTweet}] ignored`);
                    return;
                }
                console.log(`[${todayTweet}] Tweet faild trying again`);
                Tweet(bot,trendsJson,jsonFile,oldJson);
            }
      });
};

const saveFile =  (jsonFile, fileName,today) => {
    fs.writeFileSync(fileName,JSON.stringify(jsonFile,null,4));
    console.log(`[${today}] File ${fileName} saved.`);
};

const downloadFiles  = async () =>{
    const datetime = new Date();
    let today = datetime.toLocaleString("pt-BR"); 
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
    const trendsJson =  await getTrends(bot);

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
                const rawdata = fs.readFileSync(fileName);
                const oldJson = JSON.parse(rawdata);
                if( (newJson.Confirmed == oldJson.Confirmed) && (newJson.Deaths == oldJson.Deaths) && (newJson.Recovered == oldJson.Recovered) ){
                    console.log(`[${today}] Nothing change at: ${newJson.Country_Region}`);
                } else {
                    
                    console.log(`[${today}] Change at: ${newJson.Country_Region}`);
                    console.log(`[${today}] ${oldJson.Confirmed} => ${newJson.Confirmed}`);
                    console.log(`[${today}] ${oldJson.Deaths} => ${newJson.Deaths}`);
                    console.log(`[${today}] ${oldJson.Recovered} => ${newJson.Recovered}`);
                    
                    saveFile(newJson, fileName,today);
                    Tweet(bot,trendsJson,newJson,oldJson);

                }
            } else {
                saveFile(newJson, fileName,today);
                Tweet(bot,trendsJson,newJson);
            }
         
        });
    }).catch( (err) =>{
        console.log(err);
    });
}

const tokens = safeRequire();
downloadFiles();
setInterval(downloadFiles, 5*60*1000);

