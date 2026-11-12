import json
from collections.abc import Callable
from typing import Protocol

import anthropic
import httpx

from yara_api.config import Settings
from yara_api.tutor.prompts import TutorPrompt


class ProviderError(RuntimeError):
    pass


class ProviderBlocked(ProviderError):
    pass


class TutorProvider(Protocol):
    def complete(self, prompt: TutorPrompt) -> str: ...


class AnthropicProvider:
    def __init__(self, api_key: str, model: str, timeout: float) -> None:
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=1)
        self._model = model

    def complete(self, prompt: TutorPrompt) -> str:
        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=400,
                temperature=0.3,
                system=prompt.system,
                messages=[{"role": "user", "content": prompt.user}],
            )
        except anthropic.APIError as error:
            raise ProviderError(str(error)) from error
        return "".join(block.text for block in message.content if block.type == "text")


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_SAFETY = (
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
)
GEMINI_BLOCKED = frozenset({"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"})


class GeminiProvider:
    def __init__(self, api_key: str, model: str, timeout: float, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=timeout)
        self._api_key = api_key
        self._model = model

    def complete(self, prompt: TutorPrompt) -> str:
        body = {
            "systemInstruction": {"parts": [{"text": prompt.system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt.user}]}],
            "safetySettings": [
                {"category": category, "threshold": "BLOCK_LOW_AND_ABOVE"} for category in GEMINI_SAFETY
            ],
            "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 1024},
        }
        try:
            response = self._client.post(
                GEMINI_URL.format(model=self._model),
                headers={"x-goog-api-key": self._api_key},
                json=body,
            )
        except httpx.HTTPError as error:
            raise ProviderError(str(error)) from error
        if response.status_code != 200:
            raise ProviderError(f"Gemini returned {response.status_code}")
        return _gemini_text(response.json())


def _gemini_text(data: dict) -> str:
    if data.get("promptFeedback", {}).get("blockReason"):
        raise ProviderBlocked(data["promptFeedback"]["blockReason"])
    candidates = data.get("candidates") or []
    if not candidates:
        raise ProviderError("Gemini returned no answer")
    candidate = candidates[0]
    if candidate.get("finishReason") in GEMINI_BLOCKED:
        raise ProviderBlocked(candidate["finishReason"])
    parts = candidate.get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts if not part.get("thought"))


class EchoProvider:
    def complete(self, prompt: TutorPrompt) -> str:
        subject = prompt.context.must_mention or prompt.context.facts.split(":")[0]
        return json.dumps({"answer": f"{subject}. {subject}.", "on_topic": True}, ensure_ascii=False)


class ScriptedProvider:
    def __init__(self, reply: str | Callable[[TutorPrompt], str]) -> None:
        self.reply = reply
        self.calls: list[TutorPrompt] = []

    def complete(self, prompt: TutorPrompt) -> str:
        self.calls.append(prompt)
        if isinstance(self.reply, str):
            return self.reply
        return self.reply(prompt)


def build_provider(settings: Settings) -> TutorProvider | None:
    if settings.tutor_provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(
            settings.anthropic_api_key, settings.tutor_model, settings.tutor_timeout_seconds
        )
    if settings.tutor_provider == "gemini" and settings.gemini_api_key:
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model, settings.tutor_timeout_seconds)
    if settings.tutor_provider == "fake":
        return EchoProvider()
    return None
