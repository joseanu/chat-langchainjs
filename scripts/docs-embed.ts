import { Document } from 'langchain/document';
import * as fs from 'fs/promises';
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { EPubLoader } from "@/utils/custom_epub_loader";
import { PDFLoader } from "@/utils/custom_pdf_loader";
import type { SupabaseClient } from '@supabase/supabase-js';
import { Embeddings } from 'langchain/embeddings';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { supabaseClient } from '@/utils/supabase-client';

const directory = "/Users/joseanu/Desktop/manuales/axioma/libro"

async function extractDataFromDocs(directory: string): Promise<Document[]> {
  console.log('extracting data from documents...');
  const loader = new DirectoryLoader(
    directory,
    {
      ".pdf": (path: string) => new PDFLoader(path),
      ".txt": (path: string) => new TextLoader(path),
      ".epub": (path: string) => new EPubLoader(path),
    }
  );
  const documents: Document[] = await loader.load();
  console.log('data extracted from urls');
  const json = JSON.stringify(documents);
  await fs.writeFile('manuales.json', json);
  console.log('json file containing data saved on disk');
  return documents;
}

async function embedDocuments(
  client: SupabaseClient,
  docs: Document[],
  embeddings: Embeddings,
) {
  console.log('creating embeddings...');
  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client,
    tableName: "documents",
    queryName: "match_documents",
  });
  console.log('embeddings successfully stored in supabase');
}

async function splitDocsIntoChunks(docs: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 500,
  });
  console.log('splitting docs into chunks...');
  return await textSplitter.splitDocuments(docs);
}

(async function run(directory: string) {
  try {
    //load data from each url
    const rawDocs = await extractDataFromDocs(directory);
    //split docs into chunks for openai context window
    const docs = await splitDocsIntoChunks(rawDocs);
    //embed docs into supabase
    await embedDocuments(supabaseClient, docs, new OpenAIEmbeddings());
  } catch (error) {
    console.log('error occured:', error);
  }
})(directory);
