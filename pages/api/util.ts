import { OpenAI } from "langchain/llms/openai";
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from "langchain/chains";
import { CallbackManager } from "langchain/callbacks";
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { PromptTemplate } from "langchain/prompts";

const CONDENSE_PROMPT = PromptTemplate.fromTemplate(`Dado el siguiente diálogo y una pregunta de seguimiento, reformula la pregunta de seguimiento para que sea una pregunta independiente.

Historial del chat:
{chat_history}
Entrada de seguimiento: {question}
Pregunta independiente:`);

const QA_PROMPT = PromptTemplate.fromTemplate(
  `Eres un experto en Administración de Proyectos de Construcción. Se te proporcionan las siguientes partes extraídas de varios documentos y una pregunta. Proporcione una respuesta conversacional basada en el contexto proporcionado.
Solo debes usar documentos como referencias que estén explícitamente enumerados como fuente en el contexto a continuación. NO inventes un documentos que no esté listado a continuación.
Si no puedes encontrar la respuesta en el contexto a continuación, simplemente di "No estoy seguro." No intentes inventar una respuesta.
Si la pregunta no está relacionada con Administración de Proyectos de Construcción o el contexto proporcionado, infórmales amablemente que estás ajustado para responder solo preguntas relacionadas con este tema.

Pregunta: {question}
=========
{context}
=========
Respuesta en Markdown:`);

export const makeChain = (vectorstore: SupabaseVectorStore, onTokenStream: CallbackManager) => {
  const questionGenerator = new LLMChain({
    llm: new OpenAI({ temperature: 0 }),
    prompt: CONDENSE_PROMPT,
  });
  const docChain = loadQAChain(
    new OpenAI({
      temperature: 0,
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream,
    }),
    { prompt: QA_PROMPT },
  );

  return new ChatVectorDBQAChain({
    vectorstore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
  });
}
