"use strict";

const welcome = document.querySelector("dialog.welcome");
const playing = document.querySelector("dialog.playing");
const final = document.querySelector("dialog.final");
const over = document.querySelector("dialog.over");

const startButton = document.querySelector("button#start");
const restartButton = document.querySelector("button#restart");

const message = document.querySelector("#message");
const status = document.querySelector("#status");
const visualizer = document.querySelector("#audio-visualizer");

const iosAudio = document.querySelector("#ios-audio");

const mp3 = fetch("res/35%20Lost%20Woods.mp3").then(res => res.arrayBuffer());
const finalMp3 = fetch("res/OOT_Secret.wav").then(res => res.arrayBuffer());
const overMp3 = fetch("res/73 Game Over.mp3").then(res => res.arrayBuffer());
let audioCtx, audioSource, audioGain, audioAnalyser, audioAnalyserData, finalSource, overSource;


const initialView = [-27.623, 153.153], initialZoom = 20;


const startingPoint = [-27.623500, 153.153407];
const finalPoint = [-27.618850, 153.155566];
const path = [
    startingPoint,
    [-27.623386, 153.152935],
    [-27.623348, 153.152584],
    [-27.623215, 153.152560],
    [-27.622953, 153.152589],
    [-27.622970, 153.152433],
    [-27.622949, 153.152318],
    [-27.622906, 153.152227],
    [-27.622816, 153.152230],
    [-27.622737, 153.152270],
    [-27.622661, 153.152272],
    [-27.622611, 153.152423],
    [-27.622552, 153.152498],
    [-27.622504, 153.152637],
    [-27.622953, 153.152589],
    [-27.622970, 153.152433],
    [-27.622949, 153.152318],
    [-27.622906, 153.152227],
    [-27.622816, 153.152230],
    [-27.622737, 153.152270],
    [-27.622661, 153.152272],
    [-27.622611, 153.152423],
    [-27.622552, 153.152498],
    [-27.622504, 153.152637],
    [-27.622326, 153.152854],
    [-27.622110, 153.153353],
    [-27.621982, 153.153688],
    [-27.621733, 153.154133],
    [-27.621684, 153.154115],
    [-27.621646, 153.154058],
    [-27.621608, 153.154160],
    [-27.621307, 153.154597],
    [-27.621242, 153.154606],
    [-27.621190, 153.154472],
    [-27.621050, 153.153900],
    [-27.620700, 153.153300],
    [-27.620575, 153.152978],
    [-27.620529, 153.153044],
    [-27.620358, 153.153168],
    [-27.620228, 153.153388],
    [-27.620211, 153.153632],
    [-27.620180, 153.153887],
    [-27.619942, 153.154560],
    [-27.619553, 153.154630],
    [-27.619424, 153.154705],
    [-27.619355, 153.154839],
    [-27.619332, 153.155120],
    [-27.619282, 153.155220],
    [-27.619132, 153.155273],
    finalPoint
];

const inRadius = 15;
const outRadius = 35;
const gameOverTimeout = 30;
const gameAbortRadius = 200;

const DEBUG = true;

let state = "initial";
let waypoint = 0;
let leftPathSince = null;


let map = L.map('map').setView(initialView, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.circle(startingPoint, inRadius, { color: 'red' }).addTo(map);


if (DEBUG) {
    L.polyline(path, { color: 'red' }).addTo(map);
}
if (DEBUG) {
    map.on("click", (e) => {
        console.log(`[${e.latlng.lat}, ${e.latlng.lng}]`);

        let setView = lc.options.setView;
        try {
            lc.options.setView = false;
            map.fire("locationfound", e);
        } finally {
            lc.options.setView = setView;
        }
    });
}


let lc = L.control.locate({
    setView: "untilPanOrZoom",
    flyTo: true,
    clickBehavior: { inView: 'setView', outOfView: 'inView', inViewNotFollowing: 'inView' },
    showPopup: false
}).addTo(map);


welcome.showModal();


map.on("locationfound", (e) => {
    let player = turf.point([e.latlng.lng, e.latlng.lat]);
    let start = turf.point(startingPoint.toReversed());
    let finish = turf.point(finalPoint.toReversed());

    // GPS granted and working
    if (state == "walk-to-start") {
        let distance = turf.distance(player, start, { units: "m" });
        status.textContent = `: ${distance.toFixed(0)}m`;

        if (distance <= inRadius) {
            // Player reached starting point
            startAudio();
            state = "playing";
            waypoint = 0;
            message.textContent = "Find your way through Lost Woods without getting lost"
            status.textContent = "";
        }
    }

    if (state == "playing") {
        // At each moment, only consider a slice of the path close to the current waypoint,
        // so we can support paths that loop back on themselves while still guiding the player
        // along the intended sequence of waypoints.
        let pathSlice = [Math.max(0, waypoint), waypoint + 5];
        let currentPath = turf.lineString(path.slice(pathSlice[0], pathSlice[1]).map(p => p.toReversed()));
        let nearestPoint = turf.nearestPointOnLine(currentPath, player, { units: "m" });

        waypoint = Math.max(waypoint, pathSlice[0] + nearestPoint.properties.segmentIndex);

        setAudioVolume(nearestPoint.properties.pointDistance);
        if (DEBUG) {
            status.textContent = `: ${nearestPoint.properties.pointDistance.toFixed(0)}m`;
        }

        if (waypoint >= path.length - 3) {
            // Only check for final when close to the last waypoint
            let distance = turf.distance(player, finish, { units: "m" });

            if (distance <= inRadius) {
                // Player reached final point
                state = "final";
                playing.close();
                final.showModal();
                playFinalAudio();
            }
        }

        if (nearestPoint.properties.pointDistance <= outRadius) {
            leftPathSince = null;
        } else {
            let now = Date.now();
            if (leftPathSince == null) {
                leftPathSince = now;
            }

            if (nearestPoint.properties.pointDistance > gameAbortRadius || now - leftPathSince > gameOverTimeout * 1000) {
                // Game over
                state = "over";
                playing.close();
                over.showModal();
                playOverAudio();
            }
        }
    }
});


startButton.addEventListener("click", () => {
    welcome.close();
    playing.show();

    state = "walk-to-start";

    message.textContent = "Please walk to the starting position shown in red on the map";
    status.textContent = "";

    lc.start();
});

restartButton.addEventListener("click", () => {
    over.close();
    welcome.showModal();

    state = "initial";
});


document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        pauseAudio();
    } else {
        resumeAudio();
    }
});


async function startAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();

        iosAudio.play();
    }

    audioSource = audioCtx.createBufferSource();
    audioGain = audioCtx.createGain();
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyserData = new Float32Array(audioAnalyser.fftSize);

    let buffer = await mp3;
    audioSource.buffer = await audioCtx.decodeAudioData(buffer.slice(0));
    audioSource.loop = true;
    audioSource.loopStart = 2.035;
    audioSource.loopEnd = 32.925;

    audioSource.connect(audioGain);
    audioGain.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);

    let finalBuffer = await finalMp3;
    finalSource = audioCtx.createBufferSource();
    finalSource.buffer = await audioCtx.decodeAudioData(finalBuffer.slice(0));
    finalSource.connect(audioCtx.destination);

    let overBuffer = await overMp3;
    overSource = audioCtx.createBufferSource();
    overSource.buffer = await audioCtx.decodeAudioData(overBuffer.slice(0));
    overSource.connect(audioCtx.destination);

    audioSource.start();
};

async function setAudioVolume(distance) {
    let now = audioCtx.currentTime;
    let then = now + 1;

    audioGain.gain.cancelScheduledValues(now);
    audioGain.gain.setValueAtTime(audioGain.gain.value, now);

    if (distance <= inRadius) {
        audioGain.gain.linearRampToValueAtTime(1, then);
    } else if (distance <= outRadius) {
        // Set level to fall-off linearly from 1 to 0
        let level = 1 - (distance - inRadius) / (outRadius - inRadius);
        // Use a power to accentuate the fall-off
        audioGain.gain.linearRampToValueAtTime(Math.pow(level, 3), then);
    } else {
        audioGain.gain.linearRampToValueAtTime(0, then);
    }
}

async function pauseAudio() {
    if (audioCtx) {
        await audioCtx.suspend();
    }
}

async function resumeAudio() {
    if (audioCtx) {
        await audioCtx.resume();
    }
}

async function playFinalAudio() {
    audioSource.stop();
    finalSource.start();
}

async function playOverAudio() {
    audioSource.stop();
    overSource.start();
}


function drawVisualizer() {
    const w = visualizer.clientWidth, h = visualizer.clientHeight;
    visualizer.width = w;
    visualizer.height = h;

    let ctx = visualizer.getContext("2d");

    if (state == "playing") {
        ctx.fillStyle = "#404040";
        ctx.fillRect(0, 0, w, h);

        if (audioAnalyser) {
            audioAnalyser.getFloatTimeDomainData(audioAnalyserData);

            ctx.lineWidth = 1;
            ctx.strokeStyle = "#b95cb9";
            ctx.beginPath();

            const step = w / audioAnalyserData.length;
            let x = step;

            ctx.moveTo(0, h / 2);

            for (let i = 1; i < audioAnalyserData.length; i++) {
                const amplify = 2.5;
                const v = amplify * audioAnalyserData[i];
                const y = (1 + v) * (h / 2);

                ctx.lineTo(x, y);

                x += step;
            }

            ctx.lineTo(w, h / 2);
            ctx.stroke();
        }
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    requestAnimationFrame(drawVisualizer);
}

drawVisualizer();