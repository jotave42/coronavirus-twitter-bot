const Utils = require("./Utils.js");
const path = require("path");
const fetch = require("node-fetch");
const pup = require("puppeteer");
const cheerio = require("cheerio");
const sleep = require('util').promisify(setTimeout);

class GetData {
    constructor(projectFolder){
        this.rootFolder = projectFolder;
    }

    informationUpdated(oldJson, newJson){
        if ((newJson.Confirmed == oldJson.Confirmed) && (newJson.Deaths == oldJson.Deaths) && (newJson.Recovered == oldJson.Recovered)) {
            return false;
        } else {
            return true;
        }
    }
    createNewStatus(fileName, newJson, statuses, forced){
        if(forced){
            Utils.log(`FORCED: ${newJson.Country_Region} by ${newJson.DataSource}`);
            statuses.push({
                newJson,
                fileName,
            });
            return statuses;
        }
        const oldJson = Utils.openJson(fileName);
        if(oldJson){
            if(this.informationUpdated(oldJson, newJson)){
                Utils.log(`Change at: ${newJson.Country_Region}`);
                statuses.push({
                    newJson,
                    oldJson,
                    fileName,
                });
            }
            
        }else{
            Utils.log(`NEW: ${newJson.Country_Region}`);
            statuses.push({
                newJson,
                fileName,
            });
        }

        return statuses;
    }

    checkHeader($cheerio){
        const expectHead = [`Country,Other`,`TotalCases`,'NewCases',`TotalDeaths`,`NewDeaths`,`TotalRecovered`,`ActiveCases`,`Serious,Critical`,`Tot Cases/1M pop`];
        let headCorrect = true;
    
        $cheerio("#main_table_countries_today thead tr > th").each((index,element) =>{
            const headText = $cheerio(`#main_table_countries_today thead tr th:nth-child(${index+1})`).text().trim();
            if(! headText === expectHead[index]){
                headCorrect = false;
            }
        });
        return headCorrect;
    }

    async getCoronaNumbersSource1(forced){
        try{
            Utils.log(`Starting Download From Source 1..`);
          
            let statuses = [];
            const responses = [];
            const coronaURL = "https://www.bing.com/covid";
            Utils.log(`Opening browser.`);

            const browser = await pup.launch();
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(0);
            await page.setRequestInterception(true);
            await page.setJavaScriptEnabled(true);
        
            Utils.log(`Going to ${coronaURL}.`);
            page.on("request", request => {
                const url = request.url();
                request.continue();
            });
            page.on("response", response => {
                const request = response.request();
                const url = request.url();
                const status = response.status();
    
                if(url.indexOf("data:image")<0){
                    Utils.log(`response url: ${url} status: ${status}`,"debug");
                    responses.push({
                        url,
                        status,
                        response
                    });
                }
             
              });
             
            await page.goto(coronaURL);
            await page.waitForResponse(response => response.url().indexOf("https://www.bing.com/covid/data"),120);
            let dataRes =[];
            Utils.log(`Geting Data.`);
            const maxAttempt = 120; 
            let attempt = 0;
            while( (dataRes.length ==0) && (attempt != maxAttempt) ){
                await sleep(1000);
                const freezeResponse =responses;
                dataRes = freezeResponse.filter((localResponse)=>{
                    if(localResponse.url.indexOf("https://www.bing.com/covid/data")>-1){
                        return localResponse;
                    }
                });
                attempt++;
            }
            if (dataRes.length == 0){
                Utils.log("Error: Target https://www.bing.com/covid/data not found","error");
                return;
            } 
            if (dataRes[0].status != 200){
                Utils.log("Error: Target https://www.bing.com/covid/data responded with an error","error");
                Utils.log(dataRes[0].response,"error");
                return;
            }
            const data =await dataRes[0].response.json();
            Utils.log(`Closing Browser.`);
            await browser.close();
            Utils.log(`Geting Data.`);
            const fileFolder = path.join(this.rootFolder, "Downloads", "Source", "1");
            const Country_Region_Total ="Total";
            const Confirmed_Total = data.totalConfirmed || 0;
            const Deaths_Total = data.totalDeaths || 0;
            const Recovered_Total = data.totalRecovered || 0;
            const jsonTotal ={
                Country_Region: Country_Region_Total,
                Confirmed: Confirmed_Total,
                Deaths: Deaths_Total,
                Recovered: Recovered_Total,
                DataSource: "bing.com/covid"
            };
            const fileNameTotal = path.join(fileFolder, Country_Region_Total + ".json");
            statuses = this.createNewStatus(fileNameTotal,jsonTotal,statuses,forced);
            Utils.log(`Number of countris fetched: ${data.areas.length}`)
            data.areas.forEach((element) => {
                const node = element;
                let {
                    displayName,
                    totalConfirmed,
                    totalDeaths,
                    totalRecovered
                } = node;
                displayName = displayName.replace("*","");
                const fileName = path.join(fileFolder, displayName + ".json")
                const newJson = {
                    Country_Region:displayName,
                    Confirmed:totalConfirmed || 0, 
                    Deaths:totalDeaths || 0,
                    Recovered:totalRecovered || 0,
                    DataSource: "bing.com/covid"
                };

                statuses = this.createNewStatus(fileName,newJson,statuses,forced);
            });
            return statuses;
        }catch(err){
            Utils.log(`ERROR: ${err}`,"error");
        }
    }   

    async getCoronaNumbersSource2(force){
        try{
            Utils.log(`Starting Download From Source 2..`);
            let statuses = [];
            const coronaURL = "https://www.worldometers.info/coronavirus";
        
            const fileFolder = path.join(this.rootFolder, "Downloads", "Source", "2");

            Utils.checkAndCreateFolder(fileFolder);
            Utils.log(`Opening browser.`);

            const browser = await pup.launch({
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            });
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(0);
            await page.setJavaScriptEnabled(false);
        
            Utils.log(`Going to ${coronaURL}.`);
            await page.goto(coronaURL);
        
            Utils.log(`Loaded ${coronaURL}.`);
            let bodyHTML = await page.evaluate(() => document.body.innerHTML);
        
            let $ = cheerio.load(bodyHTML);

            Utils.log(`Closing Browser.`);
            await browser.close();

            const headCorrect = this.checkHeader($);
            
            if(!headCorrect){
                await browser.close();
                throw new Error(`The Table Head is incorrect`);
            }

            Utils.log(`Geting Data.`);
            
            const newData = [];

            $("#main_table_countries_today tbody tr").each(function (index, element) {
                const $document = $(this);
                const newJson = {
                    "Country_Region": $document.find("td:nth-child(1) > span").text().trim() != "" ? $document.find("td:nth-child(1) > span").text().trim() : $document.find("td:nth-child(1)").text().trim(),
                    "Confirmed": parseInt($document.find("td:nth-child(2)").text().trim().replace(',', '')),
                    "Deaths": $document.find("td:nth-child(4)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(4)").text().trim().replace(',', '')),
                    "Recovered": $document.find("td:nth-child(6)").text().trim() == "" ? 0 : parseInt($document.find("td:nth-child(6)").text().trim().replace(',', '')),
                    "DataSource": "worldometers.info/coronavirus/"
                };
                const jsonFileName = newJson.Country_Region.replace(':', "") + ".json";
                const fileName = path.join(fileFolder, jsonFileName);
                newData.push({fileName,newJson});
                
            });
            for (const data of newData) {
                
                statuses = this.createNewStatus(data.fileName,data.newJson, statuses, force);
            }

            Utils.log(`Data Collected.`);
            return statuses;
        }catch(err){
            throw new Error(err);
        }
    }    

}

module.exports = GetData;