// This site runs entirely in the browser. It makes no OpenAI API calls.
const WELCOME_VIDEO_URL = new URL("media/Nukak_reel_instagram%20(1).mp4", document.baseURI).href;

const welcomeText =
  "¡Hola! Bienvenido/a a este espacio educativo sobre el proyecto del pueblo Nukak. Te invito a ver el video antes de conversar. ¿Cómo te llamas?";
const conversation = document.querySelector("#conversation");
const videoSlot = document.querySelector("#video-slot");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");

const messages = [{ role: "assistant", content: welcomeText }];
let preferredName = "";
let waitingForName = true;
let localModeNoticeShown = false;
let knowledgeBase = null;

const knowledgePromise = fetch(new URL("knowledge.json", document.baseURI))
  .then((response) => {
    if (!response.ok) throw new Error("No se pudo cargar la base de conocimiento.");
    return response.json();
  })
  .then((data) => {
    knowledgeBase = data;
    return data;
  });

function addMessage(role, content, extraClass = "") {
  const row = document.createElement("div");
  row.className = \`message-row \${role === "user" ? "user" : "assistant"} \${extraClass}\`.trim();

  if (role !== "user") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "N";
    row.append(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;
  row.append(bubble);
  conversation.append(row);
  conversation.scrollTop = conversation.scrollHeight;
  return row;
}

function showWelcomeVideo() {
  const video = document.createElement("video");
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.setAttribute("aria-label", "Video de bienvenida del proyecto");

  const source = document.createElement("source");
  source.src = WELCOME_VIDEO_URL;
  video.append(source);
  videoSlot.replaceChildren(video);
}

function detectName(text) {
  const value = text.trim();
  const decline = /^(no|prefiero no|no quiero|sin nombre|no deseo|prefiero no decirlo|no quiero dar mi nombre|prefiero no decir mi nombre)[.! ]*$/i;
  const question = /^(qué|que|cómo|como|cuándo|cuando|dónde|donde|por qué|porque|quién|quien|cuéntame|cuentame|quiero saber)\b/i;
  waitingForName = false;
  if (decline.test(value) || value.length > 42 || /[?¿]/.test(value) || question.test(value)) return;
  const candidate = value.replace(/^(me llamo|mi nombre es|soy)\s+/i, "").trim();
  if (candidate && /^[\p{L}\p{M} .'-]+$/u.test(candidate)) {
    preferredName = candidate.slice(0, 40);
  }
}

function localAnswer(question, name, history) {
  const text = question.trim();
  const lower = text.toLocaleLowerCase("es");
  const decline = /^(no|prefiero no|no quiero|sin nombre|no deseo|prefiero no decirlo|no quiero dar mi nombre|prefiero no decir mi nombre)[.! ]*$/i;

  if (decline.test(text)) return knowledgeBase.answers.noName;
  const nameCandidate = text.replace(/^(me llamo|mi nombre es|soy)\s+/i, "").trim();
  if (name && nameCandidate.toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es")) {
    return "¡Mucho gusto, " + name + "! ¿Qué te gustaría saber sobre el proyecto del pueblo Nukak?";
  }
  if (/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches)($|[!,. ])/i.test(lower)) {
    return knowledgeBase.answers.greeting;
  }

  const topicPattern = /(n[uü]kak|proyecto|pueblo|territorio|desplazamiento|forzado|protecci[oó]n|derechos?|instituciones?|responsabilidades?|medidas?|cumplimiento|implementaci[oó]n|cultura|identidad|lengua|campa[nñ]a|afiches?|exposiciones?|videos?|escuela|escolar|pesu|salvaguardia|reubicaci[oó]n|corte constitucional)/i;
  const continuationPattern = /^(y|¿?y|eso|ellos|ellas|su|sus|esa|ese|también|tambien|cómo así|como así|qué más|que más)($|[?!. ,])/i;
  const priorTopic = history.some((message) => message.role === "user" && topicPattern.test(message.content));

  if (!topicPattern.test(text) && !(priorTopic && continuationPattern.test(text))) {
    return "No te puedo responder eso porque este chat solo trata sobre el proyecto del pueblo Nukak.";
  }

  const routes = [
    [/propuesta|campa[nñ]|afiche|exposici|video|escuela|escolar|evaluaci[oó]n|objetivo/i, "campaign"],
    [/instituci|responsab|ministerio|unidad para las v[ií]ctimas|uariv|defensor[ií]a|procuradur[ií]a|alcald[ií]a|gobernaci[oó]n|autoridades|webaka/i, "institutions"],
    [/pesu|pes-u|plan especial de salvaguardia|salvaguardia urgente/i, "pesu"],
    [/desplaz|reubic|retorno|asentamiento|conflicto armado|corte constitucional|auto [0-9]+/i, "displacement"],
    [/derech|protecci[oó]n|autonom[ií]a|reparaci[oó]n|garant[ií]as/i, "rights"],
    [/territor|selva|bosque|r[ií]os?|naturaleza|deforest|miner[ií]a|cultivos|tierra|alimento|despoj/i, "territory"],
    [/cultura|identidad|lengua|ling[uü][ií]stica|tradici|oral|conocimiento|ense[nñ]|educaci[oó]n/i, "culture"],
    [/historia|contacto|caucher|1988|poblaci[oó]n/i, "history"],
    [/qui[eé]n(?:es)? son|qu[eé] es el pueblo|ubicaci[oó]n|d[oó]nde (?:viven|se ubican)|n[uü]kak/i, "identity"]
  ];

  const route = routes.find(([pattern]) => pattern.test(text));
  let answer = knowledgeBase.answers[route ? route[1] : "general"] || knowledgeBase.answers.unknown;
  const priorAssistantAnswers = history.filter((message) => message.role === "assistant").length;
  if (name && priorAssistantAnswers > 1 && priorAssistantAnswers % 4 === 0) {
    answer = name + ", " + answer;
  }
  return answer;
}

function showTyping() {
  return addMessage("assistant", "Estoy preparando una respuesta…", "typing");
}

async function sendQuestion(text) {
  const question = text.trim();
  if (!question || sendButton.disabled) return;

  if (waitingForName) detectName(question);
  messages.push({ role: "user", content: question });
  addMessage("user", question);
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  const typingRow = showTyping();

  try {
    const data = await knowledgePromise;
    if (!data) throw new Error("No pude cargar la base local. Recarga la página para intentarlo otra vez.");
    typingRow.remove();

    if (!localModeNoticeShown) {
      addMessage(
        "assistant",
        "Modo gratuito: este chat responde con su base local y no envía preguntas a OpenAI.",
      );
      localModeNoticeShown = true;
    }
    const answer = localAnswer(question, preferredName, messages.slice(0, -1));
    messages.push({ role: "assistant", content: answer });
    addMessage("assistant", answer);
  } catch (error) {
    typingRow.remove();
    addMessage("assistant", error.message || "No pude cargar la información. Recarga la página e inténtalo otra vez.");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

addMessage("assistant", welcomeText);
showWelcomeVideo();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendQuestion(input.value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = \`\${Math.min(input.scrollHeight, 108)}px\`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => void sendQuestion(button.dataset.question));
});

document.querySelector("#new-chat")?.addEventListener("click", () => {
  window.location.reload();
});
