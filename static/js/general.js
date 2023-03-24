// ArcGIS sketch init
let currentPolygon = undefined
let savedPolygon = undefined
let pointOne = undefined
let pointTwo = undefined
let currentPolygonGraphic, savedPolygonGraphic, pointOneGraphic, pointTwoGraphic

// Other ArcGIS vars
let view

// General app wide state vars
let state = 0
let popup = false
let parcelViewingMode = "offset"
let markingParcels = false
let currsel = undefined

// General app wide data vars
// all data is already in dataCol, the parcels & outlines are there for easier access to just the meshes
let parcelMeshes = {}
let outlineMeshes = {}
let parcelMeshesTree = {}
let outlineMeshesTree = {}
let dataCol = {}
let dataTree = {}
let depthTree = {}
let buildingsColl = []

let selSlot
let saveSlots = ["current", undefined, undefined, undefined, undefined]
let savePolygon = [undefined, undefined, undefined, undefined, undefined]
let saveData = {0: {'empty': true}, 1: {'empty': true}, 2: {'empty': true}, 3: {'empty': true}, 4: {'empty': true}}

// Marking & assigning parcels function vars
let markedParcels = []
let resiParcels = []

// Compute related vars
let rhino

// ThreeJS related vars (inc raycasting)
let scene, mouse, mouse_down, raycaster, camera, renderer, ambient, sun, base
let pointedKey, selectedKey

// ThreeJS materials
const whiteMat = new THREE.MeshLambertMaterial( { 
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
} );
const greyMat = new THREE.MeshLambertMaterial( { 
    color: 0xededed,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
} );
const blueMat = new THREE.MeshLambertMaterial( { 
    color: 0x35578f,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
} );
const greenMat = new THREE.MeshLambertMaterial( { 
    color: 0x276123,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
} );

const redLine = new THREE.LineBasicMaterial({color: "red"})
const blueLine = new THREE.LineBasicMaterial({color: "blue"})
const blackLine = new THREE.LineBasicMaterial({color: "black"})