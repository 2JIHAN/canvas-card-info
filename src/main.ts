import { Notice, Plugin, Menu, TFile, normalizePath } from "obsidian";

interface CanvasCardInfoSettings {
  format: "pretty" | "json" | "both";
  notice: boolean;
}

const DEFAULT_SETTINGS: CanvasCardInfoSettings = {
  format: "pretty",
  notice: true,
};

/**
 * Canvas node objects are not part of Obsidian's public API.
 * This loose type captures the fields we read from a node.
 */
interface CanvasNodeLike {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  // text nodes
  text?: string;
  // file nodes
  file?: TFile | string;
  filePath?: string;
  subpath?: string;
  // link nodes
  url?: string;
  // group nodes
  label?: string;
  getData?: () => Record<string, unknown>;
}

export default class CanvasCardInfoPlugin extends Plugin {
  settings: CanvasCardInfoSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // Single-card right-click menu.
    this.registerEvent(
      // @ts-expect-error canvas:node-menu is an internal Obsidian event
      this.app.workspace.on("canvas:node-menu", (menu: Menu, node: CanvasNodeLike) => {
        this.addCopyItem(menu, () => [node]);
      })
    );

    // Multi-select right-click menu.
    this.registerEvent(
      // @ts-expect-error canvas:selection-menu is an internal Obsidian event
      this.app.workspace.on("canvas:selection-menu", (menu: Menu, canvas: { selection?: Set<CanvasNodeLike> }) => {
        this.addCopyItem(menu, () => Array.from(canvas?.selection ?? []));
      })
    );

    this.addSettingTab(new CanvasCardInfoSettingTab(this));
  }

  private addCopyItem(menu: Menu, getNodes: () => CanvasNodeLike[]) {
    menu.addItem((item) => {
      item
        .setTitle("카드 정보 복사")
        .setIcon("clipboard-copy")
        .onClick(async () => {
          const nodes = getNodes().filter(Boolean);
          if (nodes.length === 0) {
            new Notice("복사할 카드가 없습니다");
            return;
          }
          const text = nodes.map((n) => this.buildInfo(n)).join("\n\n---\n\n");
          try {
            await navigator.clipboard.writeText(text);
            if (this.settings.notice) {
              new Notice(
                nodes.length === 1
                  ? "카드 정보를 복사했습니다"
                  : `카드 ${nodes.length}개 정보를 복사했습니다`
              );
            }
          } catch (e) {
            new Notice("클립보드 복사에 실패했습니다");
            console.error("[canvas-card-info] clipboard error", e);
          }
        });
    });
  }

  private buildInfo(node: CanvasNodeLike): string {
    const data = this.getNodeData(node);
    const pretty = this.prettyInfo(node, data);
    const json = "```json\n" + JSON.stringify(data, null, 2) + "\n```";

    switch (this.settings.format) {
      case "json":
        return json;
      case "both":
        return pretty + "\n\n" + json;
      case "pretty":
      default:
        return pretty;
    }
  }

  private getNodeData(node: CanvasNodeLike): Record<string, unknown> {
    if (typeof node.getData === "function") {
      try {
        return node.getData();
      } catch (e) {
        /* fall through */
      }
    }
    // Fallback: reconstruct from known fields.
    const data: Record<string, unknown> = {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
    if (node.color) data.color = node.color;
    if (typeof node.text === "string") {
      data.type = "text";
      data.text = node.text;
    } else if (node.file != null || node.filePath != null) {
      data.type = "file";
      data.file = node.filePath ?? this.filePathOf(node.file);
      if (node.subpath) data.subpath = node.subpath;
    } else if (node.url != null) {
      data.type = "link";
      data.url = node.url;
    } else if (node.label != null) {
      data.type = "group";
      data.label = node.label;
    }
    return data;
  }

  private filePathOf(file: TFile | string | undefined): string | undefined {
    if (file == null) return undefined;
    if (typeof file === "string") return file;
    return (file as TFile).path;
  }

  private prettyInfo(node: CanvasNodeLike, data: Record<string, unknown>): string {
    const type = String(data.type ?? "unknown");
    const lines: string[] = [];
    const typeLabel: Record<string, string> = {
      text: "텍스트 카드",
      file: "파일 카드",
      link: "링크 카드",
      group: "그룹",
      unknown: "카드",
    };
    lines.push(`### ${typeLabel[type] ?? "카드"}`);
    if (data.id) lines.push(`- **id**: ${data.id}`);

    if (type === "text") {
      lines.push(`- **내용**:`);
      lines.push(this.quote(String(data.text ?? "")));
    } else if (type === "file") {
      lines.push(`- **파일**: ${data.file ?? "(없음)"}`);
      if (data.subpath) lines.push(`- **subpath**: ${data.subpath}`);
    } else if (type === "link") {
      lines.push(`- **URL**: ${data.url ?? "(없음)"}`);
    } else if (type === "group") {
      lines.push(`- **라벨**: ${data.label ?? "(없음)"}`);
    }

    const pos = this.numTriple(data.x, data.y);
    if (pos) lines.push(`- **위치(x, y)**: ${pos}`);
    const size = this.numTriple(data.width, data.height);
    if (size) lines.push(`- **크기(w, h)**: ${size}`);
    if (data.color) lines.push(`- **색상**: ${data.color}`);

    return lines.join("\n");
  }

  private quote(text: string): string {
    return text
      .split("\n")
      .map((l) => `  > ${l}`)
      .join("\n");
  }

  private numTriple(a: unknown, b: unknown): string | null {
    if (typeof a !== "number" || typeof b !== "number") return null;
    return `${Math.round(a)}, ${Math.round(b)}`;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

import { PluginSettingTab, App, Setting } from "obsidian";

class CanvasCardInfoSettingTab extends PluginSettingTab {
  plugin: CanvasCardInfoPlugin;

  constructor(plugin: CanvasCardInfoPlugin) {
    super(plugin.app as App, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("복사 형식")
      .setDesc("카드 정보를 어떤 형식으로 클립보드에 복사할지 선택합니다.")
      .addDropdown((d) =>
        d
          .addOption("pretty", "읽기 좋은 텍스트")
          .addOption("json", "원본 JSON")
          .addOption("both", "텍스트 + JSON")
          .setValue(this.plugin.settings.format)
          .onChange(async (v) => {
            this.plugin.settings.format = v as CanvasCardInfoSettings["format"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("복사 알림")
      .setDesc("복사 완료 시 알림(Notice)을 표시합니다.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.notice).onChange(async (v) => {
          this.plugin.settings.notice = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
