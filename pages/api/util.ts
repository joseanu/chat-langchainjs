import { OpenAI } from "langchain/llms/openai";
import { LLMChain, ConversationalRetrievalQAChain, ChatVectorDBQAChain, loadQAChain, loadQAMapReduceChain } from "langchain/chains";
import { CallbackManager, ConsoleCallbackHandler } from "langchain/callbacks";
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { CONDENSE_PROMPT, QA_PROMPT, combineMapPrompt, combinePrompt } from "./prompts";
import { LLMResult } from "langchain/dist/schema";

export const makeChain = (vectorstore: SupabaseVectorStore, onTokenStream: CallbackManager) => {
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMStart(llm, _prompts: string[]) {
      console.log("questionGenerator LLMStart", { _prompts });
    },
    async handleChainStart(chain) {
      console.log("questionGenerator ChainStart", { chain });
    },
    async handleLLMEnd(output: LLMResult, verbose?: boolean) {
      console.log("questionGenerator LLMEnd", output.generations );
    }
  })

  const questionGenerator = new LLMChain({
    llm: new OpenAI({
      callbackManager,
      modelName: "gpt-3.5-turbo",
      maxTokens: 2000,
      verbose: true,
    }),
    prompt: CONDENSE_PROMPT,
    verbose: true,
  });
  const docChain = loadQAChain(
    new OpenAI({
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream,
      modelName: "gpt-3.5-turbo",
      maxTokens: 2000,
      verbose: true,
    }),
    { prompt: QA_PROMPT },
  );
  const docChain2 = loadQAMapReduceChain(
    new OpenAI({
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream,
      modelName: "gpt-3.5-turbo",
      maxTokens: 2000,
      verbose: true,
    }),
    {
      combineMapPrompt,
      combinePrompt
    },
  );

  return new ConversationalRetrievalQAChain({
    retriever: vectorstore.asRetriever(),
    combineDocumentsChain: docChain2,
    questionGeneratorChain: questionGenerator,
  });
}
