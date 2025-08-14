// 5개 숫자 배열로부터 평균과 95% 신뢰구간 계산
function calculateStats(data) {
  if (data.length !== 5) {
    throw new Error("배열 길이는 5여야 합니다.");
  }

  // 평균 계산
  const mean = data.reduce((sum, x) => sum + x, 0) / data.length;

  // 표본표준편차 계산 (n-1로 나누는 불편추정량)
  const variance =
    data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (data.length - 1);
  const standardDeviation = Math.sqrt(variance);

  // 표준오차 계산
  const standardError = standardDeviation / Math.sqrt(data.length);

  // t-분포 임계값 (df=4, 95% 신뢰구간)
  const tCritical = 2.776;

  // 95% 신뢰구간 계산
  const marginOfError = tCritical * standardError;
  const confidenceInterval = {
    lower: mean - marginOfError,
    upper: mean + marginOfError,
  };

  return {
    mean: mean,
    standardDeviation: standardDeviation,
    standardError: standardError,
    confidenceInterval: confidenceInterval,
  };
}

// 데이터 정의
const data = {
  database: {
    successRate: [100, 100, 100, 100, 100],
    duration: [3.34, 3.36, 3.24, 3.18, 3.2],
  },
  spinlock: {
    successRate: [84.74, 83.77, 83.26, 82.97, 84.66],
    duration: [10.47, 10.51, 10.53, 10.47, 10.51],
  },
  pubsub: {
    successRate: [92.57, 93.39, 93.08, 92.02, 92.23],
    duration: [6.63, 6.06, 6.06, 6.41, 6.14],
  },
  queue: {
    successRate: [87.73, 90.93, 91.44, 90.2, 92.91],
    duration: [10.08, 7.38, 7.08, 7.54, 7.03],
  },
  fencing: {
    successRate: [37.2, 36.75, 34.33, 35.63, 37.34],
    duration: [5.63, 5.48, 5.19, 5.79, 3.84],
  },
  redlock: {
    successRate: [64.1, 69.25, 69.67, 69.23, 65.26],
    duration: [3.52, 3.65, 3.62, 3.61, 3.71],
  },
};

// 모든 알고리즘의 통계 계산
console.log("Redis Lock 알고리즘 성능 분석 결과\n");
console.log(
  "Algorithm\t| Metric\t\t| Mean\t| Std Dev\t| 95% CI Lower\t| 95% CI Upper"
);
console.log(
  "------------|---------------|-------|-----------|-------------|-------------"
);

Object.keys(data).forEach((algorithm) => {
  const successStats = calculateStats(data[algorithm].successRate);
  const durationStats = calculateStats(data[algorithm].duration);

  console.log(
    `${algorithm}\t| Success Rate (%)\t| ${successStats.mean.toFixed(2)}\t| ${successStats.standardDeviation.toFixed(2)}\t\t| ${successStats.confidenceInterval.lower.toFixed(2)}\t\t| ${successStats.confidenceInterval.upper.toFixed(2)}`
  );
  console.log(
    `${algorithm}\t| Duration (s)\t\t| ${durationStats.mean.toFixed(2)}\t| ${durationStats.standardDeviation.toFixed(2)}\t\t| ${durationStats.confidenceInterval.lower.toFixed(2)}\t\t| ${durationStats.confidenceInterval.upper.toFixed(2)}`
  );
  console.log(
    "------------|---------------|-------|-----------|-------------|-------------"
  );
});
