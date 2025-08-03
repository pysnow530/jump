// 初始化图表
const ctx = document.getElementById('myChart').getContext('2d');
let chart;
let autoAddInterval;
const MAX_POINTS = 200; // 最大点数限制

let index = 0;

// 初始数据
let data = {
    labels: [],
    datasets: [
        {
            label: '第一组数据',
            data: [],
            tension: 0.1,
            fill: false
        },
        {
            label: '第二组数据',
            data: [],
            tension: 0.1,
            fill: false
        },
    ]
};

// 创建图表
function initChart() {
    chart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '时间/序号'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '数值'
                    },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            },
            animation: {
                duration: 0 // 禁用动画以获得更好的性能
            }
        }
    });
}

// 添加一个数据点
function addDataPoint(value) {
    // 添加新数据
    data.labels.push(index + '');
    index += 1;
    data.datasets[0].data.push(value[0]);
    data.datasets[1].data.push(value[1]);
    
    // 如果数据超过最大点数，移除最旧的数据
    if (data.labels.length > MAX_POINTS) {
        data.labels.shift();
        data.datasets[0].data.shift();
        data.datasets[1].data.shift();
    }
    
    // 更新图表
    chart.update();
}

// 生成随机数
function getRandomValue() {
    return Math.sin(new Date().getTime() * 500) + Math.random() * 0.3;
}

// 重置图表
function resetChart() {
    data.labels = [];
    data.datasets[0].data = [];
    data.datasets[1].data = [];
    chart.update();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    
    // 添加随机点按钮
    document.getElementById('addPoint').addEventListener('click', () => {
        addDataPoint([getRandomValue(), getRandomValue()]);
    });
    
    // 自动添加按钮
    document.getElementById('startAuto').addEventListener('click', () => {
        if (!autoAddInterval) {
            autoAddInterval = setInterval(() => {
                addDataPoint([getRandomValue(), getRandomValue()]);
            }, 20); // 每500毫秒添加一个点
        }
    });
    
    // 停止自动添加按钮
    document.getElementById('stopAuto').addEventListener('click', () => {
        if (autoAddInterval) {
            clearInterval(autoAddInterval);
            autoAddInterval = null;
        }
    });
    
    // 重置按钮
    document.getElementById('resetChart').addEventListener('click', resetChart);
});
