export function buildtree(tree){
  //d3.selectAll("g > *").remove()
  //d3.select("#treeContainer").remove()
  document.querySelector("#treeContainerGen").innerHTML = "";

  // process data first to determine size
  let treeToList = []
  let depthColl = {}
  Object.keys(tree).forEach(e => {
    treeToList.push(tree[e])
    var depth = tree[e]["depth"]
    if (depth in depthColl){
      depthColl[depth] = depthColl[depth] + 1
    } else {
      depthColl[depth] = 1
    }
  })

  var depthKeys = Object.keys(depthColl)
  var maxWidth = depthColl[depthKeys[depthKeys.length - 1]]
  var maxDepth = parseInt(depthKeys[depthKeys.length - 1])

  // set the dimensions and margins of the diagram
  const margin = {top: 20, right: 90, bottom: 0, left: 0},
  width  = 80 * maxWidth - margin.left - margin.right,
  height = 80 * maxDepth - margin.top - margin.bottom;
  
  // declares a tree layout and assigns the size
  const treemap = d3.tree().size([width, height]);

  let nodes = d3.stratify()(treeToList)
  
  // maps the node data to the tree layout
  nodes = treemap(nodes);
  
  // append the svg object to the body of the page
  // appends a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  const svg = d3.select("#treeContainerGen").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom),
    g = svg.append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");
  
  // adds the links between the nodes (the spaghetti)
  const link = g.selectAll(".link")
    .data( nodes.descendants().slice(1))
    .enter().append("path")
    .attr("class", "link")
    .style("stroke", d => "lightgray")
    .attr("d", d => {
        return "M" + d.x * 0.75 + "," + d.y * 0.5
        + " " + d.parent.x * 0.75 + "," + d.parent.y * 0.5;
        });
  
  // adds each node as a group
  const node = g.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => "translate(" + d.x * 0.75 + "," + d.y * 0.5 + ")");
  
  // adds the circle to the node
  node.append("circle")
    .attr("r", d => 6)
    // .style("stroke", d => d.data.type)
    .style("fill", d => "white")
    .on("click", function(d){
        if (d.target.style.fill == "white"){
          d.target.style.fill = "lightgray"
          displayParcel(d.target.__data__.data.id)
        } else {
          d.target.style.fill = "white"
          removeParcel(d.target.__data__.data.id)
        }
    })
    
  // adds the text to the node
  node.append("text")
    .attr("dy", ".25em")
    .attr("x", d => 12)
    .attr("y", d => 0)
    // .style("text-anchor", d => d.children ? "end" : "start")
    .text(d => d.data.id);
}

export function builddepthtree(tree){
  //d3.selectAll("g > *").remove()
  //d3.select("#treeContainer").remove()
  document.querySelector("#treeContainerDepth").innerHTML = "";

  // set the dimensions and margins of the diagram
  const margin = {top: 20, right: 10, bottom: 0, left: 10},
        width  = 600 - margin.left - margin.right,
        height = 550 - margin.top - margin.bottom;
  
  // declares a tree layout and assigns the size
  const treemap = d3.tree().size([height, width]);

  let treeToList = []
  Object.keys(tree).forEach(e => {
    treeToList.push(tree[e])
  })

  let nodes = d3.stratify()(treeToList)
  
  // maps the node data to the tree layout
  nodes = treemap(nodes);
  
  // append the svg object to the body of the page
  // appends a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  const svg = d3.select("#treeContainerDepth").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom),
    g = svg.append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");
  
  // adds the links between the nodes (the spaghetti)
  const link = g.selectAll(".link")
    .data( nodes.descendants().slice(1))
    .enter().append("path")
    .attr("class", "link")
    .style("stroke", d => "lightgray")
    .attr("d", d => {
        return "M" + d.x * 0.75 + "," + d.y * 0.5
        + " " + d.parent.x * 0.75 + "," + d.parent.y * 0.5;
        });
  
  // adds each node as a group
  const node = g.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => "translate(" + d.x * 0.75 + "," + d.y * 0.5 + ")");
  
  // adds the circle to the node
  node.append("circle")
    .attr("r", d => 10)
    // .style("stroke", d => d.data.type)
    .style("fill", d => "white")
    .on("click", function(d){
      emptyScores()
      if (d.target.style.fill == "white"){
        resetCircles()
        d.target.style.fill = "lightgray"
        //displayParcel(d.target.__data__.data.id)
        var members = d.target.__data__.data.member
        members.forEach(e => {
          displayParcel(e)
        })
      }
    })
    
  // adds the text to the node
  node.append("text")
    .attr("dy", ".25em")
    .attr("x", d => 20)
    .attr("y", d => 0)
    // .style("text-anchor", d => d.children ? "end" : "start")
    .text(d => d.data.id);
}

function displayParcel(key){
  var parcel = dataTree[key]["mesh"]
  parcelMeshesTree[key] = dataTree[key]["mesh"]
  scene.add(parcel)
  var outkey = "o" + key
  var outline = dataTree[key]["outline"]
  outlineMeshesTree[outkey] = dataTree[key]["outline"]
  scene.add(outline)
}

function removeParcel(key){
  scene.remove(parcelMeshesTree[key]);
  delete parcelMeshesTree[key]
  scene.remove(outlineMeshesTree["o"+key])
  delete outlineMeshesTree["o"+key]
}

export function resetCircles(){
  d3.selectAll("circle")
    .style("fill", "white")
  var curr = Object.keys(parcelMeshesTree)
  for (let i=curr.length-1; i>=0; i--){
    removeParcel(curr[i])
  }
}

function emptyScores() {
  document.getElementById("text1").innerHTML = "Parcel key: "
  document.getElementById("text2").innerHTML = "Parcel depth: "
  document.getElementById("text3").innerHTML = "Parcel area: "
  document.getElementById("text4").innerHTML = "Orientation: "
  document.getElementById("text5").innerHTML = "Elongation: "
  document.getElementById("text6").innerHTML = "Compactness: "
  document.getElementById("text7").innerHTML = "Convexity: "
}