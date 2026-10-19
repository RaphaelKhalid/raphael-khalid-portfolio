// After `vite build`: write the fully rendered page into dist/index.html and
// generate the files AI search engines and crawlers read. Most AI crawlers
// (ChatGPT, Perplexity, Claude) do not run JavaScript, so without this they
// would see an empty <div id="root">.
//
//   dist/index.html  the whole page as HTML, plus schema.org structured data
//   dist/llms.txt    a plain summary for language models (llmstxt.org)
//   dist/sitemap.xml
//   dist/robots.txt  explicitly welcomes search and AI crawlers
//
// The browser still renders the app with React as before; it simply replaces
// this markup, which is the same page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssr = path.join(root, "dist-ssr");
const { render, projects, experiences } = await import(pathToFileURL(path.join(ssr, "entry-server.js")).href);

const SITE = "https://raphaelkhalid.com/";
const PERSON = {
  name: "Raphael Khalid",
  role: "AI safety researcher and machine learning engineer",
  place: "San Francisco Bay Area",
  email: "raphaelbahadurkhan@gmail.com",
  profiles: [
    "https://www.linkedin.com/in/raphael-khalid/",
    "https://github.com/RaphaelKhalid",
    "https://raphaelkhalid.medium.com/",
    "https://raphael-photography.vercel.app/",
  ],
  topics: [
    "AI safety", "AI alignment", "Interpretability", "Mechanistic interpretability", "Sparse autoencoders",
    "LLM evaluations", "Red teaming", "AI governance", "Autonomous research agents", "Machine learning engineering",
    "Robotics", "Complex systems",
  ],
};
const summary =
  `${PERSON.name} is an ${PERSON.role} based in the ${PERSON.place}, running AutoLabs, a public laboratory where ` +
  "autonomous agents design, run and report AI-safety experiments, and building evaluations and interpretability tools: " +
  "deployment-layer refusal erosion in aligned models, monitor-evasion tests of AI agent safety policies, and " +
  "interpretable-by-design language models.";

const plain = s => String(s).replace(/\s+/g, " ").trim();
const current = experiences[0];

// schema.org: who this is, and the work on the page.
const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE}#person`,
      name: PERSON.name,
      url: SITE,
      image: `${SITE}og.png`,
      jobTitle: "AI Safety Researcher and Machine Learning Engineer",
      description: summary,
      email: `mailto:${PERSON.email}`,
      homeLocation: { "@type": "Place", name: PERSON.place, address: { "@type": "PostalAddress", addressRegion: "CA", addressCountry: "US", addressLocality: "San Francisco Bay Area" } },
      worksFor: { "@type": "Organization", name: current.company_name },
      hasOccupation: [
        { "@type": "Occupation", name: "AI Safety Researcher", occupationLocation: { "@type": "City", name: "San Francisco" } },
        { "@type": "Occupation", name: "Machine Learning Engineer", occupationLocation: { "@type": "City", name: "San Francisco" } },
      ],
      knowsAbout: PERSON.topics,
      sameAs: PERSON.profiles,
    },
    {
      "@type": "ProfilePage",
      "@id": `${SITE}#page`,
      url: SITE,
      name: `${PERSON.name} — AI Safety Researcher & Machine Learning Engineer`,
      about: { "@id": `${SITE}#person` },
      mainEntity: { "@id": `${SITE}#person` },
      inLanguage: "en",
    },
    {
      "@type": "ItemList",
      name: `Projects by ${PERSON.name}`,
      itemListElement: projects.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: plain(p.name),
          description: plain(p.description),
          url: p.source_code_link,
          keywords: p.tags.map(t => t.name).join(", "),
          creator: { "@id": `${SITE}#person` },
        },
      })),
    },
  ],
};

// 1. The page, rendered, with its structured data.
const indexPath = path.join(dist, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder not found in dist/index.html");
html = html
  .replace('<div id="root"></div>', `<div id="root">${render()}</div>`)
  .replace("</head>", `  <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>\n  </head>`);
fs.writeFileSync(indexPath, html);

// 2. llms.txt: the same facts in plain Markdown for language models.
const lines = [
  `# ${PERSON.name}`,
  "",
  `> ${summary}`,
  "",
  `${PERSON.name} — ${PERSON.role}, ${PERSON.place}. Website: ${SITE}`,
  "",
  "## Contact",
  `- Email: ${PERSON.email}`,
  ...PERSON.profiles.map(u => `- ${u}`),
  "",
  "## Focus",
  `- ${PERSON.topics.join(", ")}`,
  "",
  "## Projects",
  ...projects.map(p => `- [${plain(p.name)}](${p.source_code_link}): ${plain(p.description)}`),
  "",
  "## Experience",
  ...experiences.map(e => `- ${e.title}, ${e.company_name} (${e.date})${e.points?.length ? `: ${plain(e.points[0])}` : ""}`),
  "",
];
fs.writeFileSync(path.join(dist, "llms.txt"), lines.join("\n"));

// 3. sitemap.xml and robots.txt.
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}llms.txt</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>
</urlset>
`);
const crawlers = ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "Google-Extended", "Applebot-Extended", "Bingbot", "Googlebot", "DuckDuckBot"];
fs.writeFileSync(path.join(dist, "robots.txt"), [
  "# Search engines and AI assistants are welcome to read and cite this site.",
  ...crawlers.flatMap(bot => [`User-agent: ${bot}`, "Allow: /", ""]),
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${SITE}sitemap.xml`,
  "",
].join("\n"));

fs.rmSync(ssr, { recursive: true, force: true });
console.log(`prerendered ${(html.length / 1024).toFixed(0)} KB of HTML; wrote llms.txt, sitemap.xml, robots.txt`);
