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

let lastVideoTime = -1;
let lastKneels = null;
let lastLastKneels = null;
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
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            drawingUtils.drawLandmarks(landmark, {
                radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
            });
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            canvasCtx.restore();

            // 检测膝盖的纵坐标值
            const currKneels = [landmark[25], landmark[26]];
            const currAnkles = [landmark[27], landmark[28]];
            if (!currKneels[0] || !currKneels[1]) {
                console.log(`kneels数据为空: ${JSON.stringify(currKneels)}, ${JSON.stringify(currAnkles)}, ${JSON.stringify(landmark[0])}`);
                return;
            }

            addDataPoint(currAnkles[0].y, currAnkles[1].y);

            if (lastLastKneels !== null && lastKneels !== null) {
                // 检测是否为一次的结束
                if (currKneels[0].y <= lastKneels[0].y && lastKneels[0].y >= lastLastKneels[0].y
                    && currKneels[1].y <= lastKneels[1].y && lastKneels[1].y >= lastLastKneels[1].y) {
                    console.log('++++++++++++++++++++++++++++1');
                }
            }

            lastLastKneels = lastKneels;
            lastKneels = currKneels;
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
    datasets: [
        {
            label: 'Left Ankle',
            data: [],
            tension: 0.1,
            fill: false
        },
        {
            label: 'Right Ankle',
            data: [],
            tension: 0.1,
            fill: false
        },
    ]
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
                    text: '数值'
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

const addDataPoint = (leftAnkle, rightAnkle) => {
    panelData.labels.push(dataIndex + '');
    dataIndex += 1;
    panelData.datasets[0].data.push(leftAnkle);
    panelData.datasets[1].data.push(rightAnkle);

    // 如果数据超过最大点数，移除最旧的数据
    if (panelData.labels.length > MAX_POINTS) {
        panelData.labels.shift();
        panelData.datasets[0].data.shift();
        panelData.datasets[1].data.shift();
    }
    
    // 更新图表
    chart.update();
};

// addDataPoint(0.8, 0.6);
