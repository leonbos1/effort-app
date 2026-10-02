(() => {
  "use strict";

  const FIB = [1, 2, 3, 5, 8, 13, 21];

  const $ = (id) => document.getElementById(id);
  const form = $("pbiForm");
  const inputPanel = $("inputPanel");
  const analysisPanel = $("analysisPanel");
  const resultPanel = $("resultPanel");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const fmt = (n) => n.toLocaleString("nl-NL");

  // ---------- Seeded generator (same PBI -> same estimate) ----------
  function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0) ^ (h1 >>> 0);
  }

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Text "understanding" ----------
  const STOPWORDS = new Set((
    "de het een en of van in op te voor met als dat die dit is zijn wordt worden kan kunnen moet moeten wil willen " +
    "ik je jij we wij ze zij hij u mijn onze er naar bij om aan uit door over ook niet geen wel nog dan maar zodat " +
    "wanneer waar wat wie hoe alle alles meer veel deze dan na tot zo the a an and or of to in on for with as that this " +
    "is are be can should will want user gebruiker kan via per binnen nieuwe nieuw"
  ).split(" "));

  const DOMAINS = [
    [/\b(api|endpoint|rest|graphql|webhook|koppeling|integratie|integration)\w*/i, "API-integratie"],
    [/\b(database|db|sql|tabel|table|migrat|schema|query)\w*/i, "Datalaag"],
    [/\b(login|inlog|auth|wachtwoord|password|sso|oauth|account|rechten|rol)\w*/i, "Authenticatie & autorisatie"],
    [/\b(ui|ux|scherm|pagina|page|knop|button|frontend|design|formulier|form|layout|modal)\w*/i, "Frontend"],
    [/\b(test|testen|unit|e2e|regressie)\w*/i, "Testbaarheid"],
    [/\b(performance|snel|traag|laadtijd|cache|schaal)\w*/i, "Performance"],
    [/\b(export|import|csv|pdf|excel|rapport|report)\w*/i, "Data-uitwisseling"],
    [/\b(mail|e-mail|notific|melding|push|sms)\w*/i, "Notificaties"],
    [/\b(security|beveilig|privacy|avg|gdpr|encrypt)\w*/i, "Security & compliance"],
    [/\b(betaal|payment|factuur|invoice|ideal|stripe)\w*/i, "Betalingen"],
    [/\b(zoek|search|filter|sorteer|sort)\w*/i, "Zoeken & filteren"],
    [/\b(mobiel|mobile|app|ios|android|responsive)\w*/i, "Mobile"],
  ];

  function extractKeywords(text, max = 6) {
    const counts = new Map();
    (text.toLowerCase().match(/[a-zà-ÿ0-9\-]{4,}/g) || []).forEach((w) => {
      if (STOPWORDS.has(w)) return;
      counts.set(w, (counts.get(w) || 0) + 1 + w.length / 20);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
  }

  function detectDomains(text) {
    const found = DOMAINS.filter(([re]) => re.test(text)).map(([, label]) => label);
    return found.length ? found : ["Algemene functionaliteit"];
  }

  // ---------- Neural network canvas ----------
  const canvas = $("neural");
  const ctx = canvas.getContext("2d");
  let netAnim = null;

  function startNetwork() {
    const W = canvas.width, H = canvas.height;
    const layers = [5, 8, 10, 8, 4, 1];
    const nodes = layers.map((count, li) =>
      Array.from({ length: count }, (_, ni) => ({
        x: 40 + (li * (W - 80)) / (layers.length - 1),
        y: H / 2 + (ni - (count - 1) / 2) * Math.min(26, (H - 40) / count),
        a: Math.random(),
      }))
    );
    const pulses = [];
    let t = 0;

    function frame() {
      t++;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (let l = 0; l < nodes.length - 1; l++) {
        for (const a of nodes[l]) for (const b of nodes[l + 1]) {
          ctx.strokeStyle = "rgba(124,92,255,0.07)";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (t % 3 === 0) {
        const l = randInt(0, nodes.length - 2);
        pulses.push({ a: nodes[l][randInt(0, nodes[l].length - 1)], b: nodes[l + 1][randInt(0, nodes[l + 1].length - 1)], p: 0 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i];
        pl.p += 0.035;
        if (pl.p >= 1) { pl.b.a = 1; pulses.splice(i, 1); continue; }
        const x = pl.a.x + (pl.b.x - pl.a.x) * pl.p, y = pl.a.y + (pl.b.y - pl.a.y) * pl.p;
        ctx.strokeStyle = "rgba(0,212,255,0.35)";
        ctx.beginPath(); ctx.moveTo(pl.a.x, pl.a.y); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = "#00d4ff";
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      for (const layer of nodes) for (const n of layer) {
        n.a = Math.max(0.15, n.a * 0.96);
        ctx.fillStyle = `rgba(124,92,255,${0.25 + n.a * 0.75})`;
        ctx.shadowColor = "rgba(0,212,255,0.8)";
        ctx.shadowBlur = n.a * 14;
        ctx.beginPath(); ctx.arc(n.x, n.y, 4 + n.a * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      netAnim = requestAnimationFrame(frame);
    }
    frame();
  }
  const stopNetwork = () => cancelAnimationFrame(netAnim);

  // ---------- Log ----------
  const logEl = $("log");
  let t0 = 0;
  function log(msg, level = "info") {
    const ms = performance.now() - t0;
    const ts = `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${(ms / 1000 % 60).toFixed(3).padStart(6, "0")}`;
    const line = document.createElement("div");
    line.innerHTML = `<span class="t">[${ts}]</span> <span class="${level}">${level.toUpperCase().padEnd(5)}</span> `;
    line.appendChild(document.createTextNode(msg));
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------- Counters ----------
  function animateNumber(el, to, duration, suffix = "") {
    const from = parseFloat(el.dataset.v || "0");
    const start = performance.now();
    return new Promise((res) => {
      (function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
        el.textContent = (suffix === "%" ? v.toFixed(1).replace(".", ",") : fmt(Math.round(v))) + suffix;
        el.dataset.v = v;
        p < 1 ? requestAnimationFrame(tick) : res();
      })(start);
    });
  }

  function setProgress(p) {
    $("progressBar").style.width = p + "%";
    $("pct").textContent = Math.round(p) + "%";
  }

  // ---------- Main flow ----------
  let lastResult = null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("title").value.trim();
    const description = $("description").value.trim();
    const criteria = $("criteria").value.trim();
    const full = [title, description, criteria].join("\n").trim();
    if (full.replace(/\s+/g, "").length < 10) {
      $("formError").hidden = false;
      return;
    }
    $("formError").hidden = true;
    $("submitBtn").disabled = true;
    await runAnalysis({ title, description, criteria, full });
  });

  $("againBtn").addEventListener("click", () => {
    resultPanel.hidden = true;
    inputPanel.hidden = false;
    $("submitBtn").disabled = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!lastResult) return;
    const txt = `EffortAI — ${lastResult.title}\nEffort: ${lastResult.points} story points (confidence ${lastResult.confidence}%)\n\n` +
      lastResult.reasons.map((r) => "• " + r).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      $("copyBtn").textContent = "Gekopieerd ✓";
    } catch {
      $("copyBtn").textContent = "Kopiëren mislukt";
    }
    setTimeout(() => ($("copyBtn").textContent = "Kopieer resultaat"), 1800);
  });

  async function runAnalysis(pbi) {
    // Determine the outcome up front; everything else is presentation.
    const rng = seeded(hashString(pbi.full.toLowerCase().replace(/\s+/g, " ")));
    const idx = Math.floor(rng() * FIB.length);
    const points = FIB[idx];
    const confidence = Math.round((82 + rng() * 15) * 10) / 10;

    const modelName = $("model").selectedOptions[0].textContent.replace(/\s*\(.*\)/, "");
    const tokens = Math.max(24, Math.round(pbi.full.length / 3.6 + pbi.full.split(/\s+/).length * 0.4));
    const keywords = extractKeywords(pbi.full);
    const domains = detectDomains(pbi.full);
    const displayTitle = pbi.title || pbi.description.split("\n")[0].slice(0, 80);

    // reset UI
    inputPanel.hidden = true;
    resultPanel.hidden = true;
    analysisPanel.hidden = false;
    logEl.innerHTML = "";
    ["mTokens", "mCompared"].forEach((id) => { $(id).dataset.v = 0; $(id).textContent = "0"; });
    $("mConfidence").dataset.v = 0;
    $("mConfidence").textContent = "–";
    $("entities").hidden = true;
    $("entityList").innerHTML = "";
    $("agents").hidden = true;
    $("analysisTitle").textContent = `"${displayTitle}"`;
    setProgress(0);
    window.scrollTo({ top: analysisPanel.offsetTop - 16, behavior: "smooth" });
    t0 = performance.now();
    const started = performance.now();
    startNetwork();

    const similar = randInt(9000, 14000);
    const steps = [
      {
        label: "PBI tokeniseren",
        sub: `${tokens} tokens · cl200k`,
        dur: [900, 1300],
        run: async () => {
          log(`session ${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : randInt(1e7, 9e7)} started`);
          log(`input received (${pbi.full.length} chars)`);
          animateNumber($("mTokens"), tokens, 900);
          log(`tokenizer: ${tokens} tokens (cl200k_base)`, "debug");
        },
      },
      {
        label: "Analyseren met AI",
        sub: `${modelName} · semantische analyse`,
        dur: [1800, 2400],
        run: async () => {
          log(`loading weights ${$("model").value} (fp16, 4 shards)…`);
          await sleep(500);
          log("model warm — running semantic parse", "ok");
          await sleep(400);
          showEntities(keywords, domains);
          log(`entities: ${keywords.join(", ") || "n/a"}`, "debug");
          log(`domains: ${domains.join(" | ")}`, "debug");
        },
      },
      {
        label: "Vergelijken met historische PBI's",
        sub: `vector search · top-k 25`,
        dur: [1800, 2400],
        run: async () => {
          log(`embedding dim=4096 · cosine similarity over ${fmt(128473)} vectors`);
          animateNumber($("mCompared"), similar, 1800);
          for (let i = 0; i < 3; i++) {
            await sleep(450);
            const nIdx = Math.min(FIB.length - 1, Math.max(0, idx + randInt(-1, 1)));
            log(`match PBI-${randInt(10000, 99999)} sim=${(0.94 - i * 0.03 - Math.random() * 0.02).toFixed(3)} → ${FIB[nIdx]} SP`, "debug");
          }
        },
      },
      {
        label: "Afhankelijkheden & risico's detecteren",
        sub: "dependency graph · risk model",
        dur: [1200, 1700],
        run: async () => {
          const deps = Math.max(0, idx - 1 + randInt(0, 2));
          log(`dependency graph built: ${deps} external, ${randInt(1, 4)} internal`);
          await sleep(400);
          if (idx >= 4) log("high coupling detected — uncertainty multiplier applied", "warn");
          else log("no blocking dependencies found", "ok");
        },
      },
      {
        label: "Complexiteitsscore berekenen",
        sub: "cyclomatic · cognitive · scope",
        dur: [1100, 1500],
        run: async () => {
          log(`complexity vector = [${Array.from({ length: 4 }, () => rand(0.1, 0.99).toFixed(2)).join(", ")}]`, "debug");
          animateNumber($("mConfidence"), confidence - rand(8, 14), 1000, "%");
        },
      },
      {
        label: "Kalibreren op team-velocity",
        sub: $("team").selectedOptions[0].textContent,
        dur: [900, 1300],
        run: async () => {
          log(`calibration profile: ${$("team").value} (σ=${rand(0.8, 1.6).toFixed(2)})`);
        },
      },
      {
        label: "Planning Poker met AI-agents",
        sub: "5 agents · multi-round consensus",
        dur: [600, 800],
        run: async () => {
          await pokerRound(idx);
        },
      },
      {
        label: "Fibonacci-mapping & validatie",
        sub: "snap to scale · sanity checks",
        dur: [900, 1200],
        run: async () => {
          log(`raw estimate ${(points * rand(0.88, 1.12)).toFixed(2)} → snapped to ${points}`, "debug");
          animateNumber($("mConfidence"), confidence, 800, "%");
          await sleep(500);
          log(`estimation complete: ${points} SP (confidence ${String(confidence).replace(".", ",")}%)`, "ok");
        },
      },
    ];

    const list = $("steps");
    list.innerHTML = "";
    const els = steps.map((s) => {
      const li = document.createElement("li");
      li.className = "step";
      li.innerHTML = `<span class="icon"></span><span><span class="lbl"></span><span class="sub"></span></span>`;
      li.querySelector(".lbl").textContent = s.label;
      li.querySelector(".sub").textContent = s.sub;
      list.appendChild(li);
      return li;
    });

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      els[i].classList.add("active");
      const startP = (i / steps.length) * 100;
      const endP = ((i + 1) / steps.length) * 100;
      const dur = rand(...s.dur);
      const t = performance.now();
      const ticker = setInterval(() => {
        const p = Math.min(0.95, (performance.now() - t) / dur);
        setProgress(startP + (endP - startP) * p);
      }, 80);
      await Promise.all([s.run(), sleep(dur)]);
      clearInterval(ticker);
      setProgress(endP);
      els[i].classList.remove("active");
      els[i].classList.add("done");
    }

    await sleep(600);
    stopNetwork();
    const seconds = ((performance.now() - started) / 1000).toFixed(1).replace(".", ",");
    showResult({ pbi, displayTitle, idx, points, confidence, rng, keywords, domains, modelName, seconds });
  }

  function showEntities(keywords, domains) {
    const list = $("entityList");
    $("entities").hidden = false;
    const items = [...domains.map((d) => [d, "domain"]), ...keywords.map((k) => [k, ""])];
    items.forEach(([txt, cls], i) => {
      setTimeout(() => {
        const c = document.createElement("span");
        c.className = "chip " + cls;
        c.textContent = txt;
        list.appendChild(c);
      }, i * 120);
    });
  }

  async function pokerRound(idx) {
    const agents = [
      ["α", "Senior Dev"], ["β", "QA Engineer"], ["γ", "Architect"], ["δ", "Product Owner"], ["ε", "Medior Dev"],
    ];
    $("agents").hidden = false;
    $("agentsTitle").textContent = "Planning Poker — AI-agents stemmen (ronde 1)";
    const row = $("agentsRow");
    row.innerHTML = "";
    const cards = agents.map(([sym, role]) => {
      const a = document.createElement("div");
      a.className = "agent";
      a.innerHTML = `<div class="poker-card"><div class="poker-inner"><div class="poker-face poker-back thinking"></div><div class="poker-face poker-front"></div></div></div><span class="avatar"></span>`;
      a.querySelector(".avatar").textContent = `Agent ${sym} · ${role}`;
      row.appendChild(a);
      return a;
    });
    log("spawning 5 estimation agents…");
    await sleep(1400);

    // Round 1: spread around the outcome
    const votes = cards.map(() => Math.min(FIB.length - 1, Math.max(0, idx + randInt(-1, 1))));
    if (!votes.includes(idx)) votes[randInt(0, votes.length - 1)] = idx;
    for (let i = 0; i < cards.length; i++) {
      cards[i].querySelector(".poker-front").textContent = FIB[votes[i]];
      cards[i].querySelector(".poker-card").classList.add("flipped");
      log(`agent ${agents[i][0]} votes ${FIB[votes[i]]}`, "debug");
      await sleep(260);
    }
    const unanimous = votes.every((v) => v === idx);
    await sleep(1100);
    if (unanimous) {
      log("consensus reached in round 1", "ok");
      return;
    }
    log(`spread detected (${FIB[Math.min(...votes)]}–${FIB[Math.max(...votes)]}) — agents discussing…`, "warn");
    $("agentsTitle").textContent = "Planning Poker — agents bespreken verschillen…";
    cards.forEach((c) => {
      c.querySelector(".poker-card").classList.remove("flipped");
      c.querySelector(".poker-back").classList.add("thinking");
    });
    await sleep(1600);

    // Round 2: consensus
    $("agentsTitle").textContent = "Planning Poker — AI-agents stemmen (ronde 2)";
    for (let i = 0; i < cards.length; i++) {
      cards[i].querySelector(".poker-front").textContent = FIB[idx];
      cards[i].querySelector(".poker-card").classList.add("flipped");
      await sleep(180);
    }
    log("consensus reached in round 2", "ok");
    $("agentsTitle").textContent = "Planning Poker — consensus bereikt ✓";
    await sleep(700);
  }

  function showResult({ pbi, displayTitle, idx, points, confidence, rng, keywords, domains, modelName, seconds }) {
    analysisPanel.hidden = true;
    resultPanel.hidden = false;
    // restart entrance animations
    resultPanel.style.animation = "none"; void resultPanel.offsetWidth; resultPanel.style.animation = "";
    const sc = resultPanel.querySelector(".score-card");
    sc.style.animation = "none"; void sc.offsetWidth; sc.style.animation = "";

    $("score").textContent = points;
    $("resultTitle").textContent = displayTitle;
    $("resultConfidence").textContent = String(confidence).replace(".", ",") + "%";
    $("resultModel").textContent = modelName;
    $("resultTime").textContent = `${seconds}s`;

    const fib = $("fibScale");
    fib.innerHTML = "";
    FIB.forEach((v) => {
      const s = document.createElement("span");
      s.textContent = v;
      if (v === points) s.className = "hit";
      fib.appendChild(s);
    });

    // Factors loosely follow the outcome so the story is consistent
    const base = (idx / (FIB.length - 1)) * 80 + 10;
    const factor = () => Math.round(Math.min(98, Math.max(6, base + (rng() - 0.5) * 30)));
    const factors = [
      ["Complexiteit", factor()],
      ["Omvang", factor()],
      ["Onzekerheid", factor()],
      ["Risico", factor()],
      ["Afhankelijkheden", factor()],
    ];
    const fEl = $("factors");
    fEl.innerHTML = "";
    factors.forEach(([name, val]) => {
      const d = document.createElement("div");
      d.className = "factor";
      d.innerHTML = `<div class="factor-top"><span></span><b>${val}/100</b></div><div class="factor-bar"><div class="factor-fill"></div></div>`;
      d.querySelector("span").textContent = name;
      fEl.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => (d.querySelector(".factor-fill").style.width = val + "%")));
    });

    const reasons = buildReasons({ pbi, idx, points, rng, keywords, domains, factors });
    const rEl = $("reasoning");
    rEl.innerHTML = "";
    reasons.forEach((r, i) => {
      const li = document.createElement("li");
      li.textContent = r;
      li.style.animationDelay = i * 0.12 + "s";
      rEl.appendChild(li);
    });

    lastResult = { title: displayTitle, points, confidence: String(confidence).replace(".", ","), reasons };
    window.scrollTo({ top: resultPanel.offsetTop - 16, behavior: "smooth" });
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function buildReasons({ pbi, idx, points, rng, keywords, domains, factors }) {
    const size = idx <= 1 ? "small" : idx <= 3 ? "medium" : "large";
    const kw = keywords.slice(0, 2).map((k) => `"${k}"`).join(" en ");
    const mainDomain = domains[0];
    const criteriaCount = pbi.criteria ? pbi.criteria.split("\n").filter((l) => l.trim()).length : 0;
    const neighbors = Math.round(40 + rng() * 45);
    const top = [...factors].sort((a, b) => b[1] - a[1])[0][0].toLowerCase();

    const intro = {
      small: [
        `De scope is duidelijk afgebakend en raakt voornamelijk ${mainDomain}.`,
        `Het model herkent dit als een overzichtelijke wijziging binnen ${mainDomain}.`,
      ],
      medium: [
        `De PBI raakt ${domains.length > 1 ? "meerdere gebieden (" + domains.slice(0, 2).join(", ") + ")" : mainDomain} met een gemiddelde complexiteit.`,
        `Het werk binnen ${mainDomain} is goed te overzien, maar vraagt wel enige afstemming.`,
      ],
      large: [
        `De PBI heeft impact op ${domains.length > 1 ? domains.slice(0, 3).join(", ") : mainDomain} en bevat meerdere onbekenden.`,
        `Het model detecteert een brede scope binnen ${mainDomain} met relatief veel integratiepunten.`,
      ],
    }[size];

    const reasons = [pick(rng, intro)];
    if (kw) reasons.push(`Sleuteltermen ${kw} komen sterk overeen met eerder geschatte PBI's in de trainingsdata.`);
    reasons.push(`${neighbors}% van de meest vergelijkbare historische PBI's werd geschat op ${points} story points.`);
    reasons.push(`De grootste bijdrage aan de schatting komt van de factor ${top}.`);
    if (criteriaCount > 0) {
      reasons.push(`${criteriaCount} acceptatiecriteri${criteriaCount === 1 ? "um" : "a"} geanalyseerd; ${size === "large" ? "meerdere criteria vergroten de testinspanning" : "deze zijn concreet en goed toetsbaar"}.`);
    } else {
      reasons.push("Er zijn geen acceptatiecriteria opgegeven; het model heeft een kleine onzekerheidsmarge meegenomen.");
    }
    reasons.push({
      small: "Advies: geschikt om in één dag op te pakken, eventueel samen met andere kleine items.",
      medium: "Advies: past goed binnen een sprint; stem vooraf kort af met het team over de aanpak.",
      large: points >= 21
        ? "Advies: overweeg deze PBI op te splitsen in kleinere items voordat hij een sprint in gaat."
        : "Advies: plan voldoende tijd voor afstemming en test; mogelijk is opsplitsen zinvol.",
    }[size]);
    return reasons;
  }
})();
