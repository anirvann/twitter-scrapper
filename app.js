function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

async function autoScroll(page, days) {
    try {
        let scroll = true,
            previousHeight,
            scrollDelay = 400;
        while (scroll) {
            let timeStamp = await page.evaluate(async () => {
                let tweetTimeStampsColln = Array.from(
                    document.querySelectorAll(".tweet-timestamp span")
                );
                return tweetTimeStampsColln[tweetTimeStampsColln.length - 1].dataset.timeMs;
            });
            if ((new Date() - parseInt(timeStamp, 10) >= days * 24 * 60 * 60 * 1000)) {
                scroll = false;
                console.log(`scroll: ${scroll}`);
                break;
            }
            previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
            await page.waitFor(scrollDelay);
        }
    } catch (e) {
        console.log(`error :: ${e}`);
    }
};

async function getDataFromUrl(days, page, url, category, sentiment, socket) {
    console.log(`URL :: ${url}`);

    await page.goto(url);
    await autoScroll(page, days);

    const tweets = await page.evaluate(async () => {
        return Array.from(document.querySelectorAll("div.tweet.original-tweet")).map(tweet => ({
            mentions: (
                tweet.innerText
                .trim()
                .replace(/\n/g, " ")
                .match(new RegExp(/@([\w]*)/, "g")) || []
            ).map(mention => mention.substr(1)),
            hashtags: (
                tweet.innerText
                .trim()
                .replace(/\n/g, " ")
                .match(new RegExp(/#([\w]*)/, "g")) || []
            ).map(hashtag => hashtag.substr(1)),
            tweet: tweet.innerText.replace(/\n/g, "")
        }))
    });
    page.close();
    // console.log(tweets);
    const result = tweets.map(tweetData => ({ ...tweetData,
        ...{
            category: category,
            sentiment: sentiment(tweetData.tweet)
        }
    }));
    socket.emit('tweet-data', {
        data: result
    });
    console.log('tweet-data');
    return result;
};

(async () => {
    const fs = require("fs");
    const puppeteer = require("puppeteer");
    const parallelLimit = require('async/parallelLimit');
    const createError = require('http-errors');
    const http = require('http');
    const express = require('express');
    const path = require('path');
    const cookieParser = require('cookie-parser');
    const logger = require('morgan');
    const debug = require('debug')('twitter-scrapper:server');
    const sentiment = require( 'wink-sentiment' );

    /*{
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }*/
    const browser = await puppeteer.launch();
    const url = "https://twitter.com/search?f=tweets&q=%23";
    const app = express();
    const port = process.env.PORT || '8888';
    const maxParallelRequests = 5;

    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({
        extended: false
    }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    app.use('/', function(req, res) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        next(createError(404));
    });

    const server = http.createServer(app);
    const io = require('socket.io')(server);

    io.sockets.setMaxListeners(15);
    io.sockets.on('connection', function(socket) {
        console.log('a user connected');
        socket.on('disconnect', function() {
            console.log('user disconnected');
        });
        socket.on('scrape-config', async function(obj) {
            // let page = await browser.newPage();
            socket.emit('notification', {
                msg: '... scraping first level data'
            });
            const tweetData = await getDataFromUrl(parseInt(obj.days, 10), await browser.newPage(), `${url}${obj.hashtag}`, 'level1', sentiment, socket);
            // page.close();
            socket.emit('tweet-data', {
                data: tweetData
            });
            if (obj.level === "2") {
                console.log(typeof tweetData);
                const handles = tweetData.map(tweet => tweet.mentions).flat();
                const uniqueHandles = [...new Set(handles)];
                socket.emit('result-detail', {
                    secondLevelTweetCount: uniqueHandles.length
                });
                parallelLimit(
                    uniqueHandles.map(handle => async () => await getDataFromUrl(parseInt(obj.days, 10), await browser.newPage(), `https://twitter.com/${handle}`, 'level2', sentiment, socket)),
                    maxParallelRequests,
                    function(err, result) {
                        socket.emit('done');
                    });
            }
        });
        socket.on('error', function(err) {
            logger.debug(`Found error: ${err}`);
        });

        socket.on('close', function() {
            logger.debug('connection closed.');
        });
    });

    server.listen(port, () => console.log(`Server started on http://localhost:${port}`));
    server.on('error', onError);
    server.on('listening', function() {
        const addr = server.address();
        const bind = typeof addr === 'string' ?
            'pipe ' + addr :
            'port ' + addr.port;
        debug('Listening on ' + bind);
    });
})();