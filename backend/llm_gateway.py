import json
import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import telemetry
from config import settings

logger = logging.getLogger("hyzync.llm_gateway")

_session = requests.Session()
_retry_strategy = Retry(
    total=0,
    connect=0,
    read=0,
    status=0,
    other=0,
    backoff_factor=0,
    status_forcelist=[],
    allowed_methods=["GET", "POST"],
)
_adapter = HTTPAdapter(max_retries=_retry_strategy, pool_connections=8, pool_maxsize=8)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)

_active_base_url_lock = threading.Lock()
_active_base_url = str(getattr(settings, "OLLAMA_URL", "") or "").strip().rstrip("/")
_health_cache_lock = threading.Lock()
_health_cache: Dict[str, Any] = {"expires_at": 0.0, "value": None}
_gateway_semaphore = threading.Semaphore(max(1, int(getattr(settings, "LLM_MAX_CONCURRENCY", 3) or 3)))


def normalize_base_url(value: Any) -> str:
    return str(value or "").strip().rstrip("/")


def compact_error_text(error: Any) -> str:
    return re.sub(r"\s+", " ", str(error or "")).strip()


def is_vllm_url(base_url: str) -> bool:
    return "/v1" in str(base_url or "").lower()


def _configured_fallback_urls() -> List[str]:
    raw = str(getattr(settings, "OLLAMA_FALLBACK_URLS", "") or "").strip()
    if not raw:
        return []
    return [url.strip() for url in raw.split(",") if url.strip()]


def candidate_endpoints() -> List[Dict[str, Any]]:
    seen = set()
    candidates: List[Dict[str, Any]] = []
    fallback_index = 0
    local_urls = ["http://127.0.0.1:11434", "http://localhost:11434"]

    raw_candidates: List[tuple[str, str]] = [
        (normalize_base_url(getattr(settings, "OLLAMA_URL", "")), "primary"),
    ]
    raw_candidates.extend((normalize_base_url(url), "fallback") for url in _configured_fallback_urls())
    raw_candidates.extend((url, "local_fallback") for url in local_urls)

    for raw_url, role in raw_candidates:
        normalized = normalize_base_url(raw_url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if role == "fallback":
            fallback_index += 1
            label = f"Standby {fallback_index}"
        elif role == "local_fallback":
            label = "Local standby"
        else:
            label = "Primary"
        candidates.append(
            {
                "url": normalized,
                "role": role,
                "label": label,
                "transport": "vllm" if is_vllm_url(normalized) else "ollama",
                "is_local": ("127.0.0.1" in normalized) or ("localhost" in normalized),
            }
        )
    return candidates


def ordered_endpoints() -> List[Dict[str, Any]]:
    candidates = candidate_endpoints()
    with _active_base_url_lock:
        active = _active_base_url
    if active:
        active = normalize_base_url(active)
    if active and any(item["url"] == active for item in candidates):
        return [item for item in candidates if item["url"] == active] + [item for item in candidates if item["url"] != active]
    return candidates


def remember_active_endpoint(base_url: str) -> None:
    normalized = normalize_base_url(base_url)
    if not normalized:
        return
    global _active_base_url
    with _active_base_url_lock:
        _active_base_url = normalized


def friendly_endpoint_error(base_url: str, error: Any) -> str:
    text = compact_error_text(error)
    lower = text.lower()
    endpoint = normalize_base_url(base_url) or "configured endpoint"
    is_local = ("127.0.0.1" in endpoint) or ("localhost" in endpoint)

    if any(token in lower for token in ["10054", "forcibly closed", "connection reset", "connection aborted", "protocolerror"]):
        return f"{endpoint}: Remote host closed the connection unexpectedly."
    if "524" in lower or "a timeout occurred" in lower:
        return f"{endpoint}: Gateway timed out while waiting for the LLM service."
    if "502" in lower or "bad gateway" in lower:
        return f"{endpoint}: Gateway reported the LLM service as unavailable."
    if "503" in lower or "service unavailable" in lower:
        return f"{endpoint}: LLM service is temporarily unavailable."
    if any(token in lower for token in ["read timed out", "readtimeout", "connecttimeout", "timed out"]):
        return f"{endpoint}: LLM request timed out."
    if any(token in lower for token in ["10061", "actively refused", "connection refused", "failed to establish a new connection"]):
        if is_local:
            return f"{endpoint}: Local standby endpoint is not running."
        return f"{endpoint}: Connection was refused by the endpoint."
    if "empty response" in lower:
        return f"{endpoint}: LLM returned an empty response."
    if "did not return probe text" in lower:
        return f"{endpoint}: LLM health probe did not return usable output."
    if "not valid json" in lower:
        return f"{endpoint}: LLM health probe returned invalid JSON."
    if not text:
        return f"{endpoint}: Unknown LLM connectivity error."
    return f"{endpoint}: {text[:180]}"


def _parse_probe_json(text: str) -> Dict[str, Any]:
    if not text:
        raise ValueError("Empty probe response")
    raw = str(text).strip()
    raw = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", raw, flags=re.IGNORECASE | re.MULTILINE).strip()
    start_idx = raw.find("{")
    end_idx = raw.rfind("}")
    if start_idx == -1 or end_idx < start_idx:
        raise ValueError("Probe response was not a JSON object")
    parsed = json.loads(raw[start_idx:end_idx + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Probe response JSON was not an object")
    return parsed


def _dedupe_errors(items: List[str], limit: int = 3) -> str:
    unique_items: List[str] = []
    seen = set()
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        unique_items.append(item)
    if not unique_items:
        return ""
    return " | ".join(unique_items[:limit])


def _request_headers(base_url: str) -> Dict[str, str]:
    normalized = normalize_base_url(base_url)
    headers = {
        "Accept": "application/json",
        "User-Agent": "Hyzync-LLM-Gateway/1.0",
    }
    if normalized.startswith("https://"):
        headers["Connection"] = "close"
    return headers


def _request_vllm_completion(
    base_url: str,
    model: str,
    prompt: str,
    num_predict: int,
    timeout_seconds: int,
    *,
    system_prompt: Optional[str] = None,
    temperature: float = 0.05,
    top_p: float = 0.9,
) -> Dict[str, Any]:
    url = f"{base_url}/completions"
    effective_prompt = prompt if not system_prompt else f"{str(system_prompt).strip()}\n\n{prompt}"
    payload = {
        "model": model,
        "prompt": effective_prompt,
        "max_tokens": num_predict,
        "temperature": temperature,
        "top_p": top_p,
        "stream": False,
    }
    response = _session.post(url, json=payload, timeout=timeout_seconds, headers=_request_headers(base_url))
    response.raise_for_status()
    data = response.json()
    text = str((data.get("choices") or [{}])[0].get("text") or "").strip()
    if not text:
        raise RuntimeError("LLM returned an empty completion.")
    return {
        "text": text,
        "tokens": int((data.get("usage") or {}).get("total_tokens", 0) or 0),
        "url": url,
    }


def _request_ollama_completion(
    base_url: str,
    model: str,
    prompt: str,
    num_predict: int,
    timeout_seconds: int,
    response_format: Optional[str],
    num_ctx: Optional[int],
    *,
    system_prompt: Optional[str] = None,
    temperature: float = 0.05,
    top_p: float = 0.9,
) -> Dict[str, Any]:
    url = f"{base_url}/api/generate"
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "num_predict": num_predict,
        },
    }
    if system_prompt:
        payload["system"] = str(system_prompt)
    if num_ctx:
        payload["options"]["num_ctx"] = int(num_ctx)
    if response_format:
        payload["format"] = response_format

    response = _session.post(url, json=payload, timeout=timeout_seconds, headers=_request_headers(base_url))
    response.raise_for_status()
    data = response.json()
    text = str(data.get("response") or "").strip()
    if not text and response_format:
        payload.pop("format", None)
        response = _session.post(url, json=payload, timeout=timeout_seconds, headers=_request_headers(base_url))
        response.raise_for_status()
        data = response.json()
        text = str(data.get("response") or "").strip()
    if not text:
        raise RuntimeError("LLM returned an empty response.")
    return {
        "text": text,
        "tokens": int(data.get("prompt_eval_count", 0) or 0) + int(data.get("eval_count", 0) or 0),
        "url": url,
    }


def request_completion(
    prompt: str,
    *,
    model: Optional[str] = None,
    num_predict: int = 256,
    response_format: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
    retries: Optional[int] = None,
    num_ctx: Optional[int] = None,
    stop_event: Any = None,
    system_prompt: Optional[str] = None,
    temperature: float = 0.05,
    top_p: float = 0.9,
) -> Dict[str, Any]:
    selected_model = str(model or getattr(settings, "OLLAMA_MODEL", "") or "").strip()
    timeout_value = max(5, int(timeout_seconds or getattr(settings, "OLLAMA_REQUEST_TIMEOUT_SECONDS", 90) or 90))
    retry_count = max(1, int(retries or getattr(settings, "OLLAMA_REQUEST_RETRIES", 1) or 1))
    endpoint_errors: List[str] = []
    raw_endpoint_errors: List[str] = []
    primary_error = ""
    primary_raw_error = ""
    last_url = normalize_base_url(getattr(settings, "OLLAMA_URL", ""))

    for attempt in range(retry_count):
        if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
            break
        for endpoint in ordered_endpoints():
            if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
                break
            base_url = endpoint["url"]
            last_url = base_url
            with _gateway_semaphore:
                try:
                    if endpoint["transport"] == "vllm":
                        result = _request_vllm_completion(
                            base_url,
                            selected_model,
                            prompt,
                            num_predict,
                            timeout_value,
                            system_prompt=system_prompt,
                            temperature=temperature,
                            top_p=top_p,
                        )
                    else:
                        result = _request_ollama_completion(
                            base_url,
                            selected_model,
                            prompt,
                            num_predict,
                            timeout_value,
                            response_format,
                            num_ctx,
                            system_prompt=system_prompt,
                            temperature=temperature,
                            top_p=top_p,
                        )
                    remember_active_endpoint(base_url)
                    return {
                        "ok": True,
                        "text": result["text"],
                        "tokens": int(result.get("tokens", 0) or 0),
                        "model": selected_model,
                        "url": base_url,
                        "transport": endpoint["transport"],
                        "role": endpoint["role"],
                        "fallback_used": endpoint["role"] != "primary",
                    }
                except Exception as error:
                    friendly_error = friendly_endpoint_error(base_url, error)
                    raw_error = f"{base_url}: {compact_error_text(error)}"
                    endpoint_errors.append(friendly_error)
                    raw_endpoint_errors.append(raw_error)
                    if endpoint["role"] == "primary" and not primary_error:
                        primary_error = friendly_error
                        primary_raw_error = raw_error
        if attempt < retry_count - 1 and endpoint_errors:
            backoff_seconds = min(6, 2 ** attempt)
            logger.info("Retrying LLM request (%s/%s) after errors: %s", attempt + 2, retry_count, _dedupe_errors(endpoint_errors, 2))
            time.sleep(backoff_seconds)

    final_error = primary_error or _dedupe_errors(endpoint_errors) or "Unknown LLM request failure."
    if raw_endpoint_errors:
        logger.info("LLM raw request failures: %s", _dedupe_errors(raw_endpoint_errors))
    telemetry.log_error(error_type="llm_request_failed", message=str(final_error), raw_response=None)
    return {
        "ok": False,
        "text": "",
        "tokens": 0,
        "model": selected_model,
        "url": last_url,
        "error": final_error,
        "raw_error": primary_raw_error or _dedupe_errors(raw_endpoint_errors),
    }


def probe_connectivity(
    timeout_seconds: Optional[int] = None,
    force_refresh: bool = False,
    *,
    model: Optional[str] = None,
    probe_prompt: Optional[str] = None,
    num_ctx: Optional[int] = None,
) -> Dict[str, Any]:
    selected_model = str(model or getattr(settings, "OLLAMA_MODEL", "") or "").strip()
    request_timeout = max(
        3,
        min(
            int(timeout_seconds or getattr(settings, "OLLAMA_PREFLIGHT_TIMEOUT_SECONDS", 30) or 30),
            int(getattr(settings, "OLLAMA_REQUEST_TIMEOUT_SECONDS", 90) or 90),
        ),
    )
    effective_probe_prompt = probe_prompt or 'Return only valid JSON: {"ok": true, "probe": "analysis"}'
    effective_num_ctx = int(num_ctx or 4096)

    now = time.time()
    if not force_refresh:
        with _health_cache_lock:
            cached = _health_cache.get("value")
            expires_at = float(_health_cache.get("expires_at") or 0.0)
        if cached and now < expires_at:
            return dict(cached)

    started_at = time.time()
    endpoint_errors: List[str] = []
    raw_endpoint_errors: List[str] = []
    primary_error = ""
    primary_raw_error = ""
    endpoint_rows: List[Dict[str, Any]] = []
    successful_endpoint: Optional[Dict[str, Any]] = None

    for endpoint in ordered_endpoints():
        base_url = endpoint["url"]
        endpoint_started = time.time()
        try:
            with _gateway_semaphore:
                if endpoint["transport"] == "vllm":
                    result = _request_vllm_completion(
                        base_url,
                        selected_model,
                        effective_probe_prompt,
                        64,
                        request_timeout,
                        temperature=0.0,
                        top_p=1.0,
                    )
                    probe_response = result["text"]
                else:
                    result = _request_ollama_completion(
                        base_url,
                        selected_model,
                        effective_probe_prompt,
                        64,
                        request_timeout,
                        "json",
                        effective_num_ctx,
                        temperature=0.0,
                        top_p=1.0,
                    )
                    probe_response = result["text"]
            parsed = _parse_probe_json(probe_response)
            if not isinstance(parsed, dict):
                raise RuntimeError("Probe response JSON was not an object.")
            remember_active_endpoint(base_url)
            successful_endpoint = endpoint
            endpoint_rows.append(
                {
                    **endpoint,
                    "status": "connected",
                    "active": True,
                    "latency": round(time.time() - endpoint_started, 2),
                    "error": "",
                }
            )
            break
        except Exception as error:
            friendly_error = friendly_endpoint_error(base_url, error)
            raw_error = f"{base_url}: {compact_error_text(error)}"
            endpoint_errors.append(friendly_error)
            raw_endpoint_errors.append(raw_error)
            if endpoint["role"] == "primary" and not primary_error:
                primary_error = friendly_error
                primary_raw_error = raw_error
            endpoint_rows.append(
                {
                    **endpoint,
                    "status": "error",
                    "active": False,
                    "latency": round(time.time() - endpoint_started, 2),
                    "error": friendly_error,
                }
            )

    tested_urls = {row["url"] for row in endpoint_rows}
    for endpoint in ordered_endpoints():
        if endpoint["url"] in tested_urls:
            continue
        endpoint_rows.append(
            {
                **endpoint,
                "status": "standby",
                "active": False,
                "latency": None,
                "error": "",
            }
        )

    total_latency = round(time.time() - started_at, 2)
    primary_url = normalize_base_url(getattr(settings, "OLLAMA_URL", ""))
    if successful_endpoint:
        on_primary = successful_endpoint["url"] == primary_url
        result = {
            "ok": True,
            "status": "connected" if on_primary else "degraded",
            "model": selected_model,
            "url": successful_endpoint["url"],
            "active_url": successful_endpoint["url"],
            "primary_url": primary_url,
            "latency": total_latency,
            "probe": "analysis_json",
            "fallback_active": not on_primary,
            "endpoints": endpoint_rows,
        }
        if endpoint_errors:
            result["warning"] = _dedupe_errors(endpoint_errors)
    else:
        final_error = primary_error or _dedupe_errors(endpoint_errors) or "No LLM endpoint candidates configured."
        result = {
            "ok": False,
            "status": "error",
            "model": selected_model,
            "url": primary_url,
            "active_url": "",
            "primary_url": primary_url,
            "latency": total_latency,
            "probe": "analysis_json",
            "fallback_active": False,
            "error": final_error,
            "endpoints": endpoint_rows,
        }
        raw_error = primary_raw_error or _dedupe_errors(raw_endpoint_errors)
        if raw_error:
            result["raw_error"] = raw_error

    with _health_cache_lock:
        _health_cache["value"] = dict(result)
        _health_cache["expires_at"] = time.time() + 30.0
    return result
