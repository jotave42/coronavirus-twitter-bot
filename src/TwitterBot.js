const sleep = require('util').promisify(setTimeout);
const Twit = require("twit");
const fs  = require("fs-extra");
const Utils = require("./Utils.js");
const { parseTweet } = require('twitter-text');
const path = require("path");

class TwitterBot {
    constructor(tokens) {
        this.bot = new Twit({
            consumer_key: tokens.APIKey,
            consumer_secret: tokens.APISecretKey,
            access_token: tokens.AccessToken,
            access_token_secret: tokens.AccessTokenSecret,
            timeout_ms: 60 * 1000
        }); 
    }

    uploadMedia(context,Country_Region){
        return new Promise((resolve, reject) => {
            const {bot} = context;
            const fileName = path.join(__dirname,"flags.json");
            const rawdata = fs.readFileSync(fileName);
            const josnFlags = JSON.parse(rawdata);
            const meidaPath = josnFlags[Country_Region] || josnFlags["Others"];
            Utils.log(`meidaPath => ${meidaPath}`);
            const b64content = fs.readFileSync(meidaPath, { encoding: 'base64' });
            bot.post('media/upload', { media_data: b64content }, (err, data, response)=>{
                if (!err) {
                    resolve(data.media_id_string);
                } else {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                    resolve(undefined);
                }
            });
           
        });
    }

    async getTrends(){
        return new Promise((resolve, reject) => {
            this.bot.get('trends/place', {
                id: '1'
            }, async (err, data, response) => {
                if (err) {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`,`error`);
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
                        len: parseTweet(element.name).weightedLength,
                    }
                    return trend;
                });
                resolve(trendsList);
            });
        });
    }
    getLastTweet(userId){
        return new Promise((resolve, reject) => {
            this.bot.get('statuses/user_timeline', {user_id:userId, count:1},(err, data, response) => {
                if (err) {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`,`error`);
                    return reject(err.message);
                }
                resolve(data[0].id);
            });
        });
    }
    Tweet(jsonFile, oldJson, previous_id, previous_id_str, media_id){
        return new Promise((resolve, reject) => {

            let tweet = (previous_id) ? `@covid_19bot\n` : ``;
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
            this.bot.post('statuses/update', {
                status: tweet,
                media_ids: media_id,
            }, (err, data, response) => {
                if (!err) {
                    const id = data.id;
                    const id_str = data.id_str;
                    Utils.log(`Tweet success`);
                    resolve({id,id_str});
                } else {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                    resolve(undefined);
                }
            });
        });
    }    
    
    async TweetThread(statuses){
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
            const media_id = await this.uploadMedia(Country_Region);
            Utils.log(`Waiting media upload`);
            await sleep(30000);
            let {id, id_str} = await this.Tweet(newJson, oldJson, previous_id, previous_id_str,media_id);
            Utils.log(`Waiting tweet upload`);
            await sleep(30000);
            if (id) {
                status.tweeted = true;
                status.id = id;
                Utils.saveFile(status.newJson, status.fileName);
            } else {
                id = previous_id;
                id_str = previous_id_str;
            }
            updatedStatus.push(status);
            return  {id, id_str};
        }, null);
        return updatedStatus;
    }

    async getMentions( lastReplayId ) {
        return new Promise((resolve, reject) => {
            const tweets = [];
            const option = lastReplayId ? { Name: "Example",since_id:lastReplayId} : { Name: "Example"};
            this.bot.get('statuses/mentions_timeline',option, 
            (err, data, response) =>{
                if (err) {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`,`error`);
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
    }
    
    creatTweets(mentions, localFolder){
        const fileName = path.join(localFolder,"countries.json");
        const josnCountries = Utils.openJson(fileName);

        const tweets = [];
        const maxlen = 280;

        mentions.forEach((mention)=>{
            let tweet = mention.user_name+" ";
            let tweet_len = 0;
            const {tweet_id_str , country,user_name} =mention;
            if(josnCountries[country]){
                josnCountries[country].forEach((countyJsonPath)=>{
                        const josnCountry =  Utils.openJson(countyJsonPath);
                        tweet_len = parseTweet(tweet).weightedLength;

                        const nextCounty =  `Country_Region: ${josnCountry.Country_Region}\n`+
                                            `Confirmed: ${josnCountry.Confirmed}\n`+
                                            `Deaths: ${josnCountry.Deaths}\n`+
                                            `Recovered: ${josnCountry.Recovered}\n`+
                                            `The data comes from: ${josnCountry.DataSource}\n`
                    
                        const totalTweetLength = parseTweet(nextCounty).weightedLength + tweet_len;
                       
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
        return tweets;
    }

    async replayTweet(tweet_obj,localFolder){
        return new Promise((resolve, reject) => {
            const {tweet,tweet_id_str,user_name} = tweet_obj;
            this.bot.post('statuses/update', {
                status: tweet,
                in_reply_to_status_id: tweet_id_str,
            }, (err, data, response) => {

                if (!err) {
                    Utils.log(`Tweet replayed to ${user_name} with success`);
                    const replayJsonFile = path.join(localFolder,"replay.json");
                    const josnReplay = {lastRepalyId:tweet_id_str};
                    Utils.saveFile(josnReplay,replayJsonFile);
    
                    resolve(true);
                } else {
                    Utils.log(`ERROR CODE: ${err.code}, MSG: ${err.message}`, 'error');
                    resolve(false);
                }

            });
        });
    }


}

module.exports = TwitterBot;
