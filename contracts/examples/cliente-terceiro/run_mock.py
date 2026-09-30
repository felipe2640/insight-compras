"""Executa a jornada HTTP contra um mock gerado do OpenAPI, sem código do Hub.

Uso: iniciar Prism com --errors em 127.0.0.1:4010 e executar este arquivo.
O mock é sem estado: esta prova valida rotas, bodies e respostas do contrato,
não regras de persistência, autenticação real ou cálculo do motor.
"""

import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import yaml

SPEC = yaml.safe_load((Path(__file__).parents[3] / "openapi" / "cotacao-hub-v1.yaml").read_text())
BASE = os.environ.get("HUB_MOCK_URL", "http://127.0.0.1:4010")
ID = "11111111-1111-4111-8111-111111111111"
STEPS = [
    (1, "post", "/api/v1/suppliers"),
    (2, "post", "/api/v1/quotations"),
    (3, "post", "/api/v1/quotations/{quotationId}/items:bulk"),
    (4, "post", "/api/v1/quotations/{quotationId}:open"),
    (5, "post", "/api/v1/quotations/{quotationId}/invitations"),
    (6, "post", "/api/v1/supplier/invitations:redeem"),
    (7, "post", "/api/v1/supplier/auth/challenges"),
    (7, "post", "/api/v1/supplier/auth/challenges/{challengeId}:verify"),
    (8, "get", "/api/v1/supplier/quotations/{quotationId}"),
    (9, "put", "/api/v1/supplier/quotations/{quotationId}/offer-items:bulk"),
    (10, "put", "/api/v1/supplier/quotations/{quotationId}/offer"),
    (11, "post", "/api/v1/supplier/quotations/{quotationId}:submit"),
    (12, "post", "/api/v1/quotations/{quotationId}:close"),
    (13, "get", "/api/v1/award-policies"),
    (13, "post", "/api/v1/quotations/{quotationId}/award-runs"),
    (14, "get", "/api/v1/award-runs/{awardRunId}"),
    (14, "get", "/api/v1/award-runs/{awardRunId}/snapshot"),
    (15, "post", "/api/v1/award-runs/{awardRunId}:adjust"),
    (16, "post", "/api/v1/award-runs/{awardRunId}:approve"),
    (17, "post", "/api/v1/award-runs/{awardRunId}/purchase-orders"),
    (18, "get", "/api/v1/purchase-orders/{orderId}"),
    (18, "patch", "/api/v1/purchase-orders/{orderId}"),
    (18, "post", "/api/v1/purchase-orders/{orderId}:issue"),
    (19, "post", "/api/v1/purchase-orders/{orderId}/invitations"),
    (19, "post", "/api/v1/supplier/order-invitations:redeem"),
    (19, "post", "/api/v1/supplier/auth/order-challenges"),
    (19, "post", "/api/v1/supplier/auth/challenges/{challengeId}:verify"),
    (19, "get", "/api/v1/supplier/purchase-orders/{orderId}"),
    (19, "post", "/api/v1/supplier/purchase-orders/{orderId}:confirm"),
    (20, "post", "/api/v1/webhook-subscriptions"),
    (20, "get", "/api/v1/events"),
]


def deref(schema):
    if "$ref" in schema:
        value = SPEC
        for key in schema["$ref"].removeprefix("#/").split("/"):
            value = value[key]
        return deref(value)
    return schema


def sample(schema):
    schema = deref(schema)
    if "example" in schema:
        return schema["example"]
    if "const" in schema:
        return schema["const"]
    if "enum" in schema:
        return schema["enum"][0]
    if "allOf" in schema:
        parts = [sample(x) for x in schema["allOf"]]
        return {k: v for part in parts if isinstance(part, dict) for k, v in part.items()}
    if "oneOf" in schema:
        return sample(schema["oneOf"][0])
    typ = schema.get("type", "object" if "properties" in schema else "string")
    if isinstance(typ, list):
        typ = next((x for x in typ if x != "null"), "null")
    if typ == "object":
        return {name: sample(schema["properties"][name]) for name in schema.get("required", []) if name in schema.get("properties", {})}
    if typ == "array":
        return [sample(schema.get("items", {})) for _ in range(max(1, schema.get("minItems", 1)))]
    if typ == "integer":
        return max(1, schema.get("minimum", 0))
    if typ == "number":
        return 1
    if typ == "boolean":
        return False
    if typ == "null":
        return None
    fmt = schema.get("format")
    if fmt == "uuid":
        return ID
    if fmt == "date-time":
        return "2026-10-01T12:00:00Z"
    if fmt == "email":
        return "person@example.test"
    if fmt == "uri":
        return "https://example.test/event"
    pattern = schema.get("pattern", "")
    if "[A-Z]{3}" in pattern:
        return "BRL"
    if "[0-9]{1,6}" in pattern:
        return "1.000000"
    if pattern.startswith("^\\+"):
        return "+5511999990000"
    return "x" * max(1, schema.get("minLength", 1))


def operation_parameters(op):
    for parameter in op.get("parameters", []):
        yield deref(parameter)


def invoke(step, method, path):
    op = SPEC["paths"][path][method]
    url_path = re.sub(r"\{[^}]+\}", ID, path)
    headers = {"Authorization": "Bearer mock-token", "Accept": "application/json"}
    for parameter in operation_parameters(op):
        if parameter.get("in") == "header" and parameter.get("required"):
            name = parameter["name"]
            headers[name] = "contract-key-0001" if name == "Idempotency-Key" else '"v1"'
    data = None
    if "requestBody" in op:
        body = deref(op["requestBody"])
        content = body.get("content", {})
        if "application/json" in content:
            headers["Content-Type"] = "application/json"
            data = json.dumps(sample(content["application/json"]["schema"])).encode()
        elif "application/x-www-form-urlencoded" in content:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            data = b"grant_type=client_credentials"
        else:
            raise AssertionError(f"Unsupported content type: {method} {path}")
    request = Request(BASE + url_path, data=data, method=method.upper(), headers=headers)
    try:
        with urlopen(request, timeout=10) as response:
            status = response.status
            payload = response.read()
    except HTTPError as error:
        payload = error.read()
        raise AssertionError(f"step {step} {method.upper()} {path}: HTTP {error.code}: {payload[:400]!r}") from error
    declared = [int(code) for code in op.get("responses", {}) if code.isdigit() and code.startswith("2")]
    assert status in declared, (step, method, path, status, declared)
    if payload and response.headers.get("Content-Type", "").startswith("application/json"):
        json.loads(payload)
    print(f"{step:02} {method.upper():5} {path} -> {status}")


if __name__ == "__main__":
    for entry in STEPS:
        invoke(*entry)
    print(f"PASS: {len(STEPS)} HTTP calls covering steps 1-20 against OpenAPI-derived mock")
