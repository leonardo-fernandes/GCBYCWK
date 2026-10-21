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


const startingPoint = [-27.623500564886086, 153.15340772544184];
const finalPoint = [-27.618956585692814, 153.15544531455188];
const path = [
    startingPoint,
    [-27.623386490625155, 153.15293575308038],
    [-27.623348465554997, 153.1525844576619],
    [-27.62321537872081, 153.15256032271162],
    [-27.622953957682657, 153.1525898209842],
    [-27.622970659077186, 153.15243377621422],
    [-27.62294927005878, 153.15231846478503],
    [-27.62290649200947, 153.1522272883061],
    [-27.62281620108864, 153.15223003790317],
    [-27.6227377745568, 153.1522702628203],
    [-27.6226617245329, 153.15227294448144],
    [-27.622611816676006, 153.15242311750555],
    [-27.622552402530964, 153.1524982040176],
    [-27.622504871191754, 153.1526376503971],
    [-27.622953957682657, 153.1525898209842],
    [-27.622970659077186, 153.15243377621422],
    [-27.62294927005878, 153.15231846478503],
    [-27.62290649200947, 153.1522272883061],
    [-27.62281620108864, 153.15223003790317],
    [-27.6227377745568, 153.1522702628203],
    [-27.6226617245329, 153.15227294448144],
    [-27.622611816676006, 153.15242311750555],
    [-27.622552402530964, 153.1524982040176],
    [-27.622504871191754, 153.1526376503971],
    [-27.622326615721086, 153.15285482988614],
    [-27.622110347515022, 153.1533536188591],
    [-27.621982012333604, 153.15368882650216],
    [-27.621846547256755, 153.15374782304733],
    [-27.621684939577396, 153.15411521062413],
    [-27.62164691420642, 153.1540588957401],
    [-27.621608888822223, 153.15416079886361],
    [-27.621307061866816, 153.15459790963018],
    [-27.621242984991767, 153.15460654302626],
    [-27.621190699892214, 153.154472459969],
    [-27.621133661573353, 153.1539843976407],
    [-27.620848469533232, 153.15321207923103],
    [-27.621005325247204, 153.1530726328515],
    [-27.620793774495322, 153.15302435582856],
    [-27.62057512665234, 153.15297876758913],
    [-27.62072485293977, 153.15309944234062],
    [-27.620838929973726, 153.1531933004807],
    [-27.621005325247204, 153.1530726328515],
    [-27.620793774495322, 153.15302435582856],
    [-27.62057512665234, 153.15297876758913],
    [-27.620529897303804, 153.15304483555235],
    [-27.62035879696407, 153.1531685842401],
    [-27.620228154626112, 153.1533885620866],
    [-27.620211518306583, 153.15363259325076],
    [-27.620180622277953, 153.15388735105952],
    [-27.619942960227625, 153.1545604480068],
    [-27.6195531933485, 153.1546301711966],
    [-27.619424855170088, 153.15470525770866],
    [-27.619355904393988, 153.1548394875951],
    [-27.61933209487834, 153.15512083355338],
    [-27.619282185503813, 153.15522005501575],
    [-27.619132457243794, 153.15527368823865],
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
        // Set level to fall off linearly from 1 to 0
        let level = 1 - (distance - inRadius) / (outRadius - inRadius);
        // Use a power to accentuate the fall off
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