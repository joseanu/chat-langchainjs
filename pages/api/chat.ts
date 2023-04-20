import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { CallbackManager } from 'langchain/callbacks';
import { makeChain } from './util';
import { ChainValues, LLMResult } from 'langchain/dist/schema';

function formatHistory(history: []) {
  if (history.length === 0) {
    return "";
  }
  let str = "";
  for (let i = 0; i < history.length; i++) {
    str += `pregunta: ${history[i][0]}?\n`;
    str += `respuesta: ${history[i][1]}\n`;
  }
  return str;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {

  const body = req.body;
  const dir = path.resolve(process.cwd(), 'data');

  const chat_history = formatHistory(body.history);

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );

  const vectorstore = await SupabaseVectorStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    {
      client: supabaseClient,
      tableName: 'documents',
      queryName: 'match_documents',
    }
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    // Important to set no-transform to avoid compression, which will delay
    // writing response chunks to the client.
    // See https://github.com/vercel/next.js/issues/9965
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  sendData(JSON.stringify({ data: '' }));
  const chain = makeChain(vectorstore, CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      sendData(JSON.stringify({ data: token }));
    },
    async handleLLMStart(llm, _prompts: string[]) {
      console.log("docChain LLMStart", { _prompts });
    },
    async handleChainStart(chain) {
      console.log("docChain ChainStart", { chain });
    },
    async handleLLMEnd(output: LLMResult, verbose?: boolean) {
      console.log("docChain LLMEnd", output.generations);
    }
  }));

  await chain.call({
    question: body.question,
    chat_history,
  }).then(async (result) => {
    const { data, error } = await supabaseClient
      .from('historia')
      .insert([
        { pregunta: body.question, respuesta: result.text },
      ])
  }).catch((err) => {
    console.error(err);
  }).finally(() => {
    sendData('[DONE]');
    res.end();
  });

}
