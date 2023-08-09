import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

import { loadMechFile } from './script.mjs';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 3);

const sun = new THREE.DirectionalLight(0xffffff, 5.0);
sun.position.set(5, 10, 5); // Position the light to simulate the sun
scene.add(sun);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.28, window.innerWidth * 0.28);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.left = '50%';
renderer.domElement.style.top = '50%';
renderer.domElement.style.transform = 'translate(-50%, -50%)';
renderer.domElement.zIndex = 1;
document.getElementById('mech-palette').appendChild(renderer.domElement);

let currPaletteMech = 0;
const mechs = [
  'BT-BushWacker_IIC-reset.stl',
  'Mirness-1A-reset.stl'
];
let mesh = null;

function animate() {
    if( mesh !== null ) {
        mesh.rotation.z += 0.01;
    }
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();
  
function loadMechForPalette() {
    if( mesh !== null ) {
        scene.remove(mesh);
    }
    const filename = mechs[currPaletteMech];
    const loader = new STLLoader();
    loader.load('models/' + filename, function (geometry) {
        const material = new THREE.MeshLambertMaterial({ color: 0x666666 });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.scale.set(0.05, 0.05, 0.05);
        scene.add(mesh);
    },
    function (xhr) {
        console.log(parseInt(xhr.loaded / xhr.total * 100) + '% loaded for palette');
    },
    function (error) {
        console.log('An error loading the STL occurred: ', error);
    });
}

function nextMech() {
    currPaletteMech = (currPaletteMech + 1) % mechs.length;
    loadMechForPalette();
}

function previousMech() {
    currPaletteMech = currPaletteMech - 1;
    if( currPaletteMech < 0 ) currPaletteMech = mechs.length - 1;
    loadMechForPalette();
}

const mechPalette = document.getElementById('mech-palette');
const menu = document.querySelector('.menu');

document.getElementById('menu-btn-add-mech').addEventListener('click', () => {
  menu.style.display = 'none';
  mechPalette.style.display = (mechPalette.style.display === 'block') ? 'none' : 'block';
  if( mechPalette.style.display === 'none' ) {

  }
  loadMechForPalette();
});
document.getElementById('mech-palette-next').addEventListener('click', () => {
    nextMech();
});
document.getElementById('mech-palette-previous').addEventListener('click', () => {
    previousMech();
});
document.getElementById('mech-palette-add').addEventListener('click', () => {
    loadMechFile( mechs[currPaletteMech], 0, 0, 0 );
});
document.getElementById('mech-palette-close').addEventListener('click', () => {
    mechPalette.style.display = 'none';
});
