import json
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from app.main import ASTRO_MODEL_MAP, DEFAULT_ASTRO_MODEL

# Define expected outputs for structured generation
class MCQOption(BaseModel):
    text: str = Field(description="The option text")
    is_correct: bool = Field(description="Whether this option is the correct answer")

class MCQ(BaseModel):
    question: str = Field(description="The multiple choice question")
    options: list[MCQOption] = Field(description="List of exactly 4 options, only 1 being correct")

class Flashcard(BaseModel):
    front: str = Field(description="The question or prompt on the front of the flashcard")
    back: str = Field(description="The answer on the back of the flashcard")

class TrueFalse(BaseModel):
    statement: str = Field(description="A true or false statement based on the document")
    is_true: bool = Field(description="Whether the statement is true")
    explanation: str = Field(description="A brief explanation of why it is true or false")

class QuizOutput(BaseModel):
    mcqs: list[MCQ] = Field(default=[], description="List of generated MCQs")
    flashcards: list[Flashcard] = Field(default=[], description="List of generated flashcards")
    true_false: list[TrueFalse] = Field(default=[], description="List of generated true/false questions")


def generate_quiz_from_chunks(chunks: list[str], quiz_type: str, astro_model: str = DEFAULT_ASTRO_MODEL) -> dict:
    """
    Generate a quiz based on document chunks using the specified model.
    quiz_type can be 'mcq', 'flashcards', 'true_false', or 'all'.
    """
    gemini_model = ASTRO_MODEL_MAP.get(astro_model, ASTRO_MODEL_MAP[DEFAULT_ASTRO_MODEL])
    
    # We use a generative model with structured output, configured to fail fast on rate limits
    # max_retries=0 is CRITICAL to prevent LangChain from exponential backoff that exceeds the 300s frontend timeout
    llm = ChatGoogleGenerativeAI(model=gemini_model, temperature=0.3, max_retries=0, timeout=30)
    structured_llm = llm.with_structured_output(QuizOutput)

    # Combine chunks into context, truncating if too large
    context = "\n\n".join(chunks)
    # Roughly limit to 50k chars for safety, though Gemini supports much more.
    if len(context) > 50000:
        context = context[:50000]

    type_instructions = ""
    if quiz_type == "mcq":
        type_instructions = "Generate 5 Multiple Choice Questions (MCQs)."
    elif quiz_type == "flashcards":
        type_instructions = "Generate 10 Flashcards summarizing key concepts."
    elif quiz_type == "true_false":
        type_instructions = "Generate 5 True/False questions with explanations."
    else:
        type_instructions = "Generate 3 MCQs, 5 Flashcards, and 3 True/False questions."

    prompt = f"""
You are an expert educator. Based on the following document context, generate a study guide.
{type_instructions}

Ensure the questions are accurate and directly based on the provided text.

Context:
{context}
"""
    try:
        result = structured_llm.invoke(prompt)
    except Exception as e:
        import time
        from app.agent.graph import FALLBACK_MODELS
        
        last_error = e
        # Try fallbacks since primary failed
        for fallback_model in FALLBACK_MODELS:
            if fallback_model == gemini_model:
                continue
                
            print(f"Quiz Generation Error with {gemini_model}: {last_error}. Trying fallback model {fallback_model}...")
            time.sleep(1)
            try:
                fallback_llm = ChatGoogleGenerativeAI(model=fallback_model, temperature=0.3, max_retries=0, timeout=30)
                fallback_structured_llm = fallback_llm.with_structured_output(QuizOutput)
                result = fallback_structured_llm.invoke(prompt)
                last_error = None
                break
            except Exception as ex:
                last_error = ex
                
        if last_error:
            error_str = str(last_error)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                raise Exception("All available AI models have hit their free-tier rate limits. Please wait about 1 minute for your quota to refresh, then try again.")
            raise last_error
            
    # Return as dict
    return result.model_dump()
