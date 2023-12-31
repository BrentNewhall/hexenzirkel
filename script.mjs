import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

let selections = [];
let hexField = [];
let hexFieldWidth = 1;
let hexFieldHeight = 1;
const hexagonSize = 1;
const hexagonDepth = 1;

const colorMap = {
  'g': 0x00aa00,
  'm': 0x8b4513,
  'w': 0x0000aa,
  'r': 0xf4a460,
}
let moving = null;
let heightChange = 0;

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

// Load sky
function loadSky(filename) {
	const textureLoader = new THREE.TextureLoader();
	const texture = textureLoader.load( filename, () => {
		const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
		rt.fromEquirectangularTexture(renderer, texture);
		scene.background = rt.texture;
	});
}
loadSky('textures/sky6.jpg');

function getBaseLand() {
  const material = new THREE.MeshBasicMaterial({ color: 0x006600 });
  const cubeGeometry = new THREE.BoxGeometry(30, 30, 30);
  const cubeMesh = new THREE.Mesh(cubeGeometry, material);
  cubeMesh.position.y = -15.1;
  cubeMesh.customType = 'base';
  return cubeMesh;
}
function resizeBaseLand(baseLand, hexFieldWidth, hexFieldHeight) {
  const maxDimension = (hexFieldWidth > hexFieldHeight) ? hexFieldWidth : hexFieldHeight;
  const newSize = maxDimension / 13;
  baseLand.scale.set( newSize, 1, newSize );
}
let baseLand = getBaseLand();
scene.add(baseLand);

function createBaseHexField(hexField, hexFieldWidth, hexFieldHeight) {
  for( let i = 0; i < hexFieldWidth; i++ ) {
    hexField[i] = [];
    for( let j = 0; j < hexFieldHeight; j++ ) {
      hexField[i][j] = {
        height: 0,
        color: colorMap['g'],
        x: i,
        y: j
      }
    }
  }
}

function parseDataToArray(fileContent) {
  for( let [lineIndex,line] of fileContent.split('\n').entries()) {
    line = line.trim();
    if( line.length > 0 ) {
      if( line[0] === '=' ) {
        const fields = line.substring(1).split(' ');
        const x = parseInt(fields[0]);
        const y = parseInt(fields[1]);
        const angle = parseInt(fields[2]);
        const filename = fields[3];
        loadMechFile(filename, x, y, angle);
      }
      else {
        hexField[lineIndex] = [];
        let cellIndex = 0;
        while( line.length > 0 ) {
          const height = parseInt(line[0]);
          let hexType = line[1];
          if( ! colorMap.hasOwnProperty(hexType) ) {
            hexType = 'g';
          }
          hexField[lineIndex][cellIndex] = {
            height: height,
            color: colorMap[hexType],
            x: cellIndex,
            y: lineIndex
          };
          line = line.substring(2);
          cellIndex++;
        }
      }
    }
  }
  hexFieldWidth = hexField[0].length;
  hexFieldHeight = hexField.length;
}

function readMapFile(fileURL) {
  fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to fetch the file');
      }
      return response.text();
    })
    .then((fileContent) => {
      parseDataToArray(fileContent);
      createBaseHexField(hexField, hexFieldWidth, hexFieldHeight);
      createHexField(hexField, hexFieldWidth, hexFieldHeight);
      resizeBaseLand(baseLand, hexFieldWidth, hexFieldHeight)
    })
}

readMapFile('maps/001.map');

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

function clearHexField(hexField, hexFieldWidth, hexFieldHeight) {
  for( let j = 0; j < hexFieldHeight; j++ ) {
    for( let i = 0; i < hexFieldWidth; i++ ) {
      if( "mesh" in hexField[i][j] ) {
        scene.remove(hexField[i][j].mesh );
      }
    }
  }
  hexField = [];
}

function createHexField(hexField, hexFieldWidth, hexFieldHeight) {
  const height = 0.25;
    const xOffset = hexFieldWidth * 0.8;
    const yOffset = hexFieldHeight * 0.75;
    for( let j = 0; j < hexFieldHeight; j++) {
        for( let i = 0; i < hexFieldWidth; i++) {
            const hexagonGeometry = create3DHexagonGeometry(hexagonSize, 0.2);
            const material = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
            const hexagonMesh = new THREE.Mesh(hexagonGeometry, material);
            hexagonMesh.customType = 'hex';
            hexagonMesh.hexFieldX = i;
            hexagonMesh.hexFieldY = j;
            changeHexHeight(hexagonMesh, 0);
            // Set mesh color
            hexagonMesh.material.color.setHex(hexField[i][j].color);
            // Position the hexagon appropriately
            hexagonMesh.position.x = i * 1.75 - xOffset;
            hexagonMesh.position.z = j * 1.75 - yOffset;
            // Position alternate rows up for a hex pattern
            if( i % 2 == 1) {
                hexagonMesh.position.z -= 0.875;
            }
            hexagonGeometry.computeBoundingBox();
            hexField[i][j].mesh = hexagonMesh;
            scene.add(hexagonMesh);
        }
    }
}

// Load STL file
function loadMechFile(filename, x, y, angle) {
  const loader = new STLLoader();
  loader.load('models/' + filename, function (geometry) {
    const material = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.customType = 'mech';
    mesh.position.set(-0.5, 0, 1.25);
    moveMechToHex(mesh, hexField[x][y], x, y);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    rotateMech(mesh, THREE.MathUtils.degToRad(angle * 60));
    mesh.scale.set(0.05, 0.05, 0.05);
    scene.add(mesh);
  },
  function (xhr) {
    console.log(parseInt(xhr.loaded / xhr.total * 100) + '% loaded');
  },
  function (error) {
    console.error('An error loading the STL occurred: ', error);
  });
}

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

function moveMechToHex(mech, hex, x, y) {
  if( "height" in hex ) {
    mech.position.x = hex.x * 1.75 - hexFieldWidth * 0.8;
    mech.position.y = hex.height * 0.25;
    mech.position.z = hex.y * 1.75 - hexFieldHeight * 0.75;
    if( hex.x % 2 == 1) {
      mech.position.z -= 0.875;
    }
  }
  else {
    mech.position.x = hex.position.x;
    mech.position.z = hex.position.z;
  }
  mech.customX = x;
  mech.customY = y;
}

function addSelection(object) {
  // If clicking on the base, do nothing
  if( object.customType == 'base' ) {
    return;
  }
  // If clicking on a hex and selectedColor is not null, change hex color
  if( object.customType == 'hex'  &&  selectedColor != null ) {
    object.material.color.setHex(selectedColor);
    return;
  }
  // If clicking on a hex and heightChange is not 0, change hex height
  if( object.customType == 'hex'  &&  heightChange != 0 ) {
    changeHexHeight(object, heightChange);
    return;
  }
  if( object.customType == 'hex'  &&  selections.length > 0  &&  selections[selections.length-1].object.customType == 'mech') {
    // Get the previous selection (a mech)
    const previousSelection = selections.pop();
    // Reset color of previousSelection (a mech)
    previousSelection.object.material.color.setHex(previousSelection.originalColor);
    moving = {
      object: previousSelection.object,
      target: object,
      dx: (object.position.x - previousSelection.object.position.x) / 50,
      dy: (object.position.y - previousSelection.object.position.y) / 50,
      dz: (object.position.z - previousSelection.object.position.z) / 50,
    };
    previousSelection.object.customX = object.hexFieldX;
    previousSelection.object.customY = object.hexFieldY;
    return;
  }
  // If re-clicking on the same hex, reset the color and remove it from selections
  if( object.customType == 'hex'  &&  selections.length > 0  &&  selections[selections.length-1].object.customType == 'hex') {
    const previousSelection = selections.pop();
    previousSelection.object.material.color.setHex(previousSelection.originalColor);
    return;
  }
  // If re-clicking on the same mech, reset the color and remove it from selections
  if( object.customType == 'mech'  &&  selections.length > 0  &&  selections[selections.length-1].object.customType == 'mech') {
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

function moveMech() {
  const mech = moving.object;
  mech.position.x += moving.dx;
  mech.position.y += moving.dy;
  mech.position.z += moving.dz;
  if( Math.abs(mech.position.x - moving.target.position.x) < 0.1  &&  Math.abs(mech.position.z - moving.target.position.z) < 0.1 ) {
    mech.position.x = moving.target.position.x;
    mech.position.y = moving.target.position.y;
    mech.position.z = moving.target.position.z;
    moving = null;
  }
}

function changeHexHeight(object,amount) {
  if( hexField[object.hexFieldX][object.hexFieldY].height + amount >= 0  &&  hexField[object.hexFieldX][object.hexFieldY].height + amount <= 9 ) {
    hexField[object.hexFieldX][object.hexFieldY].height += amount;
    const newHeight = hexField[object.hexFieldX][object.hexFieldY].height;
    object.scale.y = hexagonDepth * (newHeight + 1);
    object.geometry.computeBoundingBox();
    object.position.y = newHeight * hexagonDepth / 5;
  }
}

function animate() {
  if( moving != null ) {
    moveMech();
  }
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Hamburger menu
const menuToggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const mechPalette = document.getElementById('mech-palette');

menuToggle.addEventListener('click', () => {
  menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
  if( menu.style.display === 'block' ) {
    document.getElementById('dice-palette').style.display = 'none';
    document.getElementById('tile-palette').style.display = 'none';
    document.getElementById('resize-palette').style.display = 'none';
    mechPalette.style.display = 'none';
    selectedColor = null;
    heightChange = 0;
  }
});
document.getElementById('menu-btn-change-tiles').addEventListener('click', () => {
  menu.style.display = 'none';
  const palette = document.getElementById('tile-palette');
  palette.style.display = (palette.style.display === 'block') ? 'none' : 'block';
  selectedColor = null;
});
document.getElementById('menu-btn-resize-board').addEventListener('click', () => {
  menu.style.display = 'none';
  const palette = document.getElementById('resize-palette');
  palette.style.display = (palette.style.display === 'block') ? 'none' : 'block';
});
document.getElementById('roll-dice').addEventListener('click', () => {
  let rolls = [0,0];
  for( let i = 0; i < rolls.length; i++ ) {
    rolls[i] = Math.floor(Math.random() * 6 + 1);
  }
  console.log(rolls)
  document.getElementById("die1").innerText = rolls[0];
  document.getElementById("die2").innerText = rolls[1];
  document.getElementById("dice-result").innerText = rolls[0] + rolls[1];
});
document.getElementById('menu-btn-display-dice').addEventListener('click', () => {
  menu.style.display = 'none';
  const palette = document.getElementById('dice-palette');
  palette.style.display = (palette.style.display === 'block') ? 'none' : 'block';
});
document.getElementById('resize-board').addEventListener('click', () => {
  clearHexField(hexField, hexFieldWidth, hexFieldHeight);
  hexFieldWidth = parseInt(document.getElementById('board-width').value);
  hexFieldHeight = parseInt(document.getElementById('board-length').value);
  createBaseHexField(hexField, hexFieldWidth, hexFieldHeight);
  createHexField(hexField, hexFieldWidth, hexFieldHeight);
  resizeBaseLand(baseLand, hexFieldWidth, hexFieldHeight);
});
var selectedColor = null;
function setupColorPalette() {
  const palette = document.getElementById('tile-palette');
  for( let [key,value] of Object.entries(colorMap)) {
    const div = document.createElement('div');
    div.className = 'tile';
    div.style.backgroundColor = '#' + value.toString(16).padStart(6, '0');
    div.addEventListener('click', () => {
      // Remove .tile-selected class from all .tile elements
      const tiles = document.querySelectorAll('.tile');
      for( let tile of tiles ) {
        tile.classList.remove('tile-selected');
      }
      // Select this tile
      div.classList.add('tile-selected');
      selectedColor = value;
    });
    palette.appendChild(div);
  }
  const upDiv = document.createElement('div');
  upDiv.className = 'tile';
  upDiv.style.backgroundColor = '#ffffff';
  upDiv.addEventListener('click', () => {
    if( heightChange === 0 ) {
      heightChange = 1;
      // Remove .tile-selected class from all .tile elements
      const tiles = document.querySelectorAll('.tile');
      for( let tile of tiles ) {
        tile.classList.remove('tile-selected');
      }
      // Select this tile
      upDiv.classList.add('tile-selected');
    }
    else {
      heightChange = 0;
      upDiv.classList.remove('tile-selected');
    }
  });
  const upSpan = document.createElement('span');
  upSpan.className = 'tile-control';
  upSpan.innerHTML = '&#x25B2;';
  upDiv.appendChild(upSpan);
  palette.appendChild(upDiv);
  const downDiv = document.createElement('div');
  downDiv.className = 'tile';
  downDiv.style.backgroundColor = '#ffffff';
  downDiv.addEventListener('click', () => {
    if( heightChange === 0 ) {
      heightChange = -1;
      // Remove .tile-selected class from all .tile elements
      const tiles = document.querySelectorAll('.tile');
      for( let tile of tiles ) {
        tile.classList.remove('tile-selected');
      }
      // Select this tile
      downDiv.classList.add('tile-selected');
    }
    else {
      heightChange = 0;
      downDiv.classList.remove('tile-selected');
    }
  });
  const downSpan = document.createElement('span');
  downSpan.className = 'tile-control';
  downSpan.innerHTML = '&#x25BC;';
  downDiv.appendChild(downSpan);
  palette.appendChild(downDiv);
  const closeDiv = document.createElement('div');
  closeDiv.className = 'tile';
  closeDiv.style.backgroundColor = '#ffffff';
  closeDiv.addEventListener('click', () => {
    palette.style.display = 'none';
    selectedColor = null;
    // Remove .tile-selected class from all .tile elements
    const tiles = document.querySelectorAll('.tile');
    for( let tile of tiles ) {
      tile.classList.remove('tile-selected');
    }
    heightChange = 0;
  });
  const closeSpan = document.createElement('span');
  closeSpan.className = 'tile-control';
  closeSpan.innerHTML = '&times;';
  closeDiv.appendChild(closeSpan);
  palette.appendChild(closeDiv);
}
setupColorPalette();

export { loadMechFile };