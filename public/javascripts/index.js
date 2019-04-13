(function() {
	var socket = io();
	var tweetData = [];
	var hashtag = document.querySelector('#hashtag'),
		days = document.querySelector('#days'),
		submitBtn = document.querySelector('#submit'),
		level = document.querySelectorAll("input[type=radio]"),
		selectedLevel = document.querySelector("input[type=radio]:checked"),
		notification = document.querySelector('.notification'),
    scrapedURLIndex = 0;

	var hashtagValue = "",
		daysValue = "",
		levelValue = level.value,
		secondLevelTweetCount;

	hashtag.addEventListener("change", function(e) {
		hashtagValue = e.target.value;
		submitBtnState();
	});
	days.addEventListener("change", function(e) {
		daysValue = e.target.value;
		submitBtnState();
	});
	Array.prototype.forEach.call(level, function(radio) {
		radio.addEventListener('change', function(e) {
			levelValue = e.target.value;
		});
	});
	submitBtn.addEventListener("click", function(e) {
		e.preventDefault();
		submitBtn.disabled = true;
		submitBtn.innerText = 'scraping...';
		tweetData = [];
		socket.emit('scrape-config', {
			hashtag: hashtagValue,
			days: daysValue,
			level: levelValue
		});
		return false;
	});
	socket.on('disconnect', () => {
		socket.open();
	});
	socket.on('tweet-data', function(response) {
		if(response.data[0].category === 'level1'){
			renderNotification(notification, 'first level data result');
			notification.querySelector('span').innerText = '';
			notification.setAttribute('hidden', true);
			submitBtn.innerText = 'Search';
			submitBtn.disabled = false;
		}else{
			renderNotification(notification, `second level data: (${scrapedURLIndex++}/${secondLevelTweetCount}) `);
		}
		tweetData = [tweetData, response.data].flat();
		renderBubbleChart(structureData(tweetData));
	});

	socket.on('result-detail', function(response) {
		console.log('result-detail');
		secondLevelTweetCount = response.secondLevelTweetCount;
		renderNotification(notification, `second level data: (${scrapedURLIndex}/${secondLevelTweetCount}) `);
	});

	socket.on('done', function(response) {
		notification.querySelector('span').innerText = '';
		notification.setAttribute('hidden', true);
		submitBtn.innerText = 'Search';
		submitBtn.disabled = false;
	});

	var submitBtnState = function() {
		if (!!hashtagValue && !!daysValue) {
			submitBtn.removeAttribute("disabled");
		} else {
			submitBtn.setAttribute("disabled", true);
		}
	};
})();

function renderNotification(elem, msg){
	elem.removeAttribute('hidden');
	elem.querySelector('span').innerText = msg;
}

function structureData(data) {
	window.tweetData = data;
	const firstLevelHashtags = data.map(datum => datum.hashtags).flat();
	const badgeElem = document.querySelector('#sentiment .badge');
	const positiveListContainer = document.querySelector('.list-group.positive');
	const negativeListContainer = document.querySelector('.list-group.negative');
	const flattenedHashtags = data
		.map(datum => datum.hashtags.map(d => ({
			hashtag: d,
			mentions: datum.mentions,
			category: datum.category
		})))
		.flat();
	const uniqueFirstLevelHashtags = [...new Set(firstLevelHashtags)];
	const sentimentValue = data.reduce((acc, val) => acc + parseFloat(val['sentiment']['score'], 10), 0) / data.length;

	badgeElem.innerText = sentimentValue.toFixed(2);
	badgeElem.classList.remove('badge-success');
	badgeElem.classList.remove('badge-danger');

	badgeElem.classList.add(sentimentValue > 3.5 ? 'badge-success' : sentimentValue > 2 ? 'badge-warning' : sentimentValue > 0 ? 'badge-secondary' : 'badge-danger');
	tweetExtractor(data, positiveListContainer, negativeListContainer);
	return uniqueFirstLevelHashtags.map(hashtag => {
		const matchingHashtags = flattenedHashtags.filter(fht => fht.hashtag === hashtag);
		return {
			title: hashtag,
			category: [...new Set(matchingHashtags.map(mht => mht.category))].length > 1 ? 'level0' : matchingHashtags[0].category,
			count: matchingHashtags.length
		};
	});
};

function renderBubbleChart(data) {
	const margin = {
			top: 0,
			right: 20,
			bottom: 0,
			left: 20
		},
		containerWidth = document.querySelector('.container-fluid').clientWidth,
		screenHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
		width = (containerWidth * 3 / 4) - margin.left - margin.right,
		height = screenHeight - margin.top - margin.bottom - 100,
		circleScale = 2;

	const color = d3.scaleOrdinal(data.map(d => d.category), ['#000000', '#0900b1', '#6aabd1' ]);

	d3.select("#bubble_chart svg").remove();

	const chartDiv = d3.select("#bubble_chart"),
		svg = chartDiv
			.append("svg")
			.attr("width", width)
			.attr("height", height),
		g = svg.append("g");

	const pack = colln => d3.pack()
		.size([width - 2, height - 2])
		.padding(3)
		(d3.hierarchy({
			children: colln
		})
		.sum(d => d.count));

	const root = pack(data);

	const leaf = g.selectAll("g")
		.data(root.leaves())
		.join("g")
		.attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);

	leaf.append("circle")
		.attr("r", d => d.r)
		.attr("fill-opacity", 0.7)
		.attr("fill", d => color(d.data.category));

	leaf.append("text")
		.text(d => d.data.title)
		.style("width", d => 2 * d.r)
		// .style("color")
		.style("font-size", d => {
			let textWidthRatio = 1;
			const availableWidth = 2 * d.r - 4;
			let textWidth = d.data.title.length * 12 * textWidthRatio;
			while(textWidth > availableWidth && textWidthRatio > 0.05){
				textWidthRatio -= 0.05;
				textWidth = d.data.title.length * textWidthRatio * 12;
			}
			return `${textWidthRatio}em`;
		})
		.attr("transform", d => `translate(-${d.r / 2},0)`);

	g.append("rect")
	    .attr("width", width)
	    .attr("height", height)
	    .style("fill", "none")
	    .style("pointer-events", "all")
	    .call(d3.zoom()
	        .scaleExtent([1 / 2, 10])
	        .on("zoom", function () {
				g.attr("transform", d3.event.transform);
			}));
}

function tweetExtractor(data, positiveListContainer, negativeListContainer){
	positiveListContainer.innerHTML = '';
	negativeListContainer.innerHTML = '';
	var top10PositiveTweets = data.sort(function(a, b){
		return b.sentiment.normalizedScore - a.sentiment.normalizedScore;
	}).slice(0, 10);
	var top10NegativeTweets = data.sort(function(a, b){
		return a.sentiment.normalizedScore - b.sentiment.normalizedScore;
	}).slice(0, 10);
	console.log(top10NegativeTweets.length, top10NegativeTweets.length);
	top10PositiveTweets.forEach(function(tweetObj){
		positiveListContainer.innerHTML = positiveListContainer.innerHTML + `<li class="list-group-item list-group-item-success">${tweetObj.tweet}<strong>[${tweetObj.sentiment.normalizedScore}]</strong></li>`;
	});
	top10NegativeTweets.forEach(function(tweetObj){
		negativeListContainer.innerHTML = negativeListContainer.innerHTML + `<li class="list-group-item list-group-item-danger">${tweetObj.tweet}<strong>[${tweetObj.sentiment.normalizedScore}]</strong></li>`;
	});
};