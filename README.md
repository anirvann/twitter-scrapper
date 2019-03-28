# Twitter-scrapper
A twitter scrapper using nodejs + puppeteer. Coupled with sentiment analysis

## Tech stack
* NodeJS - Express JS to load the scrapper in browser [link](http://localhost:3000/)
* Puppeteer - start a headless instance of chrome to scrape twitter
* socket.io - to send the scrapped twitter data to browser
* wink-sentiment - perform sentiment analysis on data
* D3 - used in browser to render bubble chart.

## How to use
* Load the browser [link](http://localhost:3000/)
* Put the hashtag and days (both are needed to activate the button)
* Level 1 - use this to search just the hashtag
* Level 2 - use this to search all the handles who tweeted the searched hashtag for the entered number of days

# TODO
* show tweets
* allow user to save tweets
* show scrapping progress in browser
* stemming

## Page screenshot
![page screenshot](https://github.com/anirvann/twitter-scrapper/blob/master/public/images/page..png?raw=true)
