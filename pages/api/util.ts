import { OpenAI } from "langchain/llms/openai";
import { LLMChain, ConversationalRetrievalQAChain, loadQAMapReduceChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import { BaseRetriever, LLMResult } from "langchain/schema";
import { ContextualCompressionRetriever } from "../../contextualCompression/contextual_compression";
import { LLMChainExtractor } from "../../contextualCompression/document_compressors/chain_extract";
import { CONDENSE_PROMPT, combineMapPrompt, combinePrompt } from "./prompts";

export const makeChain = (retriever: BaseRetriever, onTokenStream: CallbackManager) => {
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMStart(llm, _prompts: string[]) {
      console.log("questionGenerator LLMStart", { llm, _prompts });
    },
    async handleChainStart(chain) {
      console.log("questionGenerator ChainStart", { chain });
    },
    async handleLLMEnd(output: LLMResult) {
      console.log("questionGenerator LLMEnd", JSON.stringify(output) );
    }
  });

  const questionGenerator = new LLMChain({
    llm: new OpenAI({
      callbackManager,
      modelName: "gpt-4",
      maxTokens: 2000,
      verbose: true,
    }),
    prompt: CONDENSE_PROMPT,
    verbose: true,
  });
  const docChain2 = loadQAMapReduceChain(
    new OpenAI({
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream,
      modelName: "gpt-4",
      maxTokens: 2000,
      verbose: true,
    }),
    {
      combineMapPrompt,
      combinePrompt
    },
  );

  return new ConversationalRetrievalQAChain({
    retriever: new ContextualCompressionRetriever({
      baseCompressor: LLMChainExtractor.fromLLM(new OpenAI({
        callbackManager,
        modelName: "gpt-3.5-turbo",
        maxTokens: 2000,
        verbose: true,
      })),
      baseRetriever: retriever,
    }),
    combineDocumentsChain: docChain2,
    questionGeneratorChain: questionGenerator,
  });
};
