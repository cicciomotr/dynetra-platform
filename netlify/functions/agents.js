
const AGENTS = {
  Alex: "Chief of Staff. Coordini il team, pianifichi incarichi e assegni responsabilità.",
  Maya: "Research Lead. Conduci ricerche e analisi di mercato.",
  Leo: "Lead Software Engineer. Progetti architetture software e coordini Sofia e Noah.",
  Nora: "Product Designer. Progetti interfacce e UX.",
  Sam: "Growth Strategist. Elabori strategie di crescita.",
  Iris: "Data Scientist. Analizzi dati e sviluppi modelli.",
  Max: "Motorsport Engineer. Sei esperto di telemetria, setup e strategie di gara.",
  Eva: "Product Manager. Gestisci roadmap e requisiti.",
  Kai: "Automation Specialist. Progetti automazioni.",
  Zoe: "Communications Lead. Gestisci comunicazione e contenuti.",
  Theo: "Quality Assurance. Verifichi qualità, test e problemi.",
  Sofia: "Frontend Engineer. Sviluppi interfacce e dashboard.",
  Noah: "Backend & AI Engineer. Sviluppi API, backend e integrazioni AI."
};

const PROJECTS = {
  Dynetra: "Piattaforma di ingegneria motorsport per F1 e altre categorie: telemetria, analisi piloti, setup, simulazione strategica e AI Insights.",
  "General Operations": "Gestione operativa, ricerca, pianificazione e coordinamento aziendale."
};

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(data)
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Metodo non consentito" });
  }

  try {
    const expectedCode = process.env.HQ_ACCESS_CODE;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!expectedCode || !apiKey) {
      return json(503, { error: "Configurazione server incompleta" });
    }

    const suppliedCode = event.headers["x-hq-access-code"];

    if (!suppliedCode || suppliedCode !== expectedCode) {
      return json(401, { error: "Accesso non autorizzato" });
    }

    if ((event.body || "").length > 20000) {
      return json(413, { error: "Richiesta troppo grande" });
    }

    const body = JSON.parse(event.body || "{}");
    const { agent, project, task } = body;

    if (!AGENTS[agent] || !PROJECTS[project]) {
      return json(400, { error: "Agente o progetto non valido" });
    }

    if (typeof task !== "string" || !task.trim() || task.length > 8000) {
      return json(400, { error: "Incarico non valido" });
    }

    const prompt = `
Sei ${agent}, membro di AI Headquarters.
Ruolo: ${AGENTS[agent]}

Progetto: ${project}
Contesto: ${PROJECTS[project]}

Rispondi in italiano in modo professionale e concreto.
Proponi soluzioni tecniche, passaggi operativi e risultati verificabili.
Non dichiarare di aver modificato repository, eseguito codice,
contattato altri agenti o completato operazioni esterne
se non hai realmente accesso agli strumenti necessari.

Incarico:
${task}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return json(502, {
        error: "Errore del servizio AI",
        upstreamStatus: response.status
      });
    }

    const answer = (result.candidates?.[0]?.content?.parts || [])
      .filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join("\n");

    if (!answer) {
      return json(502, { error: "Gemini non ha restituito una risposta testuale" });
    }

    return json(200, {
      success: true,
      agent,
      project,
      answer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Agent function error:", error.message);
    return json(500, { error: "Errore interno del server" });
  }
};
