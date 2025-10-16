# zdocs 项目架构 / Project Architecture

## 项目概述 / Overview

zdocs 是一个用于生成和浏览 Zig 模块文档的工具，类似于 [Zig 标准库文档](https://ziglang.org/documentation/0.14.1/std/)，但支持所有 Zig 模块。

zdocs is a documentation tool for Zig modules, similar to [Zig std docs](https://ziglang.org/documentation/0.14.1/std/), but for all Zig modules.

## 核心架构 / Core Architecture

项目采用三层架构设计 / The project uses a three-tier architecture:

### 1. CLI/HTTP Server Layer (后端服务层)
**位置 / Location:** `src/main.zig`

**职责 / Responsibilities:**
- 解析命令行参数（模块名称、源代码路径、主机、端口等）
- 启动 HTTP 服务器监听请求
- 提供静态文件服务（HTML、JS、WASM）
- 生成并提供源代码的 tar 归档文件
- 自动打开浏览器标签页
- 嵌入或动态加载文档相关文件

**关键功能 / Key Features:**
- 支持 `-Mstd` 标志以显示标准库文档
- 支持 `-M<mod_name>=<src_path>` 指定自定义模块
- 多线程处理 HTTP 连接
- 可选的文件嵌入模式（通过 `-Dembed` 构建选项）

### 2. WebAssembly Processing Layer (文档处理层)
**位置 / Location:** `src/wasm/`

**核心组件 / Core Components:**

#### 2.1 `main.zig`
- WASM 模块的入口点
- 通过 JavaScript FFI 与前端通信
- 协调文档生成流程
- 处理日志输出到浏览器控制台

#### 2.2 `Walk.zig`
- 遍历 Zig AST（抽象语法树）
- 识别和标注标识符与其声明的链接
- 管理文件、声明、模块的全局索引
- 解析 Zig 代码结构（函数、类型、变量等）

**主要数据结构:**
- `files`: 所有文件的映射表
- `decls`: 所有声明的数组
- `modules`: 模块名到文件索引的映射

#### 2.3 `Decl.zig`
- 表示单个声明（函数、类型、变量等）
- 存储声明的元信息（公开性、名称、文档注释）
- 提供声明查询接口

#### 2.4 `html_render.zig`
- 将 Zig 源代码渲染为带语法高亮的 HTML
- 处理声明链接解析
- HTML 转义和安全处理
- 生成文档 HTML 片段

#### 2.5 `markdown.zig`
- 解析 Zig 文档注释中的 Markdown
- 支持代码块、列表、链接等 Markdown 语法
- 将 Markdown 转换为 HTML

### 3. Web Frontend Layer (前端展示层)
**位置 / Location:** `www/`

**技术栈 / Tech Stack:**
- **运行时:** Bun (JavaScript 运行时)
- **语言:** TypeScript
- **前端逻辑:** 原生 JavaScript (embedded in HTML)

**核心文件 / Core Files:**

#### 3.1 `index.ts` (服务器端)
- Bun HTTP 服务器
- 路由处理（支持多个包：std、zig、aio、raylib 等）
- 包管理和文档生成请求处理
- 动态 HTML 生成和响应

#### 3.2 `zdocs.ts`
- WASM 接口封装
- 提供 TypeScript 类型定义
- 管理 WASM 实例的生命周期
- 数据序列化和反序列化

#### 3.3 `pkgs.ts`
- 包管理逻辑
- 处理不同 Zig 包的源代码获取
- 缓存管理

#### 3.4 `src/docs/` (嵌入的前端资源)
- `index.html`: 主 HTML 模板
- `main.js`: 浏览器端 JavaScript 逻辑
  - 路由管理（哈希路由）
  - WASM 通信
  - DOM 操作和渲染
  - 搜索功能
  - 源代码浏览
- `main.wasm`: 编译后的 WebAssembly 模块

## 数据流 / Data Flow

```
用户请求 (User Request)
    ↓
CLI/HTTP Server (src/main.zig)
    ↓ (服务静态文件 / Serve static files)
浏览器 (Browser)
    ↓ (加载 WASM / Load WASM)
WebAssembly Layer (src/wasm/)
    ↓ (解析源代码 / Parse source)
AST 分析 (Walk.zig, Decl.zig)
    ↓ (生成 HTML / Generate HTML)
渲染引擎 (html_render.zig, markdown.zig)
    ↓ (返回到浏览器 / Return to browser)
DOM 更新 (main.js)
    ↓
用户界面 (User Interface)
```

## 构建系统 / Build System

**构建文件 / Build File:** `build.zig`

### 构建目标 / Build Targets:

1. **zdocs 可执行文件 / zdocs Executable**
   - 编译 `src/main.zig` 为本地可执行文件
   - 支持 Debug 和 Release 模式
   - 可选的文件嵌入（`-Dembed` 选项）

2. **WASM 模块 / WASM Module**
   - 编译 `src/wasm/main.zig` 为 WebAssembly
   - 目标：`wasm32-freestanding`
   - 特性：`baseline+atomics+bulk_memory+multivalue+mutable_globals+nontrapping_fptoint+reference_types+sign_ext`
   - 两个变体：
     - `src/docs/main.wasm`: 用于嵌入式模式（哈希路由）
     - `www/main.wasm`: 用于独立 Web 服务器（路径路由）

### 构建命令 / Build Commands:

```bash
# 构建并运行 / Build and run
zig build run -- -Mstd

# 安装 / Install
zig build install -Doptimize=ReleaseSafe -p <prefix>

# 更新 WASM 文件 / Update WASM files
zig build update-wasm
```

## 部署模式 / Deployment Modes

### 1. 嵌入式模式 (Embedded Mode)
- 所有资源（HTML、JS、WASM）嵌入到可执行文件中
- 无需外部文件依赖
- 适用于分发单一二进制文件
- 使用哈希路由 (`#`)

### 2. 开发模式 (Development Mode)
- 从文件系统动态加载资源
- 支持热重载和快速迭代
- 通过 `zig build run` 启动

### 3. 独立 Web 服务器模式 (Standalone Web Server)
- `www/` 目录作为独立的 Web 应用
- 使用 Bun 运行 TypeScript 服务器
- 支持多个包和模块
- 使用 URL 路径路由

## 关键特性 / Key Features

### 1. 模块支持 / Module Support
- **标准库:** `-Mstd` 标志
- **自定义模块:** `-M<name>=<path>` 语法
- **多模块支持:** Web 服务器可以同时服务多个包

### 2. 源代码浏览 / Source Code Browsing
- 动态生成源代码的 tar 归档
- 语法高亮
- 声明链接（点击标识符跳转到定义）
- 显示文档测试 (doctests)

### 3. 搜索功能 / Search Functionality
- 实时搜索声明
- 支持命名空间、函数、类型等多种类别
- 搜索结果高亮

### 4. 文档注释支持 / Documentation Comments
- 解析 Zig 文档注释（`///` 和 `//!`）
- Markdown 格式支持
- 代码示例语法高亮

## 目录结构 / Directory Structure

```
zdocs/
├── src/                    # 源代码
│   ├── main.zig           # CLI/HTTP 服务器入口
│   ├── docs/              # 嵌入的前端资源
│   │   ├── index.html
│   │   ├── main.js
│   │   └── main.wasm
│   └── wasm/              # WebAssembly 处理层
│       ├── main.zig       # WASM 入口
│       ├── Walk.zig       # AST 遍历
│       ├── Decl.zig       # 声明表示
│       ├── html_render.zig # HTML 渲染
│       └── markdown.zig   # Markdown 解析
├── www/                   # Web 前端（独立服务器）
│   ├── index.ts          # Bun 服务器
│   ├── zdocs.ts          # WASM 接口
│   ├── pkgs.ts           # 包管理
│   └── main.wasm         # 编译的 WASM
├── examples/             # 示例项目
├── build.zig            # 构建脚本
├── build.zig.zon        # 包配置
└── README.md            # 项目说明
```

## 依赖关系 / Dependencies

- **Zig 编译器:** 0.14.x
- **Bun:** 1.2.18+ (用于 Web 服务器)
- **TypeScript:** ^5 (用于类型检查)

## 扩展点 / Extension Points

### 添加新的文档格式支持
- 修改 `markdown.zig` 以支持新的 Markdown 扩展
- 更新 `html_render.zig` 以自定义渲染逻辑

### 支持新的 Zig 语言特性
- 更新 `Walk.zig` 以识别新的 AST 节点类型
- 在 `Decl.zig` 中添加新的声明类别

### 自定义前端界面
- 修改 `src/docs/index.html` 更改布局
- 更新 `main.js` 添加新的交互功能

## 性能考虑 / Performance Considerations

1. **WASM 性能:** 使用 Zig 编译为 WASM 提供接近原生的性能
2. **增量解析:** 按需加载和解析模块源代码
3. **缓存机制:** Web 服务器端实现包缓存
4. **多线程:** HTTP 服务器使用线程池处理并发请求

## 已知限制 / Known Limitations

1. 仅支持 Zig 0.14.x 版本
2. WASM 模块大小可能影响初始加载时间
3. 某些复杂的 Zig 类型系统特性可能无法完全展示

## 开发工作流 / Development Workflow

```bash
# 开发嵌入式版本 / Develop embedded version
zig build run -- -Mstd

# 开发 Web 服务器版本 / Develop web server version
cd www
bun install
bun run --hot index.ts

# 更新 WASM 模块 / Update WASM module
zig build update-wasm
```

## 相关资源 / Related Resources

- [Zig 语言官方文档](https://ziglang.org/documentation/0.14.1/)
- [Zig 标准库文档](https://ziglang.org/documentation/0.14.1/std/)
- [WebAssembly 规范](https://webassembly.github.io/spec/)
