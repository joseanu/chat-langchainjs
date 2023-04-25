/* eslint-disable no-process-env */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { CallbackManager } from 'langchain/callbacks';
import { LLMResult } from 'langchain/schema';
import { SupabaseHybridSearch } from 'langchain/retrievers/supabase';
import { makeChain } from './util';

function formatHistory(history: []) {
  if (history.length === 0) {
    return "";
  }
  let str = "";
  for (let i = 0; i < history.length; i += 1) {
    str += `pregunta: ${history[i][0]}?\n`;
    str += `respuesta: ${history[i][1]}\n`;
  }
  return str;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {

  const { body } = req;

  const chat_history = formatHistory(body.history);

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );

  const retriever = new SupabaseHybridSearch(new OpenAIEmbeddings(), {
    client: supabaseClient,
    similarityK: 2,
    keywordK: 2,
    tableName: "documents",
    similarityQueryName: "match_documents",
    keywordQueryName: "kw_match_documents",
  });

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
  const chain = makeChain(retriever, CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      sendData(JSON.stringify({ data: token }));
    },
    async handleLLMStart(llm, _prompts: string[]) {
      console.log("docChain LLMStart", { llm, _prompts });
    },
    async handleChainStart(chain) {
      console.log("docChain ChainStart", { chain });
    },
    async handleLLMEnd(output: LLMResult) {
      console.log("questionGenerator LLMEnd", JSON.stringify(output) );
    }
  }));

  await chain.call({
    question: body.question,
    chat_history,
  }).then(async (result) => {
    await supabaseClient
      .from('historia')
      .insert([
        { pregunta: body.question, respuesta: result.text },
      ]);
  }).catch((err) => {
    console.error(err);
  }).finally(() => {
    sendData('[DONE]');
    res.end();
  });

}
