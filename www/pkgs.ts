import { htmlEscape, Sink } from "./utils";
import { type Index, Zdoc } from "./zdocs";

export class Pkgs {
  #pkgs = new Map<string, Pkg>();
  #loading = new Map<string, Promise<boolean>>();

  async get(pkg: string): Promise<Pkg | null> {
    if (this.#pkgs.has(pkg)) {
      return this.#pkgs.get(pkg)!;
    }

    if (!this.#loading.has(pkg)) {
      this.#loading.set(pkg, this.load(pkg));
    }

    await this.#loading.get(pkg);
    return this.#pkgs.get(pkg)!;
  }

  // FIXME: load error

  // set/init this.#pkgs, delete this.#loading
  async load(pkg: string): Promise<boolean> {
    const zdoc = await Zdoc.load(`pkgs/${pkg}.tar`);
    const pkg_ = new Pkg(zdoc);
    this.#pkgs.set(pkg, pkg_);
    this.#loading.delete(pkg);
    return true;
  }
}

export class Pkg {
  #zdoc: Zdoc;

  constructor(zdoc: Zdoc) {
    this.#zdoc = zdoc;
  }

  find(decl: string, resolveAlias: boolean = false): Index | null {
    const idx = this.#zdoc.findDecl(decl);
    if (idx == null || !resolveAlias) {
      return idx;
    }

    return this.#zdoc.resolveAliasee(idx);

    //   console.log(
    //     `decl "${decl}" -> ${
    //       idx == idx0 ? "" : `(*${idx0})`
    //     }${idx} -> "${this.#zdoc.fullyQualifiedName(idx)}"`
    //   );
  }

  title(decl: string): string {
    const idx = this.find(decl, true);
    if (idx == null) {
      return "";
    }

    return this.#zdoc.fullyQualifiedName(idx);
  }

  render(decl: string) {
    const idx = this.find(decl, true);
    if (idx == null) {
      return "";
    }

    return `<div id="navWrap">
      <input type="search" id="search" autocomplete="off" spellcheck="false" placeholder="\`s\` to search, \`?\` to see more options">
      ${this.#zdoc.renderNavFancy(idx, [])}
    </div>
    <section>
      ${this.#zdoc.renderDeclHeading(idx)}

      ${this.#zdoc.renderDecl(idx)}
    </section>
`;
  }
}

/*
zig.hon.sh/std/v0.14.1
zig.hon.sh/std/v0.14.1/std
zig.hon.sh/std/v0.14.1/std.mem
zig.hon.sh/zig/v0.14.1/zig

zig.hon.sh/aio/edge/aio
zig.hon.sh/aio/edge/coro
*/

export function nav() {
  return `<nav>
      <a class="logo" href="/">
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
    </nav>`;
}
