(function() {
	var socket = io();
	var tweetData = [];
	var hashtag = document.querySelector('#hashtag'),
		days = document.querySelector('#days'),
		submitBtn = document.querySelector('#submit'),
		level = document.querySelectorAll("input[type=radio]"),
		selectedLevel = document.querySelector("input[type=radio]:checked");

	var hashtagValue = "",
		daysValue = "",
		levelValue = level.value;

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
		tweetData = [];
		socket.emit('scrape-config', {
			hashtag: hashtagValue,
			days: daysValue,
			level: levelValue
		});
		return false;
	});
	socket.on('data', function(response) {
		tweetData = [tweetData, response.data].flat();
		renderBubbleChart(structureData(tweetData));
		// document.querySelector('#result').textContent += JSON.stringify(msg);
	});

	var submitBtnState = function() {
		if (!!hashtagValue && !!daysValue) {
			submitBtn.removeAttribute("disabled");
		} else {
			submitBtn.setAttribute("disabled", true);
		}
	};
})();

function structureData(data) {
	window.tweetData = data;
	const firstLevelHashtags = data.map(datum => datum.hashtags).flat();
	// const secondLevelHashtags = data['second-level-data'].flat().map(datum => datum.hastags).flat();

	const firstHashtagCountColln = {};
	// const secondHashtagCountColln = {};

	const flattenedHashtags = data
		.map(datum => datum.hashtags.map(d => ({
			hashtag: d,
			mentions: datum.mentions,
			category: datum.category
		})))
		.flat();
	// .reduce((acc, obj) => {
	// 	acc[obj.hashtag] = { count: ((acc[obj.hashtag] && acc[obj.hashtag].count) || 0) + 1, category: obj.category };
	// 	return acc;
	// }, firstHashtagCountColln);
	const uniqueFirstLevelHashtags = [...new Set(firstLevelHashtags)];
	const level1Sentiment = data.filter(datum => datum.category === 'level1');
	const level1SentimentValue = level1Sentiment.reduce((acc, val) => acc + parseFloat(val['sentiment']['score'], 10), 0) / level1Sentiment.length;

	document.querySelector('#sentiment .badge').innerText = level1SentimentValue.toFixed(2);
	document.querySelector('#sentiment .badge').classList.remove('badge-success');
	document.querySelector('#sentiment .badge').classList.remove('badge-danger');
	document.querySelector('#sentiment .badge').classList.add(level1SentimentValue > 0 ? 'badge-success' : 'badge-danger');

	// secondLevelHashtags.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, secondHashtagCountColln);
	// const uniqueSecondLevelHashtags = [...new Set(secondLevelHashtags)];

	// return [
	//   uniqueFirstLevelHashtags.map(hashtag => ({
	//     title: hashtag, category: 'direct-mentions', views: firstHashtagCountColln[hashtag]
	//   })),
	//   uniqueSecondLevelHashtags.map(hashtag => ({
	//     title: hashtag, category: 'user-also-tweeted', views: secondHashtagCountColln[hashtag]
	//   }))
	// ].flat();
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
		containerWidth = document.querySelector('.container').clientWidth,
		screenHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
		width = (containerWidth * 3 / 4) - margin.left - margin.right,
		height = screenHeight - margin.top - margin.bottom - 100,
		circleScale = 2;

	const color = d3.scaleOrdinal(data.map(d => d.group), d3.schemeCategory10);

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