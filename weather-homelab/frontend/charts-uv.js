// charts-uv.js
// UV Index chart with color-coded risk levels

function createUVChart(daily) {
  const ctx = document.getElementById('uvChart');
  if (!ctx) return;

  if (charts.uvIndex) charts.uvIndex.destroy();

  const labels = daily.time.map(date => formatDate(date));
  const uvData = daily.uv_index_max || daily.time.map(() => 0);

  charts.uvIndex = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'UV Index',
        data: uvData,
        backgroundColor: uvData.map(uv => {
          if (uv < 3) return 'rgba(34, 197, 94, 0.6)';
          if (uv < 6) return 'rgba(234, 179, 8, 0.6)';
          if (uv < 8) return 'rgba(249, 115, 22, 0.6)';
          if (uv < 11) return 'rgba(239, 68, 68, 0.6)';
          return 'rgba(168, 85, 247, 0.6)';
        }),
        borderWidth: 2,
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              const uv = context.parsed.y;
              let level = 'Low';
              if (uv >= 11) level = 'Extreme';
              else if (uv >= 8) level = 'Very High';
              else if (uv >= 6) level = 'High';
              else if (uv >= 3) level = 'Moderate';
              return `UV Index: ${uv} (${level})`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 12,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: {
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}