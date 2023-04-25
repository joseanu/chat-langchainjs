import { Document } from "langchain/document";

interface BaseDocumentTransformer {
  transformDocuments(documents: Document[], kwargs?: Record<string, unknown>): Promise<Document[]>;
}

export abstract class BaseDocumentCompressor {
  abstract compressDocuments(
    documents: Document[],
    query: string
  ): Promise<Document[]>;
}

export class DocumentCompressorPipeline implements BaseDocumentCompressor {
  transformers: Array<BaseDocumentTransformer | BaseDocumentCompressor>;

  constructor(transformers: Array<BaseDocumentTransformer | BaseDocumentCompressor>) {
    this.transformers = transformers;
  }

  async compressDocuments(documents: Document[], query: string): Promise<Document[]> {
    let compressedDocs = documents;
    for (const transformer of this.transformers) {
      if ("compressDocuments" in transformer) {
        compressedDocs = await transformer.compressDocuments(compressedDocs, query);
      } else if ("transformDocuments" in transformer) {
        compressedDocs = await transformer.transformDocuments(compressedDocs);
      } else {
        throw new Error(`Got unexpected transformer type: ${transformer} `);
      }
    }
    return compressedDocs;
  }
}