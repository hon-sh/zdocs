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
    return "#" + full_name;
  }
  navLinkDeclIndex(decl_index) {
    return this.navLinkFqn(this.fullyQualifiedName(decl_index));
  }
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

  renderNamespacePage(decl_index) {
    const members = this.namespaceMembers(decl_index, false).slice();
    return this.renderNamespace(null, members, null);
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

    const obj = {
      typesList,
      namespacesList,
      errSetsList,
      fnsList,
      varsList,
      valsList,
    };

    return Object.entries(obj)
      .map(([key, items]) => {
        if (key == "valsList") {
          const buf = [key, "\n"];

          for (let i = 0; i < valsList.length; i += 1) {
            const original_decl = valsList[i].original;
            const decl = valsList[i].member;
            //   tdNameA.setAttribute('href', navLinkDeclIndex(decl));
            buf.push(`
            ${this.declIndexName(original_decl)} - ${this.declTypeHtml(decl)}
            ${this.declDocsHtmlShort(decl)}
            `);
          }

          return buf.join("");
        }

        if (key == "fnsList") {
          const buf = [key, "\n"];

          for (let i = 0; i < fnsList.length; i += 1) {
            const decl = fnsList[i];

            buf.push(`
            ${this.fnProtoHtml(decl, true)}
            ${this.declDocsHtmlShort(decl)}
          `);
          }

          return buf.join("");
        }

        if (key == "typesList") {
          const buf = [key, "\n"];

          for (let i = 0; i < typesList.length; i += 1) {
            const original_decl = typesList[i].original;
            const decl = typesList[i].member;
            buf.push(
              `${this.declIndexName(original_decl)} (${this.navLinkDeclIndex(
                decl
              )})
`
            );
          }

          return buf.join("");
        }

        if (key == "namespacesList") {
          const buf = [key, "\n"];
          for (let i = 0; i < namespacesList.length; i += 1) {
            const original_decl = namespacesList[i].original;
            const decl = namespacesList[i].member;
            buf.push(
              `${this.declIndexName(original_decl)} (${this.navLinkDeclIndex(
                decl
              )})
`
            );
          }

          return buf.join("");
        }

        return `${key}: ${JSON.stringify(items)}`;
      })
      .join("\n");
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
