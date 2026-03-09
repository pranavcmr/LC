import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

type ProgressEntry = {
  date: string;
  timestamp?: string;
  count: number;
  easy?: number;
  medium?: number;
  hard?: number;
};

type Stats = Record<string, ProgressEntry[]>;

const getEntryKey = (entry: ProgressEntry): string => entry.timestamp ?? entry.date;

const toMs = (value: string): number => {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    const fallback = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(fallback) ? 0 : fallback;
  }
  return time;
};

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async (showLoader: boolean) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await fetch(`/stats.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          setStats(data);
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        if (showLoader && isMounted) {
          setLoading(false);
        }
      }
    };

    void loadStats(true);
    const intervalId = window.setInterval(() => void loadStats(false), 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const leaderboard = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats)
      .map(([user, entries]) => {
        const latest = entries[entries.length - 1];
        const previous = entries[entries.length - 2];
        const gain = previous ? latest.count - previous.count : 0;

        return {
          user,
          latestCount: latest?.count ?? 0,
          lastUpdated: latest?.timestamp ?? latest?.date ?? '-',
          gain,
        };
      })
      .sort((a, b) => b.latestCount - a.latestCount);
  }, [stats]);

  const progressChartData = useMemo(() => {
    if (!stats) return null;

    const lineColors = ['#22d3ee', '#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa'];

    return {
      datasets: Object.entries(stats).map(([user, entries], index) => {
        const points = entries
          .map(item => ({ x: toMs(getEntryKey(item)), y: item.count }))
          .sort((a, b) => a.x - b.x);

        return {
          label: user,
          data: points,
          borderColor: lineColors[index % lineColors.length],
          backgroundColor: lineColors[index % lineColors.length],
          borderWidth: 2,
          tension: 0.26,
          spanGaps: true,
          pointRadius: 3,
          pointHoverRadius: 4,
          clip: 12,
        };
      }),
    };
  }, [stats]);

  const difficultyChartData = useMemo(() => {
    if (!stats || !leaderboard.length) return null;

    return {
      labels: leaderboard.map(item => item.user),
      datasets: [
        {
          label: 'Easy',
          data: leaderboard.map(item => {
            const latest = stats[item.user][stats[item.user].length - 1];
            return latest?.easy ?? 0;
          }),
          backgroundColor: '#9a9a9a',
        },
        {
          label: 'Medium',
          data: leaderboard.map(item => {
            const latest = stats[item.user][stats[item.user].length - 1];
            return latest?.medium ?? 0;
          }),
          backgroundColor: '#737373',
        },
        {
          label: 'Hard',
          data: leaderboard.map(item => {
            const latest = stats[item.user][stats[item.user].length - 1];
            return latest?.hard ?? 0;
          }),
          backgroundColor: '#525252',
        },
      ],
    };
  }, [stats, leaderboard]);

  const hasDifficultyData = useMemo(() => {
    if (!stats) return false;

    return Object.values(stats).some(entries => {
      const latest = entries[entries.length - 1];
      return (
        typeof latest?.easy === 'number' ||
        typeof latest?.medium === 'number' ||
        typeof latest?.hard === 'number'
      );
    });
  }, [stats]);

  if (loading) return <div className="status">Loading stats...</div>;

  if (!leaderboard.length || !progressChartData || !difficultyChartData) {
    return (
      <div className="status">
        No stats found. Run <code>scripts/update_progress.py</code> to generate data.
      </div>
    );
  }

  return (
    <main className="page">
      <section className="analysis-panel">
        <h1>LeetCode Leaderboard</h1>
        <p className="subtitle">Questions solved over time</p>
        <div className="chart-wrap">
          <Line
            data={progressChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { color: '#d0d0d0' } },
                tooltip: {
                  backgroundColor: '#111111',
                  borderColor: '#3a3a3a',
                  borderWidth: 1,
                },
              },
              layout: {
                padding: {
                  left: 8,
                  right: 12,
                  top: 8,
                  bottom: 4,
                },
              },
              scales: {
                x: {
                  type: 'linear',
                  ticks: {
                    color: '#cfcfcf',
                    autoSkip: true,
                    maxTicksLimit: 8,
                    callback: value => {
                      const ms = typeof value === 'number' ? value : Number(value);
                      if (!Number.isFinite(ms)) return '';
                      return new Date(ms).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      });
                    },
                  },
                  grid: { color: 'rgba(255, 255, 255, 0.12)' },
                },
                y: {
                  grace: '5%',
                  ticks: {
                    color: '#cfcfcf',
                    stepSize: 10,
                    precision: 0,
                  },
                  grid: { color: 'rgba(255, 255, 255, 0.16)' },
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </section>

      <section className="leaderboard-panel">
        <h2>Current Leaderboard</h2>
        <p className="subtitle">Ranked by total solved problems</p>
        <div className="leaderboard-grid">
          {leaderboard.map((entry, index) => (
            <article className="leaderboard-card" key={entry.user}>
              <div className="card-rank">#{index + 1}</div>
              <div className="card-name">{entry.user}</div>
              <div className="card-total">{entry.latestCount}</div>
              <div className="card-meta">
                <span>{entry.gain >= 0 ? `+${entry.gain}` : entry.gain} recent</span>
                <span>{entry.lastUpdated}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-panel">
        <h2>Difficulty Distribution</h2>
        <p className="subtitle">Stacked Easy / Medium / Hard totals per user</p>
        <div className="chart-wrap">
          <Bar
            data={difficultyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { color: '#d0d0d0' } },
                tooltip: {
                  backgroundColor: '#111111',
                  borderColor: '#3a3a3a',
                  borderWidth: 1,
                },
              },
              layout: {
                padding: {
                  left: 8,
                  right: 12,
                  top: 8,
                  bottom: 4,
                },
              },
              scales: {
                x: {
                  stacked: true,
                  ticks: {
                    color: '#cfcfcf',
                    autoSkip: true,
                    maxTicksLimit: 8,
                  },
                  grid: { display: false },
                },
                y: {
                  stacked: true,
                  grace: '5%',
                  ticks: {
                    color: '#cfcfcf',
                    stepSize: 10,
                    precision: 0,
                  },
                  grid: { color: 'rgba(255, 255, 255, 0.16)' },
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
        {!hasDifficultyData && (
          <p className="helper-note">
            Difficulty split needs one fresh run of <code>scripts/update_progress.py</code> to populate easy/medium/hard.
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
