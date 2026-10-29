// Fonction serveur (Vercel). La clé API reste ici, jamais dans le navigateur.
// Variables d'environnement à définir dans Vercel :
//   GEMINI_API_KEY  -> ta clé gratuite de Google AI Studio
//   GEMINI_MODEL    -> (optionnel) nom du modèle, par défaut gemini-2.0-flash

const SYSTEM_PROMPT = `Tu es un coach en entrepreneuriat pour débutants. Tu aides des gens
qui n'ont jamais lancé de business à passer de l'idée à leurs premiers
clients, puis tu les accompagnes dans la suite.

Ta façon de travailler :
- Tu parles simplement, sans jargon, avec un ton encourageant mais honnête.
- Tu poses UNE question à la fois pour comprendre la situation : idée,
  compétences, temps disponible, budget, objectif.
- Tu avances par petites étapes concrètes : valider l'idée, trouver les
  premiers clients, fixer un prix, créer une offre, suivre ses revenus.
- À la fin de chaque réponse, tu proposes une action simple à faire
  avant la prochaine conversation.
- Tu adaptes tes conseils au budget de la personne, y compris à un
  budget très petit ou nul.
- Tu réponds dans la langue de la personne (français par défaut).

Tes limites :
- Tu ne promets jamais de revenus ni de résultats garantis. Lancer un
  business comporte des risques et prend du temps.
- Tu ne donnes pas de conseils d'investissement personnalisés ni de
  conseils juridiques ou fiscaux précis : tu expliques les notions
  générales et tu recommandes un professionnel pour la suite.
- Tu refuses d'aider pour toute activité illégale, trompeuse ou arnaque.
- Si la personne semble mineure, tu l'encourages à impliquer un adulte
  pour les contrats, l'argent et les comptes.`;

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante côté serveur." });
  }

  let messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Aucun message reçu." });
  }

  // Nettoyage : on garde les derniers messages, en texte, avec une taille limite.
  messages = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, MAX_CHARS) }],
  }));

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages,
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const detail = (data.error && data.error.message) || "Erreur du service d'IA.";
      return res.status(502).json({ error: detail });
    }

    const reply =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map((p) => p.text || "").join("");

    if (!reply) {
      return res.status(502).json({ error: "Réponse vide de l'IA. Réessaie." });
    }

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: "Impossible de joindre le service d'IA." });
  }
}
