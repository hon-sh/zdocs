// console.log("Hello via Bun!");
import { esc, Zdoc } from "./zdocs";
const bun = Bun;

import a from "./a.html";

const std = await Zdoc.load("sources.tar");

// console.log("x", process.X);

let _cssLink: string | null = null;
const is_dev = false;

const server = bun.serve({
  routes: {
    // zig.hon.sh/mod/doc/std zig.hon.sh/mod/doc/std.mem
    "/": Response.redirect("/mod/doc/std"),

    "/mod/doc/:decl": async (req) => {
      // const moduleList = std.getModuleList();
      // console.log("Modules:", moduleList);

      console.time("cssLink");
      const cssLink = is_dev
        ? await getCssLink()
        : _cssLink == null
        ? await getCssLink()
        : _cssLink;
      console.timeEnd("cssLink");
      //   console.log("cssLink", cssLink);

      const decl = req.params.decl;

      const idx0 = std.findDecl(decl);
      console.log("idx0", typeof idx0);
      if (idx0 == null) {
        console.log(`decl "${decl}" -> ${idx0} (404)`);

        return new Response("Not found", { status: 404 });
      }

      const idx = std.resolveAliasee(idx0);
      console.log(
        `decl "${decl}" -> ${
          idx == idx0 ? "" : `(*${idx0})`
        }${idx} -> "${std.fullyQualifiedName(idx)}"`
      );

      console.time("index items");
      const renderResult = std.renderDecl(idx);
      //   console.log("index items\n", renderResult);
      console.timeEnd("index items");

      const titleSuffix = " - Zig Documentation";
      const title = std.fullyQualifiedName(idx) + titleSuffix;

      // Stream write to response
      const responseText = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    ${cssLink ? `<link rel="stylesheet" href="${cssLink}">` : ""}
  </head>
  <body>
    <nav>
      <a class="logo" href="#">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 140">
        <g fill="#F7A41D">
          <g>
            <polygon points="46,22 28,44 19,30"/>
            <polygon points="46,22 33,33 28,44 22,44 22,95 31,95 20,100 12,117 0,117 0,22" shape-rendering="crispEdges"/>
            <polygon points="31,95 12,117 4,106"/>
          </g>
          <g>
            <polygon points="56,22 62,36 37,44"/>
            <polygon points="56,22 111,22 111,44 37,44 56,32" shape-rendering="crispEdges"/>
            <polygon points="116,95 97,117 90,104"/>
            <polygon points="116,95 100,104 97,117 42,117 42,95" shape-rendering="crispEdges"/>
            <polygon points="150,0 52,117 3,140 101,22"/>
          </g>
          <g>
            <polygon points="141,22 140,40 122,45"/>
            <polygon points="153,22 153,117 106,117 120,105 125,95 131,95 131,45 122,45 132,36 141,22" shape-rendering="crispEdges"/>
            <polygon points="125,95 130,110 106,117"/>
          </g>
        </g>
        <style>
        #text { fill: #121212 }
        @media (prefers-color-scheme: dark) { #text { fill: #f2f2f2 } }
        </style>
        <g id="text">
          <g>
            <polygon points="260,22 260,37 229,40 177,40 177,22" shape-rendering="crispEdges"/>
            <polygon points="260,37 207,99 207,103 176,103 229,40 229,37"/>
            <polygon points="261,99 261,117 176,117 176,103 206,99" shape-rendering="crispEdges"/>
          </g>
          <rect x="272" y="22" shape-rendering="crispEdges" width="22" height="95"/>
          <g>
            <polygon points="394,67 394,106 376,106 376,81 360,70 346,67" shape-rendering="crispEdges"/>
            <polygon points="360,68 376,81 346,67"/>
            <path d="M394,106c-10.2,7.3-24,12-37.7,12c-29,0-51.1-20.8-51.1-48.3c0-27.3,22.5-48.1,52-48.1    c14.3,0,29.2,5.5,38.9,14l-13,15c-7.1-6.3-16.8-10-25.9-10c-17,0-30.2,12.9-30.2,29.5c0,16.8,13.3,29.6,30.3,29.6    c5.7,0,12.8-2.3,19-5.5L394,106z"/>
          </g>
        </g>
        </svg>
      </a>
    </nav>
    <div id="navWrap">
      <input type="search" id="search" autocomplete="off" spellcheck="false" placeholder="\`s\` to search, \`?\` to see more options">
      ${std.renderNavFancy(idx, [])}
    </div>
    <section>
      ${std.renderDeclHeading(idx)}

      ${renderResult}
    </section>
  </body>
</html>
      `;

      return new Response(responseText, {
        headers: { "Content-Type": "text/html" },
      });
    },

    "/asy": async (req) => {
      return new Response(
        // An async generator function
        async function* () {
          yield "Hello, ";
          await Bun.sleep(3000);
          yield "world!";
          // you can also yield a TypedArray or Buffer
          yield new Uint8Array(["\n".charCodeAt(0)]);
        },
        { headers: { "Content-Type": "text/plain" } }
      );
    },

    "/a": a,
  },

  development: is_dev,
});

// get, if !is_dev will save to _cssLink
async function getCssLink() {
  const base = new URL(server.url);
  base.pathname = "/a";
  const link: string = await fetch(base)
    .then((r) => r.text())
    .then((txt) => {
      const m = txt.match(/"([^"]+?\.css)"/);
      const link = m ? m[1] || "" : "";
      if (!link) {
        return link;
      }

      const uri = new URL(link, base);
      return uri.pathname + uri.search;
    });

  if (!is_dev) {
    _cssLink = link;
  }

  return link;
}

console.log(`Listening on ${server.url}`);
