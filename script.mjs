import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

let selections = [];

// Create the scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 20);

// Add a "sun" (directional light) to the scene
const sun = new THREE.DirectionalLight(0xffffff, 5.0);
sun.position.set(5, 10, 5); // Position the light to simulate the sun
scene.add(sun);
// Add ambient light to illuminate the entire scene
//const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
//scene.add(ambientLight);

let hexField = [];
let hexFieldWidth = 15;
let hexFieldHeight = 15;
for( let i = 0; i < hexFieldWidth; i++) {
    hexField[i] = [];
    for( let j = 0; j < hexFieldHeight; j++) {
        hexField[i][j] = {
          height: 1,
          color: 0x00aa00,
          x: i,
          y: j,
        };
    }
}
hexField[0][0].height = 3;
hexField[0][1].height = 2;
hexField[0][2].height = 2;
hexField[1][0].height = 3;
hexField[1][1].height = 2;
hexField[1][2].height = 2;
hexField[2][0].height = 2;
hexField[0][0].color = 0x8b4513;
hexField[1][0].color = 0x8b4513;

function create3DHexagonGeometry(size, depth) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = size * Math.cos(angle);
      const y = size * Math.sin(angle);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    const extrudeSettings = {
      depth: depth,
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate the geometry (90 degrees around the Y-axis)
    const rotationAngle = Math.PI / 2; // 90 degrees in radians
    const matrix = new THREE.Matrix4().makeRotationX(rotationAngle);
    geometry.applyMatrix4(matrix);
    return geometry;
  }

const hexagonSize = 1;
const hexagonDepth = 0.2;

function createHexField(hexField, hexFieldWidth, hexFieldHeight) {
  const height = 0.25;
    const xOffset = hexFieldWidth * 0.75;
    const yOffset = hexFieldHeight * 0.75;
    for( let j = 0; j < hexFieldHeight; j++) {
        for( let i = 0; i < hexFieldWidth; i++) {
            const hexagonGeometry = create3DHexagonGeometry(hexagonSize, hexagonDepth + hexField[i][j].height * height);
            const material = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
            const hexagonMesh = new THREE.Mesh(hexagonGeometry, material);
            hexagonMesh.customType = 'hex';
            hexagonMesh.hexFieldX = i;
            hexagonMesh.hexFieldY = j;
            // Set mesh color
            hexagonMesh.material.color.setHex(hexField[i][j].color);
            // Position the hexagon appropriately
            hexagonMesh.position.x = i * 1.75 - xOffset;
            hexagonMesh.position.z = j * 1.75 - yOffset;
            // Position alternate rows up for a hex pattern
            if( i % 2 == 1) {
                hexagonMesh.position.z -= 0.875;
            }
            // Raise the hexagon appropriately
            hexagonMesh.position.y = hexField[i][j].height * height;
            hexagonGeometry.computeBoundingBox();
            scene.add(hexagonMesh);
        }
    }
}
createHexField(hexField, hexFieldWidth, hexFieldHeight);

// Load STL file
const loader = new STLLoader();
loader.load('models/Legionnaire_Final_Print.stl', function (geometry) {
  const material = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.customType = 'mech';
  mesh.position.set(-0.5, 1, 1.25);
  moveMechToHex(mesh, hexField[parseInt(hexFieldWidth/2)][parseInt(hexFieldHeight/2)]);
  mesh.rotation.set(-Math.PI / 2, 0, 0.35);
  mesh.scale.set(0.05, 0.05, 0.05);
  scene.add(mesh);
},
function (xhr) {
  console.log(parseInt(xhr.loaded / xhr.total * 100) + '% loaded');
},
function (error) {
  console.log('An error loading the STL occurred: ', error);
});

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

let controls = new MapControls( camera, renderer.domElement );

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', onClick);

function onClick(event) {
  // Calculate normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Find intersected objects
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const selectedObject = intersects[0].object;
    addSelection(selectedObject);
  }
}

function moveMechToHex(mech, hex) {
  if( "height" in hex ) {
    mech.position.x = hex.x * 1.75 - hexFieldWidth * 0.75;
    mech.position.z = hex.y * 1.75 - hexFieldHeight * 0.75;
    if( hex.x % 2 == 1) {
      mech.position.z -= 0.875;
    }
  }
  else {
    mech.position.x = hex.position.x;
    mech.position.z = hex.position.z;
  }
}

function addSelection(object) {
  if( object.customType == 'hex'  &&  selections.length > 0  &&  selections[selections.length-1].object.customType == 'mech') {
    // Get the previous selection (a mech)
    const previousSelection = selections.pop();
    // Reset color of previousSelection (a mech)
    previousSelection.object.material.color.setHex(previousSelection.originalColor);
    moveMechToHex(previousSelection.object, object);
    return;
  }
  // If re-clicking on the same hex, reset the color and remove it from selections
  if( object.customType == 'hex'  &&  selections.length > 0  &&  selections[selections.length-1].object == object) {
    const previousSelection = selections.pop();
    previousSelection.object.material.color.setHex(previousSelection.originalColor);
    return;
  }
  selections.push({
    object: object,
    originalColor: object.material.color.getHex(),
  });
  object.material.color.setHex(0xffffff); // Change color to white
}

function getSelectedMech() {
  if( selections.length > 0  &&  selections[selections.length-1].object.customType == 'mech') {
    return selections[selections.length-1].object;
  }
  return null;
}

// Rotate the mesh by a given angle
function rotateMech(object, angle) {
  const rotationQuaternion = new THREE.Quaternion();
  rotationQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  object.quaternion.multiply(rotationQuaternion);
}

// Detect the left arrow key press and rotate the mesh
window.addEventListener('keydown', function (event) {
  if (event.key === 'ArrowLeft') {
    const mech = getSelectedMech();
    if( mech != null) {
      const angle = THREE.MathUtils.degToRad(60); // Convert 120 degrees to radians
      rotateMech(mech, angle);
    }
  }
  else if (event.key === 'ArrowRight') {
    const mech = getSelectedMech();
    if( mech != null) {
      const angle = THREE.MathUtils.degToRad(60); // Convert 120 degrees to radians
      rotateMech(mech, -angle);
    }
  }
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
