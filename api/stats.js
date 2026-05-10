const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || "techynikhil17";

async function fetchGitHubStats(username) {
  const headers = {
    "Content-Type": "application/json",
    ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
  };

  const query = `
    query($username: String!) {
      user(login: $username) {
        name
        login
        followers { totalCount }
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
          totalCount
          nodes { stargazerCount }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables: { username } }),
  });

  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data.user;
}

function computeStreak(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays).sort((a, b) => new Date(b.date) - new Date(a.date));

  const today = new Date().toISOString().split("T")[0];
  let current = 0;
  let longest = 0;
  let total = 0;
  let tempStreak = 0;
  let counting = true;

  for (const day of days) {
    if (day.contributionCount > 0) {
      total++;
      tempStreak++;
      if (tempStreak > longest) longest = tempStreak;
      if (counting) current = tempStreak;
    } else {
      if (counting && day.date !== today) counting = false;
      tempStreak = 0;
    }
  }

  return { current, longest, total };
}

function getContribLast30Days(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return days.filter((d) => new Date(d.date) >= cutoff).reduce((sum, d) => sum + d.contributionCount, 0);
}

function buildStreakBar(weeks, currentStreak) {
  const days = weeks.flatMap((w) => w.contributionDays).slice(-30);
  const maxCount = Math.max(...days.map((d) => d.contributionCount), 1);
  const barW = 14;
  const barGap = 3;
  const barMaxH = 28;
  const startX = 24;
  const baseY = 100;

  return days
    .map((day, i) => {
      const h = Math.max(3, Math.round((day.contributionCount / maxCount) * barMaxH));
      const x = startX + i * (barW + barGap);
      const isActive = day.contributionCount > 0;
      const isRecent = i >= days.length - currentStreak;
      const color = isRecent && isActive ? "#f78166" : isActive ? "#58a6ff" : "#21262d";
      return `<rect x="${x}" y="${baseY - h}" width="${barW}" height="${h}" rx="2" fill="${color}" opacity="${isActive ? 0.9 : 0.5}"/>`;
    })
    .join("");
}

function getRank(commits, prs, stars, followers) {
  const score = commits * 0.4 + prs * 2 + stars * 3 + followers * 1.5;
  if (score >= 500) return "S";
  if (score >= 300) return "A+";
  if (score >= 150) return "A";
  if (score >= 80) return "B+";
  if (score >= 40) return "B";
  return "C";
}

function generateSVG(stats, streak, rank, last30, totalStars, last30Bars) {
  const w = 480;
  const h = 280;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&amp;display=swap');
      text { font-family: 'JetBrains Mono', monospace; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#58a6ff"/>
      <stop offset="100%" stop-color="#f78166"/>
    </linearGradient>
    <clipPath id="clip"><rect width="${w}" height="${h}" rx="12"/></clipPath>
  </defs>

  <g clip-path="url(#clip)">
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="3" fill="url(#accent)"/>

    <!-- Header -->
    <circle cx="36" cy="38" r="18" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="36" y="43" text-anchor="middle" fill="#58a6ff" font-size="13" font-weight="700">N</text>
    <text x="64" y="34" fill="#e6edf3" font-size="13" font-weight="700">${stats.login} · v2.6.0</text>
    <text x="64" y="50" fill="#8b949e" font-size="10">AI Engineer · Bangalore, India</text>

    <!-- Online indicator -->
    <circle cx="440" cy="32" r="5" fill="#3fb950"/>
    <text x="430" y="36" text-anchor="end" fill="#3fb950" font-size="10">ONLINE</text>

    <!-- Divider -->
    <rect x="20" y="64" width="${w - 40}" height="0.5" fill="#21262d"/>

    <!-- Stat boxes -->
    <rect x="20" y="76" width="95" height="52" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="67" y="100" text-anchor="middle" fill="#58a6ff" font-size="18" font-weight="700">${last30}</text>
    <text x="67" y="118" text-anchor="middle" fill="#8b949e" font-size="9">COMMITS/30D</text>

    <rect x="125" y="76" width="95" height="52" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="172" y="100" text-anchor="middle" fill="#f78166" font-size="18" font-weight="700">${totalStars}</text>
    <text x="172" y="118" text-anchor="middle" fill="#8b949e" font-size="9">TOTAL STARS</text>

    <rect x="230" y="76" width="95" height="52" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="277" y="100" text-anchor="middle" fill="#e3b341" font-size="18" font-weight="700">${stats.repositories.totalCount}</text>
    <text x="277" y="118" text-anchor="middle" fill="#8b949e" font-size="9">REPOS</text>

    <rect x="335" y="76" width="125" height="52" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="397" y="97" text-anchor="middle" fill="#bc8cff" font-size="22" font-weight="700">${rank}</text>
    <text x="397" y="118" text-anchor="middle" fill="#8b949e" font-size="9">RANK</text>

    <!-- Streak section -->
    <rect x="20" y="138" width="${w - 40}" height="50" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="34" y="156" fill="#8b949e" font-size="9" letter-spacing="1">STREAK</text>
    <text x="34" y="178" fill="#f78166" font-size="11" font-weight="600">🔥 ${streak.current} day streak</text>
    <text x="300" y="156" fill="#8b949e" font-size="9">longest: ${streak.longest}d</text>
    <text x="390" y="156" fill="#8b949e" font-size="9">total: ${streak.total}d</text>

    <!-- Mini bar chart inside streak box -->
    ${last30Bars}

    <!-- Divider -->
    <rect x="20" y="200" width="${w - 40}" height="0.5" fill="#21262d"/>

    <!-- Stack tags -->
    <text x="20" y="220" fill="#8b949e" font-size="9" letter-spacing="1">INTELLIGENCE STACK</text>

    ${["Python", "TypeScript", "LLM", "RAG", "Voice AI", "FastAPI", "React"]
      .map((tag, i) => {
        const colors = ["#58a6ff", "#f78166", "#3fb950", "#e3b341", "#bc8cff", "#58a6ff", "#f78166"];
        const x = [20, 80, 157, 207, 250, 317, 378];
        return `<rect x="${x[i]}" y="228" width="${tag.length * 7 + 14}" height="18" rx="4" fill="${colors[i]}22" stroke="${colors[i]}44" stroke-width="1"/>
        <text x="${x[i] + 7}" y="241" fill="${colors[i]}" font-size="10">${tag}</text>`;
      })
      .join("")}

    <!-- Footer -->
    <text x="${w / 2}" y="${h - 10}" text-anchor="middle" fill="#30363d" font-size="9">Updated daily · github.com/${USERNAME}</text>
  </g>
</svg>`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  try {
    const username = req.query.username || USERNAME;
    const user = await fetchGitHubStats(username);

    const weeks = user.contributionsCollection.contributionCalendar.weeks;
    const streak = computeStreak(weeks);
    const last30 = getContribLast30Days(weeks);
    const totalStars = user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
    const rank = getRank(
      user.contributionsCollection.totalCommitContributions,
      user.contributionsCollection.totalPullRequestContributions,
      totalStars,
      user.followers.totalCount
    );
    const last30Bars = buildStreakBar(weeks, streak.current);

    const svg = generateSVG(user, streak, rank, last30, totalStars, last30Bars);
    res.status(200).send(svg);
  } catch (err) {
    const errorSvg = `<svg width="480" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="100" rx="12" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
      <text x="240" y="55" text-anchor="middle" fill="#f78166" font-size="13" font-family="monospace">⚠ Stats unavailable — ${err.message}</text>
    </svg>`;
    res.status(200).send(errorSvg);
  }
}
