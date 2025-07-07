
export function htmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class Sink {
  #buf: string[];

  constructor() {
    this.#buf = [];

    this.write = this.write.bind(this);
    this.end = this.end.bind(this);
  }

  write(b: string) {
    this.#buf.push(b);
  }

  end() {
    return this.#buf.join("");
  }

  static init() {
    return new Sink();
  }
}