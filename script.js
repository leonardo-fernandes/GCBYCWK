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
const finalCoordinates = final.querySelector("p.coordinates");
const finalHint = final.querySelector("p.hint");

const iosAudio = document.querySelector("#ios-audio");

const mp3 = fetch("res/35%20Lost%20Woods.mp3").then(res => res.arrayBuffer());
const finalMp3 = fetch("res/OOT_Secret.wav").then(res => res.arrayBuffer());
const overMp3 = fetch("res/73 Game Over.mp3").then(res => res.arrayBuffer());
let audioCtx, audioSource, audioGain, audioAnalyser, audioAnalyserData, finalSource, overSource;

const F = Number.parseFloat; // Decimal coordinates are stored as strings and parsed at runtime, this results in better source code obfuscation

const initialView = [F("-27.623"), F("153.153")];
const initialZoom = 20;

const startingPoint = [F("-27.623500"), F("153.153407")];
const finalPoint    = [F("-27.618850"), F("153.155566")];

const cacheCoordinates = "S27 37.132 E153 09.333";
const cacheHint = "Hint: search under the bench.";

const route = [
    startingPoint,
    [F("-27.623386"), F("153.152935")],
    [F("-27.623348"), F("153.152584")],
    [F("-27.623215"), F("153.152560")],
    [F("-27.622953"), F("153.152589")],
    [F("-27.622970"), F("153.152433")],
    [F("-27.622949"), F("153.152318")],
    [F("-27.622906"), F("153.152227")],
    [F("-27.622816"), F("153.152230")],
    [F("-27.622737"), F("153.152270")],
    [F("-27.622661"), F("153.152272")],
    [F("-27.622611"), F("153.152423")],
    [F("-27.622552"), F("153.152498")],
    [F("-27.622504"), F("153.152637")],
    [F("-27.622953"), F("153.152589")],
    [F("-27.622970"), F("153.152433")],
    [F("-27.622949"), F("153.152318")],
    [F("-27.622906"), F("153.152227")],
    [F("-27.622816"), F("153.152230")],
    [F("-27.622737"), F("153.152270")],
    [F("-27.622661"), F("153.152272")],
    [F("-27.622611"), F("153.152423")],
    [F("-27.622552"), F("153.152498")],
    [F("-27.622504"), F("153.152637")],
    [F("-27.622326"), F("153.152854")],
    [F("-27.622110"), F("153.153353")],
    [F("-27.621982"), F("153.153688")],
    [F("-27.621733"), F("153.154133")],
    [F("-27.621684"), F("153.154115")],
    [F("-27.621646"), F("153.154058")],
    [F("-27.621608"), F("153.154160")],
    [F("-27.621307"), F("153.154597")],
    [F("-27.621242"), F("153.154606")],
    [F("-27.621190"), F("153.154472")],
    [F("-27.621050"), F("153.153900")],
    [F("-27.620700"), F("153.153250")],
    [F("-27.620575"), F("153.152978")],
    [F("-27.620529"), F("153.153044")],
    [F("-27.620358"), F("153.153168")],
    [F("-27.620228"), F("153.153388")],
    [F("-27.620211"), F("153.153632")],
    [F("-27.620180"), F("153.153887")],
    [F("-27.619942"), F("153.154560")],
    [F("-27.619553"), F("153.154630")],
    [F("-27.619424"), F("153.154705")],
    [F("-27.619355"), F("153.154839")],
    [F("-27.619332"), F("153.155120")],
    [F("-27.619282"), F("153.155220")],
    [F("-27.619132"), F("153.155273")],
    finalPoint
];

const inRadius = 10; // Distance within which the player is 100% in-route
const outRadius = 30; // Distance outside of which the player is off-route
const gameOverTimeout = 30; // Seconds to trigger a game over if the player remains off-route
const gameAbortRadius = 200; // Distance outside of which triggers a game over immediately

const DEBUG = true;

let state = "initial";
let waypoint = 0;
let leftRouteSince = null;


let map = L.map('map').setView(initialView, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.circle(startingPoint, inRadius, { color: 'red' }).addTo(map);


if (DEBUG) {
    // Draws the route on the map (only for debugging)
    L.polyline(route, { color: 'red' }).addTo(map);
}
if (DEBUG) {
    // Transform clicks on the map into locationfound events to simulate a player's walk (only for debugging)
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
        // At each moment, only consider a slice of the route close to the current waypoint,
        // so we can support routes that loop back on themselves while still guiding the player
        // along the intended sequence of waypoints.
        let routeSlice = [Math.max(0, waypoint), waypoint + 5];
        let currentRoute = turf.lineString(route.slice(routeSlice[0], routeSlice[1]).map(p => p.toReversed()));
        let nearestPoint = turf.nearestPointOnLine(currentRoute, player, { units: "m" });

        waypoint = Math.max(waypoint, routeSlice[0] + nearestPoint.properties.segmentIndex);

        setAudioVolume(nearestPoint.properties.pointDistance);
        if (DEBUG) {
            status.textContent = `: ${nearestPoint.properties.pointDistance.toFixed(0)}m`;
        }

        if (waypoint >= route.length - 3) {
            // Only check for final when close to the last waypoint
            let distance = turf.distance(player, finish, { units: "m" });

            if (distance <= inRadius) {
                // Player reached final point
                state = "final";
                playing.close();

                finalCoordinates.textContent = cacheCoordinates;
                finalHint.textContent = cacheHint;
                final.showModal();
                window.getSelection().selectAllChildren(finalCoordinates);

                playFinalAudio();
            }
        }

        if (nearestPoint.properties.pointDistance <= outRadius) {
            leftRouteSince = null;
        } else {
            let now = Date.now();
            if (leftRouteSince == null) {
                leftRouteSince = now;
            }

            if (nearestPoint.properties.pointDistance > gameAbortRadius || now - leftRouteSince > gameOverTimeout * 1000) {
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


// A visualizer supports hard-of-hearing players
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