# AI Prompts Used

## Prompt 1 — What is Cloudflare Workers AI?

## Prompt 2 — Explain the problem statement.
"We plan to fast track review of candidates who complete an assignment to build a type of AI-powered application on Cloudflare. An AI-powered application should include the following components:
LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice
Workflow / coordination (recommend using Workflows, Workers or Durable Objects)
User input via chat or voice (recommend using Pages or Realtime)
Memory or state"

## Prompt 3 — What is Wrangler?

## Prompt 4 - Can we deploy backend code on Cloudflare Pages?

## Prompt 5 - Where memory is stored in this application?

## Prompt 6 - How to deploy this application on Cloudflare?

## Prompt 7 - Frontend chat UI
"Build a clean chat UI using React, Vite and Tailwind CSS that sends messages 
to a REST API, displays user and assistant messages, and persists 
a sessionId in localStorage."

## Prompt 8 — Worker backend logic
"Write a Cloudflare Worker in TypeScript that accepts a POST /chat 
request with a message and sessionId, loads conversation history 
from KV, calls Llama 3.3 on Workers AI, saves updated history, 
and returns the AI reply with CORS headers."

## Prompt 9 — Debugging CORS
"My Cloudflare Worker returns 403 on OPTIONS preflight requests.
Fix the CORS handling in my Worker fetch handler."

## Prompt 10 — Folder Structure
"I'm sending you screenshot of my folder structure and tell me what is wrong.
Tell me which files I have to add in .gitignore."

## Prompt 11 — Readme.md
"Now, I have provided you all the context of this assignment. Analyse it properly
and generate Readme.md for this project with architecture."

## Prompt 12 — Improve UI
"Improve the UI of this application. Make it responsive and user-friendly."