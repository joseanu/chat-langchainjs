export const prompt_template = (no_output_str: string) => `Con base en la siguiente pregunta y contexto, extrae cualquier parte del contexto TAL CUAL que sea relevante para responder la pregunta. Si ninguna parte del contexto es relevante, devuelve ${no_output_str}.
Recuerde, NO EDITES las partes extraídas del contexto. NO CONTESTES LA PREGUNTA.
> Pregunta: {question}
> Contexto:
>>>
{context}
>>>
Partes relevantes extraidas:`;
