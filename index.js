const path = require("path");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const Twit = require("twit");
const pup = require("puppeteer");
const cheerio = require("cheerio");
const sleep = require('util').promisify(setTimeout);
const twitterText = require('twitter-text');
const createFlagsJson = require("./createFlagsJson.js");
const creatCountriesJson = require("./creatCountriesJson");

const log = (msg, type = 'log') => {
    const timestamp =  new Date().toLocaleString("pt-BR");
    const loggerFunction = console[type];
    loggerFunction(`[${timestamp}] ${msg}`);
}

const safeRequire = () => {
    try {
        return require("./tokens.json");
    } catch (err) {
        return {
            APIKey: process.env.APIKey,
            APISecretKey: process.env.APISecretKey,
            AccessToken: process.env.AccessToken,
            AccessTokenSecret: process.env.AccessTokenSecret,
        }
    };
}

const getTrends = async (bot) => {
    return new Promise((resolve, reject) => {
        bot.get('trends/place', {
            id: '1'
        }, async (err, data, response) => {
            if (err) {
                log(`ERROR CODE: ${err.code}, MSG: ${err.message}`,`error`);
                return reject(err.message);
            }

            const trends = data[0].trends.filter((elem) => {
                if (elem.name[0] == "#") {
                    return elem;
                }
            });
            trends.splice(10);
            const trendsKeys = Object.keys(trends);
            const trendsList = trendsKeys.map(elemId => {
                const element = trends[elemId];
                const trend = {
                    
                    name: element.name.trim(),
                    len: twitterText.parseTweet(element.name).weightedLength,
                }
                return trend;
            });
            resolve(trendsList);
        });
    });
};

const uploadMedia = (context,Country_Region) => {
    return new Promise((resolve, reject) => {
        const {bot} = context;
        const fileName = path.join(__dirname,"flags.json");
        const rawdata = fs.readFileSync(fileName);
        const josnFlags = JSON.parse(rawdata);
        const meidaPath = josnFlags[Country_Region] || josnFlags["Others"];
        log(`meidaPath => ${meidaPath}`);
        const b64content = fs.readFileSync(meidaPath, { encoding: 'base64' });
        bot.post('media/upload', { media_data: b64content }, (err, data, response)=>{
            if (!err) {
                resolve(data.media_id_string);
            } else {
                log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                resolve(undefined);
            }
        });
       
    });
};

const Tweet = (context, jsonFile, oldJson, previous_id, previous_id_str, media_id) => {
    return new Promise((resolve, reject) => {
        const { bot, trendsJson } = context;
        let tweet =''; //(previous_id) ? `@covid_19bot\n` : ``;
        const maxlen = 280;
        if (!oldJson) {
            tweet += `Coronavirus Update \n` +
                `Country_Region: ${jsonFile.Country_Region}\n` +
                `Confirmed: ${jsonFile.Confirmed}\n` +
                `Deaths: ${jsonFile.Deaths}\n` +
                `Recovered: ${jsonFile.Recovered}\n` +
                `The data comes from: ${jsonFile.DataSource}\n` +
                `#Coronavirus #COVID19 #bot\n`;
        } else {
            tweet += `Coronavirus Update \n` +
                `Country_Region: ${jsonFile.Country_Region}\n` +
                `Confirmed: ${oldJson.Confirmed} => ${jsonFile.Confirmed}\n` +
                `Deaths: ${oldJson.Deaths} => ${jsonFile.Deaths}\n` +
                `Recovered: ${oldJson.Recovered} => ${jsonFile.Recovered}\n` +
                `The data comes from: ${jsonFile.DataSource}\n` +
                `#Coronavirus #COVID19 #bot\n`;
        }

        bot.post('statuses/update', {
            status: tweet,
            in_reply_to_status_id_str: previous_id_str,
            in_reply_to_status_id: previous_id,
            media_ids: media_id,
        }, (err, data, response) => {
            if (!err) {
                const id = data.id;
                const id_str = data.id_str;
                log(`Tweet success`);
                resolve({id,id_str});
            } else {
                log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                resolve(undefined);
            }
        });
    });
};

const TweetThread = async (statuses, context) => {
    const updatedStatus = [];
    await statuses.reduce(async (previous_id_promise, status) => {
        // The previous_id_promise param contains the previous tweet's id
        // in a resolved promise, we use 'await' to get the value
        // so we can chain them in a thread, if there's more than one.

        const { newJson, oldJson } = status;
        const {Country_Region} = newJson;
        const previous_id_promise_obj = await previous_id_promise;
        let previous_id;
        let previous_id_str;

        if(previous_id_promise_obj){
            previous_id = previous_id_promise_obj.id;
            previous_id_str = previous_id_promise_obj.id_str;
        }
        const media_id =await uploadMedia(context, Country_Region);
        log(`Waiting media upload`);
        await sleep(30000);
        let {id, id_str} =await Tweet(context, newJson, oldJson, previous_id, previous_id_str,media_id);
        log(`ids=>{${id},${id_str}}`);
        log(`Waiting tweet upload`);
        await sleep(30000);
        if (id) {
            status.tweeted = true;
            status.id = id;
            saveFile(status.newJson, status.fileName);
        } else {
            id = previous_id;
            id_str = previous_id_str;
        }
        updatedStatus.push(status);
        return  {id, id_str};
    }, null);
    return updatedStatus;
};

const saveFile = (jsonFile, fileName) => {
    fs.outputJsonSync(fileName, jsonFile, {
        spaces: "\t"
    })
    log(`File ${fileName} saved.`);
};

const informationUpdated = (fileName, newJson, statuses) => {
    if (fs.existsSync(fileName)) {
        const rawdata = fs.readFileSync(fileName);
        const oldJson = JSON.parse(rawdata);
        if ((newJson.Confirmed == oldJson.Confirmed) && (newJson.Deaths == oldJson.Deaths) && (newJson.Recovered == oldJson.Recovered)) {
            return false;
        } else {
            log(`Change at: ${newJson.Country_Region}`);
            statuses.push({
                newJson,
                oldJson,
                fileName,
                tweeted: false,
            });
            return true;
        }
    } else {
        log(`NEW: ${newJson.Country_Region}`);
        statuses.push({
            newJson,
            fileName,
            tweeted: false,
        });
        return true;
    }
};

const checkAndCreateFolder = (fileFolder) => {
    if (!fs.existsSync(fileFolder)) {
        fs.mkdirSync(fileFolder, {
            recursive: true
        });
    }
    return true;
};

const getCoronaNumbersSource2 = async (currentFolder, statuses) => {
    log(`Starting Download From Source 2..`);
    const coronaURL = "https://www.worldometers.info/coronavirus/#countries";

    const fileFolder = path.join(currentFolder, "Downloads", "Source", "2");
    if (!fs.existsSync(fileFolder)) {

        fs.mkdirSync(fileFolder, {
            recursive: true
        });
    }
    log(`Opening browser.`);
    const browser = await pup.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.setJavaScriptEnabled(false);
    log(`Going to ${coronaURL}.`);
    await page.goto(coronaURL);

    log(`Loaded ${coronaURL}.`);
    let bodyHTML = await page.evaluate(() => document.body.innerHTML);

    let $ = cheerio.load(bodyHTML);
    log(`Geting Data.`);
    const expectHead = [`Country,Other`,`TotalCases`,'NewCases',`TotalDeaths`,`NewDeaths`,`TotalRecovered`,`ActiveCases`,`Serious,Critical`,`Tot Cases/1M pop`];
    let headCorrect = true;
    $("#main_table_countries thead tr > th").each((index,element) =>{
        const headText = $(`#main_table_countries thead tr th:nth-child(${index+1})`).text().trim();
        if(! headText === expectHead[index]){
            headCorrect = false;
        }
    });
    if(!headCorrect){
        await browser.close();
        throw new Error(`The Table Head is incorrect`);
    }

    $("#main_table_countries tbody tr").each(function (index, element) {
        const $document = $(this);
        const newJson = {
            "Country_Region": $document.find("td:nth-child(1) > span").text().trim() != "" ? $document.find("td:nth-child(1) > span").text().trim() : $document.find("td:nth-child(1)").text().trim(),
            "Confirmed": parseInt($document.find("td:nth-child(2)").text().trim().replace(',', '')),
            "Deaths": $document.find("td:nth-child(4)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(4)").text().trim().replace(',', '')),
            "Recovered": $document.find("td:nth-child(6)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(6)").text().trim().replace(',', '')),
            "DataSource": "tinyurl.com/s4gvvck"
        };
        const jsonFileName = newJson.Country_Region.replace(':', "") + ".json";
        const fileName = path.join(fileFolder, jsonFileName);
        informationUpdated(fileName, newJson, statuses);
    });
    log(`Data Collected.`);
    log(`Closing Browser.`);
    await browser.close();
};

const getCoronaNumbersSource1 = async (currentFolder, statuses) => {
    log(`Starting Download From Source 1..`);
    const urlRequest =  `https://services9.arcgis.com/N9p5hsImWXAccRNI/arcgis/rest/services/Z7biAeD8PAkqgmWhxG2A/FeatureServer/2/query?f=json&where=Confirmed%20%3E%200&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&orderByFields=Confirmed%20desc&resultOffset=0&resultRecord`;
    const fileFolder = path.join(currentFolder, "Downloads", "Source", "1");
    checkAndCreateFolder(fileFolder);
    return fetch(urlRequest).then(async (res) => {
        const data = await res.json();
        data.features.forEach((element) => {
            const node = element.attributes;
            let {
                Country_Region,
                Confirmed,
                Deaths,
                Recovered
            } = node;
            Country_Region = Country_Region.replace("*","");
            const fileName = path.join(fileFolder, Country_Region + ".json")
            const newJson = {
                Country_Region,
                Confirmed,
                Deaths,
                Recovered,
                DataSource: "tinyurl.com/uwns6z5"
            };
            informationUpdated(fileName, newJson, statuses);
        });
    }).catch((err) => {
        log(`ERROR ${err}`, 'error');
    });
};

const downloadFiles = async () => {
    log(`Staring Bot...`);
    const bot = new Twit({
        consumer_key: tokens.APIKey,
        consumer_secret: tokens.APISecretKey,
        access_token: tokens.AccessToken,
        access_token_secret: tokens.AccessTokenSecret,
        timeout_ms: 60 * 1000
    });

    log(`Geting Trending Topics...`);
    //? Catch the rejection of getTrends so the program doesn't crash if it fails
    const trendsJson = await getTrends(bot).catch((err) =>  log(`ERROR: ${err}`,`error`));
    const currentFolder = __dirname;
    const statuses = []; // here we gonna save the  tweets status
    await getCoronaNumbersSource1(currentFolder, statuses).catch((err)=>{log(`ERROR: ${err}`,`error`);});
    getCoronaNumbersSource2(currentFolder, statuses).then(async () => {
        const context = {
            bot,
            trendsJson,
        }
        const updatedStatus = await TweetThread(statuses, context);
        log(`UPDATING Flags Json`);
        createFlagsJson();
        creatCountriesJson();
        log(`Bot Finished...`);
    }).catch((err)=>{
        
        log(err,`error`);
        log(`Bot Finished...`);
    });
};
const getMentions = async (bot,lastReplayId)=>{
    log("getting Mentions");
    return new Promise((resolve, reject) => {
        const tweets = [];
        const option = lastReplayId ? { Name: "Example",since_id:lastReplayId} : { Name: "Example"};
        bot.get('statuses/mentions_timeline',option, 
        (err, data, response) =>{
            if (err) {
                log(`ERROR CODE: ${err.code}, MSG: ${err.message}`,`error`);
                return reject(err.message);
            }
            data.forEach((elem)=>{
                if(elem.user.id_str !=  '1235367745539248128'){

                    const twitterText =elem.text.toLowerCase().split(" ");
                    twitterText.shift();
                    const countryArray = twitterText.filter((elem)=>{
                        if(elem !== ""){
                            return elem;
                        }
                    });
                
                    const country = countryArray.join(" "); 
                    const tweet_id_str = elem.id_str;
                    const user_name = "@"+elem.user.screen_name;
                    tweets.push({
                        country,
                        tweet_id_str,
                        user_name
                    });
                }

            });
            resolve(tweets);
        });
    });
};
const creatTweets = (mentions) => {
    const fileName = path.join(__dirname,"countries.json");
    let rawdata = fs.readFileSync(fileName);
    const josnCountries = JSON.parse(rawdata);
    const tweets = [];
    const maxlen = 280;

    mentions.forEach((mention)=>{
        let tweet = mention.user_name+" ";
        let tweet_len = 0;
        const {tweet_id_str , country,user_name} =mention
        log(`[${country}]`);
        if(josnCountries[country]){
            josnCountries[country].forEach((countyJsonPath)=>{
                    rawdata = fs.readFileSync(countyJsonPath);
                    const josnCountry = JSON.parse(rawdata);
                    tweet_len = twitterText.parseTweet(tweet).weightedLength;
                    const nextCounty =  `Country_Region: ${josnCountry.Country_Region}\n`+
                                        `Confirmed: ${josnCountry.Confirmed}\n`+
                                        `Deaths: ${josnCountry.Deaths}\n`+
                                        `Recovered: ${josnCountry.Recovered}\n`+
                                        `The data comes from: ${josnCountry.DataSource}\n`
                    const totalTweetLength = twitterText.parseTweet(nextCounty).weightedLength + tweet_len;
                    if (totalTweetLength <= maxlen) {
                        tweet+= nextCounty;
                    } else {
                        tweets.push({tweet_id_str,tweet,user_name});
                        tweet = mention.user_name + " " + nextCounty;
                    }
            });
        } else {
            tweet += `Sorry but I didn't find any data of ${country}.\n`+
            `Please try again with another name for example:\n`+
            `Instead of @covid_19bot Brasil try @covid_19bot Brazil`; 
        }
       tweets.push({tweet_id_str,tweet,user_name});
    });
    return tweets
}
const replayTweet = async (bot,tweet_obj)=>{
    return new Promise((resolve, reject) => {
        const {tweet,tweet_id_str,user_name} = tweet_obj;
        bot.post('statuses/update', {
            status: tweet,
            in_reply_to_status_id: tweet_id_str,
        }, (err, data, response) => {
            if (!err) {
                log(`Tweet replayed to ${user_name} with success`);
                const replayJsonFile = path.join(__dirname,"replay.json");
                let josnReplay;
                if(fs.existsSync(replayJsonFile)){
                    const rawdata = fs.readFileSync(replayJsonFile);
                    josnReplay = JSON.parse(rawdata);
                    josnReplay.lastRepalyId = tweet_id_str;
                } else {
                    josnReplay = {lastRepalyId:tweet_id_str};
                }

                fs.outputJsonSync(replayJsonFile, josnReplay, { spaces: "\t" });

                resolve(true);
            } else {
                log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                resolve(false);
            }
        });
    });
};
const replayMentions = async()=>{
    const bot = new Twit({
        consumer_key: tokens.APIKey,
        consumer_secret: tokens.APISecretKey,
        access_token: tokens.AccessToken,
        access_token_secret: tokens.AccessTokenSecret,
        timeout_ms: 60 * 1000
    });
    let lastReplayId;
    const replayJsonFile = path.join(__dirname,"replay.json");

    if(fs.existsSync(replayJsonFile)){
        const rawdata = fs.readFileSync(replayJsonFile);
        const repalyJson =  JSON.parse(rawdata);
        lastReplayId = repalyJson.lastRepalyId;
    }

    const mentions = await getMentions(bot,lastReplayId);
    const tweets = creatTweets(mentions);
    tweets.forEach(async (tweet)=>{
        await sleep(1500);
        await replayTweet(bot,tweet);
    });
}
const tokens = safeRequire();
creatCountriesJson();
createFlagsJson();
downloadFiles();
replayMentions();
setInterval(downloadFiles, 20 * 60 * 1000);
setInterval(replayMentions, 30 * 1000);