const path = require("path");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const Twit = require("twit");
const pup = require("puppeteer");
const cheerio = require("cheerio");


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
                    name: element.name.trim(),
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
    return new Promise((resolve, reject) =>{
        let tweet;
        const maxlen = 250;
        let datetimeTweet = new Date();
        let todayTweet = datetimeTweet.toLocaleString("pt-BR"); 
        if(!oldJson){
            tweet = `Coronavirus Update \n`
                        + `Country_Region: ${jsonFile.Country_Region}\n`
                        + `Confirmed: ${jsonFile.Confirmed}\n`
                        + `Deaths: ${jsonFile.Deaths}\n`
                        + `Recovered: ${jsonFile.Recovered}\n`
                        + `The data comes from: ${jsonFile.DataSource}\n`
                        + `#Coronavirus #COVID19 #bot\n`  
        } else {
            tweet = `Coronavirus Update \n`
                        + `Country_Region: ${jsonFile.Country_Region}\n`
                        + `Confirmed: ${oldJson.Confirmed} => ${jsonFile.Confirmed}\n`
                        + `Deaths: ${oldJson.Deaths} => ${jsonFile.Deaths}\n`
                        + `Recovered: ${oldJson.Recovered} => ${jsonFile.Recovered}\n`
                        + `The data comes from: ${jsonFile.DataSource}\n`
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
                    resolve(`[${todayTweet}] Tweet success`);
                } else {                    
                    reject(`[${todayTweet}] ERROR CODE: ${err.code}, MSG: ${err.message}`);
                }
        });
    });
};

const saveFile =  (jsonFile, fileName,today) => {
    fs.outputJsonSync(fileName, jsonFile, { spaces: "\t" })
    console.log(`[${today}] File ${fileName} saved.`);
};

const informationUpdated = (fileName, newJson,today,bot,trendsJson) =>{
    if(fs.existsSync(fileName)){ 
        const rawdata = fs.readFileSync(fileName);
        const oldJson = JSON.parse(rawdata);
        if( (newJson.Confirmed == oldJson.Confirmed) && (newJson.Deaths == oldJson.Deaths) && (newJson.Recovered == oldJson.Recovered) ){
            return false;
        } else {
            console.log(`[${today}] Change at: ${newJson.Country_Region}`);
            
            Tweet(bot,trendsJson,newJson,oldJson).then((res)=>{
                console.log(res);
                saveFile(newJson, fileName,today);
            }).catch((err)=>{
                console.log(res);
            });
            return true;
        }
    } else {
        console.log(`[${today}] NEW: ${newJson.Country_Region}`);
    
        Tweet(bot,trendsJson,newJson).then((res)=>{
            console.log(res);
            saveFile(newJson, fileName,today);
        }).catch((err)=>{
            console.log(err);
        });
        return true;
    }
    
}
const checkAndCreateFolder = (fileFolder) => {
    if (!fs.existsSync(fileFolder)){
        
        fs.mkdirSync(fileFolder,{recursive: true});
    }
    return true;
};

const getCoronaNumbersSource2 = async (today, currentFolder, bot, trendsJson) => {

    console.log(`[${today}] Starting Download From Source 2..`);

    const coronaURL = "https://www.worldometers.info/coronavirus/#countries";
    
    const fileFolder = path.join(currentFolder,"Downloads","Source","2");
	if (!fs.existsSync(fileFolder)){
        
        fs.mkdirSync(fileFolder,{recursive: true});
    }
	console.log(`[${today}] Opening browser.`);
	const browser = await pup.launch();
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0); 
	await page.setJavaScriptEnabled(false);
	console.log(`[${today}] Going to ${coronaURL}.`);
	await page.goto(coronaURL);
	
	console.log(`[${today}] Loaded ${coronaURL}.`);
    let bodyHTML = await page.evaluate(() => document.body.innerHTML);
    
    let $ =  cheerio.load(bodyHTML);
    console.log(`[${today}] Geting Data.`);
	$("#main_table_countries tbody tr").each(function (index, element) {
			const $document = $(this);
			const newJson =  {
                "Country_Region" : $document.find("td:nth-child(1) > span").text().trim() != "" ? $document.find("td:nth-child(1) > span").text().trim() : $document.find("td:nth-child(1)").text().trim(),
                "Confirmed" : parseInt( $document.find("td:nth-child(2)").text().trim().replace(',','') ),
                "Deaths" :  $document.find("td:nth-child(4)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(4)").text().trim().replace(',','')),
                "Recovered" : $document.find("td:nth-child(6)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(6)").text().trim().replace(',','')),
                "DataSource" : "tinyurl.com/s4gvvck"
            };
			const jsonFileName = newJson.Country_Region.replace(':',"")+".json";
			const fileName = path.join(fileFolder,jsonFileName);
            informationUpdated(fileName,newJson,today,bot,trendsJson);
		

		});
    console.log(`[${today}] Data Colelcted.`);
    console.log(`[${today}] Closing Browser.`);
	await browser.close();


};
const getCoronaNumbersSource1 = async (today, currentFolder, bot, trendsJson) => {
    console.log(`[${today}] Starting Download From Source 1..`);

   
    const urlRequest =`https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/ncov_cases/FeatureServer/2/query?f=json&where=Confirmed%20%3E%200&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&orderByFields=Confirmed%20desc&resultOffset=0&resultRecordCount=200&cacheHint=true`;
    const fileFolder = path.join(currentFolder,"Downloads","Source","1");
    checkAndCreateFolder(fileFolder);

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
                Recovered,
                DataSource : "tinyurl.com/uwns6z5"
            };

            informationUpdated(fileName,newJson,today,bot,trendsJson);

         
        });
    }).catch( (err) =>{
        console.log(`[${today}] ERROR ${err}`);
    });
};

const downloadFiles  = async () =>{

    const datetime = new Date();
    const today = datetime.toLocaleString("pt-BR"); 
    
    console.log(`[${today}] Staring Bot...`);
    const bot = new Twit({
        consumer_key: tokens.APIKey,
        consumer_secret: tokens.APISecretKey,
        access_token: tokens.AccessToken,
        access_token_secret: tokens.AccessTokenSecret,
        timeout_ms:  60*1000
    });

    console.log(`[${today}] Getin Trending Topics...`);
    const trendsJson =  await getTrends(bot);
    const currentFolder = __dirname;

    await getCoronaNumbersSource1(today, currentFolder, bot, trendsJson);
    getCoronaNumbersSource2(today, currentFolder, bot, trendsJson).then(()=>{

         console.log(`[${today}] Bot Finished...`);
     });
}

const tokens = safeRequire();
downloadFiles();
setInterval(downloadFiles, 20*60*1000);

