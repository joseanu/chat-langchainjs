import type { EPub } from "epub2";
import { Document } from "langchain/document";
import { BaseDocumentLoader } from "langchain/document_loaders/base";

export class EPubLoader extends BaseDocumentLoader {
  private splitChapters: boolean;

  constructor(public filePath: string, { splitChapters = true } = {}) {
    super();
    this.splitChapters = splitChapters;
  }

  protected async parse(
    epub: EPub
  ): Promise<{ pageContent: string; metadata?: object }[]> {
    const { htmlToText } = await HtmlToTextImport();
    const chapters = await Promise.all(
      epub.toc.map(async (chapter) => {
        if (!chapter.id) return null as never;
        const html: string = await epub.getChapterRawAsync(chapter.id);
        if (!html) return null as never;
        return {
          html,
          title: chapter.title,
        };
      })
    );
    return chapters.filter(Boolean).map((chapter) => ({
      pageContent: htmlToText(chapter.html, {
        wordwrap: false
      }),
      metadata: {
        ...(chapter.title && { chapter: chapter.title }),
      },
    }));
  }

  public async load(): Promise<Document[]> {
    const { EPub } = await EpubImport();
    const epub = await EPub.createAsync(this.filePath);

    const parsed = await this.parse(epub);
    const metadata = { source: this.filePath };

    if (parsed.length === 0) return [];

    return this.splitChapters
      ? parsed.map(
          (chapter) =>
            new Document({
              pageContent: chapter.pageContent,
              metadata: {
                ...metadata,
                ...chapter.metadata,
              },
            })
        )
      : [
          new Document({
            pageContent: parsed
              .map((chapter) => chapter.pageContent)
              .join("\n\n"),
            metadata,
          }),
        ];
  }
}

async function EpubImport() {
  const { EPub } = await import("epub2").catch(() => {
    throw new Error(
      "Failed to load epub2. Please install it with eg. `npm install epub2`."
    );
  });
  return { EPub };
}

async function HtmlToTextImport() {
  const { htmlToText } = await import("html-to-text").catch(() => {
    throw new Error(
      "Failed to load html-to-text. Please install it with eg. `npm install html-to-text`."
    );
  });
  return { htmlToText };
}
