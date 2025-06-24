export interface wasm {
  memory: WebAssembly.Memory;
  alloc(n: number): number;

  unpack(ptr: number, len: number): void;

  query_begin(n: number): number;
  query_exec(ignore_case: boolean): number;

  find_module_root(pkg_index: bigint): bigint;
  categorize_decl(decl_index: bigint, resolve_alias_count: number): number;
  get_aliasee(): bigint;
  find_decl(): bigint;

  decl_error_set(decl_index: bigint): bigint;
  error_set_node_list(base_decl: bigint, node: bigint): bigint;
  fn_error_set_decl(decl_index: bigint, node: bigint): bigint;
  type_fn_fields(decl_index: bigint): bigint;
  decl_fields(decl_index: bigint): bigint;
  decl_params(decl_index: bigint): bigint;
  error_html(base_decl: bigint, error_identifier: bigint): bigint;
  decl_field_html(decl_index: bigint, field_node: bigint): bigint;
  decl_param_html(decl_index: bigint, param_node: bigint): bigint;
  decl_fn_proto_html(decl_index: bigint, linkify_fn_name: boolean): bigint;
  decl_source_html(decl_index: bigint): bigint;
  decl_doctest_html(decl_index: bigint): bigint;
  decl_fqn(decl_index: bigint): bigint;
  decl_parent(decl_index: bigint): bigint;
  fn_error_set(decl_index: bigint): bigint;
  decl_file_path(decl_index: bigint): bigint;
  decl_category_name(decl_index: bigint): bigint;
  decl_name(decl_index: bigint): bigint;
  decl_docs_html(decl_index: bigint, short: boolean): bigint;
  decl_type_html(decl_index: bigint): bigint;
  module_name(index: bigint): bigint;
  set_input_string(len: number): number;
  find_file_root(): bigint;
  type_fn_members(parent: bigint, include_private: boolean): bigint;
  namespace_members(parent: bigint, include_private: boolean): bigint;
}
