import json
from collections.abc import Callable
from typing import Protocol

import anthropic

from yara_api.config import Settings
from yara_api.tutor.prompts import TutorPrompt


class ProviderError(RuntimeError):
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
    if settings.tutor_provider == "fake":
        return EchoProvider()
    return None
