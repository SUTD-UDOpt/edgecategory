// Event listeners

// three Event handlers
document.addEventListener( 'mousemove', onMouseMove, false );
document.addEventListener('mousedown', onMouseDown, false);
document.addEventListener('mouseup', onMouseUp, false);

// UI event handlers
document.getElementById("saveButton").addEventListener("click", () => {
  for (let i=1; i<5; i++){
    if (saveSlots[i] == undefined){
      document.getElementById("slot" + i + "label").innerHTML = i + " [empty]"
    } else {
      document.getElementById("slot" + i + "label").innerHTML = saveSlots[i]
    }
  }
  document.getElementById("popup").style.display = "block"
  document.getElementById("savePrompt").style.display = "block"
  popup = true
})

document.getElementById("finalSaveButton").addEventListener("click", () => {
  if (document.getElementById("saveLabel").value == ""){
    alert("Please fill in the save label")
  } else {
    let radioButtons = document.querySelectorAll('input[name="slotOpt"]');
    let selSlot
    radioButtons.forEach(e => {
      if (e.checked){
        selSlot = e.value
      }
    })
    if (selSlot == undefined){
      alert("Please select a save slot")
    } else {
      saveSlots[selSlot] = document.getElementById("saveLabel").value
      saveData[selSlot] = saveData[0]
      savePolygon[selSlot] = savePolygon[0]
      document.getElementById("save" + selSlot).innerHTML = saveSlots[selSlot]
      document.getElementById("save" + selSlot).classList.add("filled");
    }
    document.getElementById("popup").style.display = "none"
    document.getElementById("savePrompt").style.display = "none"
    popup = false
  }
})

document.getElementById("multiButton").addEventListener("click", () => {
  clearCurrentSelection()
  if (markingParcels){
    markingParcels = false
    document.getElementById("markers").style.display = "none"
  } else {
    document.getElementById("markers").style.display = "flex"
    if (document.getElementById("markResi").classList.contains("selected")){
      document.getElementById("markResi").classList.remove("selected");
    }
    if (document.getElementById("markGreen").classList.contains("selected")){
      document.getElementById("markGreen").classList.remove("selected");
    }
  }
})

document.getElementById("markResi").addEventListener("click", () => {
  markingParcels = "resi"
  document.getElementById("markResi").classList.add("selected");
  if (document.getElementById("markGreen").classList.contains("selected")){
    document.getElementById("markGreen").classList.remove("selected");
  }
})

document.getElementById("markGreen").addEventListener("click", () => {
  markingParcels = "green"
  document.getElementById("markGreen").classList.add("selected");
  if (document.getElementById("markResi").classList.contains("selected")){
    document.getElementById("markResi").classList.remove("selected");
  }
})

document.getElementById("modBButton").addEventListener("click", () => {
  resiParcels = []
  Object.keys(dataCol).forEach(e => {
    if (dataCol[e]["program"] == "resi"){
      resiParcels.push(e)
    }
  })
  if (resiParcels.length == 0){
    alert("Please mark at least 1 parcel as resi to proceed!")
  // } else if (resiParcels.length > 6){
  //   alert("We can only process up to 6 parcels at once at the moment...")
  } else {
    document.getElementById("popup").style.display = "block"
    document.getElementById("optimizePrompt").style.display = "block"
    popup = true
  }
})

document.getElementById("optButton").addEventListener("click", () => {
  document.getElementById('loader').style.display = 'block';
  let input = {}
  resiParcels.forEach(e => {
    input[e] = {
      "BKeySelection": [
        2,
        4,
        5,
        6,
        7,
        8,
        10,
        12,
        14
      ],
    "EdgeCategory": dataCol[e]["edgecat"],
    "GPR": "None",
    "OptimisationParameters": {
        "CrossOverRate": document.getElementById("param6").value,
        "GenerationCount": document.getElementById("param7").value,
        "MutationRate": document.getElementById("param8").value,
        "ObjectiveWeights": null,
        "PopulationCount": document.getElementById("param9").value
      },
    "ParameterRanges": {
        "BKeyXScale": document.getElementById("param1").value.split(","),
        "BKeyYScale": document.getElementById("param2").value.split(","),
        "GridAngle": document.getElementById("param3").value.split(","),
        "GridSpacing": document.getElementById("param4").value.split(","),
        "ParcelStoreyScale": document.getElementById("param5").value.split(",")
      },
    "ParcelCoordinates": dataCol[e]["coords"]
    }

    // let numEdges = dataCol[e]["coords"].length - 1
    // for (let i=0; i<numEdges; i++){
    //   var num = Math.floor(Math.random() * 4) + 3
    //   if (num == 7){num = 6}
    //   input[e]["EdgeCategory"].push(num)
    // }

    let GPRlist = document.getElementById("param10").value.split(",")
    let keys = Object.keys(input)
    for (let i=0; i< keys.length; i++){
      if (i < GPRlist.length){
        input[keys[i]]["GPR"] = GPRlist[i]
      } else {
        input[keys[i]]["GPR"] = GPRlist[i - GPRlist.length]
      }
    }
  })
  console.log(input)
  document.getElementById("popup").style.display = "none"
  document.getElementById("optimizePrompt").style.display = "none"
  popup = false

  const options = {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body: JSON.stringify(input)
  };

  fetch('/api_python', options)
  .then(function (response) {
    console.log(response)
    return response.json();
  })
  .then(function(text){
    toState4()
    let buttonContainer = document.getElementById("resultB");
    Object.keys(text["Model"]).forEach(e => {
      text["Model"][e] = JSON.parse(text["Model"][e])

      let singleRow = document.createElement("div");
      singleRow.setAttribute("class", "row");
      singleRow.setAttribute("id", "row" + e);
      let button = document.createElement("button");
      button.classList.add("esri-button")
      button.classList.add("limited")
      button.classList.add("bottomMargin")
      button.innerHTML = "RESULT " + e
      singleRow.appendChild(button)
      button.addEventListener("click", () => {
        let radioButtons = document.querySelectorAll('input[name="viewBOpt"]');
        let optResView
        radioButtons.forEach(e => {
          if (e.checked){
            optResView = e.value
          }
        })

        if (optResView == "normal"){
          renderBuildings(text["Model"][e]["MeanEWAspectRatio"]["meshstring"], "f1f1f1")
        } else if (optResView == "orientation"){
          renderBuildings(text["Model"][e]["MeanEWAspectRatio"]["meshstring"], text["Model"][e]["MeanEWAspectRatio"]["color"])
        } else if (optResView == "views"){
          renderBuildings(text["Model"][e]["TotalViewObstruction"]["meshstring"], text["Model"][e]["TotalViewObstruction"]["color"])
        }

        // COME BACK and rewrite without global var
        if (currsel != undefined){
          currsel.classList.remove("selected")
        }
        button.classList.add("selected");
        currsel = button
      })
      buttonContainer.appendChild(singleRow);
    })
    console.log(text)
    document.getElementById('loader').style.display = 'none';
  })
})

document.getElementById("downloadButton").addEventListener("click", () => {
    download(JSON.stringify(dataCol), saveSlots[selSlot] + "-final-iteration.json", "text/plain")
    download(JSON.stringify(dataTree), saveSlots[selSlot] + "-tree.json", "text/plain")
})

// UI FUNCTIONS
function toState0() {
    state = 0
    markingParcels = false
    document.getElementById("resultDiv").style.display = "none";
    document.getElementById("saveDiv").style.display = "none";
    document.getElementById("saveButton").style.display = "none";
    document.getElementById("multiButton").style.display = "none";
    document.getElementById("markers").style.display = "none"
    document.getElementById("modBButton").style.display = "none";
    document.getElementById("clearFilter").style.display = "block";
    document.getElementById("point-geometry-button").style.display = "none"
    document.getElementById("polygon-geometry-button").style.display = "block"
    document.getElementById("actionButton").innerHTML = "Select Boundary Polygon"
}

function toState1() {
    state = 1
    markingParcels = false
    document.getElementById("resultDiv").style.display = "none";
    document.getElementById("saveDiv").style.display = "none";
    document.getElementById("saveButton").style.display = "none";
    document.getElementById("multiButton").style.display = "none";
    document.getElementById("markers").style.display = "none"
    document.getElementById("modBButton").style.display = "none";
    document.getElementById("point-geometry-button").style.display = "block"
    document.getElementById("polygon-geometry-button").style.display = "none"
    document.getElementById("actionButton").innerHTML = "Select Access Point Pair"
}

function toState2() {
    state = 2
    markingParcels = false
    document.getElementById("resultDiv").style.display = "none";
    document.getElementById("saveDiv").style.display = "none";
    document.getElementById("saveButton").style.display = "none";
    document.getElementById("multiButton").style.display = "none";
    document.getElementById("markers").style.display = "none";
    document.getElementById("modBButton").style.display = "none";
    document.getElementById("point-geometry-button").style.display = "none"
    document.getElementById("polygon-geometry-button").style.display = "none"
    document.getElementById("sliderContainer").style.display = "block"
    document.getElementById("actionButton").innerHTML = "Solve"
    }

function toState3() {
    state = 3
    markingParcels = false
    document.getElementById("clearFilter").style.display = "none";
    document.getElementById("point-geometry-button").style.display = "none"
    document.getElementById("polygon-geometry-button").style.display = "none"
    document.getElementById("sliderContainer").style.display = "none"
    document.getElementById("actionButton").innerHTML = "Reset"
    document.getElementById("resultB").style.display = "none"
    document.getElementById("resultBViewingOptions").style.display = "none"
    document.getElementById("resultA").style.display = "block"
    document.getElementById('loader').style.display = 'block'
}

function toState4() {
  state = 4
  markingParcels = false
  document.getElementById("multiButton").style.display = "none";
  document.getElementById("markers").style.display = "none";
  document.getElementById("actionButton").innerHTML = "Reset Module B"
  document.getElementById("resultA").style.display = "none"
  document.getElementById("resultB").style.display = "block"
  document.getElementById("resultBViewingOptions").style.display = "flex"
  removeAllChildNodes(document.getElementById("resultB"))
  removeAllBuildings()
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

function removeAllChildNodes(parent) {
  while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
  }
}

// DATA RELATED FUNCTIONS
function download(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

function truncate(num){
  return Math.round(num*1000) / 1000
}

function processCoords(str){
  var coordsArr = []
  var coords = str.split(";")
  coords.forEach(e => {
    var xyz = e.split(",")
    coordsArr.push([parseFloat(xyz[0]), parseFloat(xyz[1]), parseFloat(xyz[2])])
  })
  return coordsArr
}

function processEdges(str){
  var coordsArr = []
  var edgecat = []
  var coords = str.split(";")
  coords.forEach(e => {
    var xyz = e.split(",")
    coordsArr.push([parseFloat(xyz[0]), parseFloat(xyz[1]), parseFloat(xyz[2])])
    var cat = xyz[6]
    if (cat == "0"){
      edgecat.push(3)
    } else if (cat == "1"){
      edgecat.push(4)
    } else if (cat == "2"){
      edgecat.push(6)
    } else {
      edgecat.push(3)
    }
  })
  coordsArr.push(coordsArr[0])
  return [coordsArr, edgecat]
}

// PARCEL MARKING FUNCTIONS
function clearCurrentSelection() {
  var keys = Object.keys(parcelMeshes)
  keys.forEach(e => {
    parcelMeshes[e].material = greyMat
    dataCol[e]["program"] = "none"
  })
  markedParcels = []
}

// THREEJS SUPPLEMENT FUNCTIONS
// clear scene removes all mesh scene objects
function clearScene(){
    if (selectedKey){
      if (parcelViewingMode == "offset"){
        parcelMeshes[selectedKey].material = greyMat
      } else if (parcelViewingMode == "tree") {
        parcelMeshesTree[selectedKey].material = greyMat
      }
      selectedKey = undefined
    }
    for (let i = scene.children.length - 1; i >= 0; i--) { 
        var obj = scene.children[i];
        if (obj.name == "genParcel" || obj.name == "outline"){
            scene.remove(obj); 
        }
    }
}

function resetSceneAndData(){
    dataCol = {}
    dataTree = {}
    depthTree = {}
    parcelMeshes = {}
    outlineMeshes = {}
    parcelMeshesTree = {}
    outlineMeshesTree = {}
    scene.remove(base)
    base = undefined
    selectedKey = undefined
    pointedKey = undefined
    markedParcels = []
    markingParcels = false
    parcelViewingMode = "offset"
    document.getElementById("treeContainer").style.display = "none"
    clearScene()
    emptyScores()
}

function selectParcel(sel){
    if (parcelViewingMode == "offset"){
        var list = Object.keys(parcelMeshes)
        list.forEach(e => {
        parcelMeshes[e].material = greyMat
        })
        parcelMeshes[sel].material = blueMat
    } else {
        var list = Object.keys(parcelMeshesTree)
        list.forEach(e => {
        parcelMeshesTree[e].material = greyMat
        })
        parcelMeshesTree[sel].material = blueMat
    }
}

function multiParcelSel(sel){
  if (markedParcels.includes(sel)){
    if (dataCol[sel]["program"] == markingParcels){
      dataCol[sel]["program"] = "none"
      markedParcels = markedParcels.filter(item => item !== sel)
    } else {
      dataCol[sel]["program"] = markingParcels
    }
  } else {
    markedParcels.push(sel)
    dataCol[sel]["program"] = markingParcels
  }
  var list = Object.keys(parcelMeshes)
  console.log(dataCol)
  list.forEach(e => {
    if (dataCol[e]["program"] == "resi"){
      parcelMeshes[e].material = blueMat
    } else if (dataCol[e]["program"] == "green"){
      parcelMeshes[e].material = greenMat
    } else {
      parcelMeshes[e].material = greyMat
    }
  })
  console.log(markedParcels)
}

function displayOffsetSol() {
  Object.keys(parcelMeshes).forEach(e => {
      scene.add(parcelMeshes[e])
      scene.add(outlineMeshes[e])
  })
}

function removeAllBuildings(){
  buildingsColl.forEach(e => {
    scene.remove(e)
  })
  buildingsColl = []
}

function renderBuildings(listMesh, listMat){
  removeAllBuildings()
  for (let i=0; i<listMesh.length; i++){
    let mesh = rhino.DracoCompression.decompressBase64String(listMesh[i])
    let mat = new THREE.MeshStandardMaterial( { 
      color: listMat[i],
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });
    let threeMesh = meshToThreejs(mesh, mat, 1)
    buildingsColl.push(threeMesh)
    scene.add(threeMesh)
  }
  console.log(buildingsColl)
}

function meshToThreejs(mesh, material, scale) {
  const loader = new THREE.BufferGeometryLoader()
  const geometry = loader.parse(mesh.toThreejsJSON())
  const res = new THREE.Mesh(geometry, material)
  res.scale.set(1, 1, scale)
  return res
}

function meshtoOutline(mesh, material) {
  const loader = new THREE.BufferGeometryLoader()
  let geometry = loader.parse(mesh.toThreejsJSON())
  const edges = new THREE.EdgesGeometry( geometry );
  const line = new THREE.LineSegments( edges, material );
  line.scale.set(1,1,2.06)
  return line
}

// Handle mouse events
function onMouseMove( event ) {
  event.preventDefault();
  // TO DEBUG still not sure why the mouse clicking is not precise, probably is caused by the projection matrix calibration, scaling by a number is a quick fix that is still not accurate but it's at least better
  // OK THE NUMBER IS RELATED TO THE SCREEN WIDTH/HEIGHT RATIO
  // 0.65/0.9 == 852/1172 == ~0.72
  var aspectRatio = view.height / view.width
  mouse.x = (( event.clientX / view.width ) * 2 - 1) * 0.9;
  mouse.y = (- ( event.clientY / view.height ) * 2 + 1) * 0.65;
}
  
function onMouseDown(event) {
  mouse_down.x = event.clientX;
  mouse_down.y = event.clientY
}
  
function onMouseUp(event) {
  //console.log(mouse, mouse_down)
  if (state == 3 && popup == false){
    if ((mouse_down.x !== event.clientX) || (mouse_down.y !== event.clientY)) {
      // we are dragging, so no nothing
      return;
    } else {
      if (pointedKey != undefined){
        if (parcelViewingMode == "offset"){
          selectedKey = pointedKey
          if (markingParcels){
            multiParcelSel(selectedKey)
          } else {
            selectParcel(selectedKey)
            document.getElementById("text1").innerHTML = "Parcel key: " + selectedKey
            document.getElementById("text2").innerHTML = "Parcel depth: " + dataCol[selectedKey]["depth"]
            document.getElementById("text3").innerHTML = "Parcel area: " + dataCol[selectedKey]["area"] + " sqm"
            document.getElementById("text4").innerHTML = "Orientation: " + dataCol[selectedKey]["orientation"]
            document.getElementById("text5").innerHTML = "Elongation: " + dataCol[selectedKey]["elongation"]
            document.getElementById("text6").innerHTML = "Compactness: " + dataCol[selectedKey]["compactness"]
            document.getElementById("text7").innerHTML = "Convexity: " + dataCol[selectedKey]["convexity"]
          }
        } else if (parcelViewingMode == "tree"){
          selectedKey = pointedKey
          selectParcel(selectedKey)
          document.getElementById("text1").innerHTML = "Parcel key: " + selectedKey
          document.getElementById("text2").innerHTML = "Parcel depth: " + dataTree[selectedKey]["depth"]
          document.getElementById("text3").innerHTML = "Parcel area: " + dataTree[selectedKey]["area"] + " sqm"
          document.getElementById("text4").innerHTML = "Orientation: " + dataTree[selectedKey]["orientation"]
          document.getElementById("text5").innerHTML = "Elongation: " + dataTree[selectedKey]["elongation"]
          document.getElementById("text6").innerHTML = "Compactness: " + dataTree[selectedKey]["compactness"]
          document.getElementById("text7").innerHTML = "Convexity: " + dataTree[selectedKey]["convexity"]
        }
      }
    }
  }
}