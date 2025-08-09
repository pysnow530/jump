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

let poseLandmarker = null;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// 加载模型, 打开摄像头
const loadModelAndCamera = async () => {
    // 加载模型
    const vision = await FilesetResolver.forVisionTasks("/node_modules/@mediapipe/tasks-vision/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            // modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            modelAssetPath: `/models/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: 'VIDEO',
        numPoses: 2
    });

    // 打开摄像头
    const hasGetUserMedia = () => { var _a; return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia); };
    if (hasGetUserMedia()) {
        enableCam();
    }
    else {
        alert("getUserMedia() is not supported by your browser");
    }
};
loadModelAndCamera();

// Enable the live webcam view and start detection.
function enableCam() {
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
        // 监听视频帧
        video.addEventListener("loadeddata", predictWebcam);
        // 重置视频大小 (尽可能占满整个屏幕)
        video.addEventListener('loadedmetadata', function() {
            const winWidth = window.innerWidth;
            const ratioHeight = winWidth / video.videoWidth * video.videoHeight;

            const winHeight = window.innerHeight;
            const ratioWidth = winHeight / video.videoHeight * video.videoWidth;

            let targetWidth, targetHeight
            if (ratioHeight < winHeight) {
                targetWidth = winWidth;
                targetHeight = ratioHeight;
            } else {
                targetWidth = ratioWidth;
                targetHeight = winHeight;
            }

            canvasElement.style.height = targetHeight + 'px';
            video.style.height = targetHeight + 'px';
            canvasElement.style.width = targetWidth + 'px';
            video.style.width = targetWidth + 'px';

            document.getElementById('main').style.height = targetHeight + 'px';
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
    window.requestAnimationFrame(predictWebcam);
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
