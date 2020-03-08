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

const Tweet =  (context, jsonFile, oldJson, previous_id) =>{
    return new Promise((resolve, reject) =>{
        const { bot, trendsJson } = context;
        let tweet =""; //(previous_id) ? `@covid_19bot\n` : ``;
        const maxlen = 250;
        let datetimeTweet = new Date();
        let todayTweet = datetimeTweet.toLocaleString("pt-BR"); 
        console.log(`[${todayTweet}] previous_id: ${previous_id}`);
        if(!oldJson){
            tweet += `Coronavirus Update \n`
                        + `Country_Region: ${jsonFile.Country_Region}\n`
                        + `Confirmed: ${jsonFile.Confirmed}\n`
                        + `Deaths: ${jsonFile.Deaths}\n`
                        + `Recovered: ${jsonFile.Recovered}\n`
                        + `The data comes from: ${jsonFile.DataSource}\n`
                        + `#Coronavirus #COVID19 #bot\n`  
        } else {
            tweet += `Coronavirus Update \n`
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
        bot.post('statuses/update', { status: tweet}, (err, data, response) => {
            if(!err){
                    const id =  data.id_str; 
                    console.log(`[${todayTweet}] Tweet success`);
                    resolve(id);
                } else {
                    console.log(`[${todayTweet}] ERROR CODE: ${err.code}, MSG: ${err.message}`);
                    resolve(undefined);               
                }
        });
    });
};

const TweetThread =  async (statuses, context) => {
   await statuses.reduce(async (previous_id_promise, status) => {
        // The previous_id param will contain the previous tweet's id
        // so we can chain them in a thread, if there's more than one.

        const { newJson, oldJson } = status;
        let previous_id; 
        if(previous_id_promise){
            previous_id =await Promise.resolve(previous_id_promise);
        }
        const  idPromisse = await Tweet(context, newJson, oldJson, previous_id);
        const id = await Promise.resolve(idPromisse);
        if(id){
            status.tweeted = true;
        }
        return id || previous_id;
    }, null);
};

const saveFile =  (jsonFile, fileName,today) => {
    fs.outputJsonSync(fileName, jsonFile, { spaces: "\t" })
    console.log(`[${today}] File ${fileName} saved.`);
};

const informationUpdated = (fileName, newJson,today,statuses) =>{
    if(fs.existsSync(fileName)){ 
        const rawdata = fs.readFileSync(fileName);
        const oldJson = JSON.parse(rawdata);
        if( (newJson.Confirmed == oldJson.Confirmed) && (newJson.Deaths == oldJson.Deaths) && (newJson.Recovered == oldJson.Recovered) ){
            return false;
        } else {
            console.log(`[${today}] Change at: ${newJson.Country_Region}`);
            statuses.push({
                newJson,
                oldJson,
                fileName,
                tweeted : false,
            });
            return true;
        }
    } else {
        console.log(`[${today}] NEW: ${newJson.Country_Region}`);
        statuses.push({
            newJson,
            fileName,
            tweeted : false,
        });
        return true;
    }
    
};

const checkAndCreateFolder = (fileFolder) => {
    if (!fs.existsSync(fileFolder)){
        
        fs.mkdirSync(fileFolder,{recursive: true});
    }
    return true;
};

const getCoronaNumbersSource2 = async (today, currentFolder,statuses) => {

    console.log(`[${today}] Starting Download From Source 2..`);

    const coronaURL = "https://www.worldometers.info/coronavirus/#countries";
    
    const fileFolder = path.join(currentFolder,"Downloads","Source","2");
	if (!fs.existsSync(fileFolder)){
        
        fs.mkdirSync(fileFolder,{recursive: true});
    }
	console.log(`[${today}] Opening browser.`);
	const browser = await pup.launch({args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],});
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
            
            informationUpdated(fileName,newJson,today,statuses);
		

		});
    console.log(`[${today}] Data Colelcted.`);
    console.log(`[${today}] Closing Browser.`);
	await browser.close();


};

const getCoronaNumbersSource1 = async (today, currentFolder,statuses) => {
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

            informationUpdated(fileName,newJson,today,statuses);

         
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
    const statuses = []; // here we gonna save the  tweets status 
    await getCoronaNumbersSource1(today, currentFolder,statuses);
    getCoronaNumbersSource2(today, currentFolder, statuses).then(async ()=>{

        const context = { bot, trendsJson };

        await TweetThread(statuses, context);
        const statusesKeys = Object.keys(statuses);
        const processStatuses = statusesKeys.map(elemId => {
            const element = statuses[elemId];

            if(element.tweeted){
                saveFile(element.newJson,element.fileName,today);
            }
        });
        Promise.all(processStatuses);
        console.log(`[${today}] Bot Finished...`);
     });
};

const tokens = safeRequire();
downloadFiles();
setInterval(downloadFiles, 20*60*1000);

