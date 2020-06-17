<!-- main script -->
<script>

//processing intersections library
var ShapeInfo = KldIntersections.ShapeInfo;
var Intersection = KldIntersections.Intersection;

//parallel processing
var p = new Parallel([1, 2, 3, 4, 5]);

//visualization variables
var width = 1000;
var height = 600;
var backgroundColor = "#eeeeee";

//*****
//options for layer assignments - these three arays must be same lengths!
//first is names that show up in the drop-down, then colors that become matching stroke colors
//finally are any material properties we would like to base calculations on
var targets = [
"-", 
"Total Barrier",
"Partition Wall",
"Light Reflecting",
"Sound Reflecting", 
'Light Diffusing',
"Sound Diffusing",
"Light Emmitter", 
"Sound Emmitter", 
"Light Transparent", 
"Sound Transparent", 
"Total Transparency", 
"Visually Distracting",
"Access"
];

var targetColors = [
"none", 
"#000000", 
"#555555", 
"#898E44",
"#582275",
"#E7EF77",
"#582275",
"#E3F20E",
"#9A00ED",
"#F0F78F",
"#8924BF",
"#CCCCCC",
"#CC4DAC",
"#C168AB"
];

var targetAttributes = [
{lightOpacity:0,soundOpacity:0},
{lightOpacity:1,soundOpacity:1},
{lightOpacity:.7,soundOpacity:.7},
{lightOpacity:.8,soundOpacity:1},
{lightOpacity:1,soundOpacity:.8},
{lightOpacity:.5,soundOpacity:1},
{lightOpacity:1,soundOpacity:.5},
{lightOpacity:1,soundOpacity:0},
{lightOpacity:0,soundOpacity:1},
{lightOpacity:.1,soundOpacity:1},
{lightOpacity:1,soundOpacity:.1},			
{lightOpacity:0,soundOpacity:0},
{lightOpacity:.6,soundOpacity:.6},
{lightOpacity:.3,soundOpacity:.3},
]

//how far can we see at max?
var viewingDistance = 1000;

//connect button to upload action
document.getElementById('upload').addEventListener('change', submitFile);

//create svg drawing area
var svg = d3.select("body").append("svg").attr('width',width).attr('height',height);

//add background rectangle
svg.append('rect').attr('width',width).attr('height',height).attr('fill',backgroundColor);
//connect interactions to SVG container
svg.call(d3.zoom()
	.extent([[0, 0], [width, height]])
	.scaleExtent([.25, 8])
	.on("zoom", zoomed))      

//create group for global zooming/panning
svg.append('g').attr('id','motionGroup').append('g').attr('id','geometryGroup')
motionGroup = d3.select('#motionGroup')

//line generator function
var lineFunction = d3.line()
.x(function(d) { return d.x; })
.y(function(d) { return height - d.y; })

//when a file is uploaded...
function submitFile() {
	var files = this.files;
//user bailed on upload
if (files.length === 0) {
	console.log('No file is selected');
	return;
}
//get text out of file
var reader = new FileReader();
reader.readAsText(files[0]);

//when text is ready...
reader.onload = function(event) {
//capture text
dxfString = event.target.result;
//send text to parser
parseDXF(dxfString)					
};
}

//when a DXF string is ready...
function parseDXF(string){
//load parser
var parser = new DxfParser();
//parse as DXF
var dxfObj = parser.parseSync(string);

//create empty collectors 
layerList = [];
drawList = [];

//iterate through all DXF entities, collect their layer names, and decide if they can and should be drawn
dxfObj.entities.forEach(function(entity){
	layerList.push(entity.layer)	

//parse circles and generate intersector objects
if (entity.type == "CIRCLE"){
	entity.svgType = 'circle'
	entity.attrs = {cx: entity.center.x, cy: height - entity.center.y, r: entity.radius}
	entity.intersector = ShapeInfo.circle({center: [entity.center.x, height - entity.center.y], radius: entity.radius})
	drawList.push(entity);
}

//parse arcs and arc-like segments and generate intersector objects
else if (entity.type == "ARC"){
	entity.svgType = 'path'
	arcPath = describeArc(entity.center.x, height - entity.center.y, entity.radius,entity.startAngle,entity.endAngle)
	entity.attrs = { d: arcPath }
	ShapeInfo.arc(entity.center.x, height - entity.center.y, entity.radius, entity.radius, entity.startAngle, entity.endAngle)
	drawList.push(entity);
}

//parse linear elements and generate intersector objects
else if ((entity.type == "LINE") || (entity.type == "POLYLINE") || (entity.type == "UWPOLYLINE") || (entity.type == "LWPOLYLINE")){
	entity.svgType = 'path'
	linePath = lineFunction(entity.vertices)
	entity.attrs = { d: linePath }
	intVerts = []
	entity.vertices.forEach(function(vert){
		intVerts.push(vert.x)
		intVerts.push(height - vert.y)
	})
	entity.intersector = ShapeInfo.polyline(intVerts)	 
	drawList.push(entity);
}

else{
//work to be done! 
//see any entity types that have not been processed
//console.log(entity.type)
}
})

//get unique layer names
var layers = Array.from([...new Set(layerList)]);

//send layer names to drop downs...
updateCorrelates(layers,drawList)

//prepare and permit JSON download of DXF file	
// var data = new Blob([JSON.stringify(dxfObj)], {type: 'text/plain'});
// var url = window.URL.createObjectURL(data);
// document.getElementById('download_link').href = url;
}

//when layers have been collected for assignment....
function updateCorrelates(layers, entities){
//remove upload button
d3.select('input#upload').remove();

//create dropdown area, labels, and dropdowns
var targetGroup = d3.select('#correlates').selectAll("div").data(layers).enter().append('div').attr('class','targetGroups');
targetGroup.append("div").attr('class','targetLabels').text(function(d){return d;});
targetGroup.append("div").attr('class','targetSelects').append("select").attr("class", "targetLists").on("change", function () { updateDrawing(entities,layers)
});

//add options to select dropdowns
targetGroup
.selectAll('select')
.selectAll("option")
.data(targets)
.enter()
.append("option")
.text(function(d) {return d;})
.attr("value", function(d) {return d;});

//Set to default
//work to be done, predictive?
targetGroup
.selectAll('select')
.property('value', 'Total Barrier')

//send geometry to be drawn!
drawDXF(entities)

//recolor visualization based on dropdown settings
updateDrawing(entities,layers)

//*****
//available options for gradient mesh visualization
//var parameters = ["MinDistance","MaxDistance","ViewAverage","VisualFactorAverage","AcousticFactorAverage","DoorCount","WindowCount","Privacy"];
var parameters = ["Inclusion"]

//create dropdown for floorplan analysis parameter
// d3.select('#correlates')
// 	.append("select")
// 	.attr("id", "visualParameter")
// 	.selectAll("option")
// 	.data(parameters)
// 	.enter()
// 	.append("option")
// 	.text(function(d) {return d;})
// 	.attr("value", function(d) {return d;})
// 	.style('display','none')

//create a button to run analysis
d3.select('#correlates').append('button').text('Evaluate Floorplan').attr('id','runSampling').on('click', function(){

	runSampling(entities)

});

//create a button to run analysis
d3.select('#correlates').append('button').text('Crop Floorplan').attr('id','runCrop').on('click', function(){
	crop(entities)
});

}

//when geometry is available to draw to screen...
function drawDXF(entities){
	console.log(entities);
//draw all geoemtric paths
d3.select("#geometryGroup")
.selectAll('.dxf')
.data(entities, function(d){return d.handle})
.enter()
.append(function(d) {
	return document.createElementNS(d3.namespaces.svg, d.svgType);
})
.attrs(function(d) {               
	return d.attrs;
})
.attr('fill','none')
.attr('stroke','black')
.attr('class','dxf')

//shift artboard to 0,0
geoGroup = d3.select('#geometryGroup')
boundingRect = geoGroup.node().getBoundingClientRect()
geoGroup.attr('transform',"translate(" + (-boundingRect.x) + "," + (-boundingRect.y) + ")")
}


//when the user has selected a new layer assignment dropdown option...
function updateDrawing(entities,layers){

//empty collector
layerAssignments = []

//get user dropdown settings
d3.select("#correlates").selectAll("select").each(function(){layerAssignments.push(this.value)})

//create object to hold layer assignments
layerData = {}

//assign each geometry to a desired layer association
layers.forEach(function(layer,i){
	layerData[layer] = layerAssignments[i]
})

//recolor strokes, and assign inclusion attributes to each geometry
geoGroup.selectAll('.dxf')
.data(entities, function(d){return d.handle})
.transition()
.duration(500)
.attr('stroke',function(d){
	assignment = layerData[d.layer]
	return targetColors[targets.indexOf(assignment)]
})
.each(function(d,i){
	assignment = layerData[d.layer]
	d.assignment = assignment
	d.inclusionAttributes = targetAttributes[targets.indexOf(assignment)]
})		
}

//when layer assignments are done, we can sample the floorplan...
function runSampling(entities){
// d3.select('svg').append('rect').attr('width',width).attr('height',height).attr('opacity',.8).attr('fill','white').attr('id','loadingOverlay').attr('x',0).attr('y',0)

// d3.select('svg').append('text').text("Analyzing...").attr('x',width/2).attr('y',height/2).attr('text-anchor','middle').attr('id','loadingText')

//***** sampling density
xCount = 100;
yCount = 50;

//capture size of drawing
bbox = d3.select('#geometryGroup').node().getBBox();

//***** how many directions are we looking?
lines = 8;

//empty collectors
var intersectors = []
var samples = []

//build grid of sample points
for (var i = 0; i<xCount; i++){

	for (var j = 0; j<yCount; j++){
		startX = (i * (bbox.width/xCount)) + bbox.x;
		startY = (j * (bbox.height/yCount)) + bbox.y;

		samples.push({ position:[startX,startY], size:[bbox.width/xCount,bbox.height/yCount] });
		intersectors.push([]);

		for (var k=0;k<lines;k++){

			endX = startX + ( viewingDistance * Math.cos( ((2 * Math.PI) / lines) * k ));
			endY = startY + ( viewingDistance * Math.sin( ((2 * Math.PI) / lines) * k ));

			intersectors[ (i*yCount) + j ].push(ShapeInfo.line(startX, startY, endX, endY));
		}
	}
}

//create grid cells...
drawMesh(samples)
//analyze viewing distances and material properties...
calculateIntersections(intersectors,samples,entities)
//determine each cell's parameters...
calculateStats(samples)
//update the colors on the mesh...
updateMesh(samples)

//check if parameter dropdown is changed, and update visualization if so
//d3.select('#visualParameter').on('change', function(){updateMesh(samples);})
//kill unnecessary UI
d3.selectAll(".targetGroups").remove()
d3.selectAll("#runSampling").remove()
d3.selectAll("#runCrop").remove()

//d3.select("#overlayGroup").remove()
}

//when we have geometry drawn and samples created, we can look around...
function calculateIntersections(intersectors,samples,entities){
//evaluate each sample
for (var i = 0; i<samples.length; i++){
	samples[i].nearestObjects = []

//evaluate each ray from each sample
for (var j = 0; j<intersectors[i].length; j++){
	rayDistance = viewingDistance
	var hit = 0
	var closestObject = null;

//evaluate each geometry entity
for(var k = 0; k<entities.length; k++){
	var intersection = Intersection.intersect(intersectors[i][j], entities[k].intersector);

//check if we hit something and collect data about it if so
if (intersection.points.length > 0) {
	hit = 1
	var nearestIntersection = intersection.points[0]
	var nearestDistance = calcDistance(samples[i].position[0],samples[i].position[1], nearestIntersection.x,nearestIntersection.y)

	if (nearestDistance < rayDistance){
		closestObject = entities[k]
		rayDistance = nearestDistance
	}								
}
}

//remember colliders, if at least one collision happened
if (hit != 0 ){
	samples[i].nearestObjects.push( {collider:closestObject,distance:nearestDistance} )
}

}
}
}

//when each sample has had its intersections calculated and is ready to be analyzed...
function calculateStats(samples){
//iterate through samples
for (var i =0; i<samples.length; i++){

//access collided objects per sample
var colliderArray = samples[i].nearestObjects;
if (colliderArray.length == 0){return}
//calculate average light factor of each sample
var lightAverage = colliderArray.reduce((a,b) => a + b.collider.inclusionAttributes.lightOpacity, colliderArray[0].collider.inclusionAttributes.lightOpacity) / colliderArray.length;

//calculate average sonic factor of each sample
var soundAverage = colliderArray.reduce((a,b) => a + b.collider.inclusionAttributes.soundOpacity, colliderArray[0].collider.inclusionAttributes.soundOpacity) / colliderArray.length;

//calculate average viewing distance of each sample
var viewAverage = colliderArray.reduce((a,b) => a + b.distance, colliderArray[0].distance) / colliderArray.length;

//calculate lowest and highest viewing distance
var closestDistance = samples[i].nearestObjects.reduce((min, p) => p.distance < min ? p.distance : min, viewingDistance);
var furthestDistance = samples[i].nearestObjects.reduce((max, p) => p.distance > max ? p.distance : max, 0);

//calculate door and window counts
access = 0
windows = 0
lights = 0
sounds = 0

//count doors and windows nearby
for(var j=0;j<colliderArray.length;j++){
	if (colliderArray[j].collider.assignment == "Access"){access++}
		if (colliderArray[j].collider.assignment == "Light Emmitter"){lights++}
			if (colliderArray[j].collider.assignment == "Sound Emmitter"){sounds++}
				if (colliderArray[j].collider.assignment == "Light Transparent"){windows++}
			}

//record stats
samples[i].MinDistance = closestDistance;
samples[i].MaxDistance = furthestDistance;
samples[i].ViewAverage = viewAverage;
samples[i].VisualFactorAverage = lightAverage;
samples[i].AcousticFactorAverage = soundAverage;
samples[i].WindowCount = windows;
samples[i].AccessCount = access;
samples[i].WindowCount = windows;
samples[i].lightCount = lights;
samples[i].soundCount = sounds;

//***** weighing equation for inclusive space! 
samples[i].Inclusion = (samples[i].MinDistance*.25) + ((samples[i].MaxDistance*.25) - (samples[i].ViewAverage*.25)) + ((samples[i].AccessCount + samples[i].WindowCount)*.0625) - (.5 - samples[i].VisualFactorAverage) - (.5 - samples[i].AcousticFactorAverage)

}
}

function drawMesh(samples){

	toolTip = d3.select('#geometryGroup').append('g');

	toolTip.append('rect').attr('x',-1000).attr('y',-1000).attr('width',250).attr('height',60).attr('id','toolTip').attr('fill','white').attr('opacity',.75);
	toolTip.append('text').attr('id','toolTipText')

	var underlay = d3.select('#geometryGroup').insert('g',":first-child").attr('id','underlayGroup');


//var param = d3.select("#visualParameter").node().value; 
var param = "Inclusion"

reparameterize = d3.scaleLinear().domain(d3.extent(samples,function(d){return d[param]})).range([0,1]);


underlay.selectAll('.sampleRects')
.data(samples)
.enter()
.append('rect')
.attr('x',function(d){return d.position[0]})
.attr('y',function(d){return d.position[1]})
.attr('fill',backgroundColor)
.attr('width',function(d){return d.size[0]})
.attr('height',function(d){return d.size[1]})
.attr('opacity',1)
.attr('class','sampleRects')
.on('mouseover',function(d){
	mX = d3.mouse(this)[0];
	mY = d3.mouse(this)[1];

	d3.select('#toolTip').attr('x', mX).attr('y',mY);

	if (1-reparameterize(d[param]) < .2 ){
		var ttText = "Inclusion Rating: " + (1-reparameterize(d[param])).toFixed(2) + " - Consider Adding Partition Walls"
	}
	else{
		var ttText = "Inclusion Rating: " + (1-reparameterize(d[param])).toFixed(2) 

	}



	d3.select('#toolTipText').attr('x',mX+5).attr('y',mY+35).text(ttText);
// if (reparameterize(d[param]).toFixed(2) < .2){
//   d3.select('#toolTipText').attr('x',mX+5).attr('y',mY+55).text("This area is good!");
// }
})
}

//when a new selection is made to visualize...
function updateMesh(samples){
//var param = d3.select("#visualParameter").node().value; 
var param = "Inclusion"

reparameterize = d3.scaleLinear().domain(d3.extent(samples,function(d){return d[param]})).range([1,0]);

d3.select('#underlayGroup').selectAll('.sampleRects')
.data(samples)
.transition()
.duration(500)
//***** https://github.com/d3/d3-scale-chromatic
.attr('fill',function(d){return d3.interpolateYlGnBu(reparameterize(d[param]))})
}

//convert point in polar radians to cartesian xy 
function polarToCartesian(centerX, centerY, radius, angleInRadians) {
	return {
		x: centerX + (radius * Math.cos(angleInRadians)),
		y: centerY + (radius * Math.sin(-angleInRadians))
	};
}

//arc math
function describeArc(x, y, radius, startAngle, endAngle){

	var start = polarToCartesian(x, y, radius, endAngle);
	var end = polarToCartesian(x, y, radius, startAngle);

	var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";

	var d = [
	"M", start.x, start.y, 
	"A", radius, radius, 0, arcSweep, 1, end.x, end.y,
	].join(" ");

	return d;
}

//utility for hypotenuse/distance calculations
function calcDistance(x1,y1, x2,y2){
	deltaX = x1 - x2;
	deltaY = y1 - y2;

	return Math.sqrt(Math.pow(deltaY, 2) + Math.pow(deltaX, 2))
}

//when we zoom/pan, what happens?
function zoomed() {
	motionGroup.attr("transform", d3.event.transform);
}

function crop(entities){
	d3.select('#runCrop').remove();
	d3.select('#correlates').append('button').text('Finalize Crop').attr('id','finishCrop').on('click', function(){
		finishCrop(entities)
	});
	var svg = d3.select('svg');

	svg.on('.zoom', null);

	svg.on("mousedown", mousedown).on("mouseup", mouseup);
	svg.style('cursor','crosshair')
}

function mousedown() {
	var m = d3.mouse(this);
	var svg = d3.select('svg');
	svg.selectAll('.cropper').remove()

	rect = svg.append("rect")
	.attr("x", m[0])
	.attr("y", m[1])
	.attr("height", 0)
	.attr("width", 0)
	.attr('class','cropper')
	.attr("fill","cyan")
	.attr("opacity",".5");

	svg.on("mousemove", mousemove);
}

function mousemove(d) {
	var m = d3.mouse(this);

	rect.attr("width", Math.max(0, m[0] - +rect.attr("x")))
	.attr("height", Math.max(0, m[1] - +rect.attr("y")));
}

function finishCrop(entities){

	var rectX = parseInt(rect.attr('x')),
	rectY = parseInt(rect.attr('y')),
	rectW = parseInt(rect.attr('width')),
	rectH = parseInt(rect.attr('height'))

	var rectCoordinates = [ [rectX,rectY],[rectX+rectW,rectY],[rectX+rectW,rectY+rectH],[rectX,rectY+rectH],[rectX,rectY] ];    

	d3.select('#geometryGroup')
	.selectAll('.dxf')
	.data(entities, function(d){return d.handle})
	.each(function(dxf){
		var nd = d3.select(this).node()
		var centerX = parseInt(nd.getBoundingClientRect().x) + parseInt(nd.getBoundingClientRect().width/2);
		var centerY = parseInt(nd.getBoundingClientRect().y) + parseInt(nd.getBoundingClientRect().height/2);

		if (!d3.polygonContains(rectCoordinates,[centerX,centerY])){
			d3.select(this).remove()
		};
	}
//entities = cropped
)


	var svg = d3.select('svg');

	svg.on("mousemove", null);
	svg.on("mousedown", null);
	svg.on("mouseup", null);
	svg.selectAll('.cropper').remove()

	svg.call(d3.zoom()
		.extent([[0, 0], [width, height]])
		.scaleExtent([.25, 8])
		.on("zoom", zoomed))      
	d3.select('#finishCrop').remove();

	d3.select('#correlates').append('button').text('Crop Floorplan').attr('id','runCrop').on('click', function(){
		crop(entities)
	});


}


function mouseup() {
	svg.on("mousemove", null);
}

</script>