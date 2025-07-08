import { htmlEscape } from "./utils";
import a from "./a.html";
import { nav, Pkgs } from "./pkgs";

const bun = Bun;

const pkgs = new Pkgs();

// console.log("x", process.X);

let _cssLink: string | null = null;
const is_dev = false;

const server = bun.serve({
  routes: {
    "/": async (req): Promise<Response> => {
      return new Response(
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${htmlEscape("Zig Documentation")}</title>
  </head>
  <body>
    <ul>
      <li><a href="/std/any/std">std</a></li>
      <li><a href="/zig/any/zig">zig</a> (zig compiler)</li>
      <li>aio: <a href="/aio/any/aio">aio</a>, <a href="/aio/any/coro">coro</a></li>
      <li>raylib: <a href="/raylib/any/raylib">raylib</a>, <a href="/raylib/any/raygui">raygui</a></li>
    </ul>
  </body>
</html>
        `,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    },

    "/mod/doc/:decl": async (req): Promise<Response> => {
      if (/^std(?:$|\.)/.test(req.params.decl)) {
        return Response.redirect(`/std/any/${req.params.decl}`, 301);
      }
      return new Response("Not found", { status: 404 });
    },

    "/:pkg/:ver/:decl": async (req): Promise<Response> => {
      console.time("cssLink");
      const cssLink = is_dev
        ? await getCssLink()
        : _cssLink == null
        ? await getCssLink()
        : _cssLink;
      console.timeEnd("cssLink");
      //   console.log("cssLink", cssLink);

      const decl = req.params.decl;

      // TODO: ver
      const pkg = await pkgs.get(req.params.pkg);
      if (pkg == null) {
        console.log(`pkg "${req.params.pkg}" 404`);
        return new Response("Not found", { status: 404 });
      }

      if (pkg.find(decl) == null) {
        console.log(`decl "${decl}" 404`);

        return new Response("Not found", { status: 404 });
      }

      console.time("render doc");
      const doc = pkg.render(decl);
      //   console.log("index items\n", renderResult);
      console.timeEnd("render doc");

      const titleSuffix = " - Zig Documentation";
      const title = pkg.title(decl) + titleSuffix;

      // Stream write to response
      const responseText = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${htmlEscape(title)}</title>
    ${cssLink ? `<link rel="stylesheet" href="${cssLink}">` : ""}
  </head>
  <body>
    ${nav()}

    ${doc}
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
