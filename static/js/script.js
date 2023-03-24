import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { RhinoCompute } from 'https://cdn.jsdelivr.net/npm/compute-rhino3d@0.13.0-beta/compute.rhino3d.module.js'
import { buildtree, builddepthtree, resetCircles } from './treebuilder.js';

require(["esri/Map", 
    "esri/views/SceneView", 
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch/SketchViewModel",
    "esri/layers/support/FeatureFilter",
    "esri/geometry/geometryEngine",
    "esri/Graphic",
    "esri/layers/FeatureLayer",
    "esri/geometry/SpatialReference",
    "esri/views/3d/externalRenderers",
    "esri/widgets/Measurement"
], (Map, SceneView, GraphicsLayer,
    SketchViewModel,
    FeatureFilter,
    geometryEngine,
    Graphic, FeatureLayer, SpatialReference, externalRenderers, Measurement) => {

    // Renderer for feature layer to extrude feature (also possible to extrude by linked data)
    const featureRenderer = {
      type: "simple", // autocasts as new SimpleRenderer()
      symbol: {
        type: "polygon-3d", // autocasts as new PolygonSymbol3D()
        symbolLayers: [{
          type: "extrude",  // autocasts as new ExtrudeSymbol3DLayer()
          size: 50,  // 100,000 meters in height
          material: { color: "#a9c6db" }
        }]
      }
    };

    // Create the layer and set the renderer
    const buildingLayer = new FeatureLayer({
        url: "https://services.arcgis.com/WtqlNvp8I3rKOjGy/arcgis/rest/services/gis_osm_buildings/FeatureServer",
        opacity: 0.8,
        renderer: featureRenderer
    });

    //This is where the tile based map is configured
    const map = new Map({
      basemap: "topo-vector",
      ground: "world-elevation",
    });
    map.add(buildingLayer,0);

    view = new SceneView({
        container: "viewDiv", // Reference to the scene div created in step 5
        map: map, // Reference to the map object created before the scene
        zoom: 16,
        center: [103.955, 1.35], // Sets the center point of view with lon/lat
        viewingMode: "local",
    });
    window.view = view;
    view.constraints.clipDistance.near = 100
    view.constraints.clipDistance.far = 175000

    // Create new instance of the Measurement widget
    const measurement = new Measurement();

    // add a GraphicsLayer for the sketches and the buffer (this is for sketching)
    const sketchLayer = new GraphicsLayer();
    const bufferLayer = new GraphicsLayer();
    view.map.addMany([bufferLayer, sketchLayer]);

    // create the layerView's to add the filter
    let featureLayerView = null;

    // loop through webmap's operational layers
    view.map.layers.forEach((layer, index) => {
    view
        .whenLayerView(layer)
        .then((layerView) => {
        if (layer.type === "feature") {
            featureLayerView = layerView;
        }
        })
        .catch(console.error);
    });
    view.watch('zoom', zoomChanged);

    let bufferSize = 0;

    // use SketchViewModel to draw polygons that are used as a filter
    let sketchGeometry = null;
    const sketchViewModel = new SketchViewModel({
      layer: sketchLayer,
      view: view,
      pointSymbol: {
        type: "simple-marker",
        style: "circle",
        size: 10,
        color: [211, 132, 80, 0.9],
        outline: {
          color: [211, 132, 80, 0.7],
          size: 10
        }
      },
      polygonSymbol: {
        type: "polygon-3d",
        symbolLayers: [
          {
            type: "fill",
            material: {
              color: [255, 255, 255, 0.8]
            },
            outline: {
              color: [211, 132, 80, 0.7],
              size: "2px"
            }
          }
        ]
      },
      defaultCreateOptions: { hasZ: false }
    });

    sketchViewModel.on(["create"], (event, geom) => {
      // update the filter every time the user finishes drawing the filtergeometry
      if (event.state == "complete") {
        sketchGeometry = event.graphic.geometry;
        if (sketchGeometry.type == "polygon" && state == 0){
          updateFilter();
          currentPolygon = sketchGeometry
          currentPolygonGraphic = event.graphic
        } else {
          currentPolygon = undefined
        }
        if (sketchGeometry.type == "point" && state == 1){
          if (pointOne == undefined){
            pointOne = sketchGeometry
            pointOneGraphic = event.graphic
          } else if (pointTwo == undefined){
            pointTwo = sketchGeometry
            pointTwoGraphic = event.graphic
          }
        }
      }
    });

    sketchViewModel.on(["update"], (event) => {
      const eventInfo = event.toolEventInfo;
      // update the filter every time the user moves the filtergeometry
      if (event.toolEventInfo && event.toolEventInfo.type.includes("stop")
      ) {
        sketchGeometry = event.graphics[0].geometry;
        updateFilter();
      }
    });

    // configure sketch buttons
    document.getElementById("point-geometry-button").onclick =
      geometryButtonsClickHandler;
    document.getElementById("polygon-geometry-button").onclick =
      geometryButtonsClickHandler;

    function geometryButtonsClickHandler(event) {
      const geometryType = event.target.value;
      if (state != 1){
        var p1 = pointOne
        var p2 = pointTwo
        var p1g = pointOneGraphic
        var p2g = pointTwoGraphic
        clearEverything();
        pointOne = p1
        pointTwo = p2
        pointOneGraphic = p1g
        pointTwoGraphic = p2g
        if (pointOneGraphic != undefined){
          sketchLayer.add(pointOneGraphic)
          sketchLayer.add(pointTwoGraphic)
        }
      } else {
        if (pointTwo!= undefined){
          clearPoints();
          pointOne = undefined
          pointTwo = undefined
          pointOneGraphic = undefined
          pointTwoGraphic = undefined
        }
      }
      sketchViewModel.create(geometryType);
    }

    // configure measurement buttons
    let activeView = view
    measurement.view = activeView;
    document.getElementById("distance").onclick = measureDistance;
    document.getElementById("area").onclick = measureArea;
    document.getElementById("clearMe").onclick = clearMeasure;

    // Call the appropriate DistanceMeasurement2D or DirectLineMeasurement3D
    function measureDistance() {
      const type = activeView.type;
      measurement.activeTool =
        type.toUpperCase() === "2D" ? "distance" : "direct-line";
        document.getElementById("distance").classList.add("active");
        document.getElementById("area").classList.remove("active");
    }

    // Call the appropriate AreaMeasurement2D or AreaMeasurement3D
    function measureArea() {
      measurement.activeTool = "area";
      document.getElementById("distance").classList.remove("active");
      document.getElementById("area").classList.add("active");
    }

    // Clears all measurements
    function clearMeasure() {
      document.getElementById("distance").classList.remove("active");
      document.getElementById("area").classList.remove("active");
      measurement.clear();
    }

    document.getElementById("clearFilter").addEventListener("click", () => {
      clearEverything()
      state = 0
      savedPolygon = undefined
      savedPolygonGraphic = undefined
      document.getElementById("actionButton").innerHTML = "Process Polygon"
    });

    // Utility functions (arcgis related)
    function zoomChanged(newValue, oldValue, property, object){
      if (newValue < 12){
        view.zoom = 12
      }
    }
    
    function clearPolygon() {
      let sketches = sketchLayer.graphics.items
      let toRemove
      sketches.forEach(e => {
        if (e.geometry.type == "polygon"){
          toRemove = e
        }
      })
      sketchLayer.remove(toRemove)
    }

    function clearPoints() {
      let sketches = sketchLayer.graphics.items
      let toRemove = []
      sketches.forEach(e => {
        if (e.geometry.type == "point"){
          toRemove.push(e)
        }
      })
      toRemove.forEach(e => {
        sketchLayer.remove(e)
      })
    }

    function clearEverything() {
      sketchGeometry = null;
      filterGeometry = null;
      sketchLayer.removeAll();
      bufferLayer.removeAll();
      if (featureLayerView != null){
        featureLayerView.filter = null;
      }
      currentPolygon = undefined
      currentPolygonGraphic = undefined
      pointOne = undefined
      pointTwo = undefined
      pointOneGraphic = undefined
      pointTwoGraphic = undefined
      emptyScores()
      document.getElementById("point-geometry-button").style.display = "none"
      document.getElementById("polygon-geometry-button").style.display = "block"
      document.getElementById("sliderContainer").style.display = "none"
      resetSceneAndData()
    }

    // set the geometry filter on the visible FeatureLayerView (specify which features to select based on sketched geometry)
    function updateFilter() {
      updateFilterGeometry();
      const featureFilter = new FeatureFilter({
        // autocasts to FeatureFilter
        geometry: filterGeometry,
        spatialRelationship: "disjoint"
      });

      featureLayerView.filter = featureFilter;
    }

    // update the filter geometry depending on bufferSize
    let filterGeometry = null;
    function updateFilterGeometry() {
      // add a polygon graphic for the bufferSize
      if (sketchGeometry) {
        if (bufferSize > 0) {
          const bufferGeometry = geometryEngine.geodesicBuffer(
            sketchGeometry,
            bufferSize,
            "meters"
          );
          if (bufferLayer.graphics.length === 0) {
            bufferLayer.add(
              new Graphic({
                geometry: bufferGeometry,
                symbol: sketchViewModel.polygonSymbol
              })
            );
          } else {
            bufferLayer.graphics.getItemAt(0).geometry = bufferGeometry;
          }
          filterGeometry = bufferGeometry;
        } else {
          bufferLayer.removeAll();
          filterGeometry = sketchGeometry;
        }
      }
    }

    function updateFilteronLoad(geom){
      if (bufferSize > 0) {
        const bufferGeometry = geometryEngine.geodesicBuffer(
          geom,
          bufferSize,
          "meters"
        );
        if (bufferLayer.graphics.length === 0) {
          bufferLayer.add(
            new Graphic({
              geometry: bufferGeometry,
              symbol: sketchViewModel.polygonSymbol
            })
          );
        } else {
          bufferLayer.graphics.getItemAt(0).geometry = bufferGeometry;
        }
        filterGeometry = bufferGeometry;
      } else {
        bufferLayer.removeAll();
        filterGeometry = geom;
      }
      const featureFilter = new FeatureFilter({
        // autocasts to FeatureFilter
        geometry: filterGeometry,
        spatialRelationship: "disjoint"
      });

      featureLayerView.filter = featureFilter;
    }

    function resetResultDiv(){
      clearScene()
      emptyScores()
      resetCircles()
    }

    // Utility functions rhino related
    function reDisplaySlot(slot){
      markingParcels = false
      document.getElementById('loader').style.display = 'none'
      document.getElementById("resultDiv").style.display = "block";
      document.getElementById("saveDiv").style.display = "block";
      document.getElementById("saveButton").style.display = "block";
      document.getElementById("multiButton").style.display = "block";
      document.getElementById("modBButton").style.display = "block";
      clearPolygon()
      resetSceneAndData()

      updateSlotsDisplay(slot)
      dataCol = saveData[slot]['datacol']
      dataTree = saveData[slot]['datatree']
      depthTree = saveData[slot]['depthtree']
      repopulateMeshDict(dataCol, 'offset')
      repopulateMeshDict(dataTree, 'tree')
      updateGraphicDisplay(slot)

      builddepthtree(depthTree)
      buildtree(dataTree)
      displayOffsetSol()
    }

    function displaySlot(slot){
      updateSlotsDisplay(slot)
      processData(saveData[slot]['raw'], slot)
      updateGraphicDisplay(slot)
    }

    function repopulateMeshDict(data, type){
      if (type == 'offset'){
        Object.keys(data).forEach(e => {
          parcelMeshes[e] = data[e]["mesh"]
          outlineMeshes[e] = data[e]["outline"]
        })
      } else if (type == 'tree') {
        Object.keys(data).forEach(e => {
          parcelMeshesTree[e] = data[e]["mesh"]
          outlineMeshesTree[e] = data[e]["outline"]
        })
      }
    }

    function updateSlotsDisplay(slot){
      for (let i=0; i<5; i++){
        if (document.getElementById("save" + i).classList.contains("selected")){
          document.getElementById("save" + i).classList.remove("selected")
        }
      }
      document.getElementById("save" + slot).classList.add("selected")
      updateFilteronLoad(savePolygon[slot])
    }

    function updateGraphicDisplay(slot){
      selSlot = slot
      savedPolygonGraphic = saveData[slot]['arcgis']['polygon']
      pointOneGraphic = saveData[slot]['arcgis']['pointone']
      pointTwoGraphic = saveData[slot]['arcgis']['pointtwo']
      savedPolygon = saveData[slot]['arcgis']['polygon'].geometry
      pointOne = saveData[slot]['arcgis']['pointone'].geometry
      pointTwo = saveData[slot]['arcgis']['pointtwo'].geometry
      clearPoints()
      sketchLayer.add(saveData[slot]['arcgis']['pointone'])
      sketchLayer.add(saveData[slot]['arcgis']['pointtwo'])
    }

    function processData(res, num){
      markingParcels = false
      document.getElementById('loader').style.display = 'none'
      document.getElementById("resultDiv").style.display = "block";
      document.getElementById("saveDiv").style.display = "block";
      document.getElementById("saveButton").style.display = "block";
      document.getElementById("multiButton").style.display = "block";
      document.getElementById("modBButton").style.display = "block";
      clearPolygon()
      resetSceneAndData()

      if (Object.keys(res.values[0].InnerTree).length > 0){
        let numData = res.values[0].InnerTree['{0;0;0;0}'].length

        for (let i=0; i<numData; i++){
          let data = JSON.parse(res.values[0].InnerTree['{0;0;0;0}'][i].data)
          let mesh = rhino.DracoCompression.decompressBase64String(data)
          var threeMesh = meshToThreejs(mesh, greyMat, 2.05)
          var outlineMesh = meshtoOutline(mesh, blackLine)
          threeMesh.name = "genParcel"
          outlineMesh.name = "outline"
          threeMesh.key = i
          var childrenRaw = JSON.parse(res.values[0].InnerTree['{0}'][i].data)
          var parentRaw = JSON.parse(res.values[0].InnerTree['{0;0}'][i].data)
          var depthRaw = JSON.parse(res.values[0].InnerTree['{0;0;0}'][i].data)
          var evaRaw = JSON.parse(res.values[0].InnerTree['{0;0;0;0;0;0}'][i].data).split(",")

          dataTree[i] = {"children":[], 
                        "depth": parseInt(depthRaw),
                        "mesh": threeMesh,
                        "outline": outlineMesh,
                        "id": i,
                        "area": parseFloat(evaRaw[0]),
                        "orientation": parseFloat(evaRaw[1]),
                        "elongation": parseFloat(evaRaw[2]),
                        "compactness": parseFloat(evaRaw[3]),
                        "convexity": parseFloat(evaRaw[4])}

          if (parentRaw != "None"){
            dataTree[i]["parentId"] = [parseInt(parentRaw)]
          }
          if (childrenRaw != "empty"){
            dataTree[i]["children"] = childrenRaw.split(",").map(e => {return parseInt(e)})
          }

          var depthVal = parseInt(depthRaw)
          if (depthTree[depthVal] == undefined){
            depthTree[depthVal] = {"id": depthVal,
                                  "member": [i]}
            if (depthVal > 0){
              depthTree[depthVal]["parentId"] = depthVal - 1
            }
          } else {
            depthTree[depthVal]["member"].push(i)
          }
        }
        saveData[num]['datatree'] = dataTree
        saveData[num]['depthtree'] = depthTree
        builddepthtree(depthTree)
        buildtree(dataTree)
      }

      if (Object.keys(res.values[1].InnerTree).length > 0){
        let numData = res.values[1].InnerTree['{0;0;0;0}'].length

        let data = JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0}'][0].data)
        let mesh = rhino.DracoCompression.decompressBase64String(data)
        var baseMesh = meshToThreejs(mesh, whiteMat, 1.85)
        baseMesh.name = "base"
        base = baseMesh
        scene.add(base)

        for (let i=0; i<numData; i++){
          let data = JSON.parse(res.values[1].InnerTree['{0;0;0;0}'][i].data)
          let mesh = rhino.DracoCompression.decompressBase64String(data)
          var threeMesh = meshToThreejs(mesh, greyMat, 2.05)
          var outlineMesh = meshtoOutline(mesh, blackLine)
          threeMesh.name = "genParcel"
          outlineMesh.name = "outline"
          threeMesh.key = i
          outlineMesh.key = i
          parcelMeshes[i] = threeMesh
          outlineMeshes[i] = outlineMesh
          var evaRaw = JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0}'][i].data).split(",")
          var processedEdges = processEdges(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0;0}'][i].data))

          dataCol[i] = {"mesh": threeMesh,
                      "outline": outlineMesh,
                      "id": i,
                      "mesh": threeMesh,
                      "outline": outlineMesh,
                      "program": "none",
                      // "coords": processCoords(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0}'][i].data)),
                      "coords": processedEdges[0],
                      "edgecat": processedEdges[1],
                      "area": truncate(parseFloat(evaRaw[0])),
                      "orientation": truncate(parseFloat(evaRaw[1])),
                      "elongation": truncate(parseFloat(evaRaw[2])),
                      "compactness": truncate(parseFloat(evaRaw[3])),
                      "convexity": truncate(parseFloat(evaRaw[4]))}
        }

        document.getElementById("macro3").innerHTML = "Average parcel area: " + truncate(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0}'][0].data)) + " sqm"
        document.getElementById("macro4").innerHTML = "Average orientation: " + truncate(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0}'][1].data))
        document.getElementById("macro5").innerHTML = "Average elongation: " + truncate(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0}'][2].data))
        document.getElementById("macro6").innerHTML = "Average compactness: " + truncate(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0}'][3].data))
        document.getElementById("macro7").innerHTML = "Aveage convexity: " + truncate(JSON.parse(res.values[1].InnerTree['{0;0;0;0;0;0;0;0}'][4].data))
      }
      saveData[num]['datacol'] = dataCol
      displayOffsetSol()
    }

  // Trees
  // Default offset mode
  document.getElementById("treeContainer").style.display = "none"
  // document.getElementById("treeButtons").style.display = "none"

  // For multiple modes
  document.getElementById("offsetSol").addEventListener("click", () => {
    document.getElementById("macros").style.display = "block"
    document.getElementById("treeContainer").style.display = "none"
    resetResultDiv()
    displayOffsetSol()
    parcelViewingMode = "offset"
  })
  document.getElementById("treeGen").addEventListener("click", () => {
    document.getElementById("macros").style.display = "none"
    document.getElementById("treeContainer").style.display = "block"
    document.getElementById("treeContainerGen").style.display = "block"
    document.getElementById("treeContainerDepth").style.display = "none"
    resetResultDiv()
    parcelViewingMode = "tree"
  })
  document.getElementById("treeDepth").addEventListener("click", () => {
    document.getElementById("macros").style.display = "none"
    document.getElementById("treeContainer").style.display = "block"
    document.getElementById("treeContainerGen").style.display = "none"
    document.getElementById("treeContainerDepth").style.display = "block"
    resetResultDiv()
    parcelViewingMode = "tree"
  })

  // Create our custom external renderer (three.js integration)
  var threeExternalRenderer = {
    /**
     * Setup function, called once by the ArcGIS JS API. It's usually our init()
     */
    setup: function(context) {
      // mouse
      mouse = new THREE.Vector2();
      mouse_down = new THREE.Vector2();

      // renderer
      renderer = new THREE.WebGLRenderer({
        context: context.gl,
        // premultipliedAlpha: false
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setViewport(0, 0, view.width, view.height);

      // prevent three.js from clearing the buffers provided by the ArcGIS JS API.
      renderer.autoClearDepth = false;
      renderer.autoClearStencil = false;
      renderer.autoClearColor = false;

      // The ArcGIS JS API renders to custom offscreen buffers, and not to the default framebuffers.
      // We have to inject this bit of code into the three.js runtime in order for it to bind those
      // buffers instead of the default ones.
      var originalSetRenderTarget = renderer.setRenderTarget.bind(renderer);
      renderer.setRenderTarget = function(target) {
        originalSetRenderTarget(target);
        if (target == null) {
          context.bindRenderTarget();
        }
      }

      raycaster = new THREE.Raycaster();
      scene = new THREE.Scene();

      // setup the camera
      camera = new THREE.PerspectiveCamera();
      //camera.aspect = view.width / view.height

      // setup scene lighting
      ambient = new THREE.AmbientLight( 0xffffff, 0.5);
      scene.add(ambient);
      sun = new THREE.HemisphereLight( 0xffffff, 1);
      scene.add(sun);

      // Init Rhino
      const definitionName = 'static/gh/parcel4work_Simplified_edgeInfo_exploded_ec2.gh'
      let definition

      rhino3dm().then( async m => {
        console.log( 'Loaded rhino3dm.' )
        rhino = m // global
    
        //RhinoCompute.url = 'http://localhost:8081/'; // RhinoCompute server url. Use http://localhost:8081 if debugging locally.
        RhinoCompute.url = "http://52.77.234.70:80/"; // RhinoCompute server url. Use http://localhost:8081 if debugging locally.
        RhinoCompute.apiKey = '0hOfevzxs49OfbXDqyUx' // RhinoCompute server api key. Leave blank if debugging locally.
    
        // load a grasshopper file!
        const url = definitionName
        const res = await fetch(url)
        const buffer = await res.arrayBuffer()
        const arr = new Uint8Array(buffer)
        definition = arr
      })

      document.getElementById("actionButton").addEventListener("click", () => {
        if (state == 0){
          if (currentPolygon != undefined){
            if (pointOne != undefined){
              toState2()
            } else {
              toState1()
            }
            savedPolygon = currentPolygon
            savedPolygonGraphic = currentPolygonGraphic
          } else {
            alert("Please draw a polygon first")
          }
        } else if (state == 1){
          if (pointOne != undefined && pointTwo != undefined){
            toState2()
          } else {
            alert("Please select 2 access points")
          }
        } else if (state == 2) {
          if (document.getElementById("pRoad").value + document.getElementById("sRoad").value > 100){
            alert("Primary roads and secondary roads percentage should add up to AT MOST 100%")
          } else {
            toState3()
            compute()
          }
        } else if (state == 3) {
          document.getElementById("popup").style.display = "block"
          document.getElementById("resetPrompt").style.display = "block"
          popup = true
        } else if(state == 4) {
          clearCurrentSelection()
          document.getElementById("multiButton").style.display = "block";
          removeAllChildNodes(document.getElementById("resultB"))
          removeAllBuildings()
          toState3()
          document.getElementById("loader").style.display = "none"
        }
      })

      document.getElementById("finalResetButton").addEventListener("click", (event) => {
        if (document.querySelector('#reset1').checked && document.querySelector('#reset2').checked){
          toState2()
          resetSceneAndData()
          sketchLayer.add(savedPolygonGraphic)
          sketchLayer.add(pointOneGraphic)
          sketchLayer.add(pointTwoGraphic)
        } else if (document.querySelector('#reset1').checked){
          toState1()
          resetSceneAndData()
          clearPoints()
          sketchLayer.add(savedPolygonGraphic)
          pointOne = undefined
          pointTwo = undefined
          pointOneGraphic = undefined
          pointTwoGraphic = undefined
        } else if (document.querySelector('#reset2').checked){
          toState0()
          resetSceneAndData()
          clearPolygon()
          sketchLayer.add(pointOneGraphic)
          sketchLayer.add(pointTwoGraphic)
          savedPolygon = undefined
          savedPolygonGraphic = undefined
        } else {
          toState0()
          clearEverything()
          pointOne = undefined
          pointTwo = undefined
          pointOneGraphic = undefined
          pointTwoGraphic = undefined
          savedPolygon = undefined
          savedPolygonGraphic = undefined
        }
        document.getElementById("popup").style.display = "none"
        document.getElementById("resetPrompt").style.display = "none"
        popup = false
      })

      for (let i=0; i<5; i++){
        document.getElementById("save" + i).addEventListener("click", () => {
          if (saveSlots[i] == undefined){
            return
          } else {
            reDisplaySlot(i)
          }
        })
      }

      async function compute() {
        let weightArr = []
        for (let i=0; i<8; i++){
          weightArr.push(document.getElementById("w" + i).value)
        }

        var pRoad = document.getElementById("pRoad").value / 100
        var sRoad = document.getElementById("sRoad").value / 100
        let roadPercentage = [pRoad, sRoad, (1 - pRoad - sRoad)]

        const param1 = new RhinoCompute.Grasshopper.DataTree('Coords')
        param1.append([0], [savedPolygon.rings.toString()])
        const param2 = new RhinoCompute.Grasshopper.DataTree('PointAX')
        param2.append([0], [pointOne.x])
        const param3 = new RhinoCompute.Grasshopper.DataTree('PointAY')
        param3.append([0], [pointOne.y])
        const param4 = new RhinoCompute.Grasshopper.DataTree('PointBX')
        param4.append([0], [pointTwo.x])
        const param5 = new RhinoCompute.Grasshopper.DataTree('PointBY')
        param5.append([0], [pointTwo.y])
        const param6 = new RhinoCompute.Grasshopper.DataTree('MinArea')
        param6.append([0], [document.getElementById("minArea").value])
        const param7 = new RhinoCompute.Grasshopper.DataTree('Orientation')
        param7.append([0], [document.getElementById("orientation").value])
        const param8 = new RhinoCompute.Grasshopper.DataTree('Roads')
        param8.append([0], roadPercentage)
        
        const trees = []
        trees.push(param1)
        trees.push(param2)
        trees.push(param3)
        trees.push(param4)
        trees.push(param5)
        trees.push(param6)
        trees.push(param7)
        trees.push(param8)
        console.log(trees)
    
        try {
          const res = await RhinoCompute.Grasshopper.evaluateDefinition(definition, trees)
          console.log(res)
          saveData[0] = {'empty': false,
                        'arcgis': {'polygon': savedPolygonGraphic,
                                  'pointone': pointOneGraphic,
                                  'pointtwo': pointTwoGraphic},
                        'raw': res,
                        'datacol': undefined,
                        'datatree': undefined,
                        'depthtree': undefined
                        }
          savePolygon[0] = savedPolygon
          displaySlot(0)
        }
        catch(error){
          console.error(`Not possible to build...`);
        }
      }
    },

    // Our three.js render() function
    render: function(context) {
      // update camera parameters
      var cam = context.camera;
      camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
      //camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
      camera.up.set( 0, 0, 1 );
      camera.lookAt(new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2]));

      // Projection matrix can be copied directly
      camera.projectionMatrix.fromArray(cam.projectionMatrix);
      var renderPos = [0, 0, 0];
      //var posEst = [103.96, 1.35, 0];
      var posEst = [0,0,2]
      // DEBUG THIS seems to work somewhat better with webmercator instead of WS84 but still off idk
      externalRenderers.toRenderCoordinates(view, posEst, 0, SpatialReference.WebMercator, renderPos, 0, 100);
      //model.position.set(renderPos[0], renderPos[1], renderPos[2]);

      // Raycasting portion
      if (parcelViewingMode == "offset"){
        var isect_objs = Object.values(parcelMeshes)
      } else if (parcelViewingMode == "tree"){
        var isect_objs = Object.values(parcelMeshesTree)
      }
      raycaster.setFromCamera( mouse, camera );
      var intersects = raycaster.intersectObjects( isect_objs );
      if (intersects.length > 0){
          var isect0 = intersects[ 0 ];
          pointedKey = isect0.object.key
          console.log(pointedKey)
      } else {
        pointedKey = undefined
      }

      // draw the scene
      renderer.resetState();
      renderer.render(scene, camera);

      // animate (continuously update)
      externalRenderers.requestRender(view);

      // cleanup
      context.resetWebGLState();
    }
  }

  // register the external renderer
  externalRenderers.add(view, threeExternalRenderer);
});