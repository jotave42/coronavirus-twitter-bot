const path = require("path");
const Flags = require("./src/Flags.js");
const Countries = require("./src/Countries.js");
const GetData = require("./src/GetData.js");
const Utils = require('./src/Utils.js');
const TwitterBot = require('./src/TwitterBot.js');
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

const joinStatuses = (statusesTotal, statuses) =>{
    if(statuses){
        statuses.forEach((status)=>{
            statusesTotal.push(status);
        });
    }
    return statusesTotal;
}


const UpadateData = async (force) => {
    const currentFolder = __dirname;
    const getData = new GetData(currentFolder);

    let statuses = [];// here we gonna save the  tweets status
    
    const statuses1 = await getData.getCoronaNumbersSource1(force).catch((err)=>{Utils.log(`ERROR: ${err}`,`error`);});
    const statuses2 = await getData.getCoronaNumbersSource2(force).catch((err)=>{Utils.log(`ERROR: ${err}`,`error`);});
    statuses = joinStatuses(statuses, statuses1);
    statuses = joinStatuses(statuses, statuses2);
    return statuses
}

const updateFiles = async ()=>{
    Utils.log(`Upadating Files...`);
    const statuses = await UpadateData(true);
    statuses.forEach((status)=>{
        Utils.saveFile(status.newJson, status.fileName);
    });
    const twitterBot = new TwitterBot(tokens);
    const lastTweetId = await twitterBot.getLastTweet(`1235367745539248128`);

    const lastRepalyJson = {lastRepalyId:lastTweetId};
    const replayJsonFile = path.join(__dirname,"replay.json");
    Utils.saveFile(lastRepalyJson,replayJsonFile);
    Utils.log(`Upadating Files Done`);
}


const downloadFiles = async () => {
    try{
        Utils.log(`Staring downloadFiles...`);

        const statuses = await UpadateData();

        const twitterBot = new TwitterBot(tokens);
        await twitterBot.TweetThread(statuses).catch((err)=>{Utils.log(`ERROR: ${err}`,`error`);});
        
        const countries = new Countries(__dirname);
        const flags = new Flags(__dirname);
        
        countries.creatCountriesJson();
        flags.creatFlagJson();
        Utils.log(`downloadFiles Finished...`);
    }catch(err){
        Utils.log(`ERROR: ${err}`,`error`);
    };
}


const replayMentions = async () => {
    try{
        let lastReplayId;

        const replayJsonFile = path.join(__dirname,"replay.json");
        const repalyJson = Utils.openJson(replayJsonFile);

        if(repalyJson){
            lastReplayId = repalyJson.lastRepalyId;
        }
        const twitterBot = new TwitterBot(tokens);
        const mentions = await twitterBot.getMentions(lastReplayId);
        const tweets = twitterBot.creatTweets(mentions, __dirname);
        tweets.forEach(async (tweet)=>{
            await sleep(1500);
            await twitterBot.replayTweet(tweet,__dirname);
        });
    }catch(err){
        Utils.log(`ERROR: ${err}`,`error`);
    }
}
const tokens = safeRequire();
const main = async () => {
    Utils.log(`Staring Bot...`);
    await updateFiles().catch((err)=>{Utils.log(`ERROR: ${err}`,`error`)});
    setInterval(downloadFiles, 1 * 60 * 1000);
    setInterval(replayMentions, 30 * 1000);
}
main();
