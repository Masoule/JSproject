const modal = document.getElementsByClassName('modal')[0];
const open = document.getElementById("open-modal");
const close = document.getElementsByClassName("close-modal")[0];

open.onclick = function() {
    modal.style.display = "block";
};

close.onclick = function() {
    modal.style.display = "none";
};

window.onclick = function(event) {
  if (event.target == modal) {
      modal.style.display = "none";
  }
};

//data files
var idsCSV = 'https://s3.amazonaws.com/war-maps/country_to_id.csv';
var mapCSV = 'https://s3.amazonaws.com/war-maps/map_data.csv';
var plotCSV = 'https://s3.amazonaws.com/war-maps/plot_data_1.csv';
var mapPath = 'https://s3.amazonaws.com/war-maps/worldMap.json';
//alternative rectangular map
// var path = d3.geoPath(d3.geoEquirectangular().translate([width / 2, height / 2]));
//alternative online map
// var mapPath = "https://unpkg.com/world-atlas@1/world/110m.json";

var start_year = 1400;
var numberFormat = d3.format(",d")

//map element
var width = (window.innerWidth) * 0.9,
    height = (window.innerHeight) * 0.7;

var svg = d3.select("section").insert("svg")
  .attr("id", "map")
  .attr("height", height)
  .attr("width", width);

var projection = d3.geoRobinson()
  .translate([width / 2, height / 2]);

var path = d3.geoPath(d3.geoRobinson().translate([width / 2, height / 2]));

//tooltip
var tooltipDiv = d3.select("section")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

//plot element
d3.select("section").insert("p")
  .attr("id", "plot-container")

//headline
d3.select("section p").insert("h1", ":first-child")
  .text("Human Casualties of War");

d3.select("section p")
  .insert("h2")

var margin =
    {top: (window.innerHeight) * 0.1, right:10, bottom:0, left:10},
    plotWidth = width - margin.left - margin.right,
    plotHeight = (window.innerHeight) * 0.4 - margin.top - margin.bottom;

var x = d3.scaleLinear()
      .rangeRound([0, plotWidth]),
    y = d3.scaleLinear()
      .rangeRound([plotHeight, 0]);

var plotEl = d3.select("section p")
    .append("svg")
      .attr("id", "plot")
      .attr("width", plotWidth + margin.left + margin.right)
      .attr("height", plotHeight + margin.top + margin.bottom)
    .append("g")
      .attr("class", "plot")
      .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

// slider element
d3.select("section p").append("input")
  .attr("type", "range")
  .attr("min", "1400")
  .attr("max", "2000")
  .attr("value", start_year)
  .attr("id", "slider")
  .style("width", width + "px")

  // var handle = slider.insert("circle", ".track-overlay")

//find country id's to find the location on map
var rawMapData
var country_to_id

//load map data
d3.csv( idsCSV, function(ids) {
  country_to_id = ids
  d3.csv(mapCSV, function(csv) {
    rawMapData = csv.map( d => {
      d.killed = +d.killed
      d.year = +d.year
      d.duration = +d.duration
      d.name = d.name
      d.country = d.country.trim()
      var id_array = country_to_id.filter(dd => d.country === dd.country )
      d.id = id_array.length ? id_array[0].id : 'X'
      d.description = d.description
      return d
    })

    let data = filterMapData(start_year)
    let color = colorGradient(data);
    // load map
    initializeMap(data, color)
    //add plot
    renderPlot(start_year);

    // update with slider input
    d3.select("#slider").on("input", function() {
        console.log(this.value)
        let selectedYear = this.value;
        let newData = filterMapData(selectedYear)
        let newColor = colorGradient(newData);
        updateMap(newColor, newData);
        renderPlot(selectedYear);

    // d3.select("#slider").insert("g", ".track-overlay")
    //     .attr("class", "ticks")
    //     .attr("transform", "translate(0," + 18 + ")")
    //   .selectAll("text")
    //   .data(x.ticks(10))
    //   .enter().append("text")
    //     .attr("x", x)
    //     .attr("text-anchor", "middle")
    //     .text(function(d) { return selectedYear; });
    });
  });
})//data

var default_color = d3.rgb("#f7f7f7");
var quantiles = [0, 0.2, 0.4, 0.6, 0.8, 1];

function filterMapData(year) {
  return rawMapData.filter(d => d.year >= year - 10 && d.year <= year )
}

function initializeMap(data, color) {
  d3.json(mapPath, function(error, worldmap) {
    if (error) throw error;
    //adds colors
    svg.append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(topojson.feature(worldmap, worldmap.objects.world).features)
      .enter().append("path")
        .attr("d", path)
        .attr("id", function(d) { return d.id; })
        .call(fillMap, color, data)

    //add circles
    var circles = svg.append("g")
    .attr("class", "circles")

    circles.selectAll("circle")
    .data(topojson.feature(worldmap, worldmap.objects.world).features)
    .enter().append("circle")
    .attr('class', 'circle')
    .attr('id', d => d.id)
    .attr("transform", function(d) { /*console.log(d, path.centroid(d));*/ return path.centroid(d)[0] ? "translate(" + path.centroid(d) + ")" : "translate(0,0)"; })
    .on("mouseover", (d) => mouseover(d, data))
    .on("mouseout", function(d) {
      tooltipDiv.transition()
      .duration(500)
      .style("opacity", 0);
    })
    .call(addCircle, data)
  })
}

function updateMap(color, data) {
  // update colors
  d3.selectAll("svg#map path").transition()
    .delay(50)
    .call(fillMap, color, data)

  //update circles
  d3.selectAll("svg#map circle").transition()
    .delay(50)
    .call(addCircle, data);

  d3.selectAll("svg#map circle")
  .on("mouseover", (d) => mouseover(d, data))

  // update path titles
  // d3.selectAll("svg#map path title")
  //   .call(showInfo, data);
}

function mouseover(d, data) {
  var data_row = data.filter(dd => dd.id ===d.id)
  data_row = data_row.length ? data_row[0] : {killed: 0}
  tooltipDiv.transition()
  .duration(200)
  .style("opacity", .9);
  tooltipDiv.html(data_row.name + "<br/>" + data_row.description + "<br/>" + (data_row.killed===0 ? 'unkonwn' : "over " + numberFormat(data_row.killed)) + " casualties" + "<br/>")
  .style("left", (d3.event.pageX) + "px")
  .style("top", (d3.event.pageY - 28) + "px");
}

function addCircle(selection, data) {
  var radius = d3.scaleSqrt()
    .domain([0, 5000])//d3.max(data, d => d.killed)])
    .range([0, 15]);

  selection
      .attr('class', function(d, i) {
        var data_row = data.filter(dd => dd.id ===d.id)
        if(data_row.length) {
        }
        return data_row.length && data_row[0].killed===0 ? 'circle unknown' : 'circle'
      })
      .attr("r", function(d, i) {
        var data_row = data.filter(dd => dd.id ===d.id)
        data_row = data_row.length ? data_row[0] : {killed: -1 }

        return data_row.killed === 0 ?
        5 : (data_row.killed < 0 ? undefined : radius(data_row.killed));
      })
}

//adding color gradient to countries
function colorGradient(data) {
  let data_values = data.sort( function(a, b){ return a.killed - b.killed; });
  var quantiles_calc = quantiles.map( function(elem) {
    return Math.ceil(d3.quantile(data_values, elem));
  });

  let scale = d3.scaleQuantile()
  .domain(quantiles_calc)
  .range(d3.schemeGreys[(quantiles_calc.length)-1]);
  return scale;
}

function fillMap(selection, color, data) {
  selection
    .attr("fill", function(d) { return typeof data[d.id] === 'undefined' ? default_color : d3.rgb(color(data[d.id])); });
}

//plot functions
var rawData, filteredData;

function renderPlot(selectedYear) {
  d3.csv(plotCSV, function(csv) {
    rawData = csv.map(d => {
      d.killed = +d['total_mortalities']
      d.year = +d.year
      return d
    }).sort((a, b) => a.year - b.year)
    filterData(selectedYear)
    initializeChart()
  })
}

function filterData(thisYear) {
  filteredData = rawData.filter( d => d.year <= thisYear)

  //update headline
  let yearRange = thisYear - 10;
  let total = 0;
  var rangeData = rawData.filter( d => { return d.year <= thisYear && d.year >= yearRange; })
  rangeData.map( (d) => total += d.killed )

  var thisYearData = filteredData.filter( d => {  return parseInt(d.year) === parseInt(thisYear); })
  thisYearData = thisYearData.length ? thisYearData[0] : {killed: 10}
  d3.select("h2")
    // .attr('class', 'odometer')
    .text( "over " + numberFormat(total) + " between " + yearRange + " and " + thisYear );
}

function initializeChart() {
  var area = d3.area()
    .curve(d3.curveMonotoneX)
    .x(function(d) { return x(d.year); })
    .y1(function(d) { return y(d.killed); });

  x.domain(d3.extent(rawData, function(d) { return d.year; }));
  y.domain([0, d3.max(rawData, function(d) { return d.killed; })]);
  area.y0(y(0));

  let plot = d3.select("svg#plot g.plot")
  plot.selectAll('path').remove()

  plot.append("path")
      .datum(filteredData)
      .attr("fill", "red")
      .attr("d", area)
      .on('mouseover', (d) => {
      })

  plot.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))

  plot.append("g")
      .attr("transform", "translate(0," + width + ")")
      .call(d3.axisLeft(y))

  // var xAxis = d3.svg.axis().scale(x)
  // .orient("bottom").ticks(5);

  plot.append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      // .text("Total casualties")

  plot.append("text")
      .attr("fill", "#000")
      .attr("x", 6)
      .attr("dx", "0.71em")
      .attr("text-anchor", "end")
      // .text("year")
}
