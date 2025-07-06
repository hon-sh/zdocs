export type MemString = bigint;
export type MemSlice = bigint;
export type Index = number;
export type CategoryTag = number;
export type Ptr = number;

export interface wasm {
  memory: WebAssembly.Memory;
  alloc(n: number): Ptr;

  unpack(ptr: Ptr, len: number): void;

  query_begin(n: number): Ptr;
  query_exec(ignore_case: boolean): number; // TODO: return type ?

  find_module_root(pkg_index: number): Index;
  categorize_decl(decl_index: number, resolve_alias_count: number): CategoryTag;
  get_aliasee(): Index;
  find_decl(): Index;

  decl_error_set(decl_index: number): MemSlice;
  error_set_node_list(base_decl: number, node: number): MemSlice;
  fn_error_set_decl(decl_index: number, node: number): Index;
  type_fn_fields(decl_index: number): MemSlice;
  decl_fields(decl_index: number): MemSlice;
  decl_params(decl_index: number): MemSlice;
  error_html(base_decl: number, error_identifier: number | bigint): MemString;
  decl_field_html(decl_index: number, field_node: number): MemString;
  decl_param_html(decl_index: number, param_node: number): MemString;
  decl_fn_proto_html(decl_index: number, linkify_fn_name: boolean): MemString;
  decl_source_html(decl_index: number): MemString;
  decl_doctest_html(decl_index: number): MemString;
  decl_fqn(decl_index: number): MemString;
  decl_parent(decl_index: number): Index;
  fn_error_set(decl_index: number): Index;
  decl_file_path(decl_index: number): MemString;
  decl_category_name(decl_index: number): MemString;
  decl_name(decl_index: number): MemString;
  decl_docs_html(decl_index: number, short: boolean): MemString;
  decl_type_html(decl_index: number): MemString;
  module_name(index: number): MemString;
  set_input_string(len: number): Ptr;
  find_file_root(): Index;
  type_fn_members(parent: number, include_private: boolean): MemSlice;
  namespace_members(parent: number, include_private: boolean): MemSlice;
}
