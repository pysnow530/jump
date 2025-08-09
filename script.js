// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
const demosSection = document.getElementById("demos");
let poseLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoWidth = window.innerWidth / 2;
// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
    // const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    const vision = await FilesetResolver.forVisionTasks("/node_modules/@mediapipe/tasks-vision/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            // modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            modelAssetPath: `/models/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numPoses: 2
    });
    demosSection.classList.remove("invisible");
};
createPoseLandmarker();
/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);
// Check if webcam access is supported.
const hasGetUserMedia = () => { var _a; return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia); };
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
function enableCam(_) {
    if (!poseLandmarker) {
        console.log("Wait! poseLandmaker not loaded yet.");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        video.addEventListener('loadedmetadata', function() {
            const videoHeight = videoWidth / video.videoWidth * video.videoHeight;
            canvasElement.style.height = videoHeight + 'px';
            video.style.height = videoHeight + 'px';
            canvasElement.style.width = videoWidth + 'px';
            video.style.width = videoWidth + 'px';
        })
    });
}

const NODES = [
    { idx: 11, label: 'Left Shoulder' }, { idx: 12, label: 'Right Shoulder' },
    { idx: 23, label: 'Left Hip' }, { idx: 24, label: 'Right Hip' },
    { idx: 25, label: 'Left Knee' }, { idx: 26, label: 'Right Knee' },
    { idx: 27, label: 'Left Ankle' }, { idx: 28, label: 'Right Ankle' },
];

let lastVideoTime = -1;
let lastLandmark = null;
let hasUpList = _.range(33).map(_ => false);
let minYList = null

async function predictWebcam() {
    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
            if (result.landmarks.length === 0) {
                // console.log('没有检测到数据');
                return;
            }
            if (_.some(result.landmarks[0], i => i.y > 1)) {
                // console.log(`有数据点超出边界 ${result.landmarks[0]}`);
                return;
            }

            const landmark = result.landmarks[0];
            if (_.some(landmark, i => !i)) {
                console.log(`部分数据为空, 退出: ${JSON.stringify(landmark)}`);
                return;
            }

            // 检测跳绳计数
            if (lastLandmark && minYList) {
                const isUpList = _.map(lastLandmark, (p, idx) => landmark[idx].y < p.y)
                hasUpList = _.map(hasUpList, (b, idx) => b || isUpList[idx])

                // 如果关键骨骼节点都已满足, 就做进一步判断
                const keyNodesAllHasUp = _.every(NODES, n => hasUpList[n.idx]);
                const deltaAllBigEnough = _.every(NODES, n => landmark[n.idx].y - minYList[n.idx] > 0.01)
                if (keyNodesAllHasUp && deltaAllBigEnough) {
                    const audio = document.getElementById('bgMusic');
                    audio.play(); // 可能需要用户交互后触发（如点击事件）
                    hasUpList = _.range(33).map(_ => false);
                    minYList = null
                }
            }
            lastLandmark = landmark;
            if (minYList) {
                minYList = _.map(minYList, (y, idx) => Math.min(y, lastLandmark[idx].y));
            } else {
                minYList = _.map(lastLandmark, i => i.y);
            }

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            drawingUtils.drawLandmarks(landmark, {
                radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
            });
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            canvasCtx.restore();

            // 检测膝盖的纵坐标值
            const nodeData = _.map(NODES, (node) => landmark[node.idx]);
            addDataPoint(_.map(nodeData, _.property('y')));
        });
    }
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// debug panel
const panelCtx = document.getElementById('debug-panel').getContext('2d');
const MAX_POINTS = 200;
let dataIndex = 0;
let panelData = {
    labels: [],
    datasets: _.map(NODES, (node) => ({
        label: node.label,
        data: [],
        tension: 0.1,
        fill: false
    }))
};

let chart = new Chart(panelCtx, {
    type: 'line',
    data: panelData,
    options: {
        responsive: true,
        scales: {
            x: {
                title: {
                    display: true,
                    text: '帧序号'
                }
            },
            y: {
                title: {
                    display: true,
                    text: '关节y值'
                },
                // suggestedMin: 0,
                // suggestedMax: 1
            }
        },
        animation: {
            duration: 0 // 禁用动画以获得更好的性能
        }
    }
});

const addDataPoint = (ys) => {
    panelData.labels.push(dataIndex + '');
    dataIndex += 1;
    _.each(_.range(ys.length), (i) => panelData.datasets[i].data.push(ys[i]))

    // 如果数据超过最大点数，移除最旧的数据
    if (panelData.labels.length > MAX_POINTS) {
        panelData.labels.shift();
        _.each(_.range(ys.length), (i) => panelData.datasets[i].data.shift())
    }

    // 更新图表
    chart.update();
};

// addDataPoint([0.8, 0.6]);
