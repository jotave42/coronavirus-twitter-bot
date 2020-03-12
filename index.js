const path = require("path");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const Twit = require("twit");
const pup = require("puppeteer");
const cheerio = require("cheerio");
const sleep = require('util').promisify(setTimeout);
const twitterText = require('twitter-text');
const createFlagsJson = require("./createFlagsJson.js")

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
}

const Tweet = (context, jsonFile, oldJson, previous_id, media_id) => {
    return new Promise((resolve, reject) => {
        const { bot, trendsJson } = context;
        let tweet = (previous_id) ? `@covid_19bot\n` : ``;
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
        let tweetLen = twitterText.parseTweet(tweet).weightedLength;
        if (trendsJson) {
            if (trendsJson.length > 0) {
                for (const trend of trendsJson) {
                    const newTrendLen = trend.len + 1 // + 1  in order to add a space
                    const newLen = tweetLen + newTrendLen;
                    if (newLen < maxlen) {
                        tweet += trend.name + " ";
                        tweetLen = newLen;
                    }
                }
            }
        }

        bot.post('statuses/update', {
            status: tweet,
            in_reply_to_status_id_str: previous_id,
            media_ids: media_id,
        }, (err, data, response) => {
            if (!err) {
                const id = data.id_str;
                log(`Tweet success`);
                resolve(id);
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
        const previous_id = await previous_id_promise;
        const media_id = await uploadMedia(context, Country_Region);
        log(`Media id: ${media_id}`);
        log(`Waiting media upload`);
        await sleep(30000);
        const id = await Tweet(context, newJson, oldJson, previous_id,media_id);
        log(`Waiting tweet upload`);
        await sleep(60000);
        if (id) {
            status.tweeted = true;
            status.id = id;
        }
        updatedStatus.push(status);
        return id || previous_id;
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
    const urlRequest =  `https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/ncov_cases/FeatureServer/2/query?f=json&where=Confirmed%20%3E%200&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&orderByFields=Confirmed%20desc&resultOffset=0&resultRecordCount=200&cacheHint=true`;
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
        const statusesKeys = Object.keys(updatedStatus);
        statusesKeys.forEach(elemId => {
            const element = statuses[elemId];
            if (element.tweeted) {
                saveFile(element.newJson, element.fileName);
            }
        });
        log(`UPDATING Flags Json`);
        createFlagsJson();
        log(`Bot Finished...`);
    }).catch((err)=>{
        log(err,`error`);
        log(`Bot Finished...`);
    });
};

const tokens = safeRequire();
downloadFiles();
setInterval(downloadFiles, 20 * 60 * 1000);