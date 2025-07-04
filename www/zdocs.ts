import { type wasm } from "../src/docs/wasm";

const CAT_namespace = 0;
const CAT_container = 1;
const CAT_global_variable = 2;
const CAT_function = 3;
const CAT_primitive = 4;
const CAT_error_set = 5;
const CAT_global_const = 6;
const CAT_alias = 7;
const CAT_type = 8;
const CAT_type_type = 9;
const CAT_type_function = 10;

const LOG_err = 0;
const LOG_warn = 1;
const LOG_info = 2;
const LOG_debug = 3;

const main = Bun.file("../src/docs/main.wasm");

const text_decoder = new TextDecoder();
const text_encoder = new TextEncoder();

export class Zdoc {
  #api: wasm;
  #src: Bun.BunFile;

  constructor(file: string) {
    this.#src = Bun.file(file);
  }

  async load() {
    const m = await WebAssembly.instantiate(await main.arrayBuffer(), {
      js: {
        log: this.log.bind(this),
      },
    });

    this.#api = m.instance.exports as unknown as wasm;

    const js_array = await this.#src.bytes();
    const ptr = this.#api.alloc(js_array.length);
    const wasm_array = new Uint8Array(
      this.#api.memory.buffer,
      ptr,
      js_array.length
    );
    wasm_array.set(js_array);

    this.#api.unpack(ptr, js_array.length);

    this.getModuleList();
  }

  byDeclIndexName = (a, b) => {
    const a_name = this.declIndexName(a);
    const b_name = this.declIndexName(b);
    return operatorCompare(a_name, b_name);
  };

  byDeclIndexName2 = (a, b) => {
    const a_name = this.declIndexName(a.original);
    const b_name = this.declIndexName(b.original);
    return operatorCompare(a_name, b_name);
  };

  decodeString(ptr, len) {
    if (len === 0) return "";
    return text_decoder.decode(
      new Uint8Array(this.#api.memory.buffer, ptr, len)
    );
  }

  unwrapString(bigint) {
    const ptr = Number(bigint & 0xffffffffn);
    const len = Number(bigint >> 32n);
    return this.decodeString(ptr, len);
  }

  declFields(decl_index) {
    return this.unwrapSlice32(this.#api.decl_fields(decl_index));
  }

  namespaceMembers(decl_index, include_private) {
    return this.unwrapSlice32(
      this.#api.namespace_members(decl_index, include_private)
    );
  }

  unwrapSlice32(bigint) {
    const ptr = Number(bigint & 0xffffffffn);
    const len = Number(bigint >> 32n);
    if (len === 0) return [];
    return new Uint32Array(this.#api.memory.buffer, ptr, len);
  }

  declIndexName(decl_index) {
    return this.unwrapString(this.#api.decl_name(decl_index));
  }

  declTypeHtml(decl_index) {
    return this.unwrapString(this.#api.decl_type_html(decl_index));
  }

  declDocsHtmlShort(decl_index) {
    return this.unwrapString(this.#api.decl_docs_html(decl_index, true));
  }

  fnProtoHtml(decl_index, linkify_fn_name) {
    return this.unwrapString(
      this.#api.decl_fn_proto_html(decl_index, linkify_fn_name)
    );
  }

  navLinkFqn(full_name) {
    // TODO: check mod_name
    return full_name;
  }
  navLinkDeclIndex(decl_index) {
    return this.navLinkFqn(this.fullyQualifiedName(decl_index));
  }
  /** -> std.http.Client */
  fullyQualifiedName(decl_index) {
    return this.unwrapString(this.#api.decl_fqn(decl_index));
  }

  getModuleList() {
    const moduleList = [];
    for (let i = 0; ; i += 1) {
      const name = this.unwrapString(this.#api.module_name(i));
      if (name.length == 0) break;
      moduleList.push(name);
    }
    return moduleList;
  }

  renderModule(pkg_index) {
    const root_decl = this.#api.find_module_root(pkg_index);
    return this.renderDecl(root_decl);
  }

  findDecl(fqn) {
    this.setInputString(fqn);
    const result = this.#api.find_decl();
    if (result === -1) return null;
    return result;
  }

  findFileRoot(path) {
    this.setInputString(path);
    const result = this.#api.find_file_root();
    if (result === -1) return null;
    return result;
  }

  declParent(decl_index) {
    const result = this.#api.decl_parent(decl_index);
    if (result === -1) return null;
    return result;
  }

  fnErrorSet(decl_index) {
    const result = this.#api.fn_error_set(decl_index);
    if (result === 0) return null;
    return result;
  }

  setInputString(s) {
    const jsArray = text_encoder.encode(s);
    const len = jsArray.length;
    const ptr = this.#api.set_input_string(len);
    const wasmArray = new Uint8Array(this.#api.memory.buffer, ptr, len);
    wasmArray.set(jsArray);
  }

  renderDecl(decl_index) {
    const category = this.#api.categorize_decl(decl_index, 0);
    console.log("got cat", category);

    switch (category) {
      case CAT_namespace:
      case CAT_container:
        return this.renderNamespacePage(decl_index);
      case CAT_global_variable:
      case CAT_primitive:
      case CAT_global_const:
      case CAT_type:
      case CAT_type_type:
        return this.renderGlobal(decl_index);
      case CAT_function:
        return this.renderFunction(decl_index);
      case CAT_type_function:
        return this.renderTypeFunction(decl_index);
      case CAT_error_set:
        return this.renderErrorSetPage(decl_index);
      case CAT_alias:
        return this.renderDecl(this.#api.get_aliasee());
      default:
        throw new Error("unrecognized category " + category);
    }
  }
  resolveAliasee(decl_index) {
    let idx = decl_index;
    let c = 0;
    while (CAT_alias == this.#api.categorize_decl(idx, 0)) {
      idx = this.#api.get_aliasee();

      if (++c >= 1000) {
        throw new Error(`resolveAliasee ${decl_index} fail`);
      }
    }
    return idx;
  }

  renderDeclHeading(decl_index) {
    const src =
      "#src/" + this.unwrapString(this.#api.decl_file_path(decl_index));

    const name = this.unwrapString(this.#api.decl_category_name(decl_index));
    return `<h1 id="hdrName"><span>${esc(
      name
    )}</span><a style="cursor: not-allowed" href="${esc(src)}">[src]</a></h1>`;
  }

  renderNavFancy(cur_nav_decl, list: { name: string; href: string }[]) {
    {
      // First, walk backwards the decl parents within a file.
      let decl_it = cur_nav_decl;
      let prev_decl_it = null;
      while (decl_it != null) {
        list.push({
          name: this.declIndexName(decl_it),
          href: this.navLinkDeclIndex(decl_it),
        });
        prev_decl_it = decl_it;
        decl_it = this.declParent(decl_it);
      }

      // Next, walk backwards the file path segments.
      if (prev_decl_it != null) {
        const file_path = this.fullyQualifiedName(prev_decl_it);
        const parts = file_path.split(".");
        parts.pop(); // skip last
        for (;;) {
          const href = this.navLinkFqn(parts.join("."));
          const part = parts.pop();
          if (!part) break;
          list.push({
            name: part,
            href: href,
          });
        }
      }

      list.reverse();
    }

    const buf = [`<div id="sectNav"><ul id="listNav">`];
    //
    // resizeDomList(domListNav, list.length, '');

    for (let i = 0; i < list.length; i += 1) {
      buf.push(`
<li><a ${i + 1 == list.length ? ' class="active"' : ""} href="${esc(
        list[i]!.href
      )}">${esc(list[i]!.name)}</a></li>
        `);
    }

    buf.push(`</ul></div>`);

    return buf.join("");
  }

  renderNamespacePage(decl_index) {
    const members = this.namespaceMembers(decl_index, false).slice();
    const fields = this.declFields(decl_index).slice();
    return this.renderNamespace(decl_index, members, fields);
  }

  renderNamespace(base_decl, members, fields) {
    const typesList = [];
    const namespacesList = [];
    const errSetsList = [];
    const fnsList = [];
    const varsList = [];
    const valsList = [];

    member_loop: for (let i = 0; i < members.length; i += 1) {
      let member = members[i];
      const original = member;
      while (true) {
        const member_category = this.#api.categorize_decl(member, 0);
        switch (member_category) {
          case CAT_namespace:
            namespacesList.push({ original: original, member: member });
            continue member_loop;
          case CAT_container:
            typesList.push({ original: original, member: member });
            continue member_loop;
          case CAT_global_variable:
            varsList.push(member);
            continue member_loop;
          case CAT_function:
            fnsList.push(member);
            continue member_loop;
          case CAT_type:
          case CAT_type_type:
          case CAT_type_function:
            typesList.push({ original: original, member: member });
            continue member_loop;
          case CAT_error_set:
            errSetsList.push({ original: original, member: member });
            continue member_loop;
          case CAT_global_const:
          case CAT_primitive:
            valsList.push({ original: original, member: member });
            continue member_loop;
          case CAT_alias:
            member = this.#api.get_aliasee();
            continue;
          default:
            throw new Error("uknown category: " + member_category);
        }
      }
    }

    typesList.sort(this.byDeclIndexName2);
    namespacesList.sort(this.byDeclIndexName2);
    errSetsList.sort(this.byDeclIndexName2);
    fnsList.sort(this.byDeclIndexName);
    varsList.sort(this.byDeclIndexName);
    valsList.sort(this.byDeclIndexName2);

    const _buf = [];
    const w = {
      write(b) {
        _buf.push(b);
      },
    };

    /*
    fnProto
    tldDocs
    sectParams
      listParams
    sectFnErrors
      fnErrorsAnyError
      tableFnErrors
        listFnErrors
    sectSearchResults
    sectFields
      xx
      listFields
    sectTypes
      listTypes

    <div id="fnProto" class="hidden">
      <pre><code id="fnProtoCode"></code></pre>
    </div>
    <div id="tldDocs" class="hidden"></div>
    <div id="sectParams" class="hidden">
      <h2>Parameters</h2>
      <div id="listParams">
      </div>
    </div>
    <div id="sectFnErrors" class="hidden">
      <h2>Errors</h2>
      <div id="fnErrorsAnyError">
        <p><span class="tok-type">anyerror</span> means the error set is known only at runtime.</p>
      </div>
      <div id="tableFnErrors"><dl id="listFnErrors"></dl></div>
    </div>
    <div id="sectSearchResults" class="hidden">
      <h2>Search Results</h2>
      <ul id="listSearchResults"></ul>
    </div>
    <div id="sectSearchNoResults" class="hidden">
      <h2>No Results Found</h2>
      <p>Press escape to exit search and then '?' to see more options.</p>
    </div>
    <div id="sectDocTests" class="hidden">
      <h2>Example Usage</h2>
      <pre><code id="docTestsCode"></code></pre>
    </div>
    <div id="sectSource" class="hidden">
      <h2>Source Code</h2>
      <pre><code id="sourceText"></code></pre>
    </div>
    </section>

    <div id="errors" class="hidden">
      <h1>Errors</h1>
      <pre id="errorsText"></pre>
    </div>
    */

    if (fields.length !== 0) {
      w.write(`
    <div id="sectFields">
      <h2>Fields</h2>
      <div id="listFields">
        `);

      for (let i = 0; i < fields.length; i += 1) {
        w.write(`
          <div>
          ${this.unwrapString(this.#api.decl_field_html(base_decl, fields[i]))}
          </div>
          `);
      }

      w.write(`
      </div>
    </div>
        `);
    }

    if (typesList.length > 0) {
      w.write(`<div id="sectTypes">
      <h2>Types</h2>
      <ul id="listTypes" class="columns">`);

      for (let i = 0; i < typesList.length; i += 1) {
        const original_decl = typesList[i].original;
        const decl = typesList[i].member;
        w.write(
          `<li><a href="${esc(this.navLinkDeclIndex(decl))}">${esc(
            this.declIndexName(original_decl)
          )}</a></li>
`
        );
      }

      w.write(`</ul>
    </div>`);
    }

    if (namespacesList.length > 0) {
      w.write(`
    <div id="sectNamespaces">
      <h2>Namespaces</h2>
      <ul id="listNamespaces" class="columns">
      
        `);

      for (let i = 0; i < namespacesList.length; i += 1) {
        const original_decl = namespacesList[i].original;
        const decl = namespacesList[i].member;

        w.write(
          `<li><a href="${esc(this.navLinkDeclIndex(decl))}">${esc(
            this.declIndexName(original_decl)
          )}</a></li>
`
        );
      }

      w.write(`
</ul>
    </div>
        `);
    }

    if (varsList.length !== 0) {
      w.write(`
    <div id="sectGlobalVars">
      <h2>Global Variables</h2>
      <table>
        <tbody id="listGlobalVars">
        `);

      for (let i = 0; i < varsList.length; i += 1) {
        const decl = varsList[i];

        w.write(`
<tr>
  <td><a href="${esc(this.navLinkDeclIndex(decl))}">${esc(
          this.declIndexName(decl)
        )}</a></td>
  <td>${this.declTypeHtml(decl)}</td>
  <td>${this.declDocsHtmlShort(decl)}</td>
</tr>
          `);
      }

      w.write(`
        </tbody>
      </table>
    </div>
        `);
    }

    if (valsList.length > 0) {
      w.write(`<div id="sectValues">
      <h2>Values</h2>
      <table>
        <tbody id="listValues">`);

      for (let i = 0; i < valsList.length; i += 1) {
        const original_decl = valsList[i].original;
        const decl = valsList[i].member;
        //   tdNameA.setAttribute('href', navLinkDeclIndex(decl));
        w.write(`
<tr>
<td><a href="${esc(this.navLinkDeclIndex(decl))}">${esc(
          this.declIndexName(original_decl)
        )}</a></td>
<td>${this.declTypeHtml(decl)}</td>
<td>${this.declDocsHtmlShort(decl)}</td></tr>
            `);
      }

      w.write(`</tbody>
      </table>
    </div>`);
    }

    if (fnsList.length > 0) {
      w.write(`
    <div id="sectFns">
      <h2>Functions</h2>
      <dl id="listFns">
        `);

      for (let i = 0; i < fnsList.length; i += 1) {
        const decl = fnsList[i];

        w.write(`
<div>
  <dt><code>${this.fnProtoHtml(decl, true)}</code></dt>
  <dd>${this.declDocsHtmlShort(decl)}</dd>
</div>
          `);
      }

      w.write(`
      </dl>
    </div>
          `);
    }

    if (errSetsList.length !== 0) {
      w.write(`
    <div id="sectErrSets">
      <h2>Error Sets</h2>
      <ul id="listErrSets" class="columns">
        `);

      for (let i = 0; i < errSetsList.length; i += 1) {
        const original_decl = errSetsList[i].original;
        const decl = errSetsList[i].member;

        w.write(`
      <li><a href="${esc(this.navLinkDeclIndex(decl))}">${esc(
          this.declIndexName(original_decl)
        )}</a></li>
          `);
      }

      w.write(`
      </ul>
    </div>
          `);
    }

    return _buf.join("");
  }

  log(level, ptr, len) {
    const msg = this.decodeString(ptr, len);
    switch (level) {
      case LOG_err:
        console.error(msg);
        break;
      case LOG_warn:
        console.warn(msg);
        break;
      case LOG_info:
        console.info(msg);
        break;
      case LOG_debug:
        console.debug(msg);
        break;
    }
  }

  static async load(src: string): Promise<Zdoc> {
    const zdoc = new Zdoc(src);
    await zdoc.load();
    return zdoc;
  }
}

function operatorCompare(a, b) {
  if (a === b) {
    return 0;
  } else if (a < b) {
    return -1;
  } else {
    return 1;
  }
}

export function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
