// console.log("Hello via Bun!");
import { Zdoc } from "./zdocs";
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
      const idx = std.findDecl(decl);
      console.log(
        `decl "${decl}" -> ${idx} -> "${
          idx != null ? std.fullyQualifiedName(idx) : "-"
        }"`
      );
      if (idx == null) {
        return new Response("Not found", { status: 404 });
      }

      console.time("index items");
      const renderResult = std.renderDecl(idx);
      //   console.log("index items\n", renderResult);
      console.timeEnd("index items");

      // Stream write to response
      const responseText = `
    ${cssLink ? `<link rel="stylesheet" href="${cssLink}">` : ""}

      <div class="pre-body-tmp">
      index items:
      ${renderResult}
      </div>
      `;

      return new Response(responseText, {
        headers: { "Content-Type": "text/html" },
      });
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
