'use strict';

// do not touch this, bitch!
const mainUrl = "https://ff.manga-online.biz";
const config = require('./config.json');

// for requests
const axios = require("axios");
const cheerio = require('cheerio');
const axiosRetry = require('axios-retry');
const ProgressBar = require('progress');

// const for filesystem
const theFs = require("fs");
const thePath = require("path");

// config const
const url = config.url;
const retriesRec = config.retries;
const width = config.width;
const completeView = config.completeView;

// retries
axiosRetry(axios, { retries: retriesRec });

// create folders
function createFolders(path) {
    if (!theFs.existsSync(path))
        theFs.mkdirSync(path, { recursive: true });
}

// replace all
function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
}


// function create files.
function createFile(data, name) {
    let fs = require('fs');
    fs.writeFileSync(name, data.toString());
}

// return clear name without trash.
function returnClearName(fullUrl) {
    let name = fullUrl.split('/').at(-1);
    let repSymbols = replaceAll(name, "_", " ").replace("-", "").replace(/\s{2,}/g, ' ');
    return replaceAll(repSymbols, " ", '_');
}

// create path.
function createPath(folderName, fileName) {
    let toFolder = `${__dirname}/${folderName}/`;
    let path = thePath.resolve(__dirname, folderName, fileName);
    createFolders(toFolder);
    return path;
}

// return cheerio object.
async function cheerioObject() {
    const { data } = await axios.get(url)
        .catch((err) => {
            if (err.response.status !== 200) { throw new Error(`Failed status code: ${err.response.status};`);}
        });
    return cheerio.load(data);
}

// return cache.
async function returnListCache() {
    let newMassive = [];
    let cheerioObj = await cheerioObject(url);
    let regex = /"downloadUrl":"([^&]+)/gm;
    let htmlResult = cheerioObj.html();
    let result = htmlResult.match(regex);
    let newResult = result.at(0).concat(result.at(1));
    console.log(`-- Значений в массиве: ${result.length};`); // Пусть выводит, пригодится.
    let replacer = /[`~!@#$%^&*()|+=?;:'<>{}\[\]\\]/gi
    let textReplace = newResult.replace(replacer, '');
    let pattern = /\/download\/([^"]+)/gm;
    let fullResult = textReplace.match(pattern);
    for (let f of fullResult) {
        let m = mainUrl + f;
        newMassive.push(m);
    }
    createFile(newMassive, createPath("cache", "links.tmp"));
    return newMassive;
}

// return manga name.
async function returnMangaName() {
    let cheerioObj = await cheerioObject(url);
    let mangaName = cheerioObj("h1.header").text().trim();
    let splitName = mangaName.split("/").at(0).trimEnd();
    console.log(`-- Манга: ${mangaName};`); // Название манги.
    return replaceAll(splitName, " ", "_");
}

// function for check tmp files on index and more.
function lastCheckUrl(index, data) {
    try {
        // get index from list;
        let path = createPath("cache", "index.tmp");
        let forUrl = createPath("cache", "url.tmp");
        let duplicateList = data.slice();
        let dubReverse = duplicateList.reverse()
        let ires = dubReverse.indexOf(index);
        createFile(ires, path);
        createFile(index, forUrl);
    }
    catch (e)
    {
        console.log('Произошла ошибка при создании tmp кэша:', e);
    }
}

// download function. do not touch this.
async function downloadFile(url, dir, name)
{
    try
    {
        let toFolder = `${__dirname}/download/`;
        let forFolder = toFolder + dir;
        let path = thePath.resolve(toFolder, dir, name);
        createFolders(forFolder)
        let { data, headers } = await axios({
            url,
            method: "GET",
            responseType: "stream"
        })
        let writer = theFs.createWriteStream(path);
        let totalLength = headers["content-length"];
        let progressbar = new ProgressBar(`-> Загружаем [${name}] // [:bar] :percent, :rate/bps // :etas`, {
            width: width,
            complete: completeView,
            total: parseInt(totalLength)
        })
        data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
            data.on('data', (chunk) => progressbar.tick(chunk.length));
        })
    }
    catch (e)
    {
        console.log(`Error in downloadFile:`, e);
    }
}


// help function for main.
async function pastStartProcedure(data) {
    let nameFolder = await returnMangaName();
    console.log(`-- Всего элементов в списке загрузок: ${data.length};`) // Надеюсь полезная инфа.
    console.log(`-- Основные кэш файлы будут созданы после первой загрузки архива;`);
    for (let url of data) {
        let clearName = returnClearName(url);
        await downloadFile(url, nameFolder, clearName);
        lastCheckUrl(url, data);
    }
}

// main function.
async function startProcedure() {
    try {
        let lastData = await returnListCache();
        let path = createPath("cache", "index.tmp");
        if (!theFs.existsSync(path)) {
            await pastStartProcedure(lastData);
        }
        else {
            let readData = theFs.readFileSync(path, 'utf8')
            let indexData = parseInt(readData);
            if (indexData !== lastData.length)
            {
                let sliceData = lastData.slice(-indexData);
                await pastStartProcedure(sliceData);
            }
        }
    } catch (err) {
        console.error("Error in main procedure:", err);
    }
}

// cho za huinya odinokaya.
startProcedure();