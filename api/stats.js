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

function buildStreakBar(weeks, currentStreak, boxX, boxY, boxW, boxH) {
  const days = weeks.flatMap((w) => w.contributionDays).slice(-30);
  const maxCount = Math.max(...days.map((d) => d.contributionCount), 1);

  const padding = 10;
  const totalW = boxW - padding * 2;
  const barGap = 2;
  const barW = Math.floor((totalW - barGap * 29) / 30);
  const barMaxH = boxH - 10;
  const baseY = boxY + boxH - 4;
  const startX = boxX + padding;

  return days
    .map((day, i) => {
      const h = Math.max(2, Math.round((day.contributionCount / maxCount) * barMaxH));
      const x = startX + i * (barW + barGap);
      const isActive = day.contributionCount > 0;
      const isRecent = i >= days.length - currentStreak;
      const color = isRecent && isActive ? "#f78166" : isActive ? "#58a6ff" : "#21262d";
      const opacity = isActive ? "0.9" : "0.4";
      return `<rect x="${x}" y="${baseY - h}" width="${barW}" height="${h}" rx="1" fill="${color}" opacity="${opacity}"/>`;
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

function generateSVG(stats, streak, rank, last30, totalStars, weeks) {
  const w = 480;
  const h = 340;

  // Layout constants
  const PAD = 20;
  const INNER_W = w - PAD * 2;

  // Row Y positions
  const HEADER_CY = 38;
  const DIVIDER1_Y = 66;
  const STATS_Y = 76;
  const STATS_H = 56;
  const STREAK_Y = STATS_Y + STATS_H + 12;
  const STREAK_H = 80;
  const BAR_Y = STREAK_Y + STREAK_H + 12;
  const BAR_H = 50;
  const DIVIDER2_Y = BAR_Y + BAR_H + 12;
  const TAGS_LABEL_Y = DIVIDER2_Y + 18;
  const TAGS_Y = TAGS_LABEL_Y + 10;
  const TAGS_H = 20;
  const FOOTER_Y = TAGS_Y + TAGS_H + 18;

  // Stat box widths — 4 equal boxes
  const BOX_GAP = 8;
  const BOX_W = Math.floor((INNER_W - BOX_GAP * 3) / 4);

  const statBoxes = [
    { label: "COMMITS/30D", value: last30,                            color: "#58a6ff", x: PAD },
    { label: "TOTAL STARS", value: totalStars,                        color: "#f78166", x: PAD + (BOX_W + BOX_GAP) },
    { label: "REPOS",       value: stats.repositories.totalCount,     color: "#e3b341", x: PAD + (BOX_W + BOX_GAP) * 2 },
    { label: "RANK",        value: rank,                              color: "#bc8cff", x: PAD + (BOX_W + BOX_GAP) * 3 },
  ].map(b => `
    <rect x="${b.x}" y="${STATS_Y}" width="${BOX_W}" height="${STATS_H}" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="${b.x + BOX_W / 2}" y="${STATS_Y + 30}" text-anchor="middle" fill="${b.color}" font-size="20" font-weight="700">${b.value}</text>
    <text x="${b.x + BOX_W / 2}" y="${STATS_Y + 47}" text-anchor="middle" fill="#8b949e" font-size="9">${b.label}</text>
  `).join("");

  // Streak box
  const streakBox = `
    <rect x="${PAD}" y="${STREAK_Y}" width="${INNER_W}" height="${STREAK_H}" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="${PAD + 14}" y="${STREAK_Y + 18}" fill="#8b949e" font-size="9" letter-spacing="1">STREAK</text>
    <text x="${PAD + 14}" y="${STREAK_Y + 42}" fill="#f78166" font-size="14" font-weight="700">&#x1F525; ${streak.current} day streak</text>
    <text x="${PAD + 14}" y="${STREAK_Y + 62}" fill="#8b949e" font-size="9">longest: ${streak.longest} days</text>
    <text x="${PAD + 130}" y="${STREAK_Y + 62}" fill="#8b949e" font-size="9">total active: ${streak.total} days</text>
    <text x="${w - PAD - 14}" y="${STREAK_Y + 62}" text-anchor="end" fill="#3fb950" font-size="9">updated hourly</text>
  `;

  // Bar chart — full width box below streak
  const barChart = buildStreakBar(weeks, streak.current, PAD, BAR_Y, INNER_W, BAR_H);
  const barBox = `
    <rect x="${PAD}" y="${BAR_Y}" width="${INNER_W}" height="${BAR_H}" rx="6" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    ${barChart}
    <text x="${PAD + 10}" y="${BAR_Y + BAR_H - 6}" fill="#30363d" font-size="8">30d activity</text>
    <text x="${w - PAD - 10}" y="${BAR_Y + BAR_H - 6}" text-anchor="end" fill="#f78166" font-size="8">streak</text>
    <rect x="${w - PAD - 60}" y="${BAR_Y + BAR_H - 14}" width="6" height="6" rx="1" fill="#f78166"/>
    <rect x="${w - PAD - 100}" y="${BAR_Y + BAR_H - 14}" width="6" height="6" rx="1" fill="#58a6ff"/>
    <text x="${w - PAD - 92}" y="${BAR_Y + BAR_H - 6}" fill="#58a6ff" font-size="8">active</text>
  `;

  // Tags
  const tags = ["Python", "TypeScript", "LLM", "RAG", "Voice AI", "FastAPI", "React"];
  const tagColors = ["#58a6ff", "#f78166", "#3fb950", "#e3b341", "#bc8cff", "#58a6ff", "#f78166"];
  let tagX = PAD;
  const tagEls = tags.map((tag, i) => {
    const tw = tag.length * 7 + 16;
    const el = `
      <rect x="${tagX}" y="${TAGS_Y}" width="${tw}" height="${TAGS_H}" rx="4" fill="${tagColors[i]}18" stroke="${tagColors[i]}44" stroke-width="1"/>
      <text x="${tagX + tw / 2}" y="${TAGS_Y + 14}" text-anchor="middle" fill="${tagColors[i]}" font-size="10">${tag}</text>
    `;
    tagX += tw + 8;
    return el;
  }).join("");

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>text { font-family: 'JetBrains Mono', 'Courier New', monospace; }</style>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#58a6ff"/>
      <stop offset="100%" stop-color="#f78166"/>
    </linearGradient>
    <clipPath id="clip"><rect width="${w}" height="${h}" rx="12"/></clipPath>
  </defs>

  <g clip-path="url(#clip)">
    <rect width="${w}" height="${h}" fill="#0d1117"/>
    <rect width="${w}" height="3" fill="url(#accent)"/>

    <!-- Header -->
    <circle cx="36" cy="${HEADER_CY}" r="18" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="36" y="${HEADER_CY + 5}" text-anchor="middle" fill="#58a6ff" font-size="13" font-weight="700">N</text>
    <text x="64" y="${HEADER_CY - 6}" fill="#e6edf3" font-size="13" font-weight="700">${stats.login} · v2.6.0</text>
    <text x="64" y="${HEADER_CY + 10}" fill="#8b949e" font-size="10">AI Engineer · Bangalore, India</text>
    <circle cx="${w - PAD - 6}" cy="${HEADER_CY - 4}" r="5" fill="#3fb950"/>
    <text x="${w - PAD - 16}" y="${HEADER_CY}" text-anchor="end" fill="#3fb950" font-size="10">ONLINE</text>

    <!-- Divider -->
    <rect x="${PAD}" y="${DIVIDER1_Y}" width="${INNER_W}" height="0.5" fill="#21262d"/>

    <!-- Stat boxes -->
    ${statBoxes}

    <!-- Streak box -->
    ${streakBox}

    <!-- Bar chart -->
    ${barBox}

    <!-- Divider -->
    <rect x="${PAD}" y="${DIVIDER2_Y}" width="${INNER_W}" height="0.5" fill="#21262d"/>

    <!-- Stack tags -->
    <text x="${PAD}" y="${TAGS_LABEL_Y}" fill="#8b949e" font-size="9" letter-spacing="1">INTELLIGENCE STACK</text>
    ${tagEls}

    <!-- Footer -->
    <text x="${w / 2}" y="${FOOTER_Y}" text-anchor="middle" fill="#30363d" font-size="9">github.com/${USERNAME}</text>
  </g>
</svg>`;
}

module.exports = async function handler(req, res) {
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
    const svg = generateSVG(user, streak, rank, last30, totalStars, weeks);
    res.status(200).send(svg);
  } catch (err) {
    const errorSvg = `<svg width="480" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="100" rx="12" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
      <text x="240" y="55" text-anchor="middle" fill="#f78166" font-size="13" font-family="monospace">⚠ Stats unavailable — ${err.message}</text>
    </svg>`;
    res.status(200).send(errorSvg);
  }
}